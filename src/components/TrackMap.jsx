import { useMemo, useRef, useState } from 'react'
import { gradientColor, STATUS } from '../lib/colors.js'

const VIEW_W = 640
const VIEW_H = 420
const PAD = 32

function useProjection(track) {
  return useMemo(() => {
    const { minX, maxX, minY, maxY } = track.bounds
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
  }, [track])
}

export default function TrackMap({ track, mode, highlightedBermIdx, onSelectBerm }) {
  const toScreen = useProjection(track)
  const containerRef = useRef(null)
  const [hoverIdx, setHoverIdx] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const screenPoints = useMemo(() => track.points.map((p) => toScreen(p.x, p.y)), [track, toScreen])

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
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const hovered = hoverIdx !== null ? track.points[hoverIdx] : null

  return (
    <div className="chart-card">
      <h3>Track shape</h3>
      <div className="map-container" ref={containerRef}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="map-svg" role="img" aria-label="Plot of GPS track points">
          {screenPoints.slice(1).map((pt, i) => {
            const prev = screenPoints[i]
            const grad = track.points[i + 1].gradPct
            const color = grad === null ? 'var(--muted)' : gradientColor(grad, track.gradientDomainPct, mode)
            return (
              <line key={i} x1={prev.sx} y1={prev.sy} x2={pt.sx} y2={pt.sy} stroke={color} strokeWidth={2} strokeLinecap="round" />
            )
          })}

          {track.berms.map((berm, i) => {
            const pt = screenPoints[berm.peakIdx]
            const isHighlighted = i === highlightedBermIdx
            return (
              <g key={i} className="berm-marker" onClick={() => onSelectBerm(i)} style={{ cursor: 'pointer' }}>
                {isHighlighted && <circle cx={pt.sx} cy={pt.sy} r={10} fill="none" stroke={STATUS[berm.severity.key]} strokeWidth={2} className="berm-pulse" />}
                <circle cx={pt.sx} cy={pt.sy} r={5} fill={STATUS[berm.severity.key]} stroke="var(--surface)" strokeWidth={2} />
              </g>
            )
          })}

          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)} />

          {hovered && <circle cx={screenPoints[hoverIdx].sx} cy={screenPoints[hoverIdx].sy} r={4} fill="none" stroke="var(--text-primary)" strokeWidth={1.5} />}
        </svg>

        {hovered && (
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
