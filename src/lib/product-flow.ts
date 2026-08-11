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
      ? 'Create with source-pinned replacement contracts.'
      : 'Review disabled legacy creation and replacement readiness.',
    apps: [
      { href: '/launch', label: 'Minter', description: replacementWritesActive ? 'Reviewed replacement creation.' : 'Legacy creation disabled.', accent: '#6B4FFF', icon: Sparkles },
      { href: '/launchpad', label: 'Launchpad', description: replacementWritesActive ? 'Reviewed launches and legacy recovery.' : 'Historical ILO recovery.', accent: '#5E6AD2', icon: Rocket },
      { href: '/airdrop', label: 'Dropper', description: replacementWritesActive ? 'Review and send bounded batches.' : 'Local CSV review; writes disabled.', accent: '#36D1DC', icon: Send },
    ],
  },
  {
    intent: 'Trade',
    summary: 'Inspect bounded reserves and recover eligible legacy positions.',
    apps: [
      { href: '/swap', label: 'Swap', description: replacementWritesActive ? 'Source-pinned swaps and recovery.' : 'New swaps disabled; recovery status.', accent: '#E44FB5', icon: Droplets },
      { href: '/charts', label: 'Charts', description: 'Bounded reserve ratios.', accent: '#36D1DC', icon: LineChart },
      { href: '/pool', label: 'Pool', description: 'Inspect and recover eligible LP.', accent: '#E44FB5', icon: Layers3 },
    ],
  },
  {
    intent: 'Protect',
    summary: 'Inspect historical positions and eligible recovery paths.',
    apps: [
      { href: '/locker', label: 'Lockup', description: replacementWritesActive ? 'Reviewed locks and legacy withdrawals.' : 'New locks disabled; matured withdrawals.', accent: '#2DCE89', icon: LockKeyhole },
      { href: '/vesting', label: 'Vester', description: replacementWritesActive ? 'Reviewed schedules and legacy releases.' : 'New schedules disabled; vested releases.', accent: '#F5A623', icon: ShieldCheck },
    ],
  },
  {
    intent: 'Govern',
    summary: 'Coordinate community decisions.',
    apps: [
      { href: '/governance', label: 'Gov', description: replacementWritesActive ? 'Reviewed replacement governance.' : 'Draft guidance; legacy stack retired.', accent: '#E44FB5', icon: Vote },
      { href: '/ledger', label: 'Ledger', description: replacementWritesActive ? 'Source-pinned posting and history.' : 'Historical messages; posting disabled.', accent: '#F5A623', icon: MessageSquareText },
    ],
  },
  {
    intent: 'Observe',
    summary: 'Inspect explicitly bounded RPC and local samples.',
    apps: [
      { href: '/explorer', label: 'Explorer', description: 'Exact lookups and bounded recent feeds.', accent: '#8B74FF', icon: Search },
      { href: '/analytics', label: 'Analytics', description: 'Bounded network observations.', accent: '#2DCE89', icon: BarChart3 },
      { href: '/portfolio', label: 'Portfolio', description: 'Partial wallet activity view.', accent: '#8B74FF', icon: Wallet },
      { href: '/docs', label: 'Docs', description: replacementWritesActive ? 'Release, recovery, and deployment evidence.' : 'Containment, recovery, and deployment evidence.', accent: '#8B74FF', icon: FileText },
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
  { key: 'minter', href: '/launch', label: 'Minter', verb: replacementWritesActive ? 'Create token' : 'Review status', description: replacementWritesActive ? 'Reviewed replacement creation.' : 'Creation remains disabled.', icon: Sparkles, accent: '#6B4FFF' },
  { key: 'launchpad', href: '/launchpad', label: 'Launchpad', verb: replacementWritesActive ? 'Launch or recover' : 'Recover ILO', description: replacementWritesActive ? 'Reviewed launches and legacy recovery.' : 'Historical recovery only.', icon: Rocket, accent: '#5E6AD2' },
  { key: 'pool', href: '/pool', label: 'Pool', verb: 'Inspect LP', description: replacementWritesActive ? 'Reviewed liquidity and legacy recovery.' : 'New liquidity is disabled.', icon: Droplets, accent: '#E44FB5' },
  { key: 'locker', href: '/locker', label: 'Lockup', verb: 'Recover lock', description: 'Matured withdrawal only.', icon: LockKeyhole, accent: '#2DCE89' },
  { key: 'analytics', href: '/analytics', label: 'Analytics', verb: 'Review sample', description: 'Bounded observations only.', icon: BarChart3, accent: '#2DCE89' },
  { key: 'ledger', href: '/ledger', label: 'Ledger', verb: replacementWritesActive ? 'Post or read' : 'Read history', description: replacementWritesActive ? 'Source-pinned posting and history.' : 'Paid posting is disabled.', icon: MessageSquareText, accent: '#F5A623' },
]

export function isActivePath(pathname: string, href: string) {
  const hrefPath = href.split('?')[0]
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)
}
