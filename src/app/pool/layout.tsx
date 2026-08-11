import type { Metadata } from 'next'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const writesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

export const metadata: Metadata = {
  title: writesActive ? 'Pool — LP Actions & Legacy Recovery on LitVM | Lester Labs' : 'Pool — Bounded LP Views & Legacy Recovery on LitVM | Lester Labs',
  description: writesActive
    ? 'Inspect bounded replacement-factory pairs, create or add source-pinned liquidity, and recover eligible legacy LP positions.'
    : 'Inspect the newest bounded factory-pair window and eligible wallet LP positions. Pool creation and liquidity additions remain disabled; authenticated legacy removal is recovery-only.',
  alternates: { canonical: 'https://www.lester-labs.com/pool' },
  openGraph: {
    title: writesActive ? 'Pool — LP Actions & Legacy Recovery on LitVM | Lester Labs' : 'Pool — Bounded LP Views & Legacy Recovery on LitVM | Lester Labs',
    description: 'Inspect a bounded newest-pair window and recover eligible legacy LP positions.',
    url: 'https://www.lester-labs.com/pool',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: writesActive ? 'Pool on LitVM | Lester Labs' : 'Pool Recovery Status | Lester Labs',
    description: writesActive
      ? 'Source-pinned replacement liquidity actions and authenticated legacy LP recovery.'
      : 'Pool creation and liquidity additions are disabled during post-compromise replacement.',
  },
}

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
