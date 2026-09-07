'use client'

import { useEffect, useEffectEvent } from 'react'
import { readAddressParameter } from '@/lib/projectJourney'

export function useTokenHandoff(apply: (token: string) => void, ready = true, parameter = 'token') {
  const applyToken = useEffectEvent(apply)
  useEffect(() => {
    if (!ready) return
    const token = readAddressParameter(parameter)
    if (token) queueMicrotask(() => applyToken(token))
  }, [ready, parameter])
}
