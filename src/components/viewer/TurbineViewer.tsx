import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Float } from '@react-three/drei'
import * as THREE from 'three'
import { useTurbineStore, MATERIAL_PRESETS } from '../../stores/turbineStore'
import { catmullRomSpline, sampleCurve } from '../../utils/spline'

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }
function easeOutBack(t: number) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }

function TurbineMesh() {
  const groupRef = useRef<THREE.Group>(null)
  const shaftRef = useRef<THREE.Mesh>(null)
  const bladeRefs = useRef<(THREE.Mesh | null)[]>([])
  const strutGroupRef = useRef<THREE.Group>(null)
  const spinRef = useRef(0)

  // Per-part reveal progress (0→1)
  const shaftReveal = useRef(0)
  const bladeReveals = useRef<number[]>([])
  const strutReveal = useRef(0)
  const wireframeOpacity = useRef(0.8)

  const {
    bladePoints, bladeCount, height, twist, taper, thickness,
    windSpeed, isSpinning, symmetryMode, materialPreset, isTransitioning, transitionProgress, curveSmoothing,
    chordCurve, twistCurve, bladeSections,
  } = useTurbineStore()

  const matConfig = MATERIAL_PRESETS[materialPreset]

  // Build geometry from blade curve
  const meshData = useMemo(() => {
    if (bladePoints.length < 2) return null

    const smooth = catmullRomSpline(bladePoints, curveSmoothing)
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
          positions.push(radialDist * cos - camber * sin, y, radialDist * sin + camber * cos)
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
      geo.rotateY((b / bladeCount) * Math.PI * 2)
      bladeGeometries.push(geo)
    }

    return bladeGeometries
  }, [bladePoints, bladeCount, height, twist, taper, thickness, symmetryMode, curveSmoothing, chordCurve, twistCurve])

  // Materials
  const bladeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
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
  }), [matConfig, materialPreset])

  const wireframeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#2dd4bf',
    wireframe: true,
    transparent: true,
    opacity: 0,
  }), [])

  const strutMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#64748b',
    metalness: 0.7,
    roughness: 0.3,
  }), [])

  // Initialize blade reveals array
  if (bladeReveals.current.length !== bladeCount) {
    bladeReveals.current = Array(bladeCount).fill(0)
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Staggered reveal animation
    if (isTransitioning || transitionProgress < 1) {
      const tp = transitionProgress // 0→1

      // Shaft: first 0→0.5 of transition
      const shaftT = Math.max(0, Math.min(1, tp / 0.5))
      shaftReveal.current = easeOutCubic(shaftT)

      // Blades: stagger across 0.2→0.85
      for (let i = 0; i < bladeCount; i++) {
        const start = 0.2 + i * (0.55 / Math.max(1, bladeCount))
        const end = start + 0.3
        const bladeT = Math.max(0, Math.min(1, (tp - start) / (end - start)))
        bladeReveals.current[i] = easeOutBack(bladeT)
      }

      // Struts: last 30% of transition
      const strutT = Math.max(0, Math.min(1, (tp - 0.7) / 0.3))
      strutReveal.current = easeOutBack(strutT)

      // Wireframe: fades in then out over first 50% of each part's reveal
      wireframeOpacity.current = tp < 0.5 ? Math.sin(tp * Math.PI) * 0.7 : 0

      // Apply to shaft
      if (shaftRef.current) {
        const s = shaftReveal.current
        shaftRef.current.scale.setScalar(Math.max(0.001, s))
        shaftRef.current.position.y = (1 - s) * -0.3
      }

      // Apply to blades
      bladeRefs.current.forEach((mesh, i) => {
        if (!mesh) return
        const s = bladeReveals.current[i] ?? 0
        mesh.scale.setScalar(Math.max(0.001, s))
      })

      // Apply to struts
      if (strutGroupRef.current) {
        const s = strutReveal.current
        strutGroupRef.current.scale.setScalar(Math.max(0.001, s))
        strutGroupRef.current.position.y = (1 - s) * -0.2
      }

      // Wireframe effect on blades
      wireframeMaterial.opacity = wireframeOpacity.current

    } else {
      // Fully revealed — reset all
      if (shaftRef.current) {
        shaftRef.current.scale.setScalar(1)
        shaftRef.current.position.y = 0
      }
      bladeRefs.current.forEach(m => { if (m) m.scale.setScalar(1) })
      if (strutGroupRef.current) {
        strutGroupRef.current.scale.setScalar(1)
        strutGroupRef.current.position.y = 0
      }
      wireframeMaterial.opacity = 0
    }

    // Spinning
    if (isSpinning) {
      const optTSR = (4 * Math.PI) / bladeCount
      const rpm = (windSpeed * optTSR) / (0.6 * 2 * Math.PI) * 60
      const radsPerSec = (rpm * 2 * Math.PI) / 60
      spinRef.current += radsPerSec * delta * 0.3
      groupRef.current.rotation.y = spinRef.current
    }
  })

  if (!meshData) return null

  return (
    <group ref={groupRef}>
      {/* Central shaft */}
      <mesh ref={shaftRef} position={[0, height * 0.65, 0]} material={strutMaterial}>
        <cylinderGeometry args={[0.04, 0.04, height * 1.3, 16]} />
      </mesh>

      {/* Blades with wireframe overlay */}
      {meshData.map((geo, i) => (
        <group key={i}>
          <mesh
            ref={el => { bladeRefs.current[i] = el }}
            geometry={geo}
            material={bladeMaterial}
          />
          <mesh geometry={geo} material={wireframeMaterial} />
        </group>
      ))}

      {/* Top & bottom strut rings + radial struts */}
      <group ref={strutGroupRef}>
        <mesh position={[0, height * 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMaterial}>
          <torusGeometry args={[0.18, 0.012, 8, 32]} />
        </mesh>
        <mesh position={[0, height * 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMaterial}>
          <torusGeometry args={[0.18, 0.012, 8, 32]} />
        </mesh>

        {Array.from({ length: bladeCount }).map((_, b) => {
          const angle = (b / bladeCount) * Math.PI * 2
          return [height * 0.25, height * 1.05].map((yPos, si) => (
            <mesh
              key={`strut-${b}-${si}`}
              position={[Math.cos(angle) * 0.22, yPos, Math.sin(angle) * 0.22]}
              rotation={[0, -angle + Math.PI / 2, Math.PI / 2]}
              material={strutMaterial}
            >
              <cylinderGeometry args={[0.008, 0.008, 0.4, 6]} />
            </mesh>
          ))
        })}
      </group>
    </group>
  )
}

function BloomTransitionOverlay() {
  const { isTransitioning, transitionProgress } = useTurbineStore()
  const meshRef = useRef<THREE.Mesh>(null)
  const scanRef = useRef<THREE.Mesh>(null)
  const { viewport } = useThree()

  useFrame((_, delta) => {
    if (!meshRef.current || !scanRef.current) return
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    const scanMat = scanRef.current.material as THREE.MeshBasicMaterial

    if (isTransitioning) {
      // Flash then fade
      const flash = transitionProgress < 0.3
        ? transitionProgress / 0.3
        : 1 - ((transitionProgress - 0.3) / 0.7)
      mat.opacity = Math.max(0, flash * 0.25)

      // Scan line sweeps up during first 60% of transition
      if (transitionProgress < 0.6) {
        const scanProg = transitionProgress / 0.6
        const scanY = -viewport.height / 2 + scanProg * viewport.height * 1.2
        scanRef.current.position.y = scanY
        scanMat.opacity = 0.5 * (1 - scanProg * scanProg)
      } else {
        scanMat.opacity = 0
      }
    } else {
      mat.opacity = Math.max(0, mat.opacity - delta * 2)
      scanMat.opacity = Math.max(0, scanMat.opacity - delta * 3)
    }
  })

  return (
    <>
      <mesh ref={meshRef} position={[0, 0, -1]}>
        <planeGeometry args={[viewport.width * 2, viewport.height * 2]} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={0} depthTest={false} />
      </mesh>
      {/* Horizontal scan line */}
      <mesh ref={scanRef} position={[0, -viewport.height / 2, -0.5]}>
        <planeGeometry args={[viewport.width * 2, 0.04]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0} depthTest={false} />
      </mesh>
    </>
  )
}

function CinematicCamera() {
  const { isTransitioning, transitionProgress } = useTurbineStore()
  const { camera } = useThree()
  const prevTransitioning = useRef(false)
  const farPos = useMemo(() => new THREE.Vector3(4.5, 3.5, 4.5), [])
  const targetPos = useMemo(() => new THREE.Vector3(1.8, 1.6, 1.8), [])
  const lookTarget = useMemo(() => new THREE.Vector3(0, 0.8, 0), [])

  useFrame(() => {
    if (isTransitioning) {
      if (!prevTransitioning.current) {
        camera.position.copy(farPos)
      }
      const t = easeOutCubic(transitionProgress)
      camera.position.lerpVectors(farPos, targetPos, t)
      camera.lookAt(lookTarget)
    }
    prevTransitioning.current = isTransitioning
  })
  return null
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
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
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
      <meshStandardMaterial color="#0f1628" metalness={0.1} roughness={0.9} />
    </mesh>
  )
}

// Expose canvas ref for PNG export
export let turbineCanvasRef: HTMLCanvasElement | null = null
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
  const { bloomTier, isTransitioning } = useTurbineStore()

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
          preserveDrawingBuffer: true,
        }}
        shadows
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 4, 12]} />

        <SceneCapture />
        <CanvasRefCapture onCanvas={handleCanvas} />

        {/* Cinematic camera fly-in */}
        <CinematicCamera />

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <pointLight position={[-2, 3, -1]} intensity={0.4} color="#5eead4" />
        <pointLight position={[1, 0.5, 2]} intensity={0.2} color="#a78bfa" />

        <BloomTransitionOverlay />

        <Float speed={0.5} rotationIntensity={0} floatIntensity={0.3}>
          <TurbineMesh />
        </Float>
        <WindParticles />
        <GroundPlane />
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={5} blur={2.5} far={3} />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={6}
          target={[0, 0.8, 0]}
          maxPolarAngle={Math.PI / 2 + 0.3}
          autoRotate
          autoRotateSpeed={0.5}
          enabled={!isTransitioning}
        />
      </Canvas>
    </div>
  )
}
