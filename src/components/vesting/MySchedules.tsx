'use client'

import { useState } from 'react'
import { Search, ExternalLink } from 'lucide-react'

export function MySchedules() {
  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState<string | null>(null)

  const handleLookup = () => {
    if (!lookupId.trim()) return
    // Placeholder — will call getLock(id) once contract is deployed
    setLookupResult(lookupId.trim())
  }

  return (
    <div className="space-y-6">
      {/* Lookup by ID */}
      <div className="rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
        <h3 className="mb-1 text-base font-semibold text-white">Look Up a Schedule</h3>
        <p className="mb-4 text-sm text-white/50">
          Enter a Schedule ID to view its details and vesting progress.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Schedule ID (e.g. 42)"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
            />
          </div>
          <button
            onClick={handleLookup}
            disabled={!lookupId.trim()}
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Look Up
          </button>
        </div>
      </div>

      {/* Lookup result (placeholder until contract is live) */}
      {lookupResult !== null && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-2">
          <p className="text-xs font-medium text-yellow-400">Schedule #{lookupResult}</p>
          <p className="text-sm text-white/50">
            On-chain lookup will be available once the vesting contract is deployed. Share the
            schedule ID with the beneficiary so they can track it.
          </p>
        </div>
      )}

      {/* Placeholder — my schedules list */}
      {lookupResult === null && (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <div className="mb-3 text-4xl">VEST</div>
          <h3 className="mb-2 text-base font-semibold text-white">No schedules found</h3>
          <p className="text-sm text-white/40">
            Vesting schedules created from this wallet will appear here.
          </p>
        </div>
      )}

      {/* Beneficiary link note */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/50">
          <span className="text-white/70 font-medium">Beneficiary dashboard:</span>{' '}
          Share{' '}
          <span className="font-mono text-[var(--accent)]">
            lester-labs.com/vesting/claim?id=[id]
          </span>{' '}
          with beneficiaries to let them track and claim their tokens.{' '}
          <a
            href="https://lester-labs.com/vesting/claim"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
          >
            Open <ExternalLink size={11} />
          </a>
        </p>
      </div>
    </div>
  )
}
