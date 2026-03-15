export interface ChallengeObjective {
  type: 'min_power' | 'min_cp' | 'exact_blades' | 'min_blades' | 'bloom_tier' | 'min_points' | 'min_twist' | 'exact_symmetry'
  value: number | string
  label: string
}

export interface Challenge {
  id: string
  title: string
  subtitle: string
  description: string
  windSpeedHint: number
  objectives: ChallengeObjective[]
  starThresholds: [number, number, number] // power for 1/2/3 stars (or cp for efficiency)
  starUnit: 'W' | 'Cp'
  unlockAfter: string | null
  icon: string
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'first-breath',
    title: 'First Breath',
    subtitle: 'Getting Started',
    description: 'Shape your first blade and watch the wind begin to flow. Place at least 3 control points and generate any power.',
    windSpeedHint: 5,
    objectives: [
      { type: 'min_points', value: 3, label: 'Place 3+ control points' },
      { type: 'min_power', value: 0.1, label: 'Generate any power' },
    ],
    starThresholds: [0.1, 10, 30],
    starUnit: 'W',
    unlockAfter: null,
    icon: '🌱',
  },
  {
    id: 'spark',
    title: 'Spark of Light',
    subtitle: 'Power Up',
    description: 'Design a blade that generates enough energy to power a small LED. Aim for 5W at moderate wind.',
    windSpeedHint: 5,
    objectives: [
      { type: 'min_power', value: 5, label: 'Power ≥ 5W' },
    ],
    starThresholds: [5, 15, 30],
    starUnit: 'W',
    unlockAfter: 'first-breath',
    icon: '⚡',
  },
  {
    id: 'seedling',
    title: 'Seedling',
    subtitle: 'Bloom Rising',
    description: 'Reach the Seedling bloom tier. Your turbine must consistently generate 50W or more.',
    windSpeedHint: 6,
    objectives: [
      { type: 'bloom_tier', value: 'seedling', label: 'Reach Seedling tier' },
      { type: 'min_power', value: 50, label: 'Power ≥ 50W' },
    ],
    starThresholds: [50, 100, 160],
    starUnit: 'W',
    unlockAfter: 'spark',
    icon: '🌿',
  },
  {
    id: 'three-company',
    title: "Three's Company",
    subtitle: 'Blade Count Challenge',
    description: 'Use exactly 3 blades and achieve at least 50W. The classic three-blade design dominates real turbines for good reason.',
    windSpeedHint: 6,
    objectives: [
      { type: 'exact_blades', value: 3, label: 'Use exactly 3 blades' },
      { type: 'min_power', value: 50, label: 'Power ≥ 50W' },
    ],
    starThresholds: [50, 100, 150],
    starUnit: 'W',
    unlockAfter: 'seedling',
    icon: '🔱',
  },
  {
    id: 'efficiency',
    title: 'Efficiency Seeker',
    subtitle: 'Betz Limit Chase',
    description: "Maximize your power coefficient Cp. The Betz limit is 0.593 — see how close you can get. Even 0.30 is impressive!",
    windSpeedHint: 8,
    objectives: [
      { type: 'min_cp', value: 0.3, label: 'Cp ≥ 0.30' },
    ],
    starThresholds: [0.30, 0.36, 0.42],
    starUnit: 'Cp',
    unlockAfter: 'three-company',
    icon: '📐',
  },
  {
    id: 'minimalist',
    title: 'Minimalist',
    subtitle: 'Less is More',
    description: 'Can you generate 50W with only 2 blades? Fewer blades spin faster but capture less energy — find the balance.',
    windSpeedHint: 7,
    objectives: [
      { type: 'exact_blades', value: 2, label: 'Use exactly 2 blades' },
      { type: 'min_power', value: 50, label: 'Power ≥ 50W' },
    ],
    starThresholds: [50, 80, 120],
    starUnit: 'W',
    unlockAfter: 'efficiency',
    icon: '✂️',
  },
  {
    id: 'storm-rider',
    title: 'Storm Rider',
    subtitle: 'High Wind Power',
    description: 'Crank the wind up to 10 m/s and design a turbine to survive the gale. Generate 200W in storm conditions.',
    windSpeedHint: 10,
    objectives: [
      { type: 'min_power', value: 200, label: 'Power ≥ 200W' },
    ],
    starThresholds: [200, 350, 500],
    starUnit: 'W',
    unlockAfter: 'minimalist',
    icon: '🌪️',
  },
  {
    id: 'helix-master',
    title: 'Helix Master',
    subtitle: 'Spiral Form',
    description: 'Switch to Helical symmetry and generate 80W. Helical blades reduce noise and look incredible.',
    windSpeedHint: 7,
    objectives: [
      { type: 'exact_symmetry', value: 'helix', label: 'Use Helical symmetry' },
      { type: 'min_power', value: 80, label: 'Power ≥ 80W' },
    ],
    starThresholds: [80, 140, 200],
    starUnit: 'W',
    unlockAfter: 'storm-rider',
    icon: '🌀',
  },
  {
    id: 'twisted-genius',
    title: 'Twisted Genius',
    subtitle: 'Aerodynamic Twist',
    description: 'Apply at least 45° of blade twist and still generate 100W. Twisted blades maintain optimal angle of attack at all heights.',
    windSpeedHint: 8,
    objectives: [
      { type: 'min_twist', value: 45, label: 'Blade twist ≥ 45°' },
      { type: 'min_power', value: 100, label: 'Power ≥ 100W' },
    ],
    starThresholds: [100, 180, 260],
    starUnit: 'W',
    unlockAfter: 'helix-master',
    icon: '🔄',
  },
  {
    id: 'radiant-master',
    title: 'Radiant Master',
    subtitle: 'Peak Bloom',
    description: 'Achieve the legendary Radiant bloom tier. Your turbine must produce 200W+ consistently. The ultimate design challenge.',
    windSpeedHint: 10,
    objectives: [
      { type: 'bloom_tier', value: 'radiant', label: 'Reach Radiant tier' },
      { type: 'min_power', value: 200, label: 'Power ≥ 200W' },
    ],
    starThresholds: [200, 400, 700],
    starUnit: 'W',
    unlockAfter: 'twisted-genius',
    icon: '✨',
  },
]
