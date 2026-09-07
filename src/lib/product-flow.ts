import {
  BarChart3,
  LineChart,
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
import { PUBLIC_RELEASE_STATUS } from './publicReleaseStatus.ts'
import { POST_COMPROMISE_GOVERNANCE_ACTIVE } from '../config/contracts.ts'

export type AppIntent = 'Create' | 'Trade' | 'Protect' | 'Govern' | 'Observe'

export type LesterApp = {
  href: string
  label: string
  description: string
  accent: string
  icon: typeof Sparkles
}

const replacementWritesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

export const appGroups: { intent: AppIntent; summary: string; apps: LesterApp[] }[] = [
  {
    intent: 'Create',
    summary: replacementWritesActive
      ? 'Create and launch a project.'
      : 'Creation is paused. Explore your options.',
    apps: [
      { href: '/launch', label: 'Minter', description: replacementWritesActive ? 'Create your token.' : 'Legacy creation disabled.', accent: '#6B4FFF', icon: Sparkles },
      { href: '/launchpad', label: 'Launchpad', description: replacementWritesActive ? 'Launch and manage token sales.' : 'Historical ILO recovery.', accent: '#5E6AD2', icon: Rocket },
      { href: '/airdrop', label: 'Dropper', description: replacementWritesActive ? 'Send tokens to your community.' : 'Local CSV review; writes disabled.', accent: '#36D1DC', icon: Send },
    ],
  },
  {
    intent: 'Trade',
    summary: 'Swap tokens and manage liquidity.',
    apps: [
      { href: '/swap', label: 'Swap', description: replacementWritesActive ? 'Swap on LitVM testnet.' : 'New swaps disabled; recovery status.', accent: '#E44FB5', icon: Droplets },
      { href: '/charts', label: 'Charts', description: 'Explore pools and reserve history.', accent: '#36D1DC', icon: LineChart },
      { href: '/pool', label: 'Pool', description: 'Manage your liquidity.', accent: '#E44FB5', icon: Layers3 },
    ],
  },
  {
    intent: 'Protect',
    summary: 'Plan how tokens unlock.',
    apps: [
      { href: '/locker', label: 'Lockup', description: replacementWritesActive ? 'Create and manage liquidity locks.' : 'New locks disabled; matured withdrawals.', accent: '#2DCE89', icon: LockKeyhole },
      { href: '/vesting', label: 'Vester', description: replacementWritesActive ? 'Schedule releases and claim tokens.' : 'New schedules disabled; vested releases.', accent: '#F5A623', icon: ShieldCheck },
    ],
  },
  {
    intent: 'Govern',
    summary: 'Coordinate community decisions.',
    apps: [
      { href: '/governance', label: 'Gov', description: POST_COMPROMISE_GOVERNANCE_ACTIVE ? 'Propose and vote.' : 'Explore governance. Voting is paused.', accent: '#E44FB5', icon: Vote },
      { href: '/ledger', label: 'Ledger', description: replacementWritesActive ? 'Post and read on-chain messages.' : 'Historical messages; posting disabled.', accent: '#F5A623', icon: MessageSquareText },
    ],
  },
  {
    intent: 'Observe',
    summary: 'Explore activity and your portfolio.',
    apps: [
      { href: '/explorer', label: 'Explorer', description: 'Look up blocks and transactions.', accent: '#8B74FF', icon: Search },
      { href: '/analytics', label: 'Analytics', description: 'Check recent activity and network status.', accent: '#2DCE89', icon: BarChart3 },
      { href: '/portfolio', label: 'Portfolio', description: 'Your tokens and next steps.', accent: '#8B74FF', icon: Wallet },
      { href: '/docs', label: 'Docs', description: replacementWritesActive ? 'Guides and contract details.' : 'Containment, recovery, and deployment evidence.', accent: '#8B74FF', icon: FileText },
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
  { key: 'minter', href: '/launch', label: 'Minter', verb: replacementWritesActive ? 'Create token' : 'Review status', description: replacementWritesActive ? 'Create your token.' : 'Creation remains disabled.', icon: Sparkles, accent: '#6B4FFF' },
  { key: 'launchpad', href: '/launchpad', label: 'Launchpad', verb: replacementWritesActive ? 'Launch or recover' : 'Recover ILO', description: replacementWritesActive ? 'Launch and manage token sales.' : 'Historical recovery only.', icon: Rocket, accent: '#5E6AD2' },
  { key: 'pool', href: '/pool', label: 'Pool', verb: 'Inspect LP', description: replacementWritesActive ? 'Add or remove liquidity.' : 'New liquidity is disabled.', icon: Droplets, accent: '#E44FB5' },
  { key: 'locker', href: '/locker', label: 'Lockup', verb: replacementWritesActive ? 'Lock liquidity' : 'Review locks', description: 'Manage token unlocks.', icon: LockKeyhole, accent: '#2DCE89' },
  { key: 'analytics', href: '/analytics', label: 'Analytics', verb: 'Explore activity', description: 'Bounded observations only.', icon: BarChart3, accent: '#2DCE89' },
  { key: 'ledger', href: '/ledger', label: 'Ledger', verb: replacementWritesActive ? 'Post or read' : 'Read history', description: replacementWritesActive ? 'Post and read on-chain messages.' : 'Paid posting is disabled.', icon: MessageSquareText, accent: '#F5A623' },
]

export function isActivePath(pathname: string, href: string) {
  const hrefPath = href.split('?')[0]
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)
}
