'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, Copy, Check, ExternalLink } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import {
  ILO_FACTORY_ADDRESS,
  TOKEN_FACTORY_ADDRESS,
  VESTING_FACTORY_ADDRESS,
  LIQUIDITY_LOCKER_ADDRESS,
} from '@/config/contracts'
import { ILO_FACTORY_ABI } from '@/config/abis'
import { RPC_URL } from '@/lib/rpcClient'

// ── Types ──────────────────────────────────────────────────────────────────

interface TokenEntry {
  tokenAddress: string
  name: string
  symbol: string
}

interface PresaleEntry {
  address: string
  token: string
  softCap: bigint
  totalRaised: bigint
  finalized: boolean
  cancelled: boolean
}

interface VestingEntry {
  vestingId: string
  vestingWallet: string
  beneficiary: string
  token: string
  totalAmount: string
}

interface LockEntry {
  lockId: string
  lpToken: string
  amount: string
  unlockTime: string
  withdrawn: boolean
}

type Tab = 'tokens' | 'presales' | 'vesting' | 'locks'

// ── Helpers ────────────────────────────────────────────────────────────────

function truncate(addr: string, chars = 4) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`
}

function useCopyToClipboard(label: string) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(label).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return { copied, copy }
}

// ── Event log fetcher ────────────────────────────────────────────────────

async function fetchLogs(
  address: string,
  eventSignature: string,
  indexedTopic2: string,
): Promise<any[]> {
  try {
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [
          {
            address,
            topics: [eventSignature, null, indexedTopic2],
            fromBlock: '0x1',
            toBlock: 'latest',
          },
        ],
        id: 1,
      }),
    })
    const json = await resp.json()
    return Array.isArray(json.result) ? json.result : []
  } catch {
    return []
  }
}

// Solidity keccak256 event signatures — verified against on-chain data
const VESTING_EVENT_SIG = '0x56b1f9aa7211e7166f2a4d851623936f78b07f35e4ae47efa2299ba8e368ca56'
const LOCK_EVENT_SIG    = '0xc841d5bbfd6bbee5b5afbcdd70a52778ca1aaa260339f7307f2db27865f162cc'

// ── Hooks ─────────────────────────────────────────────────────────────────

function useTokens(address: string | undefined) {
  const [tokens, setTokens] = useState<TokenEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    const topic = '0xd5d05a8421149c74fd223cfc823befb883babf9bf0b0e4d6bf9c8fdb70e59bb4'
    fetchLogs(TOKEN_FACTORY_ADDRESS, topic, address).then((logs) => {
      const entries: TokenEntry[] = logs.map((log: any) => ({
        tokenAddress: log.address,
        name: log.topics[3] ? web3DecodeString(log.topics[3]) : 'Unknown', // indexed topics start at 1
        symbol: web3DecodeString(log.topics[4] || '0x'),
      }))
      setTokens(entries)
      setLoading(false)
    })
  }, [address])

  return { tokens, loading }
}

function web3DecodeString(topic: string) {
  // ABI decode a string from a bytes32 topic
  // For simplicity, decode as UTF-8 from the bytes32 hex
  try {
    const hex = topic.slice(2)
    // Remove trailing zeros (padding)
    const stripped = hex.replace(/0+$/, '')
    if (!stripped) return ''
    const raw = stripped.length % 2 ? '0' + stripped : stripped
    const buf = Buffer.from(raw, 'hex')
    return buf.toString('utf8').replace(/\0+$/, '')
  } catch {
    return topic.slice(0, 10)
  }
}

function usePresales(address: string | undefined) {
  const [presales, setPresales] = useState<PresaleEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    if (!address) { setLoading(false); return }
    setLoading(true)
    try {
      const resp = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: ILO_FACTORY_ADDRESS,
              data: encodeGetOwnerILOs(address),
            },
            'latest',
          ],
          id: 1,
        }),
      })
      const json = await resp.json()
      const raw = json.result
      if (!raw || raw === '0x') { setPresales([]); setLoading(false); return }

      const count = parseInt(raw.slice(2, 66), 16) || 0
      const iloAddresses: string[] = []
      for (let i = 0; i < count; i++) {
        const offset = 64 + i * 32
        const addr = '0x' + raw.slice(offset + 24, offset + 64)
        iloAddresses.push(addr)
      }

      // Fetch metadata for each ILO in parallel
      const metas = await Promise.allSettled(
        iloAddresses.map((addr) => fetchILOMeta(addr)),
      )
      const entries = metas
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<PresaleEntry>).value)
      setPresales(entries)
    } catch {
      setPresales([])
    }
    setLoading(false)
  }, [address])

  useEffect(() => { fetch_() }, [fetch_])

  return { presales, loading }
}

function encodeGetOwnerILOs(address: string) {
  // function selector for getOwnerILOs(address) = 0x[4 bytes]
  // keccak256('getOwnerILOs(address)')[:4] = 0xb5b60d0b
  return '0xb5b60d0b' + address.slice(2).padStart(64, '0')
}

async function fetchILOMeta(address: string): Promise<PresaleEntry> {
  const fields = [
    { name: 'token',        offset: 0 },
    { name: 'softCap',      offset: 1 },
    { name: 'totalRaised',  offset: 2 },
    { name: 'finalized',    offset: 3 },
    { name: 'cancelled',    offset: 4 },
  ]

  const reads = await Promise.all(
    fields.map(({ name, offset }) =>
      fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: address,
            data: '0x' + '0'.repeat(8 + offset * 32),
          }, 'latest'],
          id: 1,
        }),
      }).then((r) => r.json())
    ),
  )

  return {
    address,
    token: '0x' + (reads[0].result || '').slice(26),
    softCap: BigInt(reads[1].result || '0x0'),
    totalRaised: BigInt(reads[2].result || '0x0'),
    finalized: (reads[3].result || '0x0') !== '0x0',
    cancelled: (reads[4].result || '0x0') !== '0x0',
  }
}

function useVesting(address: string | undefined) {
  const [vestings, setVestings] = useState<VestingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    fetchLogs(VESTING_FACTORY_ADDRESS, VESTING_EVENT_SIG, address).then((logs) => {
      const entries: VestingEntry[] = logs.map((log: any) => ({
        vestingId: BigInt(log.topics[1] || '0x0').toString(),
        vestingWallet: '0x' + (log.topics[2] || '').slice(26),
        beneficiary: '0x' + (log.topics[3] || '').slice(26),
        token: '0x' + (log.data || '').slice(26, 90),
        totalAmount: formatUnits(BigInt('0x' + (log.data || '').slice(90, 154)), 18),
      }))
      setVestings(entries)
      setLoading(false)
    })
  }, [address])

  return { vestings, loading }
}

function useLocks(address: string | undefined) {
  const [locks, setLocks] = useState<LockEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    fetchLogs(LIQUIDITY_LOCKER_ADDRESS, LOCK_EVENT_SIG, address).then((logs) => {
      const entries: LockEntry[] = logs.map((log: any) => ({
        lockId: BigInt(log.topics[1] || '0x0').toString(),
        lpToken: '0x' + (log.topics[2] || '').slice(26),
        amount: formatUnits(BigInt(log.topics[3] || '0x0'), 18),
        unlockTime: new Date(Number(BigInt(log.topics[4] || '0x0')) * 1000).toLocaleDateString(),
        withdrawn: false, // would need contract state to check
      }))
      setLocks(entries)
      setLoading(false)
    })
  }, [address])

  return { locks, loading }
}

function formatUnits(val: bigint, decimals: number) {
  const str = val.toString().padStart(decimals + 1, '0')
  const int = str.slice(0, -decimals) || '0'
  const dec = str.slice(-decimals).slice(0, 4)
  return dec.length > 0 ? `${int}.${dec}` : int
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'active' | 'finalized' | 'cancelled' }) {
  const map = {
    active:    { bg: 'rgba(52,211,153,0.12)',  color: '#34D399', label: 'Active' },
    finalized: { bg: 'rgba(107,79,255,0.12)',  color: '#6B4FFF', label: 'Finalized' },
    cancelled: { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444', label: 'Cancelled' },
  }
  const s = map[status]
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
      {s.label}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 36, marginBottom: 12 }}>—</div>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>{message}</p>
    </div>
  )
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 64,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}

function AddressChip({ address, href }: { address: string; href?: string }) {
  const { copied, copy } = useCopyToClipboard(address)
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
        {truncate(address)}
      </span>
      <button onClick={copy} className="cursor-pointer hover:opacity-70 transition-opacity">
        {copied
          ? <Check size={11} style={{ color: '#34D399' }} />
          : <Copy size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />}
      </button>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </a>
      )}
    </div>
  )
}

// ── Tab panels ─────────────────────────────────────────────────────────────

function TokensPanel({ address }: { address: string }) {
  const { tokens, loading } = useTokens(address)
  if (loading) return <LoadingSkeleton />
  if (tokens.length === 0) return <EmptyState message="No tokens created by this wallet" />
  return (
    <div className="space-y-3">
      {tokens.map((t) => (
        <div
          key={t.tokenAddress}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{t.symbol}</div>
          </div>
          <AddressChip
            address={t.tokenAddress}
            href={`/explorer/token/${t.tokenAddress}`}
          />
        </div>
      ))}
    </div>
  )
}

function PresalesPanel({ address }: { address: string }) {
  const { presales, loading } = usePresales(address)
  if (loading) return <LoadingSkeleton />
  if (presales.length === 0) return <EmptyState message="No presales launched by this wallet" />

  const getStatus = (p: PresaleEntry): 'active' | 'finalized' | 'cancelled' => {
    if (p.cancelled) return 'cancelled'
    if (p.finalized) return 'finalized'
    return 'active'
  }

  return (
    <div className="space-y-3">
      {presales.map((p) => (
        <div
          key={p.address}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>ILO Presale</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              Raised: {p.totalRaised.toString()} ETH · Soft Cap: {p.softCap.toString()} ETH
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={getStatus(p)} />
            <AddressChip address={p.address} />
          </div>
        </div>
      ))}
    </div>
  )
}

function VestingPanel({ address }: { address: string }) {
  const { vestings, loading } = useVesting(address)
  if (loading) return <LoadingSkeleton />
  if (vestings.length === 0) return <EmptyState message="No vesting positions for this wallet" />
  return (
    <div className="space-y-3">
      {vestings.map((v) => (
        <div
          key={v.vestingId}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Vesting #{v.vestingId}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
              Amount: {v.totalAmount} tokens
            </div>
          </div>
          <AddressChip address={v.token} />
        </div>
      ))}
    </div>
  )
}

function LocksPanel({ address }: { address: string }) {
  const { locks, loading } = useLocks(address)
  if (loading) return <LoadingSkeleton />
  if (locks.length === 0) return <EmptyState message="No liquidity locks for this wallet" />
  return (
    <div className="space-y-3">
      {locks.map((l) => (
        <div
          key={l.lockId}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Lock #{l.lockId}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
              {l.amount} LP · Unlocks {l.unlockTime}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {l.withdrawn && <StatusBadge status="cancelled" />}
            <AddressChip address={l.lpToken} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'tokens',    label: 'TOKENS' },
  { key: 'presales', label: 'PRESALES' },
  { key: 'vesting',  label: 'VESTING' },
  { key: 'locks',    label: 'LOCKS' },
]

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('tokens')

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <LTCBanner />
        <Navbar />
        <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="w-full max-w-sm text-center">
              <div
                className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'var(--accent-muted)', border: '1px solid rgba(107,79,255,0.08)' }}
              >
                <Wallet size={24} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="mb-2 text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                Connect your wallet
              </h3>
              <p className="mb-8 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Connect to view your on-chain footprint across Lester Labs.
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <LTCBanner />
      <Navbar />
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
            <p className="text-white/50 text-sm mt-1">Your on-chain footprint across Lester Labs</p>
          </div>
          <div className="flex items-center gap-2" style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            <span>{truncate(address!, 6)}</span>
            <AddressChip address={address!} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-end gap-0 border-b border-white/10 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-5 py-3 text-xs font-mono tracking-wider transition-colors duration-200"
              style={{
                color: activeTab === tab.key ? 'var(--foreground)' : 'rgba(255,255,255,0.35)',
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'tokens'    && <TokensPanel   address={address!} />}
        {activeTab === 'presales' && <PresalesPanel address={address!} />}
        {activeTab === 'vesting'  && <VestingPanel  address={address!} />}
        {activeTab === 'locks'    && <LocksPanel     address={address!} />}
      </div>
    </main>
  )
}
