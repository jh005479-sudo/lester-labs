'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { litvm } from '@/config/chains'
import { waitForTransactionReceipt } from '@wagmi/core'
import { isAddress, parseUnits } from 'viem'
import { LITVM_EXPLORER_URL } from '@/lib/explorerRpc'
import { CheckCircle2, Coins, Download, ExternalLink, Loader2, Send, TriangleAlert, Zap } from 'lucide-react'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { RecipientInput } from './RecipientInput'
import { RecipientTable, type Recipient } from './RecipientTable'
import {
  DISPERSE_ABI,
  ERC20_APPROVE_ABI,
  DISPERSE_ADDRESS,
} from '@/lib/contracts/airdrop'
import { isValidContractAddress } from '@/config/contracts'
import { wagmiConfig } from '@/config/wagmi'

// ABI for fetching token decimals
const ERC20_DECIMALS_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

const BATCH_SIZE = 200

type Mode = 'token' | 'native'

interface BatchResult {
  txHash: string
  recipients: Recipient[]
}

interface SuccessState {
  batches: BatchResult[]
  totalRecipients: number
  totalAmount: string
  symbol: string
}

function downloadReport(success: SuccessState) {
  const lines = ['address,amount,txHash']
  for (const batch of success.batches) {
    for (const r of batch.recipients) {
      lines.push(`${r.address},${r.amount},${batch.txHash}`)
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'airdrop-report.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function SuccessPanel({ success, onReset }: { success: SuccessState; onReset: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center"><Send size={40} className="text-[var(--accent)]" /></div>
      <div>
        <h2 className="text-2xl font-bold text-white inline-flex items-center gap-2"><CheckCircle2 size={22} className="text-green-400" />Airdrop complete!</h2>
        <p className="mt-2 text-white/60">
          Successfully reached{' '}
          <span className="font-semibold text-white">{success.totalRecipients}</span> recipients
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Total sent</span>
          <span className="font-semibold text-white">
            {success.totalAmount} {success.symbol}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Recipients</span>
          <span className="font-semibold text-white">{success.totalRecipients}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Batches</span>
          <span className="font-semibold text-white">{success.batches.length}</span>
        </div>
      </div>

      {/* Tx links */}
      <div className="space-y-2">
        {success.batches.map((batch, i) => (
          <a
            key={i}
            href={`${LITVM_EXPLORER_URL}/tx/${batch.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
          >
            {success.batches.length > 1 ? `Batch ${i + 1} transaction` : 'View transaction'}{' '}
            <ExternalLink size={12} />
          </a>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => downloadReport(success)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
        >
          <Download size={14} />
          Download Report
        </button>
        <button
          onClick={onReset}
          className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          New Airdrop
        </button>
      </div>
    </div>
  )
}

export function AirdropForm() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  const [mode, setMode] = useState<Mode>('token')
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokenDecimals, setTokenDecimals] = useState<number | undefined>(undefined)
  const [recipients, setRecipients] = useState<Recipient[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()
  const [successState, setSuccessState] = useState<SuccessState | null>(null)

  const isWrongNetwork = isConnected && chainId !== litvm.id

  const { writeContractAsync } = useWriteContract()
  const { data: receipt } = useWaitForTransactionReceipt({ hash: currentTxHash })
  void receipt // used as dependency for re-renders

  // Fetch actual token decimals on-chain (F-009 fix)
  const { data: fetchedDecimals, isLoading: isDecimalsLoading } = useReadContract({
    address: isAddress(tokenAddress) ? (tokenAddress as `0x${string}`) : undefined,
    abi: ERC20_DECIMALS_ABI,
    functionName: 'decimals',
    query: {
      enabled: mode === 'token' && isAddress(tokenAddress),
    },
  })

  // Reset decimals when token address changes to prevent stale values
  useEffect(() => {
    setTokenDecimals(undefined)
  }, [tokenAddress])

  // Update tokenDecimals when fetched
  useEffect(() => {
    if (fetchedDecimals !== undefined) {
      setTokenDecimals(fetchedDecimals)
    }
  }, [fetchedDecimals])

  const validRecipients = recipients.filter(
    (r) => isAddress(r.address) && !isNaN(parseFloat(r.amount)) && parseFloat(r.amount) > 0,
  )

  // RP-002: Build parsedRecipients with precomputed wei values (bigint)
  // This ensures approval amount is computed deterministically from bigint, never from float
  // Guard: only build if decimals are loaded for token mode
  const parsedRecipients = (mode === 'token' && tokenDecimals === undefined)
    ? []
    : validRecipients.map((r) => ({
        addr: r.address as `0x${string}`,
        wei: parseUnits(r.amount, tokenDecimals ?? 18),
        displayAmount: r.amount,
      }))

  // RP-002: totalAmountWei computed from bigint reduce - never from parseFloat
  const totalAmountWei = parsedRecipients.reduce((a, r) => a + r.wei, 0n)

  // Float used ONLY for UI display (RP-002)
  const totalAmount = validRecipients.reduce((sum, r) => sum + parseFloat(r.amount), 0)
  const batchCount = Math.ceil(validRecipients.length / BATCH_SIZE)

  const tokenAddressValid = mode === 'native' || isAddress(tokenAddress)
  const isContractConfigured = isValidContractAddress(DISPERSE_ADDRESS)
  // For token mode, decimals must be loaded before submit
  const decimalsReady = mode === 'native' || tokenDecimals !== undefined

  const canSubmit =
    isConnected &&
    isContractConfigured &&
    validRecipients.length > 0 &&
    tokenAddressValid &&
    totalAmount > 0 &&
    decimalsReady

  const handleSend = useCallback(async () => {
    if (!canSubmit) return
    if (isWrongNetwork) {
      await switchChainAsync({ chainId: litvm.id })
      return
    }

    setModalOpen(true)
    setTxStatus('pending')
    setTxMessage(undefined)

    const batches: Recipient[][] = []
    for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
      batches.push(validRecipients.slice(i, i + BATCH_SIZE))
    }

    const batchResults: BatchResult[] = []

    try {
      if (mode === 'token') {
        // Step 1: Approve — must be CONFIRMED before dispersing
        // RP-002: Use precomputed totalAmountWei (bigint) directly - never derive from float
        setTxMessage('Step 1 of 2: Approving token spend…')

        const approveHash = await writeContractAsync({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [DISPERSE_ADDRESS, totalAmountWei], // RP-002: bigint directly
        })
        setCurrentTxHash(approveHash)

        // Wait for approval to be mined before dispersing
        setTxMessage('Waiting for approval confirmation…')
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash })
        setTxMessage('Step 2 of 2: Sending airdrop…')

        // Step 2: Disperse in batches — wait for each receipt before marking complete (F-007)
        // RP-002: Use precomputed wei values per recipient in batch sends
        const parsedBatches: typeof parsedRecipients[] = []
        for (let i = 0; i < parsedRecipients.length; i += BATCH_SIZE) {
          parsedBatches.push(parsedRecipients.slice(i, i + BATCH_SIZE))
        }

        for (let b = 0; b < parsedBatches.length; b++) {
          const parsedBatch = parsedBatches[b]
          const batch = batches[b]
          if (parsedBatches.length > 1) {
            setTxMessage(`Sending batch ${b + 1} of ${parsedBatches.length}…`)
          }

          // RP-002: Use precomputed wei values instead of recomputing parseUnits
          const addrs = parsedBatch.map((r) => r.addr)
          const vals = parsedBatch.map((r) => r.wei)

          const hash = await writeContractAsync({
            address: DISPERSE_ADDRESS,
            abi: DISPERSE_ABI,
            functionName: 'disperseToken',
            args: [tokenAddress as `0x${string}`, addrs, vals],
          })

          setCurrentTxHash(hash)
          // Wait for batch receipt confirmation before proceeding
          setTxMessage(`Confirming batch ${b + 1} of ${parsedBatches.length}…`)
          const batchReceipt = await waitForTransactionReceipt(wagmiConfig, { hash })
          if (batchReceipt.status !== 'success') {
            throw new Error(`Batch ${b + 1} failed on-chain`)
          }
          batchResults.push({ txHash: hash, recipients: batch })
        }
      } else {
        // zkLTC native — single or batched disperseEther
        // Note: Platform fee removed from UI (F-008) - fee not enforceable in Disperse contract
        for (let b = 0; b < batches.length; b++) {
          const batch = batches[b]
          if (batches.length > 1) {
            setTxMessage(`Sending batch ${b + 1} of ${batches.length}…`)
          }

          const addrs = batch.map((r) => r.address as `0x${string}`)
          const vals = batch.map((r) => parseUnits(r.amount, 18))
          const batchTotal = vals.reduce((a, v) => a + v, BigInt(0))

          const hash = await writeContractAsync({
            address: DISPERSE_ADDRESS,
            abi: DISPERSE_ABI,
            functionName: 'disperseEther',
            args: [addrs, vals],
            value: batchTotal, // Fee removed - not enforceable in contract (F-008)
          })

          setCurrentTxHash(hash)
          // Wait for batch receipt confirmation before proceeding
          setTxMessage(`Confirming batch ${b + 1} of ${batches.length}…`)
          const batchReceipt = await waitForTransactionReceipt(wagmiConfig, { hash })
          if (batchReceipt.status !== 'success') {
            throw new Error(`Batch ${b + 1} failed on-chain`)
          }
          batchResults.push({ txHash: hash, recipients: batch })
        }
      }

      // Only set success after ALL batch receipts confirm (F-007)
      setTxStatus('success')
      setTxMessage(undefined)
      setSuccessState({
        batches: batchResults,
        totalRecipients: validRecipients.length,
        totalAmount: totalAmount.toString(),
        symbol: mode === 'native' ? 'zkLTC' : 'tokens',
      })
    } catch (err: unknown) {
      setTxStatus('error')
      const msg =
        err instanceof Error
          ? err.message.includes('User rejected')
            ? 'Transaction was rejected.'
            : err.message.slice(0, 140)
          : 'An unexpected error occurred.'
      setTxMessage(msg)
    }
  }, [canSubmit, mode, tokenAddress, tokenDecimals, validRecipients, totalAmount, totalAmountWei, parsedRecipients, writeContractAsync])

  const handleReset = () => {
    setSuccessState(null)
    setTokenAddress('')
    setRecipients([])
    setCurrentTxHash(undefined)
    setModalOpen(false)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    // Success state is shown inline
  }

  if (!isConnected) return <ConnectWalletPrompt />

  if (successState && !modalOpen) {
    return (
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 sm:p-8">
        <SuccessPanel success={successState} onReset={handleReset} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        {(
          [
            { value: 'token' as Mode, label: 'Token Airdrop', sub: 'ERC-20', icon: <Coins size={14} /> },
            { value: 'native' as Mode, label: 'zkLTC Airdrop', sub: 'Native', icon: <Zap size={14} /> },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setMode(opt.value)
              setRecipients([])
            }}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
              mode === opt.value
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-white'
                : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">{opt.icon}{opt.label}</span>
            <span className="text-[10px] font-normal opacity-60">{opt.sub}</span>
          </button>
        ))}
      </div>

      {/* F-013: ETH Airdrop EOA-only warning */}
      {mode === 'native' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium text-amber-400 mb-1 inline-flex items-center gap-1.5">
            <TriangleAlert size={14} /> ETH Airdrop — EOA Wallets Only
          </p>
          <p className="text-xs text-amber-300/80">
            Native ETH dispersal uses a gas-limited transfer. Sending to smart contract addresses
            (multisigs, contract wallets) will cause the transaction to fail. ERC-20 token airdrops
            are not affected.
          </p>
        </div>
      )}

      {/* Main card */}
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 sm:p-8 space-y-8">
        {/* Step 1 — Token (only for ERC-20 mode) */}
        {mode === 'token' && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                1
              </span>
              <h2 className="text-base font-semibold text-white">Select Token</h2>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60">Token Contract Address</label>
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value.trim())}
                placeholder="0x..."
                className={`w-full rounded-lg border px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none transition-colors ${
                  tokenAddress && !isAddress(tokenAddress)
                    ? 'border-red-500/50 bg-red-500/10 focus:border-red-500'
                    : 'border-white/10 bg-white/5 focus:border-[var(--accent)]/50'
                }`}
              />
              {tokenAddress && !isAddress(tokenAddress) && (
                <p className="text-xs text-red-400">Invalid address format</p>
              )}
              {isAddress(tokenAddress) && (
                <p className={`text-xs ${isDecimalsLoading ? 'text-blue-400' : tokenDecimals !== undefined ? 'text-green-400' : 'text-white/40'}`}>
                  {isDecimalsLoading
                    ? 'Reading token decimals...'
                    : tokenDecimals !== undefined
                    ? `Token decimals: ${tokenDecimals}`
                    : ''}
                </p>
              )}
              {address && (
                <p className="text-xs text-white/30">
                  Connected wallet: <span className="font-mono">{address}</span>
                </p>
              )}
            </div>
          </section>
        )}

        {/* Step 2 — Recipients */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
              {mode === 'token' ? '2' : '1'}
            </span>
            <h2 className="text-base font-semibold text-white">Recipients</h2>
          </div>

          <RecipientInput onChange={setRecipients} />

          {recipients.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Preview
                </p>
                <p className="text-xs text-white/40">
                  {validRecipients.length} valid / {recipients.length} total
                </p>
              </div>
              <RecipientTable
                recipients={recipients}
                tokenSymbol={mode === 'native' ? 'zkLTC' : 'tokens'}
              />
            </div>
          )}
        </section>

        {/* Step 3 — Review & Send */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
              {mode === 'token' ? '3' : '2'}
            </span>
            <h2 className="text-base font-semibold text-white">Review & Send</h2>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Recipients</span>
              <span className="font-medium text-white">{validRecipients.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Total to send</span>
              <span className="font-medium text-white">
                {totalAmount > 0 ? totalAmount.toLocaleString() : '—'}{' '}
                {mode === 'native' ? 'zkLTC' : 'tokens'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Batches</span>
              <span className="font-medium text-white">
                {batchCount > 0 ? batchCount : '—'}
                {batchCount > 1 && (
                  <span className="ml-1.5 text-xs text-yellow-400">
                    (≤{BATCH_SIZE} recipients per batch)
                  </span>
                )}
              </span>
            </div>
            {/* Platform fee UI removed (F-008) - fee not enforceable in Disperse contract
               TODO: Re-add when contract-level fee enforcement is implemented */}
            {mode === 'token' && (
              <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-300">
                Two-step flow: you&apos;ll first approve the token spend, then confirm the airdrop transaction.
              </div>
            )}
          </div>

          {batchCount > 1 && (
            <div className="flex items-center gap-2 text-xs text-yellow-400">
              <TriangleAlert size={14} />
              Will send in {batchCount} batches ({batchCount} transactions total)
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {txStatus === 'pending' && modalOpen ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                {mode === 'token' ? 'Approve & Airdrop Tokens' : 'Send zkLTC Airdrop'}
              </>
            )}
          </button>

          {!tokenAddressValid && mode === 'token' && (
            <p className="text-center text-xs text-red-400">Enter a valid token contract address to continue</p>
          )}
          {validRecipients.length === 0 && recipients.length > 0 && (
            <p className="text-center text-xs text-red-400">No valid recipients found — check your input</p>
          )}
        </section>
      </div>

      <TxStatusModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        status={txStatus}
        txHash={currentTxHash}
        message={txMessage}
        onRetry={txStatus === 'error' ? handleSend : undefined}
      />
    </div>
  )
}

