import { useTurbineStore } from '../../stores/turbineStore'
import { usePuzzleStore } from '../../stores/puzzleStore'
import { useThemeStore } from '../../stores/themeStore'
import { CHALLENGES } from '../../data/challenges'
import { Badge } from './badge'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { Sun, Moon, Zap } from 'lucide-react'

export default function Header() {
  const { mode, setMode, bloomTier } = useTurbineStore()
  const { activeChallengeId, showChallengeList, setShowChallengeList, completedChallenges } = usePuzzleStore()
  const { theme, toggleTheme } = useThemeStore()

  const activeChallenge = CHALLENGES.find(c => c.id === activeChallengeId)
  const totalCompleted = Object.keys(completedChallenges).length

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
          Turbine<span className="text-teal">Bloom</span>
        </span>
        <Badge
          variant="outline"
          className="text-[9px] px-2 h-5 border-teal/30 text-teal bg-teal/10 font-semibold hidden sm:flex"
        >
          v0.3
        </Badge>
      </div>

      {/* ── Mode Toggle ───────────────────────────────────────────────── */}
      <div className="flex items-center bg-background rounded-lg border border-border p-1 gap-0.5">
        {([
          { value: 'draw', label: 'Draw'  },
          { value: 'side', label: 'Side'  },
          { value: 'view', label: '3D'    },
        ] as const).map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === m.value
                ? 'bg-teal/20 text-teal shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Right controls ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Active challenge badge */}
        {activeChallenge && (
          <Badge
            variant="outline"
            className="hidden sm:flex gap-1.5 text-[10px] text-teal border-teal/30 bg-teal/10 px-2.5 py-1 font-semibold"
          >
            <span>{activeChallenge.icon}</span>
            <span className="max-w-[100px] truncate">{activeChallenge.title}</span>
          </Badge>
        )}

        {/* Challenges button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChallengeList(!showChallengeList)}
              className="h-8 px-3 text-xs border-border bg-background text-muted-foreground hover:text-teal hover:border-teal/40 font-semibold"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1.5">Challenges</span>
              {totalCompleted > 0 && (
                <Badge className="ml-1.5 text-[9px] h-4 px-1.5 bg-teal/20 text-teal border-teal/30 font-bold">
                  {totalCompleted}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Wind challenges</TooltipContent>
        </Tooltip>

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="h-8 w-8 p-0 border-border bg-background text-muted-foreground hover:text-foreground hover:border-teal/30"
            >
              {theme === 'dark'
                ? <Sun className="h-3.5 w-3.5" />
                : <Moon className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
