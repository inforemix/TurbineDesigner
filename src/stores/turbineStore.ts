import { create } from 'zustand'

export interface Vec2 {
  x: number
  y: number
}

export type SymmetryMode = 'pinwheel' | 'snowflake' | 'helix' | 'freeform'
export type AppMode = 'draw' | 'view'
export type BloomTier = 'dormant' | 'seedling' | 'flourishing' | 'radiant'

export type MaterialPreset = 'teal-metal' | 'brushed-steel' | 'carbon-fiber' | 'copper-patina' | 'frosted-glass' | 'matte-white'

export interface MaterialConfig {
  label: string
  color: string
  metalness: number
  roughness: number
  opacity: number
  transparent: boolean
  emissiveIntensity: number
}

export const MATERIAL_PRESETS: Record<MaterialPreset, MaterialConfig> = {
  'teal-metal': { label: 'Teal Metal', color: '#2dd4bf', metalness: 0.55, roughness: 0.35, opacity: 1, transparent: false, emissiveIntensity: 0 },
  'brushed-steel': { label: 'Brushed Steel', color: '#b0b8c8', metalness: 0.85, roughness: 0.25, opacity: 1, transparent: false, emissiveIntensity: 0 },
  'carbon-fiber': { label: 'Carbon Fiber', color: '#2a2a2a', metalness: 0.3, roughness: 0.6, opacity: 1, transparent: false, emissiveIntensity: 0 },
  'copper-patina': { label: 'Copper Patina', color: '#6db89e', metalness: 0.7, roughness: 0.45, opacity: 1, transparent: false, emissiveIntensity: 0.05 },
  'frosted-glass': { label: 'Frosted Glass', color: '#c8e6f0', metalness: 0.1, roughness: 0.15, opacity: 0.7, transparent: true, emissiveIntensity: 0.1 },
  'matte-white': { label: 'Matte White', color: '#f0f0f0', metalness: 0.05, roughness: 0.9, opacity: 1, transparent: false, emissiveIntensity: 0 },
}

// Preset blade curves
const PRESETS: Record<string, Vec2[]> = {
  'Breeze Petal': [
    { x: 0.0, y: 0.05 },
    { x: 0.15, y: 0.12 },
    { x: 0.35, y: 0.18 },
    { x: 0.55, y: 0.15 },
    { x: 0.75, y: 0.08 },
    { x: 0.95, y: 0.02 },
  ],
  'Storm Scoop': [
    { x: 0.0, y: 0.02 },
    { x: 0.1, y: 0.2 },
    { x: 0.25, y: 0.35 },
    { x: 0.45, y: 0.3 },
    { x: 0.65, y: 0.18 },
    { x: 0.85, y: 0.05 },
  ],
  'Zephyr Wing': [
    { x: 0.0, y: 0.03 },
    { x: 0.2, y: 0.08 },
    { x: 0.4, y: 0.14 },
    { x: 0.6, y: 0.12 },
    { x: 0.8, y: 0.06 },
    { x: 1.0, y: 0.01 },
  ],
  'Typhoon Sail': [
    { x: 0.0, y: 0.04 },
    { x: 0.12, y: 0.25 },
    { x: 0.3, y: 0.4 },
    { x: 0.5, y: 0.35 },
    { x: 0.7, y: 0.2 },
    { x: 0.9, y: 0.03 },
  ],
  'Lotus Blade': [
    { x: 0.0, y: 0.06 },
    { x: 0.15, y: 0.15 },
    { x: 0.3, y: 0.22 },
    { x: 0.5, y: 0.22 },
    { x: 0.7, y: 0.15 },
    { x: 0.9, y: 0.06 },
  ],
}

interface TurbineState {
  // App mode
  mode: AppMode
  setMode: (mode: AppMode) => void

  // Transition animation
  isTransitioning: boolean
  transitionProgress: number
  setTransitioning: (v: boolean) => void
  setTransitionProgress: (v: number) => void

  // Blade curve (normalized 0-1 space)
  bladePoints: Vec2[]
  setBladePoints: (pts: Vec2[]) => void
  addBladePoint: (pt: Vec2) => void
  updateBladePoint: (index: number, pt: Vec2) => void
  clearBlade: () => void

  // Symmetry
  bladeCount: number
  setBladeCount: (n: number) => void
  symmetryMode: SymmetryMode
  setSymmetryMode: (mode: SymmetryMode) => void

  // Extrusion params
  height: number
  setHeight: (h: number) => void
  twist: number
  setTwist: (t: number) => void
  taper: number
  setTaper: (t: number) => void
  thickness: number
  setThickness: (t: number) => void

