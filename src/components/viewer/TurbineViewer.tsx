import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Float } from '@react-three/drei'
import * as THREE from 'three'
import { useTurbineStore, MATERIAL_PRESETS } from '../../stores/turbineStore'
import { catmullRomSpline } from '../../utils/spline'

function TurbineMesh() {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef(0)
  const bloomRef = useRef(0) // bloom transition progress 0→1

  const {
    bladePoints,
    bladeCount,
    height,
    twist,
    taper,
    thickness,
    windSpeed,
    isSpinning,
    symmetryMode,
    materialPreset,
    isTransitioning,
    bladeSections,
  } = useTurbineStore()

  const matConfig = MATERIAL_PRESETS[materialPreset]

  // Build geometry from blade curve
  const meshData = useMemo(() => {
    if (bladePoints.length < 2) return null

    const smooth = catmullRomSpline(bladePoints, 8)
    const bladeRadius = 0.6
    const heightSegments = 24
    const curveSegments = smooth.length
    const isHelical = symmetryMode === 'helix'

    const bladeGeometries: THREE.BufferGeometry[] = []

    for (let b = 0; b < bladeCount; b++) {
      const positions: number[] = []
      const indices: number[] = []

      for (let h = 0; h <= heightSegments; h++) {
        const hFrac = h / heightSegments
        const y = height * 0.25 + hFrac * height * 0.8

        // Interpolate section twist/taper from bladeSections
        let sectionTwistOffset = 0
        let sectionTaperScale = 1.0
        if (bladeSections.length >= 2) {
          // Find bracketing sections
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

        // Helical: add progressive angular offset per height slice
        const helicalOffset = isHelical ? hFrac * Math.PI * 0.5 : 0

        for (let c = 0; c < curveSegments; c++) {
          const pt = smooth[c]
          const radialDist = pt.x * bladeRadius * taperScale
          const camber = pt.y * bladeRadius * taperScale
          const totalTwist = twistAngle + helicalOffset
          const cos = Math.cos(totalTwist)
          const sin = Math.sin(totalTwist)
          const localX = radialDist
          const localZ = camber
          positions.push(localX * cos - localZ * sin, y, localX * sin + localZ * cos)
        }
      }

      for (let h = 0; h < heightSegments; h++) {
        for (let c = 0; c < curveSegments - 1; c++) {
          const a = h * curveSegments + c
          const bIdx = a + curveSegments
          const c1 = a + 1
          const d = bIdx + 1
          indices.push(a, bIdx, c1, c1, bIdx, d)
        }
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()

      const angle = (b / bladeCount) * Math.PI * 2
      geo.rotateY(angle)

      bladeGeometries.push(geo)
    }

    return bladeGeometries
  }, [bladePoints, bladeCount, height, twist, taper, thickness, symmetryMode, bladeSections])

  // Spin + bloom transition animation
  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Bloom transition: scale up from 0 when transitioning
    if (isTransitioning) {
      bloomRef.current = Math.min(1, bloomRef.current + delta * 1.8)
      const eased = 1 - Math.pow(1 - bloomRef.current, 3) // ease-out cubic
      groupRef.current.scale.setScalar(eased)
      groupRef.current.position.y = (1 - eased) * -0.5
    } else {
      // Ensure fully visible
      if (bloomRef.current < 1) {
        bloomRef.current = Math.min(1, bloomRef.current + delta * 3)
        const eased = 1 - Math.pow(1 - bloomRef.current, 3)
        groupRef.current.scale.setScalar(eased)
        groupRef.current.position.y = (1 - eased) * -0.5
      }
    }

    if (isSpinning) {
      const optTSR = (4 * Math.PI) / bladeCount
      const rpm = (windSpeed * optTSR) / (0.6 * 2 * Math.PI) * 60
      const radsPerSec = (rpm * 2 * Math.PI) / 60
      spinRef.current += radsPerSec * delta * 0.3
      groupRef.current.rotation.y = spinRef.current
    }
  })

  const bladeMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: matConfig.color,
      metalness: matConfig.metalness,
      roughness: matConfig.roughness,
      opacity: matConfig.opacity,
      transparent: matConfig.transparent,
      emissive: matConfig.emissiveIntensity > 0 ? matConfig.color : '#000000',
      emissiveIntensity: matConfig.emissiveIntensity,
      side: THREE.DoubleSide,
      clearcoat: materialPreset === 'carbon-fiber' ? 0.8 : 0,
      clearcoatRoughness: 0.2,
    })
  }, [matConfig, materialPreset])

  const strutMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#64748b',
    metalness: 0.7,
    roughness: 0.3,
  }), [])

  if (!meshData) return null

  return (
    <group ref={groupRef}>
      {/* Central shaft */}
      <mesh position={[0, height * 0.65, 0]} material={strutMaterial}>
        <cylinderGeometry args={[0.04, 0.04, height * 1.3, 16]} />
      </mesh>

      {/* Blades */}
      {meshData.map((geo, i) => (
        <mesh key={i} geometry={geo} material={bladeMaterial} />
      ))}

      {/* Top & bottom strut rings */}
      <mesh position={[0, height * 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMaterial}>
        <torusGeometry args={[0.18, 0.012, 8, 32]} />
      </mesh>
      <mesh position={[0, height * 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMaterial}>
        <torusGeometry args={[0.18, 0.012, 8, 32]} />
      </mesh>

      {/* Radial struts */}
      {Array.from({ length: bladeCount }).map((_, b) => {
        const angle = (b / bladeCount) * Math.PI * 2
        return [height * 0.25, height * 1.05].map((yPos, si) => (
          <mesh
            key={`strut-${b}-${si}`}
            position={[
              Math.cos(angle) * 0.22,
              yPos,
              Math.sin(angle) * 0.22,
            ]}
            rotation={[0, -angle + Math.PI / 2, Math.PI / 2]}
            material={strutMaterial}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.4, 6]} />
          </mesh>
        ))
      })}
    </group>
  )
}

