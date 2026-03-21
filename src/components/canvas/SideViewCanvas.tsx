import { useRef, useEffect, useCallback } from 'react'
import { useTurbineStore, type Vec2 } from '../../stores/turbineStore'
import { sampleCurve } from '../../utils/spline'
import { getCanvasTheme, type CanvasTheme } from '../../utils/canvasTheme'
import { useThemeStore } from '../../stores/themeStore'

const PAD_X = 32
const PAD_Y = 16
const HIT = 8

export default function SideViewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { chordCurve, setChordCurve, twistCurve, height, bladePoints } = useTurbineStore()
  const dragging = useRef<{ index: number; side: 'left' | 'right' } | null>(null)

  // Cache theme colors — rebuilt only on theme toggle, not every draw
  const { theme: themeMode } = useThemeStore()
  const canvasThemeRef = useRef<CanvasTheme>(getCanvasTheme())
  useEffect(() => { canvasThemeRef.current = getCanvasTheme() }, [themeMode])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height

    const theme = canvasThemeRef.current
    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, w, h)

    // Center line
    ctx.strokeStyle = theme.grid
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(w / 2, PAD_Y)
    ctx.lineTo(w / 2, h - PAD_Y)
    ctx.stroke()
    ctx.setLineDash([])

    // Labels: Root / Tip
    ctx.fillStyle = theme.textMuted
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('TIP', w / 2, PAD_Y - 4)
    ctx.fillText('ROOT', w / 2, h - 4)

    // Height ticks
    for (let i = 0; i <= 4; i++) {
      const yc = PAD_Y + (i / 4) * (h - PAD_Y * 2)
      ctx.beginPath()
      ctx.moveTo(PAD_X / 2, yc)
      ctx.lineTo(w - PAD_X / 2, yc)
      ctx.strokeStyle = theme.grid
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    if (chordCurve.length < 2) return

    // Build silhouette outline from chordCurve by sampling many slices
    const slices = 60
    const maxHalfW = (w / 2 - PAD_X) * 0.9

    // Draw twist heatmap as vertical gradient behind silhouette
    const twistMax = Math.max(...twistCurve.map(p => p.y)) * 90
    for (let i = 0; i < slices; i++) {
      const t = i / slices
      const t1 = (i + 1) / slices
      const yTop = PAD_Y + (1 - t1) * (h - PAD_Y * 2)
      const yBot = PAD_Y + (1 - t) * (h - PAD_Y * 2)
      const tw = sampleCurve(twistCurve, t) * 90
      const twFrac = twistMax > 0 ? tw / twistMax : 0
      // Interpolate teal → violet based on twist
      const r = Math.round(45 + twFrac * (167 - 45))
      const g = Math.round(212 + twFrac * (139 - 212))
      const b = Math.round(191 + twFrac * (250 - 191))
      const chord = sampleCurve(chordCurve, t) * maxHalfW
      ctx.fillStyle = `rgba(${r},${g},${b},0.12)`
      ctx.fillRect(w / 2 - chord, yTop, chord * 2, yBot - yTop)
    }

    // Silhouette outline
    const rightEdge: [number, number][] = []
    const leftEdge: [number, number][] = []
    for (let i = 0; i <= slices; i++) {
      const t = i / slices
      const yc = PAD_Y + (1 - t) * (h - PAD_Y * 2)
      const chord = sampleCurve(chordCurve, t) * maxHalfW
      rightEdge.push([w / 2 + chord, yc])
      leftEdge.push([w / 2 - chord, yc])
    }

    ctx.beginPath()
    rightEdge.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
    leftEdge.reverse().forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.closePath()
    ctx.strokeStyle = theme.teal
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = `${theme.teal}${theme.isLight ? '18' : '08'}`
    ctx.fill()

    // Control point handles
    chordCurve.forEach((pt, i) => {
      const yc = PAD_Y + (1 - pt.x) * (h - PAD_Y * 2)
      const chord = pt.y * maxHalfW
      const isDragging = dragging.current?.index === i
      const rr = isDragging ? 6 : 5

      // Right handle
      ctx.beginPath()
      ctx.arc(w / 2 + chord, yc, rr, 0, Math.PI * 2)
      ctx.fillStyle = isDragging && dragging.current?.side === 'right' ? '#fff' : theme.teal
      ctx.fill()
      ctx.strokeStyle = theme.bg
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Left handle
      ctx.beginPath()
      ctx.arc(w / 2 - chord, yc, rr, 0, Math.PI * 2)
      ctx.fillStyle = isDragging && dragging.current?.side === 'left' ? '#fff' : theme.teal
      ctx.fill()
      ctx.strokeStyle = theme.bg
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Horizontal connector
      ctx.beginPath()
      ctx.moveTo(w / 2 - chord, yc)
      ctx.lineTo(w / 2 + chord, yc)
      ctx.strokeStyle = `${theme.teal}55`
      ctx.lineWidth = 1
      ctx.stroke()
    })
  }, [chordCurve, twistCurve])

  useEffect(() => { draw() }, [draw])

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      draw()
    })
    observer.observe(canvas)
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    draw()
    return () => observer.disconnect()
  }, [draw])

  const getHit = (ex: number, ey: number): { index: number; side: 'left' | 'right' } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const mx = (ex - rect.left) * (canvas.width / rect.width)
    const my = (ey - rect.top) * (canvas.height / rect.height)
    const w = canvas.width, h = canvas.height
    const maxHalfW = (w / 2 - PAD_X) * 0.9

    for (let i = 0; i < chordCurve.length; i++) {
      const pt = chordCurve[i]
      const yc = PAD_Y + (1 - pt.x) * (h - PAD_Y * 2)
      const chord = pt.y * maxHalfW
      if (Math.hypot(mx - (w / 2 + chord), my - yc) <= HIT) return { index: i, side: 'right' }
      if (Math.hypot(mx - (w / 2 - chord), my - yc) <= HIT) return { index: i, side: 'left' }
    }
    return null
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const hit = getHit(e.clientX, e.clientY)
    if (hit) { dragging.current = hit; return }

    // Add a new chordCurve point
    const canvas = canvasRef.current
    if (!canvas || chordCurve.length >= 4) return
    const rect = canvas.getBoundingClientRect()
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)
    const h = canvas.height
    const t = Math.max(0, Math.min(1, 1 - (my - PAD_Y) / (h - PAD_Y * 2)))
    const maxHalfW = (canvas.width / 2 - PAD_X) * 0.9
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const halfDist = Math.abs(mx - canvas.width / 2)
    const yVal = Math.max(0.1, Math.min(1.5, halfDist / maxHalfW))
    const newPt: Vec2 = { x: t, y: yVal }
    const next = [...chordCurve, newPt].sort((a, b) => a.x - b.x)
    setChordCurve(next)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)
    const w = canvas.width, h = canvas.height
    const maxHalfW = (w / 2 - PAD_X) * 0.9

    const { index } = dragging.current
    const pts = [...chordCurve]
    const t = Math.max(0, Math.min(1, 1 - (my - PAD_Y) / (h - PAD_Y * 2)))
    const halfDist = Math.abs(mx - w / 2)
    const yVal = Math.max(0.1, Math.min(1.5, halfDist / maxHalfW))

    // Clamp x (height fraction) to not cross neighbors
    const xMin = index === 0 ? 0 : pts[index - 1].x + 0.05
    const xMax = index === pts.length - 1 ? 1 : pts[index + 1].x - 0.05
    pts[index] = { x: Math.max(xMin, Math.min(xMax, t)), y: yVal }
    setChordCurve(pts)
  }

  const onMouseUp = () => { dragging.current = null; draw() }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (chordCurve.length <= 2) return
    const hit = getHit(e.clientX, e.clientY)
    if (hit) setChordCurve(chordCurve.filter((_, i) => i !== hit.index))
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Info bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40 bg-deep/60 text-[10px] text-text-muted">
        <span className="text-teal font-medium">Side View</span>
        <span>Drag handles to reshape chord · Color shows twist distribution</span>
        <span className="ml-auto">Height: {height.toFixed(1)}m · {bladePoints.length} profile pts</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: 'crosshair' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onContextMenu={onContextMenu}
        />

        {/* Legend */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
            <span className="w-3 h-0.5 bg-teal inline-block rounded" />
            Low twist
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
            <span className="w-3 h-0.5 bg-bloom-violet inline-block rounded" />
            High twist
          </div>
        </div>
      </div>
    </div>
  )
}
