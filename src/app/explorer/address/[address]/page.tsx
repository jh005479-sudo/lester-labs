'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { Copy, ExternalLink, Eye, EyeOff, Check, ArrowRight, FileCode, Coins } from 'lucide-react'
import {
  formatEtherFromHex, hexToNumber, hexToBigInt,
  getLatestBlockNumber, getBlockByNumber,
  LITVM_EXPLORER_URL, LITVM_RPC_URL,
} from '@/lib/explorerRpc'
import { getLabel, inferLabel, decodeMethod, METHOD_SIGS } from '@/lib/address-labels'

// --- RPC helpers ---
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(LITVM_RPC_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  })
  const data = (await res.json()) as { result?: T; error?: { message: string } }
  if (data.error) throw new Error(data.error.message)
  return data.result as T
}

const ERC20_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
]

function encodeFunction(name: string): string {
  const selectors: Record<string, string> = {
    'name': '0x06fdde03',
    'symbol': '0x95d89b41',
    'decimals': '0x313ce567',
    'totalSupply': '0x18160ddd',
    'balanceOf': '0x70a08231',
    'owner': '0x8da5cb5b',
  }
  return selectors[name] || ''
}

async function ethCall(to: string, data: string): Promise<string | null> {
  try { return await rpc<string>('eth_call', [{ to, data }, 'latest']) } catch { return null }
}

function decodeStr(hex: string | null) {
  if (!hex || hex.length < 130) return null
  try {
    const len = parseInt(hex.slice(66, 130), 16)
    return Buffer.from(hex.slice(130, 130 + len * 2), 'hex').toString('utf8')
  } catch { return null }
}

async function getERC20Meta(tokenAddr: string) {
  const [name, symbol, decimals] = await Promise.all([
    ethCall(tokenAddr, encodeFunction('name')),
    ethCall(tokenAddr, encodeFunction('symbol')),
    ethCall(tokenAddr, encodeFunction('decimals')),
  ])
  const decodeNum = (hex: string | null) => hex ? parseInt(hex, 16) : null
  return {
    name: decodeStr(name),
    symbol: decodeStr(symbol),
    decimals: decodeNum(decimals) ?? 18,
  }
}

async function getERC20Balance(tokenAddr: string, wallet: string): Promise<bigint | null> {
  const data = encodeFunction('balanceOf') + wallet.slice(2).padStart(64, '0')
  const res = await ethCall(tokenAddr, data)
  if (!res) return null
  return BigInt(res)
}

interface TxInfo {
  hash: string
  from: string
  to: string
  value: string
  input: string
  timestamp: number
  blockNumber: number
  status: 'Success' | 'Failed' | 'Pending'
  method: string
}

interface TokenHold {
  address: string
  name: string | null
  symbol: string | null
  balance: string
  decimals: number
}

interface ContractInfo {
  isContract: boolean
  bytecodeSize: number
  creatorTx: string | null
  creator: string | null
}

const PAGE_SIZE = 20

