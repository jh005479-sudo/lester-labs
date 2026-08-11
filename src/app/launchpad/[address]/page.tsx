'use client'

import { waitForTransactionReceipt } from 'wagmi/actions'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAccount, useReadContract as useWagmiReadContract } from 'wagmi'
import { formatEther, formatUnits, isAddress, parseEther, parseUnits, zeroAddress } from 'viem'
import { AlertTriangle, CircleCheck, ExternalLink, ShieldCheck, Upload } from 'lucide-react'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { TokenLogoUpload } from '@/components/shared/TokenLogoUpload'
import { ERC20_ABI, ILO_ABI } from '@/config/abis'
import {
  hasApprovedIloPaidWritePath,
  isApprovedLesterTreasury,
} from '@/config/contracts'
import { wagmiConfig } from '@/config/wagmi'
import { LITVM_EXPLORER_URL } from '@/lib/explorerRpc'
import { useSafeWriteContract } from '@/hooks/useSafeWriteContract'
import { useTokenImageUrls } from '@/hooks/useTokenImageUrls'
import { litvm } from '@/config/chains'
import { attestIloProvenance, type AttestedIloProvenance } from '@/lib/launchpadProvenance'

const useReadContract: typeof useWagmiReadContract = ((parameters: Parameters<typeof useWagmiReadContract>[0]) =>
  useWagmiReadContract({ ...parameters, chainId: litvm.id } as never)) as typeof useWagmiReadContract

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatTokenValue(value: bigint, decimals: number, maximumFractionDigits = 4) {
  const raw = formatUnits(value, decimals)
  const numeric = Number(raw)
  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits })
  }
  return raw
}

