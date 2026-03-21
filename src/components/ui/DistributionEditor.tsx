import { useRef, useEffect, useCallback } from 'react'
import type { Vec2 } from '../../stores/turbineStore'
import { useThemeStore } from '../../stores/themeStore'

interface Props {
  /** Sorted control points: x=height fraction 0→1, y=value */
  points: Vec2[]
  onChange: (pts: Vec2[]) => void
  /** Y-axis min value (default 0) */
  yMin?: number
  /** Y-axis max value (default 1) */
  yMax?: number
  /** Accent color for drawing */
  color?: string
  /** Light-mode accent color (defaults to a darker shade of color) */
  colorLight?: string
  label?: string
}

const W = 160
const H = 64
const PAD = 8
const HIT = 7

function ptToCanvas(pt: Vec2, yMin: number, yMax: number): [number, number] {
  const cx = PAD + pt.x * (W - PAD * 2)
  const cy = H - PAD - ((pt.y - yMin) / (yMax - yMin)) * (H - PAD * 2)
  return [cx, cy]
}

function canvasToPt(cx: number, cy: number, yMin: number, yMax: number): Vec2 {
  const x = Math.max(0, Math.min(1, (cx - PAD) / (W - PAD * 2)))
  const y = yMin + (1 - (cy - PAD) / (H - PAD * 2)) * (yMax - yMin)
  return { x, y: Math.max(yMin, Math.min(yMax, y)) }
}

export default function DistributionEditor({
  points,
  onChange,
  yMin = 0,
  yMax = 1,
  color = '#2dd4bf',
  colorLight,
  label,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging = useRef<number | null>(null)
  const ptsRef = useRef(points)
  ptsRef.current = points
  const { theme } = useThemeStore()
  const isLight = theme === 'light'

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const accentColor = isLight ? (colorLight ?? color) : color
    const bgColor = isLight ? '#f8fafc' : '#0d1424'
    const gridColor = isLight ? '#e2e8f0' : '#1e2844'
    const dotOutline = isLight ? '#f8fafc' : '#0d1424'

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = bgColor
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, 4)
    ctx.fill()

    // Border in light mode
    if (isLight) {
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(0.5, 0.5, W - 1, H - 1, 4)
      ctx.stroke()
    }

    // Grid lines (3 horizontal)
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    for (let i = 0; i <= 2; i++) {
      const y = PAD + (i / 2) * (H - PAD * 2)
      ctx.beginPath()
      ctx.moveTo(PAD, y)
      ctx.lineTo(W - PAD, y)
      ctx.stroke()
    }

    const pts = ptsRef.current
    if (pts.length < 2) return

    // Curve
    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      const [cx, cy] = ptToCanvas(pts[i], yMin, yMax)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    }
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Fill area under curve
    const [lx] = ptToCanvas(pts[0], yMin, yMax)
    const [rx] = ptToCanvas(pts[pts.length - 1], yMin, yMax)
    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      const [cx, cy] = ptToCanvas(pts[i], yMin, yMax)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    }
    ctx.lineTo(rx, H - PAD)
    ctx.lineTo(lx, H - PAD)
    ctx.closePath()
    ctx.fillStyle = accentColor + (isLight ? '22' : '18')
    ctx.fill()

    // Control points
    pts.forEach((pt, i) => {
      const [cx, cy] = ptToCanvas(pt, yMin, yMax)
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = dragging.current === i ? (isLight ? '#0f172a' : '#fff') : accentColor
      ctx.fill()
      ctx.strokeStyle = dotOutline
      ctx.lineWidth = 1
      ctx.stroke()
    })
  }, [yMin, yMax, color, colorLight, isLight])

  useEffect(() => { draw() }, [points, draw])

  const getHit = (ex: number, ey: number): number => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = (ex - rect.left) * (W / rect.width)
    const my = (ey - rect.top) * (H / rect.height)
    for (let i = 0; i < ptsRef.current.length; i++) {
      const [cx, cy] = ptToCanvas(ptsRef.current[i], yMin, yMax)
      if (Math.hypot(mx - cx, my - cy) <= HIT) return i
    }
    return -1
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const hit = getHit(e.clientX, e.clientY)
    if (hit >= 0) {
      dragging.current = hit
      return
    }
    // Add a new point
    if (ptsRef.current.length >= 4) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (W / rect.width)
    const my = (e.clientY - rect.top) * (H / rect.height)
    const newPt = canvasToPt(mx, my, yMin, yMax)
    const next = [...ptsRef.current, newPt].sort((a, b) => a.x - b.x)
    onChange(next)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging.current === null) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (W / rect.width)
    const my = (e.clientY - rect.top) * (H / rect.height)
    const idx = dragging.current
    const pts = ptsRef.current
    const updated = canvasToPt(mx, my, yMin, yMax)
    // Clamp x so first/last don't cross neighbors
    const xMin = idx === 0 ? 0 : pts[idx - 1].x + 0.05
    const xMax = idx === pts.length - 1 ? 1 : pts[idx + 1].x - 0.05
    const newPt: Vec2 = { x: Math.max(xMin, Math.min(xMax, updated.x)), y: updated.y }
    const next = pts.map((p, i) => (i === idx ? newPt : p))
    onChange(next)
  }

  const onMouseUp = () => { dragging.current = null; draw() }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const pts = ptsRef.current
    if (pts.length <= 2) return
    const hit = getHit(e.clientX, e.clientY)
    if (hit >= 0) onChange(pts.filter((_, i) => i !== hit))
  }

  // Root and tip value labels
  const rootY = points.length ? points[0].y : yMin
  const tipY = points.length ? points[points.length - 1].y : yMin

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-primary">{label}</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {rootY.toFixed(2)} → {tipY.toFixed(2)}
          </span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: '100%', height: H, cursor: 'crosshair', borderRadius: 4 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onContextMenu={onContextMenu}
      />
      <span className="text-[9px] text-muted-foreground text-center">
        Drag handles · Click to add · Right-click to remove
      </span>
    </div>
  )
}
