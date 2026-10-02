import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const GPX_DIR_NAME = 'gpx-tracks'
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]*\.gpx$/

function send(res, status, body, contentType = 'application/json') {
  res.statusCode = status
  res.setHeader('Content-Type', contentType)
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

/**
 * Dev/preview-server middleware that lists and serves .gpx files from a
 * project-root folder, so dropping a new file in makes it show up on refresh
 * with no rebuild. Filenames are validated against SAFE_FILENAME and resolved
 * paths are checked to stay inside gpxDir before any fs access, since the
 * filename segment comes straight from the request URL.
 */
export default function gpxApiPlugin() {
  const gpxDir = path.resolve(process.cwd(), GPX_DIR_NAME)

  async function handle(req, res, next) {
    if (!req.url?.startsWith('/api/tracks')) return next()

    const url = new URL(req.url, 'http://localhost')
    const segments = url.pathname.split('/').filter(Boolean) // ['api', 'tracks', maybe filename]

    try {
      if (segments.length === 2) {
        const entries = await readdir(gpxDir, { withFileTypes: true })
        const files = []
        for (const entry of entries) {
          if (!entry.isFile() || !SAFE_FILENAME.test(entry.name)) continue
          const full = path.join(gpxDir, entry.name)
          const info = await stat(full)
          files.push({ name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString() })
        }
        files.sort((a, b) => a.name.localeCompare(b.name))
        return send(res, 200, { files })
      }

      if (segments.length === 3) {
        const filename = decodeURIComponent(segments[2])
        if (!SAFE_FILENAME.test(filename)) return send(res, 400, { error: 'Invalid filename' })

        const resolved = path.resolve(gpxDir, filename)
        if (resolved !== path.join(gpxDir, filename)) return send(res, 400, { error: 'Invalid path' })

        const contents = await readFile(resolved, 'utf-8')
        return send(res, 200, contents, 'application/gpx+xml')
      }

      return send(res, 404, { error: 'Not found' })
    } catch (err) {
      if (err.code === 'ENOENT') return send(res, 404, { error: 'Not found' })
      return send(res, 500, { error: 'Server error' })
    }
  }

  return {
    name: 'gpx-api',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}
