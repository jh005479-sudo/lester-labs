'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { useGovernance, useGovernanceWrite } from '@/hooks/useGovernance'
import { GOVERNANCE_CONFIG } from '@/config/governance'

export function CreateProposalTab() {
  const { isConnected, hasEnoughTokens, tokenBalance, rawBalance, proposalCount } = useGovernance()
  const {
    createProposal,
    isProposing,
    proposeWrite,
    proposeTx,
    switchError,
    isWrongNetwork,
    isSwitchingNetwork,
  } = useGovernanceWrite()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [discussion, setDiscussion] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Watch for tx hash to appear in wagmi state
  useEffect(() => {
    if (proposeWrite.data) {
      setTxHash(proposeWrite.data)
    }
  }, [proposeWrite.data])

  // Watch for tx confirmation
  useEffect(() => {
    if (proposeTx.isSuccess && txHash) {
      setSubmitted(true)
    }
  }, [proposeTx.isSuccess, txHash])

  if (!isConnected) return <ConnectWalletPrompt />

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-4">
        <CheckCircle size={48} className="mx-auto text-green-400" />
        <h2 className="text-xl font-semibold text-white">Proposal Submitted!</h2>
        <p className="text-sm text-gray-400">
          Proposal #{proposalCount + 1} is now pending on LitVM. It will become active after the voting delay.
        </p>
        {txHash && (
          <a
            href={`${GOVERNANCE_CONFIG.space.explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#E44FB5] hover:underline block"
          >
            View on explorer →
          </a>
        )}
        <button
          onClick={() => { setSubmitted(false); setTxHash(null); setTitle(''); setBody(''); setDiscussion('') }}
          className="mt-4 px-4 py-2 rounded-xl bg-[#E44FB5] text-white text-sm hover:bg-[#c9369e] transition-colors"
        >
          Create Another
        </button>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return

    const description = [title, body, discussion ? `Discussion: ${discussion}` : '']
      .filter(Boolean)
      .join('\n\n')

    // No-op proposal targeting a safe address. In production: target real protocol actions
    const targets = ['0x0000000000000000000000000000000000000001'] as `0x${string}`[]
    const values = [0n]
    const calldatas = ['0x'] as `0x${string}`[]

    await createProposal(targets, values, calldatas, description)
  }

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !isProposing

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Threshold info */}
      <div className="flex gap-3 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-300 space-y-1">
          <p>
            You need ≥100,000 <strong>delegated</strong> voting power to submit a proposal.{' '}
            {hasEnoughTokens
              ? <span className="text-green-400 ml-1">✓ Threshold met.</span>
              : <span className="text-yellow-400 ml-1">⚠ Threshold not met — delegate your tokens first.</span>
            }
          </p>
          <p className="text-blue-400/70">
            Voting power: {parseFloat(tokenBalance).toLocaleString()} LGT &nbsp;|&nbsp;
            Raw balance: {parseFloat(rawBalance).toLocaleString()} LGT
            {parseFloat(rawBalance) > 0 && parseFloat(tokenBalance) === 0 && (
              <span className="text-yellow-400"> &nbsp;← Delegate to activate voting power</span>
            )}
          </p>
        </div>
      </div>

      {/* Space */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Space</label>
        <div className="p-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white">
          {GOVERNANCE_CONFIG.space.name}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Allocate 500K LGT to ecosystem grants Q2 2026"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#E44FB5]/50"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          placeholder="Describe your proposal. Include motivation, implementation plan, and expected outcomes..."
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#E44FB5]/50 resize-none font-mono"
        />
      </div>

      {/* Discussion */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
          Discussion <span className="text-gray-600 normal-case">(optional)</span>
        </label>
        <input
          type="url"
          value={discussion}
          onChange={(e) => setDiscussion(e.target.value)}
          placeholder="https://forum.litvm.io/proposals/..."
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#E44FB5]/50"
        />
      </div>

      {/* Standard choices */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Choices</label>
        <div className="flex gap-3">
          {['For', 'Against', 'Abstain'].map((choice) => (
            <div
              key={choice}
              className="flex-1 p-3 rounded-xl border border-white/10 bg-white/5 text-center text-sm text-gray-300"
            >
              {choice}
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="pt-2 space-y-3">
        <button
          onClick={() => { void handleSubmit() }}
          disabled={isWrongNetwork ? isSwitchingNetwork : !canSubmit}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            (isWrongNetwork || canSubmit)
              ? 'bg-[#E44FB5] hover:bg-[#c9369e] text-white'
              : 'bg-white/5 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isWrongNetwork ? (
            <>{isSwitchingNetwork ? <><Loader2 size={14} className="animate-spin" /> Switching network...</> : 'Switch to LitVM Testnet'}</>
          ) : isProposing ? (
            <><Loader2 size={14} className="animate-spin" /> Submitting on-chain...</>
          ) : (
            'Submit Proposal On-Chain'
          )}
        </button>

        {isWrongNetwork && (
          <div className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
            <AlertCircle size={14} />
            Wallet is on the wrong network. Switch to LitVM Testnet before creating a proposal.
          </div>
        )}

        {switchError && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <AlertCircle size={14} />
            {switchError}
          </div>
        )}

        {proposeTx.isError && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <AlertCircle size={14} />
            Transaction failed. Ensure you have enough delegated voting power.
          </div>
        )}

        <p className="text-center text-xs text-gray-600">
          Live on-chain transaction on LitVM — plan carefully before submitting
        </p>
      </div>
    </div>
  )
}
