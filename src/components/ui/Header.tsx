import { useTurbineStore } from '../../stores/turbineStore'
import { usePuzzleStore } from '../../stores/puzzleStore'
import { CHALLENGES } from '../../data/challenges'
import { Badge } from './badge'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

export default function Header() {
  const { mode, setMode, bloomTier } = useTurbineStore()
  const { activeChallengeId, showChallengeList, setShowChallengeList, completedChallenges } = usePuzzleStore()

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
      className="h-14 flex items-center justify-between px-6 border-b border-border/30 bg-surface/50 backdrop-blur-md"
      style={{ boxShadow: tierGlow[bloomTier] || 'none' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal via-teal-glow to-bloom-violet flex items-center justify-center shadow-lg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <span className="text-base font-bold tracking-tight text-text">
          Turbine<span className="text-teal">Bloom</span>
        </span>
        <Badge variant="outline" className="text-[8px] px-2 py-0.5 h-5 border-teal/30 text-teal bg-teal/8 font-medium">
          v0.3
        </Badge>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center bg-surface/60 rounded-lg border border-teal/20 p-1 gap-1">
        {([
          { value: 'draw', icon: '✎', label: 'Draw' },
          { value: 'side', icon: '⬜', label: 'Side' },
          { value: 'view', icon: '◇', label: '3D' },
        ] as const).map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`px-3 py-2 rounded-md text-xs font-semibold transition-all ${
              mode === m.value ? 'bg-teal/30 text-teal shadow-md' : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {activeChallenge && (
          <Badge variant="outline" className="hidden sm:flex gap-1.5 text-[10px] text-teal border-teal/30 bg-teal/10 px-3 py-1.5 font-semibold">
            <span>{activeChallenge.icon}</span>
            <span className="max-w-[120px] truncate">{activeChallenge.title}</span>
          </Badge>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChallengeList(!showChallengeList)}
              className="h-9 px-4 text-xs border-teal/20 bg-surface/60 text-text-dim hover:border-teal/40 hover:text-teal hover:bg-surface font-semibold"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Challenges</span>
              {totalCompleted > 0 && (
                <Badge className="text-[9px] h-5 px-2 bg-teal/30 text-teal border-teal/30 font-bold">
                  {totalCompleted}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>View wind challenges</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
