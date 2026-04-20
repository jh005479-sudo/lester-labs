'use client'

import { litvm } from '@/config/chains'

export function getWalletErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred.',
): string {
  if (error instanceof Error) {
    const firstLine = error.message
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean)

    if (firstLine) {
      if (/user rejected|user denied|rejected the request/i.test(firstLine)) {
        return 'Request was rejected in the wallet.'
      }

      return firstLine.slice(0, 180)
    }
  }

  return fallback
}

export function getWrongNetworkMessage(action: string): string {
  return `Switch to LitVM Testnet (Chain ID ${litvm.id}) before ${action}.`
}
