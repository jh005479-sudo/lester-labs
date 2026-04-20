'use client'

import { useState, useEffect, useRef } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { ILO_FACTORY_ADDRESS, DISPERSE_ADDRESS, UNISWAP_V2_FACTORY_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { ILO_FACTORY_ABI } from '@/config/abis'

const POLL_INTERVAL = 30_000
const TOKEN_FACTORY = '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' as const
const LEGACY_ILO_FACTORY = '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' as const
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// Cache keys — v5 invalidates stale v4 caches and adds block-position tracking
const SWAP_COUNT_KEY = 'lester_cached_swap_count_v5'
const TOKEN_COUNT_KEY = 'lester_cached_token_count_v5'
const AIRDROP_COUNT_KEY = 'lester_cached_airdrop_count_v5'
const LAST_TOKEN_BLOCK_KEY = 'lester_last_token_block_v5'
const LAST_AIRDROP_BLOCK_KEY = 'lester_last_airdrop_block_v5'
const LAST_SWAP_BLOCK_KEY = 'lester_last_swap_block_v5'

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

// ── Types ──────────────────────────────────────────────────────────────────
interface DecodedPairCreated {
  token0: string
  token1: string
  pair: string
  param: bigint
}

export function PlatformStats() {
  const publicClient = usePublicClient()
  const iloCount = useILOFactoryCounter('getILOCount')
  const [tokenCount, setTokenCount] = useState<string>('—')
  const [airdropCount, setAirdropCount] = useState<string>('—')
  const [swapCount, setSwapCount] = useState<string>('—')
  const [loading, setLoading] = useState(true)
  const [pairCount, setPairCount] = useState<string>('—')

  const lastSwapBlock = useRef<bigint>(0n)
  const accumulatedSwaps = useRef<number>(0)
  const lastTokenBlock = useRef<bigint>(0n)
  const accumulatedTokens = useRef<number>(0)
  const lastAirdropBlock = useRef<bigint>(0n)
  const accumulatedAirdrop = useRef<Set<string>>(new Set())
  const cachedPairCount = useRef<number>(0)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isReady = useRef(false)
  const scanInProgress = useRef(false)

  // ── Core incremental scan from fromBlock → toBlock ─────────────────────
  async function runIncrementalScan(fromBlock: bigint, toBlock: bigint) {
    if (!publicClient || scanInProgress.current) return
    scanInProgress.current = true

    try {
      // 1. Discover factory pairs (always from 0 — only 4 pairs, trivially cheap)
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
      const pairs: string[] = pairLogs
        .map(log => (log.args as unknown as DecodedPairCreated).pair)
        .filter(Boolean)
      cachedPairCount.current = pairs.length
      setPairCount(String(pairs.length))

      // 2. Token count — incremental from last scanned block
      const tokenLogs = await publicClient.getLogs({
        address: TOKEN_FACTORY,
        event: {
          type: 'event' as const,
          name: 'TokenCreated',
          inputs: [
            { type: 'address', name: 'creator' },
            { type: 'address', name: 'token' },
            { type: 'string', name: 'name' },
            { type: 'string', name: 'symbol' },
          ],
        },
        fromBlock: lastTokenBlock.current === 0n ? 0n : fromBlock,
        toBlock,
      })
      accumulatedTokens.current += tokenLogs.length
      lastTokenBlock.current = toBlock
      sessionStorage.setItem(TOKEN_COUNT_KEY, String(accumulatedTokens.current))
      sessionStorage.setItem(LAST_TOKEN_BLOCK_KEY, String(toBlock))
      setTokenCount(String(accumulatedTokens.current))

      // 3. Airdrop wallets — incremental from last scanned block
      const airdropLogs: any[] = await (publicClient as any).getLogs({
        topics: [TRANSFER_SIG, '0x' + DISPERSE_ADDRESS.slice(2).padStart(64, '0'), null],
        fromBlock: lastAirdropBlock.current === 0n ? 0n : fromBlock,
        toBlock,
      })
      for (const ev of airdropLogs) {
        if (ev.topics?.[2]) accumulatedAirdrop.current.add('0x' + ev.topics[2].slice(26).toLowerCase())
      }
      lastAirdropBlock.current = toBlock
      sessionStorage.setItem(AIRDROP_COUNT_KEY, String(accumulatedAirdrop.current))
      sessionStorage.setItem(LAST_AIRDROP_BLOCK_KEY, String(toBlock))
      setAirdropCount(String(accumulatedAirdrop.current))

      // 4. Swap count — incremental from last scanned block
      if (pairs.length > 0) {
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
                fromBlock: lastSwapBlock.current === 0n ? 0n : fromBlock,
                toBlock,
              })
              return logs.length
            } catch {
              return 0
            }
          })
        )
        const newSwaps = batchResults.reduce((a, b) => a + b, 0)
        accumulatedSwaps.current += newSwaps
        lastSwapBlock.current = toBlock
        sessionStorage.setItem(SWAP_COUNT_KEY, String(accumulatedSwaps.current))
        sessionStorage.setItem(LAST_SWAP_BLOCK_KEY, String(toBlock))
        setSwapCount(String(accumulatedSwaps.current))
      } else {
        setSwapCount(String(accumulatedSwaps.current))
      }
    } finally {
      scanInProgress.current = false
      setLoading(false)
    }
  }

  // ── Initial load — restore from cache, then incremental catch-up ───────
  useEffect(() => {
    if (!publicClient) return
    if (isReady.current) return
    isReady.current = true

    // Restore accumulated counts and last scanned block positions from sessionStorage
    accumulatedSwaps.current = parseInt(sessionStorage.getItem(SWAP_COUNT_KEY) ?? '0')
    accumulatedTokens.current = parseInt(sessionStorage.getItem(TOKEN_COUNT_KEY) ?? '0')
    // Airdrop Set is rebuilt incrementally; store count separately for display
    const cachedAirdropCount = parseInt(sessionStorage.getItem(AIRDROP_COUNT_KEY) ?? '0')
    accumulatedAirdrop.current = new Set<string>()
    // Populate Set with dummy entries so .size reflects the cached count
    for (let i = 0; i < cachedAirdropCount; i++) accumulatedAirdrop.current.add(`_w${i}`)

    lastSwapBlock.current = BigInt(sessionStorage.getItem(LAST_SWAP_BLOCK_KEY) ?? '0')
    lastTokenBlock.current = BigInt(sessionStorage.getItem(LAST_TOKEN_BLOCK_KEY) ?? '0')
    lastAirdropBlock.current = BigInt(sessionStorage.getItem(LAST_AIRDROP_BLOCK_KEY) ?? '0')

    // Show cached values immediately — no loading spinner
    setSwapCount(String(accumulatedSwaps.current))
    setTokenCount(String(accumulatedTokens.current))
    setAirdropCount(String(cachedAirdropCount))
    setLoading(false)

    // Incremental catch-up from last scanned block
    async function init() {
      if (!publicClient) return
      try {
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = [lastSwapBlock.current, lastTokenBlock.current, lastAirdropBlock.current]
          .reduce((max, b) => b > max ? b : max, 0n)

        if (latestBlock > fromBlock) {
          await runIncrementalScan(fromBlock + 1n, latestBlock)
        } else {
          // Cache warm and current — just discover pairs
          const pairLogs = await publicClient.getLogs({
            address: UNISWAP_V2_FACTORY_ADDRESS,
            event: { type: 'event' as const, name: 'PairCreated', inputs: [
              { type: 'address', name: 'token0', indexed: true },
              { type: 'address', name: 'token1', indexed: true },
              { type: 'address', name: 'pair', indexed: false },
              { type: 'uint256', name: 'param', indexed: false },
            ]},
            fromBlock: 0n,
            toBlock: 'latest',
          })
          setPairCount(String(pairLogs.length))
        }
      } catch (err) {
        console.error('[PlatformStats] init error:', err)
      }
    }
    init()
  }, [publicClient])

  // ── Polling — incremental from last scanned block ───────────────────────
  useEffect(() => {
    if (!publicClient) return
    if (!isReady.current) return

    pollIntervalRef.current = setInterval(async () => {
      try {
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = [lastSwapBlock.current, lastTokenBlock.current, lastAirdropBlock.current]
          .reduce((max, b) => b > max ? b : max, 0n)
        if (latestBlock <= fromBlock) return
        await runIncrementalScan(fromBlock + 1n, latestBlock)
      } catch (err) {
        console.error('[PlatformStats] poll error:', err)
      }
    }, POLL_INTERVAL)

    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) }
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
