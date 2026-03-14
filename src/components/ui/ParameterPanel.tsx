import { useState } from 'react'
import { useTurbineStore, type BloomTier, type SymmetryMode, type MaterialPreset, MATERIAL_PRESETS } from '../../stores/turbineStore'
import { turbineCanvasRef, turbineGLRef, turbineSceneRef } from '../viewer/TurbineViewer'

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = '',
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  unit?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] uppercase tracking-wider text-text-dim">{label}</span>
        <span className="text-[11px] font-mono text-teal">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-teal [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(45,212,191,0.4)]
          [&::-webkit-slider-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, #2dd4bf ${pct}%, #1e2844 ${pct}%)`,
        }}
      />
    </div>
  )
}

const TIER_CONFIG: Record<BloomTier, { label: string; color: string; icon: string }> = {
  dormant: { label: 'Dormant', color: '#64748b', icon: '○' },
  seedling: { label: 'Seedling', color: '#2dd4bf', icon: '◐' },
  flourishing: { label: 'Flourishing', color: '#fbbf24', icon: '◉' },
  radiant: { label: 'Radiant', color: '#f472b6', icon: '✦' },
}

const SYMMETRY_OPTIONS: { value: SymmetryMode; label: string; desc: string }[] = [
  { value: 'pinwheel', label: 'Pin', desc: 'Pinwheel' },
  { value: 'helix', label: 'Hlx', desc: 'Helical' },
  { value: 'snowflake', label: 'Snw', desc: 'Snowflake' },
  { value: 'freeform', label: 'Free', desc: 'Freeform' },
]

const MATERIAL_KEYS = Object.keys(MATERIAL_PRESETS) as MaterialPreset[]

async function handleExportGLB() {
  try {
    const { generateTurbineMesh, exportToGLB } = await import('../../utils/meshGenerator')
    const store = useTurbineStore.getState()
    const group = generateTurbineMesh(
      store.bladePoints,
      store.bladeCount,
      store.height,
      store.twist,
      store.taper,
      store.thickness
    )
    const blob = await exportToGLB(group)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `turbine-bloom-${Date.now()}.glb`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('GLB export failed:', err)
  }
}

function handleExportPNG() {
  try {
    const canvas = turbineCanvasRef
    if (!canvas) {
      console.error('No canvas available for PNG export')
      return
    }
    // Force a render to ensure the buffer is current
    if (turbineGLRef && turbineSceneRef) {
      turbineGLRef.render(turbineSceneRef, turbineGLRef.domElement as unknown as THREE.Camera)
    }
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `turbine-bloom-${Date.now()}.png`
    a.click()
  } catch (err) {
    console.error('PNG export failed:', err)
  }
}

// Import THREE for camera type
import * as THREE from 'three'

export default function ParameterPanel() {
  const {
    bladeCount, setBladeCount,
    windSpeed, setWindSpeed,
    height, setHeight,
    twist, setTwist,
    taper, setTaper,
    thickness, setThickness,
    bloomTier,
    estimatedCp,
    powerOutput,
    isSpinning, setIsSpinning,
    symmetryMode, setSymmetryMode,
    materialPreset, setMaterialPreset,
    mode,
  } = useTurbineStore()

  const [exportingGLB, setExportingGLB] = useState(false)

  const tier = TIER_CONFIG[bloomTier]

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      {/* Bloom Status */}
      <div
        className="rounded-xl p-3 border"
        style={{
          borderColor: tier.color + '40',
          background: `linear-gradient(135deg, ${tier.color}08, ${tier.color}04)`,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg" style={{ color: tier.color }}>{tier.icon}</span>
          <span className="text-sm font-medium" style={{ color: tier.color }}>{tier.label}</span>
        </div>
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>Cp: {estimatedCp.toFixed(3)}</span>
          <span>Power: {powerOutput.toFixed(1)}W</span>
        </div>
      </div>

      {/* Blade Count */}
      <div>
        <span className="text-[11px] uppercase tracking-wider text-text-dim block mb-2">Blades</span>
        <div className="flex gap-1">
          {[2, 3, 4, 5, 6, 8].map((n) => (
            <button
              key={n}
              onClick={() => setBladeCount(n)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                bladeCount === n
                  ? 'bg-teal/20 text-teal border border-teal/30'
                  : 'bg-surface text-text-dim border border-border hover:border-teal/20'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Symmetry Mode */}
      <div>
        <span className="text-[11px] uppercase tracking-wider text-text-dim block mb-2">Symmetry</span>
        <div className="flex gap-1">
          {SYMMETRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSymmetryMode(opt.value)}
              title={opt.desc}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                symmetryMode === opt.value
                  ? 'bg-bloom-violet/20 text-bloom-violet border border-bloom-violet/30'
                  : 'bg-surface text-text-dim border border-border hover:border-bloom-violet/20'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wind */}
      <Slider label="Wind Speed" value={windSpeed} min={0} max={25} step={0.5} onChange={setWindSpeed} unit=" m/s" />

      {/* Extrusion */}
      <div className="pt-2 border-t border-border/50">
        <span className="text-[10px] uppercase tracking-widest text-text-muted mb-2 block">Extrusion</span>
        <div className="flex flex-col gap-2.5">
          <Slider label="Height" value={height} min={0.5} max={3} step={0.1} onChange={setHeight} unit="m" />
          <Slider label="Twist" value={twist} min={0} max={90} step={1} onChange={setTwist} unit="°" />
          <Slider label="Taper" value={taper} min={0} max={0.8} step={0.05} onChange={setTaper} />
          <Slider label="Thickness" value={thickness} min={0.02} max={0.2} step={0.01} onChange={setThickness} />
        </div>
      </div>

      {/* Material Presets (only in view mode) */}
      {mode === 'view' && (
        <div className="pt-2 border-t border-border/50">
          <span className="text-[10px] uppercase tracking-widest text-text-muted mb-2 block">Material</span>
          <div className="grid grid-cols-2 gap-1">
            {MATERIAL_KEYS.map((key) => {
              const mat = MATERIAL_PRESETS[key]
              return (
                <button
                  key={key}
                  onClick={() => setMaterialPreset(key)}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1.5 ${
                    materialPreset === key
                      ? 'bg-teal/15 text-teal border border-teal/30'
                      : 'bg-surface text-text-dim border border-border hover:border-teal/20'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                    style={{ background: mat.color }}
                  />
                  {mat.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Spin toggle */}
      <button
        onClick={() => setIsSpinning(!isSpinning)}
        className={`mt-2 py-2 rounded-lg text-xs font-medium transition-all border ${
          isSpinning
            ? 'bg-teal/15 text-teal border-teal/30'
            : 'bg-surface text-text-dim border-border'
        }`}
      >
        {isSpinning ? '⟳ Spinning' : '⏸ Paused'}
      </button>

      {/* Export Buttons (only in view mode) */}
      {mode === 'view' && (
        <div className="pt-2 border-t border-border/50">
          <span className="text-[10px] uppercase tracking-widest text-text-muted mb-2 block">Export</span>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setExportingGLB(true)
                await handleExportGLB()
                setExportingGLB(false)
              }}
              disabled={exportingGLB}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all border bg-surface text-text-dim border-border hover:border-teal/30 hover:text-teal disabled:opacity-50"
            >
              {exportingGLB ? '...' : '↓ GLB'}
            </button>
            <button
              onClick={handleExportPNG}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all border bg-surface text-text-dim border-border hover:border-teal/30 hover:text-teal"
            >
              ↓ PNG
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
