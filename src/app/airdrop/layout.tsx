import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Batch Distribution Containment Status on LitVM | Lester Labs',
  description: 'Validate recipient lists locally. New token and zkLTC distributions remain disabled until the independently reviewed post-compromise deployment is activated and source-pinned.',
  alternates: { canonical: 'https://www.lester-labs.com/airdrop' },
  openGraph: {
    title: 'Batch Distribution Containment Status | Lester Labs',
    description: 'Local recipient-file validation remains available; new on-chain distributions are disabled during post-compromise replacement.',
    url: 'https://www.lester-labs.com/airdrop',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Batch Distribution Containment Status | Lester Labs',
    description: 'New on-chain distributions are disabled. Local recipient-file validation remains available.',
  },
}

export default function AirdropLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
