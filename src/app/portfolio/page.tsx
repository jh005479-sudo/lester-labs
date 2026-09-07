'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { validAddress } from '@/lib/projectJourney'
import { PortfolioActions } from '@/components/portfolio/PortfolioActions'
import { useAccount, useReadContract as useWagmiReadContract, useReadContracts, useBalance } from 'wagmi'
import { decodeEventLog, createPublicClient, http, erc20Abi, formatUnits } from 'viem'
import type { ActivityLog, ActivityPage } from '@/lib/activityIndex'
import { TOKEN_FACTORY_ABI } from '@/lib/contracts/tokenFactory'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { ResumeDashboard } from '@/components/shared/ResumeDashboard'
import {
  LITVM_LEGACY_ILO_FACTORIES,
  APPROVED_ILO_CREATION_FACTORY_ADDRESS,
  TOKEN_FACTORY_ADDRESS,
  VESTING_FACTORY_ADDRESS,
  LIQUIDITY_LOCKER_ADDRESS,
} from '@/config/contracts'
import { ILO_FACTORY_ABI, ILO_ABI, ERC20_ABI } from '@/config/abis'
import { LPPanel } from '@/components/portfolio/LPPanel'
import { SwapHistoryPanel } from '@/components/portfolio/SwapHistoryPanel'
import { litvm } from '@/config/chains'
import { LIQUIDITY_LOCKER_ABI } from '@/lib/contracts/liquidityLocker'

const useReadContract: typeof useWagmiReadContract = ((parameters: Parameters<typeof useWagmiReadContract>[0]) =>
  useWagmiReadContract({ ...parameters, chainId: litvm.id } as never)) as typeof useWagmiReadContract

// ── Types ──────────────────────────────────────────────────────────────────

interface VestingEntry {
  vestingId: string
  vestingWallet: string
  beneficiary: string
}

interface LockEntry {
  lockId: string
  lpToken: string
  amount: string
  unlockTime: string
  withdrawn: boolean
}

type Tab = 'overview' | 'tokens' | 'presales' | 'vesting' | 'locks' | 'lp' | 'swaps'

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
  contract: string,
  eventSignature: string,
  indexedAddress?: string,
  indexedPosition: 1 | 2 | 3 = 2,
): Promise<ActivityLog[]> {
  const source = contract.toLowerCase() === TOKEN_FACTORY_ADDRESS.toLowerCase() ? 'tokens'
    : contract.toLowerCase() === VESTING_FACTORY_ADDRESS.toLowerCase() ? 'vesting'
    : contract.toLowerCase() === LIQUIDITY_LOCKER_ADDRESS.toLowerCase() ? 'locks' : undefined
  if (!source) throw new Error('This activity source is unavailable.')
  const response = await fetch(`/api/activity?source=${source}`)
  if (!response.ok) throw new Error('We couldn’t load this activity. Please try again.')
  const page = await response.json() as ActivityPage
  if (!Array.isArray(page.logs)) throw new Error('Activity could not be checked.')
  return page.logs.filter((log) => log.topics[0]?.toLowerCase() === eventSignature.toLowerCase() &&
    (!indexedAddress || log.topics[indexedPosition]?.toLowerCase() === `0x${indexedAddress.slice(2).toLowerCase().padStart(64, '0')}`))
}

// Solidity keccak256 event signatures — verified against on-chain data
const TOKEN_EVENT_SIG  = '0xd5d05a8421149c74fd223cfc823befb883babf9bf0b0e4d6bf9c8fdb70e59bb4'
const VESTING_EVENT_SIG = '0xf1220882f139b8959ec281facd523bb0ca18a2a254543a2e3c3606855482fdfb'
const LOCK_EVENT_SIG    = '0xc841d5bbfd6bbee5b5afbcdd70a52778ca1aaa260339f7307f2db27865f162cc'

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Token creator scan (creator is topic 2 for TokenCreated) ────────────────
async function fetchTokensByCreator(creator: string): Promise<{ address: string; name: string; symbol: string }[]> {
  const logs = await fetchLogs(TOKEN_FACTORY_ADDRESS, TOKEN_EVENT_SIG, creator, 2)
  return logs.map((log) => {
    const { args } = decodeEventLog({ abi: TOKEN_FACTORY_ABI, eventName: 'TokenCreated', data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] })
    return { address: args.tokenAddress, name: args.name.slice(0, 80), symbol: args.symbol.slice(0, 20) }
  })
}

