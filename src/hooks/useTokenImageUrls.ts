'use client'

import { useEffect, useState } from 'react'
import { getAllTokenImages } from '@/lib/tokenImageStore'

/**
 * Loads all stored token → image URL mappings from IndexedDB.
 * Returns a Map keyed by lowercase token address.
 */
export function useTokenImageUrls(enabled = true): Map<string, string> {
  const [images, setImages] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!enabled) return

    getAllTokenImages().then(setImages).catch(() => {
      // IndexedDB unavailable (private browsing, etc.) — silently continue
      setImages(new Map())
    })
  }, [enabled])

  return images
}
