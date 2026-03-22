import { create } from 'zustand'
import { generateParametricProfile } from '../utils/profileGenerator'
import type { AirfoilPresetName } from '../utils/airfoil'
export type { AirfoilPresetName }

export interface Vec2 {
  x: number
  y: number
}

export type SymmetryMode = 'pinwheel' | 'snowflake' | 'helix' | 'freeform'
export type AppMode = 'draw' | 'side' | 'view'
export type BloomTier = 'dormant' | 'seedling' | 'flourishing' | 'radiant'

export type MaterialPreset = 'teal-metal' | 'brushed-steel' | 'bamboo-shader' | 'copper-patina' | 'frosted-glass' | 'matte-white' | 'neon-shader' | 'quantum-shader'

export interface MaterialConfig {
  label: string
  color: string
  metalness: number
  roughness: number
  opacity: number
  transparent: boolean
  emissiveIntensity: number
  emissiveColor?: string  // separate emissive color (defaults to base color)
  clearcoat?: number
}

// ── Saved custom airfoil profiles ─────────────────────────────────────────────
export interface CustomAirfoil {
  name: string
  m: number
  p: number
  t: number
}

const LS_AIRFOILS_KEY = 'turbinebloom_custom_airfoils'

function loadCustomAirfoils(): CustomAirfoil[] {
  try {
    const raw = localStorage.getItem(LS_AIRFOILS_KEY)
    if (raw) return JSON.parse(raw) as CustomAirfoil[]
  } catch { /* ignore */ }
  return []
}

function persistCustomAirfoils(a: CustomAirfoil[]) {
  try { localStorage.setItem(LS_AIRFOILS_KEY, JSON.stringify(a)) } catch { /* ignore */ }
}

// ── Saved designs ─────────────────────────────────────────────────────────────
export interface SavedDesign {
  name: string
  timestamp: number
  bladePoints: Vec2[]
  bladeCount: number
  height: number
  twist: number
  taper: number
  thickness: number
  symmetryMode: SymmetryMode
  materialPreset: MaterialPreset
  chordCurve: Vec2[]
  twistCurve: Vec2[]
  airfoilPreset: AirfoilPresetName
  customNacaM: number
  customNacaP: number
  customNacaT: number
  // legacy (kept for backward compat)
  airfoilUpper?: Vec2[]
  airfoilLower?: Vec2[]
}

const LS_DESIGNS_KEY = 'turbinebloom_v1_designs'

function loadPersistedDesigns(): SavedDesign[] {
  try {
    const raw = localStorage.getItem(LS_DESIGNS_KEY)
    if (raw) return JSON.parse(raw) as SavedDesign[]
  } catch { /* ignore */ }
  return []
}

function persistDesigns(designs: SavedDesign[]) {
  try { localStorage.setItem(LS_DESIGNS_KEY, JSON.stringify(designs)) } catch { /* ignore */ }
}

export const MATERIAL_PRESETS: Record<MaterialPreset, MaterialConfig> = {
  'teal-metal':    { label: 'Teal Metal',    color: '#2dd4bf', metalness: 0.55, roughness: 0.35, opacity: 1,   transparent: false, emissiveIntensity: 0 },
  'brushed-steel': { label: 'Brushed Steel', color: '#b0b8c8', metalness: 0.85, roughness: 0.25, opacity: 1,   transparent: false, emissiveIntensity: 0 },
  'bamboo-shader': { label: 'Bamboo',        color: '#8fad5a', metalness: 0,    roughness: 0,    opacity: 1,   transparent: false, emissiveIntensity: 0 },
  'copper-patina': { label: 'Copper Patina', color: '#6db89e', metalness: 0.7,  roughness: 0.45, opacity: 1,   transparent: false, emissiveIntensity: 0.05 },
  'frosted-glass': { label: 'Frosted Glass', color: '#c8e6f0', metalness: 0.1,  roughness: 0.15, opacity: 0.7, transparent: true,  emissiveIntensity: 0.1 },
  'matte-white':   { label: 'Matte White',   color: '#f0f0f0', metalness: 0.05, roughness: 0.9,  opacity: 1,   transparent: false, emissiveIntensity: 0 },
  'neon-shader':   { label: 'Neon Shader',   color: '#2dd4bf', metalness: 0,    roughness: 0,    opacity: 1,   transparent: false, emissiveIntensity: 0 },
  'quantum-shader': { label: 'Quantum',      color: '#06b6d4', metalness: 0,    roughness: 0,    opacity: 1,   transparent: false, emissiveIntensity: 0 },
}

