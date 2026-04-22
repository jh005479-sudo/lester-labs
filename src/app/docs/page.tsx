import fs from 'fs'
import path from 'path'
import { Metadata } from 'next'
import { DocsClient } from './DocsClient'

export const metadata: Metadata = {
  title: 'Docs — DeFi Tools on LitVM | Lester Labs',
  description: 'Complete documentation for the Lester Labs DeFi suite on LitVM. Learn how to use the DEX swap, token factory, launchpad, airdrop tool, liquidity locker, vesting, and governance.',
  keywords: [
    'Lester Labs docs',
    'LitVM DEX documentation',
    'LitVM token factory guide',
    'LitVM launchpad docs',
    'LitVM airdrop tool guide',
    'LitVM liquidity locker documentation',
    'LitVM vesting guide',
  ],
  alternates: { canonical: 'https://www.lester-labs.com/docs' },
  openGraph: {
    title: 'Docs — DeFi Tools on LitVM | Lester Labs',
    description: 'Documentation for the Lester Labs DeFi suite on LitVM. DEX swap, token factory, launchpad, airdrop, locker, vesting, and governance.',
    url: 'https://www.lester-labs.com/docs',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Docs — DeFi Tools on LitVM | Lester Labs',
    description: 'Documentation for the Lester Labs DeFi suite on LitVM.',
  },
}

const docList = [
  { slug: 'index', label: 'Overview', file: 'index.md' },
  { slug: 'token-factory', label: 'Token Factory', file: 'token-factory.md' },
  { slug: 'liquidity-locker', label: 'Liquidity Locker', file: 'liquidity-locker.md' },
  { slug: 'token-vesting', label: 'Token Vesting', file: 'token-vesting.md' },
  { slug: 'airdrop-tool', label: 'Airdrop Tool', file: 'airdrop-tool.md' },
  { slug: 'governance', label: 'Governance', file: 'governance.md' },
  { slug: 'launchpad', label: 'Launchpad', file: 'launchpad.md' },
  { slug: 'dex-swap', label: 'DEX Swap & Pool', file: 'dex-swap.md' },
  { slug: 'ledger', label: 'The Ledger', file: 'ledger.md' },
]

export default function DocsPage() {
  const docsDir = path.join(process.cwd(), 'src', 'content', 'docs')
  const docs = docList.map(({ slug, label, file }) => ({
    slug,
    label,
    content: fs.readFileSync(path.join(docsDir, file), 'utf-8'),
  }))

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <DocsClient docs={docs} />
    </div>
  )
}
