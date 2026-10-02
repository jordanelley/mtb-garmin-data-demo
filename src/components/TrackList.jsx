function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function TrackList({ files, selectedFile, onSelect, onRefresh, loading }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Tracks</h2>
        <button type="button" className="btn-ghost" onClick={onRefresh} disabled={loading}>
          {loading ? 'Scanning…' : 'Refresh'}
        </button>
      </div>
      <p className="sidebar-hint">
        Drop <code>.gpx</code> files into <code>gpx-tracks/</code>, then hit Refresh.
      </p>
      {files.length === 0 && !loading && <p className="sidebar-empty">No GPX files found yet.</p>}
      <ul className="track-list">
        {files.map((f) => (
          <li key={f.name}>
            <button
              type="button"
              className={`track-list-item${f.name === selectedFile ? ' active' : ''}`}
              onClick={() => onSelect(f.name)}
            >
              <span className="track-list-name">{f.name}</span>
              <span className="track-list-meta">{formatSize(f.size)}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
