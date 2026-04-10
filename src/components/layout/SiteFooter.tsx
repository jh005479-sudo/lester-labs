import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="lester-footer">
      <div className="footer-bg">
        <div className="footer-grid-bg" />
        <div className="footer-glow" />
      </div>
      <div className="footer-inner">
        <div className="footer-brand">
          <p className="logo">Lester<span>Labs</span></p>
          <p className="desc">The DeFi utility suite for LitVM.</p>
        </div>
        <div className="footer-cols">
          <div className="footer-col">
            <h4>Tools</h4>
            {['Launch', 'Locker', 'Vesting', 'Airdrop', 'Governance', 'Launchpad'].map((l) => (
              <Link key={l} href={`/${l.toLowerCase()}`}>{l}</Link>
            ))}
          </div>
          <div className="footer-col">
            <h4>Developers</h4>
            <Link href="/docs">Docs</Link>
            <Link href="/explorer">Explorer</Link>
            <a href="https://www.litvm.com/" target="_blank" rel="noopener noreferrer">Built for LitVM</a>
          </div>
          <div className="footer-col">
            <h4>Community</h4>
            <a href="https://x.com/LesterLabsHQ" target="_blank" rel="noopener noreferrer">Twitter/X</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Lester Labs. Built on LitVM.</span>
        <span>Unaudited testnet. Not financial advice.</span>
      </div>
    </footer>
  )
}
