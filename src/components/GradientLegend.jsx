import { gradientColor } from '../lib/colors.js'

const STEPS = 17

export default function GradientLegend({ domainPct, mode }) {
  const stops = Array.from({ length: STEPS }, (_, i) => {
    const value = -domainPct + (2 * domainPct * i) / (STEPS - 1)
    return { value, color: gradientColor(value, domainPct, mode) }
  })

  return (
    <div className="legend">
      <div className="legend-title">Gradient (slope)</div>
      <div className="legend-bar" style={{ backgroundImage: `linear-gradient(to right, ${stops.map((s) => s.color).join(',')})` }} />
      <div className="legend-ticks">
        <span>{-domainPct.toFixed(0)}% downhill</span>
        <span>level</span>
        <span>+{domainPct.toFixed(0)}% uphill</span>
      </div>
    </div>
  )
}
