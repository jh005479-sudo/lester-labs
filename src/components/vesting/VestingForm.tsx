'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { litvm } from '@/config/chains'
import { parseUnits, isAddress, decodeEventLog, formatEther } from 'viem'
import { LITVM_EXPLORER_URL } from '@/lib/explorerRpc'
import { CheckCircle2, Circle, CircleAlert, CircleDashed, Copy, ExternalLink, ArrowRight, Mail, PartyPopper, Send } from 'lucide-react'
import Link from 'next/link'
import { FeeDisplay } from '@/components/shared/FeeDisplay'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { VestingTimeline } from './VestingTimeline'
import {
  VESTING_FACTORY_ABI,
  ERC20_APPROVE_ABI,
  VESTING_FACTORY_ADDRESS,
} from '@/lib/contracts/tokenVesting'
import { isValidContractAddress } from '@/config/contracts'

// ABI for fetching token decimals (F-009)
const ERC20_DECIMALS_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

type VestingType = 'linear' | 'cliff_linear' | 'custom'

interface FormState {
  tokenAddress: string
  beneficiary: string
  totalAmount: string
  revocable: boolean
  vestingType: VestingType
  startDate: string
  cliffDate: string
  endDate: string
}

interface SuccessState {
  vestingId: string
  tokenAddress: string
  beneficiary: string
  totalAmount: string
  vestingType: VestingType
  startDate: string
  cliffDate: string
  endDate: string
  txHash: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0]

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function toTimestamp(dateStr: string): bigint {
  return BigInt(Math.floor(new Date(dateStr).getTime() / 1000))
}

function isValidAddress(val: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(val)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children, helper }: { children: React.ReactNode; helper?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-medium text-white">{children}</label>
      {helper && <p className="text-xs text-white/40 mt-0.5">{helper}</p>}
    </div>
  )
}

function AddressInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const invalid = value.length > 0 && !isValidAddress(value)
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '0x…'}
      className={`w-full rounded-lg border bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 transition-colors ${
        invalid
          ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
          : 'border-white/10 focus:border-[var(--accent)]/50 focus:ring-[var(--accent)]/30'
      }`}
    />
  )
}

