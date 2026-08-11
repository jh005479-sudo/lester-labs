import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pool — Bounded LP Views & Legacy Recovery on LitVM | Lester Labs',
  description: 'Inspect the newest bounded factory-pair window and eligible wallet LP positions. Pool creation and liquidity additions remain disabled; authenticated legacy removal is recovery-only.',
  alternates: { canonical: 'https://www.lester-labs.com/pool' },
  openGraph: {
    title: 'Pool — Bounded LP Views & Legacy Recovery on LitVM | Lester Labs',
    description: 'Inspect a bounded newest-pair window and recover eligible legacy LP positions.',
    url: 'https://www.lester-labs.com/pool',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pool Recovery Status | Lester Labs',
    description: 'Pool creation and liquidity additions are disabled during post-compromise replacement.',
  },
}

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
