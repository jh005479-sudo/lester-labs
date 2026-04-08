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
    <div className="min-h-screen pt-36 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-6 md:gap-8">
      {/* Sidebar */}
      <aside className="hidden md:block w-60 shrink-0">
        <nav className="sticky top-36 flex flex-col gap-1">
          {docs.map(({ slug, label }) => (
            <button
              key={slug}
              onClick={() => setActiveSlug(slug)}
              className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeSlug === slug
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile selector */}
      <div className="md:hidden w-full mb-4">
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
      <article className="min-w-0 flex-1 prose-docs">
        <ReactMarkdown>{activeDoc.content}</ReactMarkdown>
      </article>
    </div>
  )
}