function BloomTransitionOverlay() {
  const { isTransitioning, transitionProgress } = useTurbineStore()
  const meshRef = useRef<THREE.Mesh>(null)
  const { viewport } = useThree()

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    if (isTransitioning) {
      // Flash then fade
      const flash = transitionProgress < 0.3
        ? transitionProgress / 0.3
        : 1 - ((transitionProgress - 0.3) / 0.7)
      mat.opacity = Math.max(0, flash * 0.3)
    } else {
      mat.opacity = Math.max(0, mat.opacity - delta * 2)
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, -1]}>
      <planeGeometry args={[viewport.width * 2, viewport.height * 2]} />
      <meshBasicMaterial color="#2dd4bf" transparent opacity={0} depthTest={false} />
    </mesh>
  )
}

function WindParticles() {
  const { windSpeed, isSpinning } = useTurbineStore()
  const particlesRef = useRef<THREE.Points>(null)
  const count = 200

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4
      pos[i * 3 + 1] = Math.random() * 2.5
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4
      vel[i * 3] = 0.3 + Math.random() * 0.5
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.1
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2
    }
    return [pos, vel]
  }, [])

  useFrame((_, delta) => {
    if (!particlesRef.current || !isSpinning) return
    const posAttr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array
    const speed = windSpeed * 0.08

    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3] * speed * delta * 10
      arr[i * 3 + 1] += velocities[i * 3 + 1] * delta * 3
      arr[i * 3 + 2] += velocities[i * 3 + 2] * delta * 3

      if (arr[i * 3] > 2.5) {
        arr[i * 3] = -2.5
        arr[i * 3 + 1] = Math.random() * 2.5
        arr[i * 3 + 2] = (Math.random() - 0.5) * 4
      }
    }
    posAttr.needsUpdate = true
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#5eead4"
        transparent
        opacity={Math.min(0.8, windSpeed / 15)}
        sizeAttenuation
      />
    </points>
  )
}

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <circleGeometry args={[3, 64]} />
      <meshStandardMaterial
        color="#0f1628"
        metalness={0.1}
        roughness={0.9}
      />
    </mesh>
  )
}

// Expose canvas ref for PNG export
export let turbineCanvasRef: HTMLCanvasElement | null = null
// Expose GL for GLB export
export let turbineSceneRef: THREE.Scene | null = null
export let turbineGLRef: THREE.WebGLRenderer | null = null

function SceneCapture() {
  const { scene, gl } = useThree()
  turbineSceneRef = scene
  turbineGLRef = gl
  return null
}

function CanvasRefCapture({ onCanvas }: { onCanvas: (c: HTMLCanvasElement) => void }) {
  const { gl } = useThree()
  const captured = useRef(false)
  if (!captured.current) {
    captured.current = true
    onCanvas(gl.domElement)
  }
  return null
}

export default function TurbineViewer() {
  const { bloomTier } = useTurbineStore()

  const bgColor = useMemo(() => {
    const colors: Record<string, string> = {
      dormant: '#0a0e1a',
      seedling: '#0b1020',
      flourishing: '#0d1225',
      radiant: '#10152e',
    }
    return colors[bloomTier] || '#0a0e1a'
  }, [bloomTier])

  const handleCanvas = useCallback((c: HTMLCanvasElement) => {
    turbineCanvasRef = c
  }, [])

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [1.8, 1.6, 1.8], fov: 45, near: 0.1, far: 100 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          preserveDrawingBuffer: true, // needed for PNG export
        }}
        shadows
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 4, 12]} />

        {/* Capture refs for export */}
        <SceneCapture />
        <CanvasRefCapture onCanvas={handleCanvas} />

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[3, 5, 2]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-2, 3, -1]} intensity={0.4} color="#5eead4" />
        <pointLight position={[1, 0.5, 2]} intensity={0.2} color="#a78bfa" />

        {/* Bloom transition flash overlay */}
        <BloomTransitionOverlay />

        {/* Scene */}
        <Float speed={0.5} rotationIntensity={0} floatIntensity={0.3}>
          <TurbineMesh />
        </Float>
        <WindParticles />
        <GroundPlane />
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.4}
          scale={5}
          blur={2.5}
          far={3}
        />

        {/* Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={6}
          target={[0, 0.8, 0]}
          maxPolarAngle={Math.PI / 2 + 0.3}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  )
}
