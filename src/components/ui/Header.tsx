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
      className="h-12 flex items-center justify-between px-5 border-b border-border/40 bg-deep/80 backdrop-blur-sm"
      style={{ boxShadow: tierGlow[bloomTier] || 'none' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal to-bloom-violet flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-wide text-text">
          Turbine<span className="text-teal">Bloom</span>
        </span>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border/50 text-text-muted">
          v0.3
        </Badge>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center bg-surface rounded-lg border border-border/50 p-0.5">
        {([
          { value: 'draw', icon: '✎', label: 'Draw' },
          { value: 'side', icon: '⬜', label: 'Side' },
          { value: 'view', icon: '◇', label: '3D' },
        ] as const).map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === m.value ? 'bg-teal/20 text-teal shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {activeChallenge && (
          <Badge variant="outline" className="hidden sm:flex gap-1 text-[10px] text-teal border-teal/25 bg-teal/8">
            <span>{activeChallenge.icon}</span>
            <span className="max-w-[100px] truncate">{activeChallenge.title}</span>
          </Badge>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChallengeList(!showChallengeList)}
              className="h-7 px-3 text-xs border-border/50 bg-surface text-text-dim hover:border-teal/30 hover:text-teal"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Challenges</span>
              {totalCompleted > 0 && (
                <Badge className="text-[9px] h-4 px-1.5 bg-teal/20 text-teal border-teal/20">
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
