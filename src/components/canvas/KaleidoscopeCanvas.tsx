import { useRef, useEffect, useCallback, useState } from 'react'
import { useTurbineStore, type Vec2 } from '../../stores/turbineStore'
import { catmullRomSpline, mirrorPoints, simplifyPoints } from '../../utils/spline'
import { usePuzzleStore } from '../../stores/puzzleStore'
import MiniTurbineViewer from '../viewer/MiniTurbineViewer'

const MAX_POINTS = 20
import { catmullRomSpline, mirrorPoints } from '../../utils/spline'
import { simplifyPath } from '../../utils/bezier'

export default function KaleidoscopeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const animFrameRef = useRef<number>(0)
  const timeRef = useRef(0)
  const [showMiniPreview, setShowMiniPreview] = useState(false)
  // Buffer raw drawn points before simplification
  const rawPointsRef = useRef<Vec2[]>([])
  // Track whether we pushed undo for this gesture
  const undoPushedRef = useRef(false)

  const {
    bladePoints,
    setBladePoints,
    addBladePoint,
    updateBladePoint,
    deleteBladePoint,
    undo, redo,
    history, historyIndex,
    snapToGrid, setSnapToGrid,
    clearBlade,
  } = useTurbineStore()

  usePuzzleStore() // subscribe for potential future challenge target overlay

  const snapVal = useCallback((v: number) => {
    return snapToGrid ? Math.round(v / 0.05) * 0.05 : v
  }, [snapToGrid])
    pushUndo,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useTurbineStore()

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (isMeta && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if (isMeta && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

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
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const pixelToNormalized = useCallback((px: Vec2, canvas: HTMLCanvasElement): Vec2 => {
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const radius = Math.min(cx, cy) * 0.75
    const dx = px.x - cx
    const dy = px.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)
    return {
      x: snapVal(Math.min(1, dist / radius)),
      y: snapVal(Math.max(-0.5, Math.min(0.5, (angle / (2 * Math.PI)) * 0.4))),
    }
  }, [snapVal])

  const findNearestPoint = useCallback((px: Vec2, canvas: HTMLCanvasElement): number | null => {
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const radius = Math.min(cx, cy) * 0.75
    const threshold = 18

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
      pushUndo()
      undoPushedRef.current = true
      setDragIndex(nearIdx)
    } else {
      if (bladePoints.length >= MAX_POINTS) return
      pushUndo()
      undoPushedRef.current = true
      setIsDrawing(true)
      rawPointsRef.current = []
      const norm = pixelToNormalized(px, canvas)
      const newPoint: Vec2 = {
        x: Math.max(0, Math.min(1, norm.x)),
        y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
      }
      rawPointsRef.current.push(newPoint)
      addBladePoint(newPoint)
    }
  }, [findNearestPoint, pixelToNormalized, addBladePoint, bladePoints.length])
  }, [findNearestPoint, pixelToNormalized, addBladePoint, pushUndo])

  const handleMove = useCallback((px: Vec2) => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (dragIndex !== null) {
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const radius = Math.min(cx, cy) * 0.75
      const updated: Vec2 = {
        x: Math.max(0, Math.min(1, snapVal((px.x - cx) / radius))),
        y: Math.max(0, Math.min(0.5, Math.abs(snapVal((px.y - cy) / radius)))),
      }
      updateBladePoint(dragIndex, updated)
    } else if (isDrawing) {
      if (bladePoints.length >= MAX_POINTS) return
      const norm = pixelToNormalized(px, canvas)
      const newPoint: Vec2 = {
        x: Math.max(0, Math.min(1, norm.x)),
        y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
      }
      // Collect raw points with low threshold for smooth capture
      const last = rawPointsRef.current[rawPointsRef.current.length - 1]
      if (last) {
        const dist = Math.sqrt((newPoint.x - last.x) ** 2 + (newPoint.y - last.y) ** 2)
        if (dist > 0.06) addBladePoint(newPoint)
      }
    }
  }, [dragIndex, isDrawing, bladePoints, pixelToNormalized, updateBladePoint, addBladePoint, snapVal])
        if (dist > 0.008) {
          rawPointsRef.current.push(newPoint)
          addBladePoint(newPoint)
        }
      }
    }
  }, [dragIndex, isDrawing, pixelToNormalized, updateBladePoint, addBladePoint])

  const handleUp = useCallback(() => {
    if (isDrawing && rawPointsRef.current.length > 2) {
      // Simplify the drawn points using Ramer-Douglas-Peucker + sort
      const existing = useTurbineStore.getState().bladePoints
      // Identify the points that were drawn in this stroke (they're the last N points)
      const strokeCount = rawPointsRef.current.length
      const preExisting = existing.slice(0, existing.length - strokeCount)
      const simplified = simplifyPath(rawPointsRef.current, 0.012)
      const merged = [...preExisting, ...simplified].sort((a, b) => a.x - b.x)
      setBladePoints(merged)
    } else {
      const sorted = [...useTurbineStore.getState().bladePoints].sort((a, b) => a.x - b.x)
      setBladePoints(sorted)
    }
    rawPointsRef.current = []
    setIsDrawing(false)
    setDragIndex(null)
    const currentPts = useTurbineStore.getState().bladePoints
    const sorted = [...currentPts].sort((a, b) => a.x - b.x)
    const simplified = simplifyPoints(sorted, 0.04)
    setBladePoints(simplified)
  }, [setBladePoints])
    undoPushedRef.current = false
  }, [isDrawing, setBladePoints])

  // Right-click to delete point
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const px = getCanvasCoords(e, canvas)
    if (!px) return
    const nearIdx = findNearestPoint(px, canvas)
    if (nearIdx !== null) deleteBladePoint(nearIdx)
  }, [getCanvasCoords, findNearestPoint, deleteBladePoint])

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

  const handlePointerUp = useCallback(() => handleUp(), [handleUp])

  // Touch handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const px = getCanvasCoords(e, canvas)
      if (!px) return
      const nearIdx = findNearestPoint(px, canvas)
      if (nearIdx !== null) {
        pushUndo()
        undoPushedRef.current = true
        setDragIndex(nearIdx)
      } else {
        if (useTurbineStore.getState().bladePoints.length >= MAX_POINTS) return
        pushUndo()
        undoPushedRef.current = true
        setIsDrawing(true)
        rawPointsRef.current = []
        const norm = pixelToNormalized(px, canvas)
        const pt: Vec2 = {
          x: Math.max(0, Math.min(1, norm.x)),
          y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
        }
        rawPointsRef.current.push(pt)
        addBladePoint(pt)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const px = getCanvasCoords(e, canvas)
      if (!px) return
      const currentDragIndex = dragIndexRef.current
      const currentIsDrawing = isDrawingRef.current

      if (currentDragIndex !== null) {
        const cx = canvas.width / 2
        const cy = canvas.height / 2
        const radius = Math.min(cx, cy) * 0.75
        const snap = useTurbineStore.getState().snapToGrid
        const sv = (v: number) => snap ? Math.round(v / 0.05) * 0.05 : v
        updateBladePoint(currentDragIndex, {
          x: Math.max(0, Math.min(1, sv((px.x - cx) / radius))),
          y: Math.max(0, Math.min(0.5, Math.abs(sv((px.y - cy) / radius)))),
        })
      } else if (currentIsDrawing) {
        const pts = useTurbineStore.getState().bladePoints
        if (pts.length >= MAX_POINTS) return
        const norm = pixelToNormalized(px, canvas)
        const newPoint: Vec2 = {
          x: Math.max(0, Math.min(1, norm.x)),
          y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
        }
        const last = pts[pts.length - 1]
        if (last) {
          const dist = Math.sqrt((newPoint.x - last.x) ** 2 + (newPoint.y - last.y) ** 2)
          if (dist > 0.06) addBladePoint(newPoint)
        const last = rawPointsRef.current[rawPointsRef.current.length - 1]
        if (last) {
          const dist = Math.sqrt((newPoint.x - last.x) ** 2 + (newPoint.y - last.y) ** 2)
          if (dist > 0.008) {
            rawPointsRef.current.push(newPoint)
            addBladePoint(newPoint)
          }
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      if (isDrawingRef.current && rawPointsRef.current.length > 2) {
        const existing = useTurbineStore.getState().bladePoints
        const strokeCount = rawPointsRef.current.length
        const preExisting = existing.slice(0, existing.length - strokeCount)
        const simplified = simplifyPath(rawPointsRef.current, 0.012)
        const merged = [...preExisting, ...simplified].sort((a, b) => a.x - b.x)
        setBladePoints(merged)
      } else {
        const sorted = [...useTurbineStore.getState().bladePoints].sort((a, b) => a.x - b.x)
        setBladePoints(sorted)
      }
      rawPointsRef.current = []
      setIsDrawing(false)
      setDragIndex(null)
      const sorted = [...useTurbineStore.getState().bladePoints].sort((a, b) => a.x - b.x)
      const simplified = simplifyPoints(sorted, 0.04)
      setBladePoints(simplified)
      undoPushedRef.current = false
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
  }, [getCanvasCoords, findNearestPoint, pixelToNormalized, addBladePoint, updateBladePoint, setBladePoints, pushUndo])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

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

      // Background
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.4)
      bgGrad.addColorStop(0, 'rgba(15, 22, 40, 1)')
      bgGrad.addColorStop(0.7, 'rgba(10, 14, 26, 1)')
      bgGrad.addColorStop(1, 'rgba(10, 14, 26, 1)')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      const store = useTurbineStore.getState()
      const { bladePoints: pts, bladeCount: bc, curveSmoothing: cs, snapToGrid: snap } = store

      // Snap grid dots
      if (snap) {
        ctx.fillStyle = 'rgba(45, 212, 191, 0.06)'
        for (let gx = 0; gx <= 1.0; gx += 0.05) {
          for (let gy = 0; gy <= 0.5; gy += 0.05) {
            const wx = cx + gx * radius
            const wy = cy + gy * radius
            ctx.beginPath()
            ctx.arc(wx, wy, 1, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // Grid rings
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.08)'
      ctx.lineWidth = 1
      for (let r = 0.25; r <= 1; r += 0.25) {
        ctx.beginPath()
        ctx.arc(cx, cy, radius * r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Radial lines
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.06)'
      for (let i = 0; i < bc; i++) {
        const angle = (i / bc) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
        ctx.stroke()
      }

      // Draw mirrored blades
      if (pts.length >= 2) {
        const smooth = catmullRomSpline(pts, cs)
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
          const tier = store.bloomTier
          const alpha = tier === 'radiant' ? 0.95 : tier === 'flourishing' ? 0.85 : 0.7
          const hue = 174 + idx * (30 / bc)
          ctx.strokeStyle = `hsla(${hue}, 70%, 55%, ${alpha})`
          ctx.lineWidth = 2.5
          ctx.stroke()
        })

        // Control points
        pts.forEach((pt, i) => {
          const worldX = cx + pt.x * radius
          const worldY = cy + pt.y * radius

          ctx.beginPath()
          ctx.arc(worldX, worldY, 8, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(45, 212, 191, 0.2)'
          ctx.fill()

          ctx.beginPath()
          ctx.arc(worldX, worldY, 4, 0, Math.PI * 2)
          ctx.fillStyle = i === 0 ? '#fbbf24' : '#2dd4bf'
          ctx.fill()

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
      const tier = store.bloomTier
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

      // Point count warning
      if (pts.length >= MAX_POINTS) {
        ctx.font = '10px monospace'
        ctx.fillStyle = 'rgba(251,191,36,0.8)'
        ctx.textAlign = 'center'
        ctx.fillText(`Max ${MAX_POINTS} points reached`, cx, h - 16)
        ctx.textAlign = 'left'
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return (
    <div className="relative w-full h-full">
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ touchAction: 'none' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onContextMenu={handleContextMenu}
      />

      {/* Canvas toolbar — bottom left */}
      <div className="absolute bottom-10 left-3 flex items-center gap-1.5 pointer-events-auto z-10">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all border border-border/40 bg-surface/80 backdrop-blur-sm disabled:opacity-30 hover:border-teal/40 hover:text-teal text-text-dim"
        >
          ⟲
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all border border-border/40 bg-surface/80 backdrop-blur-sm disabled:opacity-30 hover:border-teal/40 hover:text-teal text-text-dim"
        >
          ⟳
        </button>
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          title="Snap to grid"
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all border bg-surface/80 backdrop-blur-sm ${
            snapToGrid ? 'border-teal/50 text-teal' : 'border-border/40 text-text-dim hover:border-teal/30'
          }`}
        >
          ⊞
        </button>
        <button
          onClick={() => {
            if (bladePoints.length > 0) clearBlade()
          }}
          title="Clear all points"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all border border-border/40 bg-surface/80 backdrop-blur-sm hover:border-red-500/40 hover:text-red-400 text-text-dim"
        >
          ✕
        </button>

        {/* Point counter */}
        <span
          className="text-[9px] px-1.5 py-0.5 rounded bg-surface/80 border border-border/40 text-text-muted backdrop-blur-sm"
          style={{ color: bladePoints.length >= MAX_POINTS ? '#fbbf24' : undefined }}
        >
          {bladePoints.length}/{MAX_POINTS} pts
        </span>
      </div>

      {/* Mini 3D preview toggle — bottom right */}
      <div className="absolute bottom-10 right-3 flex flex-col items-end gap-2 pointer-events-auto z-10">
        <button
          onClick={() => setShowMiniPreview(v => !v)}
          title="Toggle 3D preview"
          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border backdrop-blur-sm ${
            showMiniPreview ? 'border-teal/50 text-teal bg-teal/10' : 'border-border/40 text-text-dim bg-surface/80 hover:border-teal/30'
          }`}
        >
          ◇ 3D Preview
        </button>
        {showMiniPreview && (
          <div className="rounded-xl overflow-hidden shadow-2xl border border-teal/20">
            <MiniTurbineViewer />
          </div>
        )}
      />
      {/* Undo/Redo buttons */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          className="w-8 h-8 rounded-lg bg-surface/90 backdrop-blur-sm border border-border/50 text-text-dim
            hover:text-teal hover:border-teal/30 disabled:opacity-30 disabled:cursor-not-allowed
            flex items-center justify-center transition-all"
          title="Undo (Ctrl+Z)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" /><path d="M3 13a9 9 0 0 1 15.36-6.36" />
          </svg>
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          className="w-8 h-8 rounded-lg bg-surface/90 backdrop-blur-sm border border-border/50 text-text-dim
            hover:text-teal hover:border-teal/30 disabled:opacity-30 disabled:cursor-not-allowed
            flex items-center justify-center transition-all"
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" /><path d="M21 13a9 9 0 0 0-15.36-6.36" />
          </svg>
        </button>
      </div>
    </div>
  )
}
