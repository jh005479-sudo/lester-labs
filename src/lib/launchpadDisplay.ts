export type PresaleStatus = 'All' | 'Live' | 'Upcoming' | 'Ended' | 'Finalized' | 'Cancelled'
export type PresaleQualityFilter = 'All' | 'Ending soon' | 'Funded' | 'Participated' | 'Creator' | 'Liquidity ready'
export type PresaleReminder = 'Claim available' | 'Refund available' | 'Ending soon' | 'LP unlock available' | null

export interface LaunchpadDisplayPresale {
  address: string
  name: string
  symbol: string
  token?: string | null
  softCap: string
  hardCap: string
  raised: string
  startTime: number
  endTime: number
  finalized: boolean
  cancelled: boolean
  liquidityBps: number
  lpLockDuration: number
  contributorCount: string | number
  logoUrl?: string
  userContribution?: bigint
  owner?: string | null
  lpUnlockTime?: number
  lpTokensLocked?: bigint
}

export interface PresaleFilterOptions {
  query: string
  status: PresaleStatus
  participatedOnly: boolean
  quality?: PresaleQualityFilter
  userAddress?: string
}

const STATUS_RANK: Record<Exclude<PresaleStatus, 'All'>, number> = {
  Live: 0,
  Upcoming: 1,
  Ended: 2,
  Finalized: 3,
  Cancelled: 4,
}

function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms)
  const days = Math.floor(safeMs / 86_400_000)
  const hours = Math.floor((safeMs % 86_400_000) / 3_600_000)
  return `${days}d ${hours}h`
}

export function getPresaleStatus(presale: LaunchpadDisplayPresale, now: number): Exclude<PresaleStatus, 'All'> {
  if (presale.finalized) return 'Finalized'
  if (presale.cancelled) return 'Cancelled'
  if (now < presale.startTime) return 'Upcoming'
  if (now <= presale.endTime) return 'Live'
  return 'Ended'
}

export function getPresaleTimeLabel(presale: LaunchpadDisplayPresale, now: number): string {
  const status = getPresaleStatus(presale, now)
  if (status === 'Upcoming') return `Starts in ${formatDuration(presale.startTime - now)}`
  if (status === 'Live') return `Ends in ${formatDuration(presale.endTime - now)}`
  return '—'
}

export function getPresaleProgress(presale: Pick<LaunchpadDisplayPresale, 'raised' | 'hardCap'>): number {
  const raised = Number.parseFloat(presale.raised)
  const hardCap = Number.parseFloat(presale.hardCap)
  if (!Number.isFinite(raised) || !Number.isFinite(hardCap) || hardCap <= 0) return 0
  return Math.min(100, Number(((raised / hardCap) * 100).toFixed(2)))
}

function getPresaleSearchText(presale: LaunchpadDisplayPresale) {
  return [
    presale.name,
    presale.symbol,
    presale.address,
    presale.token ?? '',
  ].join(' ').toLowerCase()
}

export function filterPresales(
  presales: LaunchpadDisplayPresale[],
  filters: PresaleFilterOptions,
  now: number,
): LaunchpadDisplayPresale[] {
  const query = filters.query.trim().toLowerCase()

  return presales.filter((presale) => {
    if (filters.participatedOnly && (presale.userContribution ?? 0n) <= 0n) return false
    const status = getPresaleStatus(presale, now)
    if (filters.status !== 'All' && status !== filters.status) return false
    if (filters.quality && !matchesPresaleQualityFilter(presale, filters.quality, now, filters.userAddress)) return false
    if (!query) return true
    return getPresaleSearchText(presale).includes(query)
  })
}

export function matchesPresaleQualityFilter(
  presale: LaunchpadDisplayPresale,
  filter: PresaleQualityFilter,
  now: number,
  userAddress?: string,
): boolean {
  if (filter === 'All') return true
  if (filter === 'Ending soon') {
    return getPresaleStatus(presale, now) === 'Live' && presale.endTime - now <= 6 * 60 * 60 * 1000
  }
  if (filter === 'Funded') return getPresaleProgress(presale) >= 50
  if (filter === 'Participated') return (presale.userContribution ?? 0n) > 0n
  if (filter === 'Creator') {
    return Boolean(userAddress && presale.owner && presale.owner.toLowerCase() === userAddress.toLowerCase())
  }
  if (filter === 'Liquidity ready') {
    return presale.liquidityBps >= 5_000 && Number.parseFloat(presale.raised) > 0
  }
  return true
}

export function getPresaleReminder(
  presale: LaunchpadDisplayPresale,
  now: number,
  isOwner: boolean,
): PresaleReminder {
  const raised = Number.parseFloat(presale.raised)
  const softCap = Number.parseFloat(presale.softCap)
  if (isOwner && presale.finalized && (presale.lpTokensLocked ?? 0n) > 0n && (presale.lpUnlockTime ?? Number.MAX_SAFE_INTEGER) <= Math.floor(now / 1000)) {
    return 'LP unlock available'
  }
  if (presale.finalized && (presale.userContribution ?? 0n) > 0n) return 'Claim available'
  if (!presale.finalized && !presale.cancelled && now > presale.endTime && Number.isFinite(raised) && Number.isFinite(softCap) && raised < softCap && (presale.userContribution ?? 0n) > 0n) {
    return 'Refund available'
  }
  if (getPresaleStatus(presale, now) === 'Live' && presale.endTime - now <= 6 * 60 * 60 * 1000) {
    return 'Ending soon'
  }
  return null
}

export function sortPresales(presales: LaunchpadDisplayPresale[], now: number): LaunchpadDisplayPresale[] {
  return [...presales].sort((a, b) => {
    const statusDelta = STATUS_RANK[getPresaleStatus(a, now)] - STATUS_RANK[getPresaleStatus(b, now)]
    if (statusDelta !== 0) return statusDelta
    return b.startTime - a.startTime
  })
}

export function formatPresaleMarketCap(presale: Pick<LaunchpadDisplayPresale, 'raised' | 'hardCap'>) {
  const raised = Number.parseFloat(presale.raised)
  if (!Number.isFinite(raised)) return '$0'
  const implied = raised * 50
  return `$${implied.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}
