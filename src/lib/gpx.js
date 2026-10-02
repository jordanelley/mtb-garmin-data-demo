/** Parses GPX XML text into a flat ordered list of trackpoints. */
export function parseGpx(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')

  const parserError = doc.querySelector('parsererror')
  if (parserError) throw new Error('Could not parse GPX file (malformed XML)')

  const nameEl = doc.querySelector('trk > name')
  const name = nameEl?.textContent?.trim() || null

  const trkpts = Array.from(doc.querySelectorAll('trk > trkseg > trkpt'))
  if (trkpts.length === 0) {
    throw new Error('No track points found (expected <trk><trkseg><trkpt> elements)')
  }

  const points = trkpts.map((pt) => {
    const lat = Number.parseFloat(pt.getAttribute('lat'))
    const lon = Number.parseFloat(pt.getAttribute('lon'))
    const eleText = pt.querySelector('ele')?.textContent
    const timeText = pt.querySelector('time')?.textContent

    return {
      lat,
      lon,
      ele: eleText !== undefined ? Number.parseFloat(eleText) : null,
      time: timeText ? new Date(timeText) : null,
    }
  })

  return { name, points }
}
