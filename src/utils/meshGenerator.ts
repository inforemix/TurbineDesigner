import * as THREE from 'three'
import type { Vec2 } from '../stores/turbineStore'
import { catmullRomSpline, sampleCurve } from './spline'

/**
 * Generate a 3D VAWT mesh from blade curve + parameters
 */
export function generateTurbineMesh(
  bladePoints: Vec2[],
  bladeCount: number,
  height: number,
  twist: number,
  taper: number,
  thickness: number,
  chordCurve?: Vec2[],
  twistCurve?: Vec2[],
): THREE.Group {
  const group = new THREE.Group()

  if (bladePoints.length < 2) return group

  // Smooth the blade curve
  const smoothPoints = catmullRomSpline(bladePoints, 8)

  // Shaft (central column)
  const shaftRadius = 0.04
  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, height * 1.3, 16)
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    metalness: 0.8,
    roughness: 0.3,
  })
  const shaft = new THREE.Mesh(shaftGeo, shaftMat)
  shaft.position.y = height * 0.65
  group.add(shaft)

  // Generate blades
  const angleStep = (2 * Math.PI) / bladeCount
  const bladeRadius = 0.6 // max reach of blade

  for (let b = 0; b < bladeCount; b++) {
    const bladeAngle = angleStep * b
    const bladeMesh = createBlade(
      smoothPoints,
      bladeRadius,
      height,
      twist,
      taper,
      thickness,
      b,
      chordCurve,
      twistCurve,
    )
    bladeMesh.rotation.y = bladeAngle
    group.add(bladeMesh)
  }

  // Top strut ring
  const strutRingGeo = new THREE.TorusGeometry(0.15, 0.012, 8, 32)
  const strutMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.7,
    roughness: 0.4,
  })
  const topRing = new THREE.Mesh(strutRingGeo, strutMat)
  topRing.position.y = height * 1.05
  topRing.rotation.x = Math.PI / 2
  group.add(topRing)

  const bottomRing = new THREE.Mesh(strutRingGeo, strutMat)
  bottomRing.position.y = height * 0.25
  bottomRing.rotation.x = Math.PI / 2
  group.add(bottomRing)

  // Struts connecting blades to shaft
  for (let b = 0; b < bladeCount; b++) {
    const angle = angleStep * b
    for (const yPos of [height * 0.25, height * 1.05]) {
      const strutGeo = new THREE.CylinderGeometry(0.008, 0.008, bladeRadius * 0.5, 6)
      const strut = new THREE.Mesh(strutGeo, strutMat)
      strut.position.set(
        Math.cos(angle) * bladeRadius * 0.25,
        yPos,
        Math.sin(angle) * bladeRadius * 0.25
      )
      strut.rotation.z = Math.PI / 2
      strut.rotation.y = -angle
      group.add(strut)
    }
  }

  return group
}

function createBlade(
  curvePoints: Vec2[],
  radius: number,
  height: number,
  twist: number,
  taper: number,
  _thickness: number,
  bladeIndex: number,
  chordCurve?: Vec2[],
  twistCurve?: Vec2[],
): THREE.Mesh {
  const heightSegments = 24
  const curveSegments = curvePoints.length

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  // For each height slice, create a cross-section from the blade curve
  for (let h = 0; h <= heightSegments; h++) {
    const hFrac = h / heightSegments
    const y = height * 0.25 + hFrac * height * 0.8

    // Twist and taper at this height
    const defaultChord: Vec2[] = [{ x: 0, y: 1 - taper * Math.abs(0 - 0.5) * 2 }, { x: 1, y: 1 - taper * Math.abs(1 - 0.5) * 2 }]
    const defaultTwist: Vec2[] = [{ x: 0, y: 0 }, { x: 1, y: twist / 90 }]
    const taperScale = sampleCurve(chordCurve ?? defaultChord, hFrac)
    const twistAngle = sampleCurve(twistCurve ?? defaultTwist, hFrac) * 90 * (Math.PI / 180)

    for (let c = 0; c < curveSegments; c++) {
      const pt = curvePoints[c]

      // Map curve to 3D: x -> radial distance, y -> camber/thickness
      const radialDist = pt.x * radius * taperScale
      const camber = pt.y * radius * taperScale

      // Apply twist
      const cos = Math.cos(twistAngle)
      const sin = Math.sin(twistAngle)

      const localX = radialDist
      const localZ = camber

      const worldX = localX * cos - localZ * sin
      const worldZ = localX * sin + localZ * cos

      positions.push(worldX, y, worldZ)

      // Simple normal pointing outward
      const nx = camber > 0 ? 0.3 : -0.3
      normals.push(nx, 0, 1)
    }
  }

  // Generate indices (triangle strip between height slices)
  for (let h = 0; h < heightSegments; h++) {
    for (let c = 0; c < curveSegments - 1; c++) {
      const a = h * curveSegments + c
      const b = a + curveSegments
      const c1 = a + 1
      const d = b + 1

      indices.push(a, b, c1)
      indices.push(c1, b, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  // Blade material - teal metallic
  const hueShift = bladeIndex * 0.03
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.47 + hueShift, 0.6, 0.45),
    metalness: 0.5,
    roughness: 0.4,
    side: THREE.DoubleSide,
  })

  return new THREE.Mesh(geometry, material)
}

/**
 * Export turbine as GLB
 */
export async function exportToGLB(group: THREE.Group): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: 'model/gltf-binary' }))
        } else {
          const json = JSON.stringify(result)
          resolve(new Blob([json], { type: 'application/json' }))
        }
      },
      reject,
      { binary: true }
    )
  })
}
