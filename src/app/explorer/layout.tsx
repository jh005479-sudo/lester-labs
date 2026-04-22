import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LitVM Block Explorer — Search Blocks, Transactions & Addresses | Lester Labs',
  description: 'Search and explore the LitVM blockchain. View blocks, transactions, addresses, and token balances. Real-time block data for the LitVM network.',
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
    title: 'LitVM Block Explorer | Lester Labs',
    description: 'Explore the LitVM blockchain. Search blocks, transactions, addresses, and token balances on LitVM.',
    url: 'https://www.lester-labs.com/explorer',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LitVM Block Explorer | Lester Labs',
    description: 'Search and explore the LitVM blockchain. View blocks, transactions, and addresses.',
  },
}

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}