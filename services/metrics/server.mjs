import { createServer } from 'node:http'
import { mkdirSync, lstatSync, existsSync, realpathSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import { createUsageStore } from './store.mjs'

const directory = process.env.LESTER_METRICS_DIRECTORY
const token = process.env.LESTER_METRICS_INGEST_TOKEN
const port = Number(process.env.LESTER_METRICS_PORT ?? 8788)
if (!directory || !isAbsolute(directory) || !token || token.length < 32 || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Configure an absolute data directory, a strong ingest token, and an unprivileged port.')
mkdirSync(directory, { recursive: true, mode: 0o700 })
const info = lstatSync(directory)
if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error('Metrics storage must be a private directory (mode 0700).')
if (realpathSync(directory) !== directory) throw new Error('Metrics storage must not resolve through symbolic links.')
const database = join(directory, 'usage.sqlite')
for (const file of [database, `${database}-wal`, `${database}-shm`]) {
  if (existsSync(file)) {
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Metrics files must be regular files without links.')
  }
}
process.umask(0o077)
const store = createUsageStore(database)
const expected = Buffer.from(`Bearer ${token}`)
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  const actual = Buffer.from(request.headers.authorization ?? '')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { response.writeHead(401).end(); return }
  if (request.method === 'GET' && request.url === '/report') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(store.report())); return }
  if (request.method !== 'POST' || request.url !== '/events' || !request.headers['content-type']?.startsWith('application/json')) { response.writeHead(404).end(); return }
  let size = 0
  const chunks = []
  try {
    for await (const chunk of request) {
      size += chunk.length
      if (size > 1024) { response.writeHead(413).end(); request.destroy(); return }
      chunks.push(chunk)
    }
    store.insert(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    response.writeHead(204).end()
  } catch { response.writeHead(400).end() }
})
server.requestTimeout = 5_000
server.headersTimeout = 5_000
server.maxConnections = 32
// Keep the service behind a trusted HTTPS reverse proxy. Never expose the SQLite file.
server.listen(port, '127.0.0.1', () => process.stdout.write('Metrics service listening on loopback.\n'))
const cleanup = setInterval(() => store.report(), 3_600_000)
function stop() { clearInterval(cleanup); server.close(() => { store.close(); process.exit(0) }) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
