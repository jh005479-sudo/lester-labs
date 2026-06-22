'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Circle, Rocket } from 'lucide-react'

const CHECKLIST_KEY = 'lester:builder-checklist:v1'

const STEPS = [
  { id: 'deploy', label: 'Deploy token', href: '/launch' },
  { id: 'presale', label: 'Run presale', href: '/launchpad?tab=create' },
  { id: 'pool', label: 'Seed liquidity', href: '/swap?createPool=1' },
  { id: 'lock', label: 'Lock LP', href: '/locker' },
  { id: 'chart', label: 'Track chart', href: '/charts' },
  { id: 'ledger', label: 'Post update', href: '/ledger' },
]

function readChecked() {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHECKLIST_KEY) || '[]') as string[]
    return new Set(parsed)
  } catch {
    return new Set<string>()
  }
}

export function BuilderChecklist() {
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  const completed = checked.size

  useEffect(() => {
    queueMicrotask(() => setChecked(readChecked()))
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(Array.from(checked)))
    } catch {
      // Local-only helper; ignore unavailable storage.
    }
  }, [checked])

  return (
    <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200/70">Builder checklist</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Launch flow</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65">
          <Rocket size={15} />
          {completed}/{STEPS.length}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step) => {
          const done = checked.has(step.id)
          return (
            <div key={step.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] p-2.5">
              <button
                type="button"
                onClick={() => {
                  setChecked((current) => {
                    const next = new Set(current)
                    if (next.has(step.id)) next.delete(step.id)
                    else next.add(step.id)
                    return next
                  })
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/65 hover:text-white"
                aria-label={done ? `Mark ${step.label} incomplete` : `Mark ${step.label} complete`}
              >
                {done ? <Check size={15} className="text-emerald-300" /> : <Circle size={15} />}
              </button>
              <Link href={step.href} className="min-w-0 flex-1 truncate text-sm font-semibold text-white/75 no-underline hover:text-white">
                {step.label}
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
