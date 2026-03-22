import * as THREE from 'three'
import type { Vec2, BladeSection, MaterialPreset, MaterialConfig, SymmetryMode } from '../stores/turbineStore'
import { MATERIAL_PRESETS } from '../stores/turbineStore'
import { catmullRomSplineWithHandles } from './spline'
import { resolveProfileData, halfThickNorm } from './airfoil'
import type { AirfoilPresetName } from './airfoil'

/**
 * Full parameters for GLB export — mirrors TurbineViewer.TurbineMesh exactly
 */
export interface ExportParams {
  bladePoints: Vec2[]
  bladeHandles: Vec2[]
  bladeCount: number
  height: number
  twist: number
  taper: number
  thickness: number
  symmetryMode: SymmetryMode
  curveSmoothing: number
  bladeSections: BladeSection[]
  airfoilPreset: AirfoilPresetName
  customNacaM: number
  customNacaP: number
  customNacaT: number
  materialPreset: MaterialPreset
  materialOverrides: Partial<Record<MaterialPreset, Partial<MaterialConfig>>>
}

/**
 * Generate a 3D VAWT mesh from the full design state.
 * Geometry matches TurbineViewer.TurbineMesh exactly so GLB output
 * is identical to what the user sees on screen.
 */
export function generateTurbineMesh(params: ExportParams): THREE.Group {
  const {
    bladePoints, bladeHandles, bladeCount, height, twist, taper, thickness,
    symmetryMode, curveSmoothing, bladeSections,
    airfoilPreset, customNacaM, customNacaP, customNacaT,
    materialPreset, materialOverrides,
  } = params

  const group = new THREE.Group()
  if (bladePoints.length < 2) return group

  // ── Smooth blade curve (same as TurbineViewer) ──────────────────────────────
  const smooth = catmullRomSplineWithHandles(bladePoints, bladeHandles ?? [], curveSmoothing)
  const bladeRadius = 0.6
  const heightSegments = 24
  const cs = smooth.length
  const isHelical = symmetryMode === 'helix'
  const isSnowflake = symmetryMode === 'snowflake'
  const camberSigns = isSnowflake ? [1, -1] : [1]

  // ── Resolve airfoil profile ─────────────────────────────────────────────────
  const profile = resolveProfileData(airfoilPreset, customNacaM, customNacaP, customNacaT)
  const chordMin = smooth[0].x
  const chordMax = smooth[cs - 1].x
  const chordSpan = Math.max(chordMax - chordMin, 0.001)

  // ── Build blade material (PBR for GLB compatibility) ────────────────────────
  const bladeMaterial = buildExportMaterial(materialPreset, materialOverrides)

  // ── Strut / shaft materials ─────────────────────────────────────────────────
  const strutMaterial = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.7,
    roughness: 0.3,
  })
  const shaftMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    metalness: 0.8,
    roughness: 0.3,
  })

  // ── Central shaft ───────────────────────────────────────────────────────────
  const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, height * 1.3, 16)
  const shaft = new THREE.Mesh(shaftGeo, shaftMaterial)
  shaft.name = 'Shaft'
  shaft.position.y = height * 0.65
  group.add(shaft)

  // ── Generate blades (matches TurbineViewer.TurbineMesh exactly) ─────────────
  for (let b = 0; b < bladeCount; b++) {
    for (const camberSign of camberSigns) {
      const positions: number[] = []
      const indices: number[] = []

      for (let h = 0; h <= heightSegments; h++) {
        const hFrac = h / heightSegments
        const y = height * 0.25 + hFrac * height * 0.8

        // Interpolate blade section overrides
        let sectionTwistOffset = 0
        let sectionTaperScale = 1.0
        if (bladeSections.length >= 2) {
          let lo = 0
          for (let s = 0; s < bladeSections.length - 1; s++) {
            if (bladeSections[s + 1].heightFraction >= hFrac) { lo = s; break }
            lo = s
          }
          const hi = Math.min(lo + 1, bladeSections.length - 1)
          const loSec = bladeSections[lo]
          const hiSec = bladeSections[hi]
          const range = hiSec.heightFraction - loSec.heightFraction
          const t = range > 0 ? (hFrac - loSec.heightFraction) / range : 0
          sectionTwistOffset = loSec.twistOffset + (hiSec.twistOffset - loSec.twistOffset) * t
          sectionTaperScale = loSec.taperScale + (hiSec.taperScale - loSec.taperScale) * t
        }

        const twistAngle = (twist * hFrac + sectionTwistOffset) * (Math.PI / 180)
        const taperScale = (1.0 - taper * Math.abs(hFrac - 0.5) * 2) * sectionTaperScale
        const helicalOffset = isHelical ? hFrac * Math.PI * 0.5 : 0
        const totalTwist = twistAngle + helicalOffset
        const cosT = Math.cos(totalTwist), sinT = Math.sin(totalTwist)

        const thickScale = thickness * bladeRadius * taperScale

        for (let c = 0; c < cs; c++) {
          const pt = smooth[c]
          const normX = (pt.x - chordMin) / chordSpan
          const halfT = halfThickNorm(profile, normX) * thickScale
          const radialDist = pt.x * bladeRadius * taperScale
          const camber = pt.y * bladeRadius * taperScale * camberSign

          // Upper vertex
          const uy = camber + halfT
          positions.push(radialDist * cosT - uy * sinT, y, radialDist * sinT + uy * cosT)

          // Lower vertex
          const ly = camber - halfT
          positions.push(radialDist * cosT - ly * sinT, y, radialDist * sinT + ly * cosT)
        }
      }

      // Triangulate — interleaved layout matching TurbineViewer
      const vIdx = (h: number, c: number, isLower: boolean) => (h * cs + c) * 2 + (isLower ? 1 : 0)

      for (let h = 0; h < heightSegments; h++) {
        for (let c = 0; c < cs - 1; c++) {
          // Upper surface strip (CCW from outside)
          const u00 = vIdx(h, c, false)
          const u10 = vIdx(h + 1, c, false)
          const u01 = vIdx(h, c + 1, false)
          const u11 = vIdx(h + 1, c + 1, false)
          indices.push(u00, u10, u01, u01, u10, u11)

          // Lower surface strip (reversed winding)
          const l00 = vIdx(h, c, true)
          const l10 = vIdx(h + 1, c, true)
          const l01 = vIdx(h, c + 1, true)
          const l11 = vIdx(h + 1, c + 1, true)
          indices.push(l00, l01, l10, l10, l01, l11)
        }

        // Leading-edge cap (c=0)
        const lu = vIdx(h, 0, false), ll = vIdx(h, 0, true)
        const lu1 = vIdx(h + 1, 0, false), ll1 = vIdx(h + 1, 0, true)
        indices.push(ll, lu, ll1, ll1, lu, lu1)

        // Trailing-edge cap (c=cs-1)
        const tu = vIdx(h, cs - 1, false), tl = vIdx(h, cs - 1, true)
        const tu1 = vIdx(h + 1, cs - 1, false), tl1 = vIdx(h + 1, cs - 1, true)
        indices.push(tu, tl, tu1, tu1, tl, tl1)
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      geo.rotateY((b / bladeCount) * Math.PI * 2)

      const bladeMesh = new THREE.Mesh(geo, bladeMaterial)
      bladeMesh.name = `Blade_${b}${isSnowflake ? (camberSign === 1 ? '_upper' : '_lower') : ''}`
      group.add(bladeMesh)
    }
  }

  // ── Strut rings ─────────────────────────────────────────────────────────────
  const strutRingGeo = new THREE.TorusGeometry(0.18, 0.012, 8, 32)

  const topRing = new THREE.Mesh(strutRingGeo, strutMaterial)
  topRing.name = 'TopRing'
  topRing.position.y = height * 1.05
  topRing.rotation.x = Math.PI / 2
  group.add(topRing)

  const bottomRing = new THREE.Mesh(strutRingGeo, strutMaterial)
  bottomRing.name = 'BottomRing'
  bottomRing.position.y = height * 0.25
  bottomRing.rotation.x = Math.PI / 2
  group.add(bottomRing)

  // ── Radial struts ───────────────────────────────────────────────────────────
  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI * 2
    for (const yPos of [height * 0.25, height * 1.05]) {
      const strutGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6)
      const strut = new THREE.Mesh(strutGeo, strutMaterial)
      strut.name = `Strut_${b}`
      strut.position.set(
        Math.cos(angle) * 0.22,
        yPos,
        Math.sin(angle) * 0.22,
      )
      strut.rotation.set(0, -angle + Math.PI / 2, Math.PI / 2)
      group.add(strut)
    }
  }

  return group
}

