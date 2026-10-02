import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const GPX_DIR_NAME = 'gpx-tracks'
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]*\.gpx$/

function send(res, status, body, contentType = 'application/json') {
  res.statusCode = status
  res.setHeader('Content-Type', contentType)
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

async function listGpxFiles(gpxDir) {
  const entries = await readdir(gpxDir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (!entry.isFile() || !SAFE_FILENAME.test(entry.name)) continue
    const full = path.join(gpxDir, entry.name)
    const info = await stat(full)
    files.push({ name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString() })
  }
  files.sort((a, b) => a.name.localeCompare(b.name))
  return files
}

/**
 * Serves .gpx files from a project-root folder under /gpx-tracks/, both as a manifest
 * (/gpx-tracks/manifest.json) and as raw file content (/gpx-tracks/<filename>). Dev/preview
 * get this dynamically via middleware, so dropping a file in makes it show up on refresh with
 * no rebuild. A production `vite build` instead copies the same files + a static manifest.json
 * into the build output, so the deployed site (e.g. GitHub Pages, which can't run this
 * middleware) serves them as plain static files at the same URLs.
 */
export default function gpxApiPlugin() {
  const gpxDir = path.resolve(process.cwd(), GPX_DIR_NAME)
  let outDir = 'dist'
  let urlPrefix = `/${GPX_DIR_NAME}/`

  async function handle(req, res, next) {
    if (!req.url?.startsWith(urlPrefix)) return next()

    const url = new URL(req.url, 'http://localhost')
    const segment = decodeURIComponent(url.pathname.slice(urlPrefix.length))

    try {
      if (segment === 'manifest.json') {
        return send(res, 200, { files: await listGpxFiles(gpxDir) })
      }

      if (!SAFE_FILENAME.test(segment)) return send(res, 400, { error: 'Invalid filename' })

      const resolved = path.resolve(gpxDir, segment)
      if (resolved !== path.join(gpxDir, segment)) return send(res, 400, { error: 'Invalid path' })

      const contents = await readFile(resolved, 'utf-8')
      return send(res, 200, contents, 'application/gpx+xml')
    } catch (err) {
      if (err.code === 'ENOENT') return send(res, 404, { error: 'Not found' })
      return send(res, 500, { error: 'Server error' })
    }
  }

  return {
    name: 'gpx-api',
    configResolved(config) {
      outDir = config.build.outDir
      urlPrefix = `${config.base}${GPX_DIR_NAME}/`
    },
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
    async closeBundle() {
      const destDir = path.resolve(process.cwd(), outDir, GPX_DIR_NAME)
      const files = await listGpxFiles(gpxDir)
      await mkdir(destDir, { recursive: true })
      await Promise.all(files.map((f) => cp(path.join(gpxDir, f.name), path.join(destDir, f.name))))
      await writeFile(path.join(destDir, 'manifest.json'), JSON.stringify({ files }))
    },
  }
}
