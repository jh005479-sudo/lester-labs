'use client'

import { useState, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { litvm } from '@/config/chains'
import { parseUnits, isAddress, decodeEventLog, formatEther } from 'viem'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { FeeDisplay } from '@/components/shared/FeeDisplay'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { LockCertificate, type LockCertificateData } from './LockCertificate'
import {
  LIQUIDITY_LOCKER_ABI,
  LIQUIDITY_LOCKER_ADDRESS,
  ERC20_APPROVE_ABI,
} from '@/lib/contracts/liquidityLocker'
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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// ─── Duration helpers ──────────────────────────────────────────────────────

type DurationOption = '1m' | '3m' | '6m' | '1y' | '2y' | 'custom'

const DURATION_LABELS: Record<DurationOption, string> = {
  '1m': '1 Month',
  '3m': '3 Months',
  '6m': '6 Months',
  '1y': '1 Year',
  '2y': '2 Years',
  custom: 'Custom Date',
}

function addMonths(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d
}

function getUnlockDate(option: DurationOption, customDate: string): Date {
  switch (option) {
    case '1m': return addMonths(1)
    case '3m': return addMonths(3)
    case '6m': return addMonths(6)
    case '1y': return addMonths(12)
    case '2y': return addMonths(24)
    case 'custom': return customDate ? new Date(customDate) : addMonths(1)
  }
}

function tomorrowString(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// ─── Step indicator ────────────────────────────────────────────────────────

function ApproveStepIndicator({ approveStep }: { approveStep: 'approve' | 'lock' | 'done' }) {
  const steps = [
    { id: 'approve', label: 'Approve LP Token' },
    { id: 'lock', label: 'Lock Tokens' },
  ]

  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {steps.map((s, idx) => {
        const done = approveStep === 'done' || (approveStep === 'lock' && idx === 0)
        const active = approveStep === s.id

        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done
                    ? 'bg-green-500 text-white'
                    : active
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white/10 text-white/40'
                }`}
              >
                {done ? <CheckCircle2 size={16} /> : idx + 1}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium transition-colors ${
                  active ? 'text-white' : done ? 'text-green-400' : 'text-white/30'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`mx-3 mb-5 h-px w-16 sm:w-24 transition-colors ${
                  done ? 'bg-green-500' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Form field wrapper ────────────────────────────────────────────────────

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string
  helper?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white">{label}</label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-400">
          <AlertCircle size={11} />
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-[var(--text-muted)]">{helper}</p>
      ) : null}
    </div>
  )
}

// ─── Main form ─────────────────────────────────────────────────────────────

export function LockForm() {
  const { address: connectedAddress, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  // Form state
  const [lpToken, setLpToken] = useState('')
  const [amount, setAmount] = useState('')
  const [duration, setDuration] = useState<DurationOption>('1y')
  const [customDate, setCustomDate] = useState('')
  const [withdrawer, setWithdrawer] = useState('')
  const [lpDecimals, setLpDecimals] = useState<number | undefined>(undefined)

  // Populate withdrawer with wallet on connect
  useEffect(() => {
    if (connectedAddress && !withdrawer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWithdrawer(connectedAddress)
    }
  }, [connectedAddress, withdrawer])

  // Fetch actual LP token decimals on-chain (F-009)
  const { data: fetchedDecimals, isLoading: isDecimalsLoading } = useReadContract({
    address: isAddress(lpToken) ? (lpToken as `0x${string}`) : undefined,
    abi: ERC20_DECIMALS_ABI,
    functionName: 'decimals',
    query: {
      enabled: isAddress(lpToken),
    },
  })

  // Reset decimals when LP token address changes to prevent stale values
  useEffect(() => {
    setLpDecimals(undefined)
  }, [lpToken])

  // Update lpDecimals when fetched
  useEffect(() => {
    if (fetchedDecimals !== undefined) {
      setLpDecimals(fetchedDecimals)
    }
  }, [fetchedDecimals])

  // Tx / flow state
  const [approveStep, setApproveStep] = useState<'approve' | 'lock' | 'done'>('approve')
  const [approveConfirmed, setApproveConfirmed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()
  const [successData, setSuccessData] = useState<LockCertificateData | null>(null)
  const [inTwoStep, setInTwoStep] = useState(false) // show step indicator

  const { writeContractAsync } = useWriteContract()

  const { data: receipt } = useWaitForTransactionReceipt({ hash: currentTxHash })

  // Must check contract address validity before using in hooks
  const isContractConfigured = isValidContractAddress(LIQUIDITY_LOCKER_ADDRESS)

  // RP-003: Read lock fee from contract
  const { data: lockFee, isLoading: isFeeLoading } = useReadContract({
    address: LIQUIDITY_LOCKER_ADDRESS,
    abi: LIQUIDITY_LOCKER_ABI,
    functionName: 'lockFee',
    query: {
      enabled: isContractConfigured,
    },
  })

  const feeReady = lockFee !== undefined && !isFeeLoading
  const feeDisplay = lockFee ? formatEther(lockFee) : '...'

  // Handle receipt landing
  useEffect(() => {
    if (!receipt || !currentTxHash) return

    if (approveStep === 'approve') {
      // Approval confirmed
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalOpen(false)
      setApproveConfirmed(true)
      setApproveStep('lock')
      setCurrentTxHash(undefined)
    } else if (approveStep === 'lock') {
      // Lock confirmed — extract lockId from logs using ABI-based decoding (F-010)
      // RP-007: Filter logs by locker address before decode, use undefined instead of placeholder
      let lockId: string | undefined = undefined
      const lockerLogs = (receipt.logs || []).filter(
        (log) => log.address.toLowerCase() === LIQUIDITY_LOCKER_ADDRESS.toLowerCase()
      )
      for (const log of lockerLogs) {
        try {
          const decoded = decodeEventLog({
            abi: LIQUIDITY_LOCKER_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'LockCreated' && 'lockId' in decoded.args) {
            lockId = decoded.args.lockId.toString()
            break
          }
        } catch {
          // Not a matching event, continue
        }
      }
      // RP-007: If event not found, set error state
      if (lockId === undefined) {
        setTxStatus('error')
        setTxMessage('Transaction mined but expected event was not decoded; verify on explorer')
        return
      }
      const unlockDate = getUnlockDate(duration, customDate)

      setTxStatus('success')
      setSuccessData({
        lockId,
        lpToken,
        amount,
        unlockDate,
        withdrawer,
      })
    }
  }, [receipt, currentTxHash, approveStep, duration, customDate, lpToken, amount, withdrawer])

  // ── Validation ────────────────────────────────────────────────────────────

  const lpTokenError =
    lpToken && !isAddress(lpToken) ? 'Must be a valid 0x address' : undefined

  const amountError =
    amount && (isNaN(Number(amount)) || Number(amount) <= 0)
      ? 'Must be a positive number'
      : undefined

  // Zero withdrawer validation (F-012)
  const withdrawerError =
    withdrawer && !isAddress(withdrawer)
      ? 'Must be a valid 0x address'
      : withdrawer === ZERO_ADDRESS
      ? 'Withdrawer cannot be zero address'
      : undefined

  // Decimals must be loaded before submit
  const decimalsReady = lpDecimals !== undefined

  const canSubmit =
    isContractConfigured &&
    isAddress(lpToken) &&
    Number(amount) > 0 &&
    !amountError &&
    isAddress(withdrawer) &&
    withdrawer !== ZERO_ADDRESS &&
    !withdrawerError &&
    decimalsReady

  // ── Approve step ──────────────────────────────────────────────────────────

  const isWrongNetwork = isConnected && chainId !== litvm.id

  const handleApprove = async () => {
    if (lpDecimals === undefined) return // Guard against stale decimals
    if (isWrongNetwork) {
      try {
        await switchChainAsync({ chainId: litvm.id })
      } catch {
        setTxMessage('Wrong network. Please switch to LitVM Testnet (Chain 4441) in your wallet.')
        setModalOpen(true)
        setTxStatus('error')
      }
      return
    }
    try {
      setInTwoStep(true)
      setApproveStep('approve')
      setApproveConfirmed(false)
      setModalOpen(true)
      setTxStatus('pending')
      setTxMessage(undefined)

      // Use fetched LP token decimals (F-009)
      const amountBigInt = parseUnits(amount, lpDecimals)

      const hash = await writeContractAsync({
        address: lpToken as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [LIQUIDITY_LOCKER_ADDRESS, amountBigInt],
      })

      setCurrentTxHash(hash)
    } catch (err: unknown) {
      setTxStatus('error')
      setTxMessage(errMessage(err))
    }
  }

  // ── Lock step ─────────────────────────────────────────────────────────────

  const handleLock = async () => {
    if (!feeReady) return // RP-003: Block submit until fee loaded
    if (lpDecimals === undefined) return // Guard against stale decimals
    if (isWrongNetwork) {
      try {
        await switchChainAsync({ chainId: litvm.id })
      } catch {
        setTxMessage('Wrong network. Please switch to LitVM Testnet (Chain 4441) in your wallet.')
        setModalOpen(true)
        setTxStatus('error')
      }
      return
    }
    try {
      setApproveStep('lock')
      setModalOpen(true)
      setTxStatus('pending')
      setTxMessage(undefined)

      // Use fetched LP token decimals (F-009)
      const amountBigInt = parseUnits(amount, lpDecimals)
      const unlockDate = getUnlockDate(duration, customDate)
      const unlockTimestamp = BigInt(Math.floor(unlockDate.getTime() / 1000))

      const hash = await writeContractAsync({
        address: LIQUIDITY_LOCKER_ADDRESS,
        abi: LIQUIDITY_LOCKER_ABI,
        functionName: 'lockLiquidity',
        args: [
          lpToken as `0x${string}`,
          amountBigInt,
          unlockTimestamp,
          withdrawer as `0x${string}`,
        ],
        value: lockFee!, // RP-003: Use live fee from contract
      })

      setCurrentTxHash(hash)
    } catch (err: unknown) {
      setTxStatus('error')
      setTxMessage(errMessage(err))
    }
  }

  const handleModalClose = () => {
    setModalOpen(false)
  }

  const handleReset = () => {
    setLpToken('')
    setAmount('')
    setDuration('1y')
    setCustomDate('')
    setWithdrawer(connectedAddress ?? '')
    setApproveStep('approve')
    setApproveConfirmed(false)
    setInTwoStep(false)
    setSuccessData(null)
    setCurrentTxHash(undefined)
  }

  // ── Success ────────────────────────────────────────────────────────────────

  if (successData && !modalOpen) {
    return <LockCertificate data={successData} onReset={handleReset} />
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Two-step indicator (only after first submit) */}
      {inTwoStep && <ApproveStepIndicator approveStep={approveStep} />}

      {/* Approval confirmed banner */}
      {approveConfirmed && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <CheckCircle2 size={16} />
          Approval confirmed — now lock your tokens
        </div>
      )}

      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 sm:p-8 space-y-6">
        {/* LP Token Address */}
        <Field
          label="LP Token Address"
          helper="Paste your LP token contract address"
          error={lpTokenError}
        >
          <input
            type="text"
            placeholder="0x…"
            value={lpToken}
            onChange={(e) => setLpToken(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder-white/20 focus:border-[var(--accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
          />
          {isAddress(lpToken) && (
            <p className={`text-xs mt-1 ${isDecimalsLoading ? 'text-blue-400' : lpDecimals !== undefined ? 'text-green-400' : 'text-white/40'}`}>
              {isDecimalsLoading
                ? 'Reading token decimals...'
                : lpDecimals !== undefined
                ? `Token decimals: ${lpDecimals}`
                : ''}
            </p>
          )}
        </Field>

        {/* Amount */}
        <Field
          label="Amount to Lock"
          helper="How many LP tokens to lock"
          error={amountError}
        >
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0.00"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[var(--accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
            />
            <button
              type="button"
              title="Read balance (coming soon)"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/50 hover:border-white/20 hover:text-white/80 transition-colors"
            >
              Max
            </button>
          </div>
        </Field>

        {/* Lock Duration */}
        <Field label="Lock Duration">
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value as DurationOption)}
            className="w-full rounded-lg border border-white/10 bg-[var(--surface-2)] px-4 py-2.5 text-sm text-white focus:border-[var(--accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
          >
            {(Object.keys(DURATION_LABELS) as DurationOption[]).map((key) => (
              <option key={key} value={key}>
                {DURATION_LABELS[key]}
              </option>
            ))}
          </select>

          {duration === 'custom' && (
            <input
              type="date"
              min={tomorrowString()}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-[var(--accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
            />
          )}
        </Field>

        {/* Withdrawer Address */}
        <Field
          label="Withdrawer Address"
          helper="Who can withdraw after lock expires — defaults to your wallet"
          error={withdrawerError}
        >
          <input
            type="text"
            placeholder="0x…"
            value={withdrawer}
            onChange={(e) => setWithdrawer(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder-white/20 focus:border-[var(--accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
          />
        </Field>

        {/* Fee display (RP-003: live fee from contract) */}
        <div className="rounded-lg border border-white/5 bg-white/5 px-4 py-3">
          <FeeDisplay feeLTC={parseFloat(feeDisplay) || 0.03} feeLabel="Lock fee" />
        </div>

        {/* CTA */}
        {!approveConfirmed ? (
          <button
            onClick={handleApprove}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            Step 1: Approve LP Token →
          </button>
        ) : (
          <button
            onClick={handleLock}
            disabled={!feeReady}
            className="w-full rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Loader2 size={15} className="opacity-0 pointer-events-none" aria-hidden />
            {isFeeLoading ? 'Loading fee…' : 'Step 2: Lock Tokens'}
          </button>
        )}
      </div>

      <TxStatusModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        status={txStatus}
        txHash={currentTxHash}
        message={txMessage}
        onRetry={
          txStatus === 'error'
            ? approveStep === 'approve'
              ? handleApprove
              : handleLock
            : undefined
        }
      />
    </div>
  )
}

// ── Utils ─────────────────────────────────────────────────────────────────

function errMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('User rejected')) return 'Transaction was rejected.'
    return err.message.slice(0, 120)
  }
  return 'An unexpected error occurred.'
}

