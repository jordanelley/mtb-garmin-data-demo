import { STATUS } from '../lib/colors.js'
import EstimateBadge from './EstimateBadge.jsx'

export default function BermTable({ berms, highlightedBermIdx, onSelectBerm }) {
  if (berms.length === 0) {
    return (
      <div className="chart-card">
        <h3>
          Detected berms <EstimateBadge title="Bank angle is estimated from GPS-derived turn radius and speed — see the formula note below." />
        </h3>
        <p className="chart-empty">No turns at or above 8° estimated bank angle were found in this track.</p>
      </div>
    )
  }

  return (
    <div className="chart-card">
      <h3>
        Detected berms <EstimateBadge title="Bank angle is estimated from GPS-derived turn radius and speed — see the formula note below." />
      </h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Distance</th>
              <th>Direction</th>
              <th>Est. bank angle</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {berms.map((b, i) => (
              <tr key={i} className={i === highlightedBermIdx ? 'row-highlighted' : ''} onClick={() => onSelectBerm(i)} style={{ cursor: 'pointer' }}>
                <td>{i + 1}</td>
                <td>
                  {(b.startDistM / 1000).toFixed(2)}–{(b.endDistM / 1000).toFixed(2)} km
                </td>
                <td style={{ textTransform: 'capitalize' }}>{b.direction}</td>
                <td>~{b.peakAngleDeg.toFixed(0)}°</td>
                <td>
                  <span className="swatch-dot" style={{ background: STATUS[b.severity.key] }} />
                  {b.severity.label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
