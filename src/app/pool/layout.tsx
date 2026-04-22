import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pool — Liquidity Provider Positions on LitVM | Lester Labs',
  description: 'Track your liquidity provider positions across any LitVM trading pair. View reserves, LP token balances, and your share of each pool.',
  alternates: { canonical: 'https://www.lester-labs.com/pool' },
  openGraph: {
    title: 'Pool — Liquidity Provider Positions on LitVM | Lester Labs',
    description: 'Track your LP positions across all LitVM pairs. View reserves, balances, and pool share.',
    url: 'https://www.lester-labs.com/pool',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pool — Liquidity Provider Positions on LitVM | Lester Labs',
    description: 'Track your liquidity positions across all LitVM pairs.',
  },
}

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}