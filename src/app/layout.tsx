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
  title: {
    default: 'Lester Labs — DeFi Utilities for LitVM',
    template: '%s | Lester Labs on LitVM',
  },
  description: 'Lester Labs is the first native DeFi suite for LitVM — featuring a DEX swap, token launchpad, airdrop tool, liquidity locker, vesting, and governance. Deploy, swap, and launch on LitVM testnet.',
  keywords: [
    'Lester Labs',
    'LitVM DEX',
    'LitVM swap',
    'LitVM airdrop',
    'LitVM launchpad',
    'LitVM DeFi',
    'LitVM token factory',
    'LitVM liquidity locker',
    'LesterLabs',
    'Lester-Labs',
  ],
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
          fontFamily: "'Inter', sans-serif",
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
              description: 'The first native DeFi suite for LitVM — featuring a DEX swap, token launchpad, airdrop tool, liquidity locker, vesting, and governance.',
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
