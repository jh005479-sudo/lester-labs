import type { Metadata } from 'next'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const writesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

export const metadata: Metadata = {
  title: writesActive ? 'Batch Distribution on LitVM | Lester Labs' : 'Batch Distribution Containment Status on LitVM | Lester Labs',
  description: writesActive
    ? 'Validate recipient lists locally and submit bounded token or zkLTC batches through the source-pinned replacement Disperse contract.'
    : 'Validate recipient lists locally. New token and zkLTC distributions remain disabled until the independently reviewed post-compromise deployment is activated and source-pinned.',
  alternates: { canonical: 'https://www.lester-labs.com/airdrop' },
  openGraph: {
    title: writesActive ? 'Batch Distribution on LitVM | Lester Labs' : 'Batch Distribution Containment Status | Lester Labs',
    description: writesActive
      ? 'Local recipient-file validation and source-pinned replacement batch distribution on LitVM testnet.'
      : 'Local recipient-file validation remains available; new on-chain distributions are disabled during post-compromise replacement.',
    url: 'https://www.lester-labs.com/airdrop',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: writesActive ? 'Batch Distribution on LitVM | Lester Labs' : 'Batch Distribution Containment Status | Lester Labs',
    description: writesActive
      ? 'Validate locally, then submit bounded distributions through the reviewed replacement.'
      : 'New on-chain distributions are disabled. Local recipient-file validation remains available.',
  },
}

export default function AirdropLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
