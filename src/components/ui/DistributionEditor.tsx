import { useRef, useState, useCallback } from 'react'
import type { Vec2 } from '../../stores/turbineStore'
import { useThemeStore } from '../../stores/themeStore'

interface Props {
  points: Vec2[]
  onChange: (pts: Vec2[]) => void
  yMin?: number
  yMax?: number
  color?: string
  colorLight?: string
  label?: string
}

const W = 160
const H = 64
const PAD = 8
const HIT = 7

function ptToSVG(pt: Vec2, yMin: number, yMax: number): [number, number] {
  const x = PAD + pt.x * (W - PAD * 2)
  const y = H - PAD - ((pt.y - yMin) / (yMax - yMin)) * (H - PAD * 2)
  return [x, y]
}

function svgToPt(svgX: number, svgY: number, yMin: number, yMax: number): Vec2 {
  const x = Math.max(0, Math.min(1, (svgX - PAD) / (W - PAD * 2)))
  const y = yMin + (1 - (svgY - PAD) / (H - PAD * 2)) * (yMax - yMin)
  return { x, y: Math.max(yMin, Math.min(yMax, y)) }
}

function clientToSVG(e: { clientX: number; clientY: number }, rect: DOMRect): [number, number] {
  return [
    (e.clientX - rect.left) * (W / rect.width),
    (e.clientY - rect.top) * (H / rect.height),
  ]
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
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const { theme } = useThemeStore()
  const isLight = theme === 'light'

  const accent = isLight ? (colorLight ?? color) : color
  const bgColor = isLight ? '#f8fafc' : '#0d1424'
  const borderColor = isLight ? '#e2e8f0' : 'none'
  const gridColor = isLight ? '#e2e8f0' : '#1e2844'
  const fillAlpha = isLight ? '28' : '18'

  // Build SVG coordinate pairs
  const coords = points.map(p => ptToSVG(p, yMin, yMax))
  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const fillPoints = coords.length >= 2
    ? [
        ...coords.map(([x, y]) => `${x},${y}`),
        `${coords[coords.length - 1][0]},${H - PAD}`,
        `${coords[0][0]},${H - PAD}`,
      ].join(' ')
    : ''

  const getHitIdx = useCallback((clientX: number, clientY: number): number => {
    const rect = svgRef.current!.getBoundingClientRect()
    const [sx, sy] = clientToSVG({ clientX, clientY }, rect)
    for (let i = 0; i < points.length; i++) {
      const [cx, cy] = ptToSVG(points[i], yMin, yMax)
      if (Math.hypot(sx - cx, sy - cy) <= HIT) return i
    }
    return -1
  }, [points, yMin, yMax])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const hit = getHitIdx(e.clientX, e.clientY)
    if (hit >= 0) {
      dragging.current = hit
      setDragIdx(hit)
      return
    }
    // Add point (max 4)
    if (points.length >= 4) return
    const rect = svgRef.current!.getBoundingClientRect()
    const [sx, sy] = clientToSVG(e, rect)
    const newPt = svgToPt(sx, sy, yMin, yMax)
    onChange([...points, newPt].sort((a, b) => a.x - b.x))
  }, [getHitIdx, points, yMin, yMax, onChange])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current === null) return
    const idx = dragging.current
    const rect = svgRef.current!.getBoundingClientRect()
    const [sx, sy] = clientToSVG(e, rect)
    const updated = svgToPt(sx, sy, yMin, yMax)
    const xMin = idx === 0 ? 0 : points[idx - 1].x + 0.05
    const xMax = idx === points.length - 1 ? 1 : points[idx + 1].x - 0.05
    const newPt: Vec2 = { x: Math.max(xMin, Math.min(xMax, updated.x)), y: updated.y }
    onChange(points.map((p, i) => (i === idx ? newPt : p)))
  }, [points, yMin, yMax, onChange])

  const onMouseUp = useCallback(() => {
    dragging.current = null
    setDragIdx(null)
  }, [])

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (points.length <= 2) return
    const hit = getHitIdx(e.clientX, e.clientY)
    if (hit >= 0) onChange(points.filter((_, i) => i !== hit))
  }, [getHitIdx, points, onChange])

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
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block', cursor: 'crosshair', borderRadius: 4 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onContextMenu={onContextMenu}
      >
        {/* Background */}
        <rect x={0} y={0} width={W} height={H} rx={4} fill={bgColor} />
        {isLight && <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={4} fill="none" stroke={borderColor} strokeWidth={1} />}

        {/* Grid lines */}
        {[0, 1, 2].map(i => {
          const gy = PAD + (i / 2) * (H - PAD * 2)
          return <line key={i} x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke={gridColor} strokeWidth={1} />
        })}

        {/* Fill area */}
        {fillPoints && (
          <polygon points={fillPoints} fill={accent + fillAlpha} />
        )}

        {/* Curve line */}
        {coords.length >= 2 && (
          <polyline
            points={linePoints}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Control point dots */}
        {coords.map(([cx, cy], i) => (
          <g key={i}>
            {/* Outer ring */}
            <circle cx={cx} cy={cy} r={5} fill={bgColor} />
            {/* Filled dot */}
            <circle
              cx={cx}
              cy={cy}
              r={4}
              fill={dragIdx === i ? (isLight ? '#0f172a' : '#ffffff') : accent}
              stroke={bgColor}
              strokeWidth={1}
            />
          </g>
        ))}
      </svg>
      <span className="text-[9px] text-muted-foreground text-center">
        Drag handles · Click to add · Right-click to remove
      </span>
    </div>
  )
}
