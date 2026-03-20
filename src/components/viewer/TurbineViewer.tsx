import { useRef, useMemo, useCallback, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Float } from '@react-three/drei'
import * as THREE from 'three'
import { useTurbineStore, MATERIAL_PRESETS } from '../../stores/turbineStore'
import { useThemeStore } from '../../stores/themeStore'
import { catmullRomSplineWithHandles } from '../../utils/spline'
import { resolveProfileData, halfThickNorm } from '../../utils/airfoil'

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }
function easeOutBack(t: number) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }

// ── GLSL Neon Shader ─────────────────────────────────────────────────────────
const NEON_VERT = /* glsl */`
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;

  void main() {
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vHeight = position.y;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const NEON_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 norm = normalize(vWorldNormal);

    // Fresnel rim
    float fresnel = 1.0 - abs(dot(norm, viewDir));
    fresnel = pow(fresnel, 1.8);

    // Height gradient (0 = root, 1 = tip)
    float h = clamp(vHeight * 0.55, 0.0, 1.0);
    vec3 baseColor = mix(uColorA, uColorB, h);

    // Animated energy pulse along height
    float pulse = sin(vHeight * 8.0 - uTime * 2.5) * 0.5 + 0.5;
    float pulse2 = sin(vHeight * 4.0 + uTime * 1.2) * 0.5 + 0.5;

    // Face diffuse based on normal direction
    float diffuse = abs(dot(norm, normalize(vec3(1.0, 1.5, 0.8)))) * 0.5 + 0.5;

    // Compose
    vec3 finalColor = baseColor * diffuse * 0.35;
    finalColor += uRimColor * fresnel * 1.8;
    finalColor += baseColor * pulse * 0.18;
    finalColor += uRimColor * pulse2 * fresnel * 0.4;

    // Clamp brightness
    finalColor = min(finalColor, vec3(1.5));

    float alpha = 0.82 + fresnel * 0.18;
    gl_FragColor = vec4(finalColor, alpha);
  }
`

