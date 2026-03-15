import { useRef, useEffect } from 'react'
import { useTurbineStore } from '../../stores/turbineStore'
import { catmullRomSpline } from '../../utils/spline'

/**
 * 2.5D cross-section preview: shows the blade profile at the selected height,
 * with twist and taper applied. Stacks all sections as translucent layers
 * behind the selected one to give a "2.5D" depth effect.
 */
export default function SectionPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const parent = canvas.parentElement!
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = parent.clientWidth * dpr
      canvas.height = parent.clientHeight * dpr
      canvas.style.width = parent.clientWidth + 'px'
      canvas.style.height = parent.clientHeight + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    const render = () => {
      const store = useTurbineStore.getState()
      const { bladePoints, bladeSections, selectedSectionIndex, twist, taper, thickness } = store
      const dpr = Math.min(window.devicePixelRatio, 2)
      const w = canvas.width / dpr
      const h = canvas.height / dpr

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Background
      ctx.fillStyle = 'rgba(10, 14, 26, 0.95)'
      ctx.fillRect(0, 0, w, h)

      if (bladePoints.length < 2) {
        ctx.fillStyle = '#64748b'
        ctx.font = '11px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('Draw a blade to see sections', w / 2, h / 2)
        animRef.current = requestAnimationFrame(render)
        return
      }

      const smooth = catmullRomSpline(bladePoints, 8)
      const cx = w / 2
      const cy = h / 2
      const scale = Math.min(w, h) * 0.35

      // Draw grid
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.06)'
      ctx.lineWidth = 0.5
      for (let gx = -1; gx <= 1; gx += 0.25) {
        ctx.beginPath()
        ctx.moveTo(cx + gx * scale, cy - scale)
        ctx.lineTo(cx + gx * scale, cy + scale)
        ctx.stroke()
      }
      for (let gy = -1; gy <= 1; gy += 0.25) {
        ctx.beginPath()
        ctx.moveTo(cx - scale, cy + gy * scale)
        ctx.lineTo(cx + scale, cy + gy * scale)
        ctx.stroke()
      }

      // Draw all sections as stacked layers (back to front)
      for (let i = bladeSections.length - 1; i >= 0; i--) {
        const sec = bladeSections[i]
        const isSelected = i === selectedSectionIndex
        const effectiveTwist = (twist * sec.heightFraction + sec.twistOffset) * (Math.PI / 180)
        const effectiveTaper = (1.0 - taper * Math.abs(sec.heightFraction - 0.5) * 2) * sec.taperScale
        const yOffset = (i - selectedSectionIndex) * 8 // vertical stacking for depth

        const cos = Math.cos(effectiveTwist)
        const sin = Math.sin(effectiveTwist)

        // Draw the cross-section: top surface (camber) and bottom surface (mirrored by thickness)
        ctx.beginPath()
        for (let j = 0; j < smooth.length; j++) {
          const pt = smooth[j]
          const radial = pt.x * effectiveTaper
          const camber = pt.y * effectiveTaper
          // Top surface
          const topX = radial * cos - camber * sin
          const topY = radial * sin + camber * cos
          const sx = cx + topX * scale
          const sy = cy - yOffset + topY * scale
          if (j === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        // Bottom surface (reversed, with thickness offset)
        for (let j = smooth.length - 1; j >= 0; j--) {
          const pt = smooth[j]
          const radial = pt.x * effectiveTaper
          const camber = -pt.y * effectiveTaper * 0.3 - thickness * effectiveTaper
          const botX = radial * cos - camber * sin
          const botY = radial * sin + camber * cos
          const sx = cx + botX * scale
          const sy = cy - yOffset + botY * scale
          ctx.lineTo(sx, sy)
        }
        ctx.closePath()

        if (isSelected) {
          // Selected section: filled with glow
          const grad = ctx.createLinearGradient(cx - scale, cy, cx + scale, cy)
          grad.addColorStop(0, 'rgba(45, 212, 191, 0.25)')
          grad.addColorStop(0.5, 'rgba(45, 212, 191, 0.15)')
          grad.addColorStop(1, 'rgba(45, 212, 191, 0.25)')
          ctx.fillStyle = grad
          ctx.fill()
          ctx.strokeStyle = '#2dd4bf'
          ctx.lineWidth = 1.5
          ctx.stroke()
        } else {
          // Background section: translucent
          const alpha = 0.06 + (1 - Math.abs(i - selectedSectionIndex) / bladeSections.length) * 0.06
          ctx.fillStyle = `rgba(45, 212, 191, ${alpha})`
          ctx.fill()
          ctx.strokeStyle = `rgba(45, 212, 191, ${alpha + 0.05})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }

      // Draw chord line for selected section
      const selSec = bladeSections[selectedSectionIndex]
      const selTwist = (twist * selSec.heightFraction + selSec.twistOffset) * (Math.PI / 180)
      const selTaper = (1.0 - taper * Math.abs(selSec.heightFraction - 0.5) * 2) * selSec.taperScale
      const chordLen = selTaper * scale
      const chordCos = Math.cos(selTwist)
      const chordSin = Math.sin(selTwist)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + chordLen * chordCos, cy + chordLen * chordSin)
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Label
      const heightLabels = ['Root', '25%', 'Mid', '75%', 'Tip']
      ctx.fillStyle = '#94a3b8'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(`Section: ${heightLabels[selectedSectionIndex]}`, 8, 14)
      ctx.fillStyle = '#64748b'
      ctx.font = '9px system-ui'
      ctx.fillText(`Twist: ${(twist * selSec.heightFraction + selSec.twistOffset).toFixed(1)}°  Taper: ${selTaper.toFixed(2)}`, 8, 26)

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="w-full h-full min-h-[160px]">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
