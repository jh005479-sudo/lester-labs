import { parseUsageEvent } from '@/lib/usageMetrics'
import { readBoundedJson } from '@/lib/httpBounds'

export const dynamic = 'force-dynamic'
const windows = new Map<string, { count: number; expires: number }>()

function sinkUrl() {
  const configured = process.env.LESTER_METRICS_INGEST_URL
  if (!configured || !process.env.LESTER_METRICS_INGEST_TOKEN) return null
  const url = new URL(configured)
  if (url.username || url.password || url.hash || url.search) throw new Error('Invalid metrics destination.')
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Metrics requires HTTPS.')
  return url
}

export function GET() {
  try { return Response.json({ available: Boolean(sinkUrl()) }, { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return Response.json({ available: false }, { headers: { 'Cache-Control': 'no-store' } }) }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 403 })
  try {
    const destination = sinkUrl()
    if (!destination) return Response.json({ error: 'Usage sharing is unavailable.' }, { status: 503 })
    const event = parseUsageEvent(await readBoundedJson(request, 1_024))
    const now = Date.now()
    for (const [key, window] of windows) if (window.expires <= now) windows.delete(key)
    const window = windows.get(event.device) ?? { count: 0, expires: now + 60_000 }
    if (window.count >= 30 || windows.size >= 2_000) return new Response(null, { status: 429 })
    window.count += 1; windows.set(event.device, window)
    const response = await fetch(destination, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LESTER_METRICS_INGEST_TOKEN}` }, body: JSON.stringify(event), redirect: 'error', signal: AbortSignal.timeout(3_000) })
    return new Response(null, { status: response.ok ? 204 : 503 })
  } catch { return new Response(null, { status: 400 }) }
}
