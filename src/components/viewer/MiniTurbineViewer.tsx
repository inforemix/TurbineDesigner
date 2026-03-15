import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTurbineStore, MATERIAL_PRESETS } from '../../stores/turbineStore'
import { catmullRomSpline } from '../../utils/spline'

function MiniTurbineMesh() {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef(0)
  const { bladePoints, bladeCount, height, twist, taper, symmetryMode, materialPreset, curveSmoothing } = useTurbineStore()
  const matConfig = MATERIAL_PRESETS[materialPreset]

  const meshData = useMemo(() => {
    if (bladePoints.length < 2) return null
    const smooth = catmullRomSpline(bladePoints, Math.max(4, Math.floor(curveSmoothing / 2)))
    const bladeRadius = 0.6
    const heightSegments = 12
    const curveSegments = smooth.length
    const isHelical = symmetryMode === 'helix'
    const geos: THREE.BufferGeometry[] = []

    for (let b = 0; b < bladeCount; b++) {
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
          const camber = pt.y * bladeRadius * taperScale
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
    return geos
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

  useFrame((_, delta) => {
    if (!groupRef.current) return
    spinRef.current += delta * 0.8
    groupRef.current.rotation.y = spinRef.current
  })

  if (!meshData) return null

  return (
    <group ref={groupRef}>
      <mesh position={[0, height * 0.65, 0]} material={strutMat}>
        <cylinderGeometry args={[0.04, 0.04, height * 1.3, 8]} />
      </mesh>
      {meshData.map((geo, i) => (
        <mesh key={i} geometry={geo} material={bladeMat} />
      ))}
      <mesh position={[0, height * 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMat}>
        <torusGeometry args={[0.18, 0.012, 6, 20]} />
      </mesh>
    </group>
  )
}

export default function MiniTurbineViewer() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-border/30"
      style={{ width: 180, height: 180, background: '#0a0e1a' }}
    >
      <Canvas
        camera={{ position: [1.4, 1.2, 1.4], fov: 45 }}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 3, 1]} intensity={1.0} />
        <pointLight position={[-1, 2, -1]} intensity={0.3} color="#5eead4" />
        <MiniTurbineMesh />
      </Canvas>
    </div>
  )
}
