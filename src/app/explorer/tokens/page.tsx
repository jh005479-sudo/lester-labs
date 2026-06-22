'use client'

import { TokenTracker } from '@/components/analytics/TokenTracker'

export default function TokensPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        <TokenTracker />
      </div>
    </main>
  )
}
