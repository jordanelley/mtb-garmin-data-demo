import { useRef, useState } from 'react'
import { gradientColor } from '../lib/colors.js'

const VIEW_W = 640
const VIEW_H = 220
const PAD = { top: 12, right: 16, bottom: 28, left: 52 }

function niceEleTicks(min, max) {
  const span = max - min || 1
  const step = span <= 20 ? 5 : span <= 60 ? 10 : 25
  const start = Math.floor(min / step) * step
  const ticks = []
  for (let v = start; v <= max + step; v += step) ticks.push(v)
  return ticks
}

export default function ElevationProfile({ track, mode }) {
  const containerRef = useRef(null)
  const [hoverIdx, setHoverIdx] = useState(null)

  const { minEleM, maxEleM, distanceM } = track.totals
  const eleMin = (minEleM ?? 0) - 2
  const eleMax = (maxEleM ?? 1) + 2

  const xScale = (d) => PAD.left + (d / Math.max(distanceM, 1)) * (VIEW_W - PAD.left - PAD.right)
  const yScale = (ele) => VIEW_H - PAD.bottom - ((ele - eleMin) / (eleMax - eleMin)) * (VIEW_H - PAD.top - PAD.bottom)
  const baseY = VIEW_H - PAD.bottom

  const screenX = track.points.map((p) => xScale(p.distM))

  function handleMove(e) {
    const rect = containerRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * VIEW_W
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < screenX.length; i++) {
      const d = Math.abs(screenX[i] - mx)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    setHoverIdx(best)
  }

  if (!track.hasEle) {
    return (
      <div className="chart-card">
        <h3>Elevation &amp; gradient</h3>
        <p className="chart-empty">This file has no elevation data.</p>
      </div>
    )
  }

  const eleTicks = niceEleTicks(eleMin, eleMax)
  const hovered = hoverIdx !== null ? track.points[hoverIdx] : null

  return (
    <div className="chart-card">
      <h3>Elevation &amp; gradient</h3>
      <div className="profile-container" ref={containerRef}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="profile-svg">
          {eleTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={yScale(t)} y2={yScale(t)} className="gridline" />
              <text x={PAD.left - 8} y={yScale(t)} className="axis-label" textAnchor="end" dominantBaseline="middle">
                {t.toFixed(0)}m
              </text>
            </g>
          ))}

          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={xScale(distanceM * f)} y={VIEW_H - 8} className="axis-label" textAnchor="middle">
              {((distanceM * f) / 1000).toFixed(2)}km
            </text>
          ))}

          {track.points.slice(1).map((p, i) => {
            const prev = track.points[i]
            if (prev.gradPct === null) return null
            const color = gradientColor(p.gradPct ?? 0, track.gradientDomainPct, mode)
            const x1 = screenX[i]
            const x2 = screenX[i + 1]
            return (
              <polygon
                key={`fill-${i}`}
                points={`${x1},${baseY} ${x1},${yScale(prev.ele)} ${x2},${yScale(p.ele)} ${x2},${baseY}`}
                fill={color}
                opacity={0.1}
              />
            )
          })}

          {track.points.slice(1).map((p, i) => {
            const prev = track.points[i]
            if (prev.ele === null || p.ele === null) return null
            const color = p.gradPct === null ? 'var(--muted)' : gradientColor(p.gradPct, track.gradientDomainPct, mode)
            return (
              <line key={`line-${i}`} x1={screenX[i]} y1={yScale(prev.ele)} x2={screenX[i + 1]} y2={yScale(p.ele)} stroke={color} strokeWidth={2} strokeLinecap="round" />
            )
          })}

          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={baseY} className="axis-line" />
          <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={baseY} y2={baseY} className="axis-line" />

          {hovered && hovered.ele !== null && (
            <>
              <line x1={screenX[hoverIdx]} x2={screenX[hoverIdx]} y1={PAD.top} y2={baseY} className="crosshair" />
              <circle cx={screenX[hoverIdx]} cy={yScale(hovered.ele)} r={4} fill="var(--text-primary)" />
            </>
          )}

          <rect x={PAD.left} y={PAD.top} width={VIEW_W - PAD.left - PAD.right} height={VIEW_H - PAD.top - PAD.bottom} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)} />
        </svg>

        {hovered && (
          <div className="chart-tooltip" style={{ left: screenX[hoverIdx] + 16, top: 8 }}>
            <div>
              <strong>{(hovered.distM / 1000).toFixed(2)} km</strong>
            </div>
            {hovered.ele !== null && <div>Elevation: {hovered.ele.toFixed(1)} m</div>}
            {hovered.gradPct !== null && <div>Gradient: {hovered.gradPct.toFixed(1)}%</div>}
            {hovered.bankAngleDeg !== null && <div>Est. bank angle: {hovered.bankAngleDeg.toFixed(0)}°</div>}
          </div>
        )}
      </div>
    </div>
  )
}
