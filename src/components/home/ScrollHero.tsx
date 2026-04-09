'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const VIDEO_URL  = '/lester-hero.mp4'
const POSTER_IMG = '/lester-hero-poster.png'
const VIDEO_HOLD = 5000   // ms of video before reveal starts
const INTRO_SEEN_KEY = 'lesterlabs_intro_seen'

export default function ScrollHero({ onIntroComplete }: { onIntroComplete?: () => void }) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const clockRef      = useRef<number>(0)
  const startRef      = useRef<number | null>(null)
  const revealDone    = useRef(false)
  const liquidStarted = useRef(false)
  const liquidRaf     = useRef<number>(0)
  const bgImgRef      = useRef<HTMLImageElement>(null)
  const contentRef    = useRef<HTMLDivElement>(null)
  const svgRef        = useRef<SVGSVGElement>(null)

  const [elapsed,   setElapsed]   = useState(0)
  const [done,      setDone]      = useState(false)   // scroll unlocked
  const [skipIntro, setSkipIntro] = useState(false)
  const [videoReady,setVideoReady]= useState(false)
  const [videoOut,  setVideoOut]  = useState(false)
  const [skipGone,  setSkipGone]  = useState(false)
  const [bgOn,      setBgOn]      = useState(false)
  const [fogOn,     setFogOn]     = useState(false)
  const [glowOn,    setGlowOn]    = useState(false)
  const [s1On,      setS1On]      = useState(false)
  const [titleOn,   setTitleOn]   = useState(false)
  const [tagOn,     setTagOn]     = useState(false)
  const [ctaOn,     setCtaOn]     = useState(false)
  const [siOn,      setSiOn]      = useState(false)

  // ─── First-visit intro gating ───────────────────────────
  useEffect(() => {
    const introSeen = typeof window !== 'undefined' && window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
    if (!introSeen) return

    setSkipIntro(true)
    setVideoOut(true)
    setSkipGone(true)
    setBgOn(true)
    setFogOn(true)
    setGlowOn(true)
    setS1On(true)
    setTitleOn(true)
    setTagOn(true)
    setCtaOn(true)
    setSiOn(true)
    setDone(true)
    onIntroComplete?.()
  }, [onIntroComplete])

  // ─── Scroll lock ────────────────────────────────────────
  useEffect(() => {
    if (done) return
    const html = document.documentElement
    const body = document.body
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    // Also block scroll position drift
    const onScroll = (e: Event) => { e.preventDefault(); window.scrollTo(0, 0) }
    window.addEventListener('scroll', onScroll, { passive: false })
    return () => {
      html.style.overflow = ''
      body.style.overflow = ''
      window.removeEventListener('scroll', onScroll)
    }
  }, [done])

  // ─── Autoplay ───────────────────────────────────────────
  useEffect(() => {
    if (skipIntro) return
    videoRef.current?.play().catch(() => {})
  }, [skipIntro])

  // ─── Clock ──────────────────────────────────────────────
  useEffect(() => {
    if (skipIntro) return
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      setElapsed(ts - startRef.current)
      clockRef.current = requestAnimationFrame(tick)
    }
    clockRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(clockRef.current)
  }, [skipIntro])

  // ─── Liquid animation ────────────────────────────────────
  const startLiquid = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return

    const W = 900, H = 130
    const wave1El  = svg.querySelector('#wave1')   as SVGPathElement
    const wave2El  = svg.querySelector('#wave2')   as SVGPathElement
    const bubblesG = svg.querySelector('#bubbles') as SVGGElement
    const bf0 = svg.querySelector('#bf0') as SVGStopElement
    const bf1 = svg.querySelector('#bf1') as SVGStopElement
    const bf2 = svg.querySelector('#bf2') as SVGStopElement
    const wg0 = svg.querySelector('#wg0') as SVGStopElement
    const wg1 = svg.querySelector('#wg1') as SVGStopElement
    const wg2 = svg.querySelector('#wg2') as SVGStopElement
    const wg3 = svg.querySelector('#wg3') as SVGStopElement
    const wg4 = svg.querySelector('#wg4') as SVGStopElement

    // Build bubbles
    interface Bub { c: SVGCircleElement; hl: SVGCircleElement; x: number; y: number; r: number; spd: number; wb: number; ws: number }
    const bubs: Bub[] = []
    for (let i = 0; i < 18; i++) {
      const c  = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      const hl = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      c.setAttribute('fill',         'rgba(255,255,255,0.12)')
      c.setAttribute('stroke',       'rgba(255,255,255,0.2)')
      c.setAttribute('stroke-width', '0.5')
      hl.setAttribute('fill',        'rgba(255,255,255,0.35)')
      bubblesG.appendChild(c)
      bubblesG.appendChild(hl)
      bubs.push({ c, hl,
        x: Math.random() * W,
        y: 50 + Math.random() * 80,
        r: Math.random() * 3.5 + 1.5,
        spd: Math.random() * 0.3 + 0.12,
        wb: Math.random() * Math.PI * 2,
        ws: Math.random() * 0.02 + 0.008,
      })
    }

    // Mouse tilt
    let mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5, hover = false
    const onMove  = (e: MouseEvent) => {
      const r = svg.getBoundingClientRect()
      tmx = (e.clientX - r.left) / r.width
      tmy = (e.clientY - r.top)  / r.height
      hover = true
    }
    const onLeave = () => { hover = false; tmx = 0.5; tmy = 0.5 }
    svg.addEventListener('mousemove',  onMove)
    svg.addEventListener('mouseleave', onLeave)

    function wavePath(bY: number, a1: number,f1: number,p1: number, a2: number,f2: number,p2: number, a3: number,f3: number,p3: number, tilt: number) {
      let d = `M0,${H} L0,${bY}`
      for (let x = 0; x <= W; x += 3) {
        const y = bY + (x/W - 0.5)*tilt + Math.sin(x*f1+p1)*a1 + Math.sin(x*f2+p2)*a2 + Math.sin(x*f3+p3)*a3
        d += ` L${x},${y}`
      }
      return d + ` L${W},${H} Z`
    }

    let t0: number | null = null
    const frame = (ts: number) => {
      if (!t0) t0 = ts
      const t = (ts - t0) / 1000

      mx += (tmx - mx) * 0.05
      my += (tmy - my) * 0.05

      const tilt  = (mx - 0.5) * 30
      const push  = hover ? (my - 0.3) * 12 : 0
      const baseY = 38 + Math.sin(t * 0.5) * 3 + push

      const h1 = 265 + Math.sin(t * 0.6)     * 25
      const h2 = 285 + Math.sin(t * 0.5 + 1) * 30
      const h3 = 310 + Math.cos(t * 0.7 + 2) * 25

      bf0.setAttribute('stop-color', `hsl(${h1},65%,55%)`)
      bf1.setAttribute('stop-color', `hsl(${h2},60%,50%)`)
      bf2.setAttribute('stop-color', `hsl(${h3},62%,48%)`)
      wg0.setAttribute('stop-color', `hsl(${h1+15},72%,62%)`)
      wg1.setAttribute('stop-color', `hsl(${h3+10},68%,58%)`)
      wg2.setAttribute('stop-color', `hsl(${h2+10},70%,60%)`)
      wg3.setAttribute('stop-color', `hsl(${h2+20},66%,60%)`)
      wg4.setAttribute('stop-color', `hsl(${h3+15},64%,55%)`)

      wave1El.setAttribute('d', wavePath(baseY,   10,0.013,t*2,   6,0.022,-t*1.5,  7,0.008,t*0.8,  tilt))
      wave2El.setAttribute('d', wavePath(baseY+5,  8,0.016,-t*1.7, 5,0.027,t*1.1,  5,0.01,-t*0.9,  tilt*0.7))

      bubs.forEach(b => {
        b.y -= b.spd
        b.wb += b.ws
        b.x  += Math.sin(b.wb) * 0.4
        if (b.y < -5) { b.y = H + Math.random() * 20; b.x = Math.random() * W }
        b.c.setAttribute('cx',  String(b.x));            b.c.setAttribute('cy',  String(b.y));            b.c.setAttribute('r',   String(b.r))
        b.hl.setAttribute('cx', String(b.x - b.r*0.25)); b.hl.setAttribute('cy', String(b.y - b.r*0.3)); b.hl.setAttribute('r',   String(b.r*0.28))
      })

      liquidRaf.current = requestAnimationFrame(frame)
    }
    liquidRaf.current = requestAnimationFrame(frame)

    return () => {
      svg.removeEventListener('mousemove',  onMove)
      svg.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // ─── Reveal sequence ────────────────────────────────────
  const doReveal = useCallback(() => {
    cancelAnimationFrame(clockRef.current)
    if (typeof window !== 'undefined') window.sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    setVideoOut(true)
    setSkipGone(true)
    setTimeout(() => { setBgOn(true); setFogOn(true); setGlowOn(true) }, 600)
    setTimeout(() => setS1On(true),   1600)
    setTimeout(() => setTitleOn(true), 2100)
    setTimeout(() => setTagOn(true),   3200)
    setTimeout(() => setCtaOn(true),   3600)
    setTimeout(() => {
      setSiOn(true)
      setDone(true)
      onIntroComplete?.()
    }, 4200)
  }, [onIntroComplete])

  // Trigger at VIDEO_HOLD
  useEffect(() => {
    if (skipIntro) return
    if (!revealDone.current && elapsed >= VIDEO_HOLD) {
      revealDone.current = true
      doReveal()
    }
  }, [elapsed, doReveal, skipIntro])

  // Start liquid when title appears
  useEffect(() => {
    if (titleOn && !liquidStarted.current) {
      liquidStarted.current = true
      document.fonts.ready.then(startLiquid)
    }
  }, [titleOn, startLiquid])

  // Cleanup liquid RAF
  useEffect(() => () => cancelAnimationFrame(liquidRaf.current), [])

  // ─── Parallax on scroll ─────────────────────────────────
  useEffect(() => {
    if (!done) return
    const heroH = window.innerHeight
    const onScroll = () => {
      const y = window.scrollY
      const p = Math.min(y / heroH, 1)
      if (bgImgRef.current) {
        bgImgRef.current.style.transform = `scale(${1 + p * 0.2})`
        bgImgRef.current.style.opacity   = String(Math.max(0, 0.85 - p * 0.4))
      }
      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(${-y * 0.4}px)`
        contentRef.current.style.opacity   = String(Math.max(0, 1 - p * 2))
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [done])

  // ─── Transition helpers ─────────────────────────────────
  const tr = 'cubic-bezier(.22,1,.36,1)'

  return (
    <>
      {/* ── Fixed hero layer (sits behind scrolling content) ── */}
      <div
        style={{
          position: 'fixed',
          top: 108,
          left: 0,
          right: 0,
          height: 'calc(100vh - 108px)',
          zIndex: done ? 1 : 5000,
          pointerEvents: done ? 'none' : 'auto',
        }}
      >

        {/* Background image */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={bgImgRef}
            src="/images/hero-bg.png"
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              opacity: bgOn ? 0.85 : 0, transition: 'opacity 4s ease',
              transformOrigin: 'center center',
            }}
          />
          {/* Bottom dark gradient */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(180deg,rgba(10,8,24,.05) 0%,rgba(10,8,24,0) 10%,rgba(10,8,24,0) 40%,rgba(10,8,24,.6) 80%,rgba(10,8,24,1) 100%)' }} />
          {/* Radial vignette — dark centre for text */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'radial-gradient(ellipse 42% 38% at 50% 45%,rgba(10,8,24,.92) 0%,rgba(10,8,24,.75) 30%,rgba(10,8,24,.3) 55%,rgba(10,8,24,.05) 75%,transparent 100%)' }} />
        </div>

        {/* Fog */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', opacity: fogOn ? 0.25 : 0, transition: 'opacity 4s ease' }}>
          <div className="hero-fog-layer" />
          <div className="hero-fog-layer" style={{ top: '40%', animationDuration: '40s', animationDirection: 'reverse', opacity: 0.6 }} />
        </div>

        {/* Purple glow behind title */}
        <div className={glowOn ? 'hero-title-glow on' : 'hero-title-glow'} />

        {/* Video */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, opacity: videoOut ? 0 : 1, transition: 'opacity 2s ease', pointerEvents: videoOut ? 'none' : 'auto', background: '#000' }}>
          <video
            ref={videoRef}
            src={VIDEO_URL}
            muted loop playsInline autoPlay preload="auto"
            poster={POSTER_IMG}
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: videoReady ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
          />
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', pointerEvents: ctaOn ? 'auto' : 'none' }}
        >
          {/* Welcome To */}
          <div style={{
            fontFamily: "'Sora', sans-serif", fontWeight: 600,
            fontSize: 'clamp(14px,1.8vw,18px)', letterSpacing: '0.35em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', marginBottom: 20,
            opacity: s1On ? 1 : 0, transform: s1On ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity .7s ${tr}, transform .7s ${tr}`,
          }}>Welcome To</div>

          {/* Liquid SVG title */}
          <div style={{
            width: '90vw', maxWidth: 900,
            opacity: titleOn ? 1 : 0, transform: titleOn ? 'translateY(0)' : 'translateY(40px)',
            transition: `opacity .9s ${tr}, transform .9s ${tr}`,
            filter: 'drop-shadow(0 4px 20px rgba(0,0,0,.4)) drop-shadow(0 0 40px rgba(107,79,255,.1))',
          }}>
            <svg ref={svgRef} viewBox="0 0 900 130" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <clipPath id="textClip">
                  <text x="450" y="95" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="120" letterSpacing="-4">LESTER LABS</text>
                </clipPath>
              </defs>
              <g clipPath="url(#textClip)">
                <rect width="900" height="130" fill="url(#baseFill)" />
                <path id="wave1" d="" fill="url(#waveGrad)"  opacity=".7" />
                <path id="wave2" d="" fill="url(#waveGrad2)" opacity=".4" />
                <g id="bubbles" />
              </g>
              <defs>
                <linearGradient id="baseFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"   id="bf0" stopColor="#7B62FF" />
                  <stop offset="50%"  id="bf1" stopColor="#6B4FFF" />
                  <stop offset="100%" id="bf2" stopColor="#9B5FD0" />
                </linearGradient>
                <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"   id="wg0" stopColor="#8B74FF" />
                  <stop offset="50%"  id="wg1" stopColor="#E44FB5" />
                  <stop offset="100%" id="wg2" stopColor="#8B74FF" />
                </linearGradient>
                <linearGradient id="waveGrad2" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%"   id="wg3" stopColor="#9B74FF" />
                  <stop offset="100%" id="wg4" stopColor="#E44FB5" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Tagline */}
          <div style={{
            textAlign: 'center', marginTop: 28,
            opacity: tagOn ? 1 : 0, transform: tagOn ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity .8s ${tr}, transform .8s ${tr}`,
            textShadow: '0 2px 20px rgba(10,8,24,.7)',
          }}>
            <span style={{ display: 'block', fontSize: 'clamp(16px,2vw,22px)', color: 'rgba(240,238,245,.55)', fontWeight: 400, fontStyle: 'italic', fontFamily: "'Inter', sans-serif", letterSpacing: '.02em' }}>
              The DeFi Utility Suite for LitVM
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="hero-cta-group" style={{
            display: 'flex', gap: 14, justifyContent: 'center', marginTop: 36,
            opacity: ctaOn ? 1 : 0, transform: ctaOn ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity .7s ${tr}, transform .7s ${tr}`,
          }}>
            <button className="hero-btn-primary" onClick={() => { window.location.href = '/launch' }}>Launch App →</button>
            <button
              className="hero-btn-ghost"
              onClick={() => {
                const suiteSection = document.getElementById('suite-section')
                if (suiteSection) suiteSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              Explore Suite ↓
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          opacity: siOn ? 1 : 0, transition: 'opacity .5s ease', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,.12)' }}>Scroll</div>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.04)', position: 'relative', overflow: 'hidden' }}>
            <div className="hero-si-dot" />
          </div>
        </div>

        {/* Skip button */}
        {!skipGone && (
          <button
            className="hero-skip-btn"
            onClick={() => { if (!revealDone.current) { revealDone.current = true; doReveal() } }}
            style={{
              position: 'absolute', bottom: 28, right: 28, zIndex: 60,
              background: 'rgba(107,79,255,.15)', border: '1px solid rgba(107,79,255,.3)',
              color: 'rgba(255,255,255,.45)', borderRadius: 8, padding: '7px 16px',
              fontSize: 11, letterSpacing: '.06em', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >Skip →</button>
        )}
      </div>

      {/* Spacer — creates scroll room so page content flows under fixed hero */}
      <div style={{ height: '100vh', position: 'relative', zIndex: 0 }} />
    </>
  )
}
