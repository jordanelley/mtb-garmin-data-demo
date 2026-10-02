import { useState } from 'react'

export default function DataTable({ track }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="chart-card">
      <button type="button" className="btn-ghost" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide' : 'Show'} raw point data ({track.points.length} points)
      </button>
      {open && (
        <div className="table-scroll table-scroll-tall">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Distance</th>
                <th>Elevation</th>
                <th>Gradient</th>
                <th>Speed</th>
                <th>Est. bank angle</th>
              </tr>
            </thead>
            <tbody>
              {track.points.map((p) => (
                <tr key={p.idx}>
                  <td>{p.idx}</td>
                  <td>{(p.distM / 1000).toFixed(3)} km</td>
                  <td>{p.ele !== null ? `${p.ele.toFixed(1)} m` : '—'}</td>
                  <td>{p.gradPct !== null ? `${p.gradPct.toFixed(1)}%` : '—'}</td>
                  <td>{p.speedMs !== null ? `${p.speedMs.toFixed(1)} m/s` : '—'}</td>
                  <td>{p.bankAngleDeg !== null ? `~${p.bankAngleDeg.toFixed(0)}° (${p.turnDir})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