// Fetch canonical TokenFactory deployments created by this wallet.
function useTokenAddresses(address: string | undefined) {
  const query = useQuery({ queryKey: ['portfolio-tokens', address], enabled: Boolean(address), staleTime: 30_000,
    queryFn: () => fetchTokensByCreator(address!), retry: 1 })
  return { tokens: query.data ?? [], loading: query.isPending, error: query.error }
}

// Read current and legacy presales without granting write authority.
function useILOAddresses(address: string | undefined) {
  const { data, isLoading, error } = useReadContracts({
    contracts: Array.from(new Set([APPROVED_ILO_CREATION_FACTORY_ADDRESS, ...LITVM_LEGACY_ILO_FACTORIES.map((deployment) => deployment.address)].filter(Boolean))).map((factory) => ({
      address: factory,
      abi: ILO_FACTORY_ABI,
      functionName: 'getOwnerILOs' as const,
      args: [address as `0x${string}`] as const,
      chainId: litvm.id,
    })),
    query: { enabled: Boolean(address) },
  })
  const addresses = Array.from(new Set(
    (data ?? []).flatMap((result) => (
      result.status === 'success' ? result.result as `0x${string}`[] : []
    )),
  ))
  return { addresses, loading: isLoading, error: error ?? ((data ?? []).some((result) => result.status !== 'success') ? new Error('Some presales could not be loaded.') : null) }
}

// usePresales — returns ILO count for Overview (uses wagmi for addresses, no metadata fetch)
function usePresales(address: string | undefined) {
  const { addresses, loading, error } = useILOAddresses(address)
  return { presales: addresses, loading, error }
}

// useTokens — returns token count for Overview
function useTokens(address: string | undefined) {
  const { tokens, loading, error } = useTokenAddresses(address)
  return { tokens, loading, error }
}

function useVesting(address: string | undefined) {
  const query = useQuery({ queryKey: ['portfolio-vesting', address], enabled: Boolean(address), staleTime: 30_000, retry: 1,
    queryFn: async (): Promise<VestingEntry[]> => {
      const logs = await fetchLogs(VESTING_FACTORY_ADDRESS, VESTING_EVENT_SIG, address, 3)
      return logs.map((log) => ({ vestingId: BigInt(log.topics[1]).toString(), vestingWallet: `0x${log.topics[2].slice(26)}`, beneficiary: `0x${log.topics[3].slice(26)}` }))
    } })
  return { vestings: query.data ?? [], loading: query.isPending, error: query.error }
}

const portfolioClient = createPublicClient({ chain: litvm, transport: http(litvm.rpcUrls.default.http[0], { timeout: 6_000, retryCount: 0 }) })
function useLocks(address: string | undefined) {
  const query = useQuery({
    queryKey: ['portfolio-locks', address], enabled: Boolean(address), staleTime: 30_000, retry: 1,
    queryFn: async (): Promise<LockEntry[]> => {
      const logs = await fetchLogs(LIQUIDITY_LOCKER_ADDRESS, LOCK_EVENT_SIG)
      const entries: LockEntry[] = []
      const blockNumber = await portfolioClient.getBlockNumber()
      for (const log of logs) {
        const { args } = decodeEventLog({ abi: LIQUIDITY_LOCKER_ABI, eventName: 'LockCreated', data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]], strict: true })
        if (args.withdrawer.toLowerCase() !== address!.toLowerCase()) continue
        const lock = await portfolioClient.readContract({ address: LIQUIDITY_LOCKER_ADDRESS, abi: LIQUIDITY_LOCKER_ABI, functionName: 'getLock', args: [args.lockId], blockNumber })
        if (lock[3].toLowerCase() !== address!.toLowerCase() || lock[1] === 0n) continue
        const decimals = await portfolioClient.readContract({ address: lock[0], abi: erc20Abi, functionName: 'decimals', blockNumber })
        entries.push({ lockId: args.lockId.toString(), lpToken: lock[0], amount: decimals <= 36 ? formatUnits(lock[1], decimals) : `${lock[1]} base units`, unlockTime: lock[2] <= 8_640_000_000_000n ? new Date(Number(lock[2]) * 1000).toLocaleDateString() : 'Date unavailable', withdrawn: lock[4] })
      }
      return entries
    },
  })
  return { locks: query.data ?? [], loading: query.isPending, error: query.error }
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
      <button onClick={copy} aria-label={`Copy ${address}`} className="min-h-11 min-w-11 cursor-pointer hover:opacity-70 transition-opacity">
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

