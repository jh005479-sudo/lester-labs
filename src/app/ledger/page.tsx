'use client'

import { useAccount, useReadContract } from 'wagmi'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { LedgerStats } from '@/components/ledger/LedgerStats'
import { MessageComposer } from '@/components/ledger/MessageComposer'
import { MessageFeed } from '@/components/ledger/MessageFeed'
import { LEDGER_ABI } from '@/config/abis'
import { LEDGER_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { useLedgerFeed } from '@/hooks/useLedgerFeed'
import { LEDGER_DEFAULT_FEE, formatLedgerFee } from '@/lib/contracts/ledger'
import { type Hex } from 'viem'

export default function LedgerPage() {
  const { address: connectedAddress } = useAccount()
  const ledgerConfigured = isValidContractAddress(LEDGER_ADDRESS)

  const {
    data: messageCount,
    isError: isMessageCountError,
    refetch: refetchMessageCount,
  } = useReadContract({
    address: LEDGER_ADDRESS,
    abi: LEDGER_ABI,
    functionName: 'messageCount',
    query: {
      enabled: ledgerConfigured,
    },
  })

  const { data: minFee } = useReadContract({
    address: LEDGER_ADDRESS,
    abi: LEDGER_ABI,
    functionName: 'MIN_FEE',
    query: {
      enabled: ledgerConfigured,
    },
  })

  const messageCountValue = messageCount as bigint | undefined
  const minFeeValue = minFee as bigint | undefined

  const {
    messages,
    isLoadingInitial,
    isLoadingMore,
    hasMore,
    connectionMode,
    error,
    userPostCount,
    loadMore,
    ingestConfirmedTransaction,
  } = useLedgerFeed({
    address: LEDGER_ADDRESS,
    initializationReady: ledgerConfigured && (messageCountValue !== undefined || isMessageCountError),
    totalMessageCount: messageCountValue,
    viewerAddress: connectedAddress,
  })

  const highestKnownIndex = messages[0]?.index !== undefined ? messages[0].index + 1n : 0n
  const totalMessages = messageCountValue !== undefined && messageCountValue > highestKnownIndex ? messageCountValue : highestKnownIndex
  const liveFee = minFeeValue ?? LEDGER_DEFAULT_FEE

  async function handleComposerConfirmed(txHash: Hex) {
    await ingestConfirmedTransaction(txHash)
    await refetchMessageCount()
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <LTCBanner />
      <Navbar />

      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
            <p className="text-white/50 text-sm mt-1">Leave your mark on the blockchain. Every message is fee-gated, permanent,<br />and streamed from LitVM in real time.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[560px]">
            <div className="analytics-card rounded-lg border border-white/10 bg-[var(--surface-1)] px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-wider">Current Fee</p>
              <p className="text-sm font-semibold font-mono text-white mt-1">{formatLedgerFee(liveFee)} zkLTC</p>
            </div>
            <div className="analytics-card rounded-lg border border-white/10 bg-[var(--surface-1)] px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-wider">Messages</p>
              <p className="text-sm font-semibold font-mono text-white mt-1">{totalMessages.toLocaleString()}</p>
            </div>
            <div className="analytics-card rounded-lg border border-white/10 bg-[var(--surface-1)] px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-wider">Storage</p>
              <p className="text-sm font-semibold font-mono text-white mt-1">Events only</p>
            </div>
            <div className="analytics-card rounded-lg border border-white/10 bg-[var(--surface-1)] px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-wider">Limit</p>
              <p className="text-sm font-semibold font-mono text-white mt-1">1024 bytes</p>
            </div>
          </div>
        </div>

        {!ledgerConfigured ? (
            <div
              className="analytics-card rounded-[28px] border p-8"
              style={{
                background: 'linear-gradient(180deg, rgba(17,13,32,0.96) 0%, rgba(10,8,24,0.96) 100%)',
                borderColor: 'rgba(248,113,113,0.2)',
              }}
            >
              <h2 className="text-2xl font-semibold tracking-tight">Ledger address missing</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: 'rgba(240,238,245,0.52)' }}>
                Set <code>NEXT_PUBLIC_LEDGER_ADDRESS</code> to the deployed contract address before using this page.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <LedgerStats
                messageCount={totalMessages}
                userPostCount={userPostCount}
              />

              <div className="grid gap-6 xl:grid-cols-[minmax(0,420px),minmax(0,1fr)]">
                <MessageComposer
                  address={LEDGER_ADDRESS}
                  minFee={liveFee}
                  onConfirmed={handleComposerConfirmed}
                />

                <MessageFeed
                  connectionMode={connectionMode}
                  error={error}
                  hasMore={hasMore}
                  isLoadingInitial={isLoadingInitial}
                  isLoadingMore={isLoadingMore}
                  loadMore={loadMore}
                  messages={messages}
                />
              </div>
            </div>
          )}
      </div>
    </main>
  )
}
