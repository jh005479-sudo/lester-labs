'use client'

import { useState, useCallback, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, decodeEventLog, formatEther } from 'viem'
import { CheckCircle2, Copy, ExternalLink, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { StepBasics, type TokenBasics } from './StepBasics'
import { StepFeatures, type TokenFeatures } from './StepFeatures'
import { StepReview } from './StepReview'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import {
  TOKEN_FACTORY_ABI,
  TOKEN_FACTORY_ADDRESS,
} from '@/lib/contracts/tokenFactory'
import { isValidContractAddress } from '@/config/contracts'

const STEPS = [
  { id: 1, label: 'Token Basics' },
  { id: 2, label: 'Features' },
  { id: 3, label: 'Review & Deploy' },
]

const DEFAULT_BASICS: TokenBasics = {
  name: '',
  symbol: '',
  totalSupply: '',
  decimals: 18,
}

const DEFAULT_FEATURES: TokenFeatures = {
  mintable: false,
  burnable: true,
  pausable: false,
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="tool-steps">
      {STEPS.map((step, idx) => {
        const done = current > step.id
        const active = current === step.id
        return (
          <div key={step.id} style={{ display:'flex', alignItems:'center' }}>
            <div className="tool-step">
              <div className={`tool-step-dot ${done ? 'done' : active ? 'active' : 'pending'}`}>
                {done ? '✓' : step.id}
              </div>
              <span className={`tool-step-text ${done ? 'done' : active ? 'active' : ''}`}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="tool-step-line">
                <div className={`tool-step-line-fill ${done ? 'done' : ''}`} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function isBasicsValid(basics: TokenBasics): boolean {
  return (
    basics.name.trim().length >= 1 &&
    basics.name.trim().length <= 50 &&
    basics.symbol.trim().length >= 2 &&
    basics.symbol.trim().length <= 10 &&
    Number(basics.totalSupply) >= 1 &&
    Number(basics.totalSupply) <= 1_000_000_000_000
  )
}

const isContractConfigured = isValidContractAddress(TOKEN_FACTORY_ADDRESS)

interface SuccessState {
  tokenAddress: string
  name: string
  symbol: string
  txHash: string
}

function SuccessPanel({ result }: { result: SuccessState }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(result.tokenAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result.tokenAddress])

  const nextSteps = [
    { label: 'Lock Liquidity', icon: '🔒', href: '/locker' },
    { label: 'Set Up Vesting', icon: '📅', href: '/vesting' },
    { label: 'Airdrop Tokens', icon: '🪂', href: '/airdrop' },
  ]

  return (
    <div className="space-y-6 text-center">
      {/* Hero */}
      <div className="space-y-2">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-white">Your token is live!</h2>
        <p className="text-white/60">
          <span className="font-semibold text-white">{result.name}</span>
          {' '}
          <span className="font-mono text-[var(--accent)]">({result.symbol})</span>
          {' '}has been deployed to LitVM.
        </p>
      </div>

      {/* Contract address */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left">
        <p className="mb-2 text-xs font-medium text-white/40 uppercase tracking-wider">Contract Address</p>
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate font-mono text-sm text-white">{result.tokenAddress}</span>
          <button
            onClick={copy}
            className="flex-shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            title="Copy address"
          >
            {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
          <a
            href={`https://sepolia.arbiscan.io/address/${result.tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            title="View on Explorer"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {/* Explorer link */}
      <a
        href={`https://sepolia.arbiscan.io/tx/${result.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
      >
        View on Explorer <ExternalLink size={13} />
      </a>

      {/* Next steps */}
      <div className="pt-2">
        <p className="mb-3 text-sm font-medium text-white/60">What&apos;s next?</p>
        <div className="grid grid-cols-3 gap-3">
          {nextSteps.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)] transition-all"
            >
              <span className="text-2xl">{step.icon}</span>
              <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors text-center">
                {step.label}
              </span>
              <ArrowRight size={12} className="text-white/30 group-hover:text-[var(--accent)] transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

interface TokenWizardProps {
  onStateChange?: (state: { name: string; symbol: string; supply: string; decimals: number; mintable: boolean; burnable: boolean; pausable: boolean }) => void
}

export function TokenWizard({ onStateChange }: TokenWizardProps) {
  const [step, setStep] = useState(1)
  const [basics, setBasics] = useState<TokenBasics>(DEFAULT_BASICS)
  const [features, setFeatures] = useState<TokenFeatures>(DEFAULT_FEATURES)

  useEffect(() => {
    onStateChange?.({
      name: basics.name,
      symbol: basics.symbol,
      supply: basics.totalSupply,
      decimals: basics.decimals,
      mintable: features.mintable,
      burnable: features.burnable,
      pausable: features.pausable,
    })
  }, [basics, features, onStateChange])
  const [modalOpen, setModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [successResult, setSuccessResult] = useState<SuccessState | null>(null)

  const { writeContractAsync } = useWriteContract()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()

  // RP-003: Read creation fee from contract
  const { data: creationFee, isLoading: isFeeLoading } = useReadContract({
    address: TOKEN_FACTORY_ADDRESS,
    abi: TOKEN_FACTORY_ABI,
    functionName: 'creationFee',
    query: {
      enabled: isContractConfigured,
    },
  })

  const feeReady = creationFee !== undefined && !isFeeLoading
  const feeDisplay = creationFee ? formatEther(creationFee) : '...'

  const { data: receipt } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  })

  // Process receipt when it arrives
  const handleReceipt = useCallback(
    (hash: `0x${string}`, contractAddress: string) => {
      setTxStatus('success')
      setSuccessResult({
        tokenAddress: contractAddress,
        name: basics.name,
        symbol: basics.symbol,
        txHash: hash,
      })
    },
    [basics.name, basics.symbol],
  )

  // Watch for receipt — parse logs for the deployed token address using ABI-based decoding (F-010)
  // RP-007: Filter logs by factory address before decode, set error if event not found
  useEffect(() => {
    if (receipt && currentTxHash && txStatus === 'pending') {
      let deployedAddress: string | undefined = undefined
      // RP-007: Filter logs by factory address before attempting decode
      const factoryLogs = (receipt.logs || []).filter(
        (log) => log.address.toLowerCase() === TOKEN_FACTORY_ADDRESS.toLowerCase()
      )
      for (const log of factoryLogs) {
        try {
          const decoded = decodeEventLog({
            abi: TOKEN_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'TokenCreated' && 'tokenAddress' in decoded.args) {
            deployedAddress = decoded.args.tokenAddress as string
            break
          }
        } catch {
          // Not a matching event, continue
        }
      }
      // RP-007: If event not found, set error state with verification message
      if (deployedAddress === undefined) {
        setTxStatus('error')
        setTxMessage('Transaction mined but expected event was not decoded; verify on explorer')
        return
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleReceipt(currentTxHash, deployedAddress)
    }
  }, [receipt, currentTxHash, txStatus, handleReceipt])

  const handleDeploy = async () => {
    if (!feeReady) return // RP-003: Block submit until fee loaded
    try {
      setModalOpen(true)
      setTxStatus('pending')
      setTxMessage(undefined)

      const supplyBigInt = parseUnits(basics.totalSupply, basics.decimals)

      const hash = await writeContractAsync({
        address: TOKEN_FACTORY_ADDRESS,
        abi: TOKEN_FACTORY_ABI,
        functionName: 'createToken',
        args: [
          basics.name,
          basics.symbol,
          supplyBigInt,
          basics.decimals,
          features.mintable,
          features.burnable,
          features.pausable,
        ],
        value: creationFee!, // RP-003: Use live fee from contract
      })

      setCurrentTxHash(hash)
      // Status will update when receipt is available via useWaitForTransactionReceipt
    } catch (err: unknown) {
      setTxStatus('error')
      const msg =
        err instanceof Error
          ? err.message.includes('User rejected')
            ? 'Transaction was rejected.'
            : err.message.slice(0, 120)
          : 'An unexpected error occurred.'
      setTxMessage(msg)
    }
  }

  const handleModalClose = () => {
    setModalOpen(false)
    if (txStatus === 'success' && successResult) {
      // Show success panel inline
    }
  }

  if (successResult && !modalOpen) {
    return <SuccessPanel result={successResult} />
  }

  return (
    <div>
      <StepIndicator current={step} />

      <div className="tool-form-card">
        <div className="tool-form-card-line" style={{ background: 'linear-gradient(90deg,transparent,rgba(107,79,255,.15),transparent)' }} />
        {step === 1 && <StepBasics values={basics} onChange={setBasics} />}
        {step === 2 && <StepFeatures values={features} onChange={setFeatures} />}
        {step === 3 && (
          <StepReview
            basics={basics}
            features={features}
            onDeploy={handleDeploy}
            isDeploying={txStatus === 'pending' && modalOpen}
            feeDisplay={feeDisplay}
            feeReady={feeReady}
          />
        )}

        {/* Contract not configured warning */}
        {!isContractConfigured && (
          <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            Token Factory contract not configured. Please set NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS.
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-white/70 hover:border-white/20 hover:text-white disabled:invisible transition-colors"
          >
            ← Back
          </button>

          {step < 3 && (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 1 && !isBasicsValid(basics)) || (step === 2 && !isContractConfigured)}
              className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      <TxStatusModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        status={txStatus}
        txHash={currentTxHash}
        message={txMessage}
        onRetry={txStatus === 'error' ? handleDeploy : undefined}
      />
    </div>
  )
}