function TokenRow({ address, name: eventName, symbol: eventSymbol }: { address: string; name?: string; symbol?: string }) {
  const tokenAddr = address as `0x${string}`
  const nameRead  = useReadContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'name' })
  const symbolRead = useReadContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'symbol' })
  // Prefer on-chain read; fall back to event metadata (useful when contract is empty)
  const n = (nameRead.data as string) ?? eventName ?? '—'
  const s = (symbolRead.data as string) ?? eventSymbol ?? '—'
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
          Raised: {tr} zkLTC · Soft Cap: {sc} zkLTC
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

function OverviewPanel({ address, onSelectTab }: { address: string; onSelectTab: (tab: Tab) => void }) {
  const addr = address as `0x${string}`
  const { data: ethBalance, isLoading: ethLoading } = useBalance({ address: addr, chainId: litvm.id })

  const { tokens,    loading: tLoading, error: tError } = useTokens(address)
  const { presales,  loading: pLoading, error: pError } = usePresales(address)
  const { vestings, loading: vLoading, error: vError } = useVesting(address)
  const { locks,    loading: lLoading, error: lError } = useLocks(address)

  const totalPositions = tokens.length + presales.length + vestings.length + locks.length

  const fmtEth = (val: bigint | undefined) => {
    if (val === undefined) return '—'
    const eth = Number(val) / 1e18
    if (eth === 0) return '0 zkLTC'
    return `${eth.toLocaleString(undefined, { maximumFractionDigits: 6 })} zkLTC`
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
          zkLTC Balance
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {ethLoading ? <span style={{ opacity: 0.4 }}>Loading…</span> : fmtEth(ethBalance?.value)}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          LitVM testnet · Test tokens have no monetary value
        </div>
      </div>

      {/* LL Positions summary */}
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase' }}>
          Lester Labs Positions
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Tokens',    count: tokens.length,    loading: tLoading || Boolean(tError), tab: 'tokens'    as Tab },
            { label: 'Presales',  count: presales.length,  loading: pLoading || Boolean(pError), tab: 'presales'  as Tab },
            { label: 'Vesting',   count: vestings.length,  loading: vLoading || Boolean(vError), tab: 'vesting'   as Tab },
            { label: 'Locks',     count: locks.length,     loading: lLoading || Boolean(lError), tab: 'locks'     as Tab },
          ].map(({ label, count, loading, tab }) => (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
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
        <div style={{ fontSize: 13, fontWeight: 600 }}>Positions found</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          {tError || pError || vError || lError ? 'Some positions could not be checked' : tLoading || pLoading || vLoading || lLoading ? 'Checking…' : `${totalPositions} in the activity checked`}
          <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>· Recent activity only</span>
        </div>
      </div>
    </div>
  )
}

function TokensPanel({ address }: { address: string }) {
  const { tokens, loading, error } = useTokenAddresses(address)
  if (error) return <p role="alert" className="workspace-notice">{error.message}</p>
  if (loading) return <LoadingSkeleton />
  if (tokens.length === 0) return <EmptyState message="No tokens found in this activity page" />
  return (
    <div className="space-y-3">
      {tokens.map((t) => <TokenRow key={t.address} address={t.address} name={t.name} symbol={t.symbol} />)}
    </div>
  )
}

function PresalesPanel({ address }: { address: string }) {
  const { addresses, loading, error } = useILOAddresses(address)
  if (error) return <p role="alert" className="workspace-notice">{error.message}</p>
  if (loading) return <LoadingSkeleton />
  if (addresses.length === 0) return <EmptyState message="No presales launched by this wallet" />
  return (
    <div className="space-y-3">
      {addresses.map((addr) => <ILORow key={addr} address={addr} />)}
    </div>
  )
}

function VestingPanel({ address }: { address: string }) {
  const { vestings, loading, error } = useVesting(address)
  if (error) return <p role="alert" className="workspace-notice">{error.message}</p>
  if (loading) return <LoadingSkeleton />
  if (vestings.length === 0) return <EmptyState message="No vesting schedules found in this activity page" />
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
              Beneficiary: {truncate(v.beneficiary)}
            </div>
          </div>
          <AddressChip address={v.vestingWallet} href={`/explorer/address/${v.vestingWallet}`} />
        </div>
      ))}
    </div>
  )
}

