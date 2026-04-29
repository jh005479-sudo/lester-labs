export function tokenCountFromFactoryNonce(nonce: number): number {
  if (!Number.isFinite(nonce) || nonce <= 1) return 0
  return Math.floor(nonce) - 1
}