function TurbineMesh() {
  const groupRef = useRef<THREE.Group>(null)
  const shaftRef = useRef<THREE.Mesh>(null)
  const bladeRefs = useRef<(THREE.Mesh | null)[]>([])
  const strutGroupRef = useRef<THREE.Group>(null)
  const spinRef = useRef(0)
  const shaderTimeRef = useRef(0)

  // Per-part reveal progress (0→1)
  const shaftReveal = useRef(0)
  const bladeReveals = useRef<number[]>([])
  const strutReveal = useRef(0)
  const wireframeOpacity = useRef(0.8)

  const {
    bladePoints, bladeHandles, bladeCount, height, twist, taper, thickness,
    windSpeed, isSpinning, symmetryMode, materialPreset, isTransitioning, transitionProgress, curveSmoothing,
    chordCurve, twistCurve, bladeSections,
    airfoilPreset, customNacaM, customNacaP, customNacaT,
  } = useTurbineStore()

  const matConfig = MATERIAL_PRESETS[materialPreset === 'neon-shader' ? 'teal-metal' : materialPreset]
  const isNeonShader = materialPreset === 'neon-shader'

  // Build geometry from blade curve — closed airfoil cross-section
  const meshData = useMemo(() => {
    if (bladePoints.length < 2) return null

    const smooth = catmullRomSplineWithHandles(bladePoints, bladeHandles ?? [], curveSmoothing)
    const bladeRadius = 0.6
    const heightSegments = 24
    const cs = smooth.length          // curveSegments
    const isHelical = symmetryMode === 'helix'
    const isSnowflake = symmetryMode === 'snowflake'
    const camberSigns = isSnowflake ? [1, -1] : [1]

    // Resolve airfoil profile
    const profile = resolveProfileData(airfoilPreset, customNacaM, customNacaP, customNacaT)
    const chordMin = smooth[0].x
    const chordMax = smooth[cs - 1].x
    const chordSpan = Math.max(chordMax - chordMin, 0.001)

    const bladeGeometries: THREE.BufferGeometry[] = []

    for (let b = 0; b < bladeCount; b++) {
      for (const camberSign of camberSigns) {
        const positions: number[] = []
        const indices: number[] = []

        // Each height slice: cs upper vertices + cs lower vertices = 2*cs total
        for (let h = 0; h <= heightSegments; h++) {
          const hFrac = h / heightSegments
          const y = height * 0.25 + hFrac * height * 0.8

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

          // Thickness scale: thickness param × bladeRadius × taperScale
          const thickScale = thickness * bladeRadius * taperScale

          for (let c = 0; c < cs; c++) {
            const pt = smooth[c]
            const normX = (pt.x - chordMin) / chordSpan          // 0→1 along chord
            const halfT = halfThickNorm(profile, normX) * thickScale
            const radialDist = pt.x * bladeRadius * taperScale
            const camber = pt.y * bladeRadius * taperScale * camberSign

            // Upper vertex (index h*2cs + c)
            const uy = camber + halfT
            positions.push(radialDist * cosT - uy * sinT, y, radialDist * sinT + uy * cosT)

            // Lower vertex (index h*2cs + cs + c)
            const ly = camber - halfT
            positions.push(radialDist * cosT - ly * sinT, y, radialDist * sinT + ly * cosT)
          }
        }

        // Triangulate: interleaved layout — at slice h, chord c:
        //   upper = (h * cs + c) * 2 + 0
        //   lower = (h * cs + c) * 2 + 1
        const vIdx = (h: number, c: number, isLower: boolean) => (h * cs + c) * 2 + (isLower ? 1 : 0)

        for (let h = 0; h < heightSegments; h++) {
          for (let c = 0; c < cs - 1; c++) {
            // Upper surface strip (outward normals — CCW from outside)
            const u00 = vIdx(h,   c,   false)
            const u10 = vIdx(h+1, c,   false)
            const u01 = vIdx(h,   c+1, false)
            const u11 = vIdx(h+1, c+1, false)
            indices.push(u00, u10, u01, u01, u10, u11)

            // Lower surface strip (reversed winding)
            const l00 = vIdx(h,   c,   true)
            const l10 = vIdx(h+1, c,   true)
            const l01 = vIdx(h,   c+1, true)
            const l11 = vIdx(h+1, c+1, true)
            indices.push(l00, l01, l10, l10, l01, l11)
          }

          // Leading-edge cap (c=0)
          const lu = vIdx(h,   0, false), ll = vIdx(h,   0, true)
          const lu1 = vIdx(h+1, 0, false), ll1 = vIdx(h+1, 0, true)
          indices.push(ll, lu, ll1, ll1, lu, lu1)

          // Trailing-edge cap (c=cs-1)
          const tu = vIdx(h,   cs-1, false), tl = vIdx(h,   cs-1, true)
          const tu1 = vIdx(h+1, cs-1, false), tl1 = vIdx(h+1, cs-1, true)
          indices.push(tu, tl, tu1, tu1, tl, tl1)
        }

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geo.setIndex(indices)
        geo.computeVertexNormals()
        geo.rotateY((b / bladeCount) * Math.PI * 2)
        bladeGeometries.push(geo)
      }
    }

    return bladeGeometries
  }, [bladePoints, bladeCount, height, twist, taper, thickness, symmetryMode, curveSmoothing,
      chordCurve, twistCurve, bladeSections, airfoilPreset, customNacaM, customNacaP, customNacaT])

  // Neon shader material uniforms
  const neonUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color('#0d5c63') },
    uColorB: { value: new THREE.Color('#7c3aed') },
    uRimColor: { value: new THREE.Color('#2dd4bf') },
  }), [])

  // Materials
  const bladeMaterial = useMemo(() => {
    if (isNeonShader) {
      return new THREE.ShaderMaterial({
        uniforms: neonUniforms,
        vertexShader: NEON_VERT,
        fragmentShader: NEON_FRAG,
        side: THREE.DoubleSide,
        transparent: true,
      })
    }
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
  }, [matConfig, materialPreset, isNeonShader, neonUniforms])

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

  // Initialize blade reveals array (sized to actual mesh count)
  const meshCount = meshData ? meshData.length : bladeCount
  if (bladeReveals.current.length !== meshCount) {
    bladeReveals.current = Array(meshCount).fill(0)
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Update neon shader time
    if (isNeonShader) {
      shaderTimeRef.current += delta
      neonUniforms.uTime.value = shaderTimeRef.current
    }

    // Staggered reveal animation
    if (isTransitioning || transitionProgress < 1) {
      const tp = transitionProgress

      const shaftT = Math.max(0, Math.min(1, tp / 0.5))
      shaftReveal.current = easeOutCubic(shaftT)

      for (let i = 0; i < meshCount; i++) {
        const start = 0.2 + i * (0.55 / Math.max(1, meshCount))
        const end = start + 0.3
        const bladeT = Math.max(0, Math.min(1, (tp - start) / (end - start)))
        bladeReveals.current[i] = easeOutBack(bladeT)
      }

      const strutT = Math.max(0, Math.min(1, (tp - 0.7) / 0.3))
      strutReveal.current = easeOutBack(strutT)

      wireframeOpacity.current = tp < 0.5 ? Math.sin(tp * Math.PI) * 0.7 : 0

      if (shaftRef.current) {
        const s = shaftReveal.current
        shaftRef.current.scale.setScalar(Math.max(0.001, s))
        shaftRef.current.position.y = (1 - s) * -0.3
      }

      bladeRefs.current.forEach((mesh, i) => {
        if (!mesh) return
        const s = bladeReveals.current[i] ?? 0
        mesh.scale.setScalar(Math.max(0.001, s))
      })

      if (strutGroupRef.current) {
        const s = strutReveal.current
        strutGroupRef.current.scale.setScalar(Math.max(0.001, s))
        strutGroupRef.current.position.y = (1 - s) * -0.2
      }

      wireframeMaterial.opacity = wireframeOpacity.current

    } else {
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
          {!isNeonShader && <mesh geometry={geo} material={wireframeMaterial} />}
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
      const flash = transitionProgress < 0.3
        ? transitionProgress / 0.3
        : 1 - ((transitionProgress - 0.3) / 0.7)
      mat.opacity = Math.max(0, flash * 0.25)

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

// ── Smart OrbitControls: pause auto-rotate while dragging ─────────────────────
function SmartOrbitControls({ isTransitioning }: { isTransitioning: boolean }) {
  const [isDragging, setIsDragging] = useState(false)
  const { height } = useTurbineStore()
  const target: [number, number, number] = [0, height * 0.65, 0]

  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      minDistance={1}
      maxDistance={6}
      target={target}
      maxPolarAngle={Math.PI / 2 + 0.3}
      autoRotate={!isDragging}
      autoRotateSpeed={0.5}
      enabled={!isTransitioning}
      onStart={() => setIsDragging(true)}
      onEnd={() => setIsDragging(false)}
    />
  )
}

export default function TurbineViewer() {
  const { bloomTier, isTransitioning } = useTurbineStore()
  const { theme } = useThemeStore()

  const bgColor = useMemo(() => {
    if (theme === 'light') {
      return '#f8fafc'
    }
    const colors: Record<string, string> = {
      dormant: '#0a0e1a',
      seedling: '#0b1020',
      flourishing: '#0d1225',
      radiant: '#10152e',
    }
    return colors[bloomTier] || '#0a0e1a'
  }, [bloomTier, theme])

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

        <CinematicCamera />

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

        <SmartOrbitControls isTransitioning={isTransitioning} />
      </Canvas>
    </div>
  )
}
