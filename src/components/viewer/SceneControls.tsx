import { useState } from 'react'
import { useTurbineStore, type SkyPreset, type GroundTexture, GROUND_COLORS } from '../../stores/turbineStore'
import { Slider } from '../ui/slider'

const SKY_ICONS: Record<SkyPreset, string> = {
  sunny:  '☀️',
  cloudy: '⛅',
  sunset: '🌇',
  stormy: '⛈',
  night:  '🌙',
}

export default function SceneControls() {
  const [open, setOpen] = useState(false)
  const { environmentConfig, setEnvironmentConfig } = useTurbineStore()

  return (
    <div className="absolute top-3 left-3 z-20">
      {/* Toggle icon button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Scene Settings"
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all border shadow-md backdrop-blur-md ${
          open
            ? 'bg-amber-500/30 border-amber-400/60 text-amber-300 shadow-amber-500/20'
            : 'bg-card/80 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground hover:border-border'
        }`}
      >
        🌍
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-11 left-0 w-68 bg-card/97 backdrop-blur-md rounded-xl border border-border shadow-2xl overflow-hidden"
          style={{ width: '272px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Scene</span>
            <button onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm px-1">✕</button>
          </div>

          <div className="p-3 flex flex-col gap-3 max-h-[75vh] overflow-y-auto">

            {/* ── Sky Presets ────────────────────────────────────── */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Weather</p>
              <div className="flex gap-1.5">
                {(['sunny', 'cloudy', 'sunset', 'stormy', 'night'] as SkyPreset[]).map(preset => (
                  <button
                    key={preset}
                    onClick={() => setEnvironmentConfig({ skyPreset: preset })}
                    title={preset}
                    className={`flex-1 h-10 flex flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all border ${
                      environmentConfig.skyPreset === preset
                        ? 'bg-amber-500/25 border-amber-400/60 text-amber-300'
                        : 'bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary hover:border-border'
                    }`}
                  >
                    <span className="text-lg leading-none">{SKY_ICONS[preset]}</span>
                    <span className="capitalize text-[10px]">{preset}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Cloud Intensity ────────────────────────────────── */}
            <div>
              <div className="flex justify-between mb-1.5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cloud Intensity</p>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  {Math.round(environmentConfig.cloudIntensity * 100)}%
                </span>
              </div>
              <Slider
                min={0} max={1} step={0.05}
                value={[environmentConfig.cloudIntensity]}
                onValueChange={([v]) => setEnvironmentConfig({ cloudIntensity: v })}
                className="[&_[data-radix-slider-thumb]]:bg-amber-400 [&_[data-radix-slider-thumb]]:border-amber-500/50 [&_[data-radix-slider-range]]:bg-amber-400/60"
              />
            </div>

            {/* ── Ground Texture ─────────────────────────────────── */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Ground Texture</p>
              <div className="grid grid-cols-5 gap-1">
                {(['grass', 'sand', 'dirt', 'concrete', 'rock'] as GroundTexture[]).map(texture => (
                  <button
                    key={texture}
                    onClick={() => setEnvironmentConfig({
                      groundTexture: texture,
                      groundColor: GROUND_COLORS[texture][2],
                    })}
                    className={`h-9 rounded text-xs font-medium transition-all border capitalize flex items-center justify-center ${
                      environmentConfig.groundTexture === texture
                        ? 'bg-emerald-600/30 border-emerald-500/60 text-emerald-300'
                        : 'bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary hover:border-border'
                    }`}
                  >
                    {texture}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Ground Color ───────────────────────────────────── */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Ground Color</p>
              <div className="flex gap-1.5">
                {GROUND_COLORS[environmentConfig.groundTexture].map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setEnvironmentConfig({ groundColor: color })}
                    title={color}
                    className={`flex-1 h-7 rounded-md border-2 transition-all ${
                      environmentConfig.groundColor === color
                        ? 'border-white/70 scale-105 shadow-md'
                        : 'border-white/20 hover:border-white/50 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* ── Color Variation ────────────────────────────────── */}
            <div>
              <div className="flex justify-between mb-1.5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Variation</p>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {Math.round(environmentConfig.groundColorVariation * 100)}%
                </span>
              </div>
              <Slider
                min={0} max={1} step={0.05}
                value={[environmentConfig.groundColorVariation]}
                onValueChange={([v]) => setEnvironmentConfig({ groundColorVariation: v })}
                className="[&_[data-radix-slider-thumb]]:bg-emerald-400 [&_[data-radix-slider-thumb]]:border-emerald-500/50 [&_[data-radix-slider-range]]:bg-emerald-400/60"
              />
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
