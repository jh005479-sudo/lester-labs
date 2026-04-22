'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ScrollHero from '@/components/home/ScrollHero'

const tools = [
  {
    name: 'Lester Minter', label: 'Token Creation',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B4FFF" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M8 10h8"/><path d="M9 14h6"/></svg>`,
    tagline: 'Deploy ERC-20 tokens in 3 steps',
    desc: 'Configure supply, name, and features — deploy in under a minute.',
    fee: '0.05 zkLTC', color: '#6B4FFF', href: '/launch',
    stats: [['Type','ERC-20'],['Speed','< 1 min'],['Code','None']],
    imgPos: '30%', img: '/images/carousel/token-factory.png'
  },
  {
    name: 'Lester Lockup', label: 'LP Security',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2DCE89" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    tagline: 'Lock LP tokens with proof',
    desc: 'Lock liquidity on-chain and generate a shareable certificate.',
    fee: '0.03 zkLTC', color: '#2DCE89', href: '/locker',
    stats: [['Proof','On-chain'],['Certificate','Shareable'],['Trust','Day one']],
    imgPos: '30%', img: '/images/carousel/liquidity-locker.png'
  },
  {
    name: 'Lester Vester', label: 'Token Distribution',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5A623" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    tagline: 'Linear & cliff schedules',
    desc: 'Set vesting schedules for teams and investors. Auto-release.',
    fee: '0.03 zkLTC', color: '#F5A623', href: '/vesting',
    stats: [['Schedules','Linear + Cliff'],['Release','Automatic'],['Claims','Zero']],
    imgPos: '50%', img: '/images/carousel/token-vesting.png'
  },
  {
    name: 'Lester Dropper', label: 'Mass Distribution',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#36D1DC" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    tagline: 'Batch send in one transaction',
    desc: 'Send tokens to hundreds of wallets at once. CSV supported.',
    fee: '0.01 zkLTC', color: '#36D1DC', href: '/airdrop',
    stats: [['Wallets','Hundreds'],['Import','CSV'],['Tx','Single']],
    imgPos: '50%', img: '/images/carousel/airdrop.png'
  },
  {
    name: 'Lester Gov', label: 'Community Voting',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E44FB5" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    tagline: 'Gasless community voting',
    desc: 'Create proposals and let token holders vote. No gas costs.',
    fee: 'Free', color: '#E44FB5', href: '/governance',
    stats: [['Gas','Zero'],['Style','Snapshot'],['Cost','Free']],
    imgPos: '50%', img: '/images/carousel/governance.png'
  },
  {
    name: 'Lester Launch', label: 'Presale Platform',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3"/></svg>`,
    tagline: 'Permissionless presales',
    desc: 'Community presales with automatic LP creation on LitVM\'s native dex.',
    fee: '0.03 zkLTC + 2%', color: '#5E6AD2', href: '/launchpad',
    stats: [['LP','Auto-created'],['Access','Open']],
    imgPos: '50%', img: '/images/carousel/launchpad.png'
  },
]

