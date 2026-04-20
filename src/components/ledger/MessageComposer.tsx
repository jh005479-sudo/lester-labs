'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWaitForTransactionReceipt, useWriteContract, useChainId, useSwitchChain } from 'wagmi'
import { litvm } from '@/config/chains'
import { ExternalLink, Loader2, PenLine, Wallet } from 'lucide-react'
import { toHex, type Hex } from 'viem'
import {
  LEDGER_ABI,
  LEDGER_DEFAULT_FEE,
  LEDGER_EXPLORER_BASE_URL,
  LEDGER_MAX_MESSAGE_BYTES,
  LEDGER_POST_GAS_LIMIT,
  formatLedgerFee,
} from '@/lib/contracts/ledger'

interface MessageComposerProps {
  address: `0x${string}`
  minFee?: bigint
  onConfirmed?: (txHash: Hex) => Promise<void> | void
}

type ComposerPhase = 'idle' | 'signing' | 'pending' | 'confirmed' | 'error'

const textEncoder = new TextEncoder()

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('User rejected')) {
      return 'Transaction was rejected in your wallet.'
    }

    if (error.message.includes('Transfer failed')) {
      return 'Posting is temporarily unavailable because the ledger treasury destination is rejecting payouts.'
    }

    return error.message
  }

  return 'Something went wrong while posting to The Ledger.'
}

