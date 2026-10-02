import EstimateBadge from './EstimateBadge.jsx'

function summarizeByGrade(berms) {
  const byGrade = new Map()
  for (const b of berms) {
    const entry = byGrade.get(b.grade.grade) ?? { grade: b.grade, count: 0 }
    entry.count += 1
    byGrade.set(b.grade.grade, entry)
  }
  return Array.from(byGrade.values())
    .sort((a, b) => a.grade.grade - b.grade.grade)
    .map((e) => ({ label: e.grade.label, color: e.grade.color, pct: Math.round((e.count / berms.length) * 100) }))
}

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

  const summary = summarizeByGrade(berms)

  return (
    <div className="chart-card">
      <h3>
        Detected berms <EstimateBadge title="Bank angle is estimated from GPS-derived turn radius and speed — see the formula note below." />
      </h3>
      <div className="grade-breakdown">
        {summary.map((s) => (
          <span className="grade-breakdown-item" key={s.label}>
            <span className="swatch-dot" style={{ background: s.color }} />
            {s.pct}% {s.label}
          </span>
        ))}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Distance</th>
              <th>Direction</th>
              <th>Est. bank angle</th>
              <th>Grade</th>
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
                  <span className="swatch-dot" style={{ background: b.grade.color }} />
                  {b.grade.label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
