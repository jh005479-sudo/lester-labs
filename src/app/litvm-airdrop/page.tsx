import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'LitVM Airdrop — Batch Token Distribution on LitVM | Lester Labs',
  description: 'Send tokens to thousands of wallets in a single transaction with the LitVM airdrop tool. Batch distribution, CSV upload, and zero third-party custody. Built natively on LitVM.',
  alternates: { canonical: 'https://www.lester-labs.com/litvm-airdrop' },
  openGraph: {
    title: 'LitVM Airdrop — Batch Token Distribution on LitVM | Lester Labs',
    description: 'Send tokens to thousands of wallets in a single transaction with the LitVM airdrop tool. Batch distribution, CSV upload, and zero third-party custody.',
    url: 'https://www.lester-labs.com/litvm-airdrop',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LitVM Airdrop — Batch Token Distribution on LitVM | Lester Labs',
    description: 'Send tokens to thousands of wallets in a single transaction with the LitVM airdrop tool. Batch distribution and CSV upload.',
  },
}

const features = [
  { title: 'Single-transaction distribution', body: 'Send to hundreds or thousands of recipients in one atomic transaction. The contract handles all transfers — if any individual transfer fails, the entire batch reverts.' },
  { title: 'On-chain proof of distribution', body: 'Every successful airdrop emits Transfer events for each recipient. Verify the full distribution on the LitVM block explorer using the transaction hash.' },
  { title: 'Native to LitVM', body: 'Runs entirely on LitVM testnet. No servers, no custodial intermediaries — just the contract and your signed transaction.' },
  { title: 'No wallet limit', body: 'Schedule airdrops to activate at a specific block timestamp. Set cliff periods before claiming opens. Perfect for retroactive rewards and retroactive token distributions.' },
]

const FAQ_DATA = [
  { q: 'How does the LitVM Airdrop Tool work?', a: 'Upload a CSV of recipient addresses and token amounts. The tool builds a single batch transaction that calls the Airdrop contract. The contract distributes tokens to every recipient atomically.' },
  { q: 'What format does the CSV need to be in?', a: 'Two columns: address and amount. Example: address,amount followed by one wallet per line. Addresses must be valid Ethereum-format (42 characters, 0x prefix). Amounts are in the smallest token unit.' },
  { q: 'Can I schedule an airdrop for a future date?', a: 'Yes. Set a start time when configuring the airdrop. Tokens are held by the contract until the scheduled time, then distributed automatically.' },
  { q: 'What tokens can I airdrop on LitVM?', a: 'Any ERC-20 deployed on LitVM. Deploy a new token at /launch, then use that same token in the airdrop tool at /airdrop.' },
  { q: 'Is the airdrop tool available on LitVM testnet?', a: 'Yes. The LitVM airdrop tool is live on testnet (chain ID 4441). Use test tokens — no real value is transferred during testing.' },
]

export default function LitvmAirdropPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <div className="noise-overlay">
        <section style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          padding: '80px 24px 60px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'linear-gradient(rgba(107,79,255,1px) 1px, transparent 1px), linear-gradient(90deg, rgba(107,79,255,1px) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          <div style={{
            position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
            width: '600px', height: '400px',
            background: 'radial-gradient(ellipse, rgba(249,115,22,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px' }}>
            <div style={{
              display: 'inline-block', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#fb923c', background: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.2)', borderRadius: '6px',
              padding: '4px 12px', marginBottom: '24px',
            }}>
              Token Distribution
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.05,
              letterSpacing: '-0.02em', marginBottom: '20px',
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-poppins, Poppins, sans-serif)',
            }}>
              LitVM Airdrop
            </h1>
            <p style={{
              fontSize: '18px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65,
              maxWidth: '540px', margin: '0 auto 32px',
            }}>
              Batch token distribution for the LitVM ecosystem. Send to thousands of wallets in a single transaction. CSV upload, merkle proofs, on-chain verification. No custody, no intermediaries.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/airdrop" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 28px', background: '#6B4FFF', color: 'white',
                borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
              }}>
                Open Airdrop Tool →
              </Link>
              <Link href="/docs" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 28px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
                borderRadius: '10px', fontWeight: 600, fontSize: '14px',
                textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
              }}>
                Read the docs
              </Link>
            </div>
          </div>
        </section>

        <section style={{ padding: '60px 24px', maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
              Why use the LitVM Airdrop Tool
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px' }}>
              Purpose-built for LitVM token distribution. No spreadsheets, no manual transfers, no intermediaries.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {features.map((f) => (
              <div key={f.title} style={{
                padding: '24px', background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fb923c', marginBottom: '8px', letterSpacing: '0.04em' }}>{f.title}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{
          padding: '60px 24px',
          background: 'rgba(249,115,22,0.03)',
          borderTop: '1px solid rgba(249,115,22,0.08)',
          borderBottom: '1px solid rgba(249,115,22,0.08)',
        }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>
              How the LitVM Airdrop works
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { n: '01', title: 'Prepare your recipient list', body: 'Create a CSV with two columns: address and amount. The tool accepts up to thousands of rows per batch.' },
                { n: '02', title: 'Upload and validate', body: 'Upload your CSV. Every address is validated for format before you can proceed. Invalid rows are highlighted in red.' },
                { n: '03', title: 'Choose distribution mode', body: 'Upload your CSV, set the token and start time, then confirm the batch.' },
                { n: '04', title: 'Sign and broadcast', body: 'Confirm the transaction in your wallet. Tokens are distributed atomically to all recipients in a single block.' },
              ].map((s) => (
                <div key={s.n} style={{
                  display: 'flex', gap: '24px', alignItems: 'flex-start',
                  padding: '24px', background: 'rgba(255,255,255,0.025)',
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: '#fb923c',
                    background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)',
                    borderRadius: '6px', padding: '4px 10px', flexShrink: 0, marginTop: '2px',
                  }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{s.title}</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '60px 24px', maxWidth: '720px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>
            Frequently asked questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FAQ_DATA.map((faq) => (
              <div key={faq.q} style={{
                padding: '20px 24px', background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'rgba(255,255,255,0.85)' }}>{faq.q}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '80px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, marginBottom: '16px' }}>
            Run your first LitVM airdrop
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '32px', fontSize: '16px' }}>
            Upload your CSV, review the distribution, and send tokens to thousands of wallets in one transaction.
          </p>
          <Link href="/airdrop" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '14px 32px', background: '#6B4FFF', color: 'white',
            borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none',
          }}>
            Open LitVM Airdrop Tool →
          </Link>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQ_DATA.map((faq) => ({
                '@type': 'Question',
                name: faq.q,
                acceptedAnswer: { '@type': 'Answer', text: faq.a },
              })),
            }),
          }}
        />
      </div>
    </div>
  )
}