export default function AddressPage() {
  const params = useParams()
  const rawAddress = params.address as string
  if (!/^0x[0-9a-fA-F]{40}$/.test(rawAddress)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Address</h1>
          <p className="text-white/60">Addresses must be 42 hexadecimal characters starting with 0x</p>
          <Link href="/explorer" className="text-[var(--accent)] mt-4 inline-block">Return to Explorer</Link>
        </div>
      </div>
    )
  }
  const address = rawAddress.toLowerCase()

  const [balance, setBalance] = useState<string>('0')
  const [label, setLabel] = useState<{ label: string; type: string; description: string } | null>(null)
  const [flowSummary, setFlowSummary] = useState<{
    received: number; receivedCount: number;
    sent: number; sentCount: number;
    topCounterparties: Array<{ address: string; volume: number; direction: 'in' | 'out' | 'both' }>
  } | null>(null)
  const [txs, setTxs] = useState<TxInfo[]>([])
  const [txPage, setTxPage] = useState(0)
  const [totalTxCount, setTotalTxCount] = useState(0)
  const [tokens, setTokens] = useState<TokenHold[]>([])
  const [contract, setContract] = useState<ContractInfo>({ isContract: false, bytecodeSize: 0, creatorTx: null, creator: null })
  const [contractMeta, setContractMeta] = useState<{ name: string | null; symbol: string | null; decimals: number | null; totalSupply: string | null } | null>(null)
  const [watching, setWatching] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'transactions' | 'tokens' | 'contract'>('transactions')
  const [loading, setLoading] = useState(true)
  const [firstSeen, setFirstSeen] = useState<number | null>(null)
  const [lastSeen, setLastSeen] = useState<number | null>(null)

  useEffect(() => {
    const watched: string[] = JSON.parse(localStorage.getItem('watchedAddresses') || '[]')
    setWatching(watched.includes(address))
  }, [address])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        // Balance
        const bal = await rpc<string>('eth_getBalance', [address, 'latest'])
        if (!active) return
        setBalance(formatEtherFromHex(bal))

        // Check if contract
        const code = await rpc<string>('eth_getCode', [address, 'latest'])
        const isContract = code !== '0x' && code !== '0x0'
        const bytecodeSize = isContract ? (code.length - 2) / 2 : 0
        if (!active) return
        setContract({ isContract, bytecodeSize, creatorTx: null, creator: null })

        // If contract, try ERC20 metadata
        if (isContract) {
          const [name, symbol, decimals, totalSupply] = await Promise.all([
            ethCall(address, encodeFunction('name')),
            ethCall(address, encodeFunction('symbol')),
            ethCall(address, encodeFunction('decimals')),
            ethCall(address, encodeFunction('totalSupply')),
          ])
          if (!active) return
          const decodeStr = (hex: string | null) => {
            if (!hex || hex.length < 130) return null
            try {
              const len = parseInt(hex.slice(66, 130), 16)
              return Buffer.from(hex.slice(130, 130 + len * 2), 'hex').toString('utf8')
            } catch { return null }
          }
          setContractMeta({
            name: decodeStr(name),
            symbol: decodeStr(symbol),
            decimals: decimals ? parseInt(decimals, 16) : null,
            totalSupply: totalSupply ? formatEtherFromHex(totalSupply) : null,
          })
        }

        // Scan recent blocks for transactions involving this address
        const latest = await getLatestBlockNumber()
        if (!active) return

        const foundTxs: TxInfo[] = []
        let firstSeenTs: number | null = null
        let lastSeenTs: number | null = null
        const seenHashes = new Set<string>()
        const tokenAddresses = new Set<string>()
        const SCAN_BLOCKS = 200

        // Also query Transfer events (address(0) → wallet) to catch minted tokens
        const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
        const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
        try {
          const mintsR = await rpc<any[]>('eth_getLogs', [{
            topics: [
              TRANSFER_SIG,
              '0x' + ZERO_ADDR.slice(2).padStart(64, '0'),
              '0x' + address.slice(2).padStart(64, '0'),
            ],
            fromBlock: '0x1',
            toBlock: 'latest',
          }])
          if (mintsR) {
            for (const log of mintsR) {
              if (log.address) tokenAddresses.add(log.address.toLowerCase())
            }
          }
        } catch { /* RPC limit or error — block scan still works */ }

        for (let batchStart = latest; batchStart > Math.max(0, latest - SCAN_BLOCKS) && foundTxs.length < 100; batchStart -= 10) {
          const batch = await Promise.all(
            Array.from({ length: 10 }, (_, i) => batchStart - i).filter(n => n >= 0).map(n => getBlockByNumber(n, true))
          )
          for (const block of batch) {
            if (!block?.transactions) continue
            const blockTs = hexToNumber(block.timestamp)
            for (const tx of block.transactions) {
              const txObj = typeof tx === 'string' ? null : tx
              if (!txObj) continue
              const from = (txObj.from || '').toLowerCase()
              const to = (txObj.to || '').toLowerCase()
              if (from !== address && to !== address) continue
              if (seenHashes.has(txObj.hash)) continue
              seenHashes.add(txObj.hash)

              // Check for ERC-20 Transfer events to detect tokens
              const input = txObj.input || '0x'
              if (input.startsWith('0xa9059cbb') && input.length >= 138) {
                const recipient = '0x' + input.slice(34, 74)
                if (recipient.toLowerCase() === address || from === address) {
                  tokenAddresses.add(to)
                }
              }

              foundTxs.push({
                hash: txObj.hash,
                from: txObj.from,
                to: txObj.to || '',
                value: formatEtherFromHex(txObj.value),
                input,
                timestamp: blockTs,
                blockNumber: hexToNumber(block.number),
                status: 'Success',
                method: decodeMethod(input),
              })

              if (!lastSeenTs) lastSeenTs = blockTs
              firstSeenTs = blockTs
            }
          }
        }

        if (!active) return
        const sortedTxs = foundTxs.sort((a, b) => b.timestamp - a.timestamp)
        setTxs(sortedTxs)
        setTotalTxCount(sortedTxs.length)
        setFirstSeen(firstSeenTs)
        setLastSeen(lastSeenTs)

        // Build flow summary
        let received = 0, receivedCount = 0, sent = 0, sentCount = 0
        const cpVolume = new Map<string, { vol: number; lastDir: 'in' | 'out' }>()
        for (const tx of sortedTxs) {
          const from = (tx.from || '').toLowerCase()
          const to = (tx.to || '').toLowerCase()
          const val = parseFloat(tx.value) || 0
          if (to === address) {
            received += val; receivedCount++
            const prev = cpVolume.get(from)
            cpVolume.set(from, { vol: (prev?.vol ?? 0) + val, lastDir: 'in' })
          } else if (from === address) {
            sent += val; sentCount++
            const prev = cpVolume.get(to)
            cpVolume.set(to, { vol: (prev?.vol ?? 0) + val, lastDir: 'out' })
          }
        }
        const topCounterparties = Array.from(cpVolume.entries())
          .sort((a, b) => b[1].vol - a[1].vol)
          .slice(0, 3)
          .map(([addr, { vol, lastDir }]) => ({ address: addr, volume: vol, direction: lastDir }))
        setFlowSummary({ received, receivedCount, sent, sentCount, topCounterparties })

        // Label
        setLabel(inferLabel(address, foundTxs.length))

        // Token holdings
        const tokenHoldings: TokenHold[] = []
        for (const tokenAddr of Array.from(tokenAddresses).slice(0, 10)) {
          const [meta, bal] = await Promise.all([getERC20Meta(tokenAddr), getERC20Balance(tokenAddr, address)])
          if (!bal || bal === 0n) continue
          const dec = meta?.decimals ?? 18
          const display = Number(bal) / Math.pow(10, dec)
          tokenHoldings.push({
            address: tokenAddr,
            name: meta?.name ?? null,
            symbol: meta?.symbol ?? null,
            balance: display.toLocaleString(undefined, { maximumFractionDigits: 6 }),
            decimals: dec,
          })
        }
        if (!active) return
        setTokens(tokenHoldings)
      } catch (e) {
        console.error('Address page load error:', e)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [address])

  const toggleWatch = () => {
    const watched = JSON.parse(localStorage.getItem('watchedAddresses') || '[]') as string[]
    const filtered = watched.filter(a => a !== address)
    const updated = watched.includes(address) ? filtered : [...filtered, address].slice(0, 50) // Max 50
    localStorage.setItem('watchedAddresses', JSON.stringify(updated))
    setWatching(!watching)
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTs = (ts: number | null) => {
    if (!ts) return 'Unknown'
    return new Date(ts * 1000).toLocaleString()
  }

  const paginatedTxs = txs.slice(txPage * PAGE_SIZE, (txPage + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(txs.length / PAGE_SIZE)

  const labelColor: Record<string, string> = {
    protocol: 'text-blue-400 bg-blue-400/10',
    bridge: 'text-purple-400 bg-purple-400/10',
    deployer: 'text-yellow-400 bg-yellow-400/10',
    token: 'text-green-400 bg-green-400/10',
    multisig: 'text-orange-400 bg-orange-400/10',
    faucet: 'text-cyan-400 bg-cyan-400/10',
    exchange: 'text-pink-400 bg-pink-400/10',
    unknown: 'text-white/50 bg-white/5',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <Navbar /><LTCBanner />
        <main className="mx-auto max-w-7xl px-4 pt-40 pb-20 sm:px-6 lg:px-8">
          <div className="text-center text-white/40 py-20">Loading address data...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Navbar /><LTCBanner />

      <main className="mx-auto max-w-7xl px-4 pt-40 pb-20 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-white">Address</h1>
              {label && label.label !== 'Unknown' && (
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${labelColor[label.type] ?? labelColor.unknown}`}>
                  {label.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleWatch} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors">
                {watching ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {watching ? 'Unwatch' : 'Watch'}
              </button>
              <button onClick={copyAddress} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <a href={`${LITVM_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" /> Lester Labs Explorer
              </a>
            </div>
          </div>

          <p className="font-mono text-sm text-white/80 break-all mb-4">{address}</p>
          {label?.description && <p className="text-xs text-white/40 mb-4">{label.description}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Balance</p>
              <p className="text-lg font-semibold font-mono text-white">{balance} zkLTC</p>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Transactions</p>
              <p className="text-lg font-semibold font-mono text-white">{totalTxCount}</p>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">First Seen</p>
              <p className="text-sm font-mono text-white/70">{formatTs(firstSeen)}</p>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Last Seen</p>
              <p className="text-sm font-mono text-white/70">{formatTs(lastSeen)}</p>
            </div>
          </div>
        </div>

        {/* Transaction Flow Summary */}
        {flowSummary && (flowSummary.received > 0 || flowSummary.sent > 0) && (
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5 mb-6">
            <h2 className="text-sm font-medium text-white/50 mb-4">Transaction Flow</h2>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-5 text-sm">
              <div className="flex flex-col items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20 min-w-[110px]">
                <span className="text-green-400 font-mono font-bold">{flowSummary.received.toFixed(4)}</span>
                <span className="text-green-400/70 text-xs">zkLTC received</span>
                <span className="text-white/30 text-xs">{flowSummary.receivedCount} sources</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ArrowRight className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 min-w-[110px]">
                <span className="font-mono text-xs text-white/50 break-all text-center">{address.slice(0, 6)}...{address.slice(-4)}</span>
                <span className="text-white/40 text-xs mt-1">This address</span>
                <span className="font-mono font-bold text-white text-sm">{balance} zkLTC</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ArrowRight className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20 min-w-[110px]">
                <span className="text-red-400 font-mono font-bold">{flowSummary.sent.toFixed(4)}</span>
                <span className="text-red-400/70 text-xs">zkLTC sent</span>
                <span className="text-white/30 text-xs">{flowSummary.sentCount} destinations</span>
              </div>
            </div>
            {flowSummary.topCounterparties.length > 0 && (
              <div>
                <p className="text-xs text-white/30 mb-2">Top counterparties by volume</p>
                <div className="space-y-1.5">
                  {flowSummary.topCounterparties.map((cp, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cp.direction === 'in' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <Link href={`/explorer/address/${cp.address}`} className="font-mono text-[var(--accent)] hover:underline flex-1">
                        {cp.address.slice(0, 10)}...{cp.address.slice(-6)}
                      </Link>
                      <span className="text-white/60 font-mono">{cp.volume.toFixed(4)} zkLTC</span>
                      <span className={`text-xs ${cp.direction === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                        {cp.direction === 'in' ? '↓ recv' : '↑ sent'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contract Info */}
        {contract.isContract && (
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileCode className="h-5 w-5 text-[var(--accent)]" /> Contract
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">Bytecode Size</p>
                <p className="text-sm font-mono text-white">{contract.bytecodeSize.toLocaleString()} bytes</p>
              </div>
              {contractMeta?.name && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">Token Name</p>
                  <p className="text-sm font-mono text-white">{contractMeta.name}</p>
                </div>
              )}
              {contractMeta?.symbol && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">Symbol</p>
                  <p className="text-sm font-mono text-white">{contractMeta.symbol}</p>
                </div>
              )}
              {contractMeta?.decimals != null && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">Decimals</p>
                  <p className="text-sm font-mono text-white">{contractMeta.decimals}</p>
                </div>
              )}
              {contractMeta?.totalSupply && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">Total Supply</p>
                  <p className="text-sm font-mono text-white">{contractMeta.totalSupply}</p>
                </div>
              )}
            </div>
            <button className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors">
              Verify Contract (Coming Soon)
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/10">
          {(['transactions', 'tokens', ...(contract.isContract ? ['contract'] : [])] as ('transactions' | 'tokens' | 'contract')[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm capitalize transition-colors ${
                activeTab === tab ? 'text-white border-b-2 border-[var(--accent)]' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab === 'transactions' ? `Transactions (${totalTxCount})` : tab === 'tokens' ? `Tokens (${tokens.length})` : 'Contract'}
            </button>
          ))}
        </div>

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/40 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Tx Hash</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">From → To</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedTxs.map(tx => (
                    <tr key={tx.hash} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-[var(--accent)]">
                        <Link href={`/explorer/tx/${tx.hash}`} className="hover:underline">
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-mono text-white/70">{tx.method}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/60">
                        <Link href={`/explorer/address/${tx.from}`} className="text-[var(--accent)] hover:underline">{tx.from.slice(0, 6)}...{tx.from.slice(-4)}</Link>
                        <span className="mx-1 text-white/30">→</span>
                        {tx.to ? (
                          <Link href={`/explorer/address/${tx.to}`} className="text-[var(--accent)] hover:underline">{tx.to.slice(0, 6)}...{tx.to.slice(-4)}</Link>
                        ) : 'Contract Create'}
                      </td>
                      <td className="px-4 py-3 font-mono text-white/70">{tx.value} zkLTC</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{new Date(tx.timestamp * 1000).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                  {paginatedTxs.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">No transactions found in recent blocks</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                <button onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0}
                  className="text-xs text-white/40 hover:text-white disabled:opacity-30">Previous</button>
                <span className="text-xs text-white/40">Page {txPage + 1} of {totalPages}</span>
                <button onClick={() => setTxPage(p => Math.min(totalPages - 1, p + 1))} disabled={txPage >= totalPages - 1}
                  className="text-xs text-white/40 hover:text-white disabled:opacity-30">Next</button>
              </div>
            )}
          </div>
        )}

        {/* Tokens Tab */}
        {activeTab === 'tokens' && (
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
              <Coins className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="font-semibold text-white">Token Holdings</h3>
            </div>
            {tokens.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/30">No ERC-20 token holdings detected in recent transactions</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/40 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tokens.map(t => (
                    <tr key={t.address} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{t.name || 'Unknown'}</span>
                        {t.symbol && <span className="text-white/40 ml-2 text-xs">({t.symbol})</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-white/70">{t.balance}</td>
                      <td className="px-4 py-3">
                        <Link href={`/explorer/address/${t.address}`} className="font-mono text-xs text-[var(--accent)] hover:underline">
                          {t.address.slice(0, 6)}...{t.address.slice(-4)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Contract Tab */}
        {activeTab === 'contract' && contract.isContract && (
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
            <h3 className="font-semibold text-white mb-4">Read Contract</h3>
            {contractMeta ? (
              <div className="space-y-3">
                {contractMeta.name && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/40 text-sm">name</span>
                    <span className="font-mono text-sm text-white">{contractMeta.name}</span>
                  </div>
                )}
                {contractMeta.symbol && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/40 text-sm">symbol</span>
                    <span className="font-mono text-sm text-white">{contractMeta.symbol}</span>
                  </div>
                )}
                {contractMeta.decimals != null && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/40 text-sm">decimals</span>
                    <span className="font-mono text-sm text-white">{contractMeta.decimals}</span>
                  </div>
                )}
                {contractMeta.totalSupply && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/40 text-sm">totalSupply</span>
                    <span className="font-mono text-sm text-white">{contractMeta.totalSupply}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-white/30 text-sm">Could not read contract metadata</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
