'use client'

import { TokenTracker } from '@/components/analytics/TokenTracker'

export default function TokensPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Token Launch Tracker</h1>
          <p className="mt-1 text-sm text-white/50">Newest Lester factory deployments on LitVM testnet.</p>
          <p className="mt-2 text-xs text-white/30">Discovery is a bounded newest-first sample. Use an exact contract address for direct token inspection.</p>
        </div>
        <TokenTracker />
      </div>
    </main>
  )
}
