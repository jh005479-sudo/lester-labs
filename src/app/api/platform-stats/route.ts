import { NextResponse } from 'next/server'
import { getPlatformStatsSnapshot } from '@/lib/platformStats'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET() {
  try {
    const snapshot = await getPlatformStatsSnapshot()

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: 'Unable to load platform stats.',
      },
      { status: 500 },
    )
  }
}
