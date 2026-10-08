import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import TrackList from './components/TrackList.jsx'
import OfficialTrailList from './components/OfficialTrailList.jsx'
import TrackMap from './components/TrackMap.jsx'
import ElevationProfile from './components/ElevationProfile.jsx'
import BermTable from './components/BermTable.jsx'
import DataTable from './components/DataTable.jsx'
import { parseGpx } from './lib/gpx.js'
import { buildTrackModel } from './lib/track.js'
import { usePrefersDark } from './lib/usePrefersDark.js'
import { classifyTrailGrade, DIRECTIONS, findTooSteepRuns, officialGradeFor } from './lib/grade.js'
import { classifyTrailMatch, matchOfficialTrails, prepareOfficialTrail } from './lib/trailMatch.js'
import { buildAverageTrack } from './lib/averageTrail.js'

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

  // Index every activity file by whichever official trail it best matches, so clicking a trail
  // in the sidebar can show the average of all rides recorded on it. Runs once both the activity
  // manifest and the official trails are loaded; activities that don't match anything are dropped.
  const [activitiesByTrail, setActivitiesByTrail] = useState(new Map())
  const [activitiesIndexLoading, setActivitiesIndexLoading] = useState(false)

  useEffect(() => {
    if (files.length === 0 || officialTrails.length === 0) return
    let cancelled = false
    async function buildIndex() {
      setActivitiesIndexLoading(true)
      const byTrail = new Map()
      await Promise.all(
        files.map(async (f) => {
          try {
            const res = await fetch(`${GPX_BASE_URL}${encodeURIComponent(f.name)}`)
            if (!res.ok) return
            const text = await res.text()
            const { name, points } = parseGpx(text)
            const model = buildTrackModel(f.name, name, points)
            const match = classifyTrailMatch(matchOfficialTrails(model.points, officialTrails))
            if (match.level === 'none') return
            const list = byTrail.get(match.name) ?? []
            list.push({ filename: f.name, track: model })
            byTrail.set(match.name, list)
          } catch {
            // Skip any activity file that fails to parse — the average-trail index is a bonus view.
          }
        }),
      )
      if (!cancelled) {
        setActivitiesByTrail(byTrail)
        setActivitiesIndexLoading(false)
      }
    }
    buildIndex()
    return () => {
      cancelled = true
    }
  }, [files, officialTrails])

  const [selectedOfficialTrailName, setSelectedOfficialTrailName] = useState(null)

  const selectOfficialTrail = useCallback((name) => {
    setSelectedOfficialTrailName(name)
    setSelectedFile(null)
    setTrack(null)
    setTrackError(null)
    setHighlightedBermIdx(null)
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
    setSelectedOfficialTrailName(null)
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

  // Only auto-select the first activity once, on initial load — not every time selection is
  // cleared, since selecting an official trail also clears selectedFile and shouldn't be undone.
  const didAutoSelect = useRef(false)
  useEffect(() => {
    if (didAutoSelect.current) return
    if (!selectedFile && !selectedOfficialTrailName && files.length > 0) {
      didAutoSelect.current = true
      loadTrack(files[0].name)
    }
  }, [files, selectedFile, selectedOfficialTrailName, loadTrack])

  const selectUpload = useCallback(
    (id) => {
      const entry = uploads.find((u) => u.id === id)
      if (!entry) return
      setSelectedOfficialTrailName(null)
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

  const trailMatch = useMemo(() => {
    if (!track || officialTrails.length === 0) return null
    return classifyTrailMatch(matchOfficialTrails(track.points, officialTrails))
  }, [track, officialTrails])

  const matchedOfficialTrail = useMemo(() => {
    if (!trailMatch || trailMatch.level === 'none') return null
    return officialTrails.find((t) => t.name === trailMatch.name) ?? null
  }, [trailMatch, officialTrails])

  // Viewing a single ridden activity, or the averaged-rides view for a sidebar-selected official
  // trail — mutually exclusive, so most of the detail panel below reads from these "active" values
  // regardless of which mode is in play.
  const isTrailMode = selectedOfficialTrailName !== null
  const selectedOfficialTrail = useMemo(
    () => officialTrails.find((t) => t.name === selectedOfficialTrailName) ?? null,
    [officialTrails, selectedOfficialTrailName],
  )
  const matchedActivitiesForTrail = useMemo(
    () => (selectedOfficialTrailName && activitiesByTrail.get(selectedOfficialTrailName)) || [],
    [selectedOfficialTrailName, activitiesByTrail],
  )
  const averageTrack = useMemo(() => {
    if (!selectedOfficialTrail || matchedActivitiesForTrail.length === 0) return null
    return buildAverageTrack(selectedOfficialTrail, matchedActivitiesForTrail)
  }, [selectedOfficialTrail, matchedActivitiesForTrail])

  const activeTrack = isTrailMode ? averageTrack : track
  const activeOfficialTrail = isTrailMode ? selectedOfficialTrail : matchedOfficialTrail
  const directionKey = isTrailMode ? `trail:${selectedOfficialTrailName}` : selectedFile

  const direction = (directionKey && directionByFile[directionKey]) || DIRECTIONS.twoWay.key
  const gradeResult = activeTrack ? classifyTrailGrade(activeTrack, direction) : null

  const tooSteepRuns = useMemo(() => {
    if (!activeTrack || !activeOfficialTrail?.officialGrade) return []
    return findTooSteepRuns(activeTrack, activeOfficialTrail.officialGrade, direction)
  }, [activeTrack, activeOfficialTrail, direction])

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

      <OfficialTrailList
        trails={officialTrails}
        activitiesByTrail={activitiesByTrail}
        selectedName={selectedOfficialTrailName}
        onSelect={selectOfficialTrail}
        ridesLoading={activitiesIndexLoading}
      />

      <main className="main">
        <header className="app-header">
          <h1>Audit Tracks</h1>
          <p>Visualize GPX track points, slope gradient, and estimated berm bank angle.</p>
        </header>

        {listError && <p className="error-banner">Couldn&rsquo;t list GPX files: {listError}</p>}

        {!isTrailMode && !selectedFile && !listError && <p className="chart-empty">Select a track from the sidebar to get started.</p>}

        {isTrailMode && !averageTrack && (
          <p className="chart-empty">
            {activitiesIndexLoading ? 'Loading recorded rides…' : 'No recorded rides matched this trail yet.'}
          </p>
        )}

        {!isTrailMode && trackLoading && <p className="chart-empty">Loading track…</p>}
        {!isTrailMode && trackError && <p className="error-banner">Couldn&rsquo;t load this track: {trackError}</p>}

        {activeTrack && !(trackLoading && !isTrailMode) && (
          <>
            <section className="track-summary">
              <h2>{activeTrack.name}</h2>
              <p className="grade-summary">{gradeResult.summary}</p>
              {!isTrailMode && trailMatch && (
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
              {isTrailMode && (
                <p className="trail-match-row">
                  <span className="trail-match-pill trail-match-pill-match">
                    Average of {matchedActivitiesForTrail.length} recorded ride{matchedActivitiesForTrail.length === 1 ? '' : 's'}
                  </span>
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
                      onChange={() => setDirectionByFile((prev) => ({ ...prev, [directionKey]: d.key }))}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
              <div className="stat-row">
                <div className="stat-tile">
                  <div className="stat-label">Distance</div>
                  <div className="stat-value">{formatDistance(activeTrack.totals.distanceM)}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Elevation gain</div>
                  <div className="stat-value">{activeTrack.hasEle ? `+${activeTrack.totals.elevationGainM.toFixed(0)} m` : '—'}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Elevation loss</div>
                  <div className="stat-value">{activeTrack.hasEle ? `-${activeTrack.totals.elevationLossM.toFixed(0)} m` : '—'}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Berms detected</div>
                  <div className="stat-value">{activeTrack.berms.length}</div>
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
                {activeOfficialTrail?.officialGrade && (
                  <div className="stat-tile">
                    <div className="stat-label">Official grading</div>
                    <div className="stat-value">
                      <span className="grade-pill" style={{ background: activeOfficialTrail.officialGrade.color }}>
                        {activeOfficialTrail.officialGrade.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {gradeResult.grade?.note && <p className="grade-note">{gradeResult.grade.note}</p>}
            </section>

            <TrackMap
              track={activeTrack}
              mode={mode}
              officialTrail={activeOfficialTrail}
              tooSteepRuns={tooSteepRuns}
              activityLabel={isTrailMode ? 'Average of recorded rides' : 'Ridden track'}
            />

            {activeTrack.hasTime ? (
              <ElevationProfile track={activeTrack} direction={direction} />
            ) : (
              <p className="chart-empty">No timestamps in this file — gradient is shown, but berm bank angle can&rsquo;t be estimated without speed.</p>
            )}

            <BermTable berms={activeTrack.berms} highlightedBermIdx={highlightedBermIdx} onSelectBerm={setHighlightedBermIdx} />

            <p className="formula-note">
              <strong>How berm angle is estimated:</strong> for each point, a local turn radius is fit through nearby GPS points and
              combined with speed (from timestamps) using the ideal banking formula <em>θ = atan(v² / (g·r))</em> — the lean angle at
              which a rider corners with zero net lateral force. This depends entirely on GPS point accuracy and spacing; treat it as a
              guide to relative berm steepness, not a measured value.
              {isTrailMode && ' In this average view, speed at each point is also averaged across matched rides, so treat it as indicative rather than precise.'}
            </p>

            <DataTable track={activeTrack} />
          </>
        )}
      </main>
    </div>
  )
}
