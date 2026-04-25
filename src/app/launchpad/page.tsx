'use client'

import { useCallback, useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { waitForTransactionReceipt } from '@wagmi/core'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { ToolHero } from '@/components/shared/ToolHero'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { decodeEventLog, parseEther, parseUnits, isAddress, formatEther } from 'viem'
import { AlertTriangle, CircleCheck, Moon, Radio, Rocket } from 'lucide-react'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { LITVM_EXPLORER_URL } from '@/lib/explorerRpc'
import { ILO_FACTORY_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { ILO_FACTORY_ABI, ILO_ABI } from '@/config/abis'
import { wagmiConfig } from '@/config/wagmi'
import { useTokenMetadata, getTokenLogoUrl } from '@/hooks/useTokenMetadata'
import { useTokenImageUrls } from '@/hooks/useTokenImageUrls'
import { useSafeWriteContract } from '@/hooks/useSafeWriteContract'

// ABI for fetching token decimals (RP-001)
const ERC20_DECIMALS_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

const ILO_CREATED_EVENT_ABI = [
  {
    type: 'event',
    name: 'ILOCreated',
    inputs: [
      { name: 'ilo', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'softCap', type: 'uint256', indexed: false },
      { name: 'hardCap', type: 'uint256', indexed: false },
    ],
  },
] as const

type Tab = 'browse' | 'create'

// Fetches all ILO addresses by count then batch-reading them
function useAllILOAddresses(count: number) {
  const calls = Array.from({ length: count }, (_, i) => ({
    address: ILO_FACTORY_ADDRESS,
    abi: ILO_FACTORY_ABI,
    functionName: 'allILOs',
    args: [BigInt(i)],
  }))

  const { data: results, isLoading } = useReadContracts({
    contracts: calls,
    query: { enabled: isValidContractAddress(ILO_FACTORY_ADDRESS) && count > 0 },
  })

  const addresses = (results ?? [])
    .map((r) => (r.status === 'success' ? (r.result as unknown as `0x${string}`) : null))
    .filter(Boolean) as `0x${string}`[]

  return { addresses, isLoading }
}

// Single ILO read result shape
type ILOData = {
  token: `0x${string}` | null
  totalRaised: bigint | null
  softCap: bigint | null
  hardCap: bigint | null
  startTime: bigint | null
  endTime: bigint | null
  liquidityBps: bigint | null
  lpLockDuration: bigint | null
  finalized: boolean | null
  cancelled: boolean | null
}

// Batch-fetch ALL data for all ILOs in ONE multicall request (9 calls × N ILOs → 1 request)
function useAllILOData(addresses: `0x${string}`[]) {
  const calls = addresses.flatMap((addr) => [
    { address: addr, abi: ILO_ABI, functionName: 'token' as const },
    { address: addr, abi: ILO_ABI, functionName: 'totalRaised' as const },
    { address: addr, abi: ILO_ABI, functionName: 'softCap' as const },
    { address: addr, abi: ILO_ABI, functionName: 'hardCap' as const },
    { address: addr, abi: ILO_ABI, functionName: 'startTime' as const },
    { address: addr, abi: ILO_ABI, functionName: 'endTime' as const },
    { address: addr, abi: ILO_ABI, functionName: 'liquidityBps' as const },
    { address: addr, abi: ILO_ABI, functionName: 'lpLockDuration' as const },
    { address: addr, abi: ILO_ABI, functionName: 'finalized' as const },
    { address: addr, abi: ILO_ABI, functionName: 'cancelled' as const },
  ])

  const { data: results, isLoading } = useReadContracts({
    contracts: calls,
    query: { enabled: addresses.length > 0 },
  })

  const iloMap = new Map<`0x${string}`, ILOData>()
  for (let i = 0; i < addresses.length; i++) {
    const base = i * 10
    const [token, totalRaised, softCap, hardCap, startTime, endTime, liquidityBps, lpLockDuration, finalized, cancelled] =
      results?.slice(base, base + 10) ?? []
    iloMap.set(addresses[i], {
      token: token?.status === 'success' ? (token.result as `0x${string}`) : null,
      totalRaised: totalRaised?.status === 'success' ? (totalRaised.result as bigint) : null,
      softCap: softCap?.status === 'success' ? (softCap.result as bigint) : null,
      hardCap: hardCap?.status === 'success' ? (hardCap.result as bigint) : null,
      startTime: startTime?.status === 'success' ? (startTime.result as bigint) : null,
      endTime: endTime?.status === 'success' ? (endTime.result as bigint) : null,
      liquidityBps: liquidityBps?.status === 'success' ? (liquidityBps.result as bigint) : null,
      lpLockDuration: lpLockDuration?.status === 'success' ? (lpLockDuration.result as bigint) : null,
      finalized: finalized?.status === 'success' ? (finalized.result as boolean) : null,
      cancelled: cancelled?.status === 'success' ? (cancelled.result as boolean) : null,
    })
  }

  return { iloMap, isLoading }
}

// Live ILO card — receives pre-fetched data as props (no individual contract reads)
function LiveILOCard({ address, data: d, meta, imageUrl, now }: { address: `0x${string}`; data: ILOData; meta?: { name: string; symbol: string }; imageUrl?: string | null; now: number }) {
  const logoUrl = imageUrl ?? getTokenLogoUrl(address)
  const livePresale = {
    address,
    name: meta?.name ?? (d.token ? `${d.token.slice(0, 6)}…` : 'Loading…'),
    symbol: meta?.symbol ?? '…',
    softCap: d.softCap ? formatEther(d.softCap) : '0',
    hardCap: d.hardCap ? formatEther(d.hardCap) : '0',
    raised: d.totalRaised ? formatEther(d.totalRaised) : '0',
    startTime: d.startTime ? Number(d.startTime) * 1000 : now,
    endTime: d.endTime ? Number(d.endTime) * 1000 : now,
    finalized: d.finalized ?? false,
    cancelled: d.cancelled ?? false,
    liquidityBps: Number(d.liquidityBps ?? 0n),
    lpLockDuration: Number(d.lpLockDuration ?? 0n),
    contributorCount: '—',
    logoUrl,
  }

  return <PresaleCard presale={livePresale as unknown as MockPresale} now={now} />
}

type MockPresale = {
  address: string; name: string; symbol: string; softCap: string; hardCap: string;
  raised: string; startTime: number; endTime: number; finalized: boolean;
  cancelled: boolean; liquidityBps: number; lpLockDuration: number;
  contributorCount: string | number; logoUrl?: string;
}

interface CreatedPresaleState {
  address: string
  txHash: `0x${string}`
}

function getLaunchpadErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const lines = err.message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const firstLine = lines[0] ?? 'An unexpected error occurred.'

    if (/user rejected|user denied|rejected the request/i.test(firstLine)) {
      return 'Transaction was rejected in the wallet.'
    }

    return firstLine.slice(0, 180)
  }

  return 'An unexpected error occurred.'
}

