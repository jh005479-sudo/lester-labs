'use client'

import { useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { litvm } from '@/config/chains'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { saveTrackedTransaction, saveConfirmedProject } from '@/lib/transactionHistory'
import { reconcileTransaction } from '@/lib/reconcileTransaction'
import { recordUsage, transactionSurface } from '@/lib/usageMetrics'

const client = createPublicClient({ chain: litvm, transport: http(litvm.rpcUrls.default.http[0], { timeout: 6_000, retryCount: 0 }) })

export function TransactionMonitor() {
  const transactions = useTransactionHistory()
  const pending = transactions.filter((entry) => entry.stage === 'submitted' && entry.hash).slice(0, 8)
  const pendingKey = pending.map((entry) => entry.hash).join(':')
  useEffect(() => {
    if (!pending.length) return
    let cancelled = false
    let busy = false
    const reconcile = async () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        for (const entry of pending) {
          if (cancelled) return
          try {
            const update = await reconcileTransaction(entry, client)
            if (!update || cancelled) continue
            saveTrackedTransaction(update)
            saveConfirmedProject(update)
            if (entry.action !== 'approve') recordUsage(update.stage === 'confirmed' ? 'transaction_confirmed' : 'transaction_failed', entry.id, transactionSurface(entry.action))
          } catch { /* Keep pending when a receipt or RPC is unavailable; never imply failure or resubmit. */ }
        }
      } finally { busy = false }
    }
    void reconcile()
    const interval = window.setInterval(() => void reconcile(), 12_000)
    return () => { cancelled = true; window.clearInterval(interval) }
    // Reconcile the fixed pending set; receipt updates create a fresh effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey])
  return null
}
