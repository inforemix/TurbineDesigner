import { useTurbineStore } from '../../stores/turbineStore'

// ── Tiny SVG side-view of blade sections ────────────────────────────────────
function SectionSideView() {
  const { bladeSections, twist } = useTurbineStore()

  const W = 200
  const H = 220
  const marginX = 28
  const marginY = 12

  // Sort root→tip
  const sorted = [...bladeSections].sort((a, b) => a.heightFraction - b.heightFraction)

  // Max taperScale for normalising the chord bars
  const maxScale = Math.max(...sorted.map(s => s.taperScale), 1.0)

  return (
    <svg width={W} height={H} className="mx-auto block">
      {/* Axis line */}
      <line
        x1={marginX} y1={marginY}
        x1End={marginX} y2={H - marginY}
        x2={marginX} y2={H - marginY}
        stroke="rgba(45,212,191,0.2)" strokeWidth={1}
      />

      {/* Height tick labels */}
      {sorted.map((sec, i) => {
        const y = marginY + (1 - sec.heightFraction) * (H - marginY * 2)
        return (
          <text key={i} x={2} y={y + 3.5} fontSize={7} fill="rgba(148,163,184,0.7)" textAnchor="start">
            {(sec.heightFraction * 100).toFixed(0)}%
          </text>
        )
      })}

      {/* Section chord bars */}
      {sorted.map((sec, i) => {
        const y   = marginY + (1 - sec.heightFraction) * (H - marginY * 2)
        const barW = (sec.taperScale / maxScale) * (W - marginX - 16)
        const twistVisual = (twist * sec.heightFraction + sec.twistOffset) * 0.35
        const isRoot = sec.heightFraction === 0
        const isTip  = sec.heightFraction === 1

        return (
          <g key={i} transform={`rotate(${twistVisual}, ${marginX}, ${y})`}>
            {/* Filled airfoil-like bar */}
            <rect
              x={marginX}
              y={y - 4}
              width={barW}
              height={8}
              rx={isTip ? 4 : isRoot ? 2 : 1}
              fill="rgba(45,212,191,0.18)"
              stroke="rgba(45,212,191,0.55)"
              strokeWidth={1.2}
            />
            {/* Leading-edge highlight dot */}
            <circle cx={marginX + 3} cy={y} r={2} fill="#2dd4bf" opacity={0.7} />
          </g>
        )
      })}

      {/* Connect centre-line dots root→tip */}
      {sorted.length >= 2 && (
        <polyline
          points={sorted.map(sec => {
            const y = marginY + (1 - sec.heightFraction) * (H - marginY * 2)
            return `${marginX},${y}`
          }).join(' ')}
          fill="none"
          stroke="rgba(45,212,191,0.3)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {/* Tip / Root labels */}
      <text x={marginX + 4} y={marginY - 2} fontSize={7} fill="rgba(148,163,184,0.5)">tip</text>
      <text x={marginX + 4} y={H - 2}       fontSize={7} fill="rgba(148,163,184,0.5)">root</text>
    </svg>
  )
}

// ── Inline slider row ────────────────────────────────────────────────────────
function MiniSlider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-text-muted w-9 shrink-0 uppercase tracking-wide">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-teal cursor-pointer"
      />
      <span className="text-[8px] font-mono text-teal w-8 text-right shrink-0">
        {value.toFixed(step < 1 ? 1 : 0)}{unit ?? ''}
      </span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BladeSectionStacker() {
  const {
    bladeSections,
    updateBladeSection,
    addBladeSection,
    removeBladeSection,
    loadSectionPreset,
    resetBladeSections,
  } = useTurbineStore()

  const sorted = [...bladeSections]
    .map((s, i) => ({ ...s, idx: i }))
    .sort((a, b) => a.heightFraction - b.heightFraction)

  const PRESETS = [
    { key: 'gorlov',      label: 'Gorlov',    title: 'Gorlov Helical – progressive twist 0→120°', color: 'bg-teal/15 border-teal/30 text-teal' },
    { key: 'troposkein',  label: 'Tropo',     title: 'Troposkein Darrieus – wide root & tip, narrow mid', color: 'bg-violet-500/15 border-violet-400/30 text-violet-300' },
    { key: 'self-starter',label: 'Self-start',title: 'Low-wind self-starting – twisted taper', color: 'bg-amber-500/15 border-amber-400/30 text-amber-300' },
    { key: 'straight',    label: 'H-Darrieus',title: 'Straight H-Darrieus – uniform chord', color: 'bg-surface/60 border-border/40 text-text-muted' },
  ] as const

  return (
    <div className="flex flex-col gap-4">

      {/* ── Section header ── */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
          Blade Sections
        </span>
        <button
          onClick={resetBladeSections}
          className="text-[9px] text-text-muted hover:text-amber-400 transition-colors px-1.5 py-0.5 rounded border border-border/40 hover:border-amber-400/30"
        >
          Reset
        </button>
      </div>

      {/* ── One-click presets ── */}
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.key}
            title={p.title}
            onClick={() => loadSectionPreset(p.key)}
            className={`px-2 py-1.5 rounded-lg text-[9px] font-semibold border transition-all hover:opacity-90 ${p.color}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Side-view preview ── */}
      <div className="rounded-xl border border-border/30 bg-surface/30 overflow-hidden pt-2 pb-1">
        <SectionSideView />
      </div>

      {/* ── Section rows (root first) ── */}
      <div className="flex flex-col gap-2">
        {sorted.map((sec) => {
          const heightPct = (sec.heightFraction * 100).toFixed(0)
          const label = sec.heightFraction === 0 ? 'Root'
            : sec.heightFraction === 1 ? 'Tip'
            : `${heightPct}%`
          return (
            <div
              key={sec.idx}
              className="rounded-xl border border-border/30 bg-surface/40 p-2.5 flex flex-col gap-1.5"
            >
              {/* Row header */}
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-semibold text-teal/80 uppercase tracking-wider">{label}</span>
                {bladeSections.length > 2 && sec.heightFraction !== 0 && sec.heightFraction !== 1 && (
                  <button
                    onClick={() => removeBladeSection(sec.idx)}
                    className="text-[9px] text-text-muted hover:text-red-400 transition-colors leading-none"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Height (editable for non-endpoint sections) */}
              {sec.heightFraction !== 0 && sec.heightFraction !== 1 && (
                <MiniSlider
                  label="Height" value={sec.heightFraction * 100} min={1} max={99} step={1} unit="%"
                  onChange={v => updateBladeSection(sec.idx, { heightFraction: v / 100 })}
                />
              )}

              {/* Chord scale */}
              <MiniSlider
                label="Chord" value={sec.taperScale} min={0.3} max={2.5} step={0.05} unit="×"
                onChange={v => updateBladeSection(sec.idx, { taperScale: v })}
              />

              {/* Twist offset */}
              <MiniSlider
                label="Twist" value={sec.twistOffset} min={-180} max={180} step={1} unit="°"
                onChange={v => updateBladeSection(sec.idx, { twistOffset: v })}
              />
            </div>
          )
        })}
      </div>

      {/* ── Add section ── */}
      <button
        onClick={addBladeSection}
        className="w-full py-1.5 rounded-lg border border-dashed border-teal/30 text-[9px] text-teal/60
          hover:border-teal/60 hover:text-teal transition-all font-semibold tracking-wide"
      >
        + Add Section
      </button>
    </div>
  )
}
