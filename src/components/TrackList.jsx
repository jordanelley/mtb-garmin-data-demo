import { useRef } from 'react'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function TrackList({
  files,
  selectedFile,
  onSelect,
  onRefresh,
  loading,
  uploads,
  selectedUploadId,
  onSelectUpload,
  onRemoveUpload,
  onUploadFiles,
  uploadError,
}) {
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    if (e.target.files?.length) onUploadFiles(e.target.files)
    e.target.value = ''
  }

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

      <div className="sidebar-header sidebar-header-spaced">
        <h2>Uploaded</h2>
        <button type="button" className="btn-ghost" onClick={() => fileInputRef.current?.click()}>
          Upload
        </button>
        <input ref={fileInputRef} type="file" accept=".gpx" multiple hidden onChange={handleFileChange} />
      </div>
      <p className="sidebar-hint">Upload your own .gpx files — kept for this browser session only.</p>
      {uploadError && <p className="sidebar-error">{uploadError}</p>}
      {uploads.length === 0 && <p className="sidebar-empty">No files uploaded yet.</p>}
      <ul className="track-list">
        {uploads.map((u) => (
          <li key={u.id} className="track-list-row">
            <button
              type="button"
              className={`track-list-item${u.id === selectedUploadId ? ' active' : ''}`}
              onClick={() => onSelectUpload(u.id)}
            >
              <span className="track-list-name">{u.name}</span>
              <span className="track-list-meta">{formatSize(u.size)}</span>
            </button>
            <button type="button" className="btn-remove" title="Remove" onClick={() => onRemoveUpload(u.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
