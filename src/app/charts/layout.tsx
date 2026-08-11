import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bounded DEX Reserve-Ratio Charts | Lester Labs',
  description: 'Inspect up to 72 newest factory pairs and bounded Sync-event reserve ratios on LitVM testnet. Values are not oracle prices, USD valuations, TVL, or a complete market index.',
}

export default function ChartsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
