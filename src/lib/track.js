import { circumradiusAndDirection, estimateBankAngleDeg, haversineMeters, projectToLocalMeters } from './geo.js'
import { classifyBermGrade } from './grade.js'

const WINDOW_HALF_M = 4 // how far either side of a point to look for curvature/speed neighbors
const MIN_RELIABLE_RADIUS_M = 1 // tighter than this is almost certainly GPS jitter, not real geometry
const MAX_SANE_BANK_DEG = 60 // clamp for display; anything past this is noise, not a real berm
const MIN_BERM_DEG = 8 // estimated bank angle floor to call a stretch a "berm" at all
const MERGE_GAP_M = 3 // bridge small gaps so one physical berm isn't split into fragments
const MIN_GRADIENT_RUN_M = 0.5 // guard against divide-by-near-zero on duplicate/near-duplicate points

function findWindowNeighbors(distM, i, halfWindowM) {
  let j1 = i
  while (j1 > 0 && distM[i] - distM[j1 - 1] < halfWindowM) j1--
  if (j1 === i && i > 0) j1 = i - 1

  let j2 = i
  const n = distM.length
  while (j2 < n - 1 && distM[j2 + 1] - distM[i] < halfWindowM) j2++
  if (j2 === i && i < n - 1) j2 = i + 1

  return [j1, j2]
}

/** Builds a fully-derived track model (distances, gradient, estimated bank angle, berms) from raw parsed GPX points. */
export function buildTrackModel(filename, name, rawPoints) {
  const points = rawPoints.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  const n = points.length

  const centroid = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat / n, lon: acc.lon + p.lon / n }),
    { lat: 0, lon: 0 },
  )
  const projected = projectToLocalMeters(points, centroid)

  const distM = [0]
  for (let i = 1; i < n; i++) distM.push(distM[i - 1] + haversineMeters(points[i - 1], points[i]))

  const hasTime = points.some((p) => p.time)
  const hasEle = points.some((p) => p.ele !== null)

  const derived = points.map((p, i) => {
    const [j1, j2] = findWindowNeighbors(distM, i, WINDOW_HALF_M)

    let radiusM = Infinity
    let turnDir = 'straight'
    let bankAngleDeg = null
    let speedMs = null

    if (j1 !== i && j2 !== i) {
      const result = circumradiusAndDirection(projected[j1], projected[i], projected[j2])
      radiusM = result.radiusM
      turnDir = result.direction

      if (hasTime && points[j1].time && points[j2].time) {
        const dtS = (points[j2].time - points[j1].time) / 1000
        speedMs = dtS > 0 ? (distM[j2] - distM[j1]) / dtS : null
      }

      if (radiusM >= MIN_RELIABLE_RADIUS_M) {
        const angle = estimateBankAngleDeg(radiusM, speedMs)
        bankAngleDeg = angle === null ? null : Math.min(angle, MAX_SANE_BANK_DEG)
      }
    }

    let gradPct = null
    if (i > 0 && hasEle && p.ele !== null && points[i - 1].ele !== null) {
      const run = distM[i] - distM[i - 1]
      if (run >= MIN_GRADIENT_RUN_M) gradPct = ((p.ele - points[i - 1].ele) / run) * 100
    }

    return {
      ...p,
      idx: i,
      x: projected[i].x,
      y: projected[i].y,
      distM: distM[i],
      gradPct,
      radiusM,
      turnDir,
      bankAngleDeg,
      speedMs,
    }
  })

  // Group contiguous (and near-contiguous) qualifying points into discrete berm features.
  const qualifies = derived.map((p) => p.bankAngleDeg !== null && p.bankAngleDeg >= MIN_BERM_DEG)
  const rawRuns = []
  let runStart = null
  for (let i = 0; i < n; i++) {
    if (qualifies[i] && runStart === null) runStart = i
    if (!qualifies[i] && runStart !== null) {
      rawRuns.push([runStart, i - 1])
      runStart = null
    }
  }
  if (runStart !== null) rawRuns.push([runStart, n - 1])

  const mergedRuns = []
  for (const run of rawRuns) {
    const prev = mergedRuns[mergedRuns.length - 1]
    if (prev && distM[run[0]] - distM[prev[1]] <= MERGE_GAP_M) {
      prev[1] = run[1]
    } else {
      mergedRuns.push(run)
    }
  }

  const berms = mergedRuns.map(([startIdx, endIdx]) => {
    let peakIdx = startIdx
    const dirCounts = { left: 0, right: 0 }
    for (let i = startIdx; i <= endIdx; i++) {
      if (derived[i].bankAngleDeg > derived[peakIdx].bankAngleDeg) peakIdx = i
      if (derived[i].turnDir === 'left') dirCounts.left++
      else if (derived[i].turnDir === 'right') dirCounts.right++
    }
    const direction = dirCounts.left >= dirCounts.right ? 'left' : 'right'
    const peakAngleDeg = derived[peakIdx].bankAngleDeg

    return {
      startIdx,
      endIdx,
      peakIdx,
      startDistM: distM[startIdx],
      endDistM: distM[endIdx],
      peakAngleDeg,
      direction,
      grade: classifyBermGrade(peakAngleDeg),
    }
  })

  const elevations = derived.filter((p) => p.ele !== null).map((p) => p.ele)
  let elevationGainM = 0
  let elevationLossM = 0
  for (let i = 1; i < n; i++) {
    if (points[i].ele === null || points[i - 1].ele === null) continue
    const d = points[i].ele - points[i - 1].ele
    if (d > 0) elevationGainM += d
    else elevationLossM += -d
  }

  const xs = projected.map((p) => p.x)
  const ys = projected.map((p) => p.y)
  const maxAbsGrad = derived.reduce((m, p) => (p.gradPct !== null ? Math.max(m, Math.abs(p.gradPct)) : m), 0)

  return {
    filename,
    name: name || filename,
    centroid,
    points: derived,
    berms,
    hasTime,
    hasEle,
    totals: {
      distanceM: distM[n - 1] ?? 0,
      elevationGainM,
      elevationLossM,
      minEleM: elevations.length ? Math.min(...elevations) : null,
      maxEleM: elevations.length ? Math.max(...elevations) : null,
    },
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
    gradientDomainPct: Math.min(Math.max(maxAbsGrad, 3), 25),
  }
}
