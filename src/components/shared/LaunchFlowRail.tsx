'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { type FlowKey, launchFlow } from '@/lib/product-flow'

interface LaunchFlowRailProps {
  active: FlowKey
  compact?: boolean
}

export function LaunchFlowRail({ active, compact = false }: LaunchFlowRailProps) {
  const activeIndex = launchFlow.findIndex((step) => step.key === active)

  return (
    <nav
      aria-label="Launch workflow"
      className="mx-auto w-full max-w-[1280px] px-4 sm:px-8 lg:px-10"
      style={{ marginTop: compact ? 0 : 8, position: 'relative', zIndex: 3 }}
    >
      <div
        className="launch-flow-scroller overflow-x-auto"
        style={{
          background: 'rgba(12,10,24,0.82)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 22px 60px rgba(0,0,0,0.28)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="launch-flow-grid">
          {launchFlow.map((step, index) => {
            const Icon = step.icon
            const current = step.key === active
            const complete = activeIndex > index

            return (
              <Link
                key={step.key}
                href={step.href}
                className="launch-flow-step group relative flex items-center gap-3 px-4 py-4 transition-colors hover:bg-white/[0.035]"
                aria-current={current ? 'page' : undefined}
                style={{
                  color: current ? '#fff' : 'rgba(240,238,245,0.66)',
                  textDecoration: 'none',
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center"
                  style={{
                    borderRadius: 10,
                    background: current ? `${step.accent}28` : complete ? `${step.accent}12` : 'rgba(255,255,255,0.045)',
                    border: `1px solid ${current ? `${step.accent}66` : complete ? `${step.accent}2e` : 'rgba(255,255,255,0.08)'}`,
                    color: step.accent,
                    opacity: complete ? 0.72 : 1,
                  }}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-[0.14em]" style={{ color: current ? step.accent : 'rgba(240,238,245,0.38)' }}>
                    {index + 1}. {step.label}
                  </span>
                  <span className="mt-1 block text-sm font-semibold leading-tight">{step.verb}</span>
                  {!compact && (
                    <span className="launch-flow-description mt-1 block text-xs leading-snug" style={{ color: 'rgba(240,238,245,0.42)' }}>
                      {step.description}
                    </span>
                  )}
                </span>
                {current && (
                  <span
                    className="absolute inset-x-4 bottom-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${step.accent}, transparent)` }}
                  />
                )}
                {index < launchFlow.length - 1 && (
                  <ChevronRight
                    aria-hidden
                    className="absolute -right-2 top-1/2 hidden -translate-y-1/2 opacity-40 lg:block"
                    size={14}
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
