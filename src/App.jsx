import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import TrackList from './components/TrackList.jsx'
import TrackMap from './components/TrackMap.jsx'
import ElevationProfile from './components/ElevationProfile.jsx'
import BermTable from './components/BermTable.jsx'
import DataTable from './components/DataTable.jsx'
import { parseGpx } from './lib/gpx.js'
import { buildTrackModel } from './lib/track.js'
import { usePrefersDark } from './lib/usePrefersDark.js'
import { classifyTrailGrade, DIRECTIONS, officialGradeFor } from './lib/grade.js'
import { classifyTrailMatch, matchOfficialTrails, prepareOfficialTrail } from './lib/trailMatch.js'

function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`
}

// Served as plain static files (see vite-plugin-gpx-api.js), so this works both against the
// dev/preview middleware and a fully static production build (e.g. GitHub Pages).
const GPX_BASE_URL = `${import.meta.env.BASE_URL}gpx-tracks/`
const OFFICIAL_TRAILS_BASE_URL = `${import.meta.env.BASE_URL}official-trails/`

export default function App() {
  const mode = usePrefersDark() ? 'dark' : 'light'

  const [files, setFiles] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [track, setTrack] = useState(null)
  const [trackLoading, setTrackLoading] = useState(false)
  const [trackError, setTrackError] = useState(null)

  const [highlightedBermIdx, setHighlightedBermIdx] = useState(null)
  const [directionByFile, setDirectionByFile] = useState({})

  const [uploads, setUploads] = useState([])
  const [uploadError, setUploadError] = useState(null)

  const [officialTrails, setOfficialTrails] = useState([])

  useEffect(() => {
    let cancelled = false
    async function loadOfficialTrails() {
      try {
        const res = await fetch(`${OFFICIAL_TRAILS_BASE_URL}manifest.json`)
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const { files } = await res.json()
        const trails = await Promise.all(
          files.map(async (f) => {
            const fileRes = await fetch(`${OFFICIAL_TRAILS_BASE_URL}${encodeURIComponent(f.name)}`)
            const text = await fileRes.text()
            const { name, points } = parseGpx(text)
            return prepareOfficialTrail(name || f.name, points, officialGradeFor(f.name))
          }),
        )
        if (!cancelled) setOfficialTrails(trails)
      } catch {
        // Trail matching is a bonus annotation, not core functionality — fail silently.
      }
    }
    loadOfficialTrails()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshList = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch(`${GPX_BASE_URL}manifest.json`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      setFiles(data.files)
    } catch (err) {
      setListError(err.message)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  const loadTrack = useCallback(async (filename) => {
    setSelectedFile(filename)
    setTrack(null)
    setTrackError(null)
    setHighlightedBermIdx(null)
    setTrackLoading(true)
    try {
      const res = await fetch(`${GPX_BASE_URL}${encodeURIComponent(filename)}`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const text = await res.text()
      const { name, points } = parseGpx(text)
      setTrack(buildTrackModel(filename, name, points))
    } catch (err) {
      setTrackError(err.message)
    } finally {
      setTrackLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedFile && files.length > 0) loadTrack(files[0].name)
  }, [files, selectedFile, loadTrack])

  const selectUpload = useCallback(
    (id) => {
      const entry = uploads.find((u) => u.id === id)
      if (!entry) return
      setSelectedFile(`upload:${id}`)
      setTrack(entry.track)
      setTrackError(null)
      setTrackLoading(false)
      setHighlightedBermIdx(null)
    },
    [uploads],
  )

  const handleUploadFiles = useCallback(async (fileList) => {
    setUploadError(null)
    const errors = []
    const parsed = []
    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text()
        const { name, points } = parseGpx(text)
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        parsed.push({ id, name: file.name, size: file.size, track: buildTrackModel(file.name, name, points) })
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`)
      }
    }
    if (parsed.length) setUploads((prev) => [...prev, ...parsed])
    if (errors.length) setUploadError(errors.join('; '))
  }, [])

  const removeUpload = useCallback(
    (id) => {
      setUploads((prev) => prev.filter((u) => u.id !== id))
      if (selectedFile === `upload:${id}`) {
        setSelectedFile(null)
        setTrack(null)
      }
    },
    [selectedFile],
  )

  const direction = (selectedFile && directionByFile[selectedFile]) || DIRECTIONS.twoWay.key
  const gradeResult = track ? classifyTrailGrade(track, direction) : null

  const trailMatch = useMemo(() => {
    if (!track || officialTrails.length === 0) return null
    return classifyTrailMatch(matchOfficialTrails(track.points, officialTrails))
  }, [track, officialTrails])

  const selectedUploadId = selectedFile?.startsWith('upload:') ? selectedFile.slice('upload:'.length) : null
  const selectedServerFile = selectedUploadId ? null : selectedFile

  return (
    <div className="app">
      <TrackList
        files={files}
        selectedFile={selectedServerFile}
        onSelect={loadTrack}
        onRefresh={refreshList}
        loading={listLoading}
        uploads={uploads}
        selectedUploadId={selectedUploadId}
        onSelectUpload={selectUpload}
        onRemoveUpload={removeUpload}
        onUploadFiles={handleUploadFiles}
        uploadError={uploadError}
      />

      <main className="main">
        <header className="app-header">
          <h1>Audit Tracks</h1>
          <p>Visualize GPX track points, slope gradient, and estimated berm bank angle.</p>
        </header>

        {listError && <p className="error-banner">Couldn&rsquo;t list GPX files: {listError}</p>}

        {!selectedFile && !listError && <p className="chart-empty">Select a track from the sidebar to get started.</p>}

        {trackLoading && <p className="chart-empty">Loading track…</p>}
        {trackError && <p className="error-banner">Couldn&rsquo;t load this track: {trackError}</p>}

        {track && !trackLoading && (
          <>
            <section className="track-summary">
              <h2>{track.name}</h2>
              <p className="grade-summary">{gradeResult.summary}</p>
              {trailMatch && (
                <p className="trail-match-row">
                  <span className={`trail-match-pill trail-match-pill-${trailMatch.level}`}>
                    {trailMatch.level === 'match' && `Matches ${trailMatch.name}`}
                    {trailMatch.level === 'partial' && `Partial match: ${trailMatch.name}`}
                    {trailMatch.level === 'none' && 'No official trail match'}
                  </span>
                  {trailMatch.level !== 'none' && (
                    <span className="trail-match-score">{Math.round(trailMatch.score * 100)}% of points overlap</span>
                  )}
                </p>
              )}
              <div className="direction-picker">
                <span>Trail direction:</span>
                {Object.values(DIRECTIONS).map((d) => (
                  <label key={d.key} className="direction-option">
                    <input
                      type="radio"
                      name="direction"
                      value={d.key}
                      checked={direction === d.key}
                      onChange={() => setDirectionByFile((prev) => ({ ...prev, [selectedFile]: d.key }))}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
              <div className="stat-row">
                <div className="stat-tile">
                  <div className="stat-label">Distance</div>
                  <div className="stat-value">{formatDistance(track.totals.distanceM)}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Elevation gain</div>
                  <div className="stat-value">{track.hasEle ? `+${track.totals.elevationGainM.toFixed(0)} m` : '—'}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Elevation loss</div>
                  <div className="stat-value">{track.hasEle ? `-${track.totals.elevationLossM.toFixed(0)} m` : '—'}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Berms detected</div>
                  <div className="stat-value">{track.berms.length}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Grade</div>
                  <div className="stat-value">
                    {gradeResult.grade ? (
                      <span className="grade-pill" style={{ background: gradeResult.grade.color }}>
                        {gradeResult.grade.label}
                        {gradeResult.exceedsTopGrade ? '+' : ''}
                      </span>
                    ) : (
                      <span className="grade-pill grade-pill-none">Ungraded</span>
                    )}
                  </div>
                </div>
                {trailMatch?.officialGrade && (
                  <div className="stat-tile">
                    <div className="stat-label">Official grading</div>
                    <div className="stat-value">
                      <span className="grade-pill" style={{ background: trailMatch.officialGrade.color }}>
                        {trailMatch.officialGrade.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {gradeResult.grade?.note && <p className="grade-note">{gradeResult.grade.note}</p>}
            </section>

            <TrackMap track={track} mode={mode} />

            {track.hasTime ? (
              <ElevationProfile track={track} direction={direction} />
            ) : (
              <p className="chart-empty">No timestamps in this file — gradient is shown, but berm bank angle can&rsquo;t be estimated without speed.</p>
            )}

            <BermTable berms={track.berms} highlightedBermIdx={highlightedBermIdx} onSelectBerm={setHighlightedBermIdx} />

            <p className="formula-note">
              <strong>How berm angle is estimated:</strong> for each point, a local turn radius is fit through nearby GPS points and
              combined with speed (from timestamps) using the ideal banking formula <em>θ = atan(v² / (g·r))</em> — the lean angle at
              which a rider corners with zero net lateral force. This depends entirely on GPS point accuracy and spacing; treat it as a
              guide to relative berm steepness, not a measured value.
            </p>

            <DataTable track={track} />
          </>
        )}
      </main>
    </div>
  )
}
