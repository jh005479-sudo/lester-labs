import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Launchpad — Browse & Create Token Presales on LitVM | Lester Labs',
  description: 'Browse active and past token presales on LitVM. Create your own ILO with automatic LP seeding, configurable caps, and zero team veto.',
  alternates: { canonical: 'https://www.lester-labs.com/launchpad' },
  openGraph: {
    title: 'Launchpad — Browse & Create Token Presales on LitVM | Lester Labs',
    description: 'Browse token presales on LitVM. Create your own ILO with automatic LP seeding, zero team veto.',
    url: 'https://www.lester-labs.com/launchpad',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Launchpad — Browse & Create Token Presales on LitVM | Lester Labs',
    description: 'Run a permissionless token presale on LitVM. Automatic LP seeding, no team veto.',
  },
}

export default function LaunchpadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}