import { useRef, useMemo, useCallback, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Float, Sky } from '@react-three/drei'
import * as THREE from 'three'
import { useTurbineStore, MATERIAL_PRESETS, type MaterialPreset, DEFAULT_BAMBOO_CONFIG, DEFAULT_QUANTUM_CONFIG, SKY_PRESETS } from '../../stores/turbineStore'
import { useThemeStore } from '../../stores/themeStore'
import { catmullRomSplineWithHandles } from '../../utils/spline'
import { resolveProfileData, halfThickNorm } from '../../utils/airfoil'
import SceneControls from './SceneControls'
import PhysicsDashboardCompact from '../ui/PhysicsDashboardCompact'

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
  uniform float uPulseSpeed;
  uniform float uPulseFreq;
  uniform int   uPattern;
  uniform float uFresnelPower;
  uniform float uOpacity;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;

  // Hex grid distance helper
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.73))), p.x);
  }

  float hexGrid(vec2 uv) {
    vec2 r = vec2(1.0, 1.73);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a,a) < dot(b,b) ? a : b;
    return 1.0 - smoothstep(0.38, 0.42, hexDist(gv));
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 norm = normalize(vWorldNormal);

    // Fresnel rim
    float fresnel = 1.0 - abs(dot(norm, viewDir));
    fresnel = pow(fresnel, uFresnelPower);

    // Height gradient
    float h = clamp(vHeight * 0.55, 0.0, 1.0);
    vec3 baseColor = mix(uColorA, uColorB, h);

    // Face diffuse
    float diffuse = abs(dot(norm, normalize(vec3(1.0, 1.5, 0.8)))) * 0.5 + 0.5;

    // Pattern-based pulse
    float pattern = 0.0;

    if (uPattern == 0) {
      // Wave: animated energy rings along height
      pattern = sin(vHeight * uPulseFreq - uTime * uPulseSpeed) * 0.5 + 0.5;
      float p2 = sin(vHeight * uPulseFreq * 0.5 + uTime * uPulseSpeed * 0.5) * 0.5 + 0.5;
      pattern = pattern * 0.7 + p2 * 0.3;

    } else if (uPattern == 1) {
      // Scanlines: horizontal bands travelling up
      float band = fract(vHeight * uPulseFreq * 0.5 - uTime * uPulseSpeed * 0.12);
      pattern = smoothstep(0.0, 0.15, band) * smoothstep(0.55, 0.35, band);

    } else if (uPattern == 2) {
      // Grid: world-space bright grid lines
      float freq = uPulseFreq * 0.35;
      float gx = abs(sin(vWorldPosition.x * freq * 6.28));
      float gz = abs(sin(vWorldPosition.z * freq * 6.28));
      float gh = abs(sin(vHeight * uPulseFreq * 3.14));
      float lines = max(max(
        smoothstep(0.7, 1.0, gx),
        smoothstep(0.7, 1.0, gz)),
        smoothstep(0.75, 1.0, gh));
      float travel = sin(uTime * uPulseSpeed - vHeight * uPulseFreq) * 0.5 + 0.5;
      pattern = lines * (0.5 + travel * 0.5);

    } else if (uPattern == 3) {
      // Hex: animated hexagonal lattice
      vec2 uv = vec2(vWorldPosition.x + vWorldPosition.z, vHeight) * uPulseFreq * 0.28;
      float hex = hexGrid(uv);
      float travel = sin(uTime * uPulseSpeed - vHeight * uPulseFreq * 0.5) * 0.5 + 0.5;
      pattern = hex * (0.4 + travel * 0.6);

    } else {
      // Circuit: angular traces with moving data pulses
      float freq = uPulseFreq * 0.4;
      float traceH = step(0.88, fract(vWorldPosition.x * freq + 0.5));
      float traceV = step(0.88, fract(vWorldPosition.z * freq + 0.5));
      float traces = max(traceH, traceV);
      float pulse = fract(vHeight * uPulseFreq * 0.25 - uTime * uPulseSpeed * 0.15);
      float dot_ = smoothstep(0.0, 0.08, pulse) * smoothstep(0.22, 0.12, pulse);
      pattern = traces * 0.4 + dot_ * traces * 0.8 + dot_ * 0.15;
    }

    // Compose
    vec3 finalColor = baseColor * diffuse * 0.35;
    finalColor += uRimColor * fresnel * 1.8;
    finalColor += baseColor * pattern * 0.25;
    finalColor += uRimColor * pattern * fresnel * 0.5;

    finalColor = min(finalColor, vec3(1.6));

    float alpha = uOpacity * (0.75 + fresnel * 0.25);
    gl_FragColor = vec4(finalColor, alpha);
  }