function LocksPanel({ address }: { address: string }) {
  const { locks, loading, error } = useLocks(address)
  if (error) return <p role="alert" className="workspace-notice">{error.message}</p>
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
  { key: 'lp',       label: 'LP' },
  { key: 'swaps',    label: 'SWAPS' },
]

export default function PortfolioPage() {
  const { address: connectedAddress } = useAccount()
  const [viewedAddress, setViewedAddress] = useState('')
  const [addressInput, setAddressInput] = useState('')
  const [addressError, setAddressError] = useState('')
  useEffect(() => { queueMicrotask(() => { const value = new URLSearchParams(window.location.search).get('address'); if (validAddress(value)) { setViewedAddress(value); setAddressInput(value) } }) }, [])
  const address = validAddress(viewedAddress) ? viewedAddress : connectedAddress
  const addressForm = <form className="workspace-form workspace-panel mb-6" onSubmit={(event) => { event.preventDefault(); if (!validAddress(addressInput.trim())) { setAddressError('Enter a valid wallet address.'); return }; setAddressError(''); setViewedAddress(addressInput.trim()); window.history.replaceState(null, '', `/portfolio?address=${addressInput.trim()}`) }}><label>Wallet address<input value={addressInput} onChange={(event) => setAddressInput(event.target.value)} maxLength={42} placeholder="0x…" /></label><button className="workspace-button secondary">View portfolio</button>{addressError && <p role="alert">{addressError}</p>}</form>
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  if (!address) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
          <header className="workspace-heading"><div><h1>Your portfolio</h1><p>Enter an address to explore, or connect your wallet.</p></div></header>{addressForm}<div className="flex min-h-[40vh] items-center justify-center">
            <ConnectWalletPrompt
              body="Connect to view your tokens, presales, LP positions, locks, vesting schedules, and swap history across Lester Labs."
              previewTitle="Portfolio preview"
              previewItems={[
                { label: 'Assets', value: 'Tokens + LP', detail: 'See deployed assets and pool positions.' },
                { label: 'Protection', value: 'Locks + vesting', detail: 'Audit trust commitments from one wallet.' },
                { label: 'Activity', value: 'Swaps + presales', detail: 'Trace your Lester Labs footprint.' },
              ]}
              nextActions={[
                { href: '/launch', label: 'Factory status' },
                { href: '/explorer', label: 'Search wallet' },
              ]}
            />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
            <p className="text-white/50 text-sm mt-1">Your tokens, positions, and next steps.</p>
          </div>
          <div className="flex items-center gap-2" style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            <span>{truncate(address!, 6)}</span>
            <AddressChip address={address!} />
          </div>
        </div>

        {addressForm}<PortfolioActions key={address} address={address} /><details className="workspace-details mb-6"><summary>About your activity</summary><p>Current-contract history uses the latest archive page; older records may be missing. Missing data is not a zero balance.</p><Link href="/locker">Check legacy locks</Link> · <Link href="/vesting">Check legacy vesting</Link></details>

        <div className="mb-8">
          <ResumeDashboard />
        </div>

        {/* Tab bar */}
        <div className="flex items-end gap-0 overflow-x-auto border-b border-white/10 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative min-h-11 shrink-0 px-5 py-3 text-xs font-mono tracking-wider transition-colors duration-200"
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
        {activeTab === 'overview'  && <OverviewPanel address={address!} onSelectTab={setActiveTab} />}
        {activeTab === 'tokens'    && <TokensPanel   address={address!} />}
        {activeTab === 'presales' && <PresalesPanel address={address!} />}
        {activeTab === 'vesting'  && <VestingPanel  address={address!} />}
        {activeTab === 'locks'    && <LocksPanel     address={address!} />}
        {activeTab === 'lp'       && <LPPanel viewedAddress={address} />}
        {activeTab === 'swaps'    && <SwapHistoryPanel viewedAddress={address} />}
      </div>
    </main>
  )
}
