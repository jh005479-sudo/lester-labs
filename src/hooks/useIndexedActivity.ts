'use client'

import { useQuery } from '@tanstack/react-query'
import type { ActivityCursor, ActivityPage, ActivitySource } from '@/lib/activityIndex'

export function useIndexedActivity(source: ActivitySource, cursor?: ActivityCursor) {
  return useQuery<ActivityPage>({
    queryKey: ['activity-index', source, cursor], staleTime: 30_000, retry: 1,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ source })
      if (cursor) params.set('cursor', JSON.stringify(cursor))
      const response = await fetch(`/api/activity?${params}`, { signal })
      if (!response.ok) throw new Error('We couldn’t load activity. Try again in a moment.')
      const page = await response.json() as ActivityPage
      if (!Array.isArray(page.logs) || !page.coverage || page.coverage.complete !== false) throw new Error('Activity could not be checked.')
      return page
    },
  })
}
