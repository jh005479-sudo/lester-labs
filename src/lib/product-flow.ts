import {
  BarChart3,
  Droplets,
  FileText,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Vote,
  Wallet,
} from 'lucide-react'

export type AppIntent = 'Create' | 'Trade' | 'Protect' | 'Govern' | 'Observe'

export type LesterApp = {
  href: string
  label: string
  description: string
  accent: string
  icon: typeof Sparkles
}

export const appGroups: { intent: AppIntent; summary: string; apps: LesterApp[] }[] = [
  {
    intent: 'Create',
    summary: 'Deploy assets and distribute them.',
    apps: [
      { href: '/launch', label: 'Minter', description: 'Deploy ERC-20s on LitVM.', accent: '#6B4FFF', icon: Sparkles },
      { href: '/launchpad', label: 'Launchpad', description: 'Run presales with LP seeding.', accent: '#5E6AD2', icon: Rocket },
      { href: '/airdrop', label: 'Dropper', description: 'Batch-send tokens by CSV.', accent: '#36D1DC', icon: Send },
    ],
  },
  {
    intent: 'Trade',
    summary: 'Move and seed LitVM liquidity.',
    apps: [
      { href: '/swap', label: 'Swap', description: 'Trade LitVM assets.', accent: '#E44FB5', icon: Droplets },
      { href: '/pool', label: 'Pool', description: 'Create and manage LP.', accent: '#E44FB5', icon: Layers3 },
    ],
  },
  {
    intent: 'Protect',
    summary: 'Prove locks and vesting schedules.',
    apps: [
      { href: '/locker', label: 'Lockup', description: 'Lock LP with certificates.', accent: '#2DCE89', icon: LockKeyhole },
      { href: '/vesting', label: 'Vester', description: 'Create vesting wallets.', accent: '#F5A623', icon: ShieldCheck },
    ],
  },
  {
    intent: 'Govern',
    summary: 'Coordinate community decisions.',
    apps: [
      { href: '/governance', label: 'Gov', description: 'Draft and run Snapshot-style votes.', accent: '#E44FB5', icon: Vote },
      { href: '/ledger', label: 'Ledger', description: 'Permanent LitVM message board.', accent: '#F5A623', icon: MessageSquareText },
    ],
  },
  {
    intent: 'Observe',
    summary: 'Understand what is happening on-chain.',
    apps: [
      { href: '/explorer', label: 'Explorer', description: 'Blocks, txs, and token lookup.', accent: '#8B74FF', icon: Search },
      { href: '/analytics', label: 'Analytics', description: 'Market and network intelligence.', accent: '#2DCE89', icon: BarChart3 },
      { href: '/portfolio', label: 'Portfolio', description: 'Wallet activity command center.', accent: '#8B74FF', icon: Wallet },
      { href: '/docs', label: 'Docs', description: 'Contracts, guides, and flows.', accent: '#8B74FF', icon: FileText },
    ],
  },
]

export type FlowKey = 'minter' | 'launchpad' | 'pool' | 'locker' | 'analytics' | 'ledger'

export const launchFlow: {
  key: FlowKey
  href: string
  label: string
  verb: string
  description: string
  icon: typeof Sparkles
  accent: string
}[] = [
  { key: 'minter', href: '/launch', label: 'Minter', verb: 'Deploy token', description: 'Create the ERC-20 asset.', icon: Sparkles, accent: '#6B4FFF' },
  { key: 'launchpad', href: '/launchpad', label: 'Launchpad', verb: 'Run presale', description: 'Configure raise and LP rules.', icon: Rocket, accent: '#5E6AD2' },
  { key: 'pool', href: '/pool', label: 'Pool', verb: 'Seed liquidity', description: 'Create the tradable pair.', icon: Droplets, accent: '#E44FB5' },
  { key: 'locker', href: '/locker', label: 'Lockup', verb: 'Lock LP', description: 'Publish a trust certificate.', icon: LockKeyhole, accent: '#2DCE89' },
  { key: 'analytics', href: '/analytics', label: 'Analytics', verb: 'Track market', description: 'Watch health and demand.', icon: BarChart3, accent: '#2DCE89' },
  { key: 'ledger', href: '/ledger', label: 'Ledger', verb: 'Post update', description: 'Keep the community in sync.', icon: MessageSquareText, accent: '#F5A623' },
]

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
