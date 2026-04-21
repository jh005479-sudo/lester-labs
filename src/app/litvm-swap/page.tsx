import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'LitVM Swap — Gasless Token Trading on LitVM | Lester Labs',
  description: 'Swap tokens on LitVM with the Lester Labs DEX. 0.30% per trade, treasury-routed LP fees, and gasless intent signing. Trade any LitVM asset with zero third-party dependency.',
  keywords: ['LitVM swap', 'LitVM DEX', 'swap on LitVM', 'LitVM token swap'],
}

const features = [
  { title: '0.30% total fee', body: 'Every trade pays 0.30% in protocol fees. 0.20% routes to the Lester Labs treasury, 0.10% stays in the liquidity pool.' },
  { title: 'Gasless intent signing', body: 'Place your intent, sign a message, execute the trade. Gas is consumed only on final settlement — reducing cost per transaction.' },
  { title: 'Any ERC-20 on LitVM', body: 'Deploy a token via the Token Factory and it immediately becomes available to pair and trade on the LitVM swap interface.' },
  { title: 'Live on testnet', body: 'The LitVM swap is live on LitVM testnet (chain ID 4441). All mechanics and fees are identical to the eventual mainnet deployment.' },
]

const faqs = [
  { q: 'What fee does LitVM Swap charge per trade?', a: '0.30% per swap. 0.20% is captured by the protocol treasury and 0.10% is retained by liquidity providers in the pool.' },
  { q: 'How do I access LitVM Swap?', a: 'Navigate to lester-labs.com/swap. Connect your wallet and switch to LitVM testnet (chain ID 4441). No separate registration required.' },
  { q: 'Which tokens can I swap on LitVM?', a: 'Any ERC-20 token deployed on LitVM. You can deploy a new token at /launch using the Token Factory, then swap it immediately on /swap.' },
  { q: 'Is there slippage protection?', a: 'Yes. You can set a custom slippage tolerance per transaction. The default is 0.5% but can be adjusted in the swap interface.' },
  { q: 'What gas token is used for LitVM Swap?', a: 'zkLTC — the native gas token of LitVM. You can get test zkLTC from the LitVM testnet faucet to trade without spending real funds.' },
  { q: 'How does the DEX connect to the Launchpad?', a: 'When a Launchpad presale finalises, it seeds liquidity directly into the same Uniswap V2 deployment that powers /swap. One unified liquidity layer.' },
]

export default function LitvmSwapPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <div className="noise-overlay">
        <section style={{
          minHeight: '60vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center',
          padding: '80px 24px 60px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'linear-gradient(rgba(107,79,255,1px) 1px, transparent 1px), linear-gradient(90deg, rgba(107,79,255,1px) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          <div style={{
            position: 'absolute',
            top: '20%', left: '50%', transform: 'translateX(-50%)',
            width: '600px', height: '400px',
            background: 'radial-gradient(ellipse, rgba(107,79,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px' }}>
            <div style={{
              display: 'inline-block',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#8B74FF', background: 'rgba(107,79,255,0.1)',
              border: '1px solid rgba(107,79,255,0.2)', borderRadius: '6px',
              padding: '4px 12px', marginBottom: '24px',
            }}>
              Token Swap
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.05,
              letterSpacing: '-0.02em', marginBottom: '20px',
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-poppins, Poppins, sans-serif)',
            }}>
              LitVM Swap
            </h1>
            <p style={{
              fontSize: '18px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65,
              maxWidth: '540px', margin: '0 auto 32px',
            }}>
              Gasless intent. 0.30% per trade. Treasury-routed LP. Swap any ERC-20 on LitVM through the Lester Labs decentralized exchange infrastructure.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/swap" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 28px', background: '#6B4FFF', color: 'white',
                borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
              }}>
                Open Swap →
              </Link>
              <Link href="/docs/dex-swap" style={{
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
              Why swap on LitVM with Lester Labs
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px' }}>
              Every feature serves LitVM token traders and LP providers — not external ecosystems.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {features.map((f) => (
              <div key={f.title} style={{
                padding: '24px', background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#8B74FF', marginBottom: '8px', letterSpacing: '0.04em' }}>{f.title}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{
          padding: '60px 24px',
          background: 'rgba(107,79,255,0.03)',
          borderTop: '1px solid rgba(107,79,255,0.08)',
          borderBottom: '1px solid rgba(107,79,255,0.08)',
        }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>
              How LitVM Swap works
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { n: '01', title: 'Connect to LitVM', body: 'Add LitVM testnet (chain ID 4441) to MetaMask or Rabby. RPC: https://liteforge.rpc.caldera.xyz/infra-partner-http.' },
                { n: '02', title: 'Approve the router', body: 'For ERC-20 tokens, approve the Lester Labs router once per token. This lets the router move your tokens on execution.' },
                { n: '03', title: 'Place your swap', body: 'Select input token, output token, and amount. The live quote comes directly from the LitVM router. Set your slippage tolerance.' },
                { n: '04', title: 'Sign, settle, done', body: 'Sign the transaction. Gas is charged only on settlement. The trade executes and liquidity is updated on-chain.' },
              ].map((s) => (
                <div key={s.n} style={{
                  display: 'flex', gap: '24px', alignItems: 'flex-start',
                  padding: '24px', background: 'rgba(255,255,255,0.025)',
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: '#6B4FFF',
                    background: 'rgba(107,79,255,0.12)', border: '1px solid rgba(107,79,255,0.2)',
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
            {faqs.map((faq) => (
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
            Start swapping on LitVM
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '32px', fontSize: '16px' }}>
            Live on LitVM testnet. Connect your wallet and trade any token.
          </p>
          <Link href="/swap" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '14px 32px', background: '#6B4FFF', color: 'white',
            borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none',
          }}>
            Open LitVM Swap →
          </Link>
        </section>
      </div>
    </div>
  )
}