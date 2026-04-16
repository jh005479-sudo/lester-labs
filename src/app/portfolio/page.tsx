'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContract, useBalance } from 'wagmi'
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
import { ILO_FACTORY_ABI, ILO_ABI, ERC20_ABI } from '@/config/abis'
import { RPC_URL } from '@/lib/rpcClient'

// ── Types ──────────────────────────────────────────────────────────────────

interface VestingEntry {
  vestingId: string
  vestingWallet: string
  beneficiary: string
  token: string
  totalAmount: string
  startTime: string
  revocable: boolean
}

interface LockEntry {
  lockId: string
  lpToken: string
  amount: string
  unlockTime: string
  withdrawn: boolean
}

type Tab = 'overview' | 'tokens' | 'presales' | 'vesting' | 'locks'

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
const TOKEN_EVENT_SIG  = '0xd5d05a8421149c74fd223cfc823befb883babf9bf0b0e4d6bf9c8fdb70e59bb4'
const VESTING_EVENT_SIG = '0x56b1f9aa7211e7166f2a4d851623936f78b07f35e4ae47efa2299ba8e368ca56'
const LOCK_EVENT_SIG    = '0xc841d5bbfd6bbee5b5afbcdd70a52778ca1aaa260339f7307f2db27865f162cc'

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Token creator scan (creator is topic 1 for TokenCreated) ────────────────
async function fetchTokensByCreator(creator: string): Promise<string[]> {
  try {
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          address: TOKEN_FACTORY_ADDRESS,
          topics: [TOKEN_EVENT_SIG, creator.startsWith('0x') ? creator : `0x${creator}`, null],
          fromBlock: '0x1',
          toBlock: 'latest',
        },],
        id: 1,
      }),
    })
    const json = await resp.json()
    return Array.isArray(json.result) ? json.result.map((l: any) => l.address) : []
  } catch {
    return []
  }
}

// Fetch token addresses created by `address` from TokenFactory events
function useTokenAddresses(address: string | undefined) {
  const [addresses, setAddresses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    fetchTokensByCreator(address).then((addrs) => {
      setAddresses(addrs)
      setLoading(false)
    })
  }, [address])

  return { addresses, loading }
}

// Fetch ILO addresses owned by `address` from ILOFactory via wagmi
function useILOAddresses(address: string | undefined) {
  const { data, isLoading } = useReadContract({
    address: ILO_FACTORY_ADDRESS,
    abi: ILO_FACTORY_ABI,
    functionName: 'getOwnerILOs',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  })
  return { addresses: (data as `0x${string}`[]) || [], loading: isLoading }
}

// usePresales — returns ILO count for Overview (uses wagmi for addresses, no metadata fetch)
function usePresales(address: string | undefined) {
  const { addresses, loading } = useILOAddresses(address)
  return { presales: addresses, loading }
}

// useTokens — returns token count for Overview
function useTokens(address: string | undefined) {
  const { addresses, loading } = useTokenAddresses(address)
  return { tokens: addresses, loading }
}

