import { useTurbineStore } from '../../stores/turbineStore'

export default function PresetBrowser() {
  const { presetNames, activePreset, loadPreset, clearBlade } = useTurbineStore()

  return (
    <div className="flex flex-col gap-2 p-4">
      <span className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Presets</span>
      {presetNames.map((name) => (
        <button
          key={name}
          onClick={() => loadPreset(name)}
          className={`text-left px-3 py-2.5 rounded-lg text-xs transition-all border ${
            activePreset === name
              ? 'bg-teal/15 text-teal border-teal/30 shadow-[0_0_12px_rgba(45,212,191,0.1)]'
              : 'bg-surface/50 text-text-dim border-border/50 hover:border-teal/20 hover:text-text'
          }`}
        >
          <span className="font-medium">{name}</span>
        </button>
      ))}
      <button
        onClick={clearBlade}
        className="mt-2 px-3 py-2 rounded-lg text-xs text-text-muted border border-border/50
          hover:border-red-500/30 hover:text-red-400 transition-all"
      >
        ✕ Clear Canvas
      </button>
    </div>
  )
}
