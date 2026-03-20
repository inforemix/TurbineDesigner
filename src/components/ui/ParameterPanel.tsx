import { useState } from 'react'
import { useTurbineStore, type BloomTier, type SymmetryMode, type MaterialPreset, MATERIAL_PRESETS, type NeonPattern, type MaterialConfig } from '../../stores/turbineStore'
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
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
        <span className="text-[10px] font-mono text-teal font-bold">
          {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}{unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="[&_[data-radix-slider-thumb]]:bg-teal [&_[data-radix-slider-thumb]]:border-teal/50 [&_[data-radix-slider-range]]:bg-teal/60"
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
    materialOverrides, setMaterialOverride, resetMaterialOverride,
    neonConfig, setNeonConfig,
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
    <div className="flex flex-col gap-4 h-full overflow-y-auto">

      {/* ── Bloom Status Card ──────────────────────────────────────────── */}
      <div
        className="rounded-xl p-4 border backdrop-blur-sm sticky top-0"
        style={{
          borderColor: tier.color + '40',
          background: `linear-gradient(135deg, ${tier.color}12, ${tier.color}06)`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl" style={{ color: tier.color }}>{tier.icon}</span>
          <span className="text-sm font-bold" style={{ color: tier.color }}>{tier.label}</span>
          <Badge
            variant="outline"
            className="ml-auto text-[9px] h-5 px-2 font-semibold"
            style={{ borderColor: tier.color + '50', color: tier.color }}
          >
            {bloomTier}
          </Badge>
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground gap-3">
          <div className="flex flex-col">
            <span className="text-muted-foreground/60 text-[9px]">Efficiency</span>
            <span className="text-teal font-mono font-bold">{estimatedCp.toFixed(3)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground/60 text-[9px]">Power Output</span>
            <span className="text-teal font-mono font-bold">{powerOutput.toFixed(1)} W</span>
          </div>
        </div>
      </div>

      {/* ── Blade Count ───────────────────────────────────────────────── */}
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2.5 font-semibold">Blade Count</Label>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6, 8].map((n) => (
            <button
              key={n}
              onClick={() => setBladeCount(n)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                bladeCount === n
                  ? 'bg-teal/30 text-teal border-teal/40 shadow-sm'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/30'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── Symmetry Mode ─────────────────────────────────────────────── */}
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2.5 font-semibold">Symmetry Mode</Label>
        <div className="flex gap-2">
          {SYMMETRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSymmetryMode(opt.value)}
              title={opt.desc}
              className={`flex-1 py-2 rounded-lg text-[10px] font-semibold transition-all border ${
                symmetryMode === opt.value
                  ? 'bg-bloom-violet/30 text-bloom-violet border-bloom-violet/40 shadow-sm'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-bloom-violet/30'
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
          <div className="pt-2">
            <ParamSlider
              label="Curve Detail"
              value={curveSmoothing}
              min={2} max={20} step={1}
              onChange={setCurveSmoothing}
            />
          </div>

          <Separator className="bg-border/20 my-2" />

          {/* Parametric profile toggle */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Profile Shape</Label>
              <div className="flex items-center bg-secondary/60 rounded-lg border border-teal/20 p-1 gap-1">
                <button
                  onClick={() => setParametricMode(false)}
                  className={`px-2.5 py-1 rounded text-[9px] font-semibold transition-all ${
                    !parametricMode ? 'bg-teal/30 text-teal' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Draw
                </button>
                <button
                  onClick={() => { setParametricMode(true); useTurbineStore.getState().applyParametric() }}
                  className={`px-2.5 py-1 rounded text-[9px] font-semibold transition-all ${
                    parametricMode ? 'bg-teal/30 text-teal' : 'text-muted-foreground hover:text-foreground'
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
                  className="mt-1 h-7 text-[10px] border-border bg-secondary text-secondary-foreground hover:border-teal/30 hover:text-teal"
                >
                  Convert to Points
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Wind ──────────────────────────────────────────────────────── */}
      <div className="pt-2">
        <ParamSlider label="Wind Speed" value={windSpeed} min={0} max={25} step={0.5} onChange={setWindSpeed} unit=" m/s" />
      </div>

      {/* ── Extrusion ─────────────────────────────────────────────────── */}
      <Separator className="bg-border/20 my-3" />
      <div className="pt-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block font-semibold">Extrusion</Label>
        <div className="flex flex-col gap-3">
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
          <Separator className="bg-border/20 my-3" />
          <div className="pt-2 flex flex-col gap-3">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Material</Label>
            <div className="grid grid-cols-2 gap-2">
              {MATERIAL_KEYS.map((key) => {
                const mat = MATERIAL_PRESETS[key]
                const isNeon = key === 'neon-shader'
                const ov = materialOverrides[key] ?? {}
                const swatchColor = ov.color ?? mat.color
                return (
                  <button
                    key={key}
                    onClick={() => setMaterialPreset(key)}
                    className={`py-2 px-2.5 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-2 border ${
                      materialPreset === key
                        ? isNeon ? 'bg-violet-500/20 text-violet-300 border-violet-400/50 shadow-sm' : 'bg-teal/30 text-teal border-teal/40 shadow-sm'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/30'
                    }`}
                  >
                    {isNeon ? (
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                        style={{ background: `linear-gradient(135deg, ${neonConfig.colorA}, ${neonConfig.rimColor})` }} />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                        style={{ background: swatchColor }} />
                    )}
                    {mat.label}
                  </button>
                )
              })}
            </div>

            {/* ── Material config panel — shown for the active preset ── */}
            {materialPreset !== 'neon-shader' && (() => {
              const base = MATERIAL_PRESETS[materialPreset]
              const ov = materialOverrides[materialPreset] ?? {}
              const eff: MaterialConfig = { ...base, ...ov }
              const hasOverride = Object.keys(ov).length > 0
              const set = (p: Partial<MaterialConfig>) => setMaterialOverride(materialPreset, p)
              return (
                <div className="flex flex-col gap-3 p-3 rounded-xl border border-teal/15 bg-teal/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-widest text-teal/70 font-semibold">{base.label} Config</span>
                    {hasOverride && (
                      <button onClick={() => resetMaterialOverride(materialPreset)}
                        className="text-[8px] text-text-muted hover:text-amber-400 transition-colors">
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Color pickers row */}
                  <div className="flex gap-2">
                    <label className="flex flex-col items-center gap-1 cursor-pointer flex-1">
                      <div className="relative w-full h-7 rounded-lg overflow-hidden border border-white/10" style={{ background: eff.color }}>
                        <input type="color" value={eff.color} onChange={e => set({ color: e.target.value })}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <span className="text-[8px] text-text-muted">Color</span>
                    </label>
                    {eff.emissiveIntensity > 0 && (
                      <label className="flex flex-col items-center gap-1 cursor-pointer flex-1">
                        <div className="relative w-full h-7 rounded-lg overflow-hidden border border-white/10"
                          style={{ background: eff.emissiveColor ?? eff.color }}>
                          <input type="color" value={eff.emissiveColor ?? eff.color}
                            onChange={e => set({ emissiveColor: e.target.value })}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                        </div>
                        <span className="text-[8px] text-text-muted">Emissive</span>
                      </label>
                    )}
                  </div>

                  {/* Sliders */}
                  <ParamSlider label="Metalness"  value={eff.metalness}  min={0} max={1}   step={0.01} onChange={v => set({ metalness: v })} />
                  <ParamSlider label="Roughness"  value={eff.roughness}  min={0} max={1}   step={0.01} onChange={v => set({ roughness: v })} />
                  <ParamSlider label="Opacity"    value={eff.opacity}    min={0.05} max={1} step={0.01} onChange={v => set({ opacity: v, transparent: v < 1 })} />
                  {(eff.clearcoat ?? 0) >= 0 && materialPreset === 'carbon-fiber' && (
                    <ParamSlider label="Clearcoat" value={eff.clearcoat ?? 0} min={0} max={1} step={0.01} onChange={v => set({ clearcoat: v })} />
                  )}
                  {eff.emissiveIntensity > 0 && (
                    <ParamSlider label="Emit Intensity" value={eff.emissiveIntensity} min={0} max={1} step={0.01} onChange={v => set({ emissiveIntensity: v })} />
                  )}
                </div>
              )
            })()}

            {/* Neon Shader config */}
            {materialPreset === 'neon-shader' && (
              <div className="flex flex-col gap-3 p-3 rounded-xl border border-violet-400/20 bg-violet-500/5">
                <div className="text-[9px] uppercase tracking-widest text-violet-400 font-semibold">Neon Config</div>

                <div className="flex gap-2">
                  {([
                    { key: 'colorA',   label: 'Base' },
                    { key: 'colorB',   label: 'Tip' },
                    { key: 'rimColor', label: 'Rim' },
                  ] as { key: 'colorA'|'colorB'|'rimColor'; label: string }[]).map(({ key, label }) => (
                    <label key={key} className="flex flex-col items-center gap-1 cursor-pointer flex-1">
                      <div className="relative w-full h-7 rounded-lg overflow-hidden border border-white/10"
                        style={{ background: neonConfig[key] }}>
                        <input type="color" value={neonConfig[key]}
                          onChange={e => setNeonConfig({ [key]: e.target.value })}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <span className="text-[8px] text-text-muted">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] text-text-muted uppercase tracking-wider">Pattern</span>
                  <div className="grid grid-cols-5 gap-1">
                    {(['Wave','Scan','Grid','Hex','Circuit'] as const).map((name, idx) => (
                      <button key={idx} onClick={() => setNeonConfig({ pattern: idx as NeonPattern })}
                        className={`py-1 rounded-md text-[8px] font-medium transition-all border ${
                          neonConfig.pattern === idx
                            ? 'border-violet-400/60 bg-violet-500/25 text-violet-300'
                            : 'border-border/30 bg-surface/50 text-text-muted hover:border-violet-400/30 hover:text-violet-400'
                        }`}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <ParamSlider label="Pulse Speed" value={neonConfig.pulseSpeed}  min={0} max={8}   step={0.1}  onChange={v => setNeonConfig({ pulseSpeed: v })} />
                <ParamSlider label="Frequency"   value={neonConfig.pulseFreq}   min={1} max={24}  step={0.5}  onChange={v => setNeonConfig({ pulseFreq: v })} />
                <ParamSlider label="Glow Edge"   value={neonConfig.fresnelPower} min={0.5} max={5} step={0.1} onChange={v => setNeonConfig({ fresnelPower: v })} />
                <ParamSlider label="Opacity"     value={neonConfig.opacity}     min={0.1} max={1}  step={0.01} onChange={v => setNeonConfig({ opacity: v })} />
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Spin toggle ───────────────────────────────────────────────── */}
      <div className="pt-3">
        <Button
          variant={isSpinning ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsSpinning(!isSpinning)}
          className={`w-full h-9 text-xs font-semibold border ${
            isSpinning
              ? 'bg-teal/30 text-teal border-teal/40 shadow-md hover:bg-teal/35'
              : 'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary hover:border-teal/30 hover:text-teal'
          }`}
        >
          {isSpinning ? '⟳ Spinning' : '⏸ Paused'}
        </Button>
      </div>

      {/* ── Export (view mode only) ───────────────────────────────────── */}
      {mode === 'view' && (
        <>
          <Separator className="bg-border/20 my-3" />
          <div className="pt-2 pb-4">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block font-semibold">Export</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setExportingGLB(true)
                  try { await handleExportGLB() } finally { setExportingGLB(false) }
                }}
                disabled={exportingGLB}
                className="flex-1 h-9 text-xs border border-teal/20 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/40 hover:text-teal font-semibold"
              >
                {exportingGLB ? '…' : '↓ GLB'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPNG}
                className="flex-1 h-9 text-xs border border-teal/20 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/40 hover:text-teal font-semibold"
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
