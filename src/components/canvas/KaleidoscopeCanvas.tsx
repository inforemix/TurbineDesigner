import { useRef, useEffect, useCallback, useState } from 'react'
import { useTurbineStore, type Vec2 } from '../../stores/turbineStore'
import { catmullRomSpline, mirrorPoints } from '../../utils/spline'
import { Bezier } from 'bezier-js'

/* ------------------------------------------------------------------ */
/*  Snowflake tree-branch renderer                                     */
/* ------------------------------------------------------------------ */

/**
 * Recursively draws one arm of a snowflake with bilateral symmetry
 * and fractal sub-branches (tree branch / L-system style).
 *
 * Each call draws:
 *  1. A bilateral pair of strokes (normal + y-mirrored camber)
 *  2. Sub-branches at fixed radial fractions going ±60°
 */
function drawSnowflakeArm(
  ctx: CanvasRenderingContext2D,
  smooth: Vec2[],
  ox: number, oy: number,   // arm origin in canvas px
  radius: number,           // canvas radius scale
  angle: number,            // direction of this arm
  scale: number,            // size multiplier (1 = full, shrinks each level)
  depth: number,
  maxDepth: number,
): void {
  if (scale < 0.06 || smooth.length < 2) return

  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  // ── Glow bloom (depth-0 only) ─────────────────────────────────────
  if (depth === 0) {
    for (const m of [1, -1]) {
      ctx.beginPath()
      for (let i = 0; i < smooth.length; i++) {
        const px = ox + smooth[i].x * radius * scale * cos - smooth[i].y * radius * scale * m * sin
        const py = oy + smooth[i].x * radius * scale * sin + smooth[i].y * radius * scale * m * cos
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.strokeStyle = 'rgba(45,212,191,0.09)'
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }

  // ── Filled area (depth-0 bilateral fill) ──────────────────────────
  if (depth === 0) {
    for (const m of [1, -1]) {
      ctx.beginPath()
      ctx.moveTo(ox, oy)
      for (const pt of smooth) {
        ctx.lineTo(
          ox + pt.x * radius * scale * cos - pt.y * radius * scale * m * sin,
          oy + pt.x * radius * scale * sin + pt.y * radius * scale * m * cos,
        )
      }
      ctx.closePath()
      const hue = 185
      ctx.fillStyle = `hsla(${hue},70%,60%,0.07)`
      ctx.fill()
    }
  }

  // ── Bilateral stroke pair ─────────────────────────────────────────
  const hue = 174 + depth * 14          // teal → cyan → blue by depth
  const bright = 65 - depth * 6
  const alpha = 0.85 - depth * 0.22
  const lw = Math.max(0.5, (2.8 - depth * 0.75) * scale)

  for (const m of [1, -1]) {
    ctx.beginPath()
    for (let i = 0; i < smooth.length; i++) {
      const px = ox + smooth[i].x * radius * scale * cos - smooth[i].y * radius * scale * m * sin
      const py = oy + smooth[i].x * radius * scale * sin + smooth[i].y * radius * scale * m * cos
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.strokeStyle = `hsla(${hue},72%,${bright}%,${alpha})`
    ctx.lineWidth = lw
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // ── Sub-branches (tree-branch fractal) ───────────────────────────
  if (depth >= maxDepth) return

  // Branch positions along the arm (radial fraction of arm length)
  const branchFracs = depth === 0
    ? [0.38, 0.60, 0.78]  // 3 branch nodes on main arm
    : [0.52]              // 1 branch node on sub-arms

  const branchAngleDelta = depth === 0
    ? Math.PI / 3         // 60° off main arm
    : Math.PI * 5 / 12   // 75° off sub-arms (tighter dendrite look)

  const branchScale = depth === 0 ? 0.40 : 0.42

  for (const frac of branchFracs) {
    // Origin of the sub-branch: point along arm's central (zero-camber) axis
    const bx = ox + frac * radius * scale * cos
    const by = oy + frac * radius * scale * sin

    for (const sign of [1, -1]) {
      drawSnowflakeArm(
        ctx, smooth, bx, by, radius,
        angle + sign * branchAngleDelta,
        branchScale,
        depth + 1, maxDepth,
      )
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Pinwheel spin-direction arc                                        */
/* ------------------------------------------------------------------ */

/**
 * Draws a subtle directional arc at the tip of each blade to show
 * the pinwheel's rotational sweep direction.
 */
function drawPinwheelSweepArcs(
  ctx: CanvasRenderingContext2D,
  bladeCount: number,
  cx: number, cy: number, radius: number,
  smooth: Vec2[],
  time: number,
) {
  const tipFrac = 0.85
  const tipPt = smooth[Math.floor(tipFrac * (smooth.length - 1))]
  if (!tipPt) return

  const arcR = tipPt.x * radius * 0.22
  const breathe = 0.5 + Math.sin(time * 1.8) * 0.15

  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI * 2
    const tipX = cx + tipPt.x * radius * Math.cos(angle) - tipPt.y * radius * Math.sin(angle)
    const tipY = cy + tipPt.x * radius * Math.sin(angle) + tipPt.y * radius * Math.cos(angle)

    ctx.beginPath()
    // Arc sweeping in the "forward" rotation direction
    ctx.arc(tipX, tipY, arcR * breathe, angle + 0.1, angle + 0.85, false)
    ctx.strokeStyle = 'rgba(94,234,212,0.22)'
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

import { usePuzzleStore } from '../../stores/puzzleStore'
import MiniTurbineViewer from '../viewer/MiniTurbineViewer'

const MAX_POINTS = 20

/* ------------------------------------------------------------------ */
/*  Bezier fitting helpers                                             */
/* ------------------------------------------------------------------ */

/** Fit cubic Bezier segments to a polyline, then resample evenly */
function fitAndResampleBezier(raw: Vec2[], numSegments: number, samplesPerSeg: number): Vec2[] {
  if (raw.length < 3) return raw

  // Sort by x to ensure left-to-right
  const sorted = [...raw].sort((a, b) => a.x - b.x)

  // Split the sorted points into sub-ranges for each Bezier segment
  const step = (sorted.length - 1) / numSegments
  const result: Vec2[] = []

  for (let s = 0; s < numSegments; s++) {
    const i0 = Math.round(s * step)
    const i3 = Math.round((s + 1) * step)
    const subPts = sorted.slice(i0, i3 + 1)
    if (subPts.length < 2) continue

    const p0 = subPts[0]
    const p3 = subPts[subPts.length - 1]

    const i1 = Math.min(subPts.length - 1, Math.round(subPts.length / 3))
    const i2 = Math.min(subPts.length - 1, Math.round((2 * subPts.length) / 3))

    const cp1 = {
      x: p0.x + (subPts[i1].x - p0.x) * 1.5,
      y: p0.y + (subPts[i1].y - p0.y) * 1.5,
    }
    const cp2 = {
      x: p3.x + (subPts[i2].x - p3.x) * 1.5,
      y: p3.y + (subPts[i2].y - p3.y) * 1.5,
    }

    for (let iter = 0; iter < 6; iter++) {
      const bz = new Bezier(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y)
      const lut = bz.getLUT(subPts.length - 1)

      let errCp1X = 0, errCp1Y = 0, errCp2X = 0, errCp2Y = 0
      for (let j = 0; j < subPts.length; j++) {
        const t = j / (subPts.length - 1)
        const approx = lut[j]
        if (!approx) continue
        const dx = subPts[j].x - approx.x
        const dy = subPts[j].y - approx.y
        const w1 = 3 * t * (1 - t) * (1 - t)
        const w2 = 3 * t * t * (1 - t)
        errCp1X += dx * w1
        errCp1Y += dy * w1
        errCp2X += dx * w2
        errCp2Y += dy * w2
      }

      const scale = 1.5 / subPts.length
      cp1.x += errCp1X * scale * 4
      cp1.y += errCp1Y * scale * 4
      cp2.x += errCp2X * scale * 4
      cp2.y += errCp2Y * scale * 4
    }

    const bz = new Bezier(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y)
    const sampled = bz.getLUT(samplesPerSeg)

    const startIdx = result.length > 0 ? 1 : 0
    for (let k = startIdx; k < sampled.length; k++) {
      result.push({ x: sampled[k].x, y: sampled[k].y })
    }
  }

  return result
}

/** Simplify dense raw input into fewer key points using RDP */
function simplifyRDP(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length <= 2) return [...points]
  const first = points[0]
  const last = points[points.length - 1]
  let maxDist = 0
  let maxIdx = 0
  const dx = last.x - first.x
  const dy = last.y - first.y
  const lineLen = Math.sqrt(dx * dx + dy * dy)

  for (let i = 1; i < points.length - 1; i++) {
    let dist: number
    if (lineLen === 0) {
      const ex = points[i].x - first.x
      const ey = points[i].y - first.y
      dist = Math.sqrt(ex * ex + ey * ey)
    } else {
      dist = Math.abs(
        dy * points[i].x - dx * points[i].y + last.x * first.y - last.y * first.x,
      ) / lineLen
    }
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, maxIdx + 1), epsilon)
    const right = simplifyRDP(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function KaleidoscopeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const animFrameRef = useRef<number>(0)
  const timeRef = useRef(0)
  const [showMiniPreview, setShowMiniPreview] = useState(false)
  const rawPointsRef = useRef<Vec2[]>([])
  const rawPixelPreviewRef = useRef<Vec2[]>([])
  const undoPushedRef = useRef(false)
  // Track mouse position in canvas pixel space for hover effects
  const mousePxRef = useRef<Vec2 | null>(null)

  const {
    bladePoints,
    setBladePoints,
    updateBladePoint,
    deleteBladePoint,
    undo, redo,
    history, historyIndex,
    snapToGrid, setSnapToGrid,
    clearBlade,
    pushUndo,
  } = useTurbineStore()

  usePuzzleStore()

  const snapVal = useCallback((v: number) => {
    return snapToGrid ? Math.round(v / 0.05) * 0.05 : v
  }, [snapToGrid])

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

  // --- Freehand draw ---

  const handleDown = useCallback((px: Vec2) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const nearIdx = findNearestPoint(px, canvas)

    if (nearIdx !== null) {
      pushUndo()
      undoPushedRef.current = true
      setDragIndex(nearIdx)
    } else {
      pushUndo()
      undoPushedRef.current = true
      setIsDrawing(true)
      const norm = pixelToNormalized(px, canvas)
      const pt: Vec2 = {
        x: Math.max(0, Math.min(1, norm.x)),
        y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
      }
      rawPointsRef.current = [pt]
      rawPixelPreviewRef.current = [px]
    }
  }, [findNearestPoint, pixelToNormalized, pushUndo])

  const handleMove = useCallback((px: Vec2) => {
    const canvas = canvasRef.current
    if (!canvas) return
    mousePxRef.current = px

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
      const norm = pixelToNormalized(px, canvas)
      const pt: Vec2 = {
        x: Math.max(0, Math.min(1, norm.x)),
        y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
      }
      const last = rawPointsRef.current[rawPointsRef.current.length - 1]
      if (last) {
        const dist = Math.sqrt((pt.x - last.x) ** 2 + (pt.y - last.y) ** 2)
        if (dist > 0.005) {
          rawPointsRef.current.push(pt)
          rawPixelPreviewRef.current.push(px)
        }
      }
    }
  }, [dragIndex, isDrawing, pixelToNormalized, updateBladePoint, snapVal])

  const handleUp = useCallback(() => {
    if (isDrawing && rawPointsRef.current.length >= 3) {
      const numSegs = Math.max(2, Math.min(5, Math.ceil(rawPointsRef.current.length / 15)))
      const smoothPts = fitAndResampleBezier(rawPointsRef.current, numSegs, 8)

      let simplified = simplifyRDP(smoothPts, 0.008)
      if (simplified.length > MAX_POINTS) {
        simplified = simplifyRDP(smoothPts, 0.02)
      }
      if (simplified.length > MAX_POINTS) {
        simplified = simplifyRDP(smoothPts, 0.04)
      }

      simplified.sort((a, b) => a.x - b.x)
      setBladePoints(simplified)
    } else if (isDrawing && rawPointsRef.current.length > 0) {
      const pts = [...useTurbineStore.getState().bladePoints, ...rawPointsRef.current]
      const sorted = pts.sort((a, b) => a.x - b.x)
      setBladePoints(sorted)
    }

    rawPointsRef.current = []
    rawPixelPreviewRef.current = []
    setIsDrawing(false)
    setDragIndex(null)
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

  const handlePointerLeave = useCallback(() => {
    mousePxRef.current = null
    handleUp()
  }, [handleUp])

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
        pushUndo()
        undoPushedRef.current = true
        setIsDrawing(true)
        const norm = pixelToNormalized(px, canvas)
        const pt: Vec2 = {
          x: Math.max(0, Math.min(1, norm.x)),
          y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
        }
        rawPointsRef.current = [pt]
        rawPixelPreviewRef.current = [px]
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
        const norm = pixelToNormalized(px, canvas)
        const pt: Vec2 = {
          x: Math.max(0, Math.min(1, norm.x)),
          y: Math.max(0, Math.min(0.5, Math.abs(norm.y))),
        }
        const last = rawPointsRef.current[rawPointsRef.current.length - 1]
        if (last) {
          const dist = Math.sqrt((pt.x - last.x) ** 2 + (pt.y - last.y) ** 2)
          if (dist > 0.005) {
            rawPointsRef.current.push(pt)
            rawPixelPreviewRef.current.push(px)
          }
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      if (isDrawingRef.current && rawPointsRef.current.length >= 3) {
        const numSegs = Math.max(2, Math.min(5, Math.ceil(rawPointsRef.current.length / 15)))
        const smoothPts = fitAndResampleBezier(rawPointsRef.current, numSegs, 8)
        let simplified = simplifyRDP(smoothPts, 0.008)
        if (simplified.length > MAX_POINTS) simplified = simplifyRDP(smoothPts, 0.02)
        if (simplified.length > MAX_POINTS) simplified = simplifyRDP(smoothPts, 0.04)
        simplified.sort((a, b) => a.x - b.x)
        setBladePoints(simplified)
      } else if (isDrawingRef.current && rawPointsRef.current.length > 0) {
        const pts = [...useTurbineStore.getState().bladePoints, ...rawPointsRef.current]
        setBladePoints(pts.sort((a, b) => a.x - b.x))
      }

      rawPointsRef.current = []
      rawPixelPreviewRef.current = []
      setIsDrawing(false)
      setDragIndex(null)
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
  }, [getCanvasCoords, findNearestPoint, pixelToNormalized, updateBladePoint, setBladePoints, pushUndo])

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

      // Radial lines (one per blade)
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.06)'
      for (let i = 0; i < bc; i++) {
        const angle = (i / bc) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
        ctx.stroke()
      }

      if (pts.length >= 2) {
        const smooth = catmullRomSpline(pts, cs)

        if (store.symmetryMode === 'snowflake') {
          // ── Snowflake: tree-branch bilateral fractal per arm ──────────────
          for (let b = 0; b < bc; b++) {
            const armAngle = (b / bc) * Math.PI * 2
            drawSnowflakeArm(ctx, smooth, cx, cy, radius, armAngle, 1.0, 0, 2)
          }
        } else {
          const mirrored = mirrorPoints(smooth, bc, cx, cy, radius)

          // ── Filled blade area (swept petal shape per blade) ────────────────
          mirrored.forEach((blade, idx) => {
            if (blade.length < 2) return

            const isFirst = idx === 0
            const angle = (idx / bc) * Math.PI * 2
            const edgeX = cx + Math.cos(angle) * radius
            const edgeY = cy + Math.sin(angle) * radius

            ctx.beginPath()
            ctx.moveTo(cx, cy)
            for (let i = 0; i < blade.length; i++) {
              ctx.lineTo(blade[i].x, blade[i].y)
            }
            ctx.lineTo(edgeX, edgeY)
            ctx.closePath()

            const fillAlpha = isFirst ? 0.13 : 0.06
            const hue = 174 + idx * (30 / bc)
            ctx.fillStyle = `hsla(${hue}, 65%, 55%, ${fillAlpha})`
            ctx.fill()
          })

          // ── Glow pass ────────────────────────────────────────────────────
          mirrored.forEach((blade) => {
            if (blade.length < 2) return
            ctx.beginPath()
            ctx.moveTo(blade[0].x, blade[0].y)
            for (let i = 1; i < blade.length; i++) {
              ctx.lineTo(blade[i].x, blade[i].y)
            }
            ctx.strokeStyle = 'rgba(45, 212, 191, 0.12)'
            ctx.lineWidth = 8
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()
          })

          // ── Main blade lines (first blade brighter/thicker) ──────────────
          mirrored.forEach((blade, idx) => {
            if (blade.length < 2) return
            ctx.beginPath()
            ctx.moveTo(blade[0].x, blade[0].y)
            for (let i = 1; i < blade.length; i++) {
              ctx.lineTo(blade[i].x, blade[i].y)
            }
            const tier = store.bloomTier
            const alpha = tier === 'radiant' ? 0.95 : tier === 'flourishing' ? 0.85 : 0.7
            const hue = 174 + idx * (30 / bc)
            const isFirst = idx === 0
            ctx.strokeStyle = `hsla(${hue}, 70%, ${isFirst ? 65 : 55}%, ${isFirst ? Math.min(1, alpha + 0.2) : alpha})`
            ctx.lineWidth = isFirst ? 3 : 2
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()

            if (isFirst) {
              ctx.beginPath()
              ctx.moveTo(blade[0].x, blade[0].y)
              for (let i = 1; i < blade.length; i++) {
                ctx.lineTo(blade[i].x, blade[i].y)
              }
              ctx.strokeStyle = 'rgba(94, 234, 212, 0.35)'
              ctx.lineWidth = 1
              ctx.stroke()
            }
          })

          // ── Pinwheel: directional sweep arcs at blade tips ────────────────
          if (store.symmetryMode === 'pinwheel') {
            drawPinwheelSweepArcs(ctx, bc, cx, cy, radius, smooth, timeRef.current)
          }
        }

        // ── Control points with hover effects ──────────────────────────────
        const mpx = mousePxRef.current
        pts.forEach((pt, i) => {
          const worldX = cx + pt.x * radius
          const worldY = cy + pt.y * radius

          // Check if hovered
          let isHovered = false
          if (mpx) {
            const dx = mpx.x - worldX
            const dy = mpx.y - worldY
            isHovered = Math.sqrt(dx * dx + dy * dy) < 18
          }
          const isDragged = dragIndexRef.current === i

          // Outer glow (larger on hover/drag)
          const glowR = isDragged ? 16 : isHovered ? 14 : 8
          const glowAlpha = isDragged ? 0.45 : isHovered ? 0.35 : 0.2
          const glowGrad = ctx.createRadialGradient(worldX, worldY, 0, worldX, worldY, glowR)
          const glowColor = i === 0 ? '251, 191, 36' : '45, 212, 191'
          glowGrad.addColorStop(0, `rgba(${glowColor}, ${glowAlpha})`)
          glowGrad.addColorStop(1, `rgba(${glowColor}, 0)`)
          ctx.beginPath()
          ctx.arc(worldX, worldY, glowR, 0, Math.PI * 2)
          ctx.fillStyle = glowGrad
          ctx.fill()

          // Inner dot (larger on hover)
          const dotR = isDragged ? 6 : isHovered ? 5.5 : 4
          ctx.beginPath()
          ctx.arc(worldX, worldY, dotR, 0, Math.PI * 2)
          ctx.fillStyle = i === 0 ? '#fbbf24' : '#2dd4bf'
          ctx.fill()

          // Crosshair ring on hover
          if (isHovered || isDragged) {
            ctx.beginPath()
            ctx.arc(worldX, worldY, dotR + 3, 0, Math.PI * 2)
            ctx.strokeStyle = i === 0 ? 'rgba(251,191,36,0.5)' : 'rgba(45,212,191,0.5)'
            ctx.lineWidth = 1
            ctx.stroke()
          }

          // Index label for first point
          if (i === 0) {
            ctx.font = '9px monospace'
            ctx.fillStyle = 'rgba(251,191,36,0.7)'
            ctx.textAlign = 'center'
            ctx.fillText('●', worldX, worldY - 12)
            ctx.textAlign = 'left'
          }
        })
      }

      // ── Live freehand preview ──────────────────────────────────────────────
      const rawPreview = rawPixelPreviewRef.current
      if (rawPreview.length >= 2) {
        // Glow behind drawing stroke
        ctx.beginPath()
        ctx.moveTo(rawPreview[0].x, rawPreview[0].y)
        for (let i = 1; i < rawPreview.length; i++) {
          ctx.lineTo(rawPreview[i].x, rawPreview[i].y)
        }
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.15)'
        ctx.lineWidth = 8
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()

        // Main drawing stroke
        ctx.beginPath()
        ctx.moveTo(rawPreview[0].x, rawPreview[0].y)
        for (let i = 1; i < rawPreview.length; i++) {
          ctx.lineTo(rawPreview[i].x, rawPreview[i].y)
        }
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.setLineDash([5, 3])
        ctx.stroke()
        ctx.setLineDash([])

        // Tip cursor dot
        const tip = rawPreview[rawPreview.length - 1]
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#fbbf24'
        ctx.fill()
      }

      // ── Center hub ────────────────────────────────────────────────────────
      const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14)
      hubGrad.addColorStop(0, 'rgba(45, 212, 191, 0.7)')
      hubGrad.addColorStop(0.5, 'rgba(45, 212, 191, 0.2)')
      hubGrad.addColorStop(1, 'rgba(45, 212, 191, 0)')
      ctx.fillStyle = hubGrad
      ctx.beginPath()
      ctx.arc(cx, cy, 14, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#2dd4bf'
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fill()

      // ── Bloom tier indicator ring ─────────────────────────────────────────
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

      // Outer decoration ring for radiant tier
      if (tier === 'radiant') {
        ctx.beginPath()
        ctx.arc(cx, cy, radius * (pulseScale + 0.025), 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(244,114,182,0.15)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 8])
        ctx.stroke()
        ctx.setLineDash([])
      }

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
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ touchAction: 'none' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
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
          <div className="shadow-2xl">
            <MiniTurbineViewer />
          </div>
        )}
      </div>

      {/* Undo/Redo buttons — top right */}
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
