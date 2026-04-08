'use client'

import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { HealthPanel } from '@/components/analytics/HealthPanel'

export default function HealthPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Navbar /><LTCBanner />
      <main className="mx-auto max-w-7xl px-4 pt-40 pb-20 sm:px-6 lg:px-8">
        <HealthPanel />
      </main>
    </div>
  )
}
