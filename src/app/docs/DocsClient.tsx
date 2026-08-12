'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface DocEntry {
  slug: string
  label: string
  content: string
}

type DocBlock =
  | { type: 'markdown'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line)
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function parseDocBlocks(content: string): DocBlock[] {
  const lines = content.split('\n')
  const blocks: DocBlock[] = []
  let markdownStart = 0
  let index = 0

  while (index < lines.length - 1) {
    const headers = splitTableRow(lines[index])
    if (!lines[index].includes('|') || !isTableSeparator(lines[index + 1])) {
      index += 1
      continue
    }

    const markdown = lines.slice(markdownStart, index).join('\n').trim()
    if (markdown) blocks.push({ type: 'markdown', content: markdown })

    const rows: string[][] = []
    index += 2
    while (index < lines.length && lines[index].includes('|')) {
      const row = splitTableRow(lines[index])
      if (row.length !== headers.length) break
      rows.push(row)
      index += 1
    }
    blocks.push({ type: 'table', headers, rows })
    markdownStart = index
  }

  const markdown = lines.slice(markdownStart).join('\n').trim()
  if (markdown) blocks.push({ type: 'markdown', content: markdown })
  return blocks
}

function MarkdownCell({ content }: { content: string }) {
  return (
    <ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>
      {content}
    </ReactMarkdown>
  )
}

export function DocsClient({ docs }: { docs: DocEntry[] }) {
  const [activeSlug, setActiveSlug] = useState('index')

  const activeDoc = docs.find((d) => d.slug === activeSlug) ?? docs[0]
  const blocks = parseDocBlocks(activeDoc.content)

  return (
    <div className="min-h-screen pt-36 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1480px] mx-auto flex flex-col lg:grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6 lg:gap-10">
      {/* Sidebar */}
      <aside className="hidden lg:block">
        <nav className="sticky top-32 h-[calc(100vh-10rem)] pr-6 border-r border-white/10">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 mb-4">Documentation</p>
          <div className="flex flex-col gap-1.5">
            {docs.map(({ slug, label }, i) => {
              const isActive = activeSlug === slug
              return (
                <button
                  key={slug}
                  onClick={() => setActiveSlug(slug)}
                  className={`w-full text-left px-2 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'text-white bg-[linear-gradient(90deg,rgba(107,79,255,0.22),rgba(107,79,255,0.04))] border-l-2 border-[var(--accent)] pl-3 shadow-[inset_0_0_16px_rgba(107,79,255,0.16)]'
                      : 'text-white/58 hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  <span className="text-white/30 mr-2">{String(i + 1).padStart(2, '0')}</span>
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
          className="w-full rounded-md border border-white/10 text-white px-3 py-2 text-sm"
          style={{ background: '#0e0b22', color: '#F0EEF5' }}
        >
          {docs.map(({ slug, label }) => (
            <option key={slug} value={slug} style={{ background: '#0e0b22', color: '#F0EEF5' }}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <article className="min-w-0 prose-docs p-6 md:p-8 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.015)]">
        {blocks.map((block, index) => block.type === 'markdown' ? (
          <ReactMarkdown key={`markdown-${index}`}>{block.content}</ReactMarkdown>
        ) : (
          <table key={`table-${index}`}>
            <thead>
              <tr>
                {block.headers.map((header, cellIndex) => (
                  <th key={`header-${cellIndex}`}><MarkdownCell content={header} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}><MarkdownCell content={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </article>
    </div>
  )
}
