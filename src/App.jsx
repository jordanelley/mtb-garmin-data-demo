import { useCallback, useEffect, useState } from 'react'
import './App.css'
import TrackList from './components/TrackList.jsx'
import TrackMap from './components/TrackMap.jsx'
import ElevationProfile from './components/ElevationProfile.jsx'
import GradientLegend from './components/GradientLegend.jsx'
import BermSeverityLegend from './components/BermSeverityLegend.jsx'
import BermTable from './components/BermTable.jsx'
import DataTable from './components/DataTable.jsx'
import { parseGpx } from './lib/gpx.js'
import { buildTrackModel } from './lib/track.js'
import { usePrefersDark } from './lib/usePrefersDark.js'

function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`
}

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

  const refreshList = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch('/api/tracks')
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
      const res = await fetch(`/api/tracks/${encodeURIComponent(filename)}`)
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

  return (
    <div className="app">
      <TrackList files={files} selectedFile={selectedFile} onSelect={loadTrack} onRefresh={refreshList} loading={listLoading} />

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
              </div>
            </section>

            <GradientLegend domainPct={track.gradientDomainPct} mode={mode} />

            <TrackMap track={track} mode={mode} highlightedBermIdx={highlightedBermIdx} onSelectBerm={setHighlightedBermIdx} />

            {track.hasTime ? (
              <ElevationProfile track={track} mode={mode} />
            ) : (
              <p className="chart-empty">No timestamps in this file — gradient is shown, but berm bank angle can&rsquo;t be estimated without speed.</p>
            )}

            <BermSeverityLegend />
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
