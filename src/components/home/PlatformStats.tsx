'use client'

import { useState, useEffect, useRef } from 'react'
import { useReadContract } from 'wagmi'
import { ILO_FACTORY_ADDRESS, DISPERSE_ADDRESS, UNISWAP_V2_FACTORY_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { ILO_FACTORY_ABI } from '@/config/abis'
import { RPC_URL } from '@/lib/rpcClient'
import { UNISWAP_V2_FACTORY_ABI } from '@/config/abis'

const POLL_INTERVAL = 30_000
const TOKEN_FACTORY = '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' as const
const LEGACY_ILO_FACTORY = '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' as const
const TOKEN_EVENT_SIG = '0xd5d05a8421149c74fd223cfc823befb883babf9bf0b0e4d6bf9c8fdb70e59bb4'
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const SWAP_EVENT_SIG = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'

const BATCH_SIZE = 50_000

const SWAP_COUNT_KEY = 'lester_cached_swap_count'
const TOKEN_COUNT_KEY = 'lester_cached_token_count'
const AIRDROP_COUNT_KEY = 'lester_cached_airdrop_count'
const PAIR_SCAN_DONE_KEY = 'lester_swap_scan_done'

// ── Stat chip ───────────────────────────────────────────────────────────
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

// ── ILO count hook — sums new factory + legacy factory ──────────────────────
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

// ── Discover factory pair addresses dynamically ───────────────────────
async function fetchFactoryPairAddresses(): Promise<string[]> {
  if (!isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS)) return []
  try {
    const lenResp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to:   UNISWAP_V2_FACTORY_ADDRESS,
          data: '0x1c2c7c', // allPairsLength()
        }, 'latest'],
        id: 1,
      }),
    })
    const lenJson = await lenResp.json()
    if (!lenJson.result || lenJson.result === '0x') return []
    const len = parseInt(lenJson.result, 16)
    if (len === 0) return []

    // Fetch all pair addresses in parallel batches of 10
    const indices = Array.from({ length: len }, (_, i) => i)
    const pairAddresses: string[] = []

    for (let i = 0; i < indices.length; i += 10) {
      const batch = indices.slice(i, i + 10)
      const results = await Promise.all(
        batch.map(async (idx) => {
          try {
            const resp = await fetch(RPC_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [{
                  to:   UNISWAP_V2_FACTORY_ADDRESS,
                  data: '0x1c2c7c' + idx.toString(16).padStart(64, '0'),
                }, 'latest'],
                id: 1,
              }),
            })
            const json = await resp.json()
            return json.result && json.result !== '0x'
              ? '0x' + json.result.slice(26).toLowerCase()
              : null
          } catch {
            return null
          }
        })
      )
      for (const addr of results) {
        if (addr) pairAddresses.push(addr)
      }
    }
    return pairAddresses
  } catch {
    return []
  }
}

// ── Token count from event logs ─────────────────────────────────────────
async function fetchTokenCount(): Promise<number> {
  const cached = sessionStorage.getItem(TOKEN_COUNT_KEY)
  if (cached) return parseInt(cached)
  try {
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          address: TOKEN_FACTORY,
          topics: [TOKEN_EVENT_SIG],
          fromBlock: '0x1',
          toBlock:   'latest',
        }],
        id: 1,
      }),
    })
    const json = await resp.json()
    const count = Array.isArray(json.result) ? json.result.length : 0
    sessionStorage.setItem(TOKEN_COUNT_KEY, String(count))
    return count
  } catch {
    return 0
  }
}

// ── Swap count — discovered pairs + bounded batch scan ─────────────────
async function fetchSwapCount(pairAddresses: string[]): Promise<number> {
  if (!pairAddresses.length) return 0
  const cached = sessionStorage.getItem(SWAP_COUNT_KEY)
  if (cached) return parseInt(cached)

  let latest = 0
  try {
    const blockResp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    })
    const blockJson = await blockResp.json()
    latest = parseInt(blockJson.result, 16)
  } catch {
    return 0
  }

  let fromBlock = 0
  let totalSwaps = 0

  while (fromBlock <= latest) {
    const toBlock = Math.min(fromBlock + BATCH_SIZE, latest)
    const fromHex = '0x' + fromBlock.toString(16)
    const toHex   = '0x' + toBlock.toString(16)

    const results = await Promise.all(
      pairAddresses.map(async (addr) => {
        try {
          const resp = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getLogs',
              params: [{
                address: addr,
                topics: [SWAP_EVENT_SIG],
                fromBlock: fromHex,
                toBlock:   toHex,
              }],
              id: 1,
            }),
          })
          const json = await resp.json()
          return Array.isArray(json.result) ? json.result.length : 0
        } catch {
          return 0
        }
      })
    )

    totalSwaps += results.reduce((a, b) => a + b, 0)
    fromBlock = toBlock + 1
  }

  sessionStorage.setItem(SWAP_COUNT_KEY, String(totalSwaps))
  return totalSwaps
}

// ── Airdrop wallet count from Disperse contract Transfer events ───────────
async function fetchAirdropWalletCount(): Promise<number> {
  if (!isValidContractAddress(DISPERSE_ADDRESS)) return 0
  const cached = sessionStorage.getItem(AIRDROP_COUNT_KEY)
  if (cached) return parseInt(cached)
  try {
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          topics: [
            TRANSFER_SIG,
            '0x' + DISPERSE_ADDRESS.slice(2).padStart(64, '0'),
            null,
          ],
          fromBlock: '0x1',
          toBlock:   'latest',
        }],
        id: 1,
      }),
    })
    const json = await resp.json()
    if (!Array.isArray(json.result)) return 0
    const wallets = new Set<string>()
    for (const ev of json.result) {
      if (ev.topics[2]) {
        wallets.add('0x' + ev.topics[2].slice(26).toLowerCase())
      }
    }
    const count = wallets.size
    sessionStorage.setItem(AIRDROP_COUNT_KEY, String(count))
    return count
  } catch {
    return 0
  }
}

export function PlatformStats() {
  const iloCount  = useILOFactoryCounter('getILOCount')
  const [tokenCount, setTokenCount] = useState<string>('—')
  const [airdropCount, setAirdropCount] = useState<string>('—')
  const [swapCount, setSwapCount] = useState<string>('—')
  const [loading, setLoading] = useState(true)
  const [pairCount, setPairCount] = useState<string>('—')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialLoadDone = useRef(false)
  const cachedPairs = useRef<string[]>([])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    async function init() {
      const [pairs, tokens, airdrop] = await Promise.all([
        fetchFactoryPairAddresses(),
        fetchTokenCount(),
        fetchAirdropWalletCount(),
      ])

      cachedPairs.current = pairs
      setPairCount(String(pairs.length))
      setTokenCount(String(tokens))
      setAirdropCount(String(airdrop))

      const swaps = await fetchSwapCount(pairs)
      setSwapCount(String(swaps))
      setLoading(false)
    }

    init()
  }, [])

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      // Refresh pair list every poll (catches new factory pairs)
      const pairs = await fetchFactoryPairAddresses()
      cachedPairs.current = pairs
      setPairCount(String(pairs.length))

      const [tokens, swaps] = await Promise.all([
        fetchTokenCount(),
        fetchSwapCount(pairs),
      ])
      setTokenCount(String(tokens))
      setSwapCount(String(swaps))
    }, POLL_INTERVAL)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

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