// ── Neon Shader configuration ──────────────────────────────────────────────────
export type NeonPattern = 0 | 1 | 2 | 3 | 4  // wave | scanlines | grid | hex | circuit

export interface NeonConfig {
  colorA: string        // root/base color
  colorB: string        // tip/gradient color
  rimColor: string      // rim glow color
  pulseSpeed: number    // animation speed
  pulseFreq: number     // wave frequency along height
  pattern: NeonPattern  // 0=wave 1=scanlines 2=grid 3=hex 4=circuit
  fresnelPower: number  // rim glow sharpness
  opacity: number       // overall opacity
}

export const DEFAULT_NEON_CONFIG: NeonConfig = {
  colorA: '#0d5c63',
  colorB: '#7c3aed',
  rimColor: '#2dd4bf',
  pulseSpeed: 2.5,
  pulseFreq: 8,
  pattern: 0,
  fresnelPower: 1.8,
  opacity: 0.85,
}

// ── Bamboo Shader configuration ────────────────────────────────────────────────
export type BambooPattern = 0 | 1 | 2 | 3 | 4  // grain | nodes | rings | weave | lacquer

export interface BambooConfig {
  colorLight: string    // light bamboo tone
  colorDark: string     // dark bamboo tone (nodes/shadow)
  nodeSpacing: number   // spacing between bamboo nodes (height)
  grainStrength: number // intensity of longitudinal grain lines
  pattern: BambooPattern
  shininess: number     // surface gloss (0=matte, 1=lacquered)
  opacity: number
}

export const DEFAULT_BAMBOO_CONFIG: BambooConfig = {
  colorLight: '#c8b560',
  colorDark:  '#5a7a2a',
  nodeSpacing: 4.0,
  grainStrength: 0.55,
  pattern: 0,
  shininess: 0.4,
  opacity: 1.0,
}

// ── Quantum Shader configuration ───────────────────────────────────────────────
export type QuantumFlowType = 0 | 1 | 2 | 3  // radial | spiral | turbulence | vortex

export interface QuantumConfig {
  colorA: string        // primary quantum color
  colorB: string        // secondary quantum color
  colorC: string        // accent/glow color
  flowType: QuantumFlowType  // flow field distortion type
  flowSpeed: number     // animation speed
  flowIntensity: number // distortion strength
  pulseSpeed: number    // color shift speed
  noiseScale: number    // flow field granularity
  opacity: number       // overall opacity
}

