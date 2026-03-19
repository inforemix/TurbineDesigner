import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Line, Circle, Group, Text, Rect } from 'react-konva'
import { Bezier } from 'bezier-js'
import { generateNACA4, parseNACA4 } from '../../utils/airfoil'
import type { Point2D } from '../../utils/airfoil'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BezierAnchor {
  x: number
  y: number
}

export interface CubicSegment {
  p0: BezierAnchor // start anchor (shared with prev segment's p3)
  cp1: BezierAnchor // control-point leaving p0
  cp2: BezierAnchor // control-point entering p3
  p3: BezierAnchor // end anchor
}

export interface AirfoilBezierState {
  upper: CubicSegment[] // LE → TE  (left to right)
  lower: CubicSegment[] // LE → TE  (left to right)
}

export interface AirfoilExport {
  points: Point2D[]
  upperPoints: Point2D[]
  lowerPoints: Point2D[]
  segments: AirfoilBezierState
}

interface Props {
  width?: number
  height?: number
  onChange?: (data: AirfoilExport) => void
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PADDING = 60
const LUT_RESOLUTION = 150 // per segment → total = segments × resolution
const ANCHOR_RADIUS = 7
const CONTROL_RADIUS = 5

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Convert normalised airfoil coords (x 0→1, y ≈ -0.15→0.15) to canvas px */
function toCanvas(
  pt: BezierAnchor,
  w: number,
  h: number,
): { x: number; y: number } {
  const cx = PADDING + pt.x * (w - 2 * PADDING)
  const cy = h / 2 - pt.y * (w - 2 * PADDING) // y-up → y-down, scale same as x
  return { x: cx, y: cy }
}

/** Inverse: canvas px → normalised airfoil coords */
function fromCanvas(
  cx: number,
  cy: number,
  w: number,
  h: number,
): BezierAnchor {
  const span = w - 2 * PADDING
  const x = (cx - PADDING) / span
  const y = (h / 2 - cy) / span
  return { x, y }
}

/** Evaluate a CubicSegment into a list of {x,y} using bezier-js */
function evalSegment(seg: CubicSegment, nPts: number): Point2D[] {
  const b = new Bezier(
    seg.p0.x, seg.p0.y,
    seg.cp1.x, seg.cp1.y,
    seg.cp2.x, seg.cp2.y,
    seg.p3.x, seg.p3.y,
  )
  return b.getLUT(nPts) as Point2D[]
}

/** Build the full output point arrays from state */
function buildExport(state: AirfoilBezierState): AirfoilExport {
  const upperPts: Point2D[] = []
  for (const seg of state.upper) {
    const pts = evalSegment(seg, LUT_RESOLUTION)
    // skip first point of subsequent segments to avoid duplicates
    upperPts.push(...(upperPts.length ? pts.slice(1) : pts))
  }

  const lowerPts: Point2D[] = []
  for (const seg of state.lower) {
    const pts = evalSegment(seg, LUT_RESOLUTION)
    lowerPts.push(...(lowerPts.length ? pts.slice(1) : pts))
  }

  // combined: upper LE→TE then lower reversed TE→LE (closed polygon)
  const combined: Point2D[] = [...upperPts, ...[...lowerPts].reverse().slice(1)]

  return {
    points: combined,
    upperPoints: upperPts,
    lowerPoints: lowerPts,
    segments: state,
  }
}

/* ------------------------------------------------------------------ */
/*  Default NACA 2412 fit                                              */
/* ------------------------------------------------------------------ */

/** Fit cubic Bezier segments to a set of points using least-squares-ish heuristic */
function fitBezierToPoints(pts: Point2D[], numSegs: number): CubicSegment[] {
  if (pts.length < 2) return []
  const segments: CubicSegment[] = []
  const step = (pts.length - 1) / numSegs

  for (let i = 0; i < numSegs; i++) {
    const i0 = Math.round(i * step)
    const i3 = Math.round((i + 1) * step)
    const p0 = pts[i0]
    const p3 = pts[i3]

    // Choose control points at ~1/3 and 2/3 along the sub-segment,
    // with tangent direction estimated from neighbouring points.
    const i1 = Math.min(pts.length - 1, Math.round(i0 + step / 3))
    const i2 = Math.min(pts.length - 1, Math.round(i0 + (2 * step) / 3))

    // Use the actual curve points as guides, push controls toward them
    const cp1: BezierAnchor = {
      x: p0.x + (pts[i1].x - p0.x) * 1.5,
      y: p0.y + (pts[i1].y - p0.y) * 1.5,
    }
    const cp2: BezierAnchor = {
      x: p3.x + (pts[i2].x - p3.x) * 1.5,
      y: p3.y + (pts[i2].y - p3.y) * 1.5,
    }

    segments.push({ p0: { ...p0 }, cp1, cp2, p3: { ...p3 } })
  }

  // Iteratively refine control points to minimise error
  for (let iter = 0; iter < 8; iter++) {
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s]
      const i0 = Math.round(s * step)
      const i3 = Math.round((s + 1) * step)
      const subPts = pts.slice(i0, i3 + 1)
      if (subPts.length < 3) continue

      // Sample current bezier
      const current = evalSegment(seg, subPts.length - 1)

      // Compute error and nudge controls
      let errCp1X = 0, errCp1Y = 0
      let errCp2X = 0, errCp2Y = 0
      for (let j = 0; j < subPts.length; j++) {
        const t = j / (subPts.length - 1)
        const actual = subPts[j]
        const approx = current[j]
        if (!approx) continue
        const dx = actual.x - approx.x
        const dy = actual.y - approx.y
        // weight by basis function influence
        const w1 = 3 * t * (1 - t) * (1 - t) // B1 influence
        const w2 = 3 * t * t * (1 - t) // B2 influence
        errCp1X += dx * w1
        errCp1Y += dy * w1
        errCp2X += dx * w2
        errCp2Y += dy * w2
      }

      const scale = 1.2 / subPts.length
      seg.cp1.x += errCp1X * scale * 4
      seg.cp1.y += errCp1Y * scale * 4
      seg.cp2.x += errCp2X * scale * 4
      seg.cp2.y += errCp2Y * scale * 4
    }
  }

  return segments
}

