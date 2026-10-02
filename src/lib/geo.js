const EARTH_RADIUS_M = 6371000
const GRAVITY = 9.81

const toRad = (deg) => (deg * Math.PI) / 180
const toDeg = (rad) => (rad * 180) / Math.PI

/** Great-circle distance between two {lat,lon} points, in meters. */
export function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Projects {lat,lon} points onto a local equirectangular (flat-earth) meter
 * grid centered on a reference point. Accurate enough for single-track spans
 * (curvature windows, map layout) but not for large-scale distances — use
 * haversineMeters for cumulative track distance instead.
 */
export function projectToLocalMeters(points, ref) {
  const refLatRad = toRad(ref.lat)
  return points.map((p) => ({
    x: EARTH_RADIUS_M * toRad(p.lon - ref.lon) * Math.cos(refLatRad),
    y: EARTH_RADIUS_M * toRad(p.lat - ref.lat),
  }))
}

/**
 * Circumradius (meters) of the circle through three local-meter points, plus
 * the signed turn direction (cross product of the two chord vectors).
 * Returns radius = Infinity for (near-)collinear points, i.e. a straight line.
 */
export function circumradiusAndDirection(p1, p2, p3) {
  const v1x = p2.x - p1.x
  const v1y = p2.y - p1.y
  const v2x = p3.x - p2.x
  const v2y = p3.y - p2.y

  const cross = v1x * v2y - v1y * v2x // >0 left turn, <0 right turn (x=east, y=north)

  const a = Math.hypot(p3.x - p2.x, p3.y - p2.y)
  const b = Math.hypot(p3.x - p1.x, p3.y - p1.y)
  const c = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const area = Math.abs(cross) / 2

  if (area < 1e-6 || a === 0 || b === 0 || c === 0) {
    return { radiusM: Infinity, direction: 'straight' }
  }

  const radiusM = (a * b * c) / (4 * area)
  return { radiusM, direction: cross > 0 ? 'left' : 'right' }
}

/**
 * Estimated bank (lean) angle in degrees for a turn of the given radius taken
 * at the given speed, from the standard "ideal banking" formula:
 * theta = atan(v^2 / (g * r)) — the angle at which a rider/vehicle corners
 * with zero net lateral force. This is a physics estimate from GPS-derived
 * geometry, not a measured value — see README for caveats.
 */
export function estimateBankAngleDeg(radiusM, speedMs) {
  if (!Number.isFinite(radiusM) || !Number.isFinite(speedMs) || radiusM <= 0) return null
  const theta = Math.atan((speedMs * speedMs) / (GRAVITY * radiusM))
  return toDeg(theta)
}

export { toDeg, toRad }
