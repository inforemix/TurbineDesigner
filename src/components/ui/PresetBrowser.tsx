import { useTurbineStore } from '../../stores/turbineStore'

export default function PresetBrowser() {
  const { presetNames, activePreset, loadPreset, clearBlade } = useTurbineStore()

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Presets
      </span>

      <div className="flex flex-col gap-1.5">
        {presetNames.map((name) => (
          <button
            key={name}
            onClick={() => loadPreset(name)}
            className={`text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
              activePreset === name
                ? 'bg-teal/20 text-teal border-teal/40 shadow-sm'
                : 'bg-secondary/50 text-muted-foreground border-border hover:border-teal/30 hover:text-teal hover:bg-secondary'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <button
        onClick={clearBlade}
        className="mt-1 px-3 py-2.5 rounded-lg text-xs font-semibold text-destructive/70 border border-destructive/20 hover:border-destructive/40 hover:text-destructive transition-all bg-destructive/5"
      >
        ✕ Clear Canvas
      </button>
    </div>
  )
}
