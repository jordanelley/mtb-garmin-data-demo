import { BERM_GRADES } from '../lib/grade.js'
import EstimateBadge from './EstimateBadge.jsx'

function rangeLabel(grades, i) {
  const prevMax = i === 0 ? 0 : grades[i - 1].maxDeg
  const g = grades[i]
  return g.maxDeg === Infinity ? `${prevMax}°+` : `${prevMax}–${g.maxDeg}°`
}

export default function BermSeverityLegend() {
  return (
    <div className="legend">
      <div className="legend-title">
        Estimated berm bank angle <EstimateBadge title="Derived from GPS-estimated turn radius and speed, not measured. See the formula note below." />
      </div>
      <div className="severity-swatches">
        {BERM_GRADES.map((g, i) => (
          <div className="severity-swatch" key={g.grade}>
            <span className="swatch-dot" style={{ background: g.color }} />
            <span>
              {g.label} ({rangeLabel(BERM_GRADES, i)})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