function nacaToState(code: string, numSegsPerSurface = 3): AirfoilBezierState {
  const { m, p, t } = parseNACA4(code)
  const profile = generateNACA4(m, p, t, 120)

  const upper = fitBezierToPoints(profile.upper, numSegsPerSurface)
  const lower = fitBezierToPoints(profile.lower, numSegsPerSurface)

  // Ensure surfaces share LE and TE anchors exactly
  if (upper.length > 0 && lower.length > 0) {
    // LE: upper[0].p0 = lower[0].p0
    lower[0].p0 = { ...upper[0].p0 }
    // TE: upper[last].p3 = lower[last].p3
    lower[lower.length - 1].p3 = { ...upper[upper.length - 1].p3 }
  }

  return { upper, lower }
}

function makeDefaultState(): AirfoilBezierState {
  return nacaToState('2412', 3)
}

/* ------------------------------------------------------------------ */
/*  Freehand → Bezier conversion                                       */
/* ------------------------------------------------------------------ */

function simplifyRDP(points: Point2D[], epsilon: number): Point2D[] {
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
      dist =
        Math.abs(
          dy * points[i].x -
            dx * points[i].y +
            last.x * first.y -
            last.y * first.x,
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

function splitUpperLower(pts: Point2D[]): { upper: Point2D[]; lower: Point2D[] } {
  // Find the leftmost point (LE) and rightmost (TE)
  let leIdx = 0
  let teIdx = 0
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].x < pts[leIdx].x) leIdx = i
    if (pts[i].x > pts[teIdx].x) teIdx = i
  }

  // Walk from LE → TE along positive-y side (upper) and negative-y (lower)
  // Simple approach: split at LE, identify upper by y > camber line
  const upper: Point2D[] = []
  const lower: Point2D[] = []

  for (const pt of pts) {
    if (pt.y >= 0) upper.push(pt)
    else lower.push(pt)
  }

  // Sort upper by x ascending, lower by x ascending
  upper.sort((a, b) => a.x - b.x)
  lower.sort((a, b) => a.x - b.x)

  // Ensure both start at LE (x≈0) and end at TE (x≈1)
  if (upper.length > 0 && lower.length > 0) {
    // add shared endpoints
    const le: Point2D = { x: Math.min(upper[0].x, lower[0].x), y: 0 }
    const te: Point2D = {
      x: Math.max(upper[upper.length - 1].x, lower[lower.length - 1].x),
      y: 0,
    }
    if (upper[0].x > le.x + 0.01) upper.unshift(le)
    if (lower[0].x > le.x + 0.01) lower.unshift(le)
    if (upper[upper.length - 1].x < te.x - 0.01) upper.push(te)
    if (lower[lower.length - 1].x < te.x - 0.01) lower.push(te)
  }

  return { upper, lower }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type DragTarget =
  | { surface: 'upper' | 'lower'; segIdx: number; point: 'p0' | 'cp1' | 'cp2' | 'p3' }
  | null

