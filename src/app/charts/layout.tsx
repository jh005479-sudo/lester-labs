import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LitVM Market Charts | Lester Labs',
  description: 'Browse bounded, on-chain reserve-ratio charts for the newest Lester DEX markets on LitVM testnet.',
}

export default function ChartsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
