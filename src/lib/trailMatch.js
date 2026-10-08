import { haversineMeters } from './geo.js'

const MATCH_THRESHOLD_M = 30 // how close a point must be to count as "on" the official trail
const BBOX_PAD_DEG = 0.002 // ~200m pad around an official trail's bounds, for the cheap pre-filter
const MAX_SAMPLE_POINTS = 300 // downsample both sides before the O(n*m) distance scan
const STRONG_MATCH_SCORE = 0.6
const PARTIAL_MATCH_SCORE = 0.15

function downsample(points, maxN) {
  if (points.length <= maxN) return points
  const step = points.length / maxN
  const out = []
  for (let i = 0; i < points.length; i += step) out.push(points[Math.floor(i)])
  return out
}

function boundsOf(points, padDeg) {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lon > maxLon) maxLon = p.lon
  }
  return { minLat: minLat - padDeg, maxLat: maxLat + padDeg, minLon: minLon - padDeg, maxLon: maxLon + padDeg }
}

function inBounds(p, b) {
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lon >= b.minLon && p.lon <= b.maxLon
}

/** Pre-processes an official trail once (on load) so matching against it later is cheap. */
export function prepareOfficialTrail(name, points, officialGrade = null) {
  return {
    name,
    officialGrade,
    points: downsample(points, MAX_SAMPLE_POINTS),
    bounds: boundsOf(points, BBOX_PAD_DEG),
  }
}

/**
 * Scores a ridden track against every prepared official trail: the fraction of the track's
 * (downsampled) points that land within MATCH_THRESHOLD_M of some point on that trail. A
 * bounding-box pre-filter skips trails that can't possibly overlap before the distance scan.
 * Returns trails sorted best-first; trails with no plausible overlap score 0.
 */
export function matchOfficialTrails(trackPoints, officialTrails) {
  const sample = downsample(trackPoints, MAX_SAMPLE_POINTS)
  if (sample.length === 0 || officialTrails.length === 0) return []

  return officialTrails
    .map((trail) => {
      const inBox = sample.filter((p) => inBounds(p, trail.bounds))
      if (inBox.length < Math.max(5, sample.length * 0.05)) return { name: trail.name, officialGrade: trail.officialGrade, score: 0 }

      let hits = 0
      for (const p of inBox) {
        for (const o of trail.points) {
          if (haversineMeters(p, o) <= MATCH_THRESHOLD_M) {
            hits++
            break
          }
        }
      }
      return { name: trail.name, officialGrade: trail.officialGrade, score: hits / sample.length }
    })
    .sort((a, b) => b.score - a.score)
}

/** Reduces a sorted match list to a single verdict for display: a clear match, a partial/mixed match, or none. */
export function classifyTrailMatch(scores) {
  const best = scores[0]
  if (!best || best.score < PARTIAL_MATCH_SCORE) return { level: 'none' }
  if (best.score >= STRONG_MATCH_SCORE) return { level: 'match', name: best.name, officialGrade: best.officialGrade, score: best.score }
  return { level: 'partial', name: best.name, officialGrade: best.officialGrade, score: best.score }
}
