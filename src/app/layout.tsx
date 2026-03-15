import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { Geist_Mono } from 'next/font/google'
import { Providers } from './providers'
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

export const metadata: Metadata = {
  title: 'Lester Labs — DeFi Utilities for LitVM',
  description: 'Token launch, locking, vesting, airdrop, and governance tools built for LitVM.',
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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
