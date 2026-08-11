import type { Metadata } from 'next'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const writesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

export const metadata: Metadata = {
  title: writesActive ? 'Launchpad & Historical Recovery on LitVM | Lester Labs' : 'Launchpad — Historical Presale Recovery on LitVM | Lester Labs',
  description: writesActive
    ? 'Create presales through the source-pinned replacement launchpad and inspect state-dependent recovery on quarantined legacy deployments.'
    : 'Inspect historical Lester Labs ILOs and use state-dependent recovery actions. Creation, funding, contribution, whitelist changes, and finalization remain disabled on legacy deployments.',
  alternates: { canonical: 'https://www.lester-labs.com/launchpad' },
  openGraph: {
    title: writesActive ? 'Launchpad & Historical Recovery on LitVM | Lester Labs' : 'Launchpad — Historical Presale Recovery on LitVM | Lester Labs',
    description: writesActive
      ? 'Source-pinned replacement presale activity plus narrowly authenticated historical ILO recovery.'
      : 'Historical ILO discovery and narrowly authenticated recovery; new presale activity is disabled.',
    url: 'https://www.lester-labs.com/launchpad',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: writesActive ? 'Launchpad on LitVM | Lester Labs' : 'Launchpad Recovery Status | Lester Labs',
    description: writesActive
      ? 'Reviewed replacement presale creation with quarantined legacy recovery.'
      : 'Legacy presale creation, funding, contribution, and finalization are disabled.',
  },
}

export default function LaunchpadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
