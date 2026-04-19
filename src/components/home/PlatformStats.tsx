'use client'

import { useState, useEffect, useRef } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { ILO_FACTORY_ADDRESS, DISPERSE_ADDRESS, UNISWAP_V2_FACTORY_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { ILO_FACTORY_ABI } from '@/config/abis'

const POLL_INTERVAL = 30_000
const TOKEN_FACTORY = '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' as const
const LEGACY_ILO_FACTORY = '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' as const
const TOKEN_EVENT_SIG = '0xd5d05a8421149c74fd223cfc823befb883babf9bf0b0e4d6bf9c8fdb70e59bb4'
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const SWAP_EVENT_SIG = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
const PAIR_CREATED_SIG = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9'

const BATCH_SIZE = 50_000

const SWAP_COUNT_KEY = 'lester_cached_swap_count_v3'
const TOKEN_COUNT_KEY = 'lester_cached_token_count_v3'
const AIRDROP_COUNT_KEY = 'lester_cached_airdrop_count_v3'

// ── Stat chip ──────────────────────────────────────────────────────────────
function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '10px 20px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      minWidth: 110,
    }}>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontSize: 22,
        fontWeight: 700,
        color: accent,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </span>
      <span style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        fontFamily: "'Inter', sans-serif",
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        {label}
      </span>
    </div>
  )
}

// ── ILO count hook — sums new factory + legacy factory ─────────────────────
type ILOFactoryFn = 'creationFee' | 'allILOs' | 'getILOCount' | 'getOwnerILOs'

function useILOFactoryCounter(fn: ILOFactoryFn) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data, refetch } = useReadContract({
    address: ILO_FACTORY_ADDRESS as `0x${string}`,
    abi: ILO_FACTORY_ABI as any,
    functionName: fn as any,
    query: { enabled: isValidContractAddress(ILO_FACTORY_ADDRESS) },
  })

  const { data: legacyData, refetch: legacyRefetch } = useReadContract({
    address: LEGACY_ILO_FACTORY as `0x${string}`,
    abi: ILO_FACTORY_ABI as any,
    functionName: fn as any,
    query: { enabled: isValidContractAddress(LEGACY_ILO_FACTORY) },
  })

  useEffect(() => {
    intervalRef.current = setInterval(() => { refetch(); legacyRefetch() }, POLL_INTERVAL)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [refetch, legacyRefetch])

  const newCount = data !== undefined && data !== null ? Number(data) : 0
  const legacyCount = legacyData !== undefined && legacyData !== null ? Number(legacyData) : 0
  return String(newCount + legacyCount)
}

// ── Types for decoded events ─────────────────────────────────────────────
interface DecodedPairCreated {
  token0: string
  token1: string
  pair: string
  param: bigint
}
interface DecodedTokenCreated {
  creator: string
  token: string
  name: string
  symbol: string
}
interface DecodedSwap {
  sender: string
  amount0In: bigint
  amount1In: bigint
  amount0Out: bigint
  amount1Out: bigint
  to: string
}
interface DecodedTransfer {
  from: string
  to: string
  value: bigint
}