function useVesting(address: string | undefined) {
  const [vestings, setVestings] = useState<VestingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    fetchLogs(VESTING_FACTORY_ADDRESS, VESTING_EVENT_SIG, address).then((logs) => {
      const entries: VestingEntry[] = logs.map((log: any) => {
        const data = log.data || '0x'
        // VestingCreated data layout (non-indexed fields):
        // bytes 0-31:   address token   (right-padded, last 20 bytes = address)
        // bytes 32-63:  uint256 totalAmount
        // bytes 64-95:  uint256 startTime
        // bytes 96-127: uint256 cliffDuration
        // bytes 128-159: uint256 vestingDuration
        // bytes 160-191: bool revocable
        const token       = '0x' + data.slice(2 + 12, 2 + 32)   // bytes 12-32 of data (right-padded address)
        const totalAmount = BigInt(data.slice(2 + 32, 2 + 64))
        const startTime   = Number(BigInt(data.slice(2 + 64, 2 + 96)))
        const cliff       = Number(BigInt(data.slice(2 + 96, 2 + 128)))
        const vest        = Number(BigInt(data.slice(2 + 128, 2 + 160)))
        const revocable   = data.slice(2 + 191, 2 + 192) === '01'
        return {
          vestingId:    BigInt(log.topics[1] || '0x0').toString(),
          vestingWallet:'0x' + (log.topics[2] || '').slice(26),
          beneficiary: '0x' + (log.topics[3] || '').slice(26),
          token,
          totalAmount: `${formatUnits(totalAmount, 18)} tokens`,
          startTime: cliff > 0
            ? `Cliff ${cliff}s · Vesting ${vest}s from ${new Date(startTime * 1000).toLocaleDateString()}`
            : `Vesting ${vest}s from ${new Date(startTime * 1000).toLocaleDateString()}`,
          revocable,
        }
      })
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
    fetchLogs(LIQUIDITY_LOCKER_ADDRESS, LOCK_EVENT_SIG, address).then(async (logs) => {
      // Fetch withdrawn status for each lock via getLock
      const entries: (LockEntry & { lpToken: string })[] = await Promise.all(
        logs.map(async (log: any) => {
          const lockId  = BigInt(log.topics[1] || '0x0').toString()
          const lpToken = '0x' + (log.topics[2] || '').slice(26)
          const amount  = BigInt(log.topics[3] || '0x0')
          const unlockTime = Number(BigInt(log.topics[4] || '0x0'))

          // Fetch getLock(lockId) to get withdrawn status
          let withdrawn = false
          try {
            const resp = await fetch(RPC_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0', method: 'eth_call',
                params: [{
                  to: LIQUIDITY_LOCKER_ADDRESS,
                  data: '0x' + '0'.repeat(8) + BigInt(lockId).toString(16).padStart(64, '0'),
                }, 'latest'],
                id: 1,
              }),
            })
            const json = await resp.json()
            const result = json.result || '0x'
            // getLock returns (lpToken, amount, unlockTime, withdrawer, withdrawn)
            // withdrawn is last byte of the 5th 32-byte word
            const withdrawnHex = result.slice(2 + 32 * 4 + 62, 2 + 32 * 4 + 64)
            withdrawn = withdrawnHex === '01'
          } catch { /* keep withdrawn = false */ }

          return {
            lockId,
            lpToken,
            amount: formatUnits(amount, 18),
            unlockTime: new Date(unlockTime * 1000).toLocaleDateString(),
            withdrawn,
          }
        })
      )
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

// ── Row components (wagmi hooks at top level) ──────────────────────────────────

function TokenRow({ address }: { address: string }) {
  const tokenAddr = address as `0x${string}`
  const name    = useReadContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'name' })
  const symbol  = useReadContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'symbol' })
  const n = (name.data as string) ?? '—'
  const s = (symbol.data as string) ?? '—'
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{n}</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{s}</div>
      </div>
      <AddressChip address={address} href={`/explorer/token/${address}`} />
    </div>
  )
}

function ILORow({ address }: { address: string }) {
  const iloAddr = address as `0x${string}`
  const softCap     = useReadContract({ address: iloAddr, abi: ILO_ABI, functionName: 'softCap' })
  const totalRaised = useReadContract({ address: iloAddr, abi: ILO_ABI, functionName: 'totalRaised' })
  const finalized   = useReadContract({ address: iloAddr, abi: ILO_ABI, functionName: 'finalized' })
  const cancelled   = useReadContract({ address: iloAddr, abi: ILO_ABI, functionName: 'cancelled' })

  const sc = softCap.data !== undefined ? softCap.data.toString() : '—'
  const tr = totalRaised.data !== undefined ? totalRaised.data.toString() : '—'
  const status: 'active' | 'finalized' | 'cancelled' =
    cancelled.data ? 'cancelled' : finalized.data ? 'finalized' : 'active'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>ILO Presale</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          Raised: {tr} ETH · Soft Cap: {sc} ETH
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={status} />
        <AddressChip address={address} />
      </div>
    </div>
  )
}