`

// ── GLSL Bamboo Shader ────────────────────────────────────────────────────────
const BAMBOO_VERT = /* glsl */`
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

const BAMBOO_FRAG = /* glsl */`
  uniform vec3  uColorLight;
  uniform vec3  uColorDark;
  uniform float uNodeSpacing;
  uniform float uGrainStrength;
  uniform int   uPattern;
  uniform float uShininess;
  uniform float uOpacity;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;

  // Simple hash for grain noise
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), smoothstep(0.0, 1.0, f));
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 norm = normalize(vWorldNormal);

    // Diffuse lighting
    float diffuse = abs(dot(norm, normalize(vec3(1.0, 1.5, 0.8)))) * 0.5 + 0.5;

    // Fresnel for shininess
    float fresnel = 1.0 - abs(dot(norm, viewDir));
    fresnel = pow(fresnel, 3.0 - uShininess * 2.0);

    float pattern = 0.0;
    vec3 patternColor = uColorLight;

    if (uPattern == 0) {
      // Grain: longitudinal fiber lines along height
      float grain = noise(vWorldPosition.x * 28.0 + vWorldPosition.z * 12.0) * 0.5
                  + noise(vWorldPosition.x * 60.0 + vWorldPosition.z * 40.0) * 0.25
                  + noise(vWorldPosition.x * 120.0) * 0.25;
      float nodeLine = smoothstep(0.06, 0.0, abs(fract(vHeight * uNodeSpacing) - 0.5) - 0.44);
      pattern = grain * uGrainStrength + nodeLine * 0.6;
      patternColor = mix(uColorLight, uColorDark, clamp(pattern, 0.0, 1.0));

    } else if (uPattern == 1) {
      // Nodes: sharp horizontal segment rings with inter-node shading
      float seg = fract(vHeight * uNodeSpacing);
      float nodeRing = smoothstep(0.04, 0.0, abs(seg - 0.5) - 0.44);
      float interNode = pow(sin(seg * 3.14159), 2.0) * 0.35;
      float grain = noise(vWorldPosition.x * 45.0 + vWorldPosition.z * 22.0) * uGrainStrength * 0.4;
      pattern = nodeRing * 0.8 + interNode + grain;
      patternColor = mix(uColorLight, uColorDark, clamp(pattern, 0.0, 1.0));

    } else if (uPattern == 2) {
      // Rings: concentric ring cross-section pattern
      float r = length(vec2(vWorldPosition.x, vWorldPosition.z));
      float rings = abs(sin(r * uNodeSpacing * 6.28 + vHeight * 1.5));
      float grain = noise(vWorldPosition.x * 50.0 + vWorldPosition.z * 50.0) * uGrainStrength * 0.5;
      pattern = rings * 0.6 + grain;
      patternColor = mix(uColorLight, uColorDark, clamp(pattern, 0.0, 1.0));

    } else if (uPattern == 3) {
      // Weave: diagonal cross-hatch woven bamboo texture
      float freq = uNodeSpacing * 3.0;
      float d1 = abs(sin((vWorldPosition.x + vHeight) * freq * 3.14));
      float d2 = abs(sin((vWorldPosition.x - vHeight) * freq * 3.14));
      float weave = smoothstep(0.6, 1.0, d1) * 0.5 + smoothstep(0.6, 1.0, d2) * 0.5;
      float grain = noise((vWorldPosition.x + vWorldPosition.z) * 30.0) * uGrainStrength * 0.3;
      pattern = weave * 0.7 + grain;
      patternColor = mix(uColorLight, uColorDark, clamp(pattern, 0.0, 1.0));

    } else {
      // Lacquer: high-gloss smooth bamboo with subtle grain
      float grain = noise(vWorldPosition.x * 20.0 + vWorldPosition.z * 8.0) * uGrainStrength * 0.2
                  + noise(vWorldPosition.x * 80.0) * uGrainStrength * 0.1;
      float nodeLine = smoothstep(0.03, 0.0, abs(fract(vHeight * uNodeSpacing) - 0.5) - 0.46) * 0.5;
      pattern = grain + nodeLine;
      patternColor = mix(uColorLight, uColorDark, clamp(pattern, 0.0, 1.0));
    }

    // Base shading
    vec3 finalColor = patternColor * diffuse * 0.85;

    // Specular highlight (shininess)
    vec3 halfVec = normalize(viewDir + normalize(vec3(1.0, 1.5, 0.8)));
    float spec = pow(max(dot(norm, halfVec), 0.0), 8.0 + uShininess * 60.0) * uShininess * 0.8;
    finalColor += vec3(1.0) * spec;

    // Fresnel sheen on edges
    finalColor += mix(uColorLight, vec3(1.0), 0.5) * fresnel * uShininess * 0.3;

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`