export const DEFAULT_QUANTUM_CONFIG: QuantumConfig = {
  colorA: '#06b6d4',
  colorB: '#0891b2',
  colorC: '#06d6a0',
  flowType: 0,
  flowSpeed: 2.0,
  flowIntensity: 0.8,
  pulseSpeed: 3.0,
  noiseScale: 2.5,
  opacity: 0.9,
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

// Blade section: per-height overrides for twist and taper
export interface BladeSection {
  heightFraction: number // 0 (root) to 1 (tip)
  twistOffset: number   // degrees offset from global twist at this height
  taperScale: number    // multiplier (1.0 = no change)
}

const DEFAULT_SECTIONS: BladeSection[] = [
  { heightFraction: 0.0, twistOffset: 0, taperScale: 1.0 },
  { heightFraction: 0.25, twistOffset: 0, taperScale: 1.0 },
  { heightFraction: 0.5, twistOffset: 0, taperScale: 1.0 },
  { heightFraction: 0.75, twistOffset: 0, taperScale: 1.0 },
  { heightFraction: 1.0, twistOffset: 0, taperScale: 1.0 },
]

// Max undo history
const MAX_HISTORY = 50

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
  deleteBladePoint: (index: number) => void

  // Bezier tangent handles (one per blade point, {0,0} = auto Catmull-Rom)
  bladeHandles: Vec2[]
  updateBladeHandle: (index: number, handle: Vec2) => void
  resetBladeHandle: (index: number) => void
  resetAllHandles: () => void

  // Undo/redo (history-based, used by drawing ops)
  history: Vec2[][]
  historyIndex: number
  pushHistory: () => void

  // Drawing tools
  snapToGrid: boolean
  setSnapToGrid: (v: boolean) => void

  // Curve smoothing
  curveSmoothing: number
  setCurveSmoothing: (v: number) => void

  // Undo/Redo
  undoStack: Vec2[][]
  redoStack: Vec2[][]
  pushUndo: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // Blade sections (per-height twist/taper)
  bladeSections: BladeSection[]
  setBladeSections: (sections: BladeSection[]) => void
  updateBladeSection: (index: number, section: Partial<BladeSection>) => void
  addBladeSection: () => void
  removeBladeSection: (index: number) => void
  loadSectionPreset: (name: 'gorlov' | 'troposkein' | 'straight' | 'self-starter') => void
  resetBladeSections: () => void

  // 2.5D section view
  selectedSectionIndex: number
  setSelectedSectionIndex: (i: number) => void

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

  // Distribution curves (replace linear taper/twist)
  // x = height fraction 0→1, y = value
  chordCurve: Vec2[]   // y = chord scale 0.1→1.5
  setChordCurve: (pts: Vec2[]) => void
  twistCurve: Vec2[]   // y = twist fraction 0→1 (× 90°)
  setTwistCurve: (pts: Vec2[]) => void

  // Parametric profile mode
  parametricMode: boolean
  parametricCamber: number
  parametricCamberPeak: number
  parametricLeRadius: number
  parametricTrailingSweep: number
  setParametricMode: (v: boolean) => void
  setParametric: (field: string, value: number) => void
  applyParametric: () => void

  // Material
  materialPreset: MaterialPreset
  setMaterialPreset: (preset: MaterialPreset) => void
  neonConfig: NeonConfig
  setNeonConfig: (partial: Partial<NeonConfig>) => void
  bambooConfig: BambooConfig
  setBambooConfig: (partial: Partial<BambooConfig>) => void
  quantumConfig: QuantumConfig
  setQuantumConfig: (partial: Partial<QuantumConfig>) => void
  // Per-preset material attribute overrides (user customizations)
  materialOverrides: Partial<Record<MaterialPreset, Partial<MaterialConfig>>>
  setMaterialOverride: (preset: MaterialPreset, partial: Partial<MaterialConfig>) => void
  resetMaterialOverride: (preset: MaterialPreset) => void

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

  // Airfoil cross-section preset
  airfoilPreset: AirfoilPresetName
  setAirfoilPreset: (preset: AirfoilPresetName) => void
  customNacaM: number
  customNacaP: number
  customNacaT: number
  setCustomNaca: (m: number, p: number, t: number) => void
  customAirfoils: CustomAirfoil[]
  saveCustomAirfoil: (name: string) => void
  deleteCustomAirfoil: (name: string) => void
  // legacy
  airfoilUpper: Vec2[]
  airfoilLower: Vec2[]
  setAirfoilProfile: (upper: Vec2[], lower: Vec2[]) => void

  // Saved designs
  savedDesigns: SavedDesign[]
  saveDesign: (name: string) => void
  loadSavedDesign: (name: string) => void
  deleteDesign: (name: string) => void
}

function computeBloomTier(cp: number, windSpeed: number): BloomTier {
  const power = 0.5 * 1.225 * 1.0 * Math.pow(windSpeed, 3) * cp
  if (power < 5) return 'dormant'
  if (power < 50) return 'seedling'
  if (power < 200) return 'flourishing'
  return 'radiant'
}

export function estimateCpFromCurve(points: Vec2[], bladeCount: number): number {
  if (points.length < 2) return 0
  const maxCamber = Math.max(...points.map(p => p.y))
  const avgCamber = points.reduce((sum, p) => sum + p.y, 0) / points.length
  const solidity = bladeCount * avgCamber * 2

  const dragCp = Math.min(0.25, maxCamber * 0.8)
  const liftCp = Math.min(0.42, (1 - maxCamber) * 0.5 * Math.min(solidity, 1))
  return dragCp * 0.4 + liftCp * 0.6
}

let _skipHistoryPush = false

