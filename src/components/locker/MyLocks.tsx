'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useBytecode, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { ExternalLink, Lock, Search, ShieldCheck, TriangleAlert } from 'lucide-react'
import { formatUnits, keccak256 } from 'viem'
import { ERC20_ABI } from '@/config/abis'
import { litvm } from '@/config/chains'
import {
  LITVM_CURRENT_CONTRACTS,
  LIQUIDITY_LOCKER_RUNTIME_CODE_HASH,
  LITVM_LEGACY_LIQUIDITY_LOCKERS,
  type LitvmContractAddress,
} from '@/config/contracts'
import { useSafeWriteContract } from '@/hooks/useSafeWriteContract'
import { LIQUIDITY_LOCKER_ABI } from '@/lib/contracts/liquidityLocker'
import { LITVM_EXPLORER_URL } from '@/lib/explorerRpc'
import { getWalletErrorMessage } from '@/lib/walletErrors'
import { TxStatusModal } from '@/components/shared/TxStatusModal'

interface LockerRecoveryTarget {
  id: string
  label: string
  address: LitvmContractAddress
  status: 'current' | 'legacy-recovery-only'
  runtimeCodeHash: `0x${string}`
}

const LOCKER_RECOVERY_TARGETS: readonly LockerRecoveryTarget[] = Object.freeze([
  {
    id: 'current',
    label: 'Current source-pinned locker',
    address: LITVM_CURRENT_CONTRACTS.liquidityLocker,
    status: 'current',
    runtimeCodeHash: LIQUIDITY_LOCKER_RUNTIME_CODE_HASH,
  },
  ...LITVM_LEGACY_LIQUIDITY_LOCKERS.map((deployment) => ({
    id: deployment.id,
    label: `${deployment.label} — withdrawal only`,
    address: deployment.address,
    status: 'legacy-recovery-only' as const,
    runtimeCodeHash: deployment.runtimeCodeHash,
  })),
])

type LockRecord = readonly [
  lpToken: `0x${string}`,
  amount: bigint,
  unlockTime: bigint,
  withdrawer: `0x${string}`,
  withdrawn: boolean,
]

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function useUnixTimeSeconds(): bigint | null {
  const [unixTimeSeconds, setUnixTimeSeconds] = useState<bigint | null>(null)

  useEffect(() => {
    const updateTime = () => setUnixTimeSeconds(BigInt(Math.floor(Date.now() / 1000)))
    const initialTimer = window.setTimeout(updateTime, 0)
    const interval = window.setInterval(updateTime, 1000)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    }
  }, [])

  return unixTimeSeconds
}