  // Material
  materialPreset: MaterialPreset
  setMaterialPreset: (preset: MaterialPreset) => void

  // Wind simulation
  windSpeed: number
  setWindSpeed: (s: number) => void
  isSpinning: boolean
  setIsSpinning: (s: boolean) => void

  // Physics feedback
  bloomTier: BloomTier
  currentTSR: number
  estimatedCp: number
  powerOutput: number

  // Presets
  presetNames: string[]
  loadPreset: (name: string) => void
  activePreset: string | null

  // Computed physics update
  updatePhysics: () => void
}

function computeBloomTier(cp: number, windSpeed: number): BloomTier {
  const power = 0.5 * 1.225 * 1.0 * Math.pow(windSpeed, 3) * cp
  if (power < 5) return 'dormant'
  if (power < 50) return 'seedling'
  if (power < 200) return 'flourishing'
  return 'radiant'
}

function estimateCpFromCurve(points: Vec2[], bladeCount: number): number {
  if (points.length < 2) return 0
  // Simple heuristic: more camber = better drag capture, airfoil shape = better lift
  const maxCamber = Math.max(...points.map(p => p.y))
  const avgCamber = points.reduce((sum, p) => sum + p.y, 0) / points.length
  const solidity = bladeCount * avgCamber * 2 // rough chord/radius

  // Blend between drag-type and lift-type Cp curves
  const dragCp = Math.min(0.25, maxCamber * 0.8)
  const liftCp = Math.min(0.42, (1 - maxCamber) * 0.5 * Math.min(solidity, 1))
  return dragCp * 0.4 + liftCp * 0.6
}

export const useTurbineStore = create<TurbineState>((set, get) => ({
  mode: 'draw',
  setMode: (mode) => set({ mode }),

  isTransitioning: false,
  transitionProgress: 0,
  setTransitioning: (v) => set({ isTransitioning: v }),
  setTransitionProgress: (v) => set({ transitionProgress: v }),

  bladePoints: [...PRESETS['Breeze Petal']],
  setBladePoints: (pts) => { set({ bladePoints: pts, activePreset: null }); get().updatePhysics() },
  addBladePoint: (pt) => {
    const pts = [...get().bladePoints, pt]
    set({ bladePoints: pts, activePreset: null })
    get().updatePhysics()
  },
  updateBladePoint: (index, pt) => {
    const pts = [...get().bladePoints]
    pts[index] = pt
    set({ bladePoints: pts, activePreset: null })
    get().updatePhysics()
  },
  clearBlade: () => set({ bladePoints: [], activePreset: null }),

  bladeCount: 3,
  setBladeCount: (n) => { set({ bladeCount: n }); get().updatePhysics() },
  symmetryMode: 'pinwheel',
  setSymmetryMode: (mode) => set({ symmetryMode: mode }),

  height: 1.5,
  setHeight: (h) => set({ height: h }),
  twist: 0,
  setTwist: (t) => set({ twist: t }),
  taper: 0,
  setTaper: (t) => set({ taper: t }),
  thickness: 0.06,
  setThickness: (t) => set({ thickness: t }),

  materialPreset: 'teal-metal' as MaterialPreset,
  setMaterialPreset: (preset) => set({ materialPreset: preset }),

  windSpeed: 6,
  setWindSpeed: (s) => { set({ windSpeed: s }); get().updatePhysics() },
  isSpinning: true,
  setIsSpinning: (s) => set({ isSpinning: s }),

  bloomTier: 'seedling',
  currentTSR: 3.0,
  estimatedCp: 0.2,
  powerOutput: 0,

  presetNames: Object.keys(PRESETS),
  activePreset: 'Breeze Petal',
  loadPreset: (name) => {
    const pts = PRESETS[name]
    if (pts) {
      set({ bladePoints: [...pts], activePreset: name })
      get().updatePhysics()
    }
  },

  updatePhysics: () => {
    const { bladePoints, bladeCount, windSpeed } = get()
    const cp = estimateCpFromCurve(bladePoints, bladeCount)
    const optimalTSR = (4 * Math.PI) / bladeCount
    const sweptArea = 1.0 // normalized
    const power = 0.5 * 1.225 * sweptArea * Math.pow(windSpeed, 3) * cp
    const tier = computeBloomTier(cp, windSpeed)
    set({
      estimatedCp: cp,
      currentTSR: optimalTSR,
      powerOutput: power,
      bloomTier: tier,
    })
  },
}))
