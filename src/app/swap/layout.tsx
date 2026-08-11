import type { Metadata } from 'next'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const writesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

export const metadata: Metadata = {
  title: writesActive ? 'DEX & Legacy Recovery on LitVM | Lester Labs' : 'DEX Recovery Status & Reserve Quotes on LitVM | Lester Labs',
  description: writesActive
    ? 'Use the source-pinned replacement DEX and inspect bounded reserve quotes or authenticated legacy recovery positions.'
    : 'Inspect bounded reserve quotes and recover eligible legacy DEX positions. New swaps, wrapping, pool creation, and liquidity additions remain disabled during post-compromise replacement.',
  alternates: { canonical: 'https://www.lester-labs.com/swap' },
  openGraph: {
    title: writesActive ? 'DEX & Legacy Recovery on LitVM | Lester Labs' : 'DEX Recovery Status & Reserve Quotes on LitVM | Lester Labs',
    description: writesActive
      ? 'Source-pinned replacement swaps and liquidity plus narrowly authenticated legacy DEX recovery.'
      : 'Read-only reserve quotes and narrowly authenticated legacy DEX recovery while ordinary writes remain disabled.',
    url: 'https://www.lester-labs.com/swap',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: writesActive ? 'DEX on LitVM | Lester Labs' : 'DEX Recovery Status on LitVM | Lester Labs',
    description: writesActive
      ? 'Source-pinned replacement swaps, wrapping, pools, and authenticated legacy recovery.'
      : 'New swaps and liquidity writes are disabled during the post-compromise replacement.',
  },
}

export default function SwapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
