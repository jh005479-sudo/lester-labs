import fs from 'fs'
import path from 'path'
import { DocsClient } from './DocsClient'

const docList = [
  { slug: 'index', label: 'Overview', file: 'index.md' },
  { slug: 'token-factory', label: 'Token Factory', file: 'token-factory.md' },
  { slug: 'liquidity-locker', label: 'Liquidity Locker', file: 'liquidity-locker.md' },
  { slug: 'token-vesting', label: 'Token Vesting', file: 'token-vesting.md' },
  { slug: 'airdrop-tool', label: 'Airdrop Tool', file: 'airdrop-tool.md' },
  { slug: 'governance', label: 'Governance', file: 'governance.md' },
  { slug: 'launchpad', label: 'Launchpad', file: 'launchpad.md' },
]

export default function DocsPage() {
  const docsDir = path.join(process.cwd(), 'src', 'content', 'docs')
  const docs = docList.map(({ slug, label, file }) => ({
    slug,
    label,
    content: fs.readFileSync(path.join(docsDir, file), 'utf-8'),
  }))

  return <DocsClient docs={docs} />
}
