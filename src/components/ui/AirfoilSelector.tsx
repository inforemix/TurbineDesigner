import { useState } from 'react'
import { useTurbineStore } from '../../stores/turbineStore'
import { AIRFOIL_PROFILE_PRESETS, buildProfileData } from '../../utils/airfoil'
import type { AirfoilPresetName } from '../../stores/turbineStore'

/* ── Tiny SVG cross-section preview ─────────────────────────────────────── */
function ProfileSVG({ m, p, t, active }: { m: number; p: number; t: number; active: boolean }) {
  const profile = buildProfileData(m, p, t, '', '')
  const W = 56, H = 28, PAD = 2
  const toX = (x: number) => PAD + x * (W - PAD * 2)
  const toY = (y: number) => H / 2 - y * (H - PAD * 2) * 3.5  // amplify for visibility

  const upperD = profile.upper.map((pt, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(pt.x).toFixed(1)},${toY(pt.y).toFixed(1)}`
  ).join(' ')

  const lowerD = [...profile.lower].reverse().map((pt) =>
    `L${toX(pt.x).toFixed(1)},${toY(pt.y).toFixed(1)}`
  ).join(' ')

  const color = active ? '#2dd4bf' : '#4b6280'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path
        d={`${upperD} ${lowerD} Z`}
        fill={active ? 'rgba(45,212,191,0.12)' : 'rgba(75,98,128,0.08)'}
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ── Preset tiles ─────────────────────────────────────────────────────────── */
const PRESET_ORDER: Exclude<AirfoilPresetName, 'custom'>[] = ['symmetric', 'cambered', 'high-lift', 'thin']

export default function AirfoilSelector() {
  const {
    airfoilPreset, setAirfoilPreset,
    customNacaM, customNacaP, customNacaT, setCustomNaca,
    customAirfoils, saveCustomAirfoil, deleteCustomAirfoil,
    thickness, setThickness,
  } = useTurbineStore()

  const [showCustom, setShowCustom] = useState(airfoilPreset === 'custom')
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  const selectPreset = (p: AirfoilPresetName) => {
    setAirfoilPreset(p)
    setShowCustom(p === 'custom')
  }

  const loadCustom = (a: { m: number; p: number; t: number }) => {
    setCustomNaca(a.m, a.p, a.t)
    setAirfoilPreset('custom')
    setShowCustom(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Airfoil Profile</span>
      </div>

      {/* 4 preset tiles in 2×2 grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {PRESET_ORDER.map(key => {
          const info = AIRFOIL_PROFILE_PRESETS[key]
          const active = airfoilPreset === key
          return (
            <button
              key={key}
              onClick={() => selectPreset(key)}
              title={info.description}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                active
                  ? 'border-teal/50 bg-teal/10 text-teal'
                  : 'border-border/40 bg-surface/60 text-text-dim hover:border-teal/30 hover:text-teal/80'
              }`}
            >
              <ProfileSVG m={info.m} p={info.p} t={info.t} active={active} />
              <span className="text-[9px] font-semibold tracking-wide">{info.label}</span>
            </button>
          )
        })}
      </div>

      {/* Custom tile */}
      <button
        onClick={() => selectPreset('custom')}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-medium ${
          airfoilPreset === 'custom'
            ? 'border-violet-400/50 bg-violet-400/10 text-violet-400'
            : 'border-border/40 bg-surface/60 text-text-dim hover:border-violet-400/30 hover:text-violet-400'
        }`}
      >
        <span className="text-sm">✦</span>
        Custom NACA
        <span className={`ml-auto transition-transform ${showCustom ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Custom NACA sliders (shown when custom selected) */}
      {showCustom && (
        <div className="border border-border/30 rounded-lg p-3 space-y-3 bg-surface/40">
          <NacaSlider
            label="Camber" value={customNacaM} min={0} max={0.09} step={0.005}
            display={v => `${(v * 100).toFixed(1)}%`}
            onChange={m => setCustomNaca(m, customNacaP, customNacaT)}
          />
          <NacaSlider
            label="Camber pos" value={customNacaP} min={0.1} max={0.9} step={0.05}
            display={v => `${Math.round(v * 10)}0%`}
            onChange={p => setCustomNaca(customNacaM, p, customNacaT)}
          />
          <NacaSlider
            label="Thickness" value={customNacaT} min={0.04} max={0.30} step={0.01}
            display={v => `${Math.round(v * 100)}%`}
            onChange={t => setCustomNaca(customNacaM, customNacaP, t)}
          />

          {/* Save custom profile */}
          {!showSaveInput ? (
            <button
              onClick={() => setShowSaveInput(true)}
              className="w-full text-[9px] py-1 rounded border border-border/30 text-text-muted hover:text-violet-400 hover:border-violet-400/30 transition-colors"
            >
              + Save as my profile
            </button>
          ) : (
            <div className="flex gap-1">
              <input
                autoFocus
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Profile name…"
                onKeyDown={e => {
                  if (e.key === 'Enter' && saveName.trim()) {
                    saveCustomAirfoil(saveName.trim())
                    setSaveName('')
                    setShowSaveInput(false)
                  } else if (e.key === 'Escape') {
                    setShowSaveInput(false)
                  }
                }}
                className="flex-1 text-[9px] px-2 py-1 rounded bg-background border border-border/40 text-foreground outline-none focus:border-violet-400/50"
              />
              <button
                onClick={() => {
                  if (saveName.trim()) {
                    saveCustomAirfoil(saveName.trim())
                    setSaveName('')
                    setShowSaveInput(false)
                  }
                }}
                className="px-2 py-1 rounded bg-violet-400/20 text-violet-400 text-[9px] hover:bg-violet-400/30 transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* Saved custom profiles */}
      {customAirfoils.length > 0 && (
        <div className="space-y-1">
          <div className="text-[8px] uppercase tracking-widest text-text-muted px-0.5">Saved</div>
          {customAirfoils.map(a => (
            <div key={a.name} className="group flex items-center gap-1">
              <button
                onClick={() => loadCustom(a)}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/30 bg-surface/40 text-text-dim hover:text-violet-400 hover:border-violet-400/30 transition-colors text-[9px]"
              >
                <ProfileSVG m={a.m} p={a.p} t={a.t} active={false} />
                {a.name}
                <span className="ml-auto text-[8px] text-text-muted">
                  {Math.round(a.t * 100)}%t
                </span>
              </button>
              <button
                onClick={() => deleteCustomAirfoil(a.name)}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-[9px] text-text-muted hover:text-red-400 transition-all"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Blade thickness scale */}
      <div className="pt-1 border-t border-border/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-text-muted">Blade thickness</span>
          <span className="text-[9px] text-teal font-mono">{Math.round(thickness * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.02} max={0.40} step={0.01}
          value={thickness}
          onChange={e => setThickness(parseFloat(e.target.value))}
          className="w-full accent-teal"
        />
      </div>
    </div>
  )
}

/* ── NACA slider subcomponent ────────────────────────────────────────────── */
function NacaSlider({
  label, value, min, max, step, display, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number
  display: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-text-muted">{label}</span>
        <span className="text-[9px] text-violet-400 font-mono">{display(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-violet-400"
      />
    </div>
  )
}
