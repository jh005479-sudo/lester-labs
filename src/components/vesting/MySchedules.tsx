'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTransactionReceipt } from '@wagmi/core'
import { Calendar, CheckCircle2, ExternalLink, Search, TriangleAlert } from 'lucide-react'
import { useAccount, useBytecode, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { decodeEventLog, formatUnits, isAddress, keccak256 } from 'viem'
import { ERC20_ABI } from '@/config/abis'
import { litvm } from '@/config/chains'
import {
  LITVM_CURRENT_CONTRACTS,
  LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION,
  LITVM_LEGACY_VESTING_FACTORIES,
  VESTING_FACTORY_RUNTIME_CODE_HASH,
  isCanonicalLitvmContract,
  type LitvmContractAddress,
  type RuntimeCodeHash,
  type VestingChildRuntimeAttestation,
} from '@/config/contracts'
import { wagmiConfig } from '@/config/wagmi'
import { useSafeWriteContract } from '@/hooks/useSafeWriteContract'
import { VESTING_FACTORY_ABI, VESTING_WALLET_RECOVERY_ABI } from '@/lib/contracts/tokenVesting'
import { LITVM_EXPLORER_URL } from '@/lib/explorerRpc'
import { getWalletErrorMessage } from '@/lib/walletErrors'
import { isAttestedVestingWalletRuntime } from '@/lib/vestingRuntimeAttestation'
import { TxStatusModal } from '@/components/shared/TxStatusModal'

interface ScheduleLookup {
  vestingWallet: `0x${string}`
  token: `0x${string}`
  expectedBeneficiary: `0x${string}`
  creationTxHash: `0x${string}`
  sourceFactory: LitvmContractAddress
}

interface VestingRecoveryTarget {
  id: string
  label: string
  address: LitvmContractAddress
  runtimeCodeHash: RuntimeCodeHash
  childRuntimeAttestation: VestingChildRuntimeAttestation
}

const VESTING_RECOVERY_TARGETS: readonly VestingRecoveryTarget[] = Object.freeze([
  {
    id: 'current',
    label: 'Pre-cutover VestingFactory — recovery only',
    address: LITVM_CURRENT_CONTRACTS.vestingFactory,
    runtimeCodeHash: VESTING_FACTORY_RUNTIME_CODE_HASH,
    childRuntimeAttestation: LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION,
  },
  ...LITVM_LEGACY_VESTING_FACTORIES.map((deployment) => ({
    id: deployment.id,
    label: `${deployment.label} — recovery only`,
    address: deployment.address,
    runtimeCodeHash: deployment.runtimeCodeHash,
    childRuntimeAttestation: {
      kind: 'exact-runtime-hashes' as const,
      runtimeCodeHashes: deployment.childRuntimeCodeHashes,
    },
  })),
])

const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function MySchedules() {
  const { address: connectedAddress } = useAccount()
  const { ensureLitvmWrite, writeRecoveryContractAsync } = useSafeWriteContract()
  const [walletInput, setWalletInput] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [creationTxInput, setCreationTxInput] = useState('')
  const [targetId, setTargetId] = useState(VESTING_RECOVERY_TARGETS[0].id)
  const [lookup, setLookup] = useState<ScheduleLookup | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false)
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()

  const target = useMemo(
    () => VESTING_RECOVERY_TARGETS.find((candidate) => candidate.id === targetId) ?? VESTING_RECOVERY_TARGETS[0],
    [targetId],
  )
  const { data: factoryBytecode, isLoading: isFactoryBytecodeLoading } = useBytecode({
    address: target.address,
    chainId: litvm.id,
  })
  const factoryRuntimeAttested = Boolean(
    factoryBytecode &&
    factoryBytecode !== '0x' &&
    keccak256(factoryBytecode).toLowerCase() === target.runtimeCodeHash.toLowerCase(),
  )
  const lookupEnabled = Boolean(lookup)
  const { data: bytecode, isLoading: isBytecodeLoading } = useBytecode({
    address: lookup?.vestingWallet,
    chainId: litvm.id,
    query: { enabled: lookupEnabled },
  })
  const { data: owner, isLoading: isOwnerLoading, isError: isOwnerError } = useReadContract({
    address: lookup?.vestingWallet,
    abi: VESTING_WALLET_RECOVERY_ABI,
    functionName: 'owner',
    chainId: litvm.id,
    query: { enabled: lookupEnabled },
  })
  const { data: start } = useReadContract({
    address: lookup?.vestingWallet,
    abi: VESTING_WALLET_RECOVERY_ABI,
    functionName: 'start',
    chainId: litvm.id,
    query: { enabled: lookupEnabled },
  })
  const { data: duration } = useReadContract({
    address: lookup?.vestingWallet,
    abi: VESTING_WALLET_RECOVERY_ABI,
    functionName: 'duration',
    chainId: litvm.id,
    query: { enabled: lookupEnabled },
  })
  const { data: releasable, refetch: refetchReleasable } = useReadContract({
    address: lookup?.vestingWallet,
    abi: VESTING_WALLET_RECOVERY_ABI,
    functionName: 'releasable',
    args: lookup ? [lookup.token] : undefined,
    chainId: litvm.id,
    query: { enabled: lookupEnabled },
  })
  const { data: released, refetch: refetchReleased } = useReadContract({
    address: lookup?.vestingWallet,
    abi: VESTING_WALLET_RECOVERY_ABI,
    functionName: 'released',
    args: lookup ? [lookup.token] : undefined,
    chainId: litvm.id,
    query: { enabled: lookupEnabled },
  })
  const { data: tokenDecimals } = useReadContract({
    address: lookup?.token,
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId: litvm.id,
    query: { enabled: lookupEnabled },
  })
  const { data: tokenSymbol } = useReadContract({
    address: lookup?.token,
    abi: ERC20_ABI,
    functionName: 'symbol',
    chainId: litvm.id,
    query: { enabled: lookupEnabled },
  })
  const { data: receipt } = useWaitForTransactionReceipt({ hash: currentTxHash, chainId: litvm.id })

  const childRuntimeAttested = isAttestedVestingWalletRuntime(bytecode, target.childRuntimeAttestation)
  const interfaceVerified = Boolean(
    factoryRuntimeAttested &&
    childRuntimeAttested &&
    owner &&
    lookup &&
    owner.toLowerCase() === lookup.expectedBeneficiary.toLowerCase() &&
    isCanonicalLitvmContract(lookup.sourceFactory, target.address) &&
    start !== undefined &&
    duration !== undefined &&
    releasable !== undefined,
  )
  const connectedIsBeneficiary = Boolean(
    connectedAddress && owner && connectedAddress.toLowerCase() === owner.toLowerCase(),
  )
  const displayDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
  const displaySymbol = typeof tokenSymbol === 'string' && tokenSymbol ? tokenSymbol : 'tokens'
  const releaseDisplay = releasable === undefined ? '—' : formatUnits(releasable, displayDecimals)
  const releasedDisplay = released === undefined ? '—' : formatUnits(released, displayDecimals)
  const endTimestamp = useMemo(
    () => start === undefined || duration === undefined ? null : start + duration,
    [duration, start],
  )

  useEffect(() => {
    if (!receipt || txStatus !== 'pending') return
    if (receipt.status === 'success') {
      setTxStatus('success')
      setTxMessage('Vested tokens were released directly from the VestingWallet to its on-chain owner.')
      void refetchReleasable()
      void refetchReleased()
    } else {
      setTxStatus('error')
      setTxMessage('The VestingWallet release transaction reverted.')
    }
  }, [receipt, refetchReleasable, refetchReleased, txStatus])

  const handleLookup = async () => {
    if (!isAddress(walletInput) || !isAddress(tokenInput) || !TRANSACTION_HASH_PATTERN.test(creationTxInput)) return
    if (!factoryRuntimeAttested) {
      setLookup(null)
      setLookupError('The selected VestingFactory runtime bytecode does not match the source-pinned recovery deployment.')
      return
    }

    setIsVerifyingReceipt(true)
    setLookupError(null)
    try {
      const creationTxHash = creationTxInput as `0x${string}`
      const receipt = await getTransactionReceipt(wagmiConfig, { hash: creationTxHash, chainId: litvm.id })
      if (receipt.status !== 'success' || !isCanonicalLitvmContract(receipt.to ?? undefined, target.address)) {
        throw new Error('The transaction is not a successful call to the selected source-pinned VestingFactory.')
      }

      let expectedBeneficiary: `0x${string}` | undefined
      for (const log of receipt.logs) {
        if (!isCanonicalLitvmContract(log.address, target.address)) continue
        try {
          const decoded = decodeEventLog({
            abi: VESTING_FACTORY_ABI,
            eventName: 'VestingCreated',
            data: log.data,
            topics: log.topics,
            strict: true,
          })
          if (decoded.args.vestingWallet.toLowerCase() === walletInput.toLowerCase()) {
            expectedBeneficiary = decoded.args.beneficiary
            break
          }
        } catch {
          // Other factory events in the receipt are not provenance evidence.
        }
      }
      if (!expectedBeneficiary) {
        throw new Error('The receipt does not contain a matching VestingCreated event for this child address.')
      }

      setLookup({
        vestingWallet: walletInput as `0x${string}`,
        token: tokenInput as `0x${string}`,
        expectedBeneficiary,
        creationTxHash,
        sourceFactory: target.address,
      })
      setCurrentTxHash(undefined)
    } catch (error) {
      setLookup(null)
      setLookupError(error instanceof Error ? error.message : 'Unable to verify the vesting creation receipt.')
    } finally {
      setIsVerifyingReceipt(false)
    }
  }

  const handleRelease = async () => {
    if (!lookup || !factoryRuntimeAttested || !interfaceVerified || !connectedIsBeneficiary || !releasable || releasable === 0n) return
    if (!(await ensureLitvmWrite({
      action: 'releasing vested tokens from a VestingWallet',
      onError: (message) => {
        setTxStatus('error')
        setTxMessage(message)
        setModalOpen(true)
      },
    }))) return

    try {
      setModalOpen(true)
      setTxStatus('pending')
      setTxMessage('Submitting a recovery-only release call. No token approval or native value is requested.')
      const hash = await writeRecoveryContractAsync({
        address: lookup.vestingWallet,
        abi: VESTING_WALLET_RECOVERY_ABI,
        functionName: 'release',
        args: [lookup.token],
      }, {
        kind: 'vesting-wallet',
        sourceFactory: lookup.sourceFactory,
        child: lookup.vestingWallet,
        creationTxHash: lookup.creationTxHash,
        beneficiary: lookup.expectedBeneficiary,
        token: lookup.token,
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
          <h3 className="text-base font-semibold text-white">Direct VestingWallet Recovery</h3>
          <p className="mt-1 text-sm text-white/50">
            Vesting wallets are independent child contracts. Recovery requires the exact factory receipt so the child address, beneficiary, factory bytecode, and historical child bytecode generation can all be attested before release.
          </p>
        </div>
        <label className="block space-y-1.5 text-xs text-white/50">
          Source VestingFactory
          <select
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value)
              setLookup(null)
              setLookupError(null)
            }}
            className="w-full rounded-lg border border-white/10 bg-[var(--surface-2)] px-3 py-2.5 text-sm text-white outline-none"
          >
            {VESTING_RECOVERY_TARGETS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs text-white/50">
            VestingWallet child address
            <input
              value={walletInput}
              onChange={(event) => { setWalletInput(event.target.value.trim()); setLookup(null); setLookupError(null) }}
              placeholder="0x…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-[var(--accent)]/50"
            />
          </label>
          <label className="space-y-1.5 text-xs text-white/50">
            Vested token address
            <input
              value={tokenInput}
              onChange={(event) => { setTokenInput(event.target.value.trim()); setLookup(null); setLookupError(null) }}
              placeholder="0x…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-[var(--accent)]/50"
            />
          </label>
        </div>
        <label className="block space-y-1.5 text-xs text-white/50">
          Vesting creation transaction hash
          <input
            value={creationTxInput}
            onChange={(event) => { setCreationTxInput(event.target.value.trim()); setLookup(null); setLookupError(null) }}
            placeholder="0x…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-[var(--accent)]/50"
          />
        </label>
        {isFactoryBytecodeLoading ? (
          <p className="text-xs text-white/40">Attesting exact VestingFactory bytecode on LitVM…</p>
        ) : !factoryRuntimeAttested ? (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
            The selected factory runtime does not match its source-pinned recovery hash. Verification and release are blocked.
          </p>
        ) : (
          <p className="text-xs text-green-300">Exact VestingFactory runtime bytecode attested.</p>
        )}
        {lookupError && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">{lookupError}</p>
        )}
        <button
          type="button"
          onClick={() => { void handleLookup() }}
          disabled={
            isVerifyingReceipt ||
            !factoryRuntimeAttested ||
            !isAddress(walletInput) ||
            !isAddress(tokenInput) ||
            !TRANSACTION_HASH_PATTERN.test(creationTxInput)
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Search size={15} /> {isVerifyingReceipt ? 'Verifying receipt…' : 'Verify child and receipt'}
        </button>
      </div>

      {lookup && (
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-4">
          {isBytecodeLoading || isOwnerLoading ? (
            <p className="text-sm text-white/50">Verifying the child contract on LitVM…</p>
          ) : !interfaceVerified || isOwnerError ? (
            <div className="flex gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              Factory provenance, beneficiary, exact historical child bytecode, or VestingWallet recovery reads did not match. Release is blocked.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-green-300">
                <CheckCircle2 size={16} /> Factory receipt, beneficiary, child bytecode, and recovery reads verified on LitVM
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-sm">
                  <p className="text-white/40">Beneficiary / owner</p>
                  <p className="mt-1 font-mono text-white">{owner ? shortAddress(owner) : '—'}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-sm">
                  <p className="text-white/40">Schedule end</p>
                  <p className="mt-1 text-white">{endTimestamp === null ? '—' : new Date(Number(endTimestamp) * 1000).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-sm">
                  <p className="text-white/40">Releasable now</p>
                  <p className="mt-1 text-white">{releaseDisplay} {displaySymbol}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-sm">
                  <p className="text-white/40">Previously released</p>
                  <p className="mt-1 text-white">{releasedDisplay} {displaySymbol}</p>
                </div>
              </div>
              {!connectedIsBeneficiary && (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
                  Connect the VestingWallet owner shown above to use the recovery button. Tokens always go to that on-chain owner.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRelease}
                  disabled={!connectedIsBeneficiary || !releasable || releasable === 0n}
                  className="min-h-11 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Release vested tokens
                </button>
                <a
                  href={`${LITVM_EXPLORER_URL}/address/${lookup.vestingWallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/70"
                >
                  Explorer <ExternalLink size={14} />
                </a>
              </div>
              <p className="text-xs text-white/40">
                Recovery calls only <code>release(token)</code> on the attested child. It never requests an approval, never sends native value, and never writes to the original factory. Creation receipt: <a className="underline" href={`${LITVM_EXPLORER_URL}/tx/${lookup.creationTxHash}`} target="_blank" rel="noopener noreferrer">view transaction</a>.
              </p>
            </>
          )}
        </div>
      )}

      {!lookup && (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <Calendar size={28} className="mx-auto text-[var(--accent)]" />
          <p className="mt-3 text-sm text-white/50">Use the VestingWallet, token, and exact creation transaction recorded by the source-pinned VestingFactory.</p>
        </div>
      )}

      <TxStatusModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        status={txStatus}
        txHash={currentTxHash}
        message={txMessage}
        onRetry={txStatus === 'error' ? handleRelease : undefined}
      />
    </div>
  )
}
