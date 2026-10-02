import { useState } from 'react'
import { bermGradeRanges } from '../lib/grade.js'
import EstimateBadge from './EstimateBadge.jsx'

const COLLAPSED_COUNT = 3

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

function GradeKey() {
  return (
    <div className="grade-key">
      <span className="grade-key-label">Bank angle:</span>
      {bermGradeRanges().map((g) => (
        <span className="grade-breakdown-item" key={g.label}>
          <span className="swatch-dot" style={{ background: g.color }} />
          {g.label} ({g.range})
        </span>
      ))}
    </div>
  )
}

export default function BermTable({ berms, highlightedBermIdx, onSelectBerm }) {
  const [expanded, setExpanded] = useState(false)
  const [prevBerms, setPrevBerms] = useState(berms)
  if (berms !== prevBerms) {
    setPrevBerms(berms)
    setExpanded(false)
  }

  if (berms.length === 0) {
    return (
      <div className="chart-card">
        <h3>
          Detected berms <EstimateBadge title="Bank angle is estimated from GPS-derived turn radius and speed — see the formula note below." />
        </h3>
        <GradeKey />
        <p className="chart-empty">No turns at or above 8° estimated bank angle were found in this track.</p>
      </div>
    )
  }

  const summary = summarizeByGrade(berms)
  const visibleBerms = expanded ? berms : berms.slice(0, COLLAPSED_COUNT)
  const hiddenCount = berms.length - visibleBerms.length

  return (
    <div className="chart-card">
      <h3>
        Detected berms <EstimateBadge title="Bank angle is estimated from GPS-derived turn radius and speed — see the formula note below." />
      </h3>
      <GradeKey />
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
            {visibleBerms.map((b, i) => (
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
      {hiddenCount > 0 && (
        <button type="button" className="btn-ghost btn-see-more" onClick={() => setExpanded(true)}>
          See {hiddenCount} more
        </button>
      )}
      {expanded && berms.length > COLLAPSED_COUNT && (
        <button type="button" className="btn-ghost btn-see-more" onClick={() => setExpanded(false)}>
          Show less
        </button>
      )}
    </div>
  )
}
