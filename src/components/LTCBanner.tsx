import Link from 'next/link'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

/**
 * Global source-pinned release notice. It never derives availability,
 * valuation, or mainnet-readiness claims from a third-party API.
 */
export function LTCBanner() {
  const statusColor = PUBLIC_RELEASE_STATUS.tone === 'success' ? 'var(--success, #2dce89)' : 'var(--warning, #f5a623)'

  return (
    <div
      id="ltc-banner"
      className="fixed top-0 left-0 right-0 z-[80] flex w-full items-center justify-between gap-4 overflow-hidden px-3 sm:px-6"
      style={{
        background: 'linear-gradient(90deg, rgba(64,35,20,0.96) 0%, rgba(42,24,48,0.96) 100%)',
        backdropFilter: 'blur(12px) saturate(140%)',
        height: 'calc(var(--ltc-banner-height) + var(--safe-top))',
        paddingTop: 'var(--safe-top)',
        borderBottom: '1px solid rgba(245,166,35,0.2)',
        fontFamily: 'var(--font-geist-mono), monospace',
        fontSize: 10.5,
      }}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor }} />
        <span className="truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>
          {PUBLIC_RELEASE_STATUS.banner}
        </span>
      </div>
      <div className="hidden shrink-0 items-center gap-3 sm:flex" style={{ color: 'rgba(255,255,255,0.48)' }}>
        <span>LiteForge testnet · chain 4441 · zkLTC has no represented monetary value</span>
        <Link href="/security" className="underline underline-offset-2 hover:text-white">
          Security status
        </Link>
      </div>
    </div>
  )
}
