'use client'

import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { TokenTracker } from '@/components/analytics/TokenTracker'

export default function TokensPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <LTCBanner />
      <Navbar />
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        <TokenTracker />
      </div>
    </main>
  )
}
