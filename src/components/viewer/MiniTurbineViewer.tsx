import { useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useTurbineStore, MATERIAL_PRESETS } from '../../stores/turbineStore'
import { catmullRomSpline } from '../../utils/spline'

function MiniTurbineMesh() {
  const { bladePoints, bladeCount, height, twist, taper, symmetryMode, materialPreset, curveSmoothing } = useTurbineStore()
  const matConfig = MATERIAL_PRESETS[materialPreset === 'neon-shader' ? 'teal-metal' : materialPreset]

  const meshData = useMemo(() => {
    if (bladePoints.length < 2) return null
    const smooth = catmullRomSpline(bladePoints, Math.max(4, Math.floor(curveSmoothing / 2)))
    const bladeRadius = 0.6
    const heightSegments = 12
    const curveSegments = smooth.length
    const isHelical = symmetryMode === 'helix'
    const isSnowflake = symmetryMode === 'snowflake'
    const camberSigns = isSnowflake ? [1, -1] : [1]
    const geos: THREE.BufferGeometry[] = []

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
          for (let c = 0; c < curveSegments; c++) {
            const pt = smooth[c]
            const radialDist = pt.x * bladeRadius * taperScale
            const camber = pt.y * bladeRadius * taperScale * camberSign
            const totalTwist = twistAngle + helicalOffset
            const cos = Math.cos(totalTwist), sin = Math.sin(totalTwist)
            positions.push(radialDist * cos - camber * sin, y, radialDist * sin + camber * cos)
          }
        }
        for (let h = 0; h < heightSegments; h++) {
          for (let c = 0; c < curveSegments - 1; c++) {
            const a = h * curveSegments + c
            const bIdx = a + curveSegments
            const c1 = a + 1, d = bIdx + 1
            indices.push(a, bIdx, c1, c1, bIdx, d)
          }
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
  }, [bladePoints, bladeCount, height, twist, taper, symmetryMode, curveSmoothing])

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
