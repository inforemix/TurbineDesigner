import type { Vec2 } from '../stores/turbineStore'

/**
 * Generate a blade cross-section profile from parametric inputs.
 * Returns 7 control points in normalized [0,1] x-space.
 *
 * @param camber       Max curvature (y-offset peak), range 0→0.4
 * @param camberPeak   Where max camber occurs along chord, range 0.1→0.9
 * @param leRadius     Leading edge x-offset (bluntness), range 0→0.3
 * @param trailingSweep Trailing edge y-offset (forward/back sweep), range -0.3→0.3
 */
export function generateParametricProfile(
  camber: number,
  camberPeak: number,
  leRadius: number,
  trailingSweep: number,
): Vec2[] {
  const pts: Vec2[] = []

  // Leading edge
  pts.push({ x: Math.max(0, leRadius), y: 0 })

  // 5 interior points forming the camber arc
  const xStart = leRadius
  const xEnd = 1.0
  const span = xEnd - xStart

  for (let i = 1; i <= 5; i++) {
    const xNorm = i / 6                        // 0..1 across interior
    const x = xStart + xNorm * span
    // Asymmetric sine arc: peak placed at camberPeak fraction of span
    const sinArg = (xNorm <= camberPeak)
      ? (xNorm / camberPeak) * (Math.PI / 2)
      : Math.PI / 2 + ((xNorm - camberPeak) / (1 - camberPeak)) * (Math.PI / 2)
    const y = camber * Math.sin(sinArg)
    pts.push({ x: Math.min(1, Math.max(0, x)), y: Math.max(0, y) })
  }

  // Trailing edge
  pts.push({ x: 1, y: trailingSweep })

  return pts
}