// ── GLSL Quantum Shader with Flow Field Distortion ──────────────────────────────
const QUANTUM_VERT = /* glsl */`
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec3 vWorldPos;

  void main() {
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldPos = worldPos.xyz;
    vHeight = position.y;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const QUANTUM_FRAG = /* glsl */`
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uFlowIntensity;
  uniform float uPulseSpeed;
  uniform float uNoiseScale;
  uniform int   uFlowType;
  uniform float uOpacity;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec3 vWorldPos;

  // Improved noise functions
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n00 = hash2(i);
    float n10 = hash2(i + vec2(1.0, 0.0));
    float n01 = hash2(i + vec2(0.0, 1.0));
    float n11 = hash2(i + vec2(1.0, 1.0));
    float nx0 = mix(n00, n10, f.x);
    float nx1 = mix(n01, n11, f.x);
    return mix(nx0, nx1, f.y);
  }

  vec2 getFlowField(vec3 pos, float t) {
    vec2 flow = vec2(0.0);

    if (uFlowType == 0) {
      // Radial flow from center
      vec2 toCenter = vec2(pos.x, pos.z);
      float dist = length(toCenter);
      flow = normalize(toCenter) * sin(dist * uNoiseScale - t * uFlowSpeed);

    } else if (uFlowType == 1) {
      // Spiral flow
      float angle = atan(pos.z, pos.x);
      float r = length(vec2(pos.x, pos.z));
      flow = vec2(
        cos(angle + r * uNoiseScale - t * uFlowSpeed) - cos(angle),
        sin(angle + r * uNoiseScale - t * uFlowSpeed) - sin(angle)
      );

    } else if (uFlowType == 2) {
      // Turbulence flow
      flow = vec2(
        sin(pos.x * uNoiseScale + t * uFlowSpeed) * cos(pos.z * uNoiseScale),
        cos(pos.x * uNoiseScale) * sin(pos.z * uNoiseScale + t * uFlowSpeed)
      );

    } else {
      // Vortex flow
      vec2 p = vec2(pos.x, pos.z);
      vec2 perp = vec2(-p.y, p.x);
      flow = normalize(perp) * (1.0 - exp(-length(p) * uNoiseScale)) * sin(length(p) - t * uFlowSpeed);
    }

    return flow * uFlowIntensity;
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 norm = normalize(vWorldNormal);

    // Base diffuse
    float diffuse = abs(dot(norm, normalize(vec3(1.0, 1.5, 0.8)))) * 0.5 + 0.5;

    // Fresnel glow
    float fresnel = 1.0 - abs(dot(norm, viewDir));
    fresnel = pow(fresnel, 2.5);

    // Get flow field distortion
    vec2 flow = getFlowField(vWorldPos, uTime);

    // Position-based quantum color
    float posHash = noise2D(vec2(vWorldPos.x * uNoiseScale, vWorldPos.z * uNoiseScale));
    float heightPulse = sin(vHeight * uNoiseScale * 2.0 + uTime * uPulseSpeed) * 0.5 + 0.5;

    // Color shifting based on flow and time
    float colorShift = sin(length(flow) * 3.14159 + uTime * uPulseSpeed) * 0.5 + 0.5;

    // Mix colors based on quantum properties
    vec3 quantumColor = mix(
      mix(uColorA, uColorB, heightPulse),
      uColorC,
      colorShift
    );

    // Add shimmer effect
    float shimmer = sin(posHash * 6.28318 + uTime * uPulseSpeed * 2.0) * 0.3 + 0.7;
    shimmer *= (1.0 - abs(dot(norm, viewDir)) * 0.5);

    // Combine with diffuse and fresnel
    vec3 finalColor = quantumColor * diffuse * shimmer;
    finalColor += uColorC * fresnel * (0.5 + 0.5 * sin(uTime * uPulseSpeed));

    // Add flowing particle effect
    float particleFlow = sin(length(flow) + uTime * uFlowSpeed);
    finalColor += mix(uColorA, uColorC, particleFlow * 0.5) * fresnel * 0.5;

    gl_FragColor = vec4(finalColor, uOpacity);
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
    windSpeed, isSpinning, symmetryMode, materialPreset, materialOverrides,
    isTransitioning, transitionProgress, curveSmoothing,
    chordCurve, twistCurve, bladeSections,
    airfoilPreset, customNacaM, customNacaP, customNacaT,
    neonConfig, bambooConfig, quantumConfig,
  } = useTurbineStore()

  const isNeonShader = materialPreset === 'neon-shader'
  const isBambooShader = materialPreset === 'bamboo-shader'
  const isQuantumShader = materialPreset === 'quantum-shader'
  const basePreset = (isNeonShader || isBambooShader || isQuantumShader) ? 'teal-metal' : materialPreset
  const matConfig = { ...MATERIAL_PRESETS[basePreset as MaterialPreset], ...(materialOverrides[materialPreset] ?? {}) }

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
  }, [bladePoints, bladeHandles, bladeCount, height, twist, taper, thickness, symmetryMode, curveSmoothing,
      chordCurve, twistCurve, bladeSections, airfoilPreset, customNacaM, customNacaP, customNacaT])

  // Neon shader material uniforms (initialized once, updated live in useFrame)
  const neonUniforms = useMemo(() => ({
    uTime:         { value: 0 },
    uColorA:       { value: new THREE.Color('#0d5c63') },
    uColorB:       { value: new THREE.Color('#7c3aed') },
    uRimColor:     { value: new THREE.Color('#2dd4bf') },
    uPulseSpeed:   { value: 2.5 },
    uPulseFreq:    { value: 8.0 },
    uPattern:      { value: 0 },
    uFresnelPower: { value: 1.8 },
    uOpacity:      { value: 0.85 },
  }), [])

  // Bamboo shader material uniforms (initialized once, updated live in useFrame)
  const bambooUniforms = useMemo(() => ({
    uColorLight:   { value: new THREE.Color(DEFAULT_BAMBOO_CONFIG.colorLight) },
    uColorDark:    { value: new THREE.Color(DEFAULT_BAMBOO_CONFIG.colorDark) },
    uNodeSpacing:  { value: DEFAULT_BAMBOO_CONFIG.nodeSpacing },
    uGrainStrength:{ value: DEFAULT_BAMBOO_CONFIG.grainStrength },
    uPattern:      { value: DEFAULT_BAMBOO_CONFIG.pattern },
    uShininess:    { value: DEFAULT_BAMBOO_CONFIG.shininess },
    uOpacity:      { value: DEFAULT_BAMBOO_CONFIG.opacity },
  }), [])

  // Quantum shader material uniforms
  const quantumUniforms = useMemo(() => ({
    uTime:         { value: 0 },
    uColorA:       { value: new THREE.Color(DEFAULT_QUANTUM_CONFIG.colorA) },
    uColorB:       { value: new THREE.Color(DEFAULT_QUANTUM_CONFIG.colorB) },
    uColorC:       { value: new THREE.Color(DEFAULT_QUANTUM_CONFIG.colorC) },
    uFlowSpeed:    { value: DEFAULT_QUANTUM_CONFIG.flowSpeed },
    uFlowIntensity:{ value: DEFAULT_QUANTUM_CONFIG.flowIntensity },
    uPulseSpeed:   { value: DEFAULT_QUANTUM_CONFIG.pulseSpeed },
    uNoiseScale:   { value: DEFAULT_QUANTUM_CONFIG.noiseScale },
    uFlowType:     { value: DEFAULT_QUANTUM_CONFIG.flowType },
    uOpacity:      { value: DEFAULT_QUANTUM_CONFIG.opacity },
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
    if (isBambooShader) {
      return new THREE.ShaderMaterial({
        uniforms: bambooUniforms,
        vertexShader: BAMBOO_VERT,
        fragmentShader: BAMBOO_FRAG,
        side: THREE.DoubleSide,
        transparent: false,
      })
    }
    if (isQuantumShader) {
      return new THREE.ShaderMaterial({
        uniforms: quantumUniforms,
        vertexShader: QUANTUM_VERT,
        fragmentShader: QUANTUM_FRAG,
        side: THREE.DoubleSide,
        transparent: true,
      })
    }
    const transparent = matConfig.transparent || matConfig.opacity < 1
    return new THREE.MeshPhysicalMaterial({
      color: matConfig.color,
      metalness: matConfig.metalness,
      roughness: matConfig.roughness,
      opacity: matConfig.opacity,
      transparent,
      emissive: matConfig.emissiveIntensity > 0 ? (matConfig.emissiveColor ?? matConfig.color) : '#000000',
      emissiveIntensity: matConfig.emissiveIntensity,
      side: THREE.DoubleSide,
      clearcoat: matConfig.clearcoat ?? 0,
      clearcoatRoughness: 0.2,
    })
  }, [matConfig, materialPreset, isNeonShader, neonUniforms, isBambooShader, bambooUniforms])

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

    // Update neon shader uniforms live
    if (isNeonShader) {
      shaderTimeRef.current += delta
      const nc = useTurbineStore.getState().neonConfig
      neonUniforms.uTime.value = shaderTimeRef.current
      neonUniforms.uColorA.value.set(nc.colorA)
      neonUniforms.uColorB.value.set(nc.colorB)
      neonUniforms.uRimColor.value.set(nc.rimColor)
      neonUniforms.uPulseSpeed.value = nc.pulseSpeed
      neonUniforms.uPulseFreq.value = nc.pulseFreq
      neonUniforms.uPattern.value = nc.pattern
      neonUniforms.uFresnelPower.value = nc.fresnelPower
      neonUniforms.uOpacity.value = nc.opacity
    }

    // Update bamboo shader uniforms live
    if (isBambooShader) {
      const bc = useTurbineStore.getState().bambooConfig
      bambooUniforms.uColorLight.value.set(bc.colorLight)
      bambooUniforms.uColorDark.value.set(bc.colorDark)
      bambooUniforms.uNodeSpacing.value = bc.nodeSpacing
      bambooUniforms.uGrainStrength.value = bc.grainStrength
      bambooUniforms.uPattern.value = bc.pattern
      bambooUniforms.uShininess.value = bc.shininess
      bambooUniforms.uOpacity.value = bc.opacity
    }

    // Update quantum shader uniforms live
    if (isQuantumShader) {
      shaderTimeRef.current += delta
      const qc = useTurbineStore.getState().quantumConfig
      quantumUniforms.uTime.value = shaderTimeRef.current
      quantumUniforms.uColorA.value.set(qc.colorA)
      quantumUniforms.uColorB.value.set(qc.colorB)
      quantumUniforms.uColorC.value.set(qc.colorC)
      quantumUniforms.uFlowSpeed.value = qc.flowSpeed
      quantumUniforms.uFlowIntensity.value = qc.flowIntensity
      quantumUniforms.uPulseSpeed.value = qc.pulseSpeed
      quantumUniforms.uNoiseScale.value = qc.noiseScale
      quantumUniforms.uFlowType.value = qc.flowType
      quantumUniforms.uOpacity.value = qc.opacity
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
    <>
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
            {!isNeonShader && !isBambooShader && <mesh geometry={geo} material={wireframeMaterial} />}
          </group>
        ))}

        {/* Top strut ring + radial struts (rotating with blades) */}
        <group ref={strutGroupRef}>
          <mesh position={[0, height * 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMaterial}>
            <torusGeometry args={[0.18, 0.012, 8, 32]} />
          </mesh>

          {Array.from({ length: bladeCount }).map((_, b) => {
            const angle = (b / bladeCount) * Math.PI * 2
            return [height * 1.05].map((yPos, si) => (
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

      {/* Bottom base disk - static, no rotation */}
      <mesh position={[0, height * 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMaterial}>
        <torusGeometry args={[0.18, 0.012, 8, 32]} />
      </mesh>

      {/* Bottom radial struts - static, no rotation */}
      {Array.from({ length: bladeCount }).map((_, b) => {
        const angle = (b / bladeCount) * Math.PI * 2
        return (
          <mesh
            key={`bottom-strut-${b}`}
            position={[Math.cos(angle) * 0.22, height * 0.25, Math.sin(angle) * 0.22]}
            rotation={[0, -angle + Math.PI / 2, Math.PI / 2]}
            material={strutMaterial}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.4, 6]} />
          </mesh>
        )
      })}
    </>
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
  const { environmentConfig } = useTurbineStore()

  // Simple procedural terrain shader for natural grass variation
  const grassMaterial = useMemo(() => {
    const baseColor = new THREE.Color(environmentConfig.groundColor)
    const darkColor = baseColor.clone().multiplyScalar(0.6)
    const rawLight = baseColor.clone().multiplyScalar(1.3)
    const lightColor = new THREE.Color(
      Math.min(1, rawLight.r),
      Math.min(1, rawLight.g),
      Math.min(1, rawLight.b)
    )

    return new THREE.ShaderMaterial({
      uniforms: {
        uDarkColor: { value: darkColor },
        uLightColor: { value: lightColor },
        uBrightColor: { value: baseColor },
        uVariation: { value: environmentConfig.groundColorVariation },
      },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uDarkColor;
      uniform vec3 uLightColor;
      uniform vec3 uBrightColor;
      uniform float uVariation;
      varying vec2 vUv;

      // Simple noise function
      float noise(vec2 p) {
        vec2 i = floor(p * 8.0);
        vec2 f = fract(p * 8.0);
        f = f * f * (3.0 - 2.0 * f);
        float n = mix(
          mix(sin(i.x * 12.9898 + i.y * 78.233) * 43758.5453, sin((i.x+1.0) * 12.9898 + i.y * 78.233) * 43758.5453, f.x),
          mix(sin(i.x * 12.9898 + (i.y+1.0) * 78.233) * 43758.5453, sin((i.x+1.0) * 12.9898 + (i.y+1.0) * 78.233) * 43758.5453, f.x),
          f.y
        );
        return fract(n) * 0.5 + 0.5;
      }

      void main() {
        float dist = length(vUv - 0.5);
        float n = noise(vUv);
        float pattern = sin(dist * 15.0) * 0.3 + n * uVariation;
        vec3 baseColor = mix(uDarkColor, uLightColor, dist < 0.4 ? 1.0 - dist / 0.4 : 0.0);
        baseColor = mix(baseColor, uBrightColor, dist > 0.4 && dist < 0.5 ? (0.5 - dist) * 10.0 : 0.0);
        baseColor = mix(baseColor, mix(uDarkColor, uLightColor, 0.3), dist >= 0.5 ? 1.0 : 0.0);
        gl_FragColor = vec4(baseColor * (0.85 + pattern * 0.15), 1.0);
      }
    `,
      side: THREE.DoubleSide,
    })
  }, [environmentConfig.groundColor, environmentConfig.groundColorVariation])

  return (
    <>
      {/* Wide flat grass terrain with subtle procedural variation */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <primitive object={grassMaterial} />
      </mesh>
      {/* Concrete/dirt base pad under turbine */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[0.28, 32]} />
        <meshStandardMaterial color="#8a8070" roughness={0.95} metalness={0.05} />
      </mesh>
    </>
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

// ── Dynamic Sky component with environment settings ──────────────────────────────
function SkyComponent() {
  const { environmentConfig } = useTurbineStore()
  const { theme } = useThemeStore()
  const isLight = theme === 'light'

  const skySettings = SKY_PRESETS[environmentConfig.skyPreset]
  const turbidity = skySettings.turbidity + environmentConfig.cloudIntensity * 3

  return (
    <>
      <Sky
        distance={450}
        sunPosition={skySettings.sunPosition as [number, number, number]}
        turbidity={turbidity}
        rayleigh={skySettings.rayleigh}
        mieCoefficient={0.004}
        mieDirectionalG={0.85}
        inclination={0.49}
        azimuth={0.25}
      />
      {/* Atmospheric haze - adapt to sky preset */}
      <fog
        attach="fog"
        args={[
          environmentConfig.skyPreset === 'night' ? '#1a1a2e' :
          environmentConfig.skyPreset === 'sunset' ? '#ff9977' :
          environmentConfig.skyPreset === 'stormy' ? '#777788' :
          isLight ? '#dbeafe' : '#c8dff0',
          environmentConfig.skyPreset === 'night' ? 10 : 18,
          environmentConfig.skyPreset === 'night' ? 40 : 80
        ]}
      />
    </>
  )
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
      maxPolarAngle={Math.PI / 2}
      autoRotate={!isDragging}
      autoRotateSpeed={0.5}
      enabled={!isTransitioning}
      onStart={() => setIsDragging(true)}
      onEnd={() => setIsDragging(false)}
    />
  )
}

export default function TurbineViewer() {
  const { isTransitioning } = useTurbineStore()
  const { theme } = useThemeStore()
  const isLight = theme === 'light'

  const handleCanvas = useCallback((c: HTMLCanvasElement) => {
    turbineCanvasRef = c
  }, [])

  const glConfig = useMemo(() => ({
    antialias: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: isLight ? 1.3 : 1.1,
    preserveDrawingBuffer: true,
  }), [isLight])

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [1.8, 1.6, 1.8], fov: 45, near: 0.01, far: 500 }}
        gl={glConfig}
        shadows="soft"
      >
        {/* Sky dome — Preetham atmospheric model */}
        <SkyComponent />

        <SceneCapture />
        <CanvasRefCapture onCanvas={handleCanvas} />

        <CinematicCamera />

        {/* Sun light — warm directional matching sky sun position */}
        <directionalLight
          position={[12, 18, 8]}
          intensity={2.2}
          color="#fff4d6"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        {/* Sky hemisphere fill — blue sky top, green ground bounce */}
        <hemisphereLight args={['#87ceeb', '#4a8024', 0.8]} />
        {/* Subtle fill from opposite side */}
        <directionalLight position={[-5, 3, -4]} intensity={0.3} color="#b0d4ff" />

        <BloomTransitionOverlay />

        <Float speed={0.5} rotationIntensity={0} floatIntensity={0}>
          <TurbineMesh />
        </Float>
        <WindParticles />
        <GroundPlane />
        <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={6} blur={2} far={4} color="#1a3d08" />

        <SmartOrbitControls isTransitioning={isTransitioning} />
      </Canvas>

      {/* Scene controls icon — top-left overlay */}
      <SceneControls />
      {/* Physics dashboard icon — top-right overlay */}
      <PhysicsDashboardCompact />
    </div>
  )
}
