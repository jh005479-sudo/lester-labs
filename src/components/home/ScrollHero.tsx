'use client'

import { useEffect, useRef } from 'react'
import { PlatformStats } from './PlatformStats'

export default function ScrollHero({ onIntroComplete }: { onIntroComplete?: () => void }) {
  const bgImgRef = useRef<HTMLImageElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const introCompletedRef = useRef(false)

  useEffect(() => {
    if (introCompletedRef.current) return
    introCompletedRef.current = true
    onIntroComplete?.()
  }, [onIntroComplete])

  useEffect(() => {
    const heroH = window.innerHeight

    const onScroll = () => {
      const y = window.scrollY
      const p = Math.min(y / heroH, 1)

      if (bgImgRef.current) {
        bgImgRef.current.style.transform = `scale(${1 + p * 0.12})`
        bgImgRef.current.style.opacity = String(Math.max(0.45, 0.9 - p * 0.35))
      }

      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(${-y * 0.18}px)`
        contentRef.current.style.opacity = String(Math.max(0, 1 - p * 1.7))
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={bgImgRef}
            src="/images/hero-bg.png"
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.9,
              transformOrigin: 'center center',
              transition: 'opacity 200ms ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              background:
                'linear-gradient(180deg, rgba(10,8,24,.08) 0%, rgba(10,8,24,.08) 38%, rgba(10,8,24,.7) 82%, rgba(10,8,24,1) 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              background:
                'radial-gradient(ellipse 44% 40% at 50% 45%, rgba(10,8,24,.92) 0%, rgba(10,8,24,.74) 34%, rgba(10,8,24,.28) 62%, transparent 100%)',
            }}
          />
        </div>

        <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', opacity: 0.22 }}>
          <div className="hero-fog-layer" />
          <div className="hero-fog-layer" style={{ top: '40%', animationDuration: '40s', animationDirection: 'reverse', opacity: 0.6 }} />
        </div>

        <div className="hero-title-glow on" />

        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: 'clamp(14px,1.8vw,18px)',
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.85)',
              marginBottom: 20,
              textShadow: '0 2px 20px rgba(10,8,24,.7)',
            }}
          >
            Welcome To
          </div>

          <div
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(56px,11vw,120px)',
              lineHeight: 0.92,
              textAlign: 'center',
              color: '#8B74FF',
              textShadow:
                '0 4px 22px rgba(0,0,0,.45), 0 0 42px rgba(107,79,255,.22), 0 0 16px rgba(228,79,181,.2)',
            }}
          >
            LESTER LABS
          </div>

          <div
            style={{
              textAlign: 'center',
              marginTop: 28,
              textShadow: '0 2px 20px rgba(10,8,24,.7)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'clamp(16px,2vw,22px)',
                color: 'rgba(240,238,245,.62)',
                fontWeight: 400,
                fontStyle: 'italic',
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '.02em',
              }}
            >
              The DeFi Utility Suite for LitVM
            </span>
          </div>

          <div className="hero-cta-group" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 36 }}>
            <button className="hero-btn-primary" onClick={() => { window.location.href = '/launch' }}>Launch App -&gt;</button>
            <button
              className="hero-btn-ghost"
              onClick={() => {
                const suiteSection = document.getElementById('suite-section')
                if (suiteSection) suiteSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              Explore Suite
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <PlatformStats />
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            opacity: 1,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,.16)' }}>Scroll</div>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.06)', position: 'relative', overflow: 'hidden' }}>
            <div className="hero-si-dot" />
          </div>
        </div>
      </div>

      <div style={{ height: '100vh', position: 'relative', zIndex: 0 }} />
    </>
  )
}