/**
 * Build a PBR MeshPhysicalMaterial for GLB export.
 * Shader materials (neon, bamboo, quantum) are approximated as PBR since
 * custom GLSL shaders cannot be serialized into the glTF format.
 */
function buildExportMaterial(
  preset: MaterialPreset,
  overrides: Partial<Record<MaterialPreset, Partial<MaterialConfig>>>,
): THREE.MeshPhysicalMaterial {
  // For shader presets, pick a representative PBR approximation
  const shaderFallbacks: Partial<Record<MaterialPreset, MaterialConfig>> = {
    'neon-shader': {
      label: 'Neon (export)',
      color: '#2dd4bf',
      metalness: 0.3,
      roughness: 0.2,
      opacity: 0.85,
      transparent: true,
      emissiveIntensity: 0.6,
      emissiveColor: '#0d5c63',
      clearcoat: 0.8,
    },
    'bamboo-shader': {
      label: 'Bamboo (export)',
      color: '#8fad5a',
      metalness: 0.05,
      roughness: 0.6,
      opacity: 1,
      transparent: false,
      emissiveIntensity: 0,
      clearcoat: 0.3,
    },
    'quantum-shader': {
      label: 'Quantum (export)',
      color: '#06b6d4',
      metalness: 0.4,
      roughness: 0.15,
      opacity: 0.9,
      transparent: true,
      emissiveIntensity: 0.4,
      emissiveColor: '#06d6a0',
      clearcoat: 0.9,
    },
  }

  const isShader = preset in shaderFallbacks
  const baseConfig = isShader
    ? shaderFallbacks[preset]!
    : MATERIAL_PRESETS[preset]

  const userOverrides = overrides[preset] ?? {}
  const mat = { ...baseConfig, ...userOverrides }

  const transparent = mat.transparent || mat.opacity < 1
  return new THREE.MeshPhysicalMaterial({
    color: mat.color,
    metalness: mat.metalness,
    roughness: mat.roughness,
    opacity: mat.opacity,
    transparent,
    emissive: mat.emissiveIntensity > 0 ? (mat.emissiveColor ?? mat.color) : '#000000',
    emissiveIntensity: mat.emissiveIntensity,
    side: THREE.DoubleSide,
    clearcoat: mat.clearcoat ?? 0,
    clearcoatRoughness: 0.2,
  })
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
