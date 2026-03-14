import { useTurbineStore } from '../../stores/turbineStore'

export default function Header() {
  const { mode, setMode, bloomTier } = useTurbineStore()

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
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-text-muted border border-border/50">
          v0.1
        </span>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center bg-surface rounded-lg border border-border/50 p-0.5">
        <button
          onClick={() => setMode('draw')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'draw'
              ? 'bg-teal/20 text-teal shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          ✎ Draw
        </button>
        <button
          onClick={() => setMode('view')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'view'
              ? 'bg-teal/20 text-teal shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          ◇ View 3D
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-text-muted hidden sm:block">
          Draw a blade → See it bloom
        </span>
      </div>
    </header>
  )
}
