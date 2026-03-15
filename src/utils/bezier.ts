import type { Vec2 } from '../stores/turbineStore'

/**
 * Ramer-Douglas-Peucker path simplification algorithm.
 * Reduces a dense array of points to key control points while preserving shape.
 */
export function simplifyPath(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length <= 2) return [...points]

  // Find the point with the maximum distance from the line (first → last)
  const first = points[0]
  const last = points[points.length - 1]
  let maxDist = 0
  let maxIdx = 0

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last)
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), epsilon)
    const right = simplifyPath(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  } else {
    return [first, last]
  }
}

function perpendicularDistance(point: Vec2, lineStart: Vec2, lineEnd: Vec2): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    const ex = point.x - lineStart.x
    const ey = point.y - lineStart.y
    return Math.sqrt(ex * ex + ey * ey)
  }

  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq))
  const projX = lineStart.x + t * dx
  const projY = lineStart.y + t * dy
  const ex = point.x - projX
  const ey = point.y - projY
  return Math.sqrt(ex * ex + ey * ey)
}
