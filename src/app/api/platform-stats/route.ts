import { NextResponse } from 'next/server'
import { getPlatformStatsSnapshot } from '@/lib/platformStats'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const snapshot = await getPlatformStatsSnapshot()

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=120',
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
