import { validAddress } from '@/lib/projectJourney'
import { getPairHistory } from '@/lib/server/activityGateway'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const pair = new URL(request.url).searchParams.get('pair')
  if (!validAddress(pair)) return Response.json({ error: 'Enter a valid pair address.' }, { status: 400 })
  try { return Response.json(await getPairHistory(pair), { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=30' } }) }
  catch { return Response.json({ error: 'Pool history is temporarily unavailable. Try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
