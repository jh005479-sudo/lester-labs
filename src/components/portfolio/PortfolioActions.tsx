'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, decodeEventLog, decodeFunctionData, erc20Abi, formatUnits } from 'viem'
import { ArrowUpRight, CalendarPlus } from 'lucide-react'
import { useIndexedActivity } from '@/hooks/useIndexedActivity'
import { LIQUIDITY_LOCKER_ABI } from '@/lib/contracts/liquidityLocker'
import { VESTING_FACTORY_ABI, VESTING_WALLET_RECOVERY_ABI } from '@/lib/contracts/tokenVesting'
import { LIQUIDITY_LOCKER_ADDRESS, VESTING_FACTORY_ADDRESS } from '@/config/contracts'
import { litvm } from '@/config/chains'
import { lockVerificationLink } from '@/lib/projectJourney'

const client = createPublicClient({ chain: litvm, transport: http(litvm.rpcUrls.default.http[0], { timeout: 6_000, retryCount: 0 }) })
interface Action { key: string; title: string; detail: string; href: string; due?: number; ready: boolean }

function downloadReminder(action: Action) {
  if (!action.due || !Number.isSafeInteger(action.due) || action.due < 0) return
  const stamp = (time: number) => new Date(time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const now = Date.now()
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lester Labs//Testnet reminders//EN', 'BEGIN:VEVENT', `UID:${action.key}@lester-labs.com`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(action.due * 1_000)}`, `DTEND:${stamp(action.due * 1_000 + 900_000)}`, 'SUMMARY:Check your Lester Labs liquidity lock', `URL:https://www.lester-labs.com${action.href}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = 'lester-lock-reminder.ics'; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function PortfolioActions({ address }: { address: `0x${string}` }) {
  const locks = useIndexedActivity('locks')
  const vesting = useIndexedActivity('vesting')
  const query = useQuery({
    queryKey: ['portfolio-actions', address, locks.data?.coverage.checkedAt, vesting.data?.coverage.checkedAt],
    enabled: Boolean(locks.data && vesting.data), staleTime: 30_000, retry: 1,
    queryFn: async () => {
      const actions: Action[] = []
      const block = await client.getBlock()
      for (const log of locks.data!.logs) {
        const event = decodeEventLog({ abi: LIQUIDITY_LOCKER_ABI, eventName: 'LockCreated', data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] })
        if (event.args.withdrawer.toLowerCase() !== address.toLowerCase()) continue
        const lock = await client.readContract({ address: LIQUIDITY_LOCKER_ADDRESS, abi: LIQUIDITY_LOCKER_ABI, functionName: 'getLock', args: [event.args.lockId], blockNumber: block.number })
        if (lock[4] || lock[1] === 0n || lock[3].toLowerCase() !== address.toLowerCase()) continue
        const due = Number(lock[2])
        if (!Number.isSafeInteger(due) || due > 8_640_000_000_000) continue
        const ready = lock[2] <= block.timestamp
        actions.push({ key: `lock-${event.args.lockId}`, title: ready ? 'A liquidity lock is ready' : 'Upcoming liquidity unlock', detail: `Lock #${event.args.lockId} · ${new Date(due * 1_000).toLocaleDateString()}`, href: lockVerificationLink(LIQUIDITY_LOCKER_ADDRESS, event.args.lockId.toString()), due, ready })
        if (actions.length >= 10) break
      }
      for (const log of vesting.data!.logs) {
        if (actions.length >= 20) break
        const event = decodeEventLog({ abi: VESTING_FACTORY_ABI, eventName: 'VestingCreated', data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] })
        if (event.args.beneficiary.toLowerCase() !== address.toLowerCase()) continue
        const transaction = await client.getTransaction({ hash: log.transactionHash })
        if (transaction.to?.toLowerCase() !== VESTING_FACTORY_ADDRESS.toLowerCase()) continue
        const decoded = decodeFunctionData({ abi: VESTING_FACTORY_ABI, data: transaction.input })
        if (decoded.functionName !== 'createVestingSchedule' || decoded.args[1].toLowerCase() !== address.toLowerCase()) continue
        const token = decoded.args[0]
        const available = await client.readContract({ address: event.args.vestingWallet, abi: VESTING_WALLET_RECOVERY_ABI, functionName: 'releasable', args: [token], blockNumber: block.number })
        if (available === 0n) continue
        const decimals = await client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals', blockNumber: block.number })
        const amount = decimals <= 36 ? formatUnits(available, decimals) : `${available} base units`
        actions.push({ key: `vesting-${event.args.vestingId}`, title: 'Vested tokens are available', detail: `${amount} tokens · Schedule #${event.args.vestingId}`, href: `/vesting?tab=my&vestingWallet=${event.args.vestingWallet}&token=${token}&creationTx=${log.transactionHash}`, ready: true })
      }
      return actions.sort((a, b) => Number(b.ready) - Number(a.ready) || (a.due ?? 0) - (b.due ?? 0))
    },
  })
  const error = locks.isError || vesting.isError || query.isError
  return <section className="workspace-panel mb-6"><div className="flex items-center justify-between gap-4"><h2>Needs your attention</h2><Link href="/transactions" className="text-sm text-violet-300">Transaction history →</Link></div>
    {error ? <p role="alert" className="workspace-notice">We couldn’t check all your positions. Your balances haven’t changed. <button onClick={() => { void locks.refetch(); void vesting.refetch(); if (locks.data && vesting.data) void query.refetch() }} className="underline">Try again</button></p> : query.isPending ? <p className="workspace-note mt-4" role="status">Checking your recent locks and vesting schedules…</p> : query.data?.length === 0 ? <p className="workspace-note mt-4">Nothing needs attention in the activity we could check.</p> : <ul className="workspace-list">{query.data?.map((action) => <li key={action.key}><div className="min-w-0 flex-1"><h3 className="font-semibold">{action.title}</h3><p>{action.detail}</p></div>{!action.ready && action.due && <button className="workspace-button secondary" onClick={() => downloadReminder(action)}><CalendarPlus size={16} />Remind me</button>}<Link href={action.href} className="workspace-button secondary">View <ArrowUpRight size={15} /></Link></li>)}</ul>}
    <p className="workspace-note mt-4">Checks the latest archive page for current contracts. Older positions may be missing.</p>
  </section>
}
