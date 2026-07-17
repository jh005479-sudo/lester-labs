import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Swap — DEX Token Trading on LitVM | Lester Labs',
  description: 'Trade ERC-20 tokens on LitVM through the Lester Labs DEX with live quotes, configurable slippage, and explicit wallet settlement.',
  alternates: { canonical: 'https://www.lester-labs.com/swap' },
  openGraph: {
    title: 'Swap — DEX Token Trading on LitVM | Lester Labs',
    description: 'Trade ERC-20 tokens on LitVM with live quotes, configurable slippage, and explicit wallet settlement.',
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