export function MessageComposer({ address, minFee, onConfirmed }: MessageComposerProps) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [draft, setDraft] = useState('')
  const [phase, setPhase] = useState<ComposerPhase>('idle')
  const [currentTxHash, setCurrentTxHash] = useState<Hex | undefined>()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const handledReceiptHashRef = useRef<Hex | undefined>(undefined)

  const {
    isSuccess: isConfirmed,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: currentTxHash,
    query: {
      enabled: Boolean(currentTxHash),
    },
  })

  const byteLength = textEncoder.encode(draft).length
  const isEmpty = draft.trim().length === 0
  const isTooLong = byteLength > LEDGER_MAX_MESSAGE_BYTES
  const feeToPay = minFee ?? LEDGER_DEFAULT_FEE
  const feeDisplay = formatLedgerFee(feeToPay)

  const applyReceiptError = useEffectEvent((message: string) => {
    setPhase('error')
    setStatusMessage(message)
  })

  const applyReceiptSuccess = useEffectEvent((txHash: Hex) => {
    handledReceiptHashRef.current = txHash
    setPhase('confirmed')
    setStatusMessage('Your message is now part of the chain.')
    setDraft('')

    void Promise.resolve(onConfirmed?.(txHash)).catch(() => {
      // Feed hydration is best-effort and retried by the live feed.
    })
  })

  useEffect(() => {
    if (!isReceiptError || !receiptError) return
    applyReceiptError(normalizeError(receiptError))
  }, [isReceiptError, receiptError])

  useEffect(() => {
    if (!isConfirmed || !currentTxHash || handledReceiptHashRef.current === currentTxHash) return
    applyReceiptSuccess(currentTxHash)
  }, [currentTxHash, isConfirmed])

  const isWrongNetwork = isConnected && chainId !== litvm.id

  async function handlePost() {
    if (!isConnected || isEmpty || isTooLong) return
    if (isWrongNetwork) {
      try {
        await switchChainAsync({ chainId: litvm.id })
      } catch {
        setPhase('error')
        setStatusMessage('Wrong network. Please switch to LitVM Testnet (Chain 4441) in your wallet.')
      }
      return
    }

    try {
      setPhase('signing')
      setStatusMessage(null)

      const txHash = await writeContractAsync({
        address,
        abi: LEDGER_ABI,
        functionName: 'post',
        args: [toHex(textEncoder.encode(draft))],
        gas: LEDGER_POST_GAS_LIMIT,
        value: feeToPay,
      })

      handledReceiptHashRef.current = undefined
      setCurrentTxHash(txHash)
      setPhase('pending')
      setStatusMessage('Waiting for confirmation from LitVM...')
    } catch (postError) {
      setPhase('error')
      setStatusMessage(normalizeError(postError))
    }
  }

  const buttonDisabled = !isConnected || isEmpty || isTooLong || phase === 'signing' || phase === 'pending'

  return (
    <section
      className="analytics-card rounded-[28px] border p-6 sm:p-7"
      style={{
        background: 'linear-gradient(180deg, rgba(17,13,32,0.96) 0%, rgba(10,8,24,0.96) 100%)',
        borderColor: 'rgba(255,255,255,0.08)',

      }}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span
            className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em]"
            style={{
              color: '#8ea0ff',
              borderColor: 'rgba(94,106,210,0.28)',
              background: 'rgba(94,106,210,0.08)',
            }}
          >
            <PenLine size={12} />
            Write to chain
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">Message composer</h2>
          <p className="mt-2 max-w-xl text-sm leading-6" style={{ color: 'rgba(240,238,245,0.52)' }}>
            Every post is encoded into transaction calldata and surfaced back out of events. No off-chain storage, no edits, no deletes.
          </p>
        </div>

        <div
          className="analytics-card rounded-2xl border px-4 py-3 text-right"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(240,238,245,0.38)' }}>
            Current fee
          </div>
          <div className="mt-1 font-mono text-sm text-white">{feeDisplay} zkLTC</div>
        </div>
      </div>

      {!isConnected ? (
        <div
          className="rounded-[24px] border p-8 text-center"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.02) 100%)',
          }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(94,106,210,0.12)', color: '#aab5ff' }}
          >
            <Wallet size={24} />
          </div>
          <h3 className="text-lg font-semibold">Connect to post</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6" style={{ color: 'rgba(240,238,245,0.5)' }}>
            Wallet connection unlocks the fee-gated composer. Your message stays readable on-chain once it lands.
          </p>
          <div className="mt-6 flex justify-center">
            <ConnectButton />
          </div>
        </div>
      ) : (
        <>
          <label className="mb-3 block text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(240,238,245,0.4)' }}>
            Message body
          </label>
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              if (phase === 'confirmed' || phase === 'error') {
                setPhase('idle')
                setStatusMessage(null)
              }
            }}
            placeholder="Leave your mark on the blockchain..."
            className="min-h-[260px] w-full rounded-[24px] border px-5 py-4 text-sm leading-7 outline-none transition-colors sm:text-[15px]"
            style={{
              background: '#080613',
              borderColor: isTooLong ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.08)',
              boxShadow: isTooLong ? '0 0 0 1px rgba(248,113,113,0.18)' : 'none',
              color: '#f3f4fb',
              resize: 'vertical',
              fontFamily: 'var(--font-geist-mono), monospace',
            }}
          />

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <div
                className="font-mono text-sm"
                style={{ color: isTooLong ? 'var(--error)' : 'rgba(240,238,245,0.74)' }}
              >
                {byteLength} / {LEDGER_MAX_MESSAGE_BYTES} bytes
              </div>
              <p className="text-xs" style={{ color: 'rgba(240,238,245,0.38)' }}>
                UTF-8 byte limit applies. Whitespace-only messages are rejected.
              </p>
            </div>

            <button
              onClick={handlePost}
              disabled={buttonDisabled}
              className="cin-btn min-w-[260px] self-start disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {phase === 'signing' && (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Confirm in wallet
                </>
              )}
              {phase === 'pending' && (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Posting to The Ledger...
                </>
              )}
              {(phase === 'idle' || phase === 'confirmed' || phase === 'error') && (
                <>Post to The Ledger — {feeDisplay} zkLTC</>
              )}
            </button>
          </div>
        </>
      )}

      {(statusMessage || currentTxHash) && (
        <div
          className="mt-5 rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor:
              phase === 'error'
                ? 'rgba(248,113,113,0.24)'
                : phase === 'confirmed'
                  ? 'rgba(52,211,153,0.24)'
                  : 'rgba(94,106,210,0.24)',
            background:
              phase === 'error'
                ? 'rgba(248,113,113,0.08)'
                : phase === 'confirmed'
                  ? 'rgba(52,211,153,0.08)'
                  : 'rgba(94,106,210,0.08)',
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span
              style={{
                color:
                  phase === 'error'
                    ? '#fecaca'
                    : phase === 'confirmed'
                      ? '#bbf7d0'
                      : '#dbe2ff',
              }}
            >
              {statusMessage}
            </span>
            {currentTxHash && (
              <a
                href={`${LEDGER_EXPLORER_BASE_URL}/tx/${currentTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-white"
                style={{ color: '#cfd4ff' }}
              >
                View transaction
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
