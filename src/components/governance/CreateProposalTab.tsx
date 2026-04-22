'use client'

import { useState } from 'react'
import { CheckCircle2, Copy, FileText, Info } from 'lucide-react'

function buildProposalDraft({
  title,
  summary,
  discussion,
  execution,
  votingWindow,
  snapshotReference,
}: {
  title: string
  summary: string
  discussion: string
  execution: string
  votingWindow: string
  snapshotReference: string
}) {
  return [
    `# ${title.trim() || 'Proposal Title'}`,
    '',
    '## Summary',
    summary.trim() || 'Describe the decision in one paragraph.',
    '',
    '## Motivation',
    'Why does this proposal matter to the community right now?',
    '',
    '## Proposed Action',
    execution.trim() || 'Explain what the team, multisig, or operators will do if the vote passes.',
    '',
    '## Voting Setup',
    `- Voting window: ${votingWindow.trim() || 'Set a fixed start and end time before publishing.'}`,
    `- Balance snapshot: ${snapshotReference.trim() || 'Specify the exact block, timestamp, or snapshot reference.'}`,
    '- Choices: For / Against / Abstain',
    '',
    '## Discussion',
    discussion.trim() || 'Add forum, Discord, or docs links here.',
  ].join('\n')
}

export function CreateProposalTab() {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [discussion, setDiscussion] = useState('')
  const [execution, setExecution] = useState('')
  const [votingWindow, setVotingWindow] = useState('72 hours')
  const [snapshotReference, setSnapshotReference] = useState('Current block at publish time')
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    setDraft(
      buildProposalDraft({
        title,
        summary,
        discussion,
        execution,
        votingWindow,
        snapshotReference,
      }),
    )
    setCopied(false)
  }

  const handleCopy = async () => {
    if (!draft) return
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-400" />
        <div className="space-y-1 text-sm text-blue-200/80">
          <p className="font-medium text-blue-200">Draft off-chain proposals here before you publish them.</p>
          <p>
            The website no longer submits placeholder on-chain governance actions. That reduces execution risk and
            keeps the governance surface aligned with the Snapshot-style model chosen for mainnet.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-white/45">Title</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Allocate treasury budget to audits and grants"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E44FB5]/50"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-white/45">Summary</label>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            placeholder="Summarise the decision, the outcome being voted on, and why it matters."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E44FB5]/50"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-white/45">Voting Window</label>
            <input
              value={votingWindow}
              onChange={(event) => setVotingWindow(event.target.value)}
              placeholder="72 hours"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E44FB5]/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-white/45">Snapshot Reference</label>
            <input
              value={snapshotReference}
              onChange={(event) => setSnapshotReference(event.target.value)}
              placeholder="Block 123456"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E44FB5]/50"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-white/45">Execution Notes</label>
          <textarea
            value={execution}
            onChange={(event) => setExecution(event.target.value)}
            rows={4}
            placeholder="Describe exactly what should happen if the proposal passes."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E44FB5]/50"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-white/45">Discussion Links</label>
          <textarea
            value={discussion}
            onChange={(event) => setDiscussion(event.target.value)}
            rows={3}
            placeholder="Forum thread, docs, treasury spreadsheet, Discord announcement, or audit notes."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E44FB5]/50"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#E44FB5] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c9369e]"
        >
          <FileText size={14} />
          Generate Proposal Draft
        </button>
        {draft && (
          <button
            onClick={() => { void handleCopy() }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:text-white"
          >
            {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Draft'}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/55">Draft Output</h2>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={16}
          placeholder="Generate a draft to review and publish in your Snapshot workflow."
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-[#E44FB5]/50"
        />
      </div>
    </div>
  )
}
