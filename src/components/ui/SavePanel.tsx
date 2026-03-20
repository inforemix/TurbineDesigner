import { useState, useRef, useEffect } from 'react'
import { useTurbineStore } from '../../stores/turbineStore'

function formatDate(ts: number) {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface SavePanelProps {
  onClose: () => void
}

export default function SavePanel({ onClose }: SavePanelProps) {
  const { savedDesigns, saveDesign, loadSavedDesign, deleteDesign, bladePoints } = useTurbineStore()
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSave = () => {
    const trimmed = name.trim() || `Design ${savedDesigns.length + 1}`
    saveDesign(trimmed)
    setName('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      ref={panelRef}
      className="absolute top-full mt-2 right-0 z-50 w-72 rounded-xl overflow-hidden"
      style={{
        background: 'rgba(10,14,26,0.98)',
        border: '1px solid rgba(45,212,191,0.15)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(45,212,191,0.05)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Save Design</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors text-sm leading-none">✕</button>
      </div>

      {/* Save input */}
      <div className="p-3 border-b border-white/5">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Design ${savedDesigns.length + 1}`}
            disabled={bladePoints.length < 2}
            className="flex-1 text-xs rounded-lg px-3 py-2 outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(45,212,191,0.2)',
              color: '#e2e8f0',
            }}
          />
          <button
            onClick={handleSave}
            disabled={bladePoints.length < 2}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40"
            style={{
              background: saved ? 'rgba(45,212,191,0.3)' : 'rgba(45,212,191,0.15)',
              color: '#2dd4bf',
              border: '1px solid rgba(45,212,191,0.3)',
            }}
          >
            {saved ? '✓' : 'Save'}
          </button>
        </div>
        {bladePoints.length < 2 && (
          <p className="text-[9px] text-slate-500 mt-1.5 px-1">Draw a blade first to save a design.</p>
        )}
      </div>

      {/* Saved designs list */}
      <div className="max-h-64 overflow-y-auto">
        {savedDesigns.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <p className="text-[10px] text-slate-600">No saved designs yet.</p>
            <p className="text-[9px] text-slate-700 mt-1">Save your first design above.</p>
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {[...savedDesigns].reverse().map(design => (
              <div
                key={design.name + design.timestamp}
                className="flex items-center gap-2 group rounded-lg px-3 py-2 transition-all"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                {/* Mini blade preview */}
                <div
                  className="w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-xs"
                  style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.12)', color: '#2dd4bf' }}
                >
                  {design.bladeCount}⟳
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-200 truncate">{design.name}</p>
                  <p className="text-[9px] text-slate-600">{formatDate(design.timestamp)} · {design.bladeCount} blades · {design.height.toFixed(1)}m</p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { loadSavedDesign(design.name); onClose() }}
                    className="px-2 py-0.5 rounded text-[9px] font-semibold transition-all"
                    style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.25)' }}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteDesign(design.name)}
                    className="px-2 py-0.5 rounded text-[9px] font-semibold transition-all"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
