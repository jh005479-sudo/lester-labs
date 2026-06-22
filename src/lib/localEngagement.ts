export type WatchlistType = 'token' | 'pool' | 'presale' | 'wallet'
export type SavedSearchSurface = 'explorer' | 'charts' | 'pool' | 'launchpad'
export type ActivityType = WatchlistType | 'swap' | 'airdrop' | 'lock' | 'vesting' | 'ledger'

export interface WatchlistItem {
  type: WatchlistType
  id: string
  label: string
  href: string
  updatedAt: number
}

export interface SavedSearch {
  surface: SavedSearchSurface
  query: string
  updatedAt: number
}

export interface RecentActivity {
  type: ActivityType
  id: string
  label: string
  href: string
  action: string
  updatedAt: number
}

export interface AddressBookEntry {
  address: string
  label: string
  updatedAt: number
}

export type ResumeItem =
  | (RecentActivity & { kind: 'activity' })
  | (WatchlistItem & { kind: 'watchlist' })
  | (SavedSearch & { kind: 'search'; label: string; href: string })

const DEFAULT_LIMIT = 12

function normalizeId(id: string) {
  return id.trim().toLowerCase()
}

function isEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

export function addWatchlistItem(
  items: WatchlistItem[],
  item: Omit<WatchlistItem, 'updatedAt'>,
  now = Date.now(),
  limit = DEFAULT_LIMIT,
): WatchlistItem[] {
  const next = {
    ...item,
    id: normalizeId(item.id),
    updatedAt: now,
  }
  return [next, ...items.filter((existing) => (
    existing.type !== next.type || normalizeId(existing.id) !== next.id
  ))].slice(0, limit)
}

export function removeWatchlistItem(
  items: WatchlistItem[],
  type: WatchlistType,
  id: string,
): WatchlistItem[] {
  const normalized = normalizeId(id)
  return items.filter((item) => item.type !== type || normalizeId(item.id) !== normalized)
}

export function addSavedSearch(
  searches: SavedSearch[],
  search: Omit<SavedSearch, 'updatedAt'>,
  now = Date.now(),
  limit = DEFAULT_LIMIT,
): SavedSearch[] {
  const query = search.query.trim()
  if (!query) return searches
  const normalizedQuery = query.toLowerCase()
  const next = { ...search, query, updatedAt: now }
  return [next, ...searches.filter((existing) => (
    existing.surface !== search.surface || existing.query.trim().toLowerCase() !== normalizedQuery
  ))].slice(0, limit)
}

export function recordRecentActivity(
  activities: RecentActivity[],
  activity: Omit<RecentActivity, 'updatedAt'>,
  now = Date.now(),
  limit = DEFAULT_LIMIT,
): RecentActivity[] {
  const next = {
    ...activity,
    id: normalizeId(activity.id),
    updatedAt: now,
  }
  return [next, ...activities.filter((existing) => (
    existing.type !== next.type || normalizeId(existing.id) !== next.id
  ))].slice(0, limit)
}

export function buildResumeActivity({
  activities,
  watchlist,
  searches,
  limit = 6,
}: {
  activities: RecentActivity[]
  watchlist: WatchlistItem[]
  searches: SavedSearch[]
  limit?: number
}): ResumeItem[] {
  const activityItems: ResumeItem[] = activities.map((activity) => ({ ...activity, kind: 'activity' }))
  const watchlistItems: ResumeItem[] = watchlist.map((item) => ({ ...item, kind: 'watchlist' }))
  const searchItems: ResumeItem[] = searches.map((search) => ({
    ...search,
    kind: 'search',
    label: `${search.surface}: ${search.query}`,
    href: `/${search.surface === 'pool' ? 'pool' : search.surface}?q=${encodeURIComponent(search.query)}`,
  }))

  return [...activityItems, ...watchlistItems, ...searchItems]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
}

export function addAddressBookEntry(
  entries: AddressBookEntry[],
  entry: Omit<AddressBookEntry, 'updatedAt'>,
  now = Date.now(),
  limit = 250,
): AddressBookEntry[] {
  const address = entry.address.trim()
  if (!isEvmAddress(address)) return entries
  const normalized = address.toLowerCase()
  const next = {
    address: normalized,
    label: entry.label.trim() || `${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
    updatedAt: now,
  }

  return [next, ...entries.filter((existing) => existing.address.toLowerCase() !== normalized)]
    .slice(0, limit)
}

export function removeAddressBookEntry(entries: AddressBookEntry[], address: string) {
  const normalized = address.trim().toLowerCase()
  return entries.filter((entry) => entry.address.toLowerCase() !== normalized)
}

export function parseAddressBookCsv(input: string, now = Date.now()): AddressBookEntry[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<AddressBookEntry[]>((entries, line, index) => {
      const [first = '', second = ''] = line.split(',').map((value) => value.trim())
      const [address, label] = isEvmAddress(first) ? [first, second] : [second, first]
      return addAddressBookEntry(entries, { address, label }, now + index, 250)
    }, [])
}
