'use client'

import { useEffect, useState } from 'react'
import { restoreFormDraft } from '@/lib/projectJourney'

/** Device-local form data only. A saved draft never authorizes a transaction. */
export function useFormDraft<T extends object>(key: string, defaults: T) {
  const [value, setValue] = useState<T>(defaults)
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    queueMicrotask(() => {
      try { setValue(restoreFormDraft(localStorage.getItem(`lester:draft:${key}:v1`), defaults)) } catch { /* Storage unavailable. */ }
      setReady(true)
    })
    // The initial schema is fixed for the lifetime of this form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    if (!ready) return
    let stored = false
    try { localStorage.setItem(`lester:draft:${key}:v1`, JSON.stringify(value)); stored = true } catch { /* Keep the live form usable. */ }
    queueMicrotask(() => setSaved(stored))
  }, [key, ready, value])
  return [value, setValue, ready, saved] as const
}
