import { useState } from 'react'
import { useTurbineStore } from '../../stores/turbineStore'

export default function PresetBrowser() {
  const { presetNames, activePreset, loadPreset, clearBlade } = useTurbineStore()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Presets
      </span>

      <div className="relative">
        {/* Dropdown toggle button */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border bg-secondary/50 text-muted-foreground border-border hover:border-teal/30 hover:text-teal hover:bg-secondary flex items-center justify-between"
        >
          <span className="truncate">{activePreset || 'Select preset...'}</span>
          <span className="text-[10px] ml-2 shrink-0">{open ? '▼' : '▶'}</span>
        </button>

        {/* Dropdown menu */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="flex flex-col max-h-[50vh] overflow-y-auto">
              {presetNames.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    loadPreset(name)
                    setOpen(false)
                  }}
                  className={`text-left px-3 py-2 text-xs font-semibold transition-colors border-b border-border/50 last:border-b-0 ${
                    activePreset === name
                      ? 'bg-teal/20 text-teal'
                      : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={clearBlade}
        className="px-3 py-2.5 rounded-lg text-xs font-semibold text-destructive/70 border border-destructive/20 hover:border-destructive/40 hover:text-destructive transition-all bg-destructive/5"
      >
        ✕ Clear Canvas
      </button>
    </div>
  )
}
