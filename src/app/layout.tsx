import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { Geist_Mono } from 'next/font/google'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { PremiumBackdrop } from '@/components/layout/PremiumBackdrop'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.lester-labs.com'),
  title: {
    default: 'Lester Labs — DeFi Utilities for LitVM',
    // Route metadata already includes the brand. Keep it from being appended twice.
    template: '%s',
  },
  description: 'Lester Labs is a native DeFi suite for LitVM featuring a DEX swap, token launchpad, airdrop tool, liquidity locker, vesting, governance, charts, analytics, and a block explorer. Deploy, swap, and launch on LitVM testnet.',
  keywords: [
    'Lester Labs',
    'LitVM DEX',
    'LitVM swap',
    'LitVM airdrop',
    'LitVM launchpad',
    'LitVM DeFi',
    'LitVM token factory',
    'LitVM liquidity locker',
    'LitVM block explorer',
    'LesterLabs',
    'Lester-Labs',
  ],
  alternates: { canonical: 'https://www.lester-labs.com' },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icon-192.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Lester Labs — DeFi Utilities for LitVM',
    description: 'A native DeFi suite for LitVM. DEX swap, token launchpad, airdrop tool, liquidity locker, vesting, governance, charts, analytics, and a block explorer.',
    url: 'https://www.lester-labs.com',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lester Labs — DeFi Utilities for LitVM',
    description: 'A native DeFi suite for LitVM with swap, launchpad, airdrop, liquidity, charts, analytics, and explorer tools.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${poppins.variable} ${geistMono.variable} antialiased`}
        style={{
          fontFamily: 'var(--font-body)',
        }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Lester Labs',
              url: 'https://www.lester-labs.com',
              logo: 'https://www.lester-labs.com/favicon.ico',
              description: 'A native DeFi suite for LitVM featuring swap, launchpad, airdrop, liquidity, vesting, governance, charts, analytics, and explorer tools.',
              sameAs: [
                'https://x.com/lesterlabshq',
              ],
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://www.lester-labs.com/explorer?q={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <Providers>
          <PremiumBackdrop />
          <LTCBanner />
          <Navbar />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  )
}
