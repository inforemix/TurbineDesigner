import { useRef, useEffect, useCallback, useState } from 'react'
import { useTurbineStore, type Vec2 } from '../../stores/turbineStore'
import { catmullRomSplineWithHandles, crAutoTangent, mirrorPoints } from '../../utils/spline'
import { Bezier } from 'bezier-js'
import { getCanvasTheme, type CanvasTheme } from '../../utils/canvasTheme'
import { useThemeStore } from '../../stores/themeStore'

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
/*  Shape presets                                                       */
/* ------------------------------------------------------------------ */

const SHAPE_PRESETS: Record<string, Vec2[]> = {
  'Crescent': [{x:0,y:0.02},{x:0.2,y:0.28},{x:0.45,y:0.38},{x:0.7,y:0.22},{x:0.9,y:0.06},{x:1,y:0}],
  'Leaf':     [{x:0,y:0},{x:0.2,y:0.16},{x:0.5,y:0.24},{x:0.8,y:0.16},{x:1,y:0}],
  'Paddle':   [{x:0,y:0},{x:0.15,y:0.04},{x:0.4,y:0.32},{x:0.7,y:0.35},{x:0.85,y:0.32},{x:1,y:0.2}],
  'S-Wave':   [{x:0,y:0.05},{x:0.25,y:0.32},{x:0.45,y:0.18},{x:0.65,y:0.38},{x:0.85,y:0.22},{x:1,y:0.08}],
  'Scythe':   [{x:0,y:0},{x:0.12,y:0.42},{x:0.3,y:0.38},{x:0.55,y:0.22},{x:0.8,y:0.08},{x:1,y:0.02}],
  'Diamond':  [{x:0,y:0},{x:0.15,y:0.1},{x:0.5,y:0.4},{x:0.85,y:0.1},{x:1,y:0}],
}

/* ------------------------------------------------------------------ */
/*  Random shape generators                                             */
/* ------------------------------------------------------------------ */

type RandomStyle = 'aerodynamic' | 'crescent' | 's-curve' | 'paddle' | 'organic' | 'scythe'

function generateShape(style: RandomStyle): Vec2[] {
  const rnd = () => Math.random()

  switch (style) {
    case 'aerodynamic': {
      // NACA-style camber line: gradual rise then fall
      const c = 0.05 + rnd() * 0.13
      const p = 0.3 + rnd() * 0.3
      return [0, 0.18, 0.35, 0.5, 0.65, 0.82, 1.0].map(x => {
        const base = x < p
          ? c / (p * p) * (2 * p * x - x * x)
          : c / ((1 - p) * (1 - p)) * (1 - 2 * p + 2 * p * x - x * x)
        return { x, y: Math.max(0, Math.min(0.45, base + (rnd() - 0.5) * 0.015)) }
      })
    }

    case 'crescent': {
      // Sharp arc: rises fast, lingers high, drops off
      const peak = 0.18 + rnd() * 0.25
      const amp = 0.22 + rnd() * 0.22
      return [0, peak * 0.5, peak, peak * 1.6, 0.6, 0.8, 1.0].sort((a,b)=>a-b).map(x => ({
        x,
        y: Math.max(0, amp * Math.pow(Math.sin(Math.PI * Math.min(x / (peak * 2), 1)), 0.7)
          * (x < peak * 2 ? 1 : Math.exp(-(x - peak * 2) * 6))),
      }))
    }

    case 's-curve': {
      // Inflected camber: positive hump then negative valley (clamped to 0)
      const a1 = 0.12 + rnd() * 0.22
      const a2 = 0.08 + rnd() * 0.18
      const phase = rnd() * 0.5
      return [0, 0.15, 0.3, 0.5, 0.65, 0.82, 1.0].map(x => ({
        x,
        y: Math.max(0, Math.min(0.48,
          a1 * Math.sin(Math.PI * x + phase) + a2 * Math.sin(2.2 * Math.PI * x + 0.4),
        )),
      }))
    }

    case 'paddle': {
      // Widens past midpoint, rounded shoulder
      const shoulder = 0.28 + rnd() * 0.16
      const maxW = 0.28 + rnd() * 0.18
      return [0, 0.1, 0.3, 0.5, 0.7, 0.85, 1.0].map(x => ({
        x,
        y: Math.max(0, maxW * Math.sqrt(x) * (1 - Math.max(0, x - (0.55 + shoulder)) * 2.5)),
      }))
    }

    case 'organic': {
      // Random walk with momentum — naturalistic wiggly curve
      const nPts = 7 + Math.floor(rnd() * 4)
      const pts: Vec2[] = []
      let y = rnd() * 0.04
      let vel = 0.06 + rnd() * 0.06
      for (let i = 0; i < nPts; i++) {
        const x = i / (nPts - 1)
        vel += (rnd() - 0.48) * 0.08
        vel = Math.max(-0.12, Math.min(0.15, vel))
        y = Math.max(0, Math.min(0.46, y + vel))
        if (i === nPts - 1) y = y * 0.3  // taper tip
        pts.push({ x, y })
      }
      pts[0].y = rnd() * 0.04
      return pts
    }

    case 'scythe': {
      // Sharp early peak, long graceful decline
      const peak = 0.1 + rnd() * 0.2
      const amp = 0.32 + rnd() * 0.16
      return [0, peak * 0.6, peak, 0.4, 0.6, 0.8, 1.0].sort((a,b)=>a-b).map(x => ({
        x,
        y: Math.max(0, amp * (x < peak
          ? x / peak
          : Math.pow(1 - (x - peak) / (1 - peak), 1.4 + rnd() * 0.8))),
      }))
    }
  }
}

