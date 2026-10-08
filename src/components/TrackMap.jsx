import { useMemo, useRef, useState } from 'react'
import { gradientColor } from '../lib/colors.js'
import { projectToLocalMeters } from '../lib/geo.js'

const VIEW_W = 640
const VIEW_H = 420
const PAD = 32
const ACTIVITY_COLOR = '#fb8c00'
const TOO_STEEP_COLOR = '#e53935'

function useProjection(bounds) {
  return useMemo(() => {
    const { minX, maxX, minY, maxY } = bounds
    const spanX = Math.max(maxX - minX, 1)
    const spanY = Math.max(maxY - minY, 1)
    const scale = Math.min((VIEW_W - PAD * 2) / spanX, (VIEW_H - PAD * 2) / spanY)
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    const toScreen = (x, y) => ({
      sx: VIEW_W / 2 + (x - midX) * scale,
      sy: VIEW_H / 2 - (y - midY) * scale, // flip: screen-down vs north-up
    })

    return toScreen
  }, [bounds])
}

export default function TrackMap({ track, mode, officialTrail, tooSteepRuns }) {
  // Official trail points are raw lat/lon — project them into the same local-meter frame as the
  // ridden track (same centroid) so the two can share one screen projection and overlay correctly.
  const officialProjected = useMemo(
    () => (officialTrail ? projectToLocalMeters(officialTrail.points, track.centroid) : null),
    [officialTrail, track.centroid],
  )

  const bounds = useMemo(() => {
    if (!officialProjected || officialProjected.length === 0) return track.bounds
    const xs = officialProjected.map((p) => p.x)
    const ys = officialProjected.map((p) => p.y)
    return {
      minX: Math.min(track.bounds.minX, ...xs),
      maxX: Math.max(track.bounds.maxX, ...xs),
      minY: Math.min(track.bounds.minY, ...ys),
      maxY: Math.max(track.bounds.maxY, ...ys),
    }
  }, [track.bounds, officialProjected])

  const toScreen = useProjection(bounds)
  const containerRef = useRef(null)
  const [hoverIdx, setHoverIdx] = useState(null)
  const [hoveredSteepRun, setHoveredSteepRun] = useState(null)
  const [hoveredBerm, setHoveredBerm] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [showTooSteep, setShowTooSteep] = useState(true)
  const [showSteepBerms, setShowSteepBerms] = useState(true)

  // Berms whose estimated bank angle would classify them at a harder grade than the matched
  // official trail is actually signed for — i.e. berms that exceed the official grading.
  const steepBerms = useMemo(() => {
    if (!officialTrail?.officialGrade) return []
    return track.berms.filter((b) => b.grade.grade > officialTrail.officialGrade.grade)
  }, [track.berms, officialTrail])

  const screenPoints = useMemo(() => track.points.map((p) => toScreen(p.x, p.y)), [track, toScreen])
  const officialScreenPoints = useMemo(
    () => (officialProjected ? officialProjected.map((p) => toScreen(p.x, p.y)) : null),
    [officialProjected, toScreen],
  )
  const officialColor = officialTrail?.officialGrade?.color ?? 'var(--muted)'

  function handleMove(e) {
    const rect = containerRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * VIEW_W
    const my = ((e.clientY - rect.top) / rect.height) * VIEW_H

    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < screenPoints.length; i++) {
      const dx = screenPoints[i].sx - mx
      const dy = screenPoints[i].sy - my
      const d = dx * dx + dy * dy
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    setHoverIdx(best)
    setHoveredSteepRun(null)
    setHoveredBerm(null)
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function handleSteepEnter(run, e) {
    const rect = containerRef.current.getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setHoveredSteepRun(run)
    setHoveredBerm(null)
    setHoverIdx(null)
  }

  function handleBermEnter(berm, e) {
    const rect = containerRef.current.getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setHoveredBerm(berm)
    setHoveredSteepRun(null)
    setHoverIdx(null)
  }

  const hovered = hoverIdx !== null ? track.points[hoverIdx] : null

  return (
    <div className="chart-card">
      <h3>Track shape</h3>
      {officialTrail && (
        <p className="map-legend">
          <span className="swatch-dot" style={{ background: officialColor }} /> {officialTrail.name} (official, {officialTrail.officialGrade?.label ?? 'ungraded'})
          <span className="swatch-dot" style={{ background: ACTIVITY_COLOR, marginLeft: 14 }} /> Ridden track
          {tooSteepRuns?.length > 0 && (
            <label className="map-toggle">
              <input type="checkbox" checked={showTooSteep} onChange={(e) => setShowTooSteep(e.target.checked)} />
              Show too-steep markers ({tooSteepRuns.length})
            </label>
          )}
          {steepBerms.length > 0 && (
            <label className="map-toggle">
              <input type="checkbox" checked={showSteepBerms} onChange={(e) => setShowSteepBerms(e.target.checked)} />
              Show berms exceeding grade ({steepBerms.length})
            </label>
          )}
        </p>
      )}
      <div className="map-container" ref={containerRef}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="map-svg" role="img" aria-label="Plot of GPS track points">
          {officialScreenPoints?.slice(1).map((pt, i) => {
            const prev = officialScreenPoints[i]
            return (
              <line
                key={`official-${i}`}
                x1={prev.sx}
                y1={prev.sy}
                x2={pt.sx}
                y2={pt.sy}
                stroke={officialColor}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.5}
              />
            )
          })}

          {screenPoints.slice(1).map((pt, i) => {
            const prev = screenPoints[i]
            const grad = track.points[i + 1].gradPct
            const color = officialTrail ? ACTIVITY_COLOR : grad === null ? 'var(--muted)' : gradientColor(grad, track.gradientDomainPct, mode)
            return (
              <line key={i} x1={prev.sx} y1={prev.sy} x2={pt.sx} y2={pt.sy} stroke={color} strokeWidth={2} strokeLinecap="round" />
            )
          })}

          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)} />

          {showTooSteep && tooSteepRuns?.map((run) => {
            const pt = screenPoints[run.peakIdx]
            return (
              <circle
                key={`steep-${run.startIdx}`}
                cx={pt.sx}
                cy={pt.sy}
                r={7}
                fill={TOO_STEEP_COLOR}
                stroke="#fff"
                strokeWidth={2}
                className="too-steep-marker"
                onMouseEnter={(e) => handleSteepEnter(run, e)}
                onMouseLeave={() => setHoveredSteepRun(null)}
              />
            )
          })}

          {showSteepBerms && steepBerms.map((berm) => {
            const pt = screenPoints[berm.peakIdx]
            return (
              <circle
                key={`berm-${berm.startIdx}`}
                cx={pt.sx}
                cy={pt.sy}
                r={7}
                fill={berm.grade.color}
                stroke="#fff"
                strokeWidth={2}
                className="too-steep-marker"
                onMouseEnter={(e) => handleBermEnter(berm, e)}
                onMouseLeave={() => setHoveredBerm(null)}
              />
            )
          })}
        </svg>

        {hoveredBerm && (
          <div className="chart-tooltip" style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}>
            <div>
              <strong>Berm exceeds grade</strong>
            </div>
            <div>
              ~{hoveredBerm.peakAngleDeg.toFixed(0)}° {hoveredBerm.direction} turn — {hoveredBerm.grade.label}
              {officialTrail?.officialGrade && ` (exceeds ${officialTrail.officialGrade.label} baseline)`}
            </div>
          </div>
        )}

        {!hoveredBerm && hoveredSteepRun && (
          <div className="chart-tooltip" style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}>
            <div>
              <strong>Too steep</strong>
            </div>
            <div>
              {hoveredSteepRun.lengthM.toFixed(0)}m at up to {hoveredSteepRun.peakDeg.toFixed(0)}°
              {officialTrail?.officialGrade && ` — exceeds ${officialTrail.officialGrade.label} baseline`}
            </div>
          </div>
        )}

        {!hoveredSteepRun && !hoveredBerm && hovered && (
          <div className="chart-tooltip" style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}>
            <div>
              <strong>{(hovered.distM / 1000).toFixed(2)} km</strong> along track
            </div>
            {hovered.ele !== null && <div>Elevation: {hovered.ele.toFixed(1)} m</div>}
            {hovered.gradPct !== null && <div>Gradient: {hovered.gradPct.toFixed(1)}%</div>}
            {hovered.bankAngleDeg !== null && (
              <div>
                Est. bank angle: {hovered.bankAngleDeg.toFixed(0)}° ({hovered.turnDir})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
