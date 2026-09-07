'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordUsage, USAGE_SURFACES } from '@/lib/usageMetrics'

export function UsageTracker() {
  const pathname = usePathname()
  useEffect(() => {
    const surface = pathname.split('/')[1]
    if ((USAGE_SURFACES as readonly string[]).includes(surface)) recordUsage('task_started')
  }, [pathname])
  return null
}
