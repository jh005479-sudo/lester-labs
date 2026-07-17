import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Airdrop — Batch Token Distribution on LitVM | Lester Labs',
  description: 'Validate recipient lists locally and distribute tokens in bounded, resumable LitVM batches with on-chain transaction proofs.',
  alternates: { canonical: 'https://www.lester-labs.com/airdrop' },
  openGraph: {
    title: 'Airdrop — Batch Token Distribution on LitVM | Lester Labs',
    description: 'Review CSV recipients and distribute tokens in resumable LitVM batches with on-chain verification.',
    url: 'https://www.lester-labs.com/airdrop',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Airdrop — Batch Token Distribution on LitVM | Lester Labs',
    description: 'Review CSV recipients and distribute tokens in bounded, resumable LitVM batches.',
  },
}

export default function AirdropLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