export function MyLocks() {
  const { address: connectedAddress } = useAccount()
  const { ensureLitvmWrite, writeRecoveryContractAsync } = useSafeWriteContract()
  const [targetId, setTargetId] = useState(LOCKER_RECOVERY_TARGETS[0].id)
  const [lockIdInput, setLockIdInput] = useState('')
  const [lookupId, setLookupId] = useState<bigint | undefined>()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const unixTimeSeconds = useUnixTimeSeconds()
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const requested = LOCKER_RECOVERY_TARGETS.find((entry) => entry.address.toLowerCase() === query.get('contract')?.toLowerCase())
    const id = query.get('id')
    if (requested && id && /^(0|[1-9][0-9]{0,77})$/.test(id) && BigInt(id) < 2n ** 256n) {
      queueMicrotask(() => { setTargetId(requested.id); setLockIdInput(id); setLookupId(BigInt(id)) })
    }
  }, [])


  const target = useMemo(
    () => LOCKER_RECOVERY_TARGETS.find((candidate) => candidate.id === targetId) ?? LOCKER_RECOVERY_TARGETS[0],
    [targetId],
  )
  const { data: targetBytecode, isLoading: isRuntimeLoading } = useBytecode({
    address: target.address,
    chainId: litvm.id,
  })
  const targetRuntimeAttested = Boolean(
    targetBytecode &&
    targetBytecode !== '0x' &&
    keccak256(targetBytecode).toLowerCase() === target.runtimeCodeHash.toLowerCase(),
  )
  const {
    data: rawLock,
    isLoading,
    isError,
    refetch: refetchLock,
  } = useReadContract({
    address: target.address,
    abi: LIQUIDITY_LOCKER_ABI,
    functionName: 'getLock',
    args: lookupId === undefined ? undefined : [lookupId],
    chainId: litvm.id,
    query: { enabled: lookupId !== undefined },
  })
  const lock = rawLock as LockRecord | undefined
  const { data: tokenDecimals } = useReadContract({
    address: lock?.[0],
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId: litvm.id,
    query: { enabled: Boolean(lock) },
  })
  const { data: tokenSymbol } = useReadContract({
    address: lock?.[0],
    abi: ERC20_ABI,
    functionName: 'symbol',
    chainId: litvm.id,
    query: { enabled: Boolean(lock) },
  })
  const { data: receipt } = useWaitForTransactionReceipt({ hash: currentTxHash, chainId: litvm.id })

  const connectedIsWithdrawer = Boolean(
    connectedAddress && lock && connectedAddress.toLowerCase() === lock[3].toLowerCase(),
  )
  const unlocked = Boolean(lock && unixTimeSeconds !== null && lock[2] <= unixTimeSeconds)
  const displayDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
  const displaySymbol = typeof tokenSymbol === 'string' && tokenSymbol ? tokenSymbol : 'LP'

  useEffect(() => {
    if (!receipt || txStatus !== 'pending') return
    if (receipt.status === 'success') {
      setTxStatus('success')
      setTxMessage('The LP tokens were withdrawn to the lock’s source-pinned withdrawer.')
      void refetchLock()
    } else {
      setTxStatus('error')
      setTxMessage('The locker withdrawal reverted on-chain.')
    }
  }, [receipt, refetchLock, txStatus])

  const handleLookup = () => {
    try {
      if (!/^\d+$/.test(lockIdInput.trim())) return
      setLookupId(BigInt(lockIdInput.trim()))
      setCurrentTxHash(undefined)
    } catch {
      setLookupId(undefined)
    }
  }

  const handleWithdraw = async () => {
    if (lookupId === undefined || !targetRuntimeAttested || !lock || lock[4] || !unlocked || !connectedIsWithdrawer) return
    if (!(await ensureLitvmWrite({
      action: target.status === 'current' ? 'withdrawing an expired LP lock' : 'recovering an expired legacy LP lock',
      onError: (message) => {
        setModalOpen(true)
        setTxStatus('error')
        setTxMessage(message)
      },
    }))) return

    try {
      setModalOpen(true)
      setTxStatus('pending')
      setTxMessage(
        target.status === 'current'
          ? 'Submitting the locker withdrawal.'
          : 'Submitting a recovery-only legacy withdrawal. No approval, deposit, or native value is requested.',
      )
      const hash = await writeRecoveryContractAsync({
        address: target.address,
        abi: LIQUIDITY_LOCKER_ABI,
        functionName: 'withdraw',
        args: [lookupId],
      }, {
        kind: 'locker',
        sourceLocker: target.address,
        lockId: lookupId,
      })
      setCurrentTxHash(hash)
    } catch (error) {
      setTxStatus('error')
      setTxMessage(getWalletErrorMessage(error))
      setModalOpen(true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white">Lock Withdrawal & Legacy Recovery</h3>
          <p className="mt-1 text-sm text-white/50">
            Look up the lock on its source deployment. Retired lockers, when listed, expose withdrawal only and are never used for approvals or new deposits.
          </p>
        </div>

        <label className="block space-y-1.5 text-xs text-white/50">
          Locker deployment
          <select
            value={targetId}
            onChange={(event) => { setTargetId(event.target.value); setLookupId(undefined) }}
            className="w-full rounded-lg border border-white/10 bg-[var(--surface-2)] px-3 py-2.5 text-sm text-white outline-none"
          >
            {LOCKER_RECOVERY_TARGETS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
        </label>

        {target.status === 'legacy-recovery-only' && (
          <div className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            Recovery-only target: never approve LP tokens to this address and never create a new lock here.
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={lockIdInput}
            onChange={(event) => { setLockIdInput(event.target.value); setLookupId(undefined) }}
            onKeyDown={(event) => { if (event.key === 'Enter') handleLookup() }}
            placeholder="Lock ID (for example 42)"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]/50"
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={!/^\d+$/.test(lockIdInput.trim())}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search size={15} /> View lock
          </button>
        </div>
        <p className="break-all font-mono text-xs text-white/30">{target.address}</p>
        {isRuntimeLoading ? (
          <p className="text-xs text-white/40">Attesting exact locker runtime bytecode on LitVM…</p>
        ) : !targetRuntimeAttested ? (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
            Locker bytecode does not match the source-pinned recovery deployment. Withdrawal is blocked.
          </p>
        ) : (
          <p className="text-xs text-green-300">Exact locker runtime bytecode attested.</p>
        )}
      </div>

      {lookupId !== undefined && (
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-white/50">Reading lock #{lookupId.toString()} on LitVM…</p>
          ) : isError || !lock ? (
            <div className="flex gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              This lock ID was not found on the selected source-pinned deployment.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-green-300">
                <ShieldCheck size={16} /> On-chain lock #{lookupId.toString()}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-sm">
                  <p className="text-white/40">LP token</p>
                  <p className="mt-1 font-mono text-white">{shortAddress(lock[0])}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-sm">
                  <p className="text-white/40">Amount</p>
                  <p className="mt-1 text-white">{formatUnits(lock[1], displayDecimals)} {displaySymbol}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-sm">
                  <p className="text-white/40">Unlock time</p>
                  <p className="mt-1 text-white">{new Date(Number(lock[2]) * 1000).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-sm">
                  <p className="text-white/40">Withdrawer</p>
                  <p className="mt-1 font-mono text-white">{shortAddress(lock[3])}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={!targetRuntimeAttested || lock[4] || !unlocked || !connectedIsWithdrawer}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Lock size={14} />
                  {lock[4] ? 'Already withdrawn' : !unlocked ? 'Still locked' : 'Withdraw LP tokens'}
                </button>
                <a
                  href={`${LITVM_EXPLORER_URL}/address/${target.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/70"
                >
                  Explorer <ExternalLink size={14} />
                </a>
              </div>
              {!connectedIsWithdrawer && !lock[4] && (
                <p className="text-sm text-amber-200">Connect the exact on-chain withdrawer to enable recovery.</p>
              )}
              <p className="text-xs text-white/40">
                Withdrawal calls only <code>withdraw(lockId)</code> on the selected source deployment. Legacy targets cannot receive approvals or new deposits through this UI.
              </p>
            </>
          )}
        </div>
      )}

      {lookupId === undefined && (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <Lock size={28} className="mx-auto text-[var(--accent)]" />
          <p className="mt-3 text-sm text-white/50">Use the lock ID from the creation receipt or LockCreated explorer event.</p>
        </div>
      )}

      <TxStatusModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        status={txStatus}
        txHash={currentTxHash}
        message={txMessage}
        onRetry={txStatus === 'error' ? handleWithdraw : undefined}
      />
    </div>
  )
}
