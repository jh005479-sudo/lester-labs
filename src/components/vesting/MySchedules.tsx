'use client'

import { useState } from 'react'
import { decodeFunctionData, formatUnits } from 'viem'
import { usePublicClient } from 'wagmi'
import { AlertTriangle, Calendar, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import { isValidContractAddress } from '@/config/contracts'
import {
  ERC20_METADATA_ABI,
  VESTING_CREATED_EVENT,
  VESTING_FACTORY_ABI,
  VESTING_FACTORY_ADDRESS,
  VESTING_WALLET_ABI,
} from '@/lib/contracts/tokenVesting'

type LookupState =
  | { status: 'idle' }
  | { status: 'loading'; id: string }
  | { status: 'not-found'; id: string }
  | { status: 'error'; id: string; message: string }
  | { status: 'success'; id: string; schedule: ScheduleLookup }

interface ScheduleLookup {
  vestingWallet: `0x${string}`
  beneficiary: `0x${string}`
  token: `0x${string}`
  startTime: bigint
  endTime: bigint
  totalAmount: bigint
  claimedAmount: bigint
  tokenDecimals: number
  tokenSymbol: string | null
}

const isFactoryConfigured = isValidContractAddress(VESTING_FACTORY_ADDRESS)

function shortAddress(address: string): string {
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTokenAmount(amount: bigint, decimals: number, symbol: string | null): string {
  const formatted = formatUnits(amount, decimals).replace(/\.?0+$/, '')
  return symbol ? `${formatted} ${symbol}` : formatted
}

export function MySchedules() {
  const publicClient = usePublicClient()
  const [lookupId, setLookupId] = useState('')
  const [lookupState, setLookupState] = useState<LookupState>({ status: 'idle' })

  const handleLookup = async () => {
    const normalizedId = lookupId.trim()
    if (!normalizedId) return

    if (!/^\d+$/.test(normalizedId)) {
      setLookupState({
        status: 'error',
        id: normalizedId,
        message: 'Schedule IDs must be numeric.',
      })
      return
    }

    if (!isFactoryConfigured) {
      setLookupState({
        status: 'error',
        id: normalizedId,
        message: 'Vesting Factory address is not configured.',
      })
      return
    }

    if (!publicClient) {
      setLookupState({
        status: 'error',
        id: normalizedId,
        message: 'Unable to reach the public client for on-chain lookup.',
      })
      return
    }

    setLookupState({ status: 'loading', id: normalizedId })

    try {
      const scheduleId = BigInt(normalizedId)
      const logs = await publicClient.getLogs({
        address: VESTING_FACTORY_ADDRESS,
        event: VESTING_CREATED_EVENT,
        args: { vestingId: scheduleId },
        fromBlock: 0n,
        toBlock: 'latest',
      })

      const creationLog = logs[0]
      if (!creationLog?.transactionHash || !creationLog.args?.vestingWallet) {
        setLookupState({ status: 'not-found', id: normalizedId })
        return
      }

      const tx = await publicClient.getTransaction({ hash: creationLog.transactionHash })
      const decoded = decodeFunctionData({
        abi: VESTING_FACTORY_ABI,
        data: tx.input,
      })

      if (decoded.functionName !== 'createVestingSchedule') {
        throw new Error('Unexpected transaction type for this schedule.')
      }

      const [token, , totalAmount, startTime, , vestingDuration] = decoded.args as readonly [
        `0x${string}`,
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        boolean,
      ]

      const [beneficiary, claimedAmount, decimalsResult, symbolResult] = await Promise.all([
        publicClient.readContract({
          address: creationLog.args.vestingWallet,
          abi: VESTING_WALLET_ABI,
          functionName: 'owner',
        }),
        publicClient.readContract({
          address: creationLog.args.vestingWallet,
          abi: VESTING_WALLET_ABI,
          functionName: 'released',
          args: [token],
        }),
        publicClient
          .readContract({
            address: token,
            abi: ERC20_METADATA_ABI,
            functionName: 'decimals',
          })
          .catch(() => 18),
        publicClient
          .readContract({
            address: token,
            abi: ERC20_METADATA_ABI,
            functionName: 'symbol',
          })
          .catch(() => null),
      ])

      setLookupState({
        status: 'success',
        id: normalizedId,
        schedule: {
          vestingWallet: creationLog.args.vestingWallet,
          beneficiary: beneficiary as `0x${string}`,
          token,
          startTime,
          endTime: startTime + vestingDuration,
          totalAmount,
          claimedAmount: claimedAmount as bigint,
          tokenDecimals: Number(decimalsResult),
          tokenSymbol: symbolResult ? String(symbolResult) : null,
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load schedule data from chain.'

      setLookupState({
        status: 'error',
        id: normalizedId,
        message,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
        <h3 className="mb-1 text-base font-semibold text-white">Look Up a Schedule</h3>
        <p className="mb-4 text-sm text-white/50">
          Enter a Schedule ID to load its live VestingFactory details from testnet.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Schedule ID (e.g. 42)"
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
            />
          </div>
          <button
            onClick={handleLookup}
            disabled={!lookupId.trim() || lookupState.status === 'loading' || !isFactoryConfigured}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {lookupState.status === 'loading' ? (
              <>
                <LoaderCircle size={15} className="animate-spin" />
                Looking up
              </>
            ) : (
              'Look Up'
            )}
          </button>
        </div>
      </div>

      {lookupState.status === 'idle' && (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <div className="mb-3 flex justify-center text-[var(--accent)]">
            <Calendar size={30} />
          </div>
          <h3 className="mb-2 text-base font-semibold text-white">Ready to inspect a vesting schedule</h3>
          <p className="text-sm text-white/40">
            Lookups resolve the schedule ID on-chain and show the beneficiary, timing, and claim data.
          </p>
        </div>
      )}

      {lookupState.status === 'not-found' && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5">
          <p className="text-xs font-medium text-yellow-400">Schedule #{lookupState.id}</p>
          <p className="mt-2 text-sm text-white/60">
            No `VestingCreated` event was found for that schedule ID on the configured VestingFactory.
          </p>
        </div>
      )}

      {lookupState.status === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 text-red-400" />
            <div>
              <p className="text-xs font-medium text-red-400">Lookup failed for schedule #{lookupState.id}</p>
              <p className="mt-1 text-sm text-white/60">{lookupState.message}</p>
            </div>
          </div>
        </div>
      )}

      {lookupState.status === 'success' && (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
                Schedule #{lookupState.id}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">Live vesting schedule details</h3>
              <p className="mt-1 text-sm text-white/50">
                Loaded from the deployed VestingFactory transaction and vesting wallet.
              </p>
            </div>
            <a
              href={`https://liteforge.caldera.xyz/address/${lookupState.schedule.vestingWallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
            >
              View wallet <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-white/40">Beneficiary</p>
              <p className="mt-1 font-mono text-sm text-white">{lookupState.schedule.beneficiary}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-white/40">Vesting Wallet</p>
              <p className="mt-1 font-mono text-sm text-white">{lookupState.schedule.vestingWallet}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-white/40">Token</p>
              <p className="mt-1 font-mono text-sm text-white">
                {lookupState.schedule.tokenSymbol
                  ? `${lookupState.schedule.tokenSymbol} (${shortAddress(lookupState.schedule.token)})`
                  : lookupState.schedule.token}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-white/40">Claimed Amount</p>
              <p className="mt-1 text-sm text-white">
                {formatTokenAmount(
                  lookupState.schedule.claimedAmount,
                  lookupState.schedule.tokenDecimals,
                  lookupState.schedule.tokenSymbol,
                )}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-white/40">Start Time</p>
              <p className="mt-1 text-sm text-white">{formatTimestamp(lookupState.schedule.startTime)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-white/40">End Time</p>
              <p className="mt-1 text-sm text-white">{formatTimestamp(lookupState.schedule.endTime)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-wider text-white/40">Total Amount</p>
              <p className="mt-1 text-sm text-white">
                {formatTokenAmount(
                  lookupState.schedule.totalAmount,
                  lookupState.schedule.tokenDecimals,
                  lookupState.schedule.tokenSymbol,
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/50">
          <span className="font-medium text-white/70">Beneficiary dashboard:</span>{' '}
          Share{' '}
          <span className="font-mono text-[var(--accent)]">
            lester-labs.com/vesting/claim?id=[id]
          </span>{' '}
          with beneficiaries to let them track and claim their tokens.{' '}
          <a
            href="https://lester-labs.com/vesting/claim"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
          >
            Open <ExternalLink size={11} />
          </a>
        </p>
      </div>
    </div>
  )
}
