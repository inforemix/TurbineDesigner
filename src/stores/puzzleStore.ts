import { create } from 'zustand'
import { CHALLENGES } from '../data/challenges'
import { useTurbineStore } from './turbineStore'

const STORAGE_KEY = 'turbinebloom-puzzle-progress'

function loadProgress(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveProgress(completed: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
  } catch {
    // ignore
  }
}

interface PuzzleState {
  activeChallengeId: string | null
  completedChallenges: Record<string, number> // id → stars earned
  showChallengeList: boolean

  celebrationActive: boolean
  celebrationStars: number
  celebrationTitle: string
  celebrationId: string | null

  setActiveChallenge: (id: string | null) => void
  setShowChallengeList: (v: boolean) => void
  checkCompletion: () => void
  dismissCelebration: () => void
  isChallengeUnlocked: (id: string) => boolean
}

export const usePuzzleStore = create<PuzzleState>((set, get) => ({
  activeChallengeId: null,
  completedChallenges: loadProgress(),
  showChallengeList: false,

  celebrationActive: false,
  celebrationStars: 0,
  celebrationTitle: '',
  celebrationId: null,

  setActiveChallenge: (id) => set({ activeChallengeId: id, showChallengeList: false }),
  setShowChallengeList: (v) => set({ showChallengeList: v }),

  dismissCelebration: () => set({ celebrationActive: false }),

  isChallengeUnlocked: (id) => {
    const challenge = CHALLENGES.find(c => c.id === id)
    if (!challenge) return false
    if (!challenge.unlockAfter) return true
    const { completedChallenges } = get()
    return (completedChallenges[challenge.unlockAfter] ?? 0) > 0
  },

  checkCompletion: () => {
    const { activeChallengeId, completedChallenges, celebrationActive } = get()
    if (!activeChallengeId || celebrationActive) return

    const challenge = CHALLENGES.find(c => c.id === activeChallengeId)
    if (!challenge) return

    const store = useTurbineStore.getState()
    const { bladePoints, bladeCount, symmetryMode, twist, powerOutput, estimatedCp, bloomTier } = store

    // Check all objectives
    const allPassed = challenge.objectives.every(obj => {
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

    if (!allPassed) return

    // Calculate stars
    const metric = challenge.starUnit === 'Cp' ? estimatedCp : powerOutput
    const [, t2, t3] = challenge.starThresholds
    const stars = metric >= t3 ? 3 : metric >= t2 ? 2 : 1

    // Only celebrate if it's a new best
    const prevStars = completedChallenges[activeChallengeId] ?? 0
    if (stars > prevStars) {
      const updated = { ...completedChallenges, [activeChallengeId]: stars }
      saveProgress(updated)
      set({
        completedChallenges: updated,
        celebrationActive: true,
        celebrationStars: stars,
        celebrationTitle: challenge.title,
        celebrationId: activeChallengeId,
      })
    }
  },
}))
