import { ACTIVITY_SOURCES, parseActivityCursor, type ActivitySource } from '@/lib/activityIndex'
import { getActivityPage } from '@/lib/server/activityGateway'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const url = new URL(request.url)
  const source = url.searchParams.get('source') ?? 'tokens'
  if (!(ACTIVITY_SOURCES as readonly string[]).includes(source)) return Response.json({ error: 'Choose a supported activity source.' }, { status: 400 })
  let cursor
  try { cursor = parseActivityCursor(url.searchParams.get('cursor')) } catch { return Response.json({ error: 'Invalid page cursor.' }, { status: 400 }) }
  try { return Response.json(await getActivityPage(source as ActivitySource, cursor), { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=30' } }) }
  catch { return Response.json({ error: 'We couldn’t load activity. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '15' } }) }
}
