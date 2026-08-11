import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DEX Recovery Status & Reserve Quotes on LitVM | Lester Labs',
  description: 'Inspect bounded reserve quotes and recover eligible legacy DEX positions. New swaps, wrapping, pool creation, and liquidity additions remain disabled during post-compromise replacement.',
  alternates: { canonical: 'https://www.lester-labs.com/swap' },
  openGraph: {
    title: 'DEX Recovery Status & Reserve Quotes on LitVM | Lester Labs',
    description: 'Read-only reserve quotes and narrowly authenticated legacy DEX recovery while ordinary writes remain disabled.',
    url: 'https://www.lester-labs.com/swap',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DEX Recovery Status on LitVM | Lester Labs',
    description: 'New swaps and liquidity writes are disabled during the post-compromise replacement.',
  },
}

export default function SwapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
