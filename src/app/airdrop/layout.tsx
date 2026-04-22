import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Airdrop — Batch Token Distribution on LitVM | Lester Labs',
  description: 'Send tokens to hundreds or thousands of wallets in a single atomic transaction. CSV upload, on-chain proof of distribution, zero custody.',
  alternates: { canonical: 'https://www.lester-labs.com/airdrop' },
  openGraph: {
    title: 'Airdrop — Batch Token Distribution on LitVM | Lester Labs',
    description: 'Batch token distribution on LitVM. Single transaction, CSV upload, on-chain verification.',
    url: 'https://www.lester-labs.com/airdrop',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Airdrop — Batch Token Distribution on LitVM | Lester Labs',
    description: 'Send tokens to thousands of wallets in one transaction. CSV upload, no custody.',
  },
}

export default function AirdropLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}