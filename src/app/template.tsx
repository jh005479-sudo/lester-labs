'use client'

import { useEffect } from 'react'

export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // ─── Scroll lock: force top when ScrollHero unlocks ──
    // ScrollHero sets body.overflow='hidden' during its ~10s animation.
    // Watch for it being cleared, snap to top ONCE, then stop watching.
    let wasLocked = false
    const scrollObserver = new MutationObserver(() => {
      if (document.body.style.overflow === 'hidden') {
        wasLocked = true
      } else if (wasLocked) {
        // Overflow just cleared after being locked — snap to top once
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
        wasLocked = false
        scrollObserver.disconnect()
      }
    })
    scrollObserver.observe(document.body, { attributes: true, attributeFilter: ['style'] })

    return () => scrollObserver.disconnect()
  }, [])

  useEffect(() => {
    const canvas = document.getElementById('ll-cursor-canvas') as HTMLCanvasElement
    const dot = document.getElementById('ll-cursor-dot') as HTMLElement
    if (!canvas || !dot) return

    const ctx = canvas.getContext('2d')!
    let lastX = -100, lastY = -100

    function resizeCanvas() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    interface SmokeP {
      x: number; y: number; size: number; life: number; decay: number
      vx: number; vy: number; rotation: number; rotSpeed: number; growRate: number; color: number[]
      update(): void; draw(): void
    }
    const smoke: SmokeP[] = []

    class SmokeParticle implements SmokeP {
      x: number; y: number; size: number; life: number; decay: number
      vx: number; vy: number; rotation: number; rotSpeed: number; growRate: number; color: number[]
      constructor(x: number, y: number) {
        this.x = x + (Math.random() - .5) * 2
        this.y = y + (Math.random() - .5) * 2
        this.size = Math.random() * 8 + 5
        this.life = 1
        this.decay = Math.random() * .004 + .003
        this.vx = (Math.random() - .5) * .12
        this.vy = -(Math.random() * .4 + .15)
        this.rotation = Math.random() * Math.PI * 2
        this.rotSpeed = (Math.random() - .5) * .005
        this.growRate = 1 + Math.random() * .003
        const allHues = [[107,79,255],[139,116,255],[54,209,220],[80,160,255],[228,79,181],[45,206,137]]
        const cycle = (Date.now() * .00015) % allHues.length
        const idx = Math.floor(cycle), nextIdx = (idx + 1) % allHues.length, blend = cycle - idx
        const base = allHues[idx].map((c, i) => Math.round(c + (allHues[nextIdx][i] - c) * blend))
        this.color = base.map(c => Math.min(255, Math.max(0, c + Math.floor((Math.random() - .5) * 30))))
      }
      update() {
        this.life -= this.decay
        this.x += this.vx; this.y += this.vy
        this.vx *= .995; this.vy *= .997
        this.size *= this.growRate; this.rotation += this.rotSpeed
        this.vx += (Math.random() - .5) * .02
        this.vy += (Math.random() - .5) * .01
      }
      draw() {
        if (this.life <= 0) return
        const [r, g, b] = this.color
        const alpha = this.life * this.life * .35
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation)
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size)
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 2})`)
        grad.addColorStop(.4, `rgba(${r},${g},${b},${alpha * .9})`)
        grad.addColorStop(.7, `rgba(${r},${g},${b},${alpha * .35})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grad; ctx.beginPath()
        ctx.ellipse(0, 0, this.size, this.size * .6, 0, 0, Math.PI * 2)
        ctx.fill(); ctx.restore()
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      const mx = e.clientX, my = e.clientY
      dot.style.left = (mx - 4) + 'px'
      dot.style.top = (my - 4) + 'px'
      const dx = mx - lastX, dy = my - lastY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 2) {
        const count = Math.min(Math.ceil(dist / 14), 2)
        for (let i = 0; i < count; i++) {
          const t = i / count
          smoke.push(new SmokeParticle(lastX + dx * t, lastY + dy * t))
        }
      }
      if (Math.random() < .12) smoke.push(new SmokeParticle(mx, my))
      while (smoke.length > 80) smoke.shift()
      lastX = mx; lastY = my
    }
    document.addEventListener('mousemove', onMouseMove)

    let rafId: number
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'lighter'
      for (let i = smoke.length - 1; i >= 0; i--) {
        smoke[i].update(); smoke[i].draw()
        if (smoke[i].life <= 0) smoke.splice(i, 1)
      }
      ctx.globalCompositeOperation = 'source-over'
      rafId = requestAnimationFrame(animate)
    }
    animate()

    const onEnter = () => dot.classList.add('hover')
    const onLeave = () => dot.classList.remove('hover')
    const interactiveEls = document.querySelectorAll('a, button, [role="button"]')
    interactiveEls.forEach(el => {
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
    })

    // Shared card tilt (analytics + dApps + explorer), delegated for dynamic tab content
    let activeTiltCard: HTMLElement | null = null
    const resetTilt = (el?: HTMLElement | null) => {
      if (!el) return
      el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)'
    }
    const onDocMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const card = target?.closest?.('.analytics-card') as HTMLElement | null

      if (activeTiltCard && activeTiltCard !== card) resetTilt(activeTiltCard)
      activeTiltCard = card
      if (!card) return

      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -1.1
      const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 1.1
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-1px)`
    }
    const onDocLeave = () => {
      resetTilt(activeTiltCard)
      activeTiltCard = null
    }

    document.addEventListener('mousemove', onDocMove)
    document.addEventListener('mouseleave', onDocLeave)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', onDocMove)
      document.removeEventListener('mouseleave', onDocLeave)
      resetTilt(activeTiltCard)
    }
  }, [])

  return (
    <>
      <div id="ll-cursor-dot" className="cursor-dot" />
      <canvas id="ll-cursor-canvas" className="cursor-canvas" />
      {children}
    </>
  )
}
