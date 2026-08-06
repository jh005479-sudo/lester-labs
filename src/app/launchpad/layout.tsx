import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Launchpad — Historical Presale Recovery on LitVM | Lester Labs',
  description: 'Inspect historical Lester Labs ILOs and use state-dependent recovery actions. Creation, funding, contribution, whitelist changes, and finalization remain disabled on legacy deployments.',
  alternates: { canonical: 'https://www.lester-labs.com/launchpad' },
  openGraph: {
    title: 'Launchpad — Historical Presale Recovery on LitVM | Lester Labs',
    description: 'Historical ILO discovery and narrowly authenticated recovery; new presale activity is disabled.',
    url: 'https://www.lester-labs.com/launchpad',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Launchpad Recovery Status | Lester Labs',
    description: 'Legacy presale creation, funding, contribution, and finalization are disabled.',
  },
}

export default function LaunchpadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