function CreatePresaleForm() {
  const { isConnected } = useAccount()
  const {
    ensureLitvmWrite,
    isWrongNetwork,
    isSwitchingChain,
    switchToLitvm,
    writeContractAsync,
    isPending: isSubmitting,
  } = useSafeWriteContract()

  const [form, setForm] = useState({
    tokenAddress: '',
    softCap: '',
    hardCap: '',
    tokensPerEth: '',
    startDate: '',
    endDate: '',
    liquidityPct: '60',
    lpLockDays: '180',
    whitelist: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>()
  const [successResult, setSuccessResult] = useState<CreatedPresaleState | null>(null)

  // Fetch token decimals on-chain (RP-001)
  const { data: fetchedDecimals, isLoading: isDecimalsLoading, isError: isDecimalsError } = useReadContract({
    address: isAddress(form.tokenAddress) ? (form.tokenAddress as `0x${string}`) : undefined,
    abi: ERC20_DECIMALS_ABI,
    functionName: 'decimals',
    query: {
      enabled: isAddress(form.tokenAddress),
    },
  })

  // Fetch creation fee from contract (RP-003)
  const { data: creationFee, isLoading: isFeeLoading, isError: isFeeError } = useReadContract({
    address: ILO_FACTORY_ADDRESS,
    abi: ILO_FACTORY_ABI,
    functionName: 'creationFee',
    query: {
      enabled: isValidContractAddress(ILO_FACTORY_ADDRESS),
    },
  })

  const feeDisplay = creationFee ? formatEther(creationFee) : '...'
  const tokenDecimals = fetchedDecimals

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value
      setForm((f) => ({ ...f, [k]: value }))
    }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!form.tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(form.tokenAddress)) {
      errs.tokenAddress = 'Enter a valid token address (0x...)'
    }
    if (!form.softCap || isNaN(parseFloat(form.softCap)) || parseFloat(form.softCap) <= 0) {
      errs.softCap = 'Soft cap must be greater than 0'
    }
    if (!form.hardCap || isNaN(parseFloat(form.hardCap)) || parseFloat(form.hardCap) <= 0) {
      errs.hardCap = 'Hard cap must be greater than 0'
    }
    if (parseFloat(form.hardCap) < parseFloat(form.softCap)) {
      errs.hardCap = 'Hard cap must be ≥ soft cap'
    }
    if (!form.tokensPerEth || isNaN(parseFloat(form.tokensPerEth)) || parseFloat(form.tokensPerEth) <= 0) {
      errs.tokensPerEth = 'Enter how many tokens 1 zkLTC buys'
    }
    if (!form.startDate) {
      errs.startDate = 'Select a start date'
    } else if (new Date(form.startDate).getTime() < Date.now()) {
      errs.startDate = 'Start date must be in the future'
    }
    if (!form.endDate) {
      errs.endDate = 'Select an end date'
    } else if (form.startDate && new Date(form.endDate) <= new Date(form.startDate)) {
      errs.endDate = 'End date must be after start date'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const errorStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#f87171',
    marginTop: '4px',
  }

  const iloFactoryValid = isValidContractAddress(ILO_FACTORY_ADDRESS)

  // Gate submit on successful decimals fetch (RP-001)
  const decimalsReady = tokenDecimals !== undefined && !isDecimalsError
  const feeReady = creationFee !== undefined && !isFeeLoading && !isFeeError
  const isConfirming = txStatus === 'pending' && currentTxHash !== undefined

  const handleSwitchNetwork = useCallback(async () => {
    const result = await switchToLitvm()
    if (!result.switched) {
      setModalOpen(true)
      setTxStatus('error')
      setTxMessage(result.error)
    }
  }, [switchToLitvm])

  const handleCreate = async () => {
    if (!isConnected) return
    if (!iloFactoryValid) return
    if (!validate()) return
    if (!(await ensureLitvmWrite({
      action: 'creating a presale',
      onError: (message) => {
        setModalOpen(true)
        setTxStatus('error')
        setTxMessage(message)
      },
    }))) {
      return
    }
    if (!decimalsReady || !feeReady) return // Block if decimals/fee not loaded (RP-001, RP-003)
    const startTs = Math.floor(new Date(form.startDate).getTime() / 1000)
    const endTs = Math.floor(new Date(form.endDate).getTime() / 1000)
    try {
      setModalOpen(true)
      setTxStatus('pending')
      setTxMessage('Confirm the presale creation in your wallet…')
      setCurrentTxHash(undefined)
      setSuccessResult(null)

      const hash = await writeContractAsync({
        address: ILO_FACTORY_ADDRESS,
        abi: ILO_FACTORY_ABI,
        functionName: 'createILO',
        args: [
          form.tokenAddress as `0x${string}`,
          parseEther(form.softCap || '0'),
          parseEther(form.hardCap || '0'),
          parseUnits(form.tokensPerEth || '0', tokenDecimals!),
          BigInt(startTs),
          BigInt(endTs),
          BigInt(Math.floor(parseFloat(form.liquidityPct) * 100)),
          BigInt(parseInt(form.lpLockDays) * 86400),
          form.whitelist,
        ],
        value: creationFee!,
      })

      setCurrentTxHash(hash)
      setTxMessage('Transaction submitted. Waiting for confirmation…')

      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
      if (receipt.status === 'reverted') {
        setTxStatus('error')
        setTxMessage('Transaction reverted on-chain. Please verify your presale inputs and the factory configuration, then try again.')
        return
      }

      let presaleAddress: string | undefined
      const factoryLogs = (receipt.logs || []).filter(
        (log) => log.address.toLowerCase() === ILO_FACTORY_ADDRESS.toLowerCase(),
      )

      for (const log of factoryLogs) {
        try {
          const decoded = decodeEventLog({
            abi: ILO_CREATED_EVENT_ABI,
            data: log.data,
            topics: log.topics,
          })

          if (decoded.eventName === 'ILOCreated' && 'ilo' in decoded.args) {
            presaleAddress = decoded.args.ilo as string
            break
          }
        } catch {
          // Ignore non-matching logs.
        }
      }

      if (!presaleAddress) {
        setTxStatus('error')
        setTxMessage('Transaction mined but the new presale address could not be decoded. Verify it on the explorer.')
        return
      }

      setSuccessResult({
        address: presaleAddress,
        txHash: hash,
      })
      setTxStatus('success')
      setTxMessage('Presale created successfully.')
    } catch (err: unknown) {
      setTxStatus('error')
      setTxMessage(getLaunchpadErrorMessage(err))
    }
  }

  const handleModalClose = () => {
    setModalOpen(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--muted, #111)',
    border: '1px solid var(--border, #1a1a1a)',
    borderRadius: '8px',
    color: 'var(--foreground, #fff)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div className="launchpad-create-wrap" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div
        className="analytics-card"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          padding: '32px',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
          Create Presale
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '28px',
          }}
        >
          Launch a community presale. LP is automatically created and locked
          for your chosen duration when you finalize the raise.
        </p>

        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Token Address */}
          <div>
            <label style={labelStyle}>Token Address</label>
            <input
              style={inputStyle}
              placeholder="0x..."
              value={form.tokenAddress}
              onChange={set('tokenAddress')}
            />
            {errors.tokenAddress && <div style={errorStyle}>{errors.tokenAddress}</div>}
          </div>

          {/* Caps */}
          <div
            className="launchpad-grid-two"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <div>
              <label style={labelStyle}>Soft Cap (zkLTC)</label>
              <input
                style={inputStyle}
                type="number"
                placeholder="10"
                value={form.softCap}
                onChange={set('softCap')}
              />
              {errors.softCap && <div style={errorStyle}>{errors.softCap}</div>}
            </div>
            <div>
              <label style={labelStyle}>Hard Cap (zkLTC)</label>
              <input
                style={inputStyle}
                type="number"
                placeholder="50"
                value={form.hardCap}
                onChange={set('hardCap')}
              />
              {errors.hardCap && <div style={errorStyle}>{errors.hardCap}</div>}
            </div>
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>Tokens per zkLTC</label>
            <input
              style={inputStyle}
              type="number"
              placeholder="1000000"
              value={form.tokensPerEth}
              onChange={set('tokensPerEth')}
            />
            {errors.tokensPerEth && <div style={errorStyle}>{errors.tokensPerEth}</div>}
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
              e.g. 1,000,000 means contributors get 1M tokens per 1 zkLTC raised
            </p>
            {/* RP-001: Token decimals UI note */}
            {isAddress(form.tokenAddress) && (
              <p style={{ fontSize: '11px', color: isDecimalsError ? '#f87171' : 'rgba(99,102,241,0.8)', marginTop: '4px' }}>
                {isDecimalsLoading
                  ? 'Fetching token decimals...'
                  : isDecimalsError
                  ? 'Failed to fetch token decimals - check token address'
                  : `Uses token decimals fetched from contract (${tokenDecimals})`}
              </p>
            )}
          </div>

          {/* Dates */}
          <div
            className="launchpad-grid-two"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <div>
              <label style={labelStyle}>Start Date</label>
              <input
                style={inputStyle}
                type="datetime-local"
                value={form.startDate}
                onChange={set('startDate')}
              />
              {errors.startDate && <div style={errorStyle}>{errors.startDate}</div>}
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input
                style={inputStyle}
                type="datetime-local"
                value={form.endDate}
                onChange={set('endDate')}
              />
              {errors.endDate && <div style={errorStyle}>{errors.endDate}</div>}
            </div>
          </div>

          {/* Liquidity % */}
          <div>
            <label style={labelStyle}>
              Liquidity Allocation — {form.liquidityPct}%
            </label>
            <input
              style={{ ...inputStyle, padding: '6px 14px' }}
              type="range"
              min="50"
              max="100"
              step="5"
              value={form.liquidityPct}
              onChange={set('liquidityPct')}
            />
            <p
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.3)',
                marginTop: '4px',
              }}
            >
              % of raised zkLTC that goes to LP. Minimum 50%.
            </p>
          </div>

          {/* LP Lock */}
          <div>
            <label style={labelStyle}>LP Lock Duration</label>
            <select
              style={inputStyle}
              value={form.lpLockDays}
              onChange={set('lpLockDays')}
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days (recommended)</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
            </select>
          </div>

          {/* Whitelist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              id="wl"
              type="checkbox"
              checked={form.whitelist}
              onChange={set('whitelist')}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            <label
              htmlFor="wl"
              style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
              }}
            >
              Enable whitelist (you control who can contribute)
            </label>
          </div>

          {/* Fee note (RP-003: live fee from contract) */}
          <div
            style={{
              padding: '14px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Creation fee:{' '}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{feeDisplay} zkLTC</strong>{' '}
            · Platform fee:{' '}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>2% of raise</strong>{' '}
            at finalization
          </div>

          {/* Contract address guard warning */}
          {!iloFactoryValid && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} />
                ILO Factory contract not deployed on this network. Presale creation is disabled.
              </span>
            </div>
          )}

          {/* RP-001: Error if decimals fetch fails */}
          {isDecimalsError && isAddress(form.tokenAddress) && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
            }}>
              Failed to fetch token decimals. Please verify the token address is a valid ERC20 contract.
            </div>
          )}

          {isWrongNetwork && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: '8px',
              color: '#fbbf24',
              fontSize: '13px',
            }}>
              Wallet is connected to the wrong network. Switch to LitVM Testnet (Chain ID 4441) before creating a presale.
            </div>
          )}

          {isFeeError && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
            }}>
              Failed to load the launchpad creation fee from the ILO Factory. Check your LitVM network connection and try again.
            </div>
          )}

          {!isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button
                  onClick={openConnectModal}
                  disabled={!mounted}
                  style={{
                    padding: '14px',
                    background: mounted ? 'var(--accent)' : 'rgba(99,102,241,0.3)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: mounted ? 'pointer' : 'not-allowed',
                    transition: 'opacity 0.2s',
                  }}
                >
                  Connect Wallet
                </button>
              )}
            </ConnectButton.Custom>
          ) : isWrongNetwork ? (
            <button
              onClick={handleSwitchNetwork}
              disabled={isSwitchingChain}
              style={{
                padding: '14px',
                background: isSwitchingChain ? 'rgba(251,191,36,0.35)' : 'rgba(251,191,36,0.92)',
                border: 'none',
                borderRadius: '8px',
                color: '#111827',
                fontSize: '15px',
                fontWeight: 700,
                cursor: isSwitchingChain ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {isSwitchingChain ? 'Switching network…' : 'Switch to LitVM Testnet'}
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!iloFactoryValid || isSubmitting || isConfirming || !decimalsReady || !feeReady}
              style={{
                padding: '14px',
                background:
                  !iloFactoryValid || isSubmitting || isConfirming || !decimalsReady || !feeReady
                    ? 'rgba(99,102,241,0.3)'
                    : 'var(--accent)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor:
                  !iloFactoryValid || isSubmitting || isConfirming || !decimalsReady || !feeReady
                    ? 'not-allowed'
                    : 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {isSubmitting
                ? 'Confirm in wallet…'
                : isConfirming
                  ? 'Creating presale…'
                  : isDecimalsLoading
                    ? 'Loading token decimals…'
                    : isFeeLoading
                      ? 'Loading fee…'
                      : `Create Presale — ${feeDisplay} zkLTC`}
            </button>
          )}

          {successResult && (
            <div style={{ padding: '16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', fontSize: '14px', color: '#4ade80' }}>
              <div style={{ fontWeight: 700, marginBottom: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <CircleCheck size={16} /> Presale created successfully!
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Presale:</span>{' '}
                  <a href={`${LITVM_EXPLORER_URL}/address/${successResult.address}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '12px' }}>
                    {successResult.address.slice(0, 10)}…{successResult.address.slice(-8)}
                  </a>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Tx:</span>{' '}
                  <a href={`${LITVM_EXPLORER_URL}/tx/${successResult.txHash}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '12px' }}>
                    {successResult.txHash.slice(0, 10)}…{successResult.txHash.slice(-8)}
                  </a>
                </div>
                <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)' }}>
                  Your presale contract is deployed. Finish setup on the presale page by funding sale tokens, loading a whitelist if needed, and then share it with your community. Finalization will create the Lester DEX pool when the raise closes.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                <Link
                  href={`/launchpad/${successResult.address}`}
                  style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
                >
                  Manage presale
                </Link>
                <button
                  onClick={() => {
                    setForm({ tokenAddress: '', softCap: '', hardCap: '', tokensPerEth: '', startDate: '', endDate: '', liquidityPct: '60', lpLockDays: '180', whitelist: false })
                    setCurrentTxHash(undefined)
                    setSuccessResult(null)
                    setTxMessage(undefined)
                    setTxStatus('pending')
                  }}
                  style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer' }}
                >
                  Create another presale
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TxStatusModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        status={txStatus}
        txHash={currentTxHash}
        contractAddress={successResult?.address}
        message={txMessage}
        onRetry={txStatus === 'error' ? handleCreate : undefined}
      />
    </div>
  )
}

function PresaleCard({ presale, now }: { presale: MockPresale; now: number }) {
  const progress =
    parseFloat(presale.raised) / parseFloat(presale.hardCap)
  const progressPct = Math.min(100, parseFloat((progress * 100).toFixed(2)))
  const timeLeft = presale.endTime - now
  const daysLeft = Math.max(0, Math.floor(timeLeft / 86400000))
  const hoursLeft = Math.max(
    0,
    Math.floor((timeLeft % 86400000) / 3600000),
  )
  const status = presale.finalized
    ? 'Finalized'
    : presale.cancelled
      ? 'Cancelled'
      : timeLeft > 0
        ? 'Live'
        : 'Ended'
  const statusColor =
    status === 'Live'
      ? '#4ade80'
      : status === 'Finalized'
        ? '#818cf8'
        : '#f87171'

  return (
    <Link
      href={'/launchpad/' + presale.address}
      className="analytics-card"
      style={{
        background: '#12192e',
        border: '1px solid #1e2a45',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        textDecoration: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2d3a55')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2a45')}
    >
      {/* Header row: PFP + Name/Symbol + zkLTC */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Token PFP */}
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            overflow: 'hidden',
            flexShrink: 0,
            background: '#1a2040',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {presale.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={presale.logoUrl}
              alt={presale.name}
              width={44}
              height={44}
              style={{ objectFit: 'cover', borderRadius: '8px' }}
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#a78bfa' }}>
              {presale.symbol.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name + Symbol */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {presale.name}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: '#a78bfa',
              marginTop: '1px',
            }}
          >
            {'$'}{presale.symbol}
          </div>
        </div>

        {/* zkLTC badge */}
        <span
          style={{
            fontSize: '11px',
            color: '#6b7280',
            background: 'rgba(255,255,255,0.05)',
            padding: '3px 8px',
            borderRadius: '20px',
            flexShrink: 0,
          }}
        >
          zkLTC
        </span>
      </div>

      {/* Market cap row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
        }}
      >
        <span style={{ color: '#9ca3af' }}>Market Cap</span>
        <span style={{ color: '#e5e7eb', fontWeight: 500 }}>
          {'$'}{(parseFloat(presale.raised) * 50).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>

      {/* Multi-color gradient progress bar */}
      <div>
        <div
          style={{
            height: '6px',
            background: '#1e2a45',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: progressPct + '%',
              background:
                'linear-gradient(to right, #ff6eb4, #a855f7, #3b82f6, #06b6d4, #22c55e)',
              borderRadius: '3px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#6b7280',
            marginTop: '4px',
          }}
        >
          <span>
            {parseFloat(presale.raised).toFixed(2)} / {presale.hardCap} zkLTC
          </span>
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Footer: status + details + CTA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '3px 8px',
              background: statusColor + '22',
              border: '1px solid ' + statusColor + '44',
              borderRadius: '20px',
              fontSize: '11px',
              color: statusColor,
              fontWeight: 600,
            }}
          >
            ● {status}
          </span>
          <span style={{ color: '#6b7280' }}>
            {status === 'Live'
              ? daysLeft + 'd ' + hoursLeft + 'h left'
              : '—'}
          </span>
        </div>
        <span
          style={{
            padding: '4px 12px',
            background: 'transparent',
            border: '1px solid #5E6AD2',
            borderRadius: '6px',
            color: '#5E6AD2',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          View →
        </span>
      </div>
    </Link>
  )
}
export default function LaunchpadPage() {
  const [tab, setTab] = useState<Tab>('browse')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 60000)

    return () => window.clearInterval(interval)
  }, [])

  const iloCount = useReadContract({
    address: ILO_FACTORY_ADDRESS,
    abi: ILO_FACTORY_ABI,
    functionName: 'getILOCount',
    query: { enabled: isValidContractAddress(ILO_FACTORY_ADDRESS) },
  })
  const liveCount = Number(iloCount.data ?? 0)
  const { addresses: liveAddresses, isLoading: iloLoading } = useAllILOAddresses(liveCount)

  // Batch-fetch all ILO data in ONE multicall (replaces per-card individual reads)
  const { iloMap, isLoading: iloDataLoading } = useAllILOData(liveAddresses)

  // Extract token addresses from ILO data for metadata lookup
  const tokenAddresses = Array.from(new Set(
    Array.from(iloMap.values())
      .map(d => d.token)
      .filter((t): t is `0x${string}` => t !== null)
  ))

  // Fetch token name/symbol from TokenFactory events (keyed by token address)
  const { metaMap: tokenMetaMap } = useTokenMetadata(tokenAddresses)

  // Load user-uploaded token logos from IndexedDB
  const tokenImageUrls = useTokenImageUrls()

  // Compute total raised from batch-fetched data (no additional requests)
  const totalRaisedBigint = Array.from(iloMap.values()).reduce<bigint>(
    (sum, d) => sum + (d.totalRaised ?? 0n),
    0n,
  )
  const totalRaised = totalRaisedBigint > 0n ? formatEther(totalRaisedBigint) : '—'

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <Navbar />
      <ToolHero
        category="Presale Platform"
        title="Lester"
        titleHighlight="Launch"
        subtitle="Community presales with automatic LP creation and locking at finalization. Self-service, permissionless, contract-enforced."
        subtitleMaxWidth="560px"
        color="#5E6AD2"
        image="/images/carousel/launchpad.png"
        imagePosition="center 18%"
        imageTopFade={false}
        compact
        flowKey="launchpad"
        stats={[
          { label: 'Mode', value: 'Permissionless' },
          { label: 'LP', value: 'Auto-created' },
          { label: 'Fee', value: '2% of raise' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '1120px', paddingTop: 40 }}>

        {/* Launchpad at-a-glance stats */}
        <div
          className="launchpad-stats-grid"
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            gap: '34px',
            marginBottom: '38px',
            flexWrap: 'wrap',
          }}
        >
          {(
            [
              ['Total Presales', iloLoading ? '…' : liveCount.toString()],
              ['Total Raised', iloLoading ? '…' : totalRaised],
              ['Platform Fee', '2%'],
            ] as [string, string][]
          ).map(([label, value], i, arr) => (
            <div
              key={label}
              className="launchpad-stat-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '34px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '30px',
                    fontWeight: 800,
                    lineHeight: 1,
                    color: '#F0EEF5',
                    marginBottom: '7px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'rgba(240,238,245,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 650,
                  }}
                >
                  {label}
                </div>
              </div>
              {i < arr.length - 1 && (
                <div
                  className="launchpad-stat-sep"
                  style={{
                    width: '1px',
                    height: '40px',
                    background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.14), transparent)',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div
          className="launchpad-tab-row"
          style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '36px',
            background: 'var(--surface-1)',
            padding: '4px',
            borderRadius: '10px',
            width: 'fit-content',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {(['browse', 'create'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="launchpad-tab-btn"
              style={{
                padding: '8px 20px',
                background:
                  tab === t ? 'var(--accent)' : 'transparent',
                border: 'none',
                borderRadius: '7px',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {t === 'browse' ? <Radio size={14} /> : <Rocket size={14} />}
                {t === 'browse' ? 'Browse Presales' : 'Create Presale'}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'browse' ? (
          <div>
            {iloLoading || iloDataLoading ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                Loading presales from contract…
              </div>
            ) : liveAddresses.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '80px 20px',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                <div style={{ marginBottom: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Moon size={34} color="rgba(255,255,255,0.45)" />
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    marginBottom: '8px',
                  }}
                >
                  No active presales
                </div>
                <div style={{ fontSize: '14px' }}>
                  Be the first to launch on LitVM
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: '20px',
                }}
              >
                {liveAddresses.map((addr) => {
                  const iloData = iloMap.get(addr)
                  if (!iloData || !iloData.token) return null
                  return (
                    <LiveILOCard
                      key={addr}
                      address={addr}
                      data={iloData}
                      meta={tokenMetaMap.get(iloData.token.toLowerCase())}
                      imageUrl={tokenImageUrls.get(iloData.token.toLowerCase()) ?? null}
                      now={now}
                    />
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <CreatePresaleForm />
        )}
      </div>
    </div>
  )
}
