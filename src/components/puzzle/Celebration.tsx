import { useEffect, useRef } from 'react'
import { usePuzzleStore } from '../../stores/puzzleStore'
import { CHALLENGES } from '../../data/challenges'

export default function Celebration() {
  const { celebrationActive, celebrationStars, celebrationTitle, celebrationId, dismissCelebration, setActiveChallenge } = usePuzzleStore()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (celebrationActive) {
      timerRef.current = window.setTimeout(dismissCelebration, 5500)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [celebrationActive, dismissCelebration])

  if (!celebrationActive) return null

  const challenge = CHALLENGES.find(c => c.id === celebrationId)
  const currentIdx = CHALLENGES.findIndex(c => c.id === celebrationId)
  const nextChallenge = CHALLENGES[currentIdx + 1] ?? null

  const starMessages = ['', 'Nice start!', 'Great work!', 'Perfect!']
  const message = starMessages[celebrationStars] || 'Complete!'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={dismissCelebration}
    >
      <div
        className="rounded-2xl border p-8 text-center max-w-sm w-full mx-4 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #0f1628 0%, #0a0e1a 100%)',
          borderColor: 'rgba(251,191,36,0.3)',
          boxShadow: '0 0 60px rgba(251,191,36,0.15)',
          animation: 'celebrate-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Challenge icon */}
        <div className="text-5xl mb-3" style={{ animation: 'celebrate-spin 0.6s ease-out' }}>
          {challenge?.icon || '✨'}
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className="text-4xl"
              style={{
                color: i < celebrationStars ? '#fbbf24' : '#1e2844',
                filter: i < celebrationStars ? 'drop-shadow(0 0 8px #fbbf2499)' : 'none',
                animation: i < celebrationStars ? `star-appear 0.4s ${0.1 + i * 0.12}s both` : 'none',
              }}
            >
              ★
            </span>
          ))}
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-text mb-1">{celebrationTitle}</h2>
        <p className="text-sm text-teal mb-1">{message}</p>
        <p className="text-[11px] text-text-muted mb-6">Challenge Complete!</p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={dismissCelebration}
            className="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-text-dim hover:text-text transition-all"
          >
            Keep Designing
          </button>
          {nextChallenge && (
            <button
              onClick={() => { setActiveChallenge(nextChallenge.id); dismissCelebration() }}
              className="flex-1 py-2 rounded-lg text-xs font-medium border border-teal/40 text-teal hover:bg-teal/10 transition-all"
            >
              Next Challenge →
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes celebrate-pop {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes celebrate-spin {
          from { transform: rotate(-20deg) scale(0.5); opacity: 0; }
          to { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes star-appear {
          from { transform: scale(0) rotate(-30deg); opacity: 0; }
          to { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
