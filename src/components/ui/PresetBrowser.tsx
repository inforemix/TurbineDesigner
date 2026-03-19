import { useTurbineStore } from '../../stores/turbineStore'

export default function PresetBrowser() {
  const { presetNames, activePreset, loadPreset, clearBlade } = useTurbineStore()

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">📚 Presets</span>
      <div className="flex flex-col gap-2">
        {presetNames.map((name) => (
          <button
            key={name}
            onClick={() => loadPreset(name)}
            className={`text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
              activePreset === name
                ? 'bg-teal/30 text-teal border-teal/40 shadow-md'
                : 'bg-surface/50 text-text-muted border-border/30 hover:border-teal/30 hover:text-teal hover:bg-surface'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <button
        onClick={clearBlade}
        className="mt-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-red-400/70 border border-red-500/20 hover:border-red-500/40 hover:text-red-300 transition-all bg-red-500/5"
      >
        ✕ Clear Canvas
      </button>
    </div>
  )
}