const RANDOM_STYLES: RandomStyle[] = ['aerodynamic', 'crescent', 's-curve', 'paddle', 'organic', 'scythe']
let _lastStyleIdx = -1

function nextRandomShape(): Vec2[] {
  // Cycle through styles so consecutive clicks always vary
  _lastStyleIdx = (_lastStyleIdx + 1) % RANDOM_STYLES.length
  return generateShape(RANDOM_STYLES[_lastStyleIdx])
}

/* ------------------------------------------------------------------ */
/*  Curve hover helper                                                  */
/* ------------------------------------------------------------------ */

interface CurveHit {
  /** Normalized coords of the closest point on the curve */
  normPt: Vec2
  /** Canvas-space coords of the closest point */
  canvasPt: Vec2
  /** Index at which to splice the new point into bladePoints */
  insertIdx: number
  dist: number
}

function findNearestOnCurve(
  mouse: Vec2,
  smooth: Vec2[],
  pts: Vec2[],
  cx: number, cy: number, radius: number,
): CurveHit | null {
  let minDist = Infinity
  let best: CurveHit | null = null

  for (let i = 0; i < smooth.length - 1; i++) {
    const ax = cx + smooth[i].x * radius
    const ay = cy + smooth[i].y * radius
    const bx = cx + smooth[i + 1].x * radius
    const by = cy + smooth[i + 1].y * radius

    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    if (len2 === 0) continue

    const t = Math.max(0, Math.min(1, ((mouse.x - ax) * dx + (mouse.y - ay) * dy) / len2))
    const px = ax + t * dx
    const py = ay + t * dy
    const dist = Math.sqrt((mouse.x - px) ** 2 + (mouse.y - py) ** 2)

    if (dist < minDist) {
      minDist = dist
      // Find insertion index in bladePoints (sorted by x of normalized coord)
      const normX = smooth[i].x + t * (smooth[i + 1].x - smooth[i].x)
      const normY = smooth[i].y + t * (smooth[i + 1].y - smooth[i].y)
      let insertIdx = pts.findIndex(p => p.x > normX)
      if (insertIdx === -1) insertIdx = pts.length
      best = {
        normPt: { x: Math.max(0, Math.min(1, normX)), y: Math.max(0, Math.min(0.5, normY)) },
        canvasPt: { x: px, y: py },
        insertIdx,
        dist,
      }
    }
  }

  return best && best.dist < 16 ? best : null
}

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