export function PlatformStats() {
  const publicClient = usePublicClient()
  const iloCount = useILOFactoryCounter('getILOCount')
  const [tokenCount, setTokenCount] = useState<string>('—')
  const [airdropCount, setAirdropCount] = useState<string>('—')
  const [swapCount, setSwapCount] = useState<string>('—')
  const [loading, setLoading] = useState(true)
  const [pairCount, setPairCount] = useState<string>('—')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialLoadDone = useRef(false)

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicClient) return
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    async function init() {
      if (!publicClient) return
      try {
        // 1. Discover all factory pair addresses via PairCreated events
        const pairLogs = await publicClient.getLogs({
          address: UNISWAP_V2_FACTORY_ADDRESS,
          event: {
            type: 'event' as const,
            name: 'PairCreated',
            inputs: [
              { type: 'address', name: 'token0', indexed: true },
              { type: 'address', name: 'token1', indexed: true },
              { type: 'address', name: 'pair', indexed: false },
              { type: 'uint256', name: 'param', indexed: false },
            ],
          },
          fromBlock: 0n,
          toBlock: 'latest',
        })
        const pairs: string[] = pairLogs.map(log => {
          const args = log.args as unknown as DecodedPairCreated
          return args.pair
        }).filter(Boolean)
        setPairCount(String(pairs.length))

        // 2. Token count from factory logs
        const tokenCached = sessionStorage.getItem(TOKEN_COUNT_KEY)
        let tokenTotal = tokenCached ? parseInt(tokenCached) : 0
        if (!tokenCached) {
          const tokenLogs = await publicClient.getLogs({
            address: TOKEN_FACTORY,
            event: {
              type: 'event' as const,
              name: 'TokenCreated',
              inputs: [
                { type: 'address', name: 'creator' },
                { type: 'address', name: 'token' },
                { type: 'string',  name: 'name' },
                { type: 'string',  name: 'symbol' },
              ],
            },
            fromBlock: 0n,
            toBlock: 'latest',
          })
          tokenTotal = tokenLogs.length
          sessionStorage.setItem(TOKEN_COUNT_KEY, String(tokenTotal))
        }
        setTokenCount(String(tokenTotal))

        // 3. Airdrop wallet count
        const airdropCached = sessionStorage.getItem(AIRDROP_COUNT_KEY)
        let airdropTotal = airdropCached ? parseInt(airdropCached) : 0
        if (!airdropCached) {
          // Use raw topic filter — split address into topic[1] position
          const airdropLogs: any[] = await (publicClient as any).getLogs({
            topics: [
              TRANSFER_SIG,
              '0x' + DISPERSE_ADDRESS.slice(2).padStart(64, '0'),
              null,
            ],
            fromBlock: 0n,
            toBlock: 'latest',
          })
          const wallets = new Set<string>()
          for (const ev of airdropLogs) {
            if (ev.topics?.[2]) {
              wallets.add('0x' + ev.topics[2].slice(26).toLowerCase())
            }
          }
          airdropTotal = wallets.size
          sessionStorage.setItem(AIRDROP_COUNT_KEY, String(airdropTotal))
        }
        setAirdropCount(String(airdropTotal))

        // 4. Swap count across all pairs (bounded batch scan)
        const swapCached = sessionStorage.getItem(SWAP_COUNT_KEY)
        let swapTotal = swapCached ? parseInt(swapCached) : 0
        if (!swapCached && pairs.length > 0) {
          const latestBlock = await publicClient.getBlockNumber()
          let fromBlock = 0n
          while (fromBlock <= latestBlock) {
            const toBlock = fromBlock + BigInt(BATCH_SIZE) > latestBlock
              ? latestBlock
              : fromBlock + BigInt(BATCH_SIZE)

            const batchResults = await Promise.all(
              pairs.map(async (addr) => {
                try {
                  const logs = await publicClient.getLogs({
                    address: addr as `0x${string}`,
                    event: {
                      type: 'event' as const,
                      name: 'Swap',
                      inputs: [
                        { type: 'address', name: 'sender', indexed: true },
                        { type: 'uint256', name: 'amount0In', indexed: false },
                        { type: 'uint256', name: 'amount1In', indexed: false },
                        { type: 'uint256', name: 'amount0Out', indexed: false },
                        { type: 'uint256', name: 'amount1Out', indexed: false },
                        { type: 'address', name: 'to', indexed: true },
                      ],
                    },
                    fromBlock,
                    toBlock,
                  })
                  return logs.length
                } catch {
                  return 0
                }
              })
            )
            swapTotal += batchResults.reduce((a, b) => a + b, 0)
            fromBlock = toBlock + 1n
          }
          sessionStorage.setItem(SWAP_COUNT_KEY, String(swapTotal))
        }
        setSwapCount(String(swapTotal))
      } catch (err) {
        console.error('[PlatformStats] init error:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [publicClient])

  // ── Polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicClient) return

    intervalRef.current = setInterval(async () => {
      try {
        const pairLogs = await publicClient.getLogs({
          address: UNISWAP_V2_FACTORY_ADDRESS,
          event: {
            type: 'event' as const,
            name: 'PairCreated',
            inputs: [
              { type: 'address', name: 'token0', indexed: true },
              { type: 'address', name: 'token1', indexed: true },
              { type: 'address', name: 'pair', indexed: false },
              { type: 'uint256', name: 'param', indexed: false },
            ],
          },
          fromBlock: 0n,
          toBlock: 'latest',
        })
        const pairs: string[] = pairLogs.map(log => {
          const args = log.args as unknown as DecodedPairCreated
          return args.pair
        }).filter(Boolean)
        setPairCount(String(pairs.length))

        const [tokenLogs, swapTotal] = await Promise.all([
          publicClient.getLogs({
            address: TOKEN_FACTORY,
            event: {
              type: 'event' as const,
              name: 'TokenCreated',
              inputs: [
                { type: 'address', name: 'creator' },
                { type: 'address', name: 'token' },
                { type: 'string',  name: 'name' },
                { type: 'string',  name: 'symbol' },
              ],
            },
            fromBlock: 0n,
            toBlock: 'latest',
          }),
          (async () => {
            if (!pairs.length) return 0
            const cached = sessionStorage.getItem(SWAP_COUNT_KEY)
            let total = cached ? parseInt(cached) : 0
            const latestBlock = await publicClient.getBlockNumber()
            let fromBlock = 0n
            while (fromBlock <= latestBlock) {
              const toBlock = fromBlock + BigInt(BATCH_SIZE) > latestBlock
                ? latestBlock
                : fromBlock + BigInt(BATCH_SIZE)
              const batchResults = await Promise.all(
                pairs.map(async (addr) => {
                  try {
                    const logs = await publicClient.getLogs({
                      address: addr as `0x${string}`,
                      event: {
                        type: 'event' as const,
                        name: 'Swap',
                        inputs: [
                          { type: 'address', name: 'sender', indexed: true },
                          { type: 'uint256', name: 'amount0In', indexed: false },
                          { type: 'uint256', name: 'amount1In', indexed: false },
                          { type: 'uint256', name: 'amount0Out', indexed: false },
                          { type: 'uint256', name: 'amount1Out', indexed: false },
                          { type: 'address', name: 'to', indexed: true },
                        ],
                      },
                      fromBlock,
                      toBlock,
                    })
                    return logs.length
                  } catch {
                    return 0
                  }
                })
              )
              total += batchResults.reduce((a, b) => a + b, 0)
              fromBlock = toBlock + 1n
            }
            sessionStorage.setItem(SWAP_COUNT_KEY, String(total))
            return total
          })(),
        ])

        setTokenCount(String(tokenLogs.length))
        setSwapCount(String(swapTotal))
      } catch (err) {
        console.error('[PlatformStats] poll error:', err)
      }
    }, POLL_INTERVAL)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [publicClient])

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginTop: 20,
    }}>
      <StatChip
        label="Tokens Minted"
        value={loading ? '—' : tokenCount}
        accent="#6B4FFF"
      />
      <StatChip
        label="Pre-sales Created"
        value={iloCount}
        accent="#5E6AD2"
      />
      <StatChip
        label="Wallets Airdropped"
        value={airdropCount}
        accent="#36D1DC"
      />
      <StatChip
        label="Swaps Completed"
        value={loading ? '—' : swapCount}
        accent="#E44FB5"
      />
    </div>
  )
}
