import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tutorials & Guides — LitVM DeFi and Lester Labs',
  description: 'Step-by-step guides for LitVM DeFi: how to use the LitVM DEX swap, run a token launchpad presale, airdrop tokens, lock LP, and deploy ERC-20 tokens on LitVM testnet.',
  keywords: ['LitVM tutorial', 'LitVM DEX tutorial', 'LitVM launchpad guide', 'LitVM airdrop', 'Lester Labs tutorial', 'LitVM swap guide'],
}

export default function TutorialsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
