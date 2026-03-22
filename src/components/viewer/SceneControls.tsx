import { useTurbineStore, type SkyPreset, type GroundTexture, SKY_PRESETS, GROUND_COLORS } from '../../stores/turbineStore'
import { Label } from '../ui/label'
import { Slider } from '../ui/slider'

export default function SceneControls() {
  const { environmentConfig, setEnvironmentConfig } = useTurbineStore()

  return (
    <div className="flex flex-col gap-4">
      {/* Sky Controls */}
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sky Preset</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {(['sunny', 'cloudy', 'sunset', 'stormy', 'night'] as SkyPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setEnvironmentConfig({ skyPreset: preset })}
              className={`py-1.5 px-2 rounded text-[10px] font-semibold transition-all border capitalize ${
                environmentConfig.skyPreset === preset
                  ? 'bg-amber-500/30 text-amber-300 border-amber-400/50'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-amber-400/30'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Cloud Intensity */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cloud Intensity</Label>
          <span className="text-[10px] font-mono text-amber-400 font-bold">{environmentConfig.cloudIntensity.toFixed(2)}</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[environmentConfig.cloudIntensity]}
          onValueChange={([v]) => setEnvironmentConfig({ cloudIntensity: v })}
          className="[&_[data-radix-slider-thumb]]:bg-amber-400 [&_[data-radix-slider-thumb]]:border-amber-500/50 [&_[data-radix-slider-range]]:bg-amber-400/60"
        />
      </div>

      {/* Ground Texture */}
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ground Texture</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {(['grass', 'sand', 'dirt', 'concrete', 'rock'] as GroundTexture[]).map((texture) => (
            <button
              key={texture}
              onClick={() => setEnvironmentConfig({
                groundTexture: texture,
                groundColor: GROUND_COLORS[texture][0]
              })}
              className={`py-1.5 px-2 rounded text-[10px] font-semibold transition-all border capitalize ${
                environmentConfig.groundTexture === texture
                  ? 'bg-green-600/30 text-green-300 border-green-500/50'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-green-500/30'
              }`}
            >
              {texture}
            </button>
          ))}
        </div>
      </div>

      {/* Ground Color */}
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ground Color</Label>
        <div className="grid grid-cols-5 gap-1">
          {GROUND_COLORS[environmentConfig.groundTexture].map((color, idx) => (
            <button
              key={idx}
              onClick={() => setEnvironmentConfig({ groundColor: color })}
              className={`h-8 rounded border-2 transition-all ${
                environmentConfig.groundColor === color
                  ? 'border-white/60 shadow-md'
                  : 'border-white/20 hover:border-white/40'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Color Variation */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Color Variation</Label>
          <span className="text-[10px] font-mono text-green-400 font-bold">{environmentConfig.groundColorVariation.toFixed(2)}</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[environmentConfig.groundColorVariation]}
          onValueChange={([v]) => setEnvironmentConfig({ groundColorVariation: v })}
          className="[&_[data-radix-slider-thumb]]:bg-green-400 [&_[data-radix-slider-thumb]]:border-green-500/50 [&_[data-radix-slider-range]]:bg-green-400/60"
        />
      </div>
    </div>
  )
}
