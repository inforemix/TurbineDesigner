import { useState } from 'react'
import { useTurbineStore, type BloomTier, type SymmetryMode, type MaterialPreset, MATERIAL_PRESETS } from '../../stores/turbineStore'
import DistributionEditor from './DistributionEditor'
import { Slider } from './slider'
import { Button } from './button'
import { Label } from './label'
import { Badge } from './badge'
import { Separator } from './separator'
import * as THREE from 'three'
import { turbineCanvasRef, turbineGLRef, turbineSceneRef } from '../viewer/TurbineViewer'

// ── Labelled slider row using shadcn components ───────────────────────────────
function ParamSlider({
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
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <Label className="text-[11px] uppercase tracking-wider text-text-dim">{label}</Label>
        <span className="text-[11px] font-mono text-teal">
          {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}{unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="[&_[data-radix-slider-thumb]]:bg-teal [&_[data-radix-slider-thumb]]:border-teal/50 [&_[data-radix-slider-range]]:bg-teal"
      />
    </div>
  )
}

// ── Bloom tier config ─────────────────────────────────────────────────────────
const TIER_CONFIG: Record<BloomTier, { label: string; color: string; icon: string }> = {
  dormant:     { label: 'Dormant',     color: '#64748b', icon: '○' },
  seedling:    { label: 'Seedling',    color: '#2dd4bf', icon: '◐' },
  flourishing: { label: 'Flourishing', color: '#fbbf24', icon: '◉' },
  radiant:     { label: 'Radiant',     color: '#f472b6', icon: '✦' },
}

const SYMMETRY_OPTIONS: { value: SymmetryMode; label: string; desc: string }[] = [
  { value: 'pinwheel',  label: 'Pin',  desc: 'Pinwheel' },
  { value: 'helix',     label: 'Hlx',  desc: 'Helical' },
  { value: 'snowflake', label: 'Snw',  desc: 'Snowflake' },
  { value: 'freeform',  label: 'Free', desc: 'Freeform' },
]

const MATERIAL_KEYS = Object.keys(MATERIAL_PRESETS) as MaterialPreset[]

// ── Export helpers ────────────────────────────────────────────────────────────
async function handleExportGLB() {
  const { generateTurbineMesh, exportToGLB } = await import('../../utils/meshGenerator')
  const store = useTurbineStore.getState()
  const group = generateTurbineMesh(
    store.bladePoints, store.bladeCount, store.height, store.twist,
    store.taper, store.thickness, store.chordCurve, store.twistCurve,
  )
  const blob = await exportToGLB(group)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `turbine-bloom-${Date.now()}.glb`
  a.click()
  URL.revokeObjectURL(url)
}

function handleExportPNG() {
  const canvas = turbineCanvasRef
  if (!canvas) return
  if (turbineGLRef && turbineSceneRef) {
    turbineGLRef.render(turbineSceneRef, turbineGLRef.domElement as unknown as THREE.Camera)
  }
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `turbine-bloom-${Date.now()}.png`
  a.click()
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function ParameterPanel() {
  const {
    bladeCount, setBladeCount,
    windSpeed, setWindSpeed,
    height, setHeight,
    twist: _twist, setTwist: _setTwist,
    taper: _taper, setTaper: _setTaper,
    thickness, setThickness,
    bloomTier, estimatedCp, powerOutput,
    isSpinning, setIsSpinning,
    symmetryMode, setSymmetryMode,
    materialPreset, setMaterialPreset,
    curveSmoothing, setCurveSmoothing,
    mode,
    chordCurve, setChordCurve,
    twistCurve, setTwistCurve,
    parametricMode, setParametricMode,
    parametricCamber, parametricCamberPeak, parametricLeRadius, parametricTrailingSweep,
    setParametric,
  } = useTurbineStore()

  const [exportingGLB, setExportingGLB] = useState(false)
  const tier = TIER_CONFIG[bloomTier]

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">

      {/* ── Bloom Status Card ──────────────────────────────────────────── */}
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
          <Badge
            variant="outline"
            className="ml-auto text-[9px] h-4 px-1.5"
            style={{ borderColor: tier.color + '40', color: tier.color }}
          >
            {bloomTier}
          </Badge>
        </div>
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>Cp: <span className="text-text-dim font-mono">{estimatedCp.toFixed(3)}</span></span>
          <span>Power: <span className="text-text-dim font-mono">{powerOutput.toFixed(1)} W</span></span>
        </div>
      </div>

      {/* ── Blade Count ───────────────────────────────────────────────── */}
      <div>
        <Label className="text-[11px] uppercase tracking-wider text-text-dim block mb-2">Blades</Label>
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

      {/* ── Symmetry Mode ─────────────────────────────────────────────── */}
      <div>
        <Label className="text-[11px] uppercase tracking-wider text-text-dim block mb-2">Symmetry</Label>
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

      {/* ── Draw-mode controls ────────────────────────────────────────── */}
      {mode === 'draw' && (
        <>
          <ParamSlider
            label="Curve Detail"
            value={curveSmoothing}
            min={2} max={20} step={1}
            onChange={setCurveSmoothing}
          />

          <Separator className="bg-border/50" />

          {/* Parametric profile toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] uppercase tracking-widest text-text-muted">Profile Shape</Label>
              <div className="flex items-center bg-surface rounded-lg border border-border/50 p-0.5">
                <button
                  onClick={() => setParametricMode(false)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    !parametricMode ? 'bg-teal/20 text-teal' : 'text-text-muted hover:text-text'
                  }`}
                >
                  Draw
                </button>
                <button
                  onClick={() => { setParametricMode(true); useTurbineStore.getState().applyParametric() }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    parametricMode ? 'bg-teal/20 text-teal' : 'text-text-muted hover:text-text'
                  }`}
                >
                  Parametric
                </button>
              </div>
            </div>

            {parametricMode && (
              <div className="flex flex-col gap-2">
                <ParamSlider label="Camber" value={parametricCamber} min={0} max={0.4} step={0.01}
                  onChange={(v) => setParametric('parametricCamber', v)} />
                <ParamSlider label="Camber Peak" value={parametricCamberPeak} min={0.1} max={0.9} step={0.05}
                  onChange={(v) => setParametric('parametricCamberPeak', v)} />
                <ParamSlider label="LE Radius" value={parametricLeRadius} min={0} max={0.3} step={0.01}
                  onChange={(v) => setParametric('parametricLeRadius', v)} />
                <ParamSlider label="TE Sweep" value={parametricTrailingSweep} min={-0.3} max={0.3} step={0.01}
                  onChange={(v) => setParametric('parametricTrailingSweep', v)} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setParametricMode(false)}
                  className="mt-1 h-7 text-[10px] border-border/50 bg-surface text-text-dim hover:border-teal/30 hover:text-teal"
                >
                  Convert to Points
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Wind ──────────────────────────────────────────────────────── */}
      <ParamSlider label="Wind Speed" value={windSpeed} min={0} max={25} step={0.5} onChange={setWindSpeed} unit=" m/s" />

      {/* ── Extrusion ─────────────────────────────────────────────────── */}
      <Separator className="bg-border/50" />
      <div>
        <Label className="text-[10px] uppercase tracking-widest text-text-muted mb-2 block">Extrusion</Label>
        <div className="flex flex-col gap-2.5">
          <ParamSlider label="Height" value={height} min={0.5} max={3} step={0.1} onChange={setHeight} unit="m" />
          <ParamSlider label="Thickness" value={thickness} min={0.02} max={0.2} step={0.01} onChange={setThickness} />
          <DistributionEditor
            label="Chord Distribution"
            points={chordCurve}
            onChange={setChordCurve}
            yMin={0.1} yMax={1.5}
            color="#2dd4bf"
          />
          <DistributionEditor
            label="Twist Distribution"
            points={twistCurve}
            onChange={setTwistCurve}
            yMin={0} yMax={1}
            color="#a78bfa"
          />
        </div>
      </div>

      {/* ── Material (view mode only) ─────────────────────────────────── */}
      {mode === 'view' && (
        <>
          <Separator className="bg-border/50" />
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-text-muted mb-2 block">Material</Label>
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
        </>
      )}

      {/* ── Spin toggle ───────────────────────────────────────────────── */}
      <Button
        variant={isSpinning ? 'default' : 'outline'}
        size="sm"
        onClick={() => setIsSpinning(!isSpinning)}
        className={`mt-1 h-8 text-xs ${
          isSpinning
            ? 'bg-teal/15 text-teal border border-teal/30 hover:bg-teal/25'
            : 'bg-surface text-text-dim border-border hover:border-teal/20'
        }`}
      >
        {isSpinning ? '⟳ Spinning' : '⏸ Paused'}
      </Button>

      {/* ── Export (view mode only) ───────────────────────────────────── */}
      {mode === 'view' && (
        <>
          <Separator className="bg-border/50" />
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-text-muted mb-2 block">Export</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setExportingGLB(true)
                  try { await handleExportGLB() } finally { setExportingGLB(false) }
                }}
                disabled={exportingGLB}
                className="flex-1 h-8 text-xs border-border/50 bg-surface text-text-dim hover:border-teal/30 hover:text-teal"
              >
                {exportingGLB ? '…' : '↓ GLB'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPNG}
                className="flex-1 h-8 text-xs border-border/50 bg-surface text-text-dim hover:border-teal/30 hover:text-teal"
              >
                ↓ PNG
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
