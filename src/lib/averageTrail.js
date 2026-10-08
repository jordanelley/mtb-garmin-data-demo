import { haversineMeters } from './geo.js'
import { buildTrackModel } from './track.js'

const NEAREST_THRESHOLD_M = 30 // how close an activity sample must be to count as "at" a given spine point
const MAX_SAMPLE_POINTS = 600 // downsample each activity before the nearest-point scan, for speed
const FALLBACK_SPEED_MS = 2.5 // ~9 km/h, used only if no matched activity has speed data anywhere on the trail
const BASE_TIME_MS = Date.UTC(2026, 0, 1)

function downsample(points, maxN) {
  if (points.length <= maxN) return points
  const step = points.length / maxN
  const out = []
  for (let i = 0; i < points.length; i += step) out.push(points[Math.floor(i)])
  return out
}

function nearestWithin(point, candidates, maxDistM) {
  let best = null
  let bestD = maxDistM
  for (const p of candidates) {
    const d = haversineMeters(point, p)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/**
 * Builds a synthetic "average ride" track model positioned on the official trail's own geometry
 * (its lat/lon spine), with elevation and speed at each spine point averaged from every matched
 * activity's nearest recorded sample. Feeding this through buildTrackModel lets the entire
 * existing track-analysis pipeline (gradient, berm/bank-angle, grading) run unchanged on the
 * averaged data — so the average can be rendered, graded, and checked for too-steep sections
 * exactly like a real ride.
 *
 * Spine points with no nearby activity coverage (e.g. a stretch none of the matched rides
 * actually covered) fall back to the official trail's own recorded elevation, and to the overall
 * average speed across the points that did have coverage.
 */
export function buildAverageTrack(officialTrail, matchedActivities) {
  const spine = officialTrail.points
  if (spine.length < 2 || matchedActivities.length === 0) return null

  const sampledActivities = matchedActivities.map((a) => downsample(a.track.points, MAX_SAMPLE_POINTS))

  const eleAtSpine = []
  const speedAtSpine = []
  for (const point of spine) {
    const eles = []
    const speeds = []
    for (const activityPoints of sampledActivities) {
      const sample = nearestWithin(point, activityPoints, NEAREST_THRESHOLD_M)
      if (!sample) continue
      if (sample.ele !== null) eles.push(sample.ele)
      if (Number.isFinite(sample.speedMs)) speeds.push(sample.speedMs)
    }
    eleAtSpine.push(mean(eles))
    speedAtSpine.push(mean(speeds))
  }

  const overallAvgSpeed = mean(speedAtSpine.filter((s) => s !== null)) ?? FALLBACK_SPEED_MS

  let cursorMs = BASE_TIME_MS
  const rawPoints = spine.map((point, i) => {
    if (i > 0) {
      const segM = haversineMeters(spine[i - 1], point)
      const speed = speedAtSpine[i] ?? overallAvgSpeed
      cursorMs += (segM / Math.max(speed, 0.3)) * 1000
    }
    return { lat: point.lat, lon: point.lon, ele: eleAtSpine[i] ?? point.ele ?? null, time: new Date(cursorMs) }
  })

  const rideWord = matchedActivities.length === 1 ? 'ride' : 'rides'
  return buildTrackModel('average-track', `${officialTrail.name} — average of ${matchedActivities.length} ${rideWord}`, rawPoints)
}