function parseWhitelistAddresses(raw: string) {
  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function PresalePage() {
  const params = useParams<{ address: string }>()
  const rawAddress = params?.address ?? ''
  const routeIloAddress = isAddress(rawAddress) ? (rawAddress as `0x${string}`) : undefined

  const { address: userAddress, isConnected } = useAccount()
  const {
    ensureLitvmWrite,
    isWrongNetwork,
    isSwitchingChain,
    writeContractAsync,
    writeRecoveryContractAsync,
  } = useSafeWriteContract()

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [contributionAmount, setContributionAmount] = useState('')
  const [fundingAmount, setFundingAmount] = useState('')
  const [whitelistInput, setWhitelistInput] = useState('')
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null)
  const [txOpen, setTxOpen] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [provenanceStatus, setProvenanceStatus] = useState<'checking' | 'verified' | 'unverified' | 'error'>(
    routeIloAddress ? 'checking' : 'unverified',
  )
  const [iloProvenance, setIloProvenance] = useState<AttestedIloProvenance | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!routeIloAddress) {
      setProvenanceStatus('unverified')
      setIloProvenance(null)
      return () => {
        cancelled = true
      }
    }

    setProvenanceStatus('checking')
    setIloProvenance(null)
    void attestIloProvenance(routeIloAddress)
      .then((attested) => {
        if (!cancelled) {
          setIloProvenance(attested)
          setProvenanceStatus('verified')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIloProvenance(null)
          setProvenanceStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [routeIloAddress])

  const iloAddress = provenanceStatus === 'verified' && iloProvenance ? routeIloAddress : undefined

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [])

  const ownerRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'owner',
    query: { enabled: Boolean(iloAddress) },
  })
  const treasuryRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'treasury',
    query: { enabled: Boolean(iloAddress) },
  })
  const tokenRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'token',
    query: { enabled: Boolean(iloAddress) },
  })
  const softCapRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'softCap',
    query: { enabled: Boolean(iloAddress) },
  })
  const hardCapRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'hardCap',
    query: { enabled: Boolean(iloAddress) },
  })
  const tokensPerEthRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'tokensPerEth',
    query: { enabled: Boolean(iloAddress) },
  })
  const startTimeRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'startTime',
    query: { enabled: Boolean(iloAddress) },
  })
  const endTimeRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'endTime',
    query: { enabled: Boolean(iloAddress) },
  })
  const totalRaisedRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'totalRaised',
    query: { enabled: Boolean(iloAddress) },
  })
  const totalClaimedContributionsRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'totalClaimedContributions',
    query: { enabled: Boolean(iloAddress) },
  })
  const liquidityBpsRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'liquidityBps',
    query: { enabled: Boolean(iloAddress) },
  })
  const lpLockDurationRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'lpLockDuration',
    query: { enabled: Boolean(iloAddress) },
  })
  const lpUnlockTimeRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'lpUnlockTime',
    query: { enabled: Boolean(iloAddress) },
  })
  const finalizedRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'finalized',
    query: { enabled: Boolean(iloAddress) },
  })
  const cancelledRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'cancelled',
    query: { enabled: Boolean(iloAddress) },
  })
  const whitelistEnabledRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'whitelistEnabled',
    query: { enabled: Boolean(iloAddress) },
  })
  const lpTokenRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'lpToken',
    query: { enabled: Boolean(iloAddress) },
  })
  const lpTokensLockedRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'lpTokensLocked',
    query: { enabled: Boolean(iloAddress) },
  })
  const tokensRequiredRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'tokensRequired',
    query: { enabled: Boolean(iloAddress) },
  })
  const contributionRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'contributions',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: Boolean(iloAddress && userAddress) },
  })
  const whitelistRead = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'whitelist',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: Boolean(iloAddress && userAddress) },
  })

  const tokenAddress = tokenRead.data as `0x${string}` | undefined
  const tokenImageUrls = useTokenImageUrls(Boolean(tokenAddress))
  const storedLogoUrl = tokenAddress ? tokenImageUrls.get(tokenAddress.toLowerCase()) ?? null : null
  const logoUrl = localLogoUrl ?? storedLogoUrl
  const tokenNameRead = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'name',
    query: { enabled: Boolean(tokenAddress) },
  })
  const tokenSymbolRead = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: Boolean(tokenAddress) },
  })
  const tokenDecimalsRead = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: Boolean(tokenAddress) },
  })
  const contractTokenBalanceRead = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: iloAddress ? [iloAddress] : undefined,
    query: { enabled: Boolean(tokenAddress && iloAddress) },
  })
  const userTokenBalanceRead = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: Boolean(tokenAddress && userAddress) },
  })

  const owner = ownerRead.data as `0x${string}` | undefined
  const treasury = treasuryRead.data as `0x${string}` | undefined
  const tokenName = (tokenNameRead.data as string | undefined) ?? 'Loading…'
  const tokenSymbol = (tokenSymbolRead.data as string | undefined) ?? 'TOKEN'
  const tokenDecimals = Number(tokenDecimalsRead.data ?? 18)
  const softCap = (softCapRead.data ?? 0n) as bigint
  const hardCap = (hardCapRead.data ?? 0n) as bigint
  const totalRaised = (totalRaisedRead.data ?? 0n) as bigint
  const totalClaimedContributions = (totalClaimedContributionsRead.data ?? 0n) as bigint
  const tokensPerEth = (tokensPerEthRead.data ?? 0n) as bigint
  const startTime = Number(startTimeRead.data ?? 0n)
  const endTime = Number(endTimeRead.data ?? 0n)
  const liquidityBps = Number(liquidityBpsRead.data ?? 0n)
  const lpLockDuration = Number(lpLockDurationRead.data ?? 0n)
  const lpUnlockTime = Number(lpUnlockTimeRead.data ?? 0n)
  const finalized = Boolean(finalizedRead.data)
  const cancelled = Boolean(cancelledRead.data)
  const whitelistEnabled = Boolean(whitelistEnabledRead.data)
  const userContribution = (contributionRead.data ?? 0n) as bigint
  const tokensRequired = (tokensRequiredRead.data ?? 0n) as bigint
  const contractTokenBalance = (contractTokenBalanceRead.data ?? 0n) as bigint
  const userTokenBalance = (userTokenBalanceRead.data ?? 0n) as bigint
  const lpToken = (lpTokenRead.data as `0x${string}` | undefined) ?? undefined
  const lpTokensLocked = (lpTokensLockedRead.data ?? 0n) as bigint
  const isWhitelisted = Boolean(whitelistRead.data)
  const isOwner = Boolean(owner && userAddress && owner.toLowerCase() === userAddress.toLowerCase())
  const treasuryApproved = treasuryRead.isSuccess && isApprovedLesterTreasury(treasury)
  const paidWritesApproved = hasApprovedIloPaidWritePath({
    factory: iloProvenance?.sourceKind === 'current' ? iloProvenance.sourceFactory : undefined,
    treasury,
  })
  const paidWriteBlockReason = iloProvenance?.sourceKind === 'legacy'
    ? 'This presale was created by a recovery-only legacy factory. New funding, contributions, whitelist changes, and finalization are disabled.'
    : 'This replacement presale did not pass the current source-factory and treasury provenance gate. Paid and settlement writes are disabled.'
  const fundingGap = tokensRequired > contractTokenBalance ? tokensRequired - contractTokenBalance : 0n
  const progress = hardCap > 0n ? Math.min(100, Number((totalRaised * 10_000n) / hardCap) / 100) : 0
  const isLive = now >= startTime && now <= endTime && !finalized && !cancelled
  const hasEnded = now > endTime
  const softCapMet = totalRaised >= softCap
  const canFinalize =
    paidWritesApproved &&
    !finalized &&
    !cancelled &&
    softCapMet &&
    (now > endTime || totalRaised >= hardCap) &&
    (isOwner || now > endTime)
  const canClaim = finalized && userContribution > 0n
  const canRefund = userContribution > 0n && (cancelled || (hasEnded && !softCapMet) || (now > endTime + 7 * 24 * 60 * 60 && !finalized))
  const canClaimLp = isOwner && finalized && lpTokensLocked > 0n && now >= lpUnlockTime
  const failedOrRefundable = cancelled || (hasEnded && !softCapMet) || (now > endTime + 7 * 24 * 60 * 60 && !finalized)
  const unclaimedContributions = totalRaised > totalClaimedContributions ? totalRaised - totalClaimedContributions : 0n
  const reservedClaimTokens = finalized ? (unclaimedContributions * tokensPerEth) / 1_000_000_000_000_000_000n : 0n
  const supportsTokenSweep = totalClaimedContributionsRead.isSuccess
  const canSweepExcessTokens =
    supportsTokenSweep && isOwner && (finalized || failedOrRefundable) && contractTokenBalance > reservedClaimTokens
  const canSweepExcess = isOwner && finalized
  const status = finalized
    ? 'Finalized'
    : cancelled
      ? 'Cancelled'
      : isLive
        ? 'Live'
        : hasEnded
          ? 'Ended'
          : 'Upcoming'
  const statusLabel = !paidWritesApproved && status === 'Live'
    ? 'Historical window open · writes disabled'
    : !paidWritesApproved && status === 'Upcoming'
      ? 'Historical schedule · writes disabled'
      : status
  const statusColor = !paidWritesApproved && (status === 'Live' || status === 'Upcoming')
    ? '#fbbf24'
    : status === 'Live'
      ? '#4ade80'
      : status === 'Finalized'
        ? '#818cf8'
        : status === 'Upcoming'
          ? '#fbbf24'
          : '#f87171'
  const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
  } satisfies React.CSSProperties
  let parsedFundingAmount = 0n
  try {
    parsedFundingAmount = fundingAmount ? parseUnits(fundingAmount, tokenDecimals) : 0n
  } catch {
    parsedFundingAmount = 0n
  }

  useEffect(() => {
    if (fundingGap <= 0n) {
      setFundingAmount('')
      return
    }

    if (!fundingAmount) {
      setFundingAmount(formatUnits(fundingGap, tokenDecimals))
    }
  }, [fundingAmount, fundingGap, tokenDecimals])

  async function ensureLitvm() {
    return ensureLitvmWrite({
      action: 'continuing with this presale action',
      onError: (message) => {
        setTxOpen(true)
        setTxStatus('error')
        setTxMessage(message)
      },
    })
  }

  async function refreshPresaleState() {
    await Promise.allSettled([
      ownerRead.refetch(),
      treasuryRead.refetch(),
      tokenRead.refetch(),
      softCapRead.refetch(),
      hardCapRead.refetch(),
      tokensPerEthRead.refetch(),
      startTimeRead.refetch(),
      endTimeRead.refetch(),
      totalRaisedRead.refetch(),
      totalClaimedContributionsRead.refetch(),
      liquidityBpsRead.refetch(),
      lpLockDurationRead.refetch(),
      lpUnlockTimeRead.refetch(),
      finalizedRead.refetch(),
      cancelledRead.refetch(),
      whitelistEnabledRead.refetch(),
      lpTokenRead.refetch(),
      lpTokensLockedRead.refetch(),
      tokensRequiredRead.refetch(),
      contributionRead.refetch(),
      whitelistRead.refetch(),
      tokenNameRead.refetch(),
      tokenSymbolRead.refetch(),
      tokenDecimalsRead.refetch(),
      contractTokenBalanceRead.refetch(),
      userTokenBalanceRead.refetch(),
    ])
  }

  async function submitTransaction({
    pendingMessage,
    successMessage,
    onSuccess,
    request,
  }: {
    pendingMessage: string
    successMessage: string
    onSuccess?: () => void
    request: () => Promise<`0x${string}`>
  }) {
    if (!iloAddress || provenanceStatus !== 'verified') {
      setTxOpen(true)
      setTxStatus('error')
      setTxMessage('This address is not verified against the exact source factory reported by the ILO child.')
      return
    }

    if (!(await ensureLitvmWrite({
      action: 'submitting a presale transaction',
      onError: (message) => {
        setTxOpen(true)
        setTxStatus('error')
        setTxMessage(message)
      },
    }))) {
      return
    }

    try {
      setTxOpen(true)
      setTxStatus('pending')
      setTxMessage(pendingMessage)
      setTxHash(undefined)

      const hash = await request()
      setTxHash(hash)
      setTxMessage('Transaction submitted. Waiting for confirmation…')

      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: litvm.id })
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain.')
      }

      setTxStatus('success')
      setTxMessage(successMessage)
      onSuccess?.()
      await refreshPresaleState()
    } catch (error) {
      setTxStatus('error')
      setTxMessage(error instanceof Error ? error.message.slice(0, 180) : 'Transaction failed.')
    }
  }

  async function handleContribute() {
    if (!iloAddress) return
    if (!contributionAmount) return
    if (!paidWritesApproved) {
      setTxOpen(true)
      setTxStatus('error')
      setTxMessage(paidWriteBlockReason)
      return
    }

    let amount = 0n
    try {
      amount = parseEther(contributionAmount)
    } catch {
      setTxOpen(true)
      setTxStatus('error')
      setTxMessage('Enter a valid zkLTC contribution amount.')
      return
    }
    if (amount <= 0n) return

    await submitTransaction({
      pendingMessage: 'Confirm your zkLTC contribution in the wallet…',
      successMessage: 'Contribution confirmed on LitVM.',
      onSuccess: () => setContributionAmount(''),
      request: () =>
        writeContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'contribute',
          value: amount,
        }, {
          kind: 'current-ilo-child',
          child: iloAddress,
          sourceFactory: iloProvenance!.sourceFactory,
        }),
    })
  }

  async function handleFund() {
    if (!tokenAddress || !iloAddress || !isOwner || !fundingAmount) return
    if (!paidWritesApproved) {
      setTxOpen(true)
      setTxStatus('error')
      setTxMessage(paidWriteBlockReason)
      return
    }

    let amount = 0n
    try {
      amount = parseUnits(fundingAmount, tokenDecimals)
    } catch {
      setTxOpen(true)
      setTxStatus('error')
      setTxMessage('Enter a valid token funding amount.')
      return
    }
    if (amount <= 0n) return

    await submitTransaction({
      pendingMessage: 'Transfer the sale tokens into the presale contract to make finalization possible.',
      successMessage: 'Presale funding confirmed.',
      onSuccess: () => setFundingAmount(''),
      request: () =>
        writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [iloAddress, amount],
        }, {
          kind: 'current-ilo-child',
          child: iloAddress,
          sourceFactory: iloProvenance!.sourceFactory,
        }),
    })
  }

  async function handleWhitelist() {
    if (!iloAddress || !isOwner) return
    if (!paidWritesApproved) {
      setTxOpen(true)
      setTxStatus('error')
      setTxMessage(paidWriteBlockReason)
      return
    }

    const users = parseWhitelistAddresses(whitelistInput)
    if (users.length === 0 || users.some((value) => !isAddress(value))) {
      setTxOpen(true)
      setTxStatus('error')
      setTxMessage('Enter valid wallet addresses separated by commas or new lines.')
      return
    }

    await submitTransaction({
      pendingMessage: 'Updating the presale whitelist…',
      successMessage: 'Whitelist updated successfully.',
      onSuccess: () => setWhitelistInput(''),
      request: () =>
        writeContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'setWhitelist',
          args: [users as `0x${string}`[], true],
        }, {
          kind: 'current-ilo-child',
          child: iloAddress,
          sourceFactory: iloProvenance!.sourceFactory,
        }),
    })
  }

  async function handleFinalize() {
    if (!iloAddress) return
    if (!paidWritesApproved) {
      setTxOpen(true)
      setTxStatus('error')
      setTxMessage(paidWriteBlockReason)
      return
    }

    await submitTransaction({
      pendingMessage: 'Finalizing the presale and creating the Lester DEX pool…',
      successMessage: 'Presale finalized and Lester DEX liquidity created.',
      request: () =>
        writeContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'finalize',
        }, {
          kind: 'current-ilo-child',
          child: iloAddress,
          sourceFactory: iloProvenance!.sourceFactory,
        }),
    })
  }

  async function handleClaim() {
    if (!iloAddress) return

    await submitTransaction({
      pendingMessage: 'Claiming your purchased tokens…',
      successMessage: 'Token claim completed.',
      request: () =>
        writeRecoveryContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'claim',
        }, {
          kind: 'ilo-child',
          sourceFactory: iloProvenance!.sourceFactory,
          child: iloAddress,
          role: 'claimant',
        }),
    })
  }

  async function handleRefund() {
    if (!iloAddress) return

    await submitTransaction({
      pendingMessage: 'Requesting your refund…',
      successMessage: 'Refund completed.',
      request: () =>
        writeRecoveryContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'refund',
        }, {
          kind: 'ilo-child',
          sourceFactory: iloProvenance!.sourceFactory,
          child: iloAddress,
          role: 'claimant',
        }),
    })
  }

  async function handleClaimLp() {
    if (!iloAddress) return

    await submitTransaction({
      pendingMessage: 'Claiming unlocked LP tokens…',
      successMessage: 'LP claim completed.',
      request: () =>
        writeRecoveryContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'claimLP',
        }, {
          kind: 'ilo-child',
          sourceFactory: iloProvenance!.sourceFactory,
          child: iloAddress,
          role: 'owner',
        }),
    })
  }

  async function handleSweepExcess() {
    if (!iloAddress) return

    await submitTransaction({
      pendingMessage: 'Recovering residual zkLTC left after liquidity creation…',
      successMessage: 'Residual zkLTC returned to the on-chain presale owner.',
      request: () =>
        writeRecoveryContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'sweepExcessETH',
        }, {
          kind: 'ilo-child',
          sourceFactory: iloProvenance!.sourceFactory,
          child: iloAddress,
          role: 'owner',
        }),
    })
  }

  async function handleSweepExcessTokens() {
    if (!iloAddress) return

    await submitTransaction({
      pendingMessage: 'Recovering residual sale tokens…',
      successMessage: 'Residual sale tokens returned to the on-chain presale owner.',
      request: () =>
        writeRecoveryContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'sweepExcessTokens',
        }, {
          kind: 'ilo-child',
          sourceFactory: iloProvenance!.sourceFactory,
          child: iloAddress,
          role: 'owner',
        }),
    })
  }

  async function handleCancel() {
    if (!iloAddress || !isOwner) return

    await submitTransaction({
      pendingMessage: 'Cancelling the presale…',
      successMessage: 'Presale cancelled.',
      request: () =>
        writeRecoveryContractAsync({
          address: iloAddress,
          abi: ILO_ABI,
          functionName: 'cancel',
        }, {
          kind: 'ilo-child',
          sourceFactory: iloProvenance!.sourceFactory,
          child: iloAddress,
          role: 'owner',
        }),
    })
  }

  if (!routeIloAddress) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px 80px' }}>
          <div style={{ ...cardStyle, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.08)' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '10px' }}>Invalid presale address</h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>
              The URL does not contain a valid ILO contract address.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (provenanceStatus !== 'verified') {
    const isChecking = provenanceStatus === 'checking'
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px 80px' }}>
          <div style={{ ...cardStyle, border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.08)' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '10px' }}>
              {isChecking ? 'Verifying presale' : 'Unverified presale address'}
            </h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
              {isChecking
                ? 'Checking this contract against the source-pinned replacement and legacy Lester Labs ILO factories, plus reviewed child runtimes.'
                : provenanceStatus === 'error'
                  ? 'The LitVM provenance check is temporarily unavailable. Transaction controls remain disabled until verification succeeds.'
                  : 'This contract did not authenticate against the exact source factory it reports. Lester Labs will not offer transaction controls for it.'}
            </p>
            {!isChecking && (
              <a
                href={`${LITVM_EXPLORER_URL}/address/${routeIloAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px', color: '#fcd34d', textDecoration: 'none' }}
              >
                Inspect address on explorer <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  const addLiquidityHref =
    lpToken && tokenAddress
      ? `/swap?addLiquidity=${lpToken}&token0=${tokenAddress}&token1=${zeroAddress}`
      : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ marginBottom: '28px' }}>
          <Link href="/launchpad" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
            ← Back to Launchpad
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <div style={{
                width: 58,
                height: 58,
                flexShrink: 0,
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'linear-gradient(135deg, rgba(94,106,210,0.24), rgba(54,209,220,0.08))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                color: '#d8dcff',
                fontWeight: 800,
                fontSize: 22,
              }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={`${tokenName} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  tokenSymbol.slice(0, 1).toUpperCase()
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>
                  {tokenName} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>${tokenSymbol}</span>
                </h1>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {iloAddress}
                </p>
              </div>
            </div>
            <span style={{
              padding: '6px 14px',
              background: `${statusColor}22`,
              border: `1px solid ${statusColor}55`,
              borderRadius: '20px',
              fontSize: '13px',
              color: statusColor,
              fontWeight: 600,
            }}>
              ● {statusLabel}
            </span>
          </div>
        </div>

        {isWrongNetwork && (
          <div style={{ ...cardStyle, border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} color="#fbbf24" />
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#fcd34d' }}>Wallet is on the wrong network</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                  Switch to LitVM LiteForge only if you need to inspect wallet-specific state or use an eligible recovery action. Contributions, funding, and finalization remain disabled.
                </p>
              </div>
            </div>
            <button
              onClick={() => { void ensureLitvm() }}
              disabled={isSwitchingChain}
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                background: '#fbbf24',
                border: 'none',
                borderRadius: '8px',
                color: '#111827',
                fontSize: '14px',
                fontWeight: 700,
                cursor: isSwitchingChain ? 'not-allowed' : 'pointer',
              }}
            >
              {isSwitchingChain ? 'Switching…' : 'Switch to LitVM'}
            </button>
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Historical amount raised</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right' }}>
              {formatEther(totalRaised)} zkLTC / {formatEther(hardCap)} zkLTC
            </span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{progress.toFixed(1)}%</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Filled</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{softCapMet ? 'Met' : 'Not met'}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Soft Cap</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{whitelistEnabled ? (isWhitelisted ? 'Listed' : 'Enabled') : 'Not gated'}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Whitelist</div>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
          {[
            ['Historical token rate', tokensPerEth > 0n ? `${formatTokenValue(tokensPerEth, tokenDecimals, 2)} / zkLTC` : '—'],
            ['LP allocation', `${(liquidityBps / 100).toFixed(0)}%`],
            ['Lock duration', `${Math.round(lpLockDuration / 86400)} days`],
          ].map(([label, value]) => (
            <div key={label} style={{
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'linear-gradient(180deg, rgba(94,106,210,0.09), rgba(255,255,255,0.025))',
              padding: '14px',
            }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
              <p style={{ marginTop: '8px', fontSize: '16px', fontWeight: 700, color: '#fff' }}>{value}</p>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Presale Details</h2>
          <StatRow label="Token" value={`${tokenName} (${tokenSymbol})`} />
          <StatRow label="Soft Cap" value={`${formatEther(softCap)} zkLTC`} />
          <StatRow label="Hard Cap" value={`${formatEther(hardCap)} zkLTC`} />
          <StatRow
            label="Historical Token Rate"
            value={tokensPerEth > 0n ? `${formatTokenValue(tokensPerEth, tokenDecimals, 6)} tokens / zkLTC` : '—'}
          />
          <StatRow label="Liquidity" value={`${(liquidityBps / 100).toFixed(0)}% to Lester DEX LP`} />
          <StatRow label="LP Lock" value={`${Math.round(lpLockDuration / 86400)} days`} />
          <StatRow label="Start Time" value={startTime > 0 ? new Date(startTime * 1000).toLocaleString() : '—'} />
          <StatRow label="End Time" value={endTime > 0 ? new Date(endTime * 1000).toLocaleString() : '—'} />
          <StatRow label="Presale Owner" value={owner ? shortAddress(owner) : '—'} />
          <StatRow label="Your Contribution" value={isConnected ? `${formatEther(userContribution)} zkLTC` : 'Connect wallet to view'} />
        </div>

        {!paidWritesApproved && (
          <div style={{
            ...cardStyle,
            border: '1px solid rgba(248,113,113,0.35)',
            background: 'rgba(248,113,113,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={18} color="#fca5a5" />
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#fecaca' }}>
                  {iloProvenance?.sourceKind === 'legacy' ? 'Legacy factory safeguard active' : 'Replacement provenance gate failed'}
                </p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.72)', marginTop: '4px', lineHeight: 1.6 }}>
                  {treasuryRead.isLoading
                    ? 'The presale treasury is being verified. Paid and settlement actions remain disabled until verification succeeds.'
                    : iloProvenance?.sourceKind !== 'legacy'
                      ? paidWriteBlockReason
                      : treasuryApproved
                      ? 'This presale came from a source-pinned legacy factory. Contributions, token funding, whitelist changes, and finalization remain disabled. Cancellation, refunds, claims, and other recovery actions remain available when the child contract permits them.'
                      : 'This presale came from a source-pinned legacy factory and retains its historical treasury route. Contributions, token funding, whitelist changes, and finalization are disabled. Cancellation, refunds, claims, and other recovery actions remain available when the child contract permits them.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {iloProvenance?.sourceKind === 'legacy' && <div style={{ ...cardStyle, border: '1px solid rgba(94,106,210,0.24)', background: 'rgba(94,106,210,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <ShieldCheck size={18} color="#93c5fd" />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#dbeafe' }}>Legacy recovery checklist</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.72)', marginTop: '4px', lineHeight: 1.6 }}>
                1. Verify the exact source factory and child runtime. 2. Do not fund, contribute, change a whitelist,
                or finalize. 3. Confirm the connected wallet&apos;s role and current contract state. 4. Use only the
                narrowly enabled cancellation, refund, claim, LP, or excess-asset recovery action.
              </p>
            </div>
          </div>
        </div>}

        {!isOwner && hardCap > 0n && softCap > 0n && !finalized && !cancelled && (hasEnded || totalRaised >= hardCap || softCapMet) && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Settlement</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.58)', marginBottom: '14px', lineHeight: 1.6 }}>
              Legacy finalization is disabled even when a sale reaches hard cap or ends above soft cap. Historical
              state is shown only to determine whether a refund or another authenticated recovery path is available.
            </p>
            {fundingGap > 0n && (
              <p style={{ fontSize: '13px', color: '#fbbf24', marginBottom: '12px', lineHeight: 1.6 }}>
                The historical funding gap is {formatTokenValue(fundingGap, tokenDecimals)} {tokenSymbol}. Do not fund it; finalization remains disabled.
              </p>
            )}
            {!softCapMet && (
              <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px', lineHeight: 1.6 }}>
                The soft cap has not been met, so contributors can refund after the sale window closes.
              </p>
            )}
            <button
              onClick={() => { void handleFinalize() }}
              disabled={!canFinalize || fundingGap > 0n}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: 'none',
                background: canFinalize && fundingGap === 0n ? '#4f46e5' : 'rgba(79,70,229,0.3)',
                color: '#fff',
                fontWeight: 700,
                cursor: canFinalize && fundingGap === 0n ? 'pointer' : 'not-allowed',
              }}
            >
              Legacy Finalization Disabled
            </button>
          </div>
        )}

        {isOwner && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Creator Controls</h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              {tokenAddress && (
                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px', background: 'rgba(255,255,255,0.03)' }}>
                  <TokenLogoUpload
                    tokenAddress={tokenAddress}
                    currentUrl={logoUrl}
                    onUrlChange={(url) => setLocalLogoUrl(url || null)}
                  />
                </div>
              )}

              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Upload size={16} color="#a78bfa" />
                  <strong style={{ fontSize: '14px', color: '#fff' }}>Fund Sale Tokens</strong>
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '10px', lineHeight: 1.6 }}>
                  Historical funding state is shown for diagnosis only. Do not approve or transfer additional sale
                  tokens to this legacy ILO.
                </p>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '10px' }}>
                  Funded: {formatTokenValue(contractTokenBalance, tokenDecimals)} {tokenSymbol}
                  {' · '}
                  Required: {formatTokenValue(tokensRequired, tokenDecimals)} {tokenSymbol}
                  {' · '}
                  Remaining: {formatTokenValue(fundingGap, tokenDecimals)} {tokenSymbol}
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    value={fundingAmount}
                    onChange={(event) => setFundingAmount(event.target.value)}
                    placeholder="Token amount to transfer"
                    inputMode="decimal"
                    disabled={!paidWritesApproved}
                    style={{
                      flex: '1 1 220px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                    }}
                  />
                  <button
                    onClick={() => setFundingAmount(formatUnits(fundingGap, tokenDecimals))}
                    disabled={!paidWritesApproved || fundingGap === 0n}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      cursor: !paidWritesApproved || fundingGap === 0n ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Fill Remaining
                  </button>
                  <button
                    onClick={() => { void handleFund() }}
                    disabled={!paidWritesApproved || fundingGap === 0n || !fundingAmount || parsedFundingAmount === 0n || parsedFundingAmount > userTokenBalance}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: fundingGap === 0n
                        ? 'rgba(34,197,94,0.3)'
                        : paidWritesApproved
                          ? 'var(--accent)'
                          : 'rgba(79,70,229,0.3)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: !paidWritesApproved || fundingGap === 0n ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {fundingGap === 0n
                      ? 'Funding Complete'
                      : paidWritesApproved
                        ? 'Fund Presale'
                        : 'Funding paused for legacy factory'}
                  </button>
                </div>
              </div>

              {whitelistEnabled && (
                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px', background: 'rgba(255,255,255,0.03)' }}>
                    <strong style={{ fontSize: '14px', color: '#fff' }}>Historical Whitelist — Changes Disabled</strong>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: '8px 0 10px', lineHeight: 1.6 }}>
                    The legacy whitelist state can be inspected, but adding or removing addresses is disabled.
                  </p>
                  <textarea
                    value={whitelistInput}
                    onChange={(event) => setWhitelistInput(event.target.value)}
                    rows={5}
                    placeholder="0xabc...\n0xdef..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      marginBottom: '10px',
                    }}
                  />
                  <button
                    onClick={() => { void handleWhitelist() }}
                    disabled={!paidWritesApproved || !whitelistInput.trim()}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--accent)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: !paidWritesApproved || !whitelistInput.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Whitelist Changes Disabled
                  </button>
                </div>
              )}

              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px', background: 'rgba(255,255,255,0.03)' }}>
                <strong style={{ fontSize: '14px', color: '#fff' }}>Historical settlement and recovery</strong>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: '8px 0 10px', lineHeight: 1.6 }}>
                  Finalization into the retired connector and DEX is disabled. State-dependent LP claims, cancellation,
                  refunds, and excess-asset recovery may remain available when authenticated.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { void handleFinalize() }}
                    disabled={!canFinalize || fundingGap > 0n}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: canFinalize && fundingGap === 0n ? '#4f46e5' : 'rgba(79,70,229,0.3)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: canFinalize && fundingGap === 0n ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Legacy Finalization Disabled
                  </button>
                  <button
                    onClick={() => { void handleClaimLp() }}
                    disabled={!canClaimLp}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      cursor: canClaimLp ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Claim LP
                  </button>
                  <button
                    onClick={() => { void handleSweepExcess() }}
                    disabled={!canSweepExcess}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      cursor: canSweepExcess ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Recover Residual zkLTC
                  </button>
                  <button
                    onClick={() => { void handleSweepExcessTokens() }}
                    disabled={!canSweepExcessTokens}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      cursor: canSweepExcessTokens ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Recover Residual Sale Tokens
                  </button>
                  <button
                    onClick={() => { void handleCancel() }}
                    disabled={finalized || cancelled}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(248,113,113,0.25)',
                      background: 'rgba(248,113,113,0.08)',
                      color: '#fca5a5',
                      cursor: finalized || cancelled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel Presale
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Community Actions</h2>
          {status === 'Live' ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.6 }}>
                {paidWritesApproved
                  ? 'This source-pinned replacement sale is live. Confirm chain 4441, the authenticated child address, contribution value, and wallet prompt before submitting.'
                  : 'The recorded sale window is still open in legacy contract state, but new contributions are disabled. Existing contributors should use only a claim or refund action when the authenticated child state permits it.'}
              </p>
              {whitelistEnabled && !isWhitelisted && isConnected && (
                <div style={{ border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.08)', borderRadius: '10px', padding: '12px 14px', color: '#fcd34d', fontSize: '13px' }}>
                  {paidWritesApproved
                    ? 'This replacement sale is whitelist-gated. The connected account must be approved by the sale owner before it can contribute.'
                    : 'This historical sale is whitelist-gated. New contributions and whitelist changes remain disabled.'}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  value={contributionAmount}
                  onChange={(event) => setContributionAmount(event.target.value)}
                  placeholder="Amount in zkLTC"
                  inputMode="decimal"
                  disabled={!paidWritesApproved}
                  style={{
                    flex: '1 1 220px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                  }}
                />
                <button
                  onClick={() => { void handleContribute() }}
                  disabled={!paidWritesApproved || !isConnected || !contributionAmount || (whitelistEnabled && !isWhitelisted)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: !paidWritesApproved || !isConnected || !contributionAmount || (whitelistEnabled && !isWhitelisted) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {!paidWritesApproved
                      ? 'Legacy Contributions Disabled'
                    : isConnected
                      ? 'Contribute zkLTC'
                      : 'Connect wallet to contribute'}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.6 }}>
              {paidWritesApproved
                ? 'Contributions are available only while this replacement sale is live. Claims, refunds, and post-finalization actions appear only when its authenticated state permits them.'
                : 'New contributions are disabled regardless of the historical sale window. Authenticated claims, refunds, and post-finalization recovery actions are shown only when the contract reaches the corresponding state.'}
            </p>
          )}

          {(canClaim || canRefund || addLiquidityHref) && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
              <button
                onClick={() => { void handleClaim() }}
                disabled={!canClaim}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: canClaim ? '#22c55e' : 'rgba(34,197,94,0.28)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: canClaim ? 'pointer' : 'not-allowed',
                }}
              >
                Claim Tokens
              </button>
              <button
                onClick={() => { void handleRefund() }}
                disabled={!canRefund}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(248,113,113,0.25)',
                  background: canRefund ? 'rgba(248,113,113,0.12)' : 'rgba(248,113,113,0.05)',
                  color: '#fca5a5',
                  fontWeight: 700,
                  cursor: canRefund ? 'pointer' : 'not-allowed',
                }}
              >
                Claim Refund
              </button>
              {addLiquidityHref && (
                <Link
                  href={addLiquidityHref}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    textDecoration: 'none',
                    fontWeight: 700,
                  }}
                >
                  Add More Lester DEX Liquidity
                </Link>
              )}
            </div>
          )}
        </div>

        {status === 'Finalized' && (
          <div style={{ ...cardStyle, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <CircleCheck size={18} color="#4ade80" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80' }}>Presale Finalized</span>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
              This sale has been finalized. Contributors can claim tokens from this page, and the initial Lester DEX
              liquidity has already been created and locked by the finalize transaction.
            </p>
          </div>
        )}

        {status === 'Cancelled' && (
          <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <AlertTriangle size={18} color="#f87171" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#f87171' }}>Presale Cancelled</span>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
              Contributors can reclaim funds directly from the presale contract. No Lester DEX pool will be created for
              this sale unless it is relaunched in a new ILO.
            </p>
          </div>
        )}

        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Links</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            <a
              href={`${LITVM_EXPLORER_URL}/address/${iloAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', textDecoration: 'none', fontSize: '14px' }}
            >
              View ILO on explorer <ExternalLink size={14} />
            </a>
            {tokenAddress && (
              <a
                href={`${LITVM_EXPLORER_URL}/address/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', textDecoration: 'none', fontSize: '14px' }}
              >
                View token contract <ExternalLink size={14} />
              </a>
            )}
            {lpToken && (
              <a
                href={`${LITVM_EXPLORER_URL}/address/${lpToken}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', textDecoration: 'none', fontSize: '14px' }}
              >
                View LP token / pair <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>

      <TxStatusModal
        isOpen={txOpen}
        onClose={() => setTxOpen(false)}
        status={txStatus}
        txHash={txHash}
        contractAddress={iloAddress}
        message={txMessage}
      />
    </div>
  )
}