/** Tiny SVG thumbnail of a blade shape for the presets palette */
function ShapeThumb({ pts }: { pts: Vec2[] }) {
  if (pts.length < 2) return <span className="w-8 h-4 block" />
  const W = 32, H = 16
  const sorted = [...pts].sort((a, b) => a.x - b.x)
  const maxY = Math.max(...sorted.map(p => p.y), 0.01)
  const toSvg = (p: Vec2) => `${p.x * W},${H - p.y / maxY * H * 0.85 - 1}`
  const d = 'M ' + sorted.map(toSvg).join(' L ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 opacity-70">
      <path d={d} fill="none" stroke="#2dd4bf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Handle side: 'out' = forward tangent, 'in' = mirrored backward tangent
interface HandleDrag { index: number; side: 'out' | 'in' }

export default function KaleidoscopeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Cache theme colors — rebuilt only when theme toggles, not every frame
  const { theme: themeMode } = useThemeStore()
  const canvasThemeRef = useRef<CanvasTheme>(getCanvasTheme())
  useEffect(() => { canvasThemeRef.current = getCanvasTheme() }, [themeMode])

  const [isDrawing, setIsDrawing] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragHandle, setDragHandle] = useState<HandleDrag | null>(null)
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null)
  const selectedPointIdxRef = useRef<number | null>(null)
  selectedPointIdxRef.current = selectedPointIdx
  const animFrameRef = useRef<number>(0)
  const timeRef = useRef(0)
  const [showMiniPreview, setShowMiniPreview] = useState(true)
  const [showShapes, setShowShapes] = useState(false)
  const rawPointsRef = useRef<Vec2[]>([])
  const rawPixelPreviewRef = useRef<Vec2[]>([])
  const undoPushedRef = useRef(false)
  const mousePxRef = useRef<Vec2 | null>(null)
  // Stores the closest hit on the blade curve for insert-on-click
  const curveHoverRef = useRef<CurveHit | null>(null)

  const {
    bladePoints,
    setBladePoints,
    updateBladePoint,
    deleteBladePoint,
    bladeHandles,
    updateBladeHandle,
    resetBladeHandle,
    resetAllHandles,
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

  // Keyboard shortcuts for undo/redo + Escape to deselect
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
      } else if (e.key === 'Escape') {
        setSelectedPointIdx(null)
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

  // Returns cx, cy, radius in CSS pixels (matching what getCanvasCoords returns)
  const cssScale = (canvas: HTMLCanvasElement) => {
    const dpr = Math.min(window.devicePixelRatio, 2)
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(cx, cy) * 0.75
    return { cx, cy, radius }
  }

  const pixelToNormalized = useCallback((px: Vec2, canvas: HTMLCanvasElement): Vec2 => {
    const { cx, cy, radius } = cssScale(canvas)
    return {
      x: snapVal(Math.max(0, Math.min(1, (px.x - cx) / radius))),
      y: snapVal(Math.max(0, Math.min(0.5, Math.abs((px.y - cy) / radius)))),
    }
  }, [snapVal])

  const findNearestPoint = useCallback((px: Vec2, canvas: HTMLCanvasElement): number | null => {
    const { cx, cy, radius } = cssScale(canvas)
    const threshold = 18

    for (let i = 0; i < bladePoints.length; i++) {
      const pt = bladePoints[i]
      const worldX = cx + pt.x * radius
      const worldY = cy + pt.y * radius
      if (Math.hypot(px.x - worldX, px.y - worldY) < threshold) return i
    }
    return null
  }, [bladePoints])

  // Find nearest bezier handle endpoint — only checks selected point's handles to avoid accidental hits
  const findNearestHandle = useCallback((px: Vec2, canvas: HTMLCanvasElement): HandleDrag | null => {
    const { cx, cy, radius } = cssScale(canvas)
    const threshold = 14
    const handles = useTurbineStore.getState().bladeHandles
    const pts = useTurbineStore.getState().bladePoints
    const selIdx = selectedPointIdxRef.current

    // Only check handles for the selected point (or all if none selected, for hover)
    const idxRange = selIdx !== null ? [selIdx] : pts.map((_, i) => i)

    for (const i of idxRange) {
      const pt = pts[i]
      if (!pt) continue
      const worldX = cx + pt.x * radius
      const worldY = cy + pt.y * radius
      const h = handles[i] ?? { x: 0, y: 0 }
      const tang = (h.x !== 0 || h.y !== 0) ? h : crAutoTangent(pts, i)
      const ox = worldX + tang.x * radius
      const oy = worldY + tang.y * radius
      if (Math.hypot(px.x - ox, px.y - oy) < threshold) return { index: i, side: 'out' }
      const ix = worldX - tang.x * radius
      const iy = worldY - tang.y * radius
      if (Math.hypot(px.x - ix, px.y - iy) < threshold) return { index: i, side: 'in' }
    }
    return null
  }, [])

  // --- Freehand draw ---

  const handleDown = useCallback((px: Vec2) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Check bezier handle hit first (higher priority — only when a point is selected)
    const nearHandle = findNearestHandle(px, canvas)
    if (nearHandle !== null) {
      pushUndo()
      undoPushedRef.current = true
      setDragHandle(nearHandle)
      setSelectedPointIdx(nearHandle.index)
      return
    }

    const nearIdx = findNearestPoint(px, canvas)

    if (nearIdx !== null) {
      // Click on existing point: select it and start drag
      pushUndo()
      undoPushedRef.current = true
      setSelectedPointIdx(nearIdx)
      setDragIndex(nearIdx)
    } else if (curveHoverRef.current !== null) {
      // Click on curve → insert new point, select it, and immediately drag it
      pushUndo()
      undoPushedRef.current = true
      const { normPt, insertIdx } = curveHoverRef.current
      const newPts = [...useTurbineStore.getState().bladePoints]
      newPts.splice(insertIdx, 0, normPt)
      setBladePoints(newPts)
      setSelectedPointIdx(insertIdx)
      setDragIndex(insertIdx)
    } else {
      // Click on empty space: deselect + freehand draw
      setSelectedPointIdx(null)
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
  }, [findNearestPoint, findNearestHandle, pixelToNormalized, pushUndo, setBladePoints])

  const handleMove = useCallback((px: Vec2) => {
    const canvas = canvasRef.current
    if (!canvas) return
    mousePxRef.current = px

    if (dragHandle !== null) {
      const { cx, cy, radius } = cssScale(canvas)
      const pts = useTurbineStore.getState().bladePoints
      const pt = pts[dragHandle.index]
      if (!pt) return
      const worldX = cx + pt.x * radius
      const worldY = cy + pt.y * radius
      let dx = (px.x - worldX) / radius
      let dy = (px.y - worldY) / radius
      if (dragHandle.side === 'in') { dx = -dx; dy = -dy }
      updateBladeHandle(dragHandle.index, { x: dx, y: dy })
    } else if (dragIndex !== null) {
      const { cx, cy, radius } = cssScale(canvas)
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
    if (dragHandle !== null) {
      setDragHandle(null)
      undoPushedRef.current = false
      return
    }

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
  }, [isDrawing, dragHandle, setBladePoints])

  // Right-click: reset handle if near one, otherwise delete point
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const px = getCanvasCoords(e, canvas)
    if (!px) return
    // Check handle first
    const nearHandle = findNearestHandle(px, canvas)
    if (nearHandle !== null) {
      resetBladeHandle(nearHandle.index)
      return
    }
    const nearIdx = findNearestPoint(px, canvas)
    if (nearIdx !== null) deleteBladePoint(nearIdx)
  }, [getCanvasCoords, findNearestHandle, findNearestPoint, deleteBladePoint, resetBladeHandle])

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
        const { cx, cy, radius } = cssScale(canvas)
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
  const dragHandleRef = useRef(dragHandle)
  dragIndexRef.current = dragIndex
  isDrawingRef.current = isDrawing
  dragHandleRef.current = dragHandle

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

      const theme = canvasThemeRef.current
      ctx.clearRect(0, 0, w, h)

      // Background
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.4)
      bgGrad.addColorStop(0, theme.surface)
      bgGrad.addColorStop(0.7, theme.bg)
      bgGrad.addColorStop(1, theme.bg)
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      const store = useTurbineStore.getState()
      const { bladePoints: pts, bladeHandles: bHandles, bladeCount: bc, curveSmoothing: cs, snapToGrid: snap } = store

      // Snap grid dots
      if (snap) {
        ctx.fillStyle = theme.isLight ? `${theme.teal}28` : 'rgba(45, 212, 191, 0.06)'
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
      ctx.strokeStyle = theme.isLight ? `${theme.teal}30` : 'rgba(45, 212, 191, 0.08)'
      ctx.lineWidth = 1
      for (let r = 0.25; r <= 1; r += 0.25) {
        ctx.beginPath()
        ctx.arc(cx, cy, radius * r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Radial lines (one per blade)
      ctx.strokeStyle = theme.isLight ? `${theme.teal}22` : 'rgba(45, 212, 191, 0.06)'
      for (let i = 0; i < bc; i++) {
        const angle = (i / bc) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
        ctx.stroke()
      }

      if (pts.length >= 2) {
        const smooth = catmullRomSplineWithHandles(pts, bHandles, cs)

        // ── Curve hover detection ──────────────────────────────────────────
        const mpxHover = mousePxRef.current
        if (mpxHover && dragIndexRef.current === null && !isDrawingRef.current) {
          curveHoverRef.current = findNearestOnCurve(mpxHover, smooth, pts, cx, cy, radius)
        } else {
          curveHoverRef.current = null
        }

        // Update canvas cursor
        if (dragIndexRef.current !== null || dragHandleRef.current !== null) {
          canvas.style.cursor = 'grabbing'
        } else if (curveHoverRef.current !== null) {
          canvas.style.cursor = 'cell'
        } else {
          canvas.style.cursor = 'crosshair'
        }

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

          // ── Curve hover highlight (primary blade only) ────────────────────
          if (curveHoverRef.current && mirrored[0] && mirrored[0].length > 1) {
            const blade0 = mirrored[0]
            ctx.beginPath()
            ctx.moveTo(blade0[0].x, blade0[0].y)
            for (let i = 1; i < blade0.length; i++) ctx.lineTo(blade0[i].x, blade0[i].y)
            ctx.strokeStyle = 'rgba(251,191,36,0.4)'
            ctx.lineWidth = 10
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()
          }

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

        // ── Curve insert indicator ────────────────────────────────────────
        const hit = curveHoverRef.current
        if (hit) {
          const { canvasPt } = hit
          // Pulse glow
          const pulseR = 12 + Math.sin(timeRef.current * 5) * 2
          const glowGrad = ctx.createRadialGradient(canvasPt.x, canvasPt.y, 0, canvasPt.x, canvasPt.y, pulseR)
          glowGrad.addColorStop(0, 'rgba(251,191,36,0.35)')
          glowGrad.addColorStop(1, 'rgba(251,191,36,0)')
          ctx.beginPath()
          ctx.arc(canvasPt.x, canvasPt.y, pulseR, 0, Math.PI * 2)
          ctx.fillStyle = glowGrad
          ctx.fill()
          // Center dot
          ctx.beginPath()
          ctx.arc(canvasPt.x, canvasPt.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#fbbf24'
          ctx.fill()
          // + crosshair
          ctx.strokeStyle = '#fbbf24'
          ctx.lineWidth = 1.5
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(canvasPt.x - 7, canvasPt.y)
          ctx.lineTo(canvasPt.x + 7, canvasPt.y)
          ctx.moveTo(canvasPt.x, canvasPt.y - 7)
          ctx.lineTo(canvasPt.x, canvasPt.y + 7)
          ctx.stroke()
        }

        // ── Control points with hover effects ──────────────────────────────
        const mpx = mousePxRef.current
        const activeDragHandle = dragHandleRef.current

        // Determine which point is hovered (transient hover highlight)
        let hoveredPtIdx: number | null = null
        if (mpx) {
          for (let i = 0; i < pts.length; i++) {
            const wx = cx + pts[i].x * radius
            const wy = cy + pts[i].y * radius
            if (Math.hypot(mpx.x - wx, mpx.y - wy) < 32) { hoveredPtIdx = i; break }
          }
        }
        // Persistent selection takes priority; hover is secondary; dragging a handle keeps it visible
        const handleVisibleIdx = activeDragHandle !== null
          ? activeDragHandle.index
          : selectedPointIdxRef.current !== null
            ? selectedPointIdxRef.current
            : hoveredPtIdx

        // ── Draw bezier handle arms ────────────────────────────────────────
        if (handleVisibleIdx !== null && handleVisibleIdx < pts.length) {
          const pt = pts[handleVisibleIdx]
          const worldX = cx + pt.x * radius
          const worldY = cy + pt.y * radius
          const h = bHandles[handleVisibleIdx] ?? { x: 0, y: 0 }
          const tang = (h.x !== 0 || h.y !== 0) ? h : crAutoTangent(pts, handleVisibleIdx)
          const isCustom = h.x !== 0 || h.y !== 0

          const outX = worldX + tang.x * radius
          const outY = worldY + tang.y * radius
          const inX = worldX - tang.x * radius
          const inY = worldY - tang.y * radius

          // Arms
          ctx.setLineDash([3, 3])
          ctx.strokeStyle = isCustom ? 'rgba(167,139,250,0.7)' : 'rgba(100,116,139,0.45)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(inX, inY)
          ctx.lineTo(outX, outY)
          ctx.stroke()
          ctx.setLineDash([])

          // Out handle diamond
          const isOutDragged = activeDragHandle?.index === handleVisibleIdx && activeDragHandle?.side === 'out'
          const isInDragged  = activeDragHandle?.index === handleVisibleIdx && activeDragHandle?.side === 'in'
          const HR = 5

          for (const [hx, hy, isDragged] of [[outX, outY, isOutDragged], [inX, inY, isInDragged]] as [number, number, boolean][]) {
            ctx.save()
            ctx.translate(hx, hy)
            ctx.rotate(Math.PI / 4)
            ctx.beginPath()
            ctx.rect(-HR, -HR, HR * 2, HR * 2)
            ctx.fillStyle = isDragged ? '#fff' : isCustom ? 'rgba(167,139,250,0.9)' : 'rgba(148,163,184,0.7)'
            ctx.fill()
            ctx.strokeStyle = isDragged ? '#a78bfa' : isCustom ? '#a78bfa' : '#475569'
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.restore()
          }

          // "auto" label if using auto tangent
          if (!isCustom) {
            ctx.fillStyle = 'rgba(100,116,139,0.6)'
            ctx.font = '7px system-ui'
            ctx.textAlign = 'center'
            ctx.fillText('auto', worldX, worldY + 18)
            ctx.textAlign = 'left'
          }
        }

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

          // Selection ring (persistent) + hover ring
          const isSelected = selectedPointIdxRef.current === i
          if (isHovered || isDragged || isSelected) {
            ctx.beginPath()
            ctx.arc(worldX, worldY, dotR + 3, 0, Math.PI * 2)
            ctx.strokeStyle = isSelected
              ? (i === 0 ? 'rgba(251,191,36,0.8)' : 'rgba(167,139,250,0.8)')
              : (i === 0 ? 'rgba(251,191,36,0.5)' : 'rgba(45,212,191,0.5)')
            ctx.lineWidth = isSelected ? 1.5 : 1
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
        ctx.fillStyle = theme.isLight ? 'rgba(161,98,7,0.9)' : 'rgba(251,191,36,0.8)'
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

  const handleDice = useCallback(() => {
    pushUndo()
    setBladePoints(nextRandomShape())
    setShowShapes(false)
  }, [pushUndo, setBladePoints])

  const handlePreset = useCallback((pts: Vec2[]) => {
    pushUndo()
    setBladePoints([...pts])
    setShowShapes(false)
  }, [pushUndo, setBladePoints])

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
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
        <button
          onClick={resetAllHandles}
          title="Reset all bezier handles to auto"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all border border-border/40 bg-surface/80 backdrop-blur-sm hover:border-violet-400/40 hover:text-violet-400 text-text-dim"
        >
          ⟡
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-border/30 mx-0.5" />

        {/* Dice — random shape */}
        <button
          onClick={handleDice}
          title="Random shape (cycles through 6 generators)"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all border border-border/40 bg-surface/80 backdrop-blur-sm hover:border-amber-400/50 hover:text-amber-400 text-text-dim"
        >
          ⚄
        </button>

        {/* Shape presets palette */}
        <div className="relative">
          <button
            onClick={() => setShowShapes(v => !v)}
            title="Shape presets"
            className={`px-2 h-7 rounded-lg flex items-center gap-1 text-[10px] font-medium transition-all border backdrop-blur-sm ${
              showShapes
                ? 'border-violet-400/50 text-violet-400 bg-violet-400/10'
                : 'border-border/40 text-text-dim bg-surface/80 hover:border-violet-400/30 hover:text-violet-400'
            }`}
          >
            ◈ Shapes
          </button>

          {showShapes && (
            <div className="absolute bottom-9 left-0 bg-[#0d1220]/95 backdrop-blur-md border border-border/40 rounded-xl p-2 shadow-2xl flex flex-col gap-1 min-w-[120px]">
              <div className="text-[8px] uppercase tracking-widest text-text-muted px-1 pb-1">Presets</div>
              {Object.entries(SHAPE_PRESETS).map(([name, pts]) => (
                <button
                  key={name}
                  onClick={() => handlePreset(pts)}
                  className="text-left px-2 py-1 rounded-lg text-[10px] text-text-dim hover:text-teal hover:bg-teal/10 transition-colors flex items-center gap-2"
                >
                  <ShapeThumb pts={pts} />
                  {name}
                </button>
              ))}
              <div className="border-t border-border/20 my-1" />
              <div className="text-[8px] uppercase tracking-widest text-text-muted px-1 pb-0.5">Random styles</div>
              {RANDOM_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => { pushUndo(); setBladePoints(generateShape(style)); setShowShapes(false) }}
                  className="text-left px-2 py-1 rounded-lg text-[10px] text-text-dim hover:text-amber-400 hover:bg-amber-400/10 transition-colors capitalize"
                >
                  ⚄ {style}
                </button>
              ))}
            </div>
          )}
        </div>

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

    </div>
  )
}
