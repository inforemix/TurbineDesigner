import { useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useTurbineStore, MATERIAL_PRESETS } from '../../stores/turbineStore'
import { catmullRomSplineWithHandles } from '../../utils/spline'
import { resolveProfileData, halfThickNorm } from '../../utils/airfoil'

function MiniTurbineMesh() {
  const { bladePoints, bladeHandles, bladeCount, height, twist, taper, symmetryMode, materialPreset, curveSmoothing,
    thickness, airfoilPreset, customNacaM, customNacaP, customNacaT } = useTurbineStore()
  const matConfig = MATERIAL_PRESETS[materialPreset === 'neon-shader' ? 'teal-metal' : materialPreset]

  const meshData = useMemo(() => {
    if (bladePoints.length < 2) return null
    const smooth = catmullRomSplineWithHandles(bladePoints, bladeHandles ?? [], Math.max(4, Math.floor(curveSmoothing / 2)))
    const bladeRadius = 0.6
    const heightSegments = 12
    const curveSegments = smooth.length
    const isHelical = symmetryMode === 'helix'
    const isSnowflake = symmetryMode === 'snowflake'
    const camberSigns = isSnowflake ? [1, -1] : [1]
    const geos: THREE.BufferGeometry[] = []
    const cs = curveSegments

    const profile = resolveProfileData(airfoilPreset, customNacaM, customNacaP, customNacaT)
    const chordMin = smooth[0].x
    const chordMax = smooth[cs - 1].x
    const chordSpan = Math.max(chordMax - chordMin, 0.001)

    for (let b = 0; b < bladeCount; b++) {
      for (const camberSign of camberSigns) {
        const positions: number[] = []
        const indices: number[] = []
        for (let h = 0; h <= heightSegments; h++) {
          const hFrac = h / heightSegments
          const y = height * 0.25 + hFrac * height * 0.8
          const twistAngle = twist * hFrac * (Math.PI / 180)
          const taperScale = 1.0 - taper * Math.abs(hFrac - 0.5) * 2
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
            // upper
            const uy = camber + halfT
            positions.push(radialDist * cosT - uy * sinT, y, radialDist * sinT + uy * cosT)
            // lower
            const ly = camber - halfT
            positions.push(radialDist * cosT - ly * sinT, y, radialDist * sinT + ly * cosT)
          }
        }
        const vIdx = (h: number, c: number, isLower: boolean) => (h * cs + c) * 2 + (isLower ? 1 : 0)
        for (let h = 0; h < heightSegments; h++) {
          for (let c = 0; c < cs - 1; c++) {
            const u00 = vIdx(h, c, false), u10 = vIdx(h+1, c, false)
            const u01 = vIdx(h, c+1, false), u11 = vIdx(h+1, c+1, false)
            indices.push(u00, u10, u01, u01, u10, u11)
            const l00 = vIdx(h, c, true), l10 = vIdx(h+1, c, true)
            const l01 = vIdx(h, c+1, true), l11 = vIdx(h+1, c+1, true)
            indices.push(l00, l01, l10, l10, l01, l11)
          }
          const lu = vIdx(h, 0, false), ll = vIdx(h, 0, true)
          const lu1 = vIdx(h+1, 0, false), ll1 = vIdx(h+1, 0, true)
          indices.push(ll, lu, ll1, ll1, lu, lu1)
          const tu = vIdx(h, cs-1, false), tl = vIdx(h, cs-1, true)
          const tu1 = vIdx(h+1, cs-1, false), tl1 = vIdx(h+1, cs-1, true)
          indices.push(tu, tl, tu1, tu1, tl, tl1)
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geo.setIndex(indices)
        geo.computeVertexNormals()
        geo.rotateY((b / bladeCount) * Math.PI * 2)
        geos.push(geo)
      }
    }
    return { geos, turbineHeight: height }
  }, [bladePoints, bladeCount, height, twist, taper, symmetryMode, curveSmoothing,
      thickness, airfoilPreset, customNacaM, customNacaP, customNacaT])

  const bladeMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: matConfig.color,
    metalness: matConfig.metalness,
    roughness: matConfig.roughness,
    opacity: matConfig.opacity,
    transparent: matConfig.transparent,
    side: THREE.DoubleSide,
  }), [matConfig])

  const strutMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.7, roughness: 0.3 }), [])

  if (!meshData) return null
  const { geos, turbineHeight } = meshData

  return (
    <>
      <group>
        <mesh position={[0, turbineHeight * 0.65, 0]} material={strutMat}>
          <cylinderGeometry args={[0.04, 0.04, turbineHeight * 1.3, 8]} />
        </mesh>
        {geos.map((geo, i) => (
          <mesh key={i} geometry={geo} material={bladeMat} />
        ))}
        <mesh position={[0, turbineHeight * 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMat}>
          <torusGeometry args={[0.18, 0.012, 6, 20]} />
        </mesh>
      </group>
      {/* Bottom base disk - static, no spinning */}
      <mesh position={[0, turbineHeight * 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMat}>
        <torusGeometry args={[0.18, 0.012, 6, 20]} />
      </mesh>
    </>
  )
}

function MiniSceneControls() {
  const { height } = useTurbineStore()
  const target: [number, number, number] = [0, height * 0.65, 0]

  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.1}
      minDistance={0.6}
      maxDistance={3.5}
      target={target}
      maxPolarAngle={Math.PI / 2 + 0.3}
      autoRotate
      autoRotateSpeed={1.2}
      enableZoom
      enablePan={false}
    />
  )
}

export default function MiniTurbineViewer() {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border border-teal/20 relative select-none"
      style={{ width: 200, height: 200, background: '#0a0e1a', cursor: 'grab' }}
    >
      <Canvas
        camera={{ position: [1.4, 1.2, 1.4], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <color attach="background" args={['#0a0e1a']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 3, 1]} intensity={1.0} />
        <pointLight position={[-1, 2, -1]} intensity={0.3} color="#5eead4" />
        <pointLight position={[1, 0.5, 1]} intensity={0.15} color="#a78bfa" />
        <MiniTurbineMesh />
        <MiniSceneControls />
      </Canvas>

      {/* Corner label */}
      <div className="absolute top-1.5 left-2 text-[8px] text-teal/40 pointer-events-none font-mono tracking-widest uppercase">
        3D
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center pointer-events-none">
        <span className="text-[7px] text-teal/30 tracking-wider">drag to orbit · scroll zoom</span>
      </div>
    </div>
  )
}
