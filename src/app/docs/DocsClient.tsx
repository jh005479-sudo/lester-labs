'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface DocEntry {
  slug: string
  label: string
  content: string
}

export function DocsClient({ docs }: { docs: DocEntry[] }) {
  const [activeSlug, setActiveSlug] = useState('index')

  const activeDoc = docs.find((d) => d.slug === activeSlug) ?? docs[0]

  return (
    <div className="min-h-screen pt-36 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto flex flex-col lg:grid lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-10">
      {/* Sidebar */}
      <aside className="hidden lg:block">
        <nav className="sticky top-32 analytics-card p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 mb-3 px-2">Documentation</p>
          <div className="flex flex-col gap-1.5">
            {docs.map(({ slug, label }, i) => {
              const isActive = activeSlug === slug
              return (
                <button
                  key={slug}
                  onClick={() => setActiveSlug(slug)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all border ${
                    isActive
                      ? 'text-white border-[rgba(139,116,255,0.45)] bg-[linear-gradient(135deg,rgba(107,79,255,0.22),rgba(107,79,255,0.08))] shadow-[0_0_22px_rgba(107,79,255,0.18)]'
                      : 'text-white/62 border-transparent hover:text-white hover:border-white/10 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="text-white/35 mr-2">{String(i + 1).padStart(2, '0')}</span>
                  {label}
                </button>
              )
            })}
          </div>
        </nav>
      </aside>

      {/* Mobile selector */}
      <div className="lg:hidden w-full mb-4">
        <select
          value={activeSlug}
          onChange={(e) => setActiveSlug(e.target.value)}
          className="w-full rounded-md bg-[var(--surface-1)] border border-white/10 text-white px-3 py-2 text-sm"
        >
          {docs.map(({ slug, label }) => (
            <option key={slug} value={slug}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <article className="min-w-0 prose-docs analytics-card p-6 md:p-8">
        <ReactMarkdown>{activeDoc.content}</ReactMarkdown>
      </article>
    </div>
  )
}
