import { usePuzzleStore } from '../../stores/puzzleStore'
import { CHALLENGES } from '../../data/challenges'

function StarDisplay({ earned, max = 3 }: { earned: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="text-xs"
          style={{ color: i < earned ? '#fbbf24' : '#1e2844', filter: i < earned ? 'drop-shadow(0 0 3px #fbbf2460)' : 'none' }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default function ChallengeList() {
  const { completedChallenges, setActiveChallenge, setShowChallengeList, isChallengeUnlocked } = usePuzzleStore()
  const activeChallengeId = usePuzzleStore(s => s.activeChallengeId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="relative rounded-2xl border max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden"
        style={{ background: '#0a0e1a', borderColor: 'rgba(45,212,191,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <h2 className="text-sm font-bold text-text">Design Challenges</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              {Object.keys(completedChallenges).length} / {CHALLENGES.length} completed
            </p>
          </div>
          <button
            onClick={() => setShowChallengeList(false)}
            className="text-text-muted hover:text-text text-xl"
          >
            ✕
          </button>
        </div>

        {/* Challenge grid */}
        <div className="overflow-y-auto p-4 flex flex-col gap-2">
          {CHALLENGES.map((challenge) => {
            const unlocked = isChallengeUnlocked(challenge.id)
            const stars = completedChallenges[challenge.id] ?? 0
            const isActive = activeChallengeId === challenge.id

            return (
              <button
                key={challenge.id}
                disabled={!unlocked}
                onClick={() => setActiveChallenge(challenge.id)}
                className="text-left rounded-xl border p-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isActive ? 'rgba(45,212,191,0.08)' : stars > 0 ? 'rgba(15,22,40,0.8)' : 'rgba(10,14,26,0.6)',
                  borderColor: isActive ? 'rgba(45,212,191,0.4)' : stars > 0 ? 'rgba(45,212,191,0.15)' : 'rgba(30,40,68,0.8)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">{unlocked ? challenge.icon : '🔒'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-text truncate">{challenge.title}</span>
                      <StarDisplay earned={stars} />
                    </div>
                    <div className="text-[10px] text-teal mb-1">{challenge.subtitle}</div>
                    <p className="text-[10px] text-text-muted leading-relaxed line-clamp-2">
                      {unlocked ? challenge.description : `Complete "${CHALLENGES.find(c => c.id === challenge.unlockAfter)?.title}" to unlock`}
                    </p>
                    {unlocked && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {challenge.objectives.map((obj, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-text-muted border border-border/50">
                            {obj.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <span className="text-[9px] text-teal border border-teal/30 rounded px-1.5 py-0.5 flex-shrink-0">Active</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