export default function HomePage() {
  const [introComplete, setIntroComplete] = useState(false)

  useEffect(() => {
    document.body.classList.add('home-page-active')
    // ─── Google Fonts ────────────────────────────────────
    const fontLink = document.createElement('link')
    fontLink.rel = 'stylesheet'
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Sora:wght@600;700;800&display=swap'
    document.head.appendChild(fontLink)

    // ─── Carousel ────────────────────────────────────────
    const track = document.getElementById('carousel-track') as HTMLElement
    const dotsWrap = document.getElementById('carousel-dots') as HTMLElement
    let currentSlide = 0

    if (track && dotsWrap) {
      tools.forEach((t, i) => {
        const r = parseInt(t.color.slice(1,3),16)
        const g = parseInt(t.color.slice(3,5),16)
        const b = parseInt(t.color.slice(5,7),16)

        const slide = document.createElement('div')
        slide.className = 'carousel-slide' + (i===0 ? ' active' : '')
        slide.style.setProperty('--card-color', t.color)
        slide.style.setProperty('--card-glow', `rgba(${r},${g},${b},.1)`)
        slide.style.setProperty('--card-glow-sm', `rgba(${r},${g},${b},.05)`)
        slide.style.setProperty('--card-color-25', `rgba(${r},${g},${b},.25)`)
        slide.style.setProperty('--card-color-15', `rgba(${r},${g},${b},.15)`)
        slide.innerHTML = `
          <div class="c-card" onclick="window.location.href='${t.href}'" style="cursor:pointer">
            <div class="c-card-body">
              <div>
                <div class="c-card-label" style="color:${t.color}">${t.label}</div>
                <div class="c-card-title" style="margin-top:12px">
                  <div class="c-icon" style="background:rgba(${r},${g},${b},.12);border:1px solid rgba(${r},${g},${b},.15)">${t.icon}</div>
                  <h3>${t.name}</h3>
                </div>
              </div>
              <div class="c-card-stats">
                ${t.stats.map(([k,v]) => `<div class="c-card-stat"><span>${k}</span><span>${v}</span></div>`).join('')}
              </div>
              <div>
                <div style="font-size:12px;color:rgba(240,238,245,.5);margin-bottom:16px;line-height:1.55">${t.desc}</div>
                <a href="${t.href}" class="c-card-link" style="color:${t.color};text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px">↗ Open ${t.name}</a>
              </div>
            </div>
            <div class="c-card-visual">
              <div class="c-card-visual-grid"></div>
              <div class="c-card-visual-glow" style="background:${t.color}"></div>
              <img src="${t.img}" alt="${t.name}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${t.imgPos} center;z-index:1;border-radius:0">
            </div>
          </div>`
        track.appendChild(slide)

        const dot = document.createElement('div')
        dot.className = 'c-dot' + (i===0 ? ' active' : '')
        dot.onclick = () => goSlide(i)
        dotsWrap.appendChild(dot)
      })
    }

    function goSlide(i: number) {
      i = ((i % tools.length) + tools.length) % tools.length
      currentSlide = i
      const slides = track.querySelectorAll('.carousel-slide')
      const wrapW = (document.getElementById('carousel-wrap') as HTMLElement).offsetWidth
      slides.forEach((s,j) => s.classList.toggle('active', j===i))
      dotsWrap.querySelectorAll('.c-dot').forEach((d: Element, j: number) => {
        d.classList.toggle('active', j===i);
        (d as HTMLElement).style.background = j===i ? tools[i].color : ''
      })
      requestAnimationFrame(() => {
        const activeSlide = slides[i] as HTMLElement
        const slideLeft = activeSlide.offsetLeft
        const slideW = activeSlide.offsetWidth
        const offset = slideLeft - (wrapW - slideW) / 2;
        (track as HTMLElement).style.transform = `translateX(${-offset}px)`
      })
    }

    window.addEventListener('resize', () => goSlide(currentSlide))
    setTimeout(() => goSlide(0), 50)

    // Arrow buttons
    const prevBtn = document.getElementById('carousel-prev')
    const nextBtn = document.getElementById('carousel-next')
    prevBtn?.addEventListener('click', () => goSlide(currentSlide - 1))
    nextBtn?.addEventListener('click', () => goSlide(currentSlide + 1))

    let autoTimer = setInterval(() => goSlide(currentSlide + 1), 4000)
    const wrap = document.getElementById('carousel-wrap')
    wrap?.addEventListener('mouseenter', () => clearInterval(autoTimer))
    wrap?.addEventListener('mouseleave', () => { autoTimer = setInterval(() => goSlide(currentSlide + 1), 4000) })

    // ─── Scroll-triggered reveals ─────────────────────────
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible') })
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal, .reveal-scale, .title-reveal, .sub-reveal').forEach(el => revealObserver.observe(el))

    // ─── 3D Card tilt ──────────────────────────────────────
    document.querySelectorAll('.tilt-card').forEach((card) => {
      const el = card as HTMLElement
      el.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = el.getBoundingClientRect()
        const x = e.clientX - rect.left, y = e.clientY - rect.top
        const rotateX = ((y - rect.height/2) / (rect.height/2)) * -4
        const rotateY = ((x - rect.width/2) / (rect.width/2)) * 4
        el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`
      })
      el.addEventListener('mouseleave', () => { el.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateY(0)' })
    })

    // ─── Magnetic buttons ─────────────────────────────────
    document.querySelectorAll('.magnetic').forEach((btn) => {
      const el = btn as HTMLElement
      el.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = el.getBoundingClientRect()
        const x = e.clientX - rect.left - rect.width/2
        const y = e.clientY - rect.top - rect.height/2
        el.style.transform = `translate(${x*0.15}px, ${y*0.15}px)`
      })
      el.addEventListener('mouseleave', () => { el.style.transform = 'translate(0,0)' })
    })

    // ─── Scroll progress bar ──────────────────────────────
    const progressBar = document.getElementById('scroll-progress')
    function updateProgress() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (progressBar) progressBar.style.width = ((scrollTop / docHeight) * 100) + '%'
    }
    window.addEventListener('scroll', updateProgress, { passive: true })

    // ─── Back to top ───────────────────────────────────────
    const backBtn = document.getElementById('back-to-top')
    window.addEventListener('scroll', () => {
      backBtn?.classList.toggle('visible', window.scrollY > window.innerHeight)
    }, { passive: true })
    backBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

    // ─── Background color shift ────────────────────────────
    const body = document.body
    const bgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const section = entry.target as HTMLElement
        body.style.transition = 'background-color 1.5s ease'
        if (section.classList.contains('trust-section')) body.style.backgroundColor = '#0b0819'
        else if (section.classList.contains('builders-section')) body.style.backgroundColor = '#090816'
        else if (section.classList.contains('cta-section')) body.style.backgroundColor = '#0a0818'
      })
    }, { threshold: 0.3 })
    document.querySelectorAll('.trust-section, .builders-section, .cta-section').forEach(s => bgObserver.observe(s))


    return () => {
      document.body.classList.remove('home-page-active')
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', () => goSlide(currentSlide))
      clearInterval(autoTimer)
    }
  }, [])

  return (
    <div className="noise-overlay" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* Fixed UI elements */}
      <div className="scroll-progress" id="scroll-progress" />
      <div className="back-to-top" id="back-to-top">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
      </div>


      <main>
        {/* Visually hidden H1 for accessibility and SEO crawlers */}
        <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
          Lester Labs — DeFi Utilities for LitVM
        </h1>
        {/* HERO */}
        <ScrollHero onIntroComplete={() => setIntroComplete(true)} />

        {/* Everything below scrolls over the fixed hero */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            background:
              'linear-gradient(180deg, rgba(10,8,24,0) 0px, rgba(10,8,24,0.38) 140px, var(--bg) 360px)',
            opacity: introComplete ? 1 : 0,
            transition: 'opacity 500ms ease',
          }}
        >

        {/* ── TOOL SHOWCASE CAROUSEL ─────────────────────── */}
        <section id="suite-section" className="carousel-section">
          <div className="carousel-header reveal">
            <div className="title-glow" />
            <div className="title-lines" />
            <div className="title-particles">
              <span /><span /><span /><span /><span /><span />
            </div>
            <div className="section-label">The Suite</div>
            <h2 className="suite-title title-reveal">
              <span className="word">Six tools.</span>&nbsp;
              <span className="word highlight">One platform.</span>
            </h2>
            <p className="suite-sub sub-reveal">From token creation to governance — deploy, lock, vest, airdrop, vote, and launch.</p>
          </div>

          <div className="carousel-wrap" id="carousel-wrap">
            <div className="carousel-track" id="carousel-track" />
            <div className="carousel-nav">
              <div className="carousel-arrow" id="carousel-prev">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </div>
              <div className="carousel-arrow" id="carousel-next">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 6 15 12 9 18"/></svg>
              </div>
            </div>
          </div>
          <div className="carousel-dots" id="carousel-dots" />
        </section>

        <div style={{ padding: '0 clamp(16px,4vw,40px)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}><div className="divider" /></div>
        </div>

        {/* ── EXPLORE LITVM TOOLS ──────────────────────── */}
        <section style={{ padding: 'clamp(60px,7vw,90px) clamp(16px,4vw,40px)', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className='section-label'>Getting Started</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, marginTop: 12, marginBottom: 12, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Explore the LitVM ecosystem</h2>
            <p style={{ fontSize: '16px', color: 'rgba(240,238,245,0.45)', maxWidth: 500, margin: '0 auto' }}>Everything you need to get started on LitVM — from testnet setup to your first swap, airdrop, and token launch.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {[
              { href: '/litvm-testnet', label: 'LitVM Testnet', desc: 'Add the network, claim test tokens, and start exploring.' },
              { href: '/litvm-swap', label: 'LitVM Swap', desc: 'Gasless token trading at 0.30% per swap.' },
              { href: '/litvm-airdrop', label: 'LitVM Airdrop', desc: 'Batch token distribution to thousands of wallets.' },
              { href: '/litvm-launchpad', label: 'LitVM Launchpad', desc: 'Permissionless token presales with automatic LP creation.' },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{ display: 'block', padding: '20px 22px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, textDecoration: 'none', transition: 'border-color 0.2s, background 0.2s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(107,79,255,0.3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(240,238,245,0.9)', marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: '13px', color: 'rgba(240,238,245,0.4)', lineHeight: 1.5 }}>{item.desc}</div>
              </a>
            ))}
          </div>
        </section>

        <section className="trust-section" style={{ paddingLeft: 'clamp(16px,4vw,40px)', paddingRight: 'clamp(16px,4vw,40px)' }}>
          <div className="trust-bg">
            <div className="trust-grid-bg" />
            <div className="trust-scanline" />
          </div>

          <div className="trust-header reveal">
            <div className="trust-glow" />
            <div className="trust-lines" />
            <div className="trust-particles"><span /><span /><span /><span /><span /></div>
            <div className="section-label">Why Lester Labs</div>
            <h2 className="trust-title title-reveal">
              <span className="word">Built different.</span>&nbsp;
              <span className="word highlight">Built to last.</span>
            </h2>
            <p className="trust-sub sub-reveal">Security, speed, and community — the pillars every DeFi project needs.</p>
          </div>

          <div className="trust-cards">
            {/* Battle-Tested */}
            <div className="trust-card reveal reveal-delay-1 tilt-card" style={{ '--tc-color-10': 'rgba(45,206,137,.1)', '--tc-color-15': 'rgba(45,206,137,.15)', '--tc-color-20': 'rgba(45,206,137,.2)', '--tc-color-30': 'rgba(45,206,137,.3)', '--tc-color-40': 'rgba(45,206,137,.4)', '--tc-glow': 'rgba(45,206,137,.06)' } as React.CSSProperties}>
              <div className="tc-status">
                <div className="tc-dot" style={{ background: '#2DCE89' }} />
                <span className="tc-status-text">Verified</span>
              </div>
              <div className="tc-icon-wrap" style={{ background: 'rgba(45,206,137,.08)', border: '1px solid rgba(45,206,137,.12)' }}>
                <div className="tc-ring" />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DCE89" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
              </div>
              <div className="tc-value">Battle-Tested</div>
              <div className="tc-label">Industry-standard tools, proven security from day one.</div>
              <div className="tc-data">
                <div className="tc-data-item"><span>Source</span><span>OZ</span></div>
                <div className="tc-data-item"><span>Locks</span><span>Unicrypt</span></div>
                <div className="tc-data-item"><span>Voting</span><span>Snapshot</span></div>
              </div>
            </div>

            {/* LitVM Native */}
            <div className="trust-card reveal reveal-delay-2 tilt-card" style={{ '--tc-color-10': 'rgba(107,79,255,.1)', '--tc-color-15': 'rgba(107,79,255,.15)', '--tc-color-20': 'rgba(107,79,255,.2)', '--tc-color-30': 'rgba(107,79,255,.3)', '--tc-color-40': 'rgba(107,79,255,.4)', '--tc-glow': 'rgba(107,79,255,.06)' } as React.CSSProperties}>
              <div className="tc-status">
                <div className="tc-dot" style={{ background: '#6B4FFF' }} />
                <span className="tc-status-text">Live on Testnet</span>
              </div>
              <div className="tc-icon-wrap" style={{ background: 'rgba(107,79,255,.08)', border: '1px solid rgba(107,79,255,.12)' }}>
                <div className="tc-ring" />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B4FFF" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div className="tc-value">LitVM Native</div>
              <div className="tc-label">The first DeFi utility suite built natively for LitVM, live from day one of mainnet launch. No bridges, no workarounds.</div>
              <div className="tc-data">
                <div className="tc-data-item"><span>Network</span><span>LitVM</span></div>
                <div className="tc-data-item"><span>Status</span><span>Testnet</span></div>
                <div className="tc-data-item"><span>Tools</span><span>6 Live</span></div>
              </div>
            </div>

            {/* Community */}
            <div className="trust-card reveal reveal-delay-3 tilt-card" style={{ '--tc-color-10': 'rgba(228,79,181,.1)', '--tc-color-15': 'rgba(228,79,181,.15)', '--tc-color-20': 'rgba(228,79,181,.2)', '--tc-color-30': 'rgba(228,79,181,.3)', '--tc-color-40': 'rgba(228,79,181,.4)', '--tc-glow': 'rgba(228,79,181,.06)' } as React.CSSProperties}>
              <div className="tc-status">
                <div className="tc-dot" style={{ background: '#E44FB5' }} />
                <span className="tc-status-text">Community Focused</span>
              </div>
              <div className="tc-icon-wrap" style={{ background: 'rgba(228,79,181,.08)', border: '1px solid rgba(228,79,181,.12)' }}>
                <div className="tc-ring" />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E44FB5" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="tc-value">Community</div>
              <div className="tc-label">Built by a team that cares deeply about the success of the LitVM and Litecoin ecosystem. Community-driven from the start.</div>
              <div className="tc-data">
                <div className="tc-data-item"><span>Team</span><span>Trusted</span></div>
                <div className="tc-data-item"><span>DEX</span><span>Pending</span></div>
                <div className="tc-data-item"><span>Chain</span><span>LitVM</span></div>
              </div>
            </div>
          </div>
        </section>

        <div style={{ padding: '0 clamp(16px,4vw,40px)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}><div className="divider" /></div>
        </div>

        {/* ── FOR BUILDERS BENTO ─────────────────────────── */}
        <section className="builders-section" style={{ paddingLeft: 'clamp(16px,4vw,40px)', paddingRight: 'clamp(16px,4vw,40px)' }}>
          <div className="builders-header reveal">
            <div className="builders-glow" />
            <div className="builders-lines" />
            <div className="builders-particles"><span /><span /><span /><span /></div>
            <div className="section-label">Developers</div>
            <h2 className="builders-title title-reveal">
              <span className="word">For</span>&nbsp;
              <span className="word highlight">Builders</span>
            </h2>
            <p className="builders-sub sub-reveal">Docs, grants, open-source contracts, and community — everything you need to ship on LitVM.</p>
          </div>

          <div className="builders-bento">
            {/* Docs */}
            <a href="/docs" className="b-card" style={{ '--b-glow': 'rgba(107,79,255,.08)' } as React.CSSProperties}>
              <div className="b-card-bg" style={{ background: 'linear-gradient(145deg,#1a1440 0%,#251b52 40%,#1e1245 70%,#140f30 100%)' }} />
              <div className="b-card-top">
                <div className="b-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B74FF" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>
                <div className="b-card-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></div>
              </div>
              <div className="b-card-visual">
                <svg width="200" height="170" viewBox="0 0 200 170" fill="none" className="b-float2">
                  <path d="M50 130 L50 35 Q50 25 60 25 L150 25 Q160 25 160 35 L160 130 Z" fill="#2a2060" stroke="#6B4FFF" strokeWidth="1"/>
                  <path d="M50 130 L50 35" stroke="#8B74FF" strokeWidth="2"/>
                  <rect x="56" y="32" width="98" height="90" rx="2" fill="#1e1748" stroke="rgba(107,79,255,.2)" strokeWidth=".5"/>
                  <rect x="66" y="44" width="50" height="3" rx="1.5" fill="rgba(107,79,255,.4)"/>
                  <rect x="66" y="54" width="75" height="2" rx="1" fill="rgba(255,255,255,.08)"/>
                  <rect x="66" y="62" width="60" height="2" rx="1" fill="rgba(255,255,255,.08)"/>
                  <rect x="66" y="70" width="70" height="2" rx="1" fill="rgba(255,255,255,.08)"/>
                  <rect x="66" y="82" width="40" height="3" rx="1.5" fill="rgba(107,79,255,.3)"/>
                  <rect x="66" y="92" width="65" height="2" rx="1" fill="rgba(255,255,255,.08)"/>
                  <rect x="66" y="100" width="55" height="2" rx="1" fill="rgba(255,255,255,.08)"/>
                  <path d="M138 25 L138 50 L143 45 L148 50 L148 25" fill="#6B4FFF" opacity=".6"/>
                  <g className="b-float" style={{ animationDelay: '.3s' }}>
                    <rect x="135" y="10" width="50" height="35" rx="3" fill="#251b52" stroke="rgba(107,79,255,.25)" strokeWidth=".5" transform="rotate(8 160 27)"/>
                    <rect x="143" y="18" width="30" height="2" rx="1" fill="rgba(107,79,255,.2)" transform="rotate(8 160 27)"/>
                    <rect x="143" y="24" width="22" height="2" rx="1" fill="rgba(255,255,255,.06)" transform="rotate(8 160 27)"/>
                  </g>
                  <g className="b-float" style={{ animationDelay: '.8s', animationDuration: '5s' }}>
                    <rect x="155" y="55" width="40" height="30" rx="3" fill="#201748" stroke="rgba(107,79,255,.2)" strokeWidth=".5" transform="rotate(-5 175 70)"/>
                    <rect x="162" y="63" width="24" height="2" rx="1" fill="rgba(107,79,255,.15)" transform="rotate(-5 175 70)"/>
                    <rect x="162" y="69" width="18" height="2" rx="1" fill="rgba(255,255,255,.05)" transform="rotate(-5 175 70)"/>
                  </g>
                  <circle cx="172" cy="15" r="2" fill="#8B74FF" className="b-sparkle"/>
                  <circle cx="185" cy="45" r="1.5" fill="#6B4FFF" className="b-sparkle" style={{ animationDelay: '1s' }}/>
                  <text x="155" y="112" fontSize="16" fill="rgba(107,79,255,.25)" fontFamily="monospace" className="b-glow-anim">&lt;/&gt;</text>
                </svg>
              </div>
              <div className="b-card-body"><h3>Developer Docs</h3><p>Roll up your sleeves and start building.</p></div>
            </a>

            {/* Block Explorer */}
            <a href="/explorer" className="b-card reveal reveal-delay-2 tilt-card" style={{ '--b-glow': 'rgba(245,166,35,.08)' } as React.CSSProperties}>
              <div className="b-card-bg" style={{ background: 'linear-gradient(145deg,#1f1810 0%,#2a1e12 40%,#1e1610 70%,#141008 100%)' }} />
              <div className="b-card-top">
                <div className="b-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8"/></svg></div>
                <div className="b-card-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></div>
              </div>
              <div className="b-card-visual">
                <svg width="180" height="160" viewBox="0 0 180 160" fill="none" className="b-float" style={{ animationDuration: '5s' }}>
                  <ellipse cx="105" cy="95" rx="32" ry="8" fill="#3d2e10" stroke="#F5A623" strokeWidth=".5" opacity=".3"/>
                  <rect x="73" y="65" width="64" height="30" rx="0" fill="#2a1e12"/>
                  <ellipse cx="105" cy="65" rx="32" ry="8" fill="#3d2e10" stroke="#F5A623" strokeWidth=".5" opacity=".4"/>
                  <ellipse cx="90" cy="105" rx="32" ry="8" fill="#3d2e10" stroke="#F5A623" strokeWidth=".5" opacity=".4"/>
                  <rect x="58" y="80" width="64" height="25" rx="0" fill="#2a1e12"/>
                  <ellipse cx="90" cy="80" rx="32" ry="8" fill="#463514" stroke="#F5A623" strokeWidth=".8"/>
                  <ellipse cx="90" cy="87" rx="32" ry="7" fill="none" stroke="#F5A623" strokeWidth=".3" opacity=".3"/>
                  <ellipse cx="90" cy="94" rx="32" ry="7" fill="none" stroke="#F5A623" strokeWidth=".3" opacity=".3"/>
                  <ellipse cx="75" cy="115" rx="32" ry="8" fill="#3d2e10" stroke="#F5A623" strokeWidth=".5" opacity=".5"/>
                  <rect x="43" y="92" width="64" height="23" rx="0" fill="#2a1e12"/>
                  <ellipse cx="75" cy="92" rx="32" ry="8" fill="#4a3816" stroke="#F5A623" strokeWidth="1"/>
                  <circle cx="75" cy="92" r="14" fill="none" stroke="#F5A623" strokeWidth=".5" opacity=".4"/>
                  <circle cx="75" cy="92" r="8" fill="none" stroke="#F5A623" strokeWidth=".3" opacity=".3"/>
                  <text x="71" y="96" fontSize="11" fill="#F5A623" fontFamily="Sora,sans-serif" fontWeight="700" opacity=".5">$</text>
                  <g className="b-float" style={{ animationDelay: '.5s', animationDuration: '3s' }}>
                    <ellipse cx="140" cy="45" rx="18" ry="18" fill="#3d2e10" stroke="#F5A623" strokeWidth="1" transform="rotate(-20 140 45)"/>
                    <ellipse cx="140" cy="45" rx="10" ry="10" fill="none" stroke="#F5A623" strokeWidth=".5" opacity=".4" transform="rotate(-20 140 45)"/>
                    <text x="135" y="50" fontSize="13" fill="#F5A623" fontFamily="Sora,sans-serif" fontWeight="700" opacity=".6" transform="rotate(-20 140 45)">$</text>
                  </g>
                  <circle cx="125" cy="30" r="2.5" fill="#F5A623" className="b-sparkle"/>
                  <circle cx="155" cy="60" r="2" fill="#F5A623" className="b-sparkle" style={{ animationDelay: '.7s' }}/>
                  <circle cx="45" cy="75" r="1.5" fill="#F5A623" className="b-sparkle" style={{ animationDelay: '1.4s' }}/>
                </svg>
              </div>
              <div className="b-card-body"><h3>Block Explorer</h3><p>Track transactions, blocks, and on-chain activity.</p></div>
            </a>

            {/* Connect on X */}
            <a href="https://x.com/lesterlabshq" target="_blank" rel="noopener noreferrer" className="b-card" style={{ '--b-glow': 'rgba(54,209,220,.08)' } as React.CSSProperties}>
              <div className="b-card-bg" style={{ background: 'linear-gradient(145deg,#0e1a1e 0%,#122228 40%,#0e1820 70%,#0a1015 100%)' }} />
              <div className="b-card-top">
                <div className="b-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#36D1DC" strokeWidth="1.5"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg></div>
                <div className="b-card-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></div>
              </div>
              <div className="b-card-visual">
                <svg width="190" height="160" viewBox="0 0 190 160" fill="none">
                  <g className="b-float2" style={{ animationDuration: '6s' }}>
                    <rect x="30" y="20" width="130" height="100" rx="10" fill="#0e1820" stroke="#36D1DC" strokeWidth=".8"/>
                    <rect x="30" y="20" width="130" height="20" rx="10" fill="#132830"/>
                    <rect x="30" y="30" width="130" height="10" fill="#132830"/>
                    <circle cx="46" cy="30" r="3" fill="#ef4444" opacity=".5"/>
                    <circle cx="56" cy="30" r="3" fill="#F5A623" opacity=".5"/>
                    <circle cx="66" cy="30" r="3" fill="#2DCE89" opacity=".5"/>
                    <rect x="42" y="48" width="8" height="3" rx="1" fill="#36D1DC" opacity=".5"/>
                    <rect x="54" y="48" width="45" height="3" rx="1" fill="rgba(255,255,255,.08)"/>
                    <rect x="42" y="58" width="12" height="3" rx="1" fill="#2DCE89" opacity=".4"/>
                    <rect x="58" y="58" width="55" height="3" rx="1" fill="rgba(255,255,255,.08)"/>
                    <rect x="50" y="68" width="35" height="3" rx="1" fill="rgba(255,255,255,.06)"/>
                    <rect x="50" y="78" width="50" height="3" rx="1" fill="rgba(255,255,255,.06)"/>
                    <rect x="42" y="88" width="8" height="3" rx="1" fill="#36D1DC" opacity=".5"/>
                    <rect x="54" y="88" width="30" height="3" rx="1" fill="rgba(255,255,255,.08)"/>
                    <rect x="42" y="98" width="7" height="3" rx="1" fill="#36D1DC" className="b-glow-anim"/>
                  </g>
                  <line x1="165" y1="50" x2="165" y2="110" stroke="#36D1DC" strokeWidth="1" opacity=".15"/>
                  <circle cx="165" cy="55" r="4" fill="#122228" stroke="#36D1DC" strokeWidth=".8" opacity=".4"/>
                  <circle cx="165" cy="80" r="4" fill="#122228" stroke="#36D1DC" strokeWidth=".8" opacity=".4"/>
                  <line x1="165" y1="80" x2="178" y2="95" stroke="#36D1DC" strokeWidth=".8" opacity=".2" className="b-dash"/>
                  <circle cx="178" cy="98" r="3.5" fill="#36D1DC" opacity=".15" className="b-glow-anim" style={{ animationDelay: '.5s' }}/>
                  <circle cx="165" cy="105" r="4" fill="#122228" stroke="#2DCE89" strokeWidth=".8" opacity=".5"/>
                  <circle cx="175" cy="38" r="1.5" fill="#36D1DC" className="b-sparkle" style={{ animationDelay: '.2s' }}/>
                </svg>
              </div>
              <div className="b-card-body"><h3>Connect on X</h3><p>Follow updates and announcements from Lester Labs.</p></div>
            </a>

            {/* Built for LitVM */}
            <a href="https://www.litvm.com/" target="_blank" rel="noopener noreferrer" className="b-card reveal reveal-delay-3 tilt-card" style={{ '--b-glow': 'rgba(228,79,181,.08)' } as React.CSSProperties}>
              <div className="b-card-bg" style={{ background: 'linear-gradient(145deg,#1e1025 0%,#2a1430 40%,#1e0e25 70%,#140a18 100%)' }} />
              <div className="b-card-top">
                <div className="b-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E44FB5" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                <div className="b-card-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></div>
              </div>
              <div className="b-card-visual">
                <svg width="180" height="160" viewBox="0 0 180 160" fill="none">
                  <path d="M50 140 L50 55 Q50 20 90 20 Q130 20 130 55 L130 140" fill="#1e0e25" stroke="#E44FB5" strokeWidth="1" opacity=".6"/>
                  <path d="M58 140 L58 60 Q58 30 90 30 Q122 30 122 60 L122 140" fill="#25122e"/>
                  <circle cx="75" cy="55" r="1" fill="#fff" opacity=".3" className="b-sparkle" style={{ animationDelay: '0s' }}/>
                  <circle cx="105" cy="48" r="1.2" fill="#fff" opacity=".25" className="b-sparkle" style={{ animationDelay: '.5s' }}/>
                  <circle cx="90" cy="68" r="1" fill="#fff" opacity=".2" className="b-sparkle" style={{ animationDelay: '1s' }}/>
                  <circle cx="80" cy="80" r=".8" fill="#fff" opacity=".2" className="b-sparkle" style={{ animationDelay: '1.5s' }}/>
                  <circle cx="100" cy="75" r="1" fill="#fff" opacity=".3" className="b-sparkle" style={{ animationDelay: '.8s' }}/>
                  <circle cx="70" cy="95" r=".8" fill="#fff" opacity=".15" className="b-sparkle" style={{ animationDelay: '1.2s' }}/>
                  <circle cx="110" cy="90" r="1" fill="#fff" opacity=".2" className="b-sparkle" style={{ animationDelay: '.3s' }}/>
                  <circle cx="85" cy="105" r=".8" fill="#fff" opacity=".15"/>
                  <circle cx="95" cy="55" r=".7" fill="#E44FB5" opacity=".4" className="b-sparkle" style={{ animationDelay: '.6s' }}/>
                  <circle cx="82" cy="42" r=".8" fill="#E44FB5" opacity=".3" className="b-sparkle" style={{ animationDelay: '1.3s' }}/>
                  <rect x="65" y="125" width="50" height="8" rx="2" fill="#2a1430" stroke="#E44FB5" strokeWidth=".5" opacity=".4"/>
                  <rect x="70" y="118" width="40" height="7" rx="2" fill="#301838" stroke="#E44FB5" strokeWidth=".5" opacity=".5"/>
                  <rect x="75" y="111" width="30" height="7" rx="2" fill="#381c40" stroke="#E44FB5" strokeWidth=".5" opacity=".6"/>
                  <ellipse cx="90" cy="22" rx="20" ry="5" fill="#E44FB5" opacity=".08" className="b-glow-anim"/>
                  <g className="b-float" style={{ animationDelay: '.5s', animationDuration: '3.5s' }}>
                    <circle cx="90" cy="60" r="10" fill="#301838" stroke="#E44FB5" strokeWidth=".8"/>
                    <circle cx="90" cy="60" r="5" fill="#E44FB5" opacity=".15"/>
                  </g>
                  <g className="b-sparkle" style={{ animationDelay: '.4s' }}>
                    <line x1="140" y1="40" x2="140" y2="48" stroke="#E44FB5" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="136" y1="44" x2="144" y2="44" stroke="#E44FB5" strokeWidth="1.2" strokeLinecap="round"/>
                  </g>
                  <circle cx="42" cy="50" r="2" fill="#E44FB5" className="b-sparkle" style={{ animationDelay: '1.1s' }}/>
                </svg>
              </div>
              <div className="b-card-body"><h3>Built for LitVM</h3><p>Learn more about the chain powering Lester Labs.</p></div>
            </a>
          </div>
        </section>

        <div style={{ padding: '0 clamp(16px,4vw,40px)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}><div className="divider" /></div>
        </div>

        {/* ── CTA ────────────────────────────────────────── */}
        <section className="cta-section">
          <div className="cta-inner">
            {/* Left: illustration card */}
            <div className="cta-card reveal reveal-delay-1">
              <div className="cta-card-grid" />
              <div className="cta-card-glow" />
              <div className="cta-card-glow2" />
              <div className="cta-card-deco">
                <div className="cta-coin cta-coin-1" />
                <div className="cta-coin cta-coin-2" />
                <div className="cta-coin cta-coin-3" />
                <div className="cta-sparkle cta-sparkle-1" />
                <div className="cta-sparkle cta-sparkle-2" />
                <div className="cta-sparkle cta-sparkle-3" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/cta-hero.png" alt="Lester Labs" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', zIndex: 2, borderRadius: 23 }} />
              <div className="cta-steps">
                <div className="cta-step" />
                <div className="cta-step" />
                <div className="cta-step" />
                <div className="cta-step" />
              </div>
            </div>

            {/* Right: text + buttons */}
            <div className="cta-text reveal reveal-delay-2">
              <h2 className="cta-title"><span className="grad">Start building</span><br />today.</h2>
              <p>Simply connect your wallet and start deploying on LitVM instantly, from anywhere. No sign-ups required.</p>
              <div className="cta-buttons">
                <Link prefetch={false} href="/launch" className="btn-primary magnetic">Launch a Token →</Link>
                <a href="/docs" className="btn-ghost magnetic">Read the Docs ↗</a>
              </div>
              <p className="cta-fine">Lester Labs uses battle-tested contracts forked from industry standards. Supported across all major wallets. Testnet is live — mainnet launches with LitVM.</p>
            </div>
          </div>
        </section>

        </div>{/* end post-hero wrapper */}
      </main>
    </div>
  )
}