export const useTurbineStore = create<TurbineState>((set, get) => ({
  mode: 'draw',
  setMode: (mode) => set({ mode }),

  isTransitioning: false,
  transitionProgress: 0,
  setTransitioning: (v) => set({ isTransitioning: v }),
  setTransitionProgress: (v) => set({ transitionProgress: v }),

  bladePoints: [...PRESETS['Breeze Petal']],
  bladeHandles: PRESETS['Breeze Petal'].map(() => ({ x: 0, y: 0 })),
  setBladePoints: (pts) => {
    if (!_skipHistoryPush) get().pushHistory()
    // Resize handles: keep existing, fill new with zeros
    const prev = get().bladeHandles
    const handles = pts.map((_, i) => prev[i] ?? { x: 0, y: 0 })
    set({ bladePoints: pts, bladeHandles: handles, activePreset: null })
    get().updatePhysics()
  },
  addBladePoint: (pt) => {
    if (!_skipHistoryPush) get().pushHistory()
    const pts = [...get().bladePoints, pt]
    const handles = [...get().bladeHandles, { x: 0, y: 0 }]
    set({ bladePoints: pts, bladeHandles: handles, activePreset: null })
    get().updatePhysics()
  },
  updateBladePoint: (index, pt) => {
    if (!_skipHistoryPush) get().pushHistory()
    const pts = [...get().bladePoints]
    pts[index] = pt
    set({ bladePoints: pts, activePreset: null })
    get().updatePhysics()
  },
  clearBlade: () => {
    get().pushHistory()
    set({ bladePoints: [], bladeHandles: [], activePreset: null })
    get().updatePhysics()
  },
  deleteBladePoint: (index) => {
    get().pushHistory()
    const pts = get().bladePoints.filter((_, i) => i !== index)
    const handles = get().bladeHandles.filter((_, i) => i !== index)
    set({ bladePoints: pts, bladeHandles: handles, activePreset: null })
    get().updatePhysics()
  },
  updateBladeHandle: (index, handle) => {
    const handles = [...get().bladeHandles]
    handles[index] = handle
    set({ bladeHandles: handles })
  },
  resetBladeHandle: (index) => {
    const handles = [...get().bladeHandles]
    handles[index] = { x: 0, y: 0 }
    set({ bladeHandles: handles })
  },
  resetAllHandles: () => {
    set({ bladeHandles: get().bladePoints.map(() => ({ x: 0, y: 0 })) })
  },

  history: [],
  historyIndex: -1,
  pushHistory: () => {
    const { bladePoints, history, historyIndex } = get()
    const clone = bladePoints.map(p => ({ ...p }))
    const trimmed = history.slice(0, historyIndex + 1)
    const next = [...trimmed, clone].slice(-MAX_HISTORY)
    set({ history: next, historyIndex: next.length - 1 })
  },
  snapToGrid: false,
  setSnapToGrid: (v) => set({ snapToGrid: v }),

  curveSmoothing: 8,
  setCurveSmoothing: (v) => set({ curveSmoothing: v }),

  // Undo/Redo
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  pushUndo: () => {
    const { bladePoints, undoStack } = get()
    const newStack = [...undoStack, bladePoints.map(p => ({ ...p }))]
    if (newStack.length > MAX_HISTORY) newStack.shift()
    set({ undoStack: newStack, redoStack: [], canUndo: true, canRedo: false })
  },
  undo: () => {
    const { undoStack, bladePoints } = get()
    if (undoStack.length === 0) return
    const newUndo = [...undoStack]
    const prev = newUndo.pop()!
    const newRedo = [...get().redoStack, bladePoints.map(p => ({ ...p }))]
    set({
      bladePoints: prev,
      undoStack: newUndo,
      redoStack: newRedo,
      activePreset: null,
      canUndo: newUndo.length > 0,
      canRedo: true,
    })
    get().updatePhysics()
  },
  redo: () => {
    const { redoStack, bladePoints } = get()
    if (redoStack.length === 0) return
    const newRedo = [...redoStack]
    const next = newRedo.pop()!
    const newUndo = [...get().undoStack, bladePoints.map(p => ({ ...p }))]
    set({
      bladePoints: next,
      undoStack: newUndo,
      redoStack: newRedo,
      activePreset: null,
      canUndo: true,
      canRedo: newRedo.length > 0,
    })
    get().updatePhysics()
  },

  // Blade sections
  bladeSections: [...DEFAULT_SECTIONS],
  setBladeSections: (sections) => set({ bladeSections: sections }),
  updateBladeSection: (index, partial) => {
    const sections = [...get().bladeSections]
    sections[index] = { ...sections[index], ...partial }
    set({ bladeSections: sections })
  },
  addBladeSection: () => {
    const sections = get().bladeSections
    const last = sections[sections.length - 1]
    const newH = Math.min(1.0, last.heightFraction + 0.15)
    set({ bladeSections: [...sections, { heightFraction: newH, twistOffset: 0, taperScale: 1.0 }] })
  },
  removeBladeSection: (index) => {
    const sections = get().bladeSections
    if (sections.length <= 2) return
    set({ bladeSections: sections.filter((_, i) => i !== index) })
  },
  loadSectionPreset: (name) => {
    const presets: Record<string, BladeSection[]> = {
      gorlov: [
        { heightFraction: 0.0,  twistOffset:   0, taperScale: 1.1 },
        { heightFraction: 0.25, twistOffset:  30, taperScale: 1.0 },
        { heightFraction: 0.5,  twistOffset:  60, taperScale: 1.0 },
        { heightFraction: 0.75, twistOffset:  90, taperScale: 1.0 },
        { heightFraction: 1.0,  twistOffset: 120, taperScale: 0.9 },
      ],
      troposkein: [
        { heightFraction: 0.0,  twistOffset: 0, taperScale: 1.8 },
        { heightFraction: 0.25, twistOffset: 0, taperScale: 1.25 },
        { heightFraction: 0.5,  twistOffset: 0, taperScale: 1.0 },
        { heightFraction: 0.75, twistOffset: 0, taperScale: 1.25 },
        { heightFraction: 1.0,  twistOffset: 0, taperScale: 1.8 },
      ],
      straight: [
        { heightFraction: 0.0,  twistOffset: 0, taperScale: 1.0 },
        { heightFraction: 0.25, twistOffset: 0, taperScale: 1.0 },
        { heightFraction: 0.5,  twistOffset: 0, taperScale: 1.0 },
        { heightFraction: 0.75, twistOffset: 0, taperScale: 1.0 },
        { heightFraction: 1.0,  twistOffset: 0, taperScale: 1.0 },
      ],
      'self-starter': [
        { heightFraction: 0.0,  twistOffset:  8, taperScale: 1.5 },
        { heightFraction: 0.25, twistOffset:  5, taperScale: 1.3 },
        { heightFraction: 0.5,  twistOffset:  0, taperScale: 1.0 },
        { heightFraction: 0.75, twistOffset: -4, taperScale: 0.85 },
        { heightFraction: 1.0,  twistOffset: -8, taperScale: 0.65 },
      ],
    }
    const sections = presets[name] ?? presets.straight
    set({ bladeSections: sections })
  },
  resetBladeSections: () => set({ bladeSections: [...DEFAULT_SECTIONS] }),

  selectedSectionIndex: 2,
  setSelectedSectionIndex: (i) => set({ selectedSectionIndex: i }),

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
  thickness: 0.15,
  setThickness: (t) => set({ thickness: t }),

  chordCurve: [{ x: 0, y: 1.0 }, { x: 1, y: 1.0 }],
  setChordCurve: (pts) => set({ chordCurve: pts }),
  twistCurve: [{ x: 0, y: 0.0 }, { x: 1, y: 0.0 }],
  setTwistCurve: (pts) => set({ twistCurve: pts }),

  parametricMode: false,
  parametricCamber: 0.15,
  parametricCamberPeak: 0.4,
  parametricLeRadius: 0.05,
  parametricTrailingSweep: 0.0,
  setParametricMode: (v) => set({ parametricMode: v }),
  setParametric: (field, value) => {
    set({ [field]: value } as Partial<TurbineState>)
    get().applyParametric()
  },
  applyParametric: () => {
    const { parametricCamber, parametricCamberPeak, parametricLeRadius, parametricTrailingSweep } = get()
    const pts = generateParametricProfile(parametricCamber, parametricCamberPeak, parametricLeRadius, parametricTrailingSweep)
    _skipHistoryPush = true
    set({ bladePoints: pts, bladeHandles: pts.map(() => ({ x: 0, y: 0 })), activePreset: null })
    _skipHistoryPush = false
    get().updatePhysics()
  },

  materialPreset: 'teal-metal' as MaterialPreset,
  setMaterialPreset: (preset) => set({ materialPreset: preset }),
  neonConfig: { ...DEFAULT_NEON_CONFIG },
  setNeonConfig: (partial) => set(s => ({ neonConfig: { ...s.neonConfig, ...partial } })),
  bambooConfig: { ...DEFAULT_BAMBOO_CONFIG },
  setBambooConfig: (partial) => set(s => ({ bambooConfig: { ...s.bambooConfig, ...partial } })),
  quantumConfig: { ...DEFAULT_QUANTUM_CONFIG },
  setQuantumConfig: (partial) => set(s => ({ quantumConfig: { ...s.quantumConfig, ...partial } })),
  materialOverrides: {},
  setMaterialOverride: (preset, partial) => set(s => ({
    materialOverrides: { ...s.materialOverrides, [preset]: { ...(s.materialOverrides[preset] ?? {}), ...partial } }
  })),
  resetMaterialOverride: (preset) => set(s => {
    const next = { ...s.materialOverrides }
    delete next[preset]
    return { materialOverrides: next }
  }),

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
      get().pushHistory()
      get().pushUndo()
      set({ bladePoints: [...pts], bladeHandles: pts.map(() => ({ x: 0, y: 0 })), activePreset: name })
      get().updatePhysics()
    }
  },

  updatePhysics: () => {
    const { bladePoints, bladeCount, windSpeed } = get()
    const cp = estimateCpFromCurve(bladePoints, bladeCount)
    const optimalTSR = (4 * Math.PI) / bladeCount
    const sweptArea = 1.0
    const power = 0.5 * 1.225 * sweptArea * Math.pow(windSpeed, 3) * cp
    const tier = computeBloomTier(cp, windSpeed)
    set({
      estimatedCp: cp,
      currentTSR: optimalTSR,
      powerOutput: power,
      bloomTier: tier,
    })
  },

  // Airfoil preset
  airfoilPreset: 'symmetric' as AirfoilPresetName,
  setAirfoilPreset: (preset) => set({ airfoilPreset: preset }),
  customNacaM: 0.02,
  customNacaP: 0.4,
  customNacaT: 0.12,
  setCustomNaca: (m, p, t) => set({ customNacaM: m, customNacaP: p, customNacaT: t }),
  customAirfoils: loadCustomAirfoils(),
  saveCustomAirfoil: (name) => {
    const { customNacaM, customNacaP, customNacaT, customAirfoils } = get()
    const updated = [...customAirfoils.filter(a => a.name !== name), { name, m: customNacaM, p: customNacaP, t: customNacaT }]
    persistCustomAirfoils(updated)
    set({ customAirfoils: updated })
  },
  deleteCustomAirfoil: (name) => {
    const updated = get().customAirfoils.filter(a => a.name !== name)
    persistCustomAirfoils(updated)
    set({ customAirfoils: updated })
  },
  // legacy
  airfoilUpper: [],
  airfoilLower: [],
  setAirfoilProfile: (upper, lower) => set({ airfoilUpper: upper, airfoilLower: lower }),

  // Saved designs
  savedDesigns: loadPersistedDesigns(),
  saveDesign: (name) => {
    const s = get()
    const design: SavedDesign = {
      name,
      timestamp: Date.now(),
      bladePoints: s.bladePoints.map(p => ({ ...p })),
      bladeCount: s.bladeCount,
      height: s.height,
      twist: s.twist,
      taper: s.taper,
      thickness: s.thickness,
      symmetryMode: s.symmetryMode,
      materialPreset: s.materialPreset,
      chordCurve: s.chordCurve.map(p => ({ ...p })),
      twistCurve: s.twistCurve.map(p => ({ ...p })),
      airfoilPreset: s.airfoilPreset,
      customNacaM: s.customNacaM,
      customNacaP: s.customNacaP,
      customNacaT: s.customNacaT,
    }
    const designs = [...s.savedDesigns.filter(d => d.name !== name), design]
    persistDesigns(designs)
    set({ savedDesigns: designs })
  },
  loadSavedDesign: (name) => {
    const design = get().savedDesigns.find(d => d.name === name)
    if (!design) return
    get().pushUndo()
    set({
      bladePoints: design.bladePoints.map(p => ({ ...p })),
      bladeHandles: design.bladePoints.map(() => ({ x: 0, y: 0 })),
      bladeCount: design.bladeCount,
      height: design.height,
      twist: design.twist,
      taper: design.taper,
      thickness: design.thickness,
      symmetryMode: design.symmetryMode,
      materialPreset: design.materialPreset as MaterialPreset,
      chordCurve: design.chordCurve.map(p => ({ ...p })),
      twistCurve: design.twistCurve.map(p => ({ ...p })),
      airfoilPreset: design.airfoilPreset ?? 'symmetric',
      customNacaM: design.customNacaM ?? 0.02,
      customNacaP: design.customNacaP ?? 0.4,
      customNacaT: design.customNacaT ?? 0.12,
      activePreset: null,
    })
    get().updatePhysics()
  },
  deleteDesign: (name) => {
    const designs = get().savedDesigns.filter(d => d.name !== name)
    persistDesigns(designs)
    set({ savedDesigns: designs })
  },
}))
