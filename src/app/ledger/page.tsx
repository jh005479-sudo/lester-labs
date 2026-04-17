'use client'

import { useAccount, useReadContract } from 'wagmi'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { LedgerStats } from '@/components/ledger/LedgerStats'
import { MessageComposer } from '@/components/ledger/MessageComposer'
import { MessageFeed } from '@/components/ledger/MessageFeed'
import { ToolHero } from '@/components/shared/ToolHero'
import { LEDGER_ABI } from '@/config/abis'
import { LEDGER_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { useLedgerFeed } from '@/hooks/useLedgerFeed'
import { LEDGER_DEFAULT_FEE, formatLedgerFee } from '@/lib/contracts/ledger'
import { type Hex } from 'viem'

const LEDGER_COLOR = '#5E6AD2'

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

      <ToolHero
        category="On-chain social"
        title="The"
        titleHighlight="Ledger"
        subtitle="Leave your mark on the blockchain. Every message is fee-gated, permanent, and streamed back out of LitVM in real time."
        color={LEDGER_COLOR}
        compact
        stats={[
          { label: 'Current fee', value: `${formatLedgerFee(liveFee)} zkLTC` },
          { label: 'Messages', value: totalMessages.toLocaleString() },
          { label: 'Storage', value: 'Events only' },
          { label: 'Limit', value: '1024 bytes' },
        ]}
      />

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{ background: 'radial-gradient(circle at 15% 0%, rgba(94,106,210,0.16) 0%, transparent 55%)' }}
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          {!ledgerConfigured ? (
            <div
              className="rounded-[28px] border p-8"
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
      </div>
    </main>
  )
}
