'use client'

import { useEffect, useState } from 'react'
import { parseTransactionHistory, TRANSACTION_EVENT, TRANSACTION_STORAGE_KEY, type TrackedTransaction } from '@/lib/transactionHistory'

export function useTransactionHistory() {
  const [transactions, setTransactions] = useState<TrackedTransaction[]>([])
  useEffect(() => {
    const refresh = () => {
      try { setTransactions(parseTransactionHistory(localStorage.getItem(TRANSACTION_STORAGE_KEY))) } catch { setTransactions([]) }
    }
    queueMicrotask(refresh)
    window.addEventListener(TRANSACTION_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(TRANSACTION_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return transactions
}
