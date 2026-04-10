'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Plus, X } from 'lucide-react'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { GovernanceInfoModal } from './GovernanceInfoModal'

const MAX_CHOICES = 5

const VOTING_TYPES = [
  { value: 'single', label: 'Single Choice' },
  { value: 'approval', label: 'Approval Voting' },
  { value: 'ranked', label: 'Ranked Choice' },
]

export function CreateProposalTab() {
  const { isConnected } = useAccount()
  const [modalOpen, setModalOpen] = useState(false)

  const [spaceSlug, setSpaceSlug] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [votingType, setVotingType] = useState('single')
  const [choices, setChoices] = useState(['For', 'Against'])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const addChoice = () => {
    if (choices.length < MAX_CHOICES) {
      setChoices((prev) => [...prev, ''])
    }
  }

  const removeChoice = (idx: number) => {
    setChoices((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateChoice = (idx: number, val: string) => {
    setChoices((prev) => prev.map((c, i) => (i === idx ? val : c)))
  }

  const handlePublish = () => {
    setModalOpen(true)
  }

  const canPublish = isConnected && title.trim().length > 0 && body.trim().length > 0

  return (
    <div className="space-y-6">
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-6">
        {/* Space Slug */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Space Slug</label>
          <input
            type="text"
            value={spaceSlug}
            onChange={(e) => setSpaceSlug(e.target.value)}
            placeholder="mytoken.ltc"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
          />
          <p className="text-xs text-white/30">
            Your project&apos;s unique identifier e.g. mytoken.ltc
          </p>
        </div>

        {/* Proposal Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">
            Proposal Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 100))}
            placeholder="e.g. Treasury Allocation Q2 2026"
            maxLength={100}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
          />
          <p className="text-right text-xs text-white/30">{title.length}/100</p>
        </div>

        {/* Proposal Body */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">
            Proposal Body <span className="text-red-400">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the proposal in full..."
            rows={6}
            className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
          />
          <p className="text-xs text-white/30">Describe the proposal in detail — markdown supported</p>
        </div>

        {/* Voting Type */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Voting Type</label>
          <select
            value={votingType}
            onChange={(e) => setVotingType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0f1117] px-3 py-2.5 text-sm text-white focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
          >
            {VOTING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Choices */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-white/70">Choices</label>
          <div className="space-y-2">
            {choices.map((choice, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/50">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={choice}
                  onChange={(e) => updateChoice(idx, e.target.value)}
                  placeholder={`Choice ${idx + 1}`}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
                />
                {choices.length > 2 && (
                  <button
                    onClick={() => removeChoice(idx)}
                    className="rounded-lg p-1.5 text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {choices.length < MAX_CHOICES && (
            <button
              onClick={addChoice}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              <Plus size={14} />
              Add Choice +
            </button>
          )}
        </div>

        {/* Voting Period */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">Start Date</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-[var(--accent)]/50 focus:outline-none transition-colors [color-scheme:dark]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">End Date</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-[var(--accent)]/50 focus:outline-none transition-colors [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Wallet gate */}
        {!isConnected && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <ConnectWalletPrompt />
          </div>
        )}

        {/* Publish */}
        <button
          onClick={handlePublish}
          disabled={!canPublish}
          className="w-full rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          Publish Proposal
        </button>
      </div>

      <GovernanceInfoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

