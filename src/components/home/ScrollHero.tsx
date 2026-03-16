'use client'

import { useState, useEffect, useRef } from 'react'

const VIDEO_URL = '/lester-hero.mp4'
const POSTER_IMG = '/lester-hero-poster.png'

const C = {
  accent: '#492CE1',
  accentLight: '#6B4FFF',
  bg: '#0D0A24',
}

/*
  Timeline (total ~10s, scroll locked throughout):
  0–5s   : video plays fullscreen
  5–7s   : video fades out
  7–10s  : welcome message fades in, holds, scroll unlocks
*/
const VIDEO_HOLD   = 5000
const FADE_DUR     = 2000
const TEXT_HOLD    = 3000
const TOTAL        = VIDEO_HOLD + FADE_DUR + TEXT_HOLD

export default function ScrollHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef   = useRef<number>(0)
  const startRef = useRef<number | null>(null)
  const [elapsed, setElapsed]   = useState(0)
  const [done, setDone]         = useState(false)

  // Lock scroll while animating
  useEffect(() => {
    if (done) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [done])

  // Autoplay video
  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  // Animation clock
  useEffect(() => {
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const e = ts - startRef.current
      setElapsed(e)
      if (e < TOTAL) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDone(true)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Derived opacities
  const videoOpacity = elapsed < VIDEO_HOLD
    ? 1
    : Math.max(0, 1 - (elapsed - VIDEO_HOLD) / FADE_DUR)

  const textOpacity = elapsed < VIDEO_HOLD
    ? 0
    : Math.min(1, (elapsed - VIDEO_HOLD) / FADE_DUR)

  return (
    <div style={{ height: done ? 'auto' : '100vh', position: 'relative' }}>
      <div style={{
        position: done ? 'relative' : 'fixed',
        inset: 0,
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: C.bg,
        zIndex: done ? 'auto' : 50,
      }}>

        {/* Video layer */}
        <video
          ref={videoRef}
          src={VIDEO_URL}
          muted
          loop
          playsInline
          autoPlay
          poster={POSTER_IMG}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: videoOpacity,
            transition: 'opacity 0.1s linear',
            zIndex: 1,
          }}
        />

        {/* Dark overlay — grows as video fades */}
        <div style={{
          position: 'absolute', inset: 0,
          background: C.bg,
          opacity: 1 - videoOpacity,
          zIndex: 2,
          pointerEvents: 'none',
        }} />

        {/* Welcome text — fades in as video fades out */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          opacity: textOpacity,
          zIndex: 3,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(13px, 2.5vw, 18px)',
            color: C.accentLight,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            Welcome to
          </div>
          <div style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(52px, 11vw, 128px)',
            letterSpacing: '-0.02em',
            lineHeight: 0.9,
            textAlign: 'center',
            background: `linear-gradient(135deg, #fff 0%, ${C.accentLight} 50%, ${C.accent} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            LESTER<br />LABS
          </div>
          <div style={{
            marginTop: 28,
            width: `${textOpacity * 120}px`,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
            borderRadius: 1,
          }} />
        </div>

        {/* Skip button */}
        {!done && (
          <button
            onClick={() => setDone(true)}
            style={{
              position: 'absolute', bottom: 28, right: 28,
              zIndex: 10,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.45)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Skip →
          </button>
        )}
      </div>

      {/* Spacer so page content sits below */}
      {done && <div style={{ height: '100vh' }} />}
    </div>
  )
}
