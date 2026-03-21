import { useRef, useCallback, useState } from 'react'
import { useTurbineStore } from '../../stores/turbineStore'
import { useThemeStore } from '../../stores/themeStore'

/* ── Drag-based compact knob/slider ─────────────────────────────────────────
   Click to focus, then drag left/right (or use scroll) to change value.
   Shows an arc-fill progress indicator.
 */
interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  color?: string
  format?: (v: number) => string
  onChange: (v: number) => void
  isLight?: boolean
}

function Knob({ label, value, min, max, step, unit = '', color = '#2dd4bf', format, onChange, isLight }: KnobProps) {
  const dragging = useRef(false)
  const startX = useRef(0)
  const startVal = useRef(value)
  const [focused, setFocused] = useState(false)

  const clamp = useCallback((v: number) => Math.round(Math.max(min, Math.min(max, v)) / step) * step, [min, max, step])
  const pct = (value - min) / (max - min)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startVal.current = value
    setFocused(true)

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const dx = ev.clientX - startX.current
      const range = max - min
      const delta = (dx / 120) * range
      onChange(clamp(startVal.current + delta))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [value, min, max, clamp, onChange])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? step : -step
    onChange(clamp(value + delta))
  }, [value, step, clamp, onChange])

  // SVG arc progress
  const R = 18
  const circumference = Math.PI * R // half-circle arc
  const arcLen = pct * circumference

  const displayVal = format ? format(value) : `${Number.isInteger(step) ? Math.round(value) : value.toFixed(1)}${unit}`

  const arcBgStroke = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)'
  const labelColor = isLight ? '#64748b' : '#64748b'
  const labelHoverColor = isLight ? '#334155' : '#94a3b8'

  return (
    <div
      className="flex flex-col items-center gap-1 select-none cursor-ew-resize group"
      style={{ width: 56 }}
      onMouseDown={onMouseDown}
      onWheel={onWheel}
      onMouseLeave={() => !dragging.current && setFocused(false)}
    >
      {/* Arc progress ring */}
      <div className="relative" style={{ width: 40, height: 24 }}>
        <svg width={40} height={24} viewBox="0 0 40 24" style={{ overflow: 'visible' }}>
          {/* Background arc */}
          <path
            d="M 4 22 A 16 16 0 0 1 36 22"
            fill="none"
            stroke={arcBgStroke}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d="M 4 22 A 16 16 0 0 1 36 22"
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circumference}`}
            style={{
              transition: dragging.current ? 'none' : 'stroke-dasharray 0.15s ease',
              opacity: focused || pct > 0.01 ? 1 : 0.4,
            }}
          />
          {/* Thumb dot */}
          {(() => {
            const angle = Math.PI + pct * Math.PI // 0° to 180° sweep
            const tx = 20 + R * Math.cos(angle)
            const ty = 22 + R * Math.sin(angle)
            return (
              <circle
                cx={tx}
                cy={ty}
                r={3}
                fill={color}
                style={{ filter: focused ? `drop-shadow(0 0 4px ${color})` : 'none' }}
              />
            )
          })()}
        </svg>

        {/* Center value */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-0"
          style={{ pointerEvents: 'none' }}
        >
          <span
            className="text-[10px] font-mono font-bold leading-none"
            style={{ color, textShadow: focused ? `0 0 8px ${color}` : 'none' }}
          >
            {displayVal}
          </span>
        </div>
      </div>

      {/* Label */}
      <span
        className="text-[8px] uppercase tracking-widest font-medium transition-colors"
        style={{ color: labelColor }}
        onMouseEnter={e => (e.currentTarget.style.color = labelHoverColor)}
        onMouseLeave={e => (e.currentTarget.style.color = labelColor)}
      >
        {label}
      </span>
    </div>
  )
}

/* ── Blade count selector ─────────────────────────────────────────────────── */
function BladeCountSelector({ isLight }: { isLight: boolean }) {
  const { bladeCount, setBladeCount } = useTurbineStore()

  const teal = isLight ? '#0d9488' : '#2dd4bf'
  const tealBg = isLight ? 'rgba(13,148,136,0.15)' : 'rgba(45,212,191,0.2)'
  const tealBorder = isLight ? 'rgba(13,148,136,0.4)' : 'rgba(45,212,191,0.5)'
  const tealShadow = isLight ? '0 0 8px rgba(13,148,136,0.15)' : '0 0 8px rgba(45,212,191,0.2)'
  const inactiveColor = isLight ? '#64748b' : '#475569'
  const inactiveBorder = isLight ? 'rgba(100,116,139,0.35)' : 'rgba(71,85,105,0.3)'
  const labelColor = isLight ? '#64748b' : '#64748b'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {[2, 3, 4, 5, 6].map(n => (
          <button
            key={n}
            onClick={() => setBladeCount(n)}
            className="w-6 h-6 rounded-md text-[10px] font-bold transition-all border"
            style={bladeCount === n
              ? { background: tealBg, color: teal, borderColor: tealBorder, boxShadow: tealShadow }
              : { background: 'transparent', color: inactiveColor, borderColor: inactiveBorder }
            }
          >
            {n}
          </button>
        ))}
      </div>
      <span className="text-[8px] uppercase tracking-widest font-medium" style={{ color: labelColor }}>Blades</span>
    </div>
  )
}

/* ── Symmetry mode selector ───────────────────────────────────────────────── */
const SYMMETRY_ICONS: Record<string, string> = {
  pinwheel: '⟳', helix: '⤢', snowflake: '❄', freeform: '∿',
}

function SymmSelector({ isLight }: { isLight: boolean }) {
  const { symmetryMode, setSymmetryMode } = useTurbineStore()
  const modes = ['pinwheel', 'helix', 'snowflake', 'freeform'] as const

  const violet = isLight ? '#7c3aed' : '#a78bfa'
  const violetBg = isLight ? 'rgba(124,58,237,0.12)' : 'rgba(167,139,250,0.2)'
  const violetBorder = isLight ? 'rgba(124,58,237,0.35)' : 'rgba(167,139,250,0.5)'
  const violetShadow = isLight ? '0 0 8px rgba(124,58,237,0.1)' : '0 0 8px rgba(167,139,250,0.15)'
  const inactiveColor = isLight ? '#64748b' : '#475569'
  const inactiveBorder = isLight ? 'rgba(100,116,139,0.35)' : 'rgba(71,85,105,0.3)'
  const labelColor = isLight ? '#64748b' : '#64748b'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {modes.map(m => (
          <button
            key={m}
            onClick={() => setSymmetryMode(m)}
            title={m}
            className="w-6 h-6 rounded-md text-[11px] transition-all border"
            style={symmetryMode === m
              ? { background: violetBg, color: violet, borderColor: violetBorder, boxShadow: violetShadow }
              : { background: 'transparent', color: inactiveColor, borderColor: inactiveBorder }
            }
          >
            {SYMMETRY_ICONS[m]}
          </button>
        ))}
      </div>
      <span className="text-[8px] uppercase tracking-widest font-medium" style={{ color: labelColor }}>Symm</span>
    </div>
  )
}

/* ── Divider ──────────────────────────────────────────────────────────────── */
function Div({ isLight }: { isLight: boolean }) {
  return (
    <div
      className="w-px self-stretch"
      style={{ background: isLight ? 'rgba(13,148,136,0.18)' : 'rgba(45,212,191,0.07)' }}
    />
  )
}

/* ── Main CentralController ───────────────────────────────────────────────── */
export default function CentralController() {
  const {
    twist, setTwist,
    taper, setTaper,
    height, setHeight,
    curveSmoothing, setCurveSmoothing,
  } = useTurbineStore()
  const { theme } = useThemeStore()
  const isLight = theme === 'light'

  const [collapsed, setCollapsed] = useState(false)

  const panelBg = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(8,12,22,0.96)'
  const panelBorder = isLight ? '1px solid rgba(13,148,136,0.25)' : '1px solid rgba(45,212,191,0.12)'
  const panelShadow = isLight
    ? '0 4px 24px rgba(0,0,0,0.1), 0 0 32px rgba(13,148,136,0.06)'
    : '0 4px 32px rgba(0,0,0,0.5), 0 0 40px rgba(45,212,191,0.03)'

  const pillBg = isLight ? 'rgba(248,250,252,0.92)' : 'rgba(10,14,26,0.8)'
  const pillColor = isLight ? 'rgba(13,148,136,0.85)' : 'rgba(45,212,191,0.4)'
  const pillBorder = isLight ? '1px solid rgba(13,148,136,0.22)' : '1px solid rgba(45,212,191,0.1)'

  const tealColor = isLight ? '#0d9488' : '#2dd4bf'
  const tealGlow = isLight ? '#2dd4bf' : '#5eead4'
  const violetColor = isLight ? '#7c3aed' : '#a78bfa'
  const indigoColor = isLight ? '#4f46e5' : '#818cf8'

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-1 max-w-[calc(100vw-1rem)]">
      {/* Toggle pill */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="px-3 py-0.5 rounded-full text-[8px] uppercase tracking-widest font-semibold transition-all"
        style={{ background: pillBg, color: pillColor, border: pillBorder }}
      >
        {collapsed ? '▴ controls' : '▾ controls'}
      </button>

      {/* Main controller panel */}
      {!collapsed && (
        <div
          className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3 rounded-2xl overflow-x-auto"
          style={{
            background: panelBg,
            border: panelBorder,
            boxShadow: panelShadow,
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Blade count */}
          <BladeCountSelector isLight={isLight} />

          <Div isLight={isLight} />

          {/* Symmetry */}
          <SymmSelector isLight={isLight} />

          <Div isLight={isLight} />

          {/* Twist knob */}
          <Knob
            label="Twist"
            value={twist}
            min={-45} max={45} step={1}
            unit="°"
            color={tealColor}
            onChange={setTwist}
            isLight={isLight}
          />

          {/* Taper knob */}
          <Knob
            label="Taper"
            value={Math.round(taper * 100)}
            min={0} max={80} step={5}
            color={tealGlow}
            format={v => `${v}%`}
            onChange={v => setTaper(v / 100)}
            isLight={isLight}
          />

          <Div isLight={isLight} />

          {/* Height knob */}
          <Knob
            label="Height"
            value={height}
            min={0.5} max={3} step={0.1}
            unit="m"
            color={violetColor}
            onChange={setHeight}
            isLight={isLight}
          />

          {/* Smoothing knob */}
          <Knob
            label="Smooth"
            value={curveSmoothing}
            min={2} max={20} step={1}
            color={indigoColor}
            onChange={setCurveSmoothing}
            isLight={isLight}
          />
        </div>
      )}
    </div>
  )
}