function VestingTypeCard({
  type: _type, // eslint-disable-line @typescript-eslint/no-unused-vars
  selected,
  onSelect,
  icon,
  label,
  description,
}: {
  type: VestingType
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-all ${
        selected
          ? 'border-[var(--accent)]/60 bg-[var(--accent-muted)]'
          : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[var(--accent)]">{icon}</span>
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed">{description}</p>
    </button>
  )
}

// ─── Success Panel ────────────────────────────────────────────────────────────

function SuccessPanel({ result }: { result: SuccessState }) {
  const [copied, setCopied] = useState(false)
  const claimLink = `lester-labs.com/vesting/claim?id=${result.vestingId}`

  const copy = useCallback(() => {
    navigator.clipboard.writeText(claimLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [claimLink])

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <div className="flex justify-center"><PartyPopper size={40} className="text-[var(--accent)]" /></div>
        <h2 className="text-2xl font-bold text-white">Vesting schedule created!</h2>
        <p className="text-white/60 text-sm">
          Schedule ID:{' '}
          <span className="font-mono text-[var(--accent)] font-semibold">#{result.vestingId}</span>
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-left space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">Summary</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-white/40">Token</span>
            <p className="font-mono text-white">{shortAddr(result.tokenAddress)}</p>
          </div>
          <div>
            <span className="text-white/40">Beneficiary</span>
            <p className="font-mono text-white">{shortAddr(result.beneficiary)}</p>
          </div>
          <div>
            <span className="text-white/40">Total amount</span>
            <p className="text-white">{result.totalAmount} tokens</p>
          </div>
          <div>
            <span className="text-white/40">Type</span>
            <p className="text-white capitalize">{result.vestingType.replace('_', ' + ')}</p>
          </div>
          <div>
            <span className="text-white/40">Start</span>
            <p className="text-white">{formatDate(result.startDate)}</p>
          </div>
          {result.vestingType === 'cliff_linear' && (
            <div>
              <span className="text-white/40">Cliff</span>
              <p className="text-white">{formatDate(result.cliffDate)}</p>
            </div>
          )}
          <div>
            <span className="text-white/40">End</span>
            <p className="text-white">{formatDate(result.endDate)}</p>
          </div>
        </div>
      </div>

      {/* Beneficiary link */}
      <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-muted)] p-4 text-left">
        <p className="text-sm font-medium text-white mb-2 inline-flex items-center gap-1.5"><Mail size={14} /> Share with beneficiary</p>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <span className="flex-1 truncate font-mono text-xs text-white/70">{claimLink}</span>
          <button
            onClick={copy}
            className="flex-shrink-0 rounded p-1 text-white/40 hover:text-white transition-colors"
          >
            {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/40">
          Beneficiaries can track and claim vested tokens at this link.
        </p>
      </div>

      {/* Explorer */}
      <a
        href={`${LITVM_EXPLORER_URL}/tx/${result.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
      >
        View on Explorer <ExternalLink size={13} />
      </a>

      {/* Next step */}
      <div className="pt-2">
        <p className="mb-3 text-sm font-medium text-white/60">What&apos;s next?</p>
        <Link
          href="/airdrop"
          className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--accent)]"><Send size={20} /></span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white group-hover:text-white">
                Airdrop remaining tokens →
              </p>
              <p className="text-xs text-white/40">Distribute tokens to multiple wallets</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-white/30 group-hover:text-[var(--accent)] transition-colors" />
        </Link>
      </div>
    </div>
  )
}

// ─── Main Form ────────────────────────────────────────────────────────────────

const DEFAULT_FORM: FormState = {
  tokenAddress: '',
  beneficiary: '',
  totalAmount: '',
  revocable: false,
  vestingType: 'linear',
  startDate: '',
  cliffDate: '',
  endDate: '',
}

export function VestingForm() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [txPhase, setTxPhase] = useState<'approve' | 'create'>('approve')
  const [modalOpen, setModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()
  const [successResult, setSuccessResult] = useState<SuccessState | null>(null)
  const [tokenDecimals, setTokenDecimals] = useState<number | undefined>(undefined)

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const { writeContractAsync } = useWriteContract()

  const { data: receipt } = useWaitForTransactionReceipt({ hash: currentTxHash })

  // RP-003: Read vesting fee from contract
  const { data: vestingFee, isLoading: isFeeLoading } = useReadContract({
    address: VESTING_FACTORY_ADDRESS,
    abi: VESTING_FACTORY_ABI,
    functionName: 'vestingFee',
    query: {
      enabled: isValidContractAddress(VESTING_FACTORY_ADDRESS),
    },
  })

  const feeReady = vestingFee !== undefined && !isFeeLoading
  const feeDisplay = vestingFee ? formatEther(vestingFee) : '...'

  // Fetch actual token decimals on-chain (F-009)
  const { data: fetchedDecimals, isLoading: isDecimalsLoading } = useReadContract({
    address: isAddress(form.tokenAddress) ? (form.tokenAddress as `0x${string}`) : undefined,
    abi: ERC20_DECIMALS_ABI,
    functionName: 'decimals',
    query: {
      enabled: isAddress(form.tokenAddress),
    },
  })

  // Reset decimals when token address changes to prevent stale values
  useEffect(() => {
    setTokenDecimals(undefined)
  }, [form.tokenAddress])

  // Update tokenDecimals when fetched
  useEffect(() => {
    if (fetchedDecimals !== undefined) {
      setTokenDecimals(fetchedDecimals)
    }
  }, [fetchedDecimals])

  // Handle receipt when it comes back
  useEffect(() => {
    if (!receipt || !currentTxHash || txStatus !== 'pending') return

    if (txPhase === 'approve') {
      // Approval confirmed — move to create.
      // Clear currentTxHash first so this effect doesn't re-fire with the
      // stale approval receipt when txPhase changes (which is a dep here).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentTxHash(undefined)
      setModalOpen(false)
      setTxPhase('create')
    } else {
      // Create confirmed — parse vesting ID from logs using ABI-based decoding (F-010)
      // RP-007: Filter logs by factory address before decode, use undefined instead of placeholder
      let vestingId: string | undefined = undefined
      const factoryLogs = (receipt.logs || []).filter(
        (log) => log.address.toLowerCase() === VESTING_FACTORY_ADDRESS.toLowerCase()
      )
      for (const log of factoryLogs) {
        try {
          const decoded = decodeEventLog({
            abi: VESTING_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'VestingCreated' && 'vestingId' in decoded.args) {
            vestingId = decoded.args.vestingId.toString()
            break
          }
        } catch {
          // Not a matching event, continue
        }
      }
      // RP-007: If event not found, set error state
      if (vestingId === undefined) {
        setTxStatus('error')
        setTxMessage('Transaction mined but expected event was not decoded; verify on explorer')
        return
      }
      setTxStatus('success')
      setSuccessResult({
        vestingId,
        tokenAddress: form.tokenAddress,
        beneficiary: form.beneficiary,
        totalAmount: form.totalAmount,
        vestingType: form.vestingType,
        startDate: form.startDate,
        cliffDate: form.cliffDate,
        endDate: form.endDate,
        txHash: currentTxHash,
      })
    }
  }, [receipt, currentTxHash, txStatus, txPhase, form])

  const isWrongNetwork = isConnected && chainId !== litvm.id

  const handleApprove = async () => {
    if (tokenDecimals === undefined) return // Guard against stale decimals
    if (isWrongNetwork) {
      await switchChainAsync({ chainId: litvm.id })
      return
    }
    try {
      setModalOpen(true)
      setTxStatus('pending')
      setTxMessage('Approving token transfer…')

      // Use fetched token decimals (F-009)
      const amount = parseUnits(form.totalAmount, tokenDecimals)

      const hash = await writeContractAsync({
        address: form.tokenAddress as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [VESTING_FACTORY_ADDRESS, amount],
      })
      setCurrentTxHash(hash)
    } catch (err: unknown) {
      setTxStatus('error')
      setTxMessage(
        err instanceof Error
          ? err.message.includes('User rejected')
            ? 'Transaction was rejected.'
            : err.message.slice(0, 120)
          : 'An unexpected error occurred.',
      )
    }
  }

  const handleCreate = async () => {
    if (!feeReady) return // RP-003: Block submit until fee loaded
    if (isWrongNetwork) {
      await switchChainAsync({ chainId: litvm.id })
      return
    }
    if (tokenDecimals === undefined) return // Guard against stale decimals
    try {
      setModalOpen(true)
      setTxStatus('pending')
      setTxMessage('Creating vesting schedule…')

      // Use fetched token decimals (F-009)
      const amount = parseUnits(form.totalAmount, tokenDecimals)
      const startTs = toTimestamp(form.startDate)
      const endTs = toTimestamp(form.endDate)
      const cliffTs = form.vestingType === 'cliff_linear' ? toTimestamp(form.cliffDate) : startTs
      const cliffDuration = cliffTs - startTs
      const vestingDuration = endTs - startTs

      // Revocable parameter removed - not implemented in contract (F-011)
      const hash = await writeContractAsync({
        address: VESTING_FACTORY_ADDRESS,
        abi: VESTING_FACTORY_ABI,
        functionName: 'createVestingSchedule',
        args: [
          form.tokenAddress as `0x${string}`,
          form.beneficiary as `0x${string}`,
          amount,
          startTs,
          cliffDuration,
          vestingDuration,
          false, // revocable param — required for ABI selector match; ignored on-chain
        ],
        value: vestingFee!, // RP-003: Use live fee from contract
      })
      setCurrentTxHash(hash)
    } catch (err: unknown) {
      setTxStatus('error')
      setTxMessage(
        err instanceof Error
          ? err.message.includes('User rejected')
            ? 'Transaction was rejected.'
            : err.message.slice(0, 120)
          : 'An unexpected error occurred.',
      )
    }
  }

  const handleModalClose = () => {
    setModalOpen(false)
  }

  // Validation
  const isStep1Valid =
    isValidAddress(form.tokenAddress) &&
    isValidAddress(form.beneficiary) &&
    Number(form.totalAmount) > 0

  const isScheduleValid = (() => {
    if (!form.startDate || !form.endDate) return false
    if (new Date(form.endDate) <= new Date(form.startDate)) return false
    if (form.vestingType === 'cliff_linear') {
      if (!form.cliffDate) return false
      if (new Date(form.cliffDate) <= new Date(form.startDate)) return false
      if (new Date(form.endDate) <= new Date(form.cliffDate)) return false
    }
    return true
  })()

  const isContractConfigured = isValidContractAddress(VESTING_FACTORY_ADDRESS)
  // Decimals must be loaded before proceeding
  const decimalsReady = tokenDecimals !== undefined
  const canReview = isContractConfigured && decimalsReady && (form.vestingType === 'custom' ? isStep1Valid : isStep1Valid && isScheduleValid)

  // Show success panel when done
  if (successResult && !modalOpen) {
    return <SuccessPanel result={successResult} />
  }

  return (
    <div className="space-y-6">
      {step === 'form' ? (
        <>
          {/* ── Section 1: Token & Beneficiary ── */}
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-5">
            <h2 className="text-base font-semibold text-white">Token & Beneficiary</h2>

            <div>
              <Label helper="The token to be vested">Token Address</Label>
              <AddressInput
                value={form.tokenAddress}
                onChange={(v) => set('tokenAddress', v)}
                placeholder="0x… token contract"
              />
              {isValidAddress(form.tokenAddress) && (
                <p className={`text-xs mt-1 ${isDecimalsLoading ? 'text-blue-400' : tokenDecimals !== undefined ? 'text-green-400' : 'text-white/40'}`}>
                  {isDecimalsLoading
                    ? 'Reading token decimals...'
                    : tokenDecimals !== undefined
                    ? `Token decimals: ${tokenDecimals}`
                    : ''}
                </p>
              )}
            </div>

            <div>
              <Label helper="Who receives the vested tokens">Beneficiary Address</Label>
              <AddressInput
                value={form.beneficiary}
                onChange={(v) => set('beneficiary', v)}
                placeholder="0x… beneficiary wallet"
              />
            </div>

            <div>
              <Label helper="Total tokens to vest">Total Amount</Label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.totalAmount}
                onChange={(e) => set('totalAmount', e.target.value)}
                placeholder="e.g. 1000000"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
              />
            </div>

            {/* Revocable toggle removed (F-011) - revocable vesting not yet implemented in contract
               TODO: Re-add when VestingFactory supports revocable vesting schedules */}
          </div>

          {/* ── Section 2: Vesting Schedule ── */}
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-5">
            <h2 className="text-base font-semibold text-white">Vesting Schedule</h2>

            {/* Type selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <VestingTypeCard
                type="linear"
                selected={form.vestingType === 'linear'}
                onSelect={() => set('vestingType', 'linear')}
                icon={<Circle size={18} />}
                label="Linear"
                description="Tokens unlock gradually every block from start to end"
              />
              <VestingTypeCard
                type="cliff_linear"
                selected={form.vestingType === 'cliff_linear'}
                onSelect={() => set('vestingType', 'cliff_linear')}
                icon={<CircleAlert size={18} />}
                label="Cliff + Linear"
                description="Tokens locked until cliff date, then unlock linearly"
              />
              <VestingTypeCard
                type="custom"
                selected={form.vestingType === 'custom'}
                onSelect={() => set('vestingType', 'custom')}
                icon={<CircleDashed size={18} />}
                label="Custom Milestones"
                description="Milestone-based unlocks on specific dates"
              />
            </div>

            {/* Custom info banner */}
            {form.vestingType === 'custom' && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
                <p className="text-sm text-green-300">
                  Custom milestones available on request —{' '}
                  <a href="mailto:hello@lester-labs.com" className="underline hover:text-green-200">
                    contact us
                  </a>
                </p>
              </div>
            )}

            {/* Date inputs — Linear */}
            {form.vestingType === 'linear' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <input
                    type="date"
                    min={today}
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <input
                    type="date"
                    min={form.startDate || today}
                    value={form.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                </div>
              </div>
            )}

            {/* Date inputs — Cliff + Linear */}
            {form.vestingType === 'cliff_linear' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <input
                    type="date"
                    min={today}
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                </div>
                <div>
                  <Label helper="No tokens unlock before this date">Cliff Date</Label>
                  <input
                    type="date"
                    min={form.startDate || today}
                    value={form.cliffDate}
                    onChange={(e) => set('cliffDate', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <input
                    type="date"
                    min={form.cliffDate || form.startDate || today}
                    value={form.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                </div>
              </div>
            )}

            {/* Live timeline preview */}
            {form.vestingType !== 'custom' && isScheduleValid && (
              <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-4">
                <VestingTimeline
                  vestingType={form.vestingType}
                  startDate={form.startDate}
                  cliffDate={form.cliffDate}
                  endDate={form.endDate}
                />
              </div>
            )}
          </div>

          {/* Continue to review */}
          <div className="flex justify-end">
            <button
              onClick={() => setStep('review')}
              disabled={!canReview}
              className="rounded-lg bg-[var(--accent)] px-7 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Review & Deploy →
            </button>
          </div>
        </>
      ) : (
        /* ── Section 3: Review & Deploy ── */
        <div className="space-y-5">
          {/* Summary card */}
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Review Schedule</h2>
              <button
                onClick={() => setStep('form')}
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                ← Edit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-white/40 text-xs mb-0.5">Token</p>
                <p className="font-mono text-white">{shortAddr(form.tokenAddress)}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs mb-0.5">Beneficiary</p>
                <p className="font-mono text-white">{shortAddr(form.beneficiary)}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs mb-0.5">Total Amount</p>
                <p className="text-white">{form.totalAmount} tokens</p>
              </div>
              <div>
                <p className="text-white/40 text-xs mb-0.5">Type</p>
                <p className="text-white capitalize">
                  {form.vestingType === 'cliff_linear' ? 'Cliff + Linear' : form.vestingType}
                </p>
              </div>
              {form.vestingType !== 'custom' && (
                <>
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">Start</p>
                    <p className="text-white">{formatDate(form.startDate)}</p>
                  </div>
                  {form.vestingType === 'cliff_linear' && (
                    <div>
                      <p className="text-white/40 text-xs mb-0.5">Cliff</p>
                      <p className="text-amber-400">{formatDate(form.cliffDate)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">End</p>
                    <p className="text-white">{formatDate(form.endDate)}</p>
                  </div>
                </>
              )}
              {/* Revocable field removed (F-011) - not implemented in contract */}
            </div>

            {/* Timeline */}
            {form.vestingType !== 'custom' && isScheduleValid && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <VestingTimeline
                  vestingType={form.vestingType}
                  startDate={form.startDate}
                  cliffDate={form.cliffDate}
                  endDate={form.endDate}
                />
              </div>
            )}
          </div>

          {/* Fee (RP-003: live fee from contract) */}
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-4 flex items-center justify-between">
            <span className="text-sm text-white/60">Platform fee</span>
            <FeeDisplay feeLTC={parseFloat(feeDisplay) || 0.03} feeLabel="Fee" />
          </div>

          {/* Two-step deploy */}
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">Deploy</h2>
            <p className="text-sm text-white/50">
              Two transactions required: first approve the token transfer, then create the vesting
              schedule.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Step 1 — Approve */}
              <button
                onClick={handleApprove}
                disabled={txPhase !== 'approve'}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
                  txPhase === 'approve'
                    ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                    : 'bg-green-500/20 text-green-400 cursor-default'
                }`}
              >
                {txPhase !== 'approve' && <CheckCircle2 size={15} />}
                {txPhase === 'approve' ? '1. Approve Token' : '1. Approved'}
              </button>

              {/* Step 2 — Create (RP-003: disable until fee loaded) */}
              <button
                onClick={handleCreate}
                disabled={txPhase !== 'create' || !feeReady}
                className="flex-1 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isFeeLoading ? 'Loading fee…' : '2. Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TxStatusModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        status={txStatus}
        txHash={currentTxHash}
        message={txMessage}
        onRetry={
          txStatus === 'error'
            ? txPhase === 'approve'
              ? handleApprove
              : handleCreate
            : undefined
        }
      />
    </div>
  )
}

