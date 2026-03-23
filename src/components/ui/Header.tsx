import { useState } from 'react'
import { useTurbineStore } from '../../stores/turbineStore'
import { useThemeStore } from '../../stores/themeStore'
import { Badge } from './badge'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { Sun, Moon } from 'lucide-react'
import SavePanel from './SavePanel'

export default function Header() {
  const { mode, setMode, bloomTier, savedDesigns } = useTurbineStore()
  const [showSave, setShowSave] = useState(false)
  const { theme, toggleTheme } = useThemeStore()

  const tierGlow: Record<string, string> = {
    dormant: '',
    seedling: '0 0 20px rgba(45,212,191,0.15)',
    flourishing: '0 0 20px rgba(251,191,36,0.15)',
    radiant: '0 0 25px rgba(244,114,182,0.2)',
  }

  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border bg-card backdrop-blur-md z-40"
      style={{ boxShadow: tierGlow[bloomTier] || 'none' }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-teal via-teal-glow to-bloom-violet flex items-center justify-center shadow-md">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <span className="text-base font-bold tracking-tight text-foreground hidden sm:block">
          Turbine<span className="text-teal">Designer</span>
        </span>
        <Badge
          variant="outline"
          className="text-xs px-2 h-6 border-teal/30 text-teal bg-teal/10 font-semibold hidden sm:flex"
        >
          v1.0
        </Badge>
      </div>

      {/* ── Mode Toggle ───────────────────────────────────────────────── */}
      <div className="flex items-center bg-background rounded-lg border border-border p-1 gap-0.5">
        {([
          { value: 'draw', label: 'Draw', dot: null },
          { value: 'side', label: 'Side', dot: null },
          { value: 'view', label: '3D', dot: null },
        ] as const).map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`relative h-9 px-4 rounded-md text-sm font-semibold transition-all flex items-center ${
              mode === m.value
                ? 'bg-teal/20 text-teal shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {m.label}
            {m.dot && (
              <span
                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                style={{ background: m.dot }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Right controls ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 relative">
        {/* Save button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSave(v => !v)}
              className={`h-10 px-3 text-sm font-semibold border-border bg-background transition-colors ${
                showSave ? 'text-teal border-teal/40 bg-teal/5' : 'text-muted-foreground hover:text-teal hover:border-teal/40'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span className="hidden sm:inline ml-1.5">Save</span>
              {savedDesigns.length > 0 && (
                <Badge className="ml-1.5 text-xs h-5 px-1.5 bg-teal/20 text-teal border-teal/30 font-bold">
                  {savedDesigns.length}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save & load designs</TooltipContent>
        </Tooltip>

        {/* Save dropdown panel */}
        {showSave && <SavePanel onClose={() => setShowSave(false)} />}

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="border-border bg-background text-muted-foreground hover:text-foreground hover:border-teal/30"
            >
              {theme === 'dark'
                ? <Sun size={20} />
                : <Moon size={20} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
