import Link from 'next/link'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const toolLinks = [
  { href: '/swap', label: 'Swap' },
  { href: '/pool', label: 'Pool' },
  { href: '/launch', label: 'Minter' },
  { href: '/launchpad', label: 'Launchpad' },
  { href: '/airdrop', label: 'Airdrop' },
  { href: '/locker', label: 'Locker' },
  { href: '/vesting', label: 'Vesting' },
]

const exploreLinks = [
  { href: '/charts', label: 'Charts' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/explorer', label: 'Explorer' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/ledger', label: 'Ledger' },
]

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
          <p className="desc">{PUBLIC_RELEASE_STATUS.footer}</p>
        </div>
        <div className="footer-cols">
          <div className="footer-col">
            <h4>Tools</h4>
            {toolLinks.map(({ href, label }) => (
              <Link key={href} href={href} prefetch={false}>{label}</Link>
            ))}
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            {exploreLinks.map(({ href, label }) => (
              <Link key={href} href={href} prefetch={false}>{label}</Link>
            ))}
          </div>
          <div className="footer-col">
            <h4>Developers</h4>
            <Link href="/docs" prefetch={false}>Docs</Link>
            <Link href="/tutorials" prefetch={false}>Tutorials</Link>
            <Link href="/governance" prefetch={false}>Governance</Link>
            <a href="https://www.litvm.com/" target="_blank" rel="noopener noreferrer">LitVM website</a>
          </div>
          <div className="footer-col">
            <h4>Community</h4>
            <a href="https://x.com/lesterlabshq" target="_blank" rel="noopener noreferrer">X</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Lester Labs. Built for LitVM LiteForge testnet.</span>
        <span>Testnet assets are for development and testing only.</span>
      </div>
    </footer>
  )
}
