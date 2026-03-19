/**
 * NacaPanel — NACA airfoil preset browser + custom NACA 4-digit input.
 * Shows a miniature SVG preview of the selected profile.
 * Placed in the left sidebar (PresetBrowser area) in "draw" mode.
 */
import { useState, useMemo } from 'react'
import { generateNACA4, parseNACA4, AIRFOIL_PRESETS } from '../../utils/airfoil'
import { Label } from './label'
import { Button } from './button'
import { Badge } from './badge'
import { Separator } from './separator'
import { useTurbineStore } from '../../stores/turbineStore'

function AirfoilPreview({ code }: { code: string }) {
  const profile = useMemo(() => {
    const { m, p, t } = parseNACA4(code)
    return generateNACA4(m, p, t, 40)
  }, [code])

  const W = 100
  const H = 40
  const pad = 4

  // Build SVG path from combined polygon (normalized 0–1 x, ±0.15 y typically)
  const toSvg = (pts: { x: number; y: number }[]) =>
    pts
      .map((p, i) => {
        const sx = pad + p.x * (W - 2 * pad)
        const sy = H / 2 - p.y * (H - 2 * pad) * 3
        return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`
      })
      .join(' ') + ' Z'

  return (
    <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
      <path
        d={toSvg(profile.combined)}
        fill="rgba(45,212,191,0.15)"
        stroke="#2dd4bf"
        strokeWidth="1"
      />
      {/* camber line */}
      <path
        d={
          profile.upper
            .map((u, i) => {
              const l = profile.lower[i]
              const cx = (u.x + l.x) / 2
              const cy = (u.y + l.y) / 2
              const sx = pad + cx * (W - 2 * pad)
              const sy = H / 2 - cy * (H - 2 * pad) * 3
              return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`
            })
            .join(' ')
        }
        fill="none"
        stroke="rgba(45,212,191,0.4)"
        strokeWidth="0.5"
        strokeDasharray="2,2"
      />
    </svg>
  )
}

export default function NacaPanel() {
  const { bladeCount } = useTurbineStore()
  const [selected, setSelected] = useState('0012')
  const [customCode, setCustomCode] = useState('2412')
  const [editingCustom, setEditingCustom] = useState(false)

  const solidity = useMemo(() => {
    const chord = 0.15 // normalized estimate
    return (bladeCount * chord * 2).toFixed(2)
  }, [bladeCount])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Airfoil Profile</Label>
        <Badge variant="outline" className="text-[9px] text-text-muted border-border/30 bg-surface/30">
          σ≈{solidity}
        </Badge>
      </div>

      {/* Profile preview */}
      <div className="rounded-lg bg-surface/40 border border-teal/20 p-3">
        <AirfoilPreview code={selected} />
        <div className="text-center text-[10px] text-teal font-mono mt-2 font-bold">NACA {selected}</div>
      </div>

      {/* Preset list */}
      <div className="flex flex-col gap-2">
        {AIRFOIL_PRESETS.map((preset) => (
          <button
            key={preset.code}
            onClick={() => setSelected(preset.code)}
            className={`text-left px-3 py-2 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-between border ${
              selected === preset.code
                ? 'bg-teal/30 text-teal border-teal/40 shadow-sm'
                : 'bg-surface/50 text-text-muted hover:bg-surface hover:border-teal/30 hover:text-teal'
            }`}
          >
            <span>{preset.label}</span>
            <span className="font-mono text-[9px] opacity-70">{preset.code}</span>
          </button>
        ))}
      </div>

      <Separator className="bg-border/20 my-2" />

      {/* Custom NACA input */}
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2.5 font-semibold">Custom Code</Label>
        {editingCustom ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={customCode}
              maxLength={4}
              onChange={(e) => setCustomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="flex-1 bg-surface/60 border border-teal/30 rounded-lg px-2 py-2 text-xs font-mono text-teal text-center focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal/50"
              placeholder="4412"
            />
            <Button
              size="sm"
              onClick={() => { setSelected(customCode.padStart(4, '0')); setEditingCustom(false) }}
              className="h-9 px-3 text-[10px] bg-teal/30 text-teal border border-teal/40 hover:bg-teal/40 font-semibold"
            >
              ✓
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingCustom(true)}
            className="w-full h-9 text-[10px] border border-teal/20 bg-surface/50 text-text-muted hover:border-teal/40 hover:text-teal hover:bg-surface font-semibold"
          >
            + Enter NACA code
          </Button>
        )}
      </div>
    </div>
  )
}
