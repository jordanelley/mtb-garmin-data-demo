import { useEffect, useMemo, useState } from 'react'
import TrackMap from './TrackMap.jsx'
import { parseGpx } from '../lib/gpx.js'
import { buildTrackModel } from '../lib/track.js'
import { DIRECTIONS, findTooSteepRuns, officialGradeFor } from '../lib/grade.js'
import { classifyTrailMatch, matchOfficialTrails, prepareOfficialTrail } from '../lib/trailMatch.js'

const GPX_BASE_URL = `${import.meta.env.BASE_URL}gpx-tracks/`
const OFFICIAL_TRAILS_BASE_URL = `${import.meta.env.BASE_URL}official-trails/`
const FRAMES_BASE_URL = `${import.meta.env.BASE_URL}hammys-return-audit/frames/`

const ACTIVITY_FILE = 'activity_24798561723.gpx'
const OFFICIAL_FILE = 'hammy-s-return.gpx'

export default function HammysReturnAudit({ mode, onBack }) {
  const [state, setState] = useState({ loading: true, error: null, track: null, officialTrail: null, match: null })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [activityRes, officialRes] = await Promise.all([
          fetch(`${GPX_BASE_URL}${ACTIVITY_FILE}`),
          fetch(`${OFFICIAL_TRAILS_BASE_URL}${OFFICIAL_FILE}`),
        ])
        if (!activityRes.ok || !officialRes.ok) throw new Error('Could not load the ride or official trail GPX')

        const activityGpx = parseGpx(await activityRes.text())
        const officialGpx = parseGpx(await officialRes.text())

        const track = buildTrackModel(ACTIVITY_FILE, activityGpx.name, activityGpx.points)
        const officialTrail = prepareOfficialTrail(officialGpx.name || OFFICIAL_FILE, officialGpx.points, officialGradeFor(OFFICIAL_FILE))
        const match = classifyTrailMatch(matchOfficialTrails(track.points, [officialTrail]))

        if (!cancelled) setState({ loading: false, error: null, track, officialTrail, match })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, track: null, officialTrail: null, match: null })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const direction = DIRECTIONS.twoWay.key

  const runs = useMemo(() => {
    if (!state.track || !state.officialTrail?.officialGrade) return []
    return findTooSteepRuns(state.track, state.officialTrail.officialGrade, direction)
  }, [state.track, state.officialTrail])

  const steepBerms = useMemo(() => {
    if (!state.track || !state.officialTrail?.officialGrade) return []
    return state.track.berms.filter((b) => b.grade.grade > state.officialTrail.officialGrade.grade)
  }, [state.track, state.officialTrail])

  const items = useMemo(() => {
    const combined = [
      ...runs.map((run) => ({ type: 'steep', startDistM: run.startDistM, endDistM: run.endDistM, run })),
      ...steepBerms.map((berm) => ({ type: 'turn', startDistM: berm.startDistM, endDistM: berm.endDistM, berm })),
    ]
    combined.sort((a, b) => a.startDistM - b.startDistM)
    return combined.map((item, i) => ({ ...item, frameFile: `${FRAMES_BASE_URL}item-${String(i + 1).padStart(2, '0')}.jpg` }))
  }, [runs, steepBerms])

  return (
    <div className="audit-page">
      <button className="btn-ghost" onClick={onBack}>
        ← Back
      </button>
      <h2>Hammy&rsquo;s Return — sections above Grade 3</h2>

      {state.loading && <p className="chart-empty">Loading ride data…</p>}
      {state.error && <p className="error-banner">Couldn&rsquo;t load this audit: {state.error}</p>}

      {state.track && state.officialTrail && (
        <>
          <p className="audit-meta">
            Ride matched to the official trail at {Math.round((state.match?.score ?? 0) * 100)}% point overlap. Direction assumed: two-way.{' '}
            {runs.length} section{runs.length === 1 ? '' : 's'} are too steep for Grade 3, and {steepBerms.length} turn
            {steepBerms.length === 1 ? '' : 's'} bank sharper than Grade 3 allows. Photos are frames pulled from onboard video,
            synced to each flagged section's GPS timestamp.
          </p>

          <TrackMap track={state.track} mode={mode} officialTrail={state.officialTrail} tooSteepRuns={runs} activityLabel="Ridden track" />

          <div className="audit-grid">
            {items.map((item, i) => {
              const isSteep = item.type === 'steep'
              return (
                <div className="audit-card" key={i}>
                  <div className="audit-card-header">
                    <span className={`audit-badge audit-badge-${item.type}`}>{isSteep ? 'Too steep' : 'Sharp turn'}</span>
                    <h3>
                      {item.startDistM.toFixed(0)}–{item.endDistM.toFixed(0)} m along track
                    </h3>
                  </div>
                  <img src={item.frameFile} alt={`Video frame at issue ${i + 1}`} />
                  <dl>
                    {isSteep ? (
                      <>
                        <dt>Peak gradient</dt>
                        <dd>{item.run.peakDeg.toFixed(1)}°</dd>
                        <dt>Section length</dt>
                        <dd>{item.run.lengthM.toFixed(0)} m</dd>
                      </>
                    ) : (
                      <>
                        <dt>Peak bank angle</dt>
                        <dd>
                          {item.berm.peakAngleDeg.toFixed(0)}° ({item.berm.direction})
                        </dd>
                        <dt>Berm rated</dt>
                        <dd>{item.berm.grade.label} — exceeds this trail&rsquo;s Grade 3</dd>
                      </>
                    )}
                  </dl>
                  <div className="audit-card-actions">
                    <button className="btn-accept" type="button">
                      Accept
                    </button>
                    <button className="btn-reject" type="button">
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
