import { useTurbineStore } from '../../stores/turbineStore'

export default function BladeSectionEditor() {
  const {
    bladeSections,
    updateBladeSection,
    resetBladeSections,
    selectedSectionIndex,
    setSelectedSectionIndex,
    twist,
    taper,
  } = useTurbineStore()

  const section = bladeSections[selectedSectionIndex]
  const heightLabels = ['Root', '25%', 'Mid', '75%', 'Tip']

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">
          Blade Sections
        </span>
        <button
          onClick={resetBladeSections}
          className="text-[9px] text-text-muted hover:text-teal transition-colors px-1.5 py-0.5 rounded border border-border/40 hover:border-teal/30"
        >
          Reset
        </button>
      </div>

      {/* Section height selector - visual column diagram */}
      <div className="flex items-end gap-1 justify-center h-20 px-2">
        {bladeSections.map((sec, i) => {
          const isSelected = i === selectedSectionIndex
          const effectiveTwist = twist * sec.heightFraction + sec.twistOffset
          const effectiveTaper = 1.0 - taper * Math.abs(sec.heightFraction - 0.5) * 2
          const scaledTaper = effectiveTaper * sec.taperScale
          const barHeight = 16 + sec.heightFraction * 48
          const barWidth = Math.max(6, scaledTaper * 18)

          return (
            <button
              key={i}
              onClick={() => setSelectedSectionIndex(i)}
              className="flex flex-col items-center gap-1 group transition-all"
              title={`${heightLabels[i]} (h=${(sec.heightFraction * 100).toFixed(0)}%)`}
            >
              <div
                className="rounded-sm transition-all border"
                style={{
                  width: barWidth,
                  height: barHeight,
                  background: isSelected
                    ? `linear-gradient(180deg, #2dd4bf, #1a8a7a)`
                    : `linear-gradient(180deg, #2a3555, #1e2844)`,
                  borderColor: isSelected ? '#2dd4bf' : '#2a3555',
                  transform: `rotate(${effectiveTwist * 0.3}deg)`,
                  opacity: isSelected ? 1 : 0.6,
                }}
              />
              <span className={`text-[8px] ${isSelected ? 'text-teal' : 'text-text-muted'}`}>
                {heightLabels[i]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Selected section controls */}
      {section && (
        <div className="rounded-xl p-3 bg-surface/50 border border-border/40 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full bg-teal"
            />
            <span className="text-[11px] font-medium text-text">
              {heightLabels[selectedSectionIndex]} Section
            </span>
            <span className="text-[9px] text-text-muted ml-auto">
              h = {(section.heightFraction * 100).toFixed(0)}%
            </span>
          </div>

          {/* Twist offset */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-text-dim">Twist Offset</span>
              <span className="text-[10px] font-mono text-teal">
                {section.twistOffset > 0 ? '+' : ''}{section.twistOffset.toFixed(1)}°
              </span>
            </div>
            <input
              type="range"
              min={-45}
              max={45}
              step={0.5}
              value={section.twistOffset}
              onChange={(e) => updateBladeSection(selectedSectionIndex, { twistOffset: parseFloat(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-teal [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(45,212,191,0.4)]
                [&::-webkit-slider-thumb]:cursor-pointer"
              style={{
                background: (() => {
                  const pct = ((section.twistOffset + 45) / 90) * 100
                  return `linear-gradient(to right, #2dd4bf ${pct}%, #1e2844 ${pct}%)`
                })(),
              }}
            />
          </div>

          {/* Taper scale */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-text-dim">Taper Scale</span>
              <span className="text-[10px] font-mono text-teal">
                {section.taperScale.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.05}
              value={section.taperScale}
              onChange={(e) => updateBladeSection(selectedSectionIndex, { taperScale: parseFloat(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-teal [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(45,212,191,0.4)]
                [&::-webkit-slider-thumb]:cursor-pointer"
              style={{
                background: (() => {
                  const pct = ((section.taperScale - 0.2) / 1.8) * 100
                  return `linear-gradient(to right, #2dd4bf ${pct}%, #1e2844 ${pct}%)`
                })(),
              }}
            />
          </div>

          {/* Effective values readout */}
          <div className="flex gap-3 pt-1 border-t border-border/30">
            <div className="flex flex-col">
              <span className="text-[8px] uppercase text-text-muted">Eff. Twist</span>
              <span className="text-[10px] font-mono text-bloom-gold">
                {(twist * section.heightFraction + section.twistOffset).toFixed(1)}°
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] uppercase text-text-muted">Eff. Taper</span>
              <span className="text-[10px] font-mono text-bloom-gold">
                {((1.0 - taper * Math.abs(section.heightFraction - 0.5) * 2) * section.taperScale).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