export default function AirfoilBezierEditor({
  width: propWidth,
  height: propHeight,
  onChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: propWidth ?? 800, h: propHeight ?? 450 })
  const [state, setState] = useState<AirfoilBezierState>(makeDefaultState)
  const [freehandPts, setFreehandPts] = useState<Point2D[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawMode, setDrawMode] = useState(false)

  // Responsive sizing
  useEffect(() => {
    if (propWidth && propHeight) {
      setDims({ w: propWidth, h: propHeight })
      return
    }
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width: ew, height: eh } = entries[0].contentRect
      if (ew > 0 && eh > 0) setDims({ w: ew, h: eh })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [propWidth, propHeight])

  const { w, h } = dims

  // Fire onChange whenever state changes
  const exportData = useMemo(() => buildExport(state), [state])
  useEffect(() => {
    onChange?.(exportData)
  }, [exportData, onChange])

  /* ---- Drag handling ---- */

  const updatePoint = useCallback(
    (target: NonNullable<DragTarget>, nx: number, ny: number) => {
      setState((prev) => {
        const next = {
          upper: prev.upper.map((s) => ({ ...s, p0: { ...s.p0 }, cp1: { ...s.cp1 }, cp2: { ...s.cp2 }, p3: { ...s.p3 } })),
          lower: prev.lower.map((s) => ({ ...s, p0: { ...s.p0 }, cp1: { ...s.cp1 }, cp2: { ...s.cp2 }, p3: { ...s.p3 } })),
        }
        const segs = next[target.surface]
        const seg = segs[target.segIdx]
        seg[target.point] = { x: nx, y: ny }

        // Keep shared anchors in sync between adjacent segments
        if (target.point === 'p0' && target.segIdx > 0) {
          segs[target.segIdx - 1].p3 = { x: nx, y: ny }
        }
        if (target.point === 'p3' && target.segIdx < segs.length - 1) {
          segs[target.segIdx + 1].p0 = { x: nx, y: ny }
        }

        // Sync LE (first anchor) between upper and lower
        if (target.point === 'p0' && target.segIdx === 0) {
          const other = target.surface === 'upper' ? next.lower : next.upper
          if (other.length > 0) other[0].p0 = { x: nx, y: ny }
        }
        // Sync TE (last anchor)
        if (
          target.point === 'p3' &&
          target.segIdx === segs.length - 1
        ) {
          const other = target.surface === 'upper' ? next.lower : next.upper
          if (other.length > 0) other[other.length - 1].p3 = { x: nx, y: ny }
        }

        return next
      })
    },
    [],
  )

  /* ---- Render curves as Konva Lines ---- */

  const upperLinePts = useMemo(() => {
    const pts: number[] = []
    for (const seg of state.upper) {
      const lut = evalSegment(seg, LUT_RESOLUTION)
      for (const p of lut) {
        const c = toCanvas(p, w, h)
        pts.push(c.x, c.y)
      }
    }
    return pts
  }, [state.upper, w, h])

  const lowerLinePts = useMemo(() => {
    const pts: number[] = []
    for (const seg of state.lower) {
      const lut = evalSegment(seg, LUT_RESOLUTION)
      for (const p of lut) {
        const c = toCanvas(p, w, h)
        pts.push(c.x, c.y)
      }
    }
    return pts
  }, [state.lower, w, h])

  /* ---- Actions ---- */

  const fitNACA = useCallback((code: string) => {
    setState(nacaToState(code, 3))
    setDrawMode(false)
    setFreehandPts([])
  }, [])

  const addSegment = useCallback((surface: 'upper' | 'lower') => {
    setState((prev) => {
      const next = {
        upper: prev.upper.map((s) => ({ ...s, p0: { ...s.p0 }, cp1: { ...s.cp1 }, cp2: { ...s.cp2 }, p3: { ...s.p3 } })),
        lower: prev.lower.map((s) => ({ ...s, p0: { ...s.p0 }, cp1: { ...s.cp1 }, cp2: { ...s.cp2 }, p3: { ...s.p3 } })),
      }
      const segs = next[surface]
      if (segs.length === 0) return prev

      // Split the last segment at midpoint
      const last = segs[segs.length - 1]
      const b = new Bezier(
        last.p0.x, last.p0.y,
        last.cp1.x, last.cp1.y,
        last.cp2.x, last.cp2.y,
        last.p3.x, last.p3.y,
      )
      const split = b.split(0.5)

      const left = split.left
      const right = split.right

      segs[segs.length - 1] = {
        p0: { x: left.points[0].x, y: left.points[0].y },
        cp1: { x: left.points[1].x, y: left.points[1].y },
        cp2: { x: left.points[2].x, y: left.points[2].y },
        p3: { x: left.points[3].x, y: left.points[3].y },
      }
      segs.push({
        p0: { x: right.points[0].x, y: right.points[0].y },
        cp1: { x: right.points[1].x, y: right.points[1].y },
        cp2: { x: right.points[2].x, y: right.points[2].y },
        p3: { x: right.points[3].x, y: right.points[3].y },
      })

      return next
    })
  }, [])

  /* ---- Freehand draw ---- */

  const handleStageMouseDown = useCallback(
    (e: { evt: MouseEvent | TouchEvent }) => {
      if (!drawMode) return
      setIsDrawing(true)
      const stage = e.evt.target as HTMLElement
      const rect = stage.closest('canvas')?.getBoundingClientRect()
      if (!rect) return
      const clientX = 'touches' in e.evt ? e.evt.touches[0].clientX : e.evt.clientX
      const clientY = 'touches' in e.evt ? e.evt.touches[0].clientY : e.evt.clientY
      const pt = fromCanvas(clientX - rect.left, clientY - rect.top, w, h)
      setFreehandPts([pt])
    },
    [drawMode, w, h],
  )

  const handleStageMouseMove = useCallback(
    (e: { evt: MouseEvent | TouchEvent }) => {
      if (!isDrawing || !drawMode) return
      const stage = e.evt.target as HTMLElement
      const rect = stage.closest('canvas')?.getBoundingClientRect()
      if (!rect) return
      const clientX = 'touches' in e.evt ? e.evt.touches[0].clientX : e.evt.clientX
      const clientY = 'touches' in e.evt ? e.evt.touches[0].clientY : e.evt.clientY
      const pt = fromCanvas(clientX - rect.left, clientY - rect.top, w, h)
      setFreehandPts((prev) => [...prev, pt])
    },
    [isDrawing, drawMode, w, h],
  )

  const handleStageMouseUp = useCallback(() => {
    if (!isDrawing || !drawMode) return
    setIsDrawing(false)

    if (freehandPts.length < 5) return

    // Simplify freehand points
    const simplified = simplifyRDP(freehandPts, 0.005)
    const { upper, lower } = splitUpperLower(simplified)

    const numSegs = 3
    const upperSegs = upper.length >= 2 ? fitBezierToPoints(upper, numSegs) : state.upper
    const lowerSegs = lower.length >= 2 ? fitBezierToPoints(lower, numSegs) : state.lower

    // Sync endpoints
    if (upperSegs.length > 0 && lowerSegs.length > 0) {
      lowerSegs[0].p0 = { ...upperSegs[0].p0 }
      lowerSegs[lowerSegs.length - 1].p3 = { ...upperSegs[upperSegs.length - 1].p3 }
    }

    setState({ upper: upperSegs, lower: lowerSegs })
    setFreehandPts([])
    setDrawMode(false)
  }, [isDrawing, drawMode, freehandPts, state])

  /* ---- Render control handles for a surface ---- */

  const renderHandles = useCallback(
    (surface: 'upper' | 'lower', segs: CubicSegment[]) => {
      const elements: ReactNode[] = []

      segs.forEach((seg, si) => {
        const pts: Array<{ key: string; point: 'p0' | 'cp1' | 'cp2' | 'p3'; anchor: BezierAnchor; isControl: boolean }> = []

        // Only draw p0 for first segment (otherwise it's prev segment's p3)
        if (si === 0) {
          pts.push({ key: `${surface}-${si}-p0`, point: 'p0', anchor: seg.p0, isControl: false })
        }
        pts.push({ key: `${surface}-${si}-cp1`, point: 'cp1', anchor: seg.cp1, isControl: true })
        pts.push({ key: `${surface}-${si}-cp2`, point: 'cp2', anchor: seg.cp2, isControl: true })
        pts.push({ key: `${surface}-${si}-p3`, point: 'p3', anchor: seg.p3, isControl: false })

        // Draw handle lines (anchor→control)
        const p0c = toCanvas(seg.p0, w, h)
        const cp1c = toCanvas(seg.cp1, w, h)
        const cp2c = toCanvas(seg.cp2, w, h)
        const p3c = toCanvas(seg.p3, w, h)

        elements.push(
          <Line
            key={`${surface}-${si}-line-cp1`}
            points={[p0c.x, p0c.y, cp1c.x, cp1c.y]}
            stroke="#4a90d9"
            strokeWidth={1}
            dash={[4, 3]}
            opacity={0.6}
          />,
          <Line
            key={`${surface}-${si}-line-cp2`}
            points={[p3c.x, p3c.y, cp2c.x, cp2c.y]}
            stroke="#4a90d9"
            strokeWidth={1}
            dash={[4, 3]}
            opacity={0.6}
          />,
        )

        // Draw draggable circles
        for (const { key, point, anchor, isControl } of pts) {
          const canvasPos = toCanvas(anchor, w, h)
          elements.push(
            <Circle
              key={key}
              x={canvasPos.x}
              y={canvasPos.y}
              radius={isControl ? CONTROL_RADIUS : ANCHOR_RADIUS}
              fill={isControl ? '#4a90d9' : '#e74c3c'}
              stroke={isControl ? '#2a6cb8' : '#c0392b'}
              strokeWidth={1.5}
              draggable
              onDragMove={(e) => {
                const node = e.target
                const norm = fromCanvas(node.x(), node.y(), w, h)
                updatePoint({ surface, segIdx: si, point }, norm.x, norm.y)
              }}
              shadowColor={isControl ? '#4a90d9' : '#e74c3c'}
              shadowBlur={6}
              shadowOpacity={0.4}
              hitStrokeWidth={10}
            />,
          )
        }
      })

      return elements
    },
    [w, h, updatePoint],
  )

  /* ---- Grid / chord line ---- */

  const gridLines = useMemo(() => {
    const lines: ReactNode[] = []
    // Chord line (y=0)
    const le = toCanvas({ x: 0, y: 0 }, w, h)
    const te = toCanvas({ x: 1, y: 0 }, w, h)
    lines.push(
      <Line
        key="chord"
        points={[le.x, le.y, te.x, te.y]}
        stroke="#666"
        strokeWidth={1}
        dash={[8, 4]}
        opacity={0.4}
      />,
    )

    // Vertical gridlines at 0, 0.25, 0.5, 0.75, 1.0
    for (const xf of [0, 0.25, 0.5, 0.75, 1.0]) {
      const top = toCanvas({ x: xf, y: 0.25 }, w, h)
      const bot = toCanvas({ x: xf, y: -0.25 }, w, h)
      lines.push(
        <Line
          key={`vgrid-${xf}`}
          points={[top.x, top.y, bot.x, bot.y]}
          stroke="#555"
          strokeWidth={0.5}
          opacity={0.2}
        />,
      )
      lines.push(
        <Text
          key={`vlabel-${xf}`}
          x={top.x - 8}
          y={bot.y + 4}
          text={xf.toFixed(2)}
          fontSize={9}
          fill="#888"
          opacity={0.6}
        />,
      )
    }

    // Horizontal gridlines
    for (const yf of [-0.15, -0.1, -0.05, 0.05, 0.1, 0.15]) {
      const left = toCanvas({ x: 0, y: yf }, w, h)
      const right = toCanvas({ x: 1, y: yf }, w, h)
      lines.push(
        <Line
          key={`hgrid-${yf}`}
          points={[left.x, left.y, right.x, right.y]}
          stroke="#555"
          strokeWidth={0.5}
          opacity={0.15}
        />,
      )
    }

    return lines
  }, [w, h])

  /* ---- Freehand preview line ---- */

  const freehandLine = useMemo(() => {
    if (freehandPts.length < 2) return null
    const pts: number[] = []
    for (const p of freehandPts) {
      const c = toCanvas(p, w, h)
      pts.push(c.x, c.y)
    }
    return pts
  }, [freehandPts, w, h])

  /* ---- Point count display ---- */

  const totalPoints = exportData.points.length

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative flex flex-col"
      style={{ minHeight: 350 }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border flex-wrap">
        <button
          onClick={() => addSegment('upper')}
          className="px-3 py-1.5 text-xs font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
        >
          + Upper Seg
        </button>
        <button
          onClick={() => addSegment('lower')}
          className="px-3 py-1.5 text-xs font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
        >
          + Lower Seg
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={() => fitNACA('2412')}
          className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
        >
          Fit NACA 2412
        </button>
        <button
          onClick={() => fitNACA('0012')}
          className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
        >
          Fit NACA 0012
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={() => setDrawMode(!drawMode)}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
            drawMode
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20'
          }`}
        >
          {drawMode ? 'Drawing...' : 'Freehand Draw'}
        </button>

        <div className="flex-1" />

        <span className="text-[10px] text-muted-foreground tabular-nums">
          {totalPoints} pts &middot; {state.upper.length}+{state.lower.length} segs
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <Stage
          width={w}
          height={h - 44}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onTouchStart={handleStageMouseDown}
          onTouchMove={handleStageMouseMove}
          onTouchEnd={handleStageMouseUp}
          style={{ cursor: drawMode ? 'crosshair' : 'default' }}
        >
          <Layer>
            {/* Background */}
            <Rect
              x={0}
              y={0}
              width={w}
              height={h - 44}
              fill="#0d1117"
            />

            {/* Grid */}
            {gridLines}

            {/* Labels */}
            <Text
              x={toCanvas({ x: 0, y: 0 }, w, h).x - 10}
              y={toCanvas({ x: 0, y: 0 }, w, h).y - 18}
              text="LE"
              fontSize={11}
              fill="#888"
              fontStyle="bold"
            />
            <Text
              x={toCanvas({ x: 1, y: 0 }, w, h).x - 5}
              y={toCanvas({ x: 1, y: 0 }, w, h).y - 18}
              text="TE"
              fontSize={11}
              fill="#888"
              fontStyle="bold"
            />

            {/* Airfoil filled region */}
            <Line
              points={[...upperLinePts, ...([...Array(lowerLinePts.length / 2)].map((_, i) => [
                lowerLinePts[lowerLinePts.length - 2 - i * 2],
                lowerLinePts[lowerLinePts.length - 1 - i * 2],
              ]).flat())]}
              closed
              fill="#2dd4bf"
              opacity={0.06}
            />

            {/* Upper surface */}
            <Line
              points={upperLinePts}
              stroke="#2dd4bf"
              strokeWidth={2.5}
              lineCap="round"
              lineJoin="round"
              tension={0}
            />

            {/* Lower surface */}
            <Line
              points={lowerLinePts}
              stroke="#f97316"
              strokeWidth={2.5}
              lineCap="round"
              lineJoin="round"
              tension={0}
            />

            {/* Freehand preview */}
            {freehandLine && (
              <Line
                points={freehandLine}
                stroke="#fbbf24"
                strokeWidth={1.5}
                lineCap="round"
                lineJoin="round"
                dash={[3, 3]}
                opacity={0.8}
              />
            )}

            {/* Control handles */}
            <Group>
              {renderHandles('upper', state.upper)}
              {renderHandles('lower', state.lower)}
            </Group>
          </Layer>
        </Stage>

        {/* Draw-mode overlay hint */}
        {drawMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 rounded-full px-4 py-1.5 text-xs text-amber-300 pointer-events-none">
            Draw airfoil shape, release to auto-fit Bezier curves
          </div>
        )}
      </div>
    </div>
  )
}
