export interface Point2D {
  x: number
  y: number
}

export interface AirfoilProfile {
  upper: Point2D[]
  lower: Point2D[]
  combined: Point2D[] // closed polygon: upper LE→TE, lower TE→LE
}

// ── Preset selector types ─────────────────────────────────────────────────────

export type AirfoilPresetName = 'symmetric' | 'cambered' | 'high-lift' | 'thin' | 'custom'

export interface AirfoilProfileData {
  label: string
  description: string
  upper: Point2D[]
  lower: Point2D[]
  maxHalfThick: number  // max (upper.y - lower.y) / 2, used for 3D scaling
  m: number
  p: number
  t: number
}

/** Build a named profile from NACA params */
export function buildProfileData(m: number, p: number, t: number, label: string, description: string): AirfoilProfileData {
  const profile = generateNACA4(m, p, t, 20)
  const maxHalfThick = Math.max(...profile.upper.map((u, i) => (u.y - (profile.lower[i]?.y ?? 0)) / 2), 0.001)
  return { label, description, upper: profile.upper, lower: profile.lower, maxHalfThick, m, p, t }
}

export const AIRFOIL_PROFILE_PRESETS: Record<Exclude<AirfoilPresetName, 'custom'>, AirfoilProfileData> = {
  'symmetric': buildProfileData(0,    0.4, 0.12, 'Symmetric', 'NACA 0012 — equal lift both sides'),
  'cambered':  buildProfileData(0.02, 0.4, 0.12, 'Cambered',  'NACA 2412 — moderate lift bias'),
  'high-lift': buildProfileData(0.04, 0.4, 0.12, 'High-Lift', 'NACA 4412 — max lift coefficient'),
  'thin':      buildProfileData(0,    0.4, 0.05, 'Thin',      'NACA 0005 — low drag, flat'),
}

/** Interpolate a surface (upper or lower) at chord position x */
export function interpSurface(pts: Point2D[], x: number): number {
  if (pts.length === 0) return 0
  if (x <= pts[0].x) return pts[0].y
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i + 1].x >= x) {
      const frac = (x - pts[i].x) / (pts[i + 1].x - pts[i].x)
      return pts[i].y + frac * (pts[i + 1].y - pts[i].y)
    }
  }
  return 0
}

/**
 * Returns normalized half-thickness at chord position x.
 * Value in [0, 1] where 1 = thickest point of the profile.
 */
export function halfThickNorm(profile: AirfoilProfileData, x: number): number {
  if (profile.maxHalfThick <= 0) return 0
  const yt = (interpSurface(profile.upper, x) - interpSurface(profile.lower, x)) / 2
  return yt / profile.maxHalfThick
}

/** Get the active profile for rendering/mesh generation */
export function resolveProfileData(
  preset: AirfoilPresetName,
  customM: number,
  customP: number,
  customT: number,
): AirfoilProfileData {
  if (preset === 'custom') return buildProfileData(customM, customP, customT, 'Custom', 'Custom NACA profile')
  return AIRFOIL_PROFILE_PRESETS[preset]
}



/**
 * Generate a NACA 4-digit airfoil (e.g. NACA 2412 → m=0.02, p=0.4, t=0.12).
 * @param m  max camber as fraction of chord (0–0.09)
 * @param p  position of max camber as fraction of chord (0.1–0.9)
 * @param t  max thickness as fraction of chord (0.01–0.40)
 * @param numPoints  number of points per surface (upper/lower)
 */
export function generateNACA4(
  m: number,
  p: number,
  t: number,
  numPoints = 60
): AirfoilProfile {
  // Cosine spacing for better LE resolution
  const xCoords = Array.from({ length: numPoints + 1 }, (_, i) => {
    return (1 - Math.cos((i * Math.PI) / numPoints)) / 2
  })

  const upper: Point2D[] = []
  const lower: Point2D[] = []

  for (const x of xCoords) {
    const yt =
      5 *
      t *
      (0.2969 * Math.sqrt(x) -
        0.1260 * x -
        0.3516 * x ** 2 +
        0.2843 * x ** 3 -
        0.1015 * x ** 4)

    let yc: number
    let dyc_dx: number

    if (m === 0 || p === 0) {
      yc = 0
      dyc_dx = 0
    } else if (x < p) {
      yc = (m / p ** 2) * (2 * p * x - x ** 2)
      dyc_dx = (2 * m) / p ** 2 * (p - x)
    } else {
      yc = (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x ** 2)
      dyc_dx = (2 * m) / (1 - p) ** 2 * (p - x)
    }

    const theta = Math.atan(dyc_dx)
    upper.push({ x: x - yt * Math.sin(theta), y: yc + yt * Math.cos(theta) })
    lower.push({ x: x + yt * Math.sin(theta), y: yc - yt * Math.cos(theta) })
  }

  // Closed polygon: upper surface LE→TE, then lower surface TE→LE
  const combined: Point2D[] = [
    ...upper,
    ...[...lower].reverse().slice(1),
  ]

  return { upper, lower, combined }
}

/**
 * Parse a NACA 4-digit string like "2412" into {m, p, t}.
 */
export function parseNACA4(code: string): { m: number; p: number; t: number } {
  const d = code.padStart(4, "0")
  return {
    m: parseInt(d[0]) / 100,
    p: parseInt(d[1]) / 10,
    t: parseInt(d.slice(2)) / 100,
  }
}

/**
 * Preset airfoil library for VAWT blade section choices.
 */
export const AIRFOIL_PRESETS: {
  label: string
  code: string
  m: number
  p: number
  t: number
}[] = [
  { label: "NACA 0012 (symmetric)", code: "0012", m: 0, p: 0, t: 0.12 },
  { label: "NACA 0015 (symmetric)", code: "0015", m: 0, p: 0, t: 0.15 },
  { label: "NACA 0018 (symmetric)", code: "0018", m: 0, p: 0, t: 0.18 },
  { label: "NACA 0021 (symmetric)", code: "0021", m: 0, p: 0, t: 0.21 },
  { label: "NACA 2412", code: "2412", m: 0.02, p: 0.4, t: 0.12 },
  { label: "NACA 4412", code: "4412", m: 0.04, p: 0.4, t: 0.12 },
  { label: "NACA 6412", code: "6412", m: 0.06, p: 0.4, t: 0.12 },
  { label: "NACA 4415", code: "4415", m: 0.04, p: 0.4, t: 0.15 },
]

/**
 * Scale a normalized airfoil profile to a given chord length.
 */
export function scaleProfile(profile: Point2D[], chord: number): Point2D[] {
  return profile.map((p) => ({ x: p.x * chord, y: p.y * chord }))
}

/**
 * Rotate a 2D point array by `angleDeg` degrees around the origin.
 */
export function rotateProfile(
  profile: Point2D[],
  angleDeg: number
): Point2D[] {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return profile.map((p) => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }))
}
