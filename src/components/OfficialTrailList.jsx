export default function OfficialTrailList({ trails, activitiesByTrail, selectedName, onSelect, ridesLoading }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Official Trails</h2>
      </div>
      <p className="sidebar-hint">Click a trail to see the average of every recorded ride overlaid on the official line.</p>
      {trails.length === 0 && <p className="sidebar-empty">Loading trails…</p>}
      <ul className="track-list">
        {trails.map((t) => {
          const rideCount = activitiesByTrail.get(t.name)?.length ?? 0
          return (
            <li key={t.name}>
              <button
                type="button"
                className={`track-list-item${t.name === selectedName ? ' active' : ''}`}
                onClick={() => onSelect(t.name)}
              >
                <span className="track-list-name trail-name-row">
                  <span className="swatch-dot" style={{ background: t.officialGrade?.color ?? 'var(--muted)' }} />
                  {t.name}
                </span>
                <span className="track-list-meta">
                  {t.officialGrade?.label ?? 'Ungraded'} · {ridesLoading ? '…' : `${rideCount} ride${rideCount === 1 ? '' : 's'}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
