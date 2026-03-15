import { useEffect } from 'react'
import { usePuzzleStore } from '../../stores/puzzleStore'
import { useTurbineStore } from '../../stores/turbineStore'
import { CHALLENGES } from '../../data/challenges'

function ObjectiveRow({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 transition-all"
        style={{
          background: met ? 'rgba(45,212,191,0.25)' : 'rgba(100,116,139,0.15)',
          color: met ? '#2dd4bf' : '#64748b',
          border: `1px solid ${met ? '#2dd4bf40' : '#64748b40'}`,
        }}
      >
        {met ? '✓' : '○'}
      </span>
      <span style={{ color: met ? '#a0f0e8' : '#94a3b8' }}>{label}</span>
    </div>
  )
}

function StarBar({ stars, max = 3 }: { stars: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="text-sm transition-all"
          style={{ color: i < stars ? '#fbbf24' : '#1e2844', filter: i < stars ? 'drop-shadow(0 0 4px #fbbf2480)' : 'none' }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default function PuzzleHUD() {
  const { activeChallengeId, setActiveChallenge, checkCompletion } = usePuzzleStore()
  const { powerOutput, estimatedCp, bladeCount, symmetryMode, twist, bladePoints, bloomTier, setMode } = useTurbineStore()

  const challenge = CHALLENGES.find(c => c.id === activeChallengeId)

  // Check completion whenever physics change
  useEffect(() => {
    if (activeChallengeId) checkCompletion()
  }, [powerOutput, estimatedCp, bladeCount, symmetryMode, twist, bladePoints.length, bloomTier, activeChallengeId, checkCompletion])

  if (!challenge) return null

  // Evaluate each objective
  const objResults = challenge.objectives.map(obj => {
    switch (obj.type) {
      case 'min_power': return powerOutput >= (obj.value as number)
      case 'min_cp': return estimatedCp >= (obj.value as number)
      case 'exact_blades': return bladeCount === (obj.value as number)
      case 'min_blades': return bladeCount >= (obj.value as number)
      case 'bloom_tier': {
        const tiers = ['dormant', 'seedling', 'flourishing', 'radiant']
        return tiers.indexOf(bloomTier) >= tiers.indexOf(obj.value as string)
      }
      case 'min_points': return bladePoints.length >= (obj.value as number)
      case 'min_twist': return twist >= (obj.value as number)
      case 'exact_symmetry': return symmetryMode === obj.value
      default: return false
    }
  })

  // Live star count
  const metric = challenge.starUnit === 'Cp' ? estimatedCp : powerOutput
  const [t1, t2, t3] = challenge.starThresholds
  const liveStars = metric >= t3 ? 3 : metric >= t2 ? 2 : metric >= t1 ? 1 : 0

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
      style={{ minWidth: 280, maxWidth: 360 }}
    >
      <div
        className="rounded-xl border backdrop-blur-md px-4 py-3 shadow-2xl"
        style={{
          background: 'rgba(10,14,26,0.88)',
          borderColor: 'rgba(45,212,191,0.2)',
          boxShadow: '0 0 32px rgba(45,212,191,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{challenge.icon}</span>
            <div>
              <div className="text-[12px] font-semibold text-text">{challenge.title}</div>
              <div className="text-[10px] text-text-muted">{challenge.subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StarBar stars={liveStars} />
            <button
              onClick={() => setActiveChallenge(null)}
              className="text-text-muted hover:text-text text-[12px] ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Objectives */}
        <div className="flex flex-col gap-1 mb-3">
          {challenge.objectives.map((obj, i) => (
            <ObjectiveRow key={i} label={obj.label} met={objResults[i]} />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-text-muted mb-1">
            <span>{challenge.starUnit === 'Cp' ? `Cp: ${estimatedCp.toFixed(3)}` : `Power: ${powerOutput.toFixed(1)}W`}</span>
            <span>Target: {challenge.starUnit === 'Cp' ? t3.toFixed(2) : `${t3}W`} for ★★★</span>
          </div>
          <div className="h-1 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (metric / t3) * 100)}%`,
                background: liveStars >= 3 ? 'linear-gradient(90deg, #2dd4bf, #f472b6)' : liveStars >= 2 ? 'linear-gradient(90deg, #2dd4bf, #fbbf24)' : '#2dd4bf',
              }}
            />
          </div>
        </div>

        {/* Reveal button */}
        <button
          onClick={() => setMode('view')}
          className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-all border border-teal/30 text-teal hover:bg-teal/10"
        >
          ◇ Reveal 3D to check
        </button>
      </div>
    </div>
  )
}
