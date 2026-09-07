'use client'

import { useEffect, useState } from 'react'
import { USAGE_CONSENT_KEY } from '@/lib/usageMetrics'

export function UsagePreference() {
  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    try { queueMicrotask(() => setEnabled(localStorage.getItem(USAGE_CONSENT_KEY) === 'yes')) } catch { /* Off by default. */ }
    void fetch('/api/usage', { signal: controller.signal }).then((response) => response.json()).then((value) => setAvailable(value.available === true)).catch(() => undefined)
    return () => controller.abort()
  }, [])
  return <details className="workspace-details"><summary>Usage sharing</summary><p>Optional: share which tools you use and whether tasks finish. We don’t collect wallet addresses, transaction hashes, or form contents.</p><p>A random browser ID helps measure return visits. Events are kept for 30 days.</p><label className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" checked={enabled} disabled={!available && !enabled} onChange={(event) => { const next = event.target.checked; try { localStorage.setItem(USAGE_CONSENT_KEY, next ? 'yes' : 'no'); if (!next) { localStorage.removeItem('lester:usage-device:v1'); sessionStorage.removeItem('lester:usage-session:v1') }; setEnabled(next) } catch { setEnabled(false) } }} />Help improve Lester Labs</label>{!available && <p>Usage sharing is currently unavailable.</p>}</details>
}
