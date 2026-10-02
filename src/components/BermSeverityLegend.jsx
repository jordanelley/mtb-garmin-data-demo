import { BERM_SEVERITY } from '../lib/track.js'
import { STATUS } from '../lib/colors.js'
import EstimateBadge from './EstimateBadge.jsx'

const RANGES = {
  good: '< 12°',
  warning: '12–20°',
  serious: '20–30°',
  critical: '30°+',
}

export default function BermSeverityLegend() {
  return (
    <div className="legend">
      <div className="legend-title">
        Estimated berm bank angle <EstimateBadge title="Derived from GPS-estimated turn radius and speed, not measured. See the formula note below." />
      </div>
      <div className="severity-swatches">
        {Object.values(BERM_SEVERITY).map((s) => (
          <div className="severity-swatch" key={s.key}>
            <span className="swatch-dot" style={{ background: STATUS[s.key] }} />
            <span>
              {s.label} ({RANGES[s.key]})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
