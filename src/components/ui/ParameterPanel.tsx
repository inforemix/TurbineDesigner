import { useState } from 'react'
import { useTurbineStore, type BloomTier, type SymmetryMode, type MaterialPreset, MATERIAL_PRESETS, type NeonPattern, type BambooPattern, type QuantumFlowType, type MaterialConfig } from '../../stores/turbineStore'
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
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
        <span className="text-xs font-mono text-teal font-bold">
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
    bambooConfig, setBambooConfig,
    quantumConfig, setQuantumConfig,
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
            className="ml-auto text-xs h-5 px-2 font-semibold"
            style={{ borderColor: tier.color + '50', color: tier.color }}
          >
            {bloomTier}
          </Badge>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground gap-3">
          <div className="flex flex-col">
            <span className="text-muted-foreground/60 text-xs">Efficiency</span>
            <span className="text-teal font-mono font-bold">{estimatedCp.toFixed(3)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground/60 text-xs">Power Output</span>
            <span className="text-teal font-mono font-bold">{powerOutput.toFixed(1)} W</span>
          </div>
        </div>
      </div>

      {/* ── Blade Count ───────────────────────────────────────────────── */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2.5 font-semibold">Blade Count</Label>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6, 8].map((n) => (
            <button
              key={n}
              onClick={() => setBladeCount(n)}
              className={`flex-1 h-10 rounded-lg text-xs font-semibold transition-all border ${
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
        <Label className="text-xs uppercase tracking-wider text-muted-foreground block mb-2.5 font-semibold">Symmetry Mode</Label>
        <div className="flex gap-2">
          {SYMMETRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSymmetryMode(opt.value)}
              title={opt.desc}
              className={`flex-1 h-10 rounded-lg text-xs font-semibold transition-all border ${
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Profile Shape</Label>
              <div className="flex items-center bg-secondary/60 rounded-lg border border-teal/20 p-1 gap-1">
                <button
                  onClick={() => setParametricMode(false)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    !parametricMode ? 'bg-teal/30 text-teal' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Draw
                </button>
                <button
                  onClick={() => { setParametricMode(true); useTurbineStore.getState().applyParametric() }}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
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
                  className="mt-1 h-7 text-xs border-border bg-secondary text-secondary-foreground hover:border-teal/30 hover:text-teal"
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
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block font-semibold">Extrusion</Label>
        <div className="flex flex-col gap-3">
          <ParamSlider label="Height" value={height} min={0.5} max={3} step={0.1} onChange={setHeight} unit="m" />
          <ParamSlider label="Thickness" value={thickness} min={0.02} max={0.2} step={0.01} onChange={setThickness} />
          <DistributionEditor
            label="Chord Distribution"
            points={chordCurve}
            onChange={setChordCurve}
            yMin={0.1} yMax={1.5}
            color="#2dd4bf"
            colorLight="#0d9488"
          />
          <DistributionEditor
            label="Twist Distribution"
            points={twistCurve}
            onChange={setTwistCurve}
            yMin={0} yMax={1}
            color="#a78bfa"
            colorLight="#7c3aed"
          />
        </div>
      </div>

      {/* ── Material (view mode only) ─────────────────────────────────── */}
      {mode === 'view' && (
        <>
          <Separator className="bg-border/20 my-3" />
          <div className="pt-2 flex flex-col gap-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Material</Label>

            {/* Grouped metals dropdown + other materials */}
            <div className="flex flex-col gap-2">
              {/* Metals dropdown and shader buttons */}
              <div className="grid grid-cols-2 gap-2">
                {/* Metals Dropdown */}
                <div className="relative group">
                  <button
                    className={`w-full h-10 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${
                      ['teal-metal', 'brushed-steel', 'matte-white'].includes(materialPreset)
                        ? 'bg-teal/30 text-teal border-teal/40 shadow-sm'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/30'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                      style={{ background: materialOverrides[materialPreset]?.color ?? MATERIAL_PRESETS[materialPreset]?.color ?? '#2dd4bf' }} />
                    Metals ▼
                  </button>
                  {/* Dropdown menu */}
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl p-2 z-50 hidden group-hover:block">
                    {['teal-metal', 'brushed-steel', 'matte-white'].map((key) => {
                      const mat = MATERIAL_PRESETS[key as MaterialPreset]
                      const ov = materialOverrides[key as MaterialPreset] ?? {}
                      const swatchColor = ov.color ?? mat.color
                      return (
                        <button
                          key={key}
                          onClick={() => setMaterialPreset(key as MaterialPreset)}
                          className={`w-full text-left py-1.5 px-2 rounded text-xs font-semibold transition-all flex items-center gap-2 ${
                            materialPreset === key
                              ? 'bg-teal/30 text-teal'
                              : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0 border border-white/10"
                            style={{ background: swatchColor }} />
                          {mat.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Neon Shader */}
                <button
                  onClick={() => setMaterialPreset('neon-shader')}
                  className={`h-10 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${
                    materialPreset === 'neon-shader'
                      ? 'bg-violet-500/20 text-violet-300 border-violet-400/50 shadow-sm'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/30'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                    style={{ background: `linear-gradient(135deg, ${neonConfig.colorA}, ${neonConfig.rimColor})` }} />
                  Neon
                </button>
              </div>

              {/* Second row: Bamboo, Quantum, and other materials */}
              <div className="grid grid-cols-2 gap-2">
                {/* Bamboo Shader */}
                <button
                  onClick={() => setMaterialPreset('bamboo-shader')}
                  className={`h-10 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${
                    materialPreset === 'bamboo-shader'
                      ? 'bg-green-700/20 text-green-300 border-green-600/50 shadow-sm'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/30'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                    style={{ background: `linear-gradient(135deg, ${bambooConfig.colorLight}, ${bambooConfig.colorDark})` }} />
                  Bamboo
                </button>

                {/* Quantum Shader */}
                <button
                  onClick={() => setMaterialPreset('quantum-shader')}
                  className={`h-10 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${
                    materialPreset === 'quantum-shader'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-sm'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/30'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                    style={{ background: `linear-gradient(135deg, ${quantumConfig.colorA}, ${quantumConfig.colorC})` }} />
                  Quantum
                </button>
              </div>

              {/* Third row: Other materials */}
              <div className="grid grid-cols-2 gap-2">
                {['copper-patina', 'frosted-glass'].map((key) => {
                  const mat = MATERIAL_PRESETS[key as MaterialPreset]
                  const ov = materialOverrides[key as MaterialPreset] ?? {}
                  const swatchColor = ov.color ?? mat.color
                  return (
                    <button
                      key={key}
                      onClick={() => setMaterialPreset(key as MaterialPreset)}
                      className={`h-10 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${
                        materialPreset === key
                          ? 'bg-teal/30 text-teal border-teal/40 shadow-sm'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-teal/30'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                        style={{ background: swatchColor }} />
                      {mat.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Material config panel — shown for the active preset ── */}
            {materialPreset !== 'neon-shader' && materialPreset !== 'bamboo-shader' && (() => {
              const base = MATERIAL_PRESETS[materialPreset]
              const ov = materialOverrides[materialPreset] ?? {}
              const eff: MaterialConfig = { ...base, ...ov }
              const hasOverride = Object.keys(ov).length > 0
              const set = (p: Partial<MaterialConfig>) => setMaterialOverride(materialPreset, p)
              return (
                <div className="flex flex-col gap-3 p-3 rounded-xl border border-teal/15 bg-teal/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-teal/70 font-semibold">{base.label} Config</span>
                    {hasOverride && (
                      <button onClick={() => resetMaterialOverride(materialPreset)}
                        className="text-xs text-text-muted hover:text-amber-400 transition-colors">
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
                      <span className="text-xs text-text-muted">Color</span>
                    </label>
                    {eff.emissiveIntensity > 0 && (
                      <label className="flex flex-col items-center gap-1 cursor-pointer flex-1">
                        <div className="relative w-full h-7 rounded-lg overflow-hidden border border-white/10"
                          style={{ background: eff.emissiveColor ?? eff.color }}>
                          <input type="color" value={eff.emissiveColor ?? eff.color}
                            onChange={e => set({ emissiveColor: e.target.value })}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                        </div>
                        <span className="text-xs text-text-muted">Emissive</span>
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
                <div className="text-xs uppercase tracking-widest text-violet-400 font-semibold">Neon Config</div>

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
                      <span className="text-xs text-text-muted">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-text-muted uppercase tracking-wider">Pattern</span>
                  <div className="grid grid-cols-5 gap-1">
                    {(['Wave','Scan','Grid','Hex','Circuit'] as const).map((name, idx) => (
                      <button key={idx} onClick={() => setNeonConfig({ pattern: idx as NeonPattern })}
                        className={`py-1 rounded-md text-xs font-medium transition-all border ${
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

            {/* Bamboo Shader config */}
            {materialPreset === 'bamboo-shader' && (
              <div className="flex flex-col gap-3 p-3 rounded-xl border border-green-600/20 bg-green-700/5">
                <div className="text-xs uppercase tracking-widest text-green-400 font-semibold">Bamboo Config</div>

                <div className="flex gap-2">
                  {([
                    { key: 'colorLight', label: 'Light' },
                    { key: 'colorDark',  label: 'Dark' },
                  ] as { key: 'colorLight' | 'colorDark'; label: string }[]).map(({ key, label }) => (
                    <label key={key} className="flex flex-col items-center gap-1 cursor-pointer flex-1">
                      <div className="relative w-full h-7 rounded-lg overflow-hidden border border-white/10"
                        style={{ background: bambooConfig[key] }}>
                        <input type="color" value={bambooConfig[key]}
                          onChange={e => setBambooConfig({ [key]: e.target.value })}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <span className="text-xs text-text-muted">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-text-muted uppercase tracking-wider">Pattern</span>
                  <div className="grid grid-cols-5 gap-1">
                    {(['Grain', 'Nodes', 'Rings', 'Weave', 'Lacquer'] as const).map((name, idx) => (
                      <button key={idx} onClick={() => setBambooConfig({ pattern: idx as BambooPattern })}
                        className={`py-1 rounded-md text-xs font-medium transition-all border ${
                          bambooConfig.pattern === idx
                            ? 'border-green-500/60 bg-green-600/25 text-green-300'
                            : 'border-border/30 bg-surface/50 text-text-muted hover:border-green-500/30 hover:text-green-400'
                        }`}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <ParamSlider label="Node Spacing" value={bambooConfig.nodeSpacing}   min={1} max={10}  step={0.1}  onChange={v => setBambooConfig({ nodeSpacing: v })} />
                <ParamSlider label="Grain"        value={bambooConfig.grainStrength} min={0} max={1}   step={0.01} onChange={v => setBambooConfig({ grainStrength: v })} />
                <ParamSlider label="Shininess"    value={bambooConfig.shininess}     min={0} max={1}   step={0.01} onChange={v => setBambooConfig({ shininess: v })} />
                <ParamSlider label="Opacity"      value={bambooConfig.opacity}       min={0.1} max={1} step={0.01} onChange={v => setBambooConfig({ opacity: v })} />
              </div>
            )}

            {/* Quantum Shader config */}
            {materialPreset === 'quantum-shader' && (
              <div className="flex flex-col gap-3 p-3 rounded-xl border border-cyan-400/20 bg-cyan-500/5">
                <div className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">Quantum Config</div>

                <div className="flex gap-2">
                  {([
                    { key: 'colorA', label: 'Primary' },
                    { key: 'colorB', label: 'Secondary' },
                    { key: 'colorC', label: 'Accent' },
                  ] as { key: 'colorA' | 'colorB' | 'colorC'; label: string }[]).map(({ key, label }) => (
                    <label key={key} className="flex flex-col items-center gap-1 cursor-pointer flex-1">
                      <div className="relative w-full h-7 rounded-lg overflow-hidden border border-white/10"
                        style={{ background: quantumConfig[key] }}>
                        <input type="color" value={quantumConfig[key]}
                          onChange={e => setQuantumConfig({ [key]: e.target.value })}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <span className="text-xs text-text-muted">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-text-muted uppercase tracking-wider">Flow Type</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(['Radial', 'Spiral', 'Turbulence', 'Vortex'] as const).map((name, idx) => (
                      <button key={idx} onClick={() => setQuantumConfig({ flowType: idx as QuantumFlowType })}
                        className={`py-1 rounded-md text-xs font-medium transition-all border ${
                          quantumConfig.flowType === idx
                            ? 'border-cyan-400/60 bg-cyan-500/25 text-cyan-300'
                            : 'border-border/30 bg-surface/50 text-text-muted hover:border-cyan-400/30 hover:text-cyan-400'
                        }`}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <ParamSlider label="Flow Speed"     value={quantumConfig.flowSpeed}      min={0.1} max={5}   step={0.1}  onChange={v => setQuantumConfig({ flowSpeed: v })} />
                <ParamSlider label="Flow Intensity" value={quantumConfig.flowIntensity}  min={0}   max={2}   step={0.01} onChange={v => setQuantumConfig({ flowIntensity: v })} />
                <ParamSlider label="Pulse Speed"    value={quantumConfig.pulseSpeed}     min={0.1} max={8}   step={0.1}  onChange={v => setQuantumConfig({ pulseSpeed: v })} />
                <ParamSlider label="Noise Scale"    value={quantumConfig.noiseScale}     min={0.5} max={5}   step={0.1}  onChange={v => setQuantumConfig({ noiseScale: v })} />
                <ParamSlider label="Opacity"        value={quantumConfig.opacity}        min={0.1} max={1}   step={0.01} onChange={v => setQuantumConfig({ opacity: v })} />
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block font-semibold">Export</Label>
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
