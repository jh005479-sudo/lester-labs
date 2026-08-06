import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LitVM RPC Explorer — Exact Lookups & Bounded Recent Samples | Lester Labs',
  description: 'Look up exact LitVM blocks and transaction hashes and inspect bounded recent block, address, and token samples. Lester Labs does not provide a full-history index.',
  keywords: [
    'LitVM block explorer',
    'LitVM explorer',
    'LitVM blockchain explorer',
    'LitVM transaction lookup',
    'LitVM block search',
    'LitVM address lookup',
    'Lester Labs explorer',
  ],
  alternates: { canonical: 'https://www.lester-labs.com/explorer' },
  openGraph: {
    title: 'LitVM RPC Explorer — Bounded Samples | Lester Labs',
    description: 'Exact block and transaction lookups plus explicitly bounded recent samples; not a complete chain index.',
    url: 'https://www.lester-labs.com/explorer',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LitVM RPC Explorer | Lester Labs',
    description: 'Exact lookups and bounded recent LitVM samples, not a full-history index.',
  },
}

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