// ── Tab panels ──────────────────────────────────────────────────────────────

// ── Overview panel ───────────────────────────────────────────────────────────

function OverviewPanel({ address }: { address: string }) {
  const addr = address as `0x${string}`
  const { data: ethBalance, isLoading: ethLoading } = useBalance({ address: addr })

  const { tokens,    loading: tLoading } = useTokens(address)
  const { presales,  loading: pLoading } = usePresales(address)
  const { vestings, loading: vLoading } = useVesting(address)
  const { locks,    loading: lLoading } = useLocks(address)

  const totalPositions = tokens.length + presales.length + vestings.length + locks.length

  const fmtEth = (val: bigint | undefined) => {
    if (!val) return '—'
    const eth = Number(val) / 1e18
    if (eth === 0) return '0 ETH'
    return `${eth.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`
  }

  return (
    <div className="space-y-6">
      {/* ETH Balance card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(107,79,255,0.15) 0%, rgba(52,211,153,0.08) 100%)',
        border: '1px solid rgba(107,79,255,0.25)',
        borderRadius: 16,
        padding: '24px 28px',
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase' }}>
          Native Balance
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {ethLoading ? <span style={{ opacity: 0.4 }}>Loading…</span> : fmtEth(ethBalance?.value)}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          LitVM — USD conversion requires price oracle
        </div>
      </div>

      {/* LL Positions summary */}
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase' }}>
          Lester Labs Positions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Tokens',    count: tokens.length,    loading: tLoading, tab: 'tokens'    as Tab },
            { label: 'Presales',  count: presales.length,  loading: pLoading, tab: 'presales'  as Tab },
            { label: 'Vesting',   count: vestings.length,  loading: vLoading, tab: 'vesting'   as Tab },
            { label: 'Locks',     count: locks.length,     loading: lLoading, tab: 'locks'     as Tab },
          ].map(({ label, count, loading, tab }) => (
            <button
              key={tab}
              onClick={() => {/* tab switching handled by parent */}}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '16px 14px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {loading ? <span style={{ opacity: 0.4 }}>—</span> : count}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Total portfolio value — bottom */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Total Portfolio Value</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          {totalPositions === 0 && !tLoading ? 'No positions' : `${totalPositions} position${totalPositions !== 1 ? 's' : ''} across LL`}
          <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>· USD requires oracle</span>
        </div>
      </div>
    </div>
  )
}

function TokensPanel({ address }: { address: string }) {
  const { addresses, loading } = useTokenAddresses(address)
  if (loading) return <LoadingSkeleton />
  if (addresses.length === 0) return <EmptyState message="No tokens created by this wallet" />
  return (
    <div className="space-y-3">
      {addresses.map((addr) => <TokenRow key={addr} address={addr} />)}
    </div>
  )
}

function PresalesPanel({ address }: { address: string }) {
  const { addresses, loading } = useILOAddresses(address)
  if (loading) return <LoadingSkeleton />
  if (addresses.length === 0) return <EmptyState message="No presales launched by this wallet" />
  return (
    <div className="space-y-3">
      {addresses.map((addr) => <ILORow key={addr} address={addr} />)}
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
  { key: 'overview',  label: 'OVERVIEW' },
  { key: 'tokens',   label: 'TOKENS' },
  { key: 'presales', label: 'PRESALES' },
  { key: 'vesting',  label: 'VESTING' },
  { key: 'locks',    label: 'LOCKS' },
]

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

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
        {activeTab === 'overview'  && <OverviewPanel  address={address!} />}
        {activeTab === 'tokens'    && <TokensPanel   address={address!} />}
        {activeTab === 'presales' && <PresalesPanel address={address!} />}
        {activeTab === 'vesting'  && <VestingPanel  address={address!} />}
        {activeTab === 'locks'    && <LocksPanel     address={address!} />}
      </div>
    </main>
  )
}
