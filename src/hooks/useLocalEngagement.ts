'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addAddressBookEntry,
  addSavedSearch,
  addWatchlistItem,
  buildResumeActivity,
  parseAddressBookCsv,
  recordRecentActivity,
  removeAddressBookEntry,
  removeWatchlistItem,
  type ActivityType,
  type AddressBookEntry,
  type RecentActivity,
  type SavedSearch,
  type SavedSearchSurface,
  type WatchlistItem,
  type WatchlistType,
} from '@/lib/localEngagement'

const STORAGE_VERSION = 'v1'
const WATCHLIST_KEY = `lester:watchlist:${STORAGE_VERSION}`
const SEARCH_KEY = `lester:saved-searches:${STORAGE_VERSION}`
const ACTIVITY_KEY = `lester:activity:${STORAGE_VERSION}`
const ADDRESS_BOOK_KEY = `lester:address-book:${STORAGE_VERSION}`

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Local storage can be unavailable in private browsing or full quota states.
  }
}

export function useLocalEngagement() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const hydrate = () => {
      setWatchlist(readStorage(WATCHLIST_KEY, []))
      setSavedSearches(readStorage(SEARCH_KEY, []))
      setActivity(readStorage(ACTIVITY_KEY, []))
      setAddressBook(readStorage(ADDRESS_BOOK_KEY, []))
      setHydrated(true)
    }

    queueMicrotask(hydrate)
  }, [])

  useEffect(() => {
    if (hydrated) writeStorage(WATCHLIST_KEY, watchlist)
  }, [hydrated, watchlist])

  useEffect(() => {
    if (hydrated) writeStorage(SEARCH_KEY, savedSearches)
  }, [hydrated, savedSearches])

  useEffect(() => {
    if (hydrated) writeStorage(ACTIVITY_KEY, activity)
  }, [activity, hydrated])

  useEffect(() => {
    if (hydrated) writeStorage(ADDRESS_BOOK_KEY, addressBook)
  }, [addressBook, hydrated])

  const resumeItems = useMemo(() => buildResumeActivity({
    activities: activity,
    watchlist,
    searches: savedSearches,
  }), [activity, savedSearches, watchlist])

  const isWatched = useCallback((type: WatchlistType, id: string) => (
    watchlist.some((item) => item.type === type && item.id.toLowerCase() === id.trim().toLowerCase())
  ), [watchlist])

  const addToWatchlist = useCallback((item: Omit<WatchlistItem, 'updatedAt'>) => {
    setWatchlist((current) => addWatchlistItem(current, item))
  }, [])

  const removeFromWatchlist = useCallback((type: WatchlistType, id: string) => {
    setWatchlist((current) => removeWatchlistItem(current, type, id))
  }, [])

  const toggleWatchlist = useCallback((item: Omit<WatchlistItem, 'updatedAt'>) => {
    setWatchlist((current) => (
      current.some((existing) => existing.type === item.type && existing.id.toLowerCase() === item.id.trim().toLowerCase())
        ? removeWatchlistItem(current, item.type, item.id)
        : addWatchlistItem(current, item)
    ))
  }, [])

  const saveSearch = useCallback((surface: SavedSearchSurface, query: string) => {
    setSavedSearches((current) => addSavedSearch(current, { surface, query }))
  }, [])

  const addActivity = useCallback((item: Omit<RecentActivity, 'updatedAt'>) => {
    setActivity((current) => recordRecentActivity(current, item))
  }, [])

  const addAddress = useCallback((address: string, label: string) => {
    setAddressBook((current) => addAddressBookEntry(current, { address, label }))
  }, [])

  const removeAddress = useCallback((address: string) => {
    setAddressBook((current) => removeAddressBookEntry(current, address))
  }, [])

  const importAddressCsv = useCallback((input: string) => {
    const imported = parseAddressBookCsv(input)
    setAddressBook((current) => (
      imported.reduce((entries, entry) => addAddressBookEntry(entries, entry), current)
    ))
    return imported.length
  }, [])

  const scopedSearches = useCallback((surface: SavedSearchSurface) => (
    savedSearches.filter((search) => search.surface === surface)
  ), [savedSearches])

  const typedActivity = useCallback((type: ActivityType) => (
    activity.filter((item) => item.type === type)
  ), [activity])

  return {
    hydrated,
    watchlist,
    savedSearches,
    activity,
    addressBook,
    resumeItems,
    isWatched,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    saveSearch,
    scopedSearches,
    addActivity,
    typedActivity,
    addAddress,
    removeAddress,
    importAddressCsv,
  }
}
