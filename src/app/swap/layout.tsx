import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Swap — DEX Token Trading on LitVM | Lester Labs',
  description: 'Trade any ERC-20 token on LitVM through the Lester Labs DEX. Live quotes, configurable slippage, and gasless intent signing at 0.30% per trade.',
  alternates: { canonical: 'https://www.lester-labs.com/swap' },
  openGraph: {
    title: 'Swap — DEX Token Trading on LitVM | Lester Labs',
    description: 'Trade any ERC-20 token on LitVM. Live quotes, configurable slippage, gasless intent signing.',
    url: 'https://www.lester-labs.com/swap',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Swap — DEX Token Trading on LitVM | Lester Labs',
    description: 'Trade any ERC-20 token on LitVM at 0.30% per swap.',
  },
}

export default function SwapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}