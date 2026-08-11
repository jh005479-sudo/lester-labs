import fs from 'fs'
import path from 'path'
import { Metadata } from 'next'
import { DocsClient } from './DocsClient'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

export const metadata: Metadata = {
  title: 'Security, Recovery & Deployment Docs | Lester Labs',
  description: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled
    ? 'Immutable public-testnet replacement status, legacy recovery boundaries, bounded data coverage, and future production requirements for Lester Labs on LitVM.'
    : 'Current containment status, legacy recovery boundaries, replacement role separation, bounded data coverage, and source-pinned deployment requirements for Lester Labs on LitVM testnet.',
  keywords: [
    'Lester Labs docs',
    'LitVM DEX recovery documentation',
    'Lester Labs post-compromise deployment',
    'LitVM launchpad recovery',
    'LitVM contract verification',
    'Lester Labs containment status',
  ],
  alternates: { canonical: 'https://www.lester-labs.com/docs' },
  openGraph: {
    title: 'Security, Recovery & Deployment Docs | Lester Labs',
    description: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled
      ? 'Immutable testnet replacement, recovery boundaries, frozen authority, and separate future production requirements.'
      : 'Containment, recovery boundaries, replacement roles, and source-pinned deployment requirements.',
    url: 'https://www.lester-labs.com/docs',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Security, Recovery & Deployment Docs | Lester Labs',
    description: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled
      ? 'Source-pinned public-testnet replacement and deployment-evidence documentation for independent review.'
      : 'Current containment and replacement-deployment documentation for independent review.',
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
