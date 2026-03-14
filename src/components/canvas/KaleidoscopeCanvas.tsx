import { useRef, useEffect, useCallback, useState } from 'react'
import { useTurbineStore, type Vec2 } from '../../stores/turbineStore'
import { catmullRomSpline, mirrorPoints } from '../../utils/spline'

export default function KaleidoscopeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const animFrameRef = useRef<number>(0)
  const timeRef = useRef(0)

  const {
    bladePoints,
    setBladePoints,
    addBladePoint,
    updateBladePoint,
  } = useTurbineStore()

  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent | TouchEvent, canvas: HTMLCanvasElement): Vec2 | null => {
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }, [])

  const pixelToNormalized = useCallback((px: Vec2, canvas: HTMLCanvasElement): Vec2 => {
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const radius = Math.min(cx, cy) * 0.75
    const dx = px.x - cx
    const dy = px.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)
    // Map radial distance to x [0,1], angle offset to y
    return {
      x: Math.min(1, dist / radius),
      y: Math.max(-0.5, Math.min(0.5, (angle / (2 * Math.PI)) * 0.4)),
    }
  }, [])

  const findNearestPoint = useCallback((px: Vec2, canvas: HTMLCanvasElement): number | null => {
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const radius = Math.min(cx, cy) * 0.75
    const threshold = 15

    for (let i = 0; i < bladePoints.length; i++) {
      const pt = bladePoints[i]
      const worldX = cx + pt.x * radius
      const worldY = cy + pt.y * radius
      const dx = px.x - worldX
      const dy = px.y - worldY
      if (Math.sqrt(dx * dx + dy * dy) < threshold) return i
    }
    return null
  }, [bladePoints])

  const handleDown = useCallback((px: Vec2) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const nearIdx = findNearestPoint(px, canvas)

    if (nearIdx !== null) {
      setDragIndex(nearIdx)
    } else {
      setIsDrawing(true)
      const norm = pixelToNormalized(px, canvas)
      const newPoint: Vec2 = {
        x: Math.max(0, Math.min(1, norm.x)),
        y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
      }
      addBladePoint(newPoint)
    }
  }, [findNearestPoint, pixelToNormalized, addBladePoint])

  const handleMove = useCallback((px: Vec2) => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (dragIndex !== null) {
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const radius = Math.min(cx, cy) * 0.75
      const updated: Vec2 = {
        x: Math.max(0, Math.min(1, (px.x - cx) / radius)),
        y: Math.max(0, Math.min(0.5, Math.abs((px.y - cy) / radius))),
      }
      updateBladePoint(dragIndex, updated)
    } else if (isDrawing) {
      const norm = pixelToNormalized(px, canvas)
      const newPoint: Vec2 = {
        x: Math.max(0, Math.min(1, norm.x)),
        y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
      }
      const last = bladePoints[bladePoints.length - 1]
      if (last) {
        const dist = Math.sqrt((newPoint.x - last.x) ** 2 + (newPoint.y - last.y) ** 2)
        if (dist > 0.03) addBladePoint(newPoint)
      }
    }
  }, [dragIndex, isDrawing, bladePoints, pixelToNormalized, updateBladePoint, addBladePoint])

  const handleUp = useCallback(() => {
    setIsDrawing(false)
    setDragIndex(null)
    const sorted = [...useTurbineStore.getState().bladePoints].sort((a, b) => a.x - b.x)
    setBladePoints(sorted)
  }, [setBladePoints])

  // Mouse handlers
  const handlePointerDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const px = getCanvasCoords(e, canvas)
    if (px) handleDown(px)
  }, [getCanvasCoords, handleDown])

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const px = getCanvasCoords(e, canvas)
    if (px) handleMove(px)
  }, [getCanvasCoords, handleMove])

  const handlePointerUp = useCallback(() => {
    handleUp()
  }, [handleUp])

  // Touch handlers with proper passive:false for preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const px = getCanvasCoords(e, canvas)
      if (!px) return
      const nearIdx = findNearestPoint(px, canvas)
      if (nearIdx !== null) {
        setDragIndex(nearIdx)
      } else {
        setIsDrawing(true)
        const norm = pixelToNormalized(px, canvas)
        addBladePoint({
          x: Math.max(0, Math.min(1, norm.x)),
          y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
        })
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const px = getCanvasCoords(e, canvas)
      if (!px) return
      // Read drag state from refs since this is a native listener
      const currentDragIndex = dragIndexRef.current
      const currentIsDrawing = isDrawingRef.current

      if (currentDragIndex !== null) {
        const cx = canvas.width / 2
        const cy = canvas.height / 2
        const radius = Math.min(cx, cy) * 0.75
        updateBladePoint(currentDragIndex, {
          x: Math.max(0, Math.min(1, (px.x - cx) / radius)),
          y: Math.max(0, Math.min(0.5, Math.abs((px.y - cy) / radius))),
        })
      } else if (currentIsDrawing) {
        const norm = pixelToNormalized(px, canvas)
        const newPoint: Vec2 = {
          x: Math.max(0, Math.min(1, norm.x)),
          y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
        }
        const pts = useTurbineStore.getState().bladePoints
        const last = pts[pts.length - 1]
        if (last) {
          const dist = Math.sqrt((newPoint.x - last.x) ** 2 + (newPoint.y - last.y) ** 2)
          if (dist > 0.03) addBladePoint(newPoint)
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      setIsDrawing(false)
      setDragIndex(null)
      const sorted = [...useTurbineStore.getState().bladePoints].sort((a, b) => a.x - b.x)
      setBladePoints(sorted)
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [getCanvasCoords, findNearestPoint, pixelToNormalized, addBladePoint, updateBladePoint, setBladePoints])

  // Refs for touch handlers to read latest state
  const dragIndexRef = useRef(dragIndex)
  const isDrawingRef = useRef(isDrawing)
  dragIndexRef.current = dragIndex
  isDrawingRef.current = isDrawing

  // Animation render loop
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
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const render = () => {
      timeRef.current += 0.016
      const w = canvas.width / (Math.min(window.devicePixelRatio, 2))
      const h = canvas.height / (Math.min(window.devicePixelRatio, 2))
      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(cx, cy) * 0.75

      ctx.clearRect(0, 0, w, h)

      // Background radial gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.4)
      bgGrad.addColorStop(0, 'rgba(15, 22, 40, 1)')
      bgGrad.addColorStop(0.7, 'rgba(10, 14, 26, 1)')
      bgGrad.addColorStop(1, 'rgba(10, 14, 26, 1)')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      // Grid rings
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.08)'
      ctx.lineWidth = 1
      for (let r = 0.25; r <= 1; r += 0.25) {
        ctx.beginPath()
        ctx.arc(cx, cy, radius * r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Radial lines for blade segments
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.06)'
      const bc = useTurbineStore.getState().bladeCount
      for (let i = 0; i < bc; i++) {
        const angle = (i / bc) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
        ctx.stroke()
      }

      // Draw mirrored blades
      const pts = useTurbineStore.getState().bladePoints
      if (pts.length >= 2) {
        const smooth = catmullRomSpline(pts, 10)
        const mirrored = mirrorPoints(smooth, bc, cx, cy, radius)

        // Glow layer
        mirrored.forEach((blade) => {
          if (blade.length < 2) return
          ctx.beginPath()
          ctx.moveTo(blade[0].x, blade[0].y)
          blade.forEach((p) => ctx.lineTo(p.x, p.y))
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.15)'
          ctx.lineWidth = 6
          ctx.stroke()
        })

        // Main blade lines
        mirrored.forEach((blade, idx) => {
          if (blade.length < 2) return
          ctx.beginPath()
          ctx.moveTo(blade[0].x, blade[0].y)
          blade.forEach((p) => ctx.lineTo(p.x, p.y))

          const tier = useTurbineStore.getState().bloomTier
          const alpha = tier === 'radiant' ? 0.95 : tier === 'flourishing' ? 0.85 : 0.7
          const hue = 174 + idx * (30 / bc)
          ctx.strokeStyle = `hsla(${hue}, 70%, 55%, ${alpha})`
          ctx.lineWidth = 2.5
          ctx.stroke()
        })

        // Control points (only for first blade / master curve)
        pts.forEach((pt, i) => {
          const worldX = cx + pt.x * radius
          const worldY = cy + pt.y * radius

          // Outer glow
          ctx.beginPath()
          ctx.arc(worldX, worldY, 8, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(45, 212, 191, 0.2)'
          ctx.fill()

          // Inner dot
          ctx.beginPath()
          ctx.arc(worldX, worldY, 4, 0, Math.PI * 2)
          ctx.fillStyle = i === 0 ? '#fbbf24' : '#2dd4bf'
          ctx.fill()

          // Connecting line
          if (i > 0) {
            const prev = pts[i - 1]
            ctx.beginPath()
            ctx.moveTo(cx + prev.x * radius, cy + prev.y * radius)
            ctx.lineTo(worldX, worldY)
            ctx.strokeStyle = 'rgba(45, 212, 191, 0.3)'
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.stroke()
            ctx.setLineDash([])
          }
        })
      }

      // Center hub
      const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12)
      hubGrad.addColorStop(0, 'rgba(45, 212, 191, 0.6)')
      hubGrad.addColorStop(1, 'rgba(45, 212, 191, 0)')
      ctx.fillStyle = hubGrad
      ctx.beginPath()
      ctx.arc(cx, cy, 12, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#2dd4bf'
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fill()

      // Bloom tier indicator ring
      const tier = useTurbineStore.getState().bloomTier
      const tierColors: Record<string, string> = {
        dormant: 'rgba(100, 116, 139, 0.2)',
        seedling: 'rgba(45, 212, 191, 0.25)',
        flourishing: 'rgba(251, 191, 36, 0.3)',
        radiant: 'rgba(244, 114, 182, 0.4)',
      }
      const pulseScale = 1 + Math.sin(timeRef.current * 2) * 0.02
      ctx.beginPath()
      ctx.arc(cx, cy, radius * pulseScale, 0, Math.PI * 2)
      ctx.strokeStyle = tierColors[tier] || tierColors.dormant
      ctx.lineWidth = 2
      ctx.stroke()

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, []) // render loop runs independently, reads from store directly

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair"
      style={{ touchAction: 'none' }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
    />
  )
}
