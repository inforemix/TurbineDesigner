import type { Vec2 } from '../stores/turbineStore'

/**
 * Evaluate Catmull-Rom spline through control points
 * Returns an array of interpolated points for smooth rendering
 */
export function catmullRomSpline(
  points: Vec2[],
  segmentsPerSpan: number = 12,
  tension: number = 0.5
): Vec2[] {
  if (points.length < 2) return [...points]
  if (points.length === 2) {
    const result: Vec2[] = []
    for (let i = 0; i <= segmentsPerSpan; i++) {
      const t = i / segmentsPerSpan
      result.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t,
      })
    }
    return result
  }

  const result: Vec2[] = []
  const n = points.length

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[Math.min(n - 1, i + 1)]
    const p3 = points[Math.min(n - 1, i + 2)]

    for (let j = 0; j < segmentsPerSpan; j++) {
      const t = j / segmentsPerSpan
      const t2 = t * t
      const t3 = t2 * t

      const x =
        tension * (
          (-t3 + 2 * t2 - t) * p0.x +
          (3 * t3 - 5 * t2 + 2) * p1.x +
          (-3 * t3 + 4 * t2 + t) * p2.x +
          (t3 - t2) * p3.x
        ) * 0.5 +
        (1 - tension) * (p1.x + (p2.x - p1.x) * t)

      const y =
        tension * (
          (-t3 + 2 * t2 - t) * p0.y +
          (3 * t3 - 5 * t2 + 2) * p1.y +
          (-3 * t3 + 4 * t2 + t) * p2.y +
          (t3 - t2) * p3.y
        ) * 0.5 +
        (1 - tension) * (p1.y + (p2.y - p1.y) * t)

      result.push({ x, y })
    }
  }
  // Add last point
  result.push(points[n - 1])
  return result
}

/**
 * Mirror a set of 2D points around the origin N times for kaleidoscope effect
 */
export function mirrorPoints(
  points: Vec2[],
  bladeCount: number,
  centerX: number,
  centerY: number,
  radius: number
): Vec2[][] {
  const mirrored: Vec2[][] = []
  const angleStep = (2 * Math.PI) / bladeCount

  for (let b = 0; b < bladeCount; b++) {
    const angle = angleStep * b
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const blade: Vec2[] = points.map((p) => {
      // Map p.x from [0,1] to radial distance, p.y to perpendicular offset
      const radialDist = p.x * radius
      const perpOffset = p.y * radius

      // Blade local coords (radial out, perpendicular right)
      const localX = radialDist
      const localY = perpOffset

      // Rotate into world
      return {
        x: centerX + localX * cos - localY * sin,
        y: centerY + localX * sin + localY * cos,
      }
    })
    mirrored.push(blade)
  }

  return mirrored
}
