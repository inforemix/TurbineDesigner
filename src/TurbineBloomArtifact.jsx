import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Float } from "@react-three/drei";

/* ─── PRESETS ─── */
const PRESETS = {
  "Breeze Petal": [
    { x: 0.0, y: 0.05 }, { x: 0.15, y: 0.12 }, { x: 0.35, y: 0.18 },
    { x: 0.55, y: 0.15 }, { x: 0.75, y: 0.08 }, { x: 0.95, y: 0.02 },
  ],
  "Storm Scoop": [
    { x: 0.0, y: 0.02 }, { x: 0.1, y: 0.2 }, { x: 0.25, y: 0.35 },
    { x: 0.45, y: 0.3 }, { x: 0.65, y: 0.18 }, { x: 0.85, y: 0.05 },
  ],
  "Zephyr Wing": [
    { x: 0.0, y: 0.03 }, { x: 0.2, y: 0.08 }, { x: 0.4, y: 0.14 },
    { x: 0.6, y: 0.12 }, { x: 0.8, y: 0.06 }, { x: 1.0, y: 0.01 },
  ],
  "Typhoon Sail": [
    { x: 0.0, y: 0.04 }, { x: 0.12, y: 0.25 }, { x: 0.3, y: 0.4 },
    { x: 0.5, y: 0.35 }, { x: 0.7, y: 0.2 }, { x: 0.9, y: 0.03 },
  ],
  "Lotus Blade": [
    { x: 0.0, y: 0.06 }, { x: 0.15, y: 0.15 }, { x: 0.3, y: 0.22 },
    { x: 0.5, y: 0.22 }, { x: 0.7, y: 0.15 }, { x: 0.9, y: 0.06 },
  ],
};

/* ─── SPLINE UTILS ─── */
function catmullRom(points, segs = 10) {
  if (points.length < 2) return [...points];
  if (points.length === 2) {
    const r = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      r.push({ x: points[0].x + (points[1].x - points[0].x) * t, y: points[0].y + (points[1].y - points[0].y) * t });
    }
    return r;
  }
  const result = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(n - 1, i + 1)];
    const p3 = points[Math.min(n - 1, i + 2)];
    for (let j = 0; j < segs; j++) {
      const t = j / segs, t2 = t * t, t3 = t2 * t;
      result.push({
        x: 0.5 * ((-t3 + 2*t2 - t)*p0.x + (3*t3 - 5*t2 + 2)*p1.x + (-3*t3 + 4*t2 + t)*p2.x + (t3 - t2)*p3.x),
        y: 0.5 * ((-t3 + 2*t2 - t)*p0.y + (3*t3 - 5*t2 + 2)*p1.y + (-3*t3 + 4*t2 + t)*p2.y + (t3 - t2)*p3.y),
      });
    }
  }
  result.push(points[n - 1]);
  return result;
}

function mirrorBlades(pts, count, cx, cy, r) {
  const out = [];
  const step = (2 * Math.PI) / count;
  for (let b = 0; b < count; b++) {
    const a = step * b;
    const cos = Math.cos(a), sin = Math.sin(a);
    out.push(pts.map(p => ({
      x: cx + p.x * r * cos - p.y * r * sin,
      y: cy + p.x * r * sin + p.y * r * cos,
    })));
  }
  return out;
}

/* ─── PHYSICS HELPERS ─── */
function estimateCp(points, bc) {
  if (points.length < 2) return 0;
  const maxC = Math.max(...points.map(p => p.y));
  const avgC = points.reduce((s, p) => s + p.y, 0) / points.length;
  const dragCp = Math.min(0.25, maxC * 0.8);
  const liftCp = Math.min(0.42, (1 - maxC) * 0.5 * Math.min(bc * avgC * 2, 1));
  return dragCp * 0.4 + liftCp * 0.6;
}

function getTier(cp, ws) {
  const p = 0.5 * 1.225 * Math.pow(ws, 3) * cp;
  if (p < 5) return "dormant";
  if (p < 50) return "seedling";
  if (p < 200) return "flourishing";
  return "radiant";
}

const TIER_META = {
  dormant: { label: "Dormant", color: "#64748b", icon: "○" },
  seedling: { label: "Seedling", color: "#2dd4bf", icon: "◐" },
  flourishing: { label: "Flourishing", color: "#fbbf24", icon: "◉" },
  radiant: { label: "Radiant", color: "#f472b6", icon: "✦" },
};

/* ─── 2D KALEIDOSCOPE CANVAS ─── */
function KaleidoscopeCanvas({ points, setPoints, addPoint, updatePoint, bladeCount }) {
  const ref = useRef(null);
  const dragIdx = useRef(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const resize = () => {
      const p = cvs.parentElement;
      const dpr = Math.min(devicePixelRatio, 2);
      cvs.width = p.clientWidth * dpr;
      cvs.height = p.clientHeight * dpr;
      cvs.style.width = p.clientWidth + "px";
      cvs.style.height = p.clientHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    let running = true;
    const draw = () => {
      if (!running) return;
      timeRef.current += 0.016;
      const dpr = Math.min(devicePixelRatio, 2);
      const w = cvs.width / dpr, h = cvs.height / dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2, cy = h / 2;
      const radius = Math.min(cx, cy) * 0.78;

      // BG
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      bg.addColorStop(0, "#0f1628"); bg.addColorStop(1, "#0a0e1a");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      // Grid rings
      ctx.strokeStyle = "rgba(45,212,191,0.07)"; ctx.lineWidth = 1;
      for (let r = 0.25; r <= 1; r += 0.25) {
        ctx.beginPath(); ctx.arc(cx, cy, radius * r, 0, Math.PI * 2); ctx.stroke();
      }

      // Radial lines
      ctx.strokeStyle = "rgba(45,212,191,0.05)";
      for (let i = 0; i < bladeCount; i++) {
        const a = (i / bladeCount) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius); ctx.stroke();
      }

      // Blades
      const curPts = points; // read current
      if (curPts.length >= 2) {
        const smooth = catmullRom(curPts, 10);
        const mirrored = mirrorBlades(smooth, bladeCount, cx, cy, radius);

        // Glow
        mirrored.forEach(blade => {
          if (blade.length < 2) return;
          ctx.beginPath(); ctx.moveTo(blade[0].x, blade[0].y);
          blade.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.strokeStyle = "rgba(45,212,191,0.12)"; ctx.lineWidth = 7; ctx.stroke();
        });

        // Lines
        mirrored.forEach((blade, idx) => {
          if (blade.length < 2) return;
          ctx.beginPath(); ctx.moveTo(blade[0].x, blade[0].y);
          blade.forEach(p => ctx.lineTo(p.x, p.y));
          const hue = 174 + idx * (30 / bladeCount);
          ctx.strokeStyle = `hsla(${hue},70%,55%,0.8)`; ctx.lineWidth = 2.5; ctx.stroke();
        });

        // Control dots
        curPts.forEach((pt, i) => {
          const wx = cx + pt.x * radius, wy = cy + pt.y * radius;
          ctx.beginPath(); ctx.arc(wx, wy, 7, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(45,212,191,0.18)"; ctx.fill();
          ctx.beginPath(); ctx.arc(wx, wy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = i === 0 ? "#fbbf24" : "#2dd4bf"; ctx.fill();
          if (i > 0) {
            const prev = curPts[i - 1];
            ctx.beginPath();
            ctx.moveTo(cx + prev.x * radius, cy + prev.y * radius);
            ctx.lineTo(wx, wy);
            ctx.strokeStyle = "rgba(45,212,191,0.25)"; ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
          }
        });
      }

      // Center hub
      const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      hg.addColorStop(0, "rgba(45,212,191,0.5)"); hg.addColorStop(1, "rgba(45,212,191,0)");
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2dd4bf"; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();

      // Outer ring pulse
      const ps = 1 + Math.sin(timeRef.current * 2) * 0.015;
      ctx.beginPath(); ctx.arc(cx, cy, radius * ps, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(45,212,191,0.15)"; ctx.lineWidth = 1.5; ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [points, bladeCount]);

  const getCoords = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  };

  const findNear = (px) => {
    const cvs = ref.current;
    const dpr = Math.min(devicePixelRatio, 2);
    const w = cvs.width / dpr, h = cvs.height / dpr;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(cx, cy) * 0.78;
    for (let i = 0; i < points.length; i++) {
      const wx = cx + points[i].x * radius, wy = cy + points[i].y * radius;
      if (Math.hypot(px.x - wx, px.y - wy) < 14) return i;
    }
    return null;
  };

  const onDown = (e) => {
    const px = getCoords(e);
    const near = findNear(px);
    if (near !== null) { dragIdx.current = near; return; }
    const cvs = ref.current;
    const dpr = Math.min(devicePixelRatio, 2);
    const w = cvs.width / dpr, h = cvs.height / dpr;
    const cx = w / 2, cy = h / 2, radius = Math.min(cx, cy) * 0.78;
    addPoint({
      x: Math.max(0, Math.min(1, (px.x - cx) / radius)),
      y: Math.max(0, Math.min(0.5, Math.abs((px.y - cy) / radius))),
    });
  };

  const onMove = (e) => {
    if (dragIdx.current === null) return;
    const px = getCoords(e);
    const cvs = ref.current;
    const dpr = Math.min(devicePixelRatio, 2);
    const w = cvs.width / dpr, h = cvs.height / dpr;
    const cx = w / 2, cy = h / 2, radius = Math.min(cx, cy) * 0.78;
    updatePoint(dragIdx.current, {
      x: Math.max(0, Math.min(1, (px.x - cx) / radius)),
      y: Math.max(0, Math.min(0.5, Math.abs((px.y - cy) / radius))),
    });
  };

  const onUp = () => {
    dragIdx.current = null;
    setPoints([...points].sort((a, b) => a.x - b.x));
  };

  return (
    <canvas
      ref={ref}
      style={{ width: "100%", height: "100%", cursor: "crosshair" }}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
    />
  );
}

/* ─── 3D TURBINE ─── */
function TurbineMesh({ bladePoints, bladeCount, height, twist, taper, windSpeed, isSpinning, bloomTier }) {
  const groupRef = useRef();
  const spinRef = useRef(0);

  const meshData = useMemo(() => {
    if (bladePoints.length < 2) return null;
    const smooth = catmullRom(bladePoints, 6);
    const bladeRadius = 0.6, hSegs = 20, cSegs = smooth.length;
    const geos = [];
    for (let b = 0; b < bladeCount; b++) {
      const pos = [], idx = [];
      for (let h = 0; h <= hSegs; h++) {
        const hf = h / hSegs, y = height * 0.25 + hf * height * 0.8;
        const tw = twist * hf * Math.PI / 180;
        const tp = 1 - taper * Math.abs(hf - 0.5) * 2;
        const cos = Math.cos(tw), sin = Math.sin(tw);
        for (let c = 0; c < cSegs; c++) {
          const pt = smooth[c];
          const lx = pt.x * bladeRadius * tp, lz = pt.y * bladeRadius * tp;
          pos.push(lx * cos - lz * sin, y, lx * sin + lz * cos);
        }
      }
      for (let h = 0; h < hSegs; h++)
        for (let c = 0; c < cSegs - 1; c++) {
          const a = h * cSegs + c, b2 = a + cSegs;
          idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.rotateY((b / bladeCount) * Math.PI * 2);
      geos.push(geo);
    }
    return geos;
  }, [bladePoints, bladeCount, height, twist, taper]);

  useFrame((_, dt) => {
    if (!groupRef.current || !isSpinning) return;
    const tsr = (4 * Math.PI) / bladeCount;
    const rps = (windSpeed * tsr) / (0.6 * 2 * Math.PI);
    spinRef.current += rps * dt * 1.8;
    groupRef.current.rotation.y = spinRef.current;
  });

  const tc = { dormant: "#4a6670", seedling: "#2dd4bf", flourishing: "#34d399", radiant: "#a78bfa" };
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: tc[bloomTier] || "#2dd4bf", metalness: 0.55, roughness: 0.35, side: THREE.DoubleSide,
  }), [bloomTier]);
  const strutMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#64748b", metalness: 0.7, roughness: 0.3 }), []);

  if (!meshData) return null;
  return (
    <group ref={groupRef}>
      <mesh position={[0, height * 0.65, 0]} material={strutMat}>
        <cylinderGeometry args={[0.04, 0.04, height * 1.3, 16]} />
      </mesh>
      {meshData.map((geo, i) => <mesh key={i} geometry={geo} material={mat} />)}
      <mesh position={[0, height * 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMat}>
        <torusGeometry args={[0.18, 0.012, 8, 32]} />
      </mesh>
      <mesh position={[0, height * 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={strutMat}>
        <torusGeometry args={[0.18, 0.012, 8, 32]} />
      </mesh>
      {Array.from({ length: bladeCount }).map((_, b) => {
        const a = (b / bladeCount) * Math.PI * 2;
        return [height * 0.25, height * 1.05].map((yp, si) => (
          <mesh key={`s${b}${si}`} position={[Math.cos(a) * 0.22, yp, Math.sin(a) * 0.22]}
            rotation={[0, -a + Math.PI / 2, Math.PI / 2]} material={strutMat}>
            <cylinderGeometry args={[0.008, 0.008, 0.4, 6]} />
          </mesh>
        ));
      })}
    </group>
  );
}

function WindParticles({ windSpeed, isSpinning }) {
  const ref = useRef();
  const count = 150;
  const [positions, velocities] = useMemo(() => {
    const p = new Float32Array(count * 3), v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i*3] = (Math.random()-0.5)*4; p[i*3+1] = Math.random()*2.5; p[i*3+2] = (Math.random()-0.5)*4;
      v[i*3] = 0.3+Math.random()*0.5; v[i*3+1] = (Math.random()-0.5)*0.1; v[i*3+2] = (Math.random()-0.5)*0.2;
    }
    return [p, v];
  }, []);
  useFrame((_, dt) => {
    if (!ref.current || !isSpinning) return;
    const arr = ref.current.geometry.attributes.position.array;
    const sp = windSpeed * 0.08;
    for (let i = 0; i < count; i++) {
      arr[i*3] += velocities[i*3]*sp*dt*10;
      arr[i*3+1] += velocities[i*3+1]*dt*3;
      arr[i*3+2] += velocities[i*3+2]*dt*3;
      if (arr[i*3] > 2.5) { arr[i*3]=-2.5; arr[i*3+1]=Math.random()*2.5; arr[i*3+2]=(Math.random()-0.5)*4; }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.02} color="#5eead4" transparent opacity={Math.min(0.7, windSpeed/15)} sizeAttenuation />
    </points>
  );
}

function Scene3D({ bladePoints, bladeCount, height, twist, taper, windSpeed, isSpinning, bloomTier }) {
  const bgc = { dormant:"#0a0e1a", seedling:"#0b1020", flourishing:"#0d1225", radiant:"#10152e" };
  const bg = bgc[bloomTier]||"#0a0e1a";
  return (
    <Canvas camera={{ position:[1.8,1.6,1.8], fov:45 }}
      gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.2 }}>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg,4,12]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3,5,2]} intensity={1.2} />
      <pointLight position={[-2,3,-1]} intensity={0.4} color="#5eead4" />
      <pointLight position={[1,0.5,2]} intensity={0.2} color="#a78bfa" />
      <Float speed={0.5} rotationIntensity={0} floatIntensity={0.3}>
        <TurbineMesh {...{ bladePoints, bladeCount, height, twist, taper, windSpeed, isSpinning, bloomTier }} />
      </Float>
      <WindParticles windSpeed={windSpeed} isSpinning={isSpinning} />
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]} receiveShadow>
        <circleGeometry args={[3,64]} />
        <meshStandardMaterial color="#0f1628" metalness={0.1} roughness={0.9} />
      </mesh>
      <ContactShadows position={[0,0,0]} opacity={0.35} scale={5} blur={2.5} far={3} />
      <OrbitControls enableDamping dampingFactor={0.05} minDistance={1} maxDistance={6}
        target={[0,0.8,0]} maxPolarAngle={Math.PI/2+0.3} autoRotate autoRotateSpeed={0.5} />
    </Canvas>
  );
}

/* ─── SLIDER ─── */
function Slider({ label, value, min, max, step, onChange, unit="" }) {
  const pct = ((value-min)/(max-min))*100;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#94a3b8" }}>
        <span style={{ textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
        <span style={{ fontFamily:"monospace", color:"#2dd4bf" }}>{value.toFixed(step<1?1:0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}
        style={{ width:"100%", accentColor:"#2dd4bf", height:4, cursor:"pointer" }} />
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function TurbineBloom() {
  const [mode, setMode] = useState("draw");
  const [points, setPoints] = useState([...PRESETS["Breeze Petal"]]);
  const [bladeCount, setBladeCount] = useState(3);
  const [windSpeed, setWindSpeed] = useState(6);
  const [height, setHeight] = useState(1.5);
  const [twist, setTwist] = useState(0);
  const [taper, setTaper] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [activePreset, setActivePreset] = useState("Breeze Petal");

  const cp = estimateCp(points, bladeCount);
  const power = 0.5 * 1.225 * Math.pow(windSpeed, 3) * cp;
  const tier = getTier(cp, windSpeed);
  const tmeta = TIER_META[tier];

  const addPoint = (pt) => setPoints(p => [...p, pt]);
  const updatePoint = (i, pt) => setPoints(p => { const n=[...p]; n[i]=pt; return n; });
  const loadPreset = (name) => { setPoints([...PRESETS[name]]); setActivePreset(name); };

  const S = {
    root: { width:"100%", height:"100%", display:"flex", flexDirection:"column", background:"#0a0e1a", color:"#e2e8f0", fontFamily:"'DM Sans',system-ui,sans-serif", overflow:"hidden" },
    header: { height:48, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", borderBottom:"1px solid rgba(42,53,85,0.4)", background:"rgba(15,22,40,0.8)", backdropFilter:"blur(8px)", flexShrink:0 },
    logo: { display:"flex", alignItems:"center", gap:8 },
    logoIcon: { width:24, height:24, borderRadius:"50%", background:"linear-gradient(135deg,#2dd4bf,#a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"white" },
    toggle: { display:"flex", background:"#161d33", borderRadius:8, border:"1px solid rgba(42,53,85,0.5)", padding:2 },
    toggleBtn: (a) => ({ padding:"6px 16px", borderRadius:6, border:"none", fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.2s", background: a ? "rgba(45,212,191,0.15)" : "transparent", color: a ? "#2dd4bf" : "#64748b" }),
    body: { flex:1, display:"flex", overflow:"hidden" },
    sidebar: { width:172, borderRight:"1px solid rgba(42,53,85,0.4)", background:"rgba(15,22,40,0.5)", overflowY:"auto", padding:12, display:"flex", flexDirection:"column", gap:6, flexShrink:0 },
    main: { flex:1, position:"relative" },
    right: { width:200, borderLeft:"1px solid rgba(42,53,85,0.4)", background:"rgba(15,22,40,0.5)", overflowY:"auto", padding:12, display:"flex", flexDirection:"column", gap:10, flexShrink:0 },
    presetBtn: (a) => ({ textAlign:"left", padding:"8px 10px", borderRadius:8, border: a ? "1px solid rgba(45,212,191,0.3)" : "1px solid rgba(42,53,85,0.4)", background: a ? "rgba(45,212,191,0.1)" : "rgba(22,29,51,0.5)", color: a ? "#2dd4bf" : "#94a3b8", fontSize:11, fontWeight:500, cursor:"pointer", transition:"all 0.2s" }),
    bcBtn: (a) => ({ flex:1, padding:"6px 0", borderRadius:6, border: a ? "1px solid rgba(45,212,191,0.3)" : "1px solid rgba(42,53,85,0.4)", background: a ? "rgba(45,212,191,0.15)" : "rgba(22,29,51,0.5)", color: a ? "#2dd4bf" : "#94a3b8", fontSize:11, fontWeight:500, cursor:"pointer" }),
    tierCard: { borderRadius:10, padding:10, border:`1px solid ${tmeta.color}30`, background:`linear-gradient(135deg,${tmeta.color}08,${tmeta.color}04)` },
    hint: { position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)", background:"rgba(22,29,51,0.8)", backdropFilter:"blur(6px)", borderRadius:20, padding:"5px 14px", border:"1px solid rgba(42,53,85,0.3)", fontSize:10, color:"#64748b", pointerEvents:"none", whiteSpace:"nowrap" },
    sectionLabel: { fontSize:9, textTransform:"uppercase", letterSpacing:2, color:"#64748b", marginBottom:4 },
    spinBtn: (s) => ({ padding:"7px 0", borderRadius:8, border: s ? "1px solid rgba(45,212,191,0.3)" : "1px solid rgba(42,53,85,0.4)", background: s ? "rgba(45,212,191,0.12)" : "rgba(22,29,51,0.5)", color: s ? "#2dd4bf" : "#94a3b8", fontSize:11, fontWeight:500, cursor:"pointer", width:"100%" }),
  };

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoIcon}>✦</div>
          <span style={{ fontSize:13, fontWeight:600, letterSpacing:0.5 }}>
            Turbine<span style={{ color:"#2dd4bf" }}>Bloom</span>
          </span>
          <span style={{ fontSize:8, padding:"2px 6px", borderRadius:4, background:"#161d33", color:"#64748b", border:"1px solid rgba(42,53,85,0.5)" }}>v0.1</span>
        </div>
        <div style={S.toggle}>
          <button style={S.toggleBtn(mode==="draw")} onClick={()=>setMode("draw")}>✎ Draw</button>
          <button style={S.toggleBtn(mode==="view")} onClick={()=>setMode("view")}>◇ View 3D</button>
        </div>
        <span style={{ fontSize:9, color:"#64748b" }}>Draw a blade → See it bloom</span>
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Left sidebar */}
        <div style={S.sidebar}>
          <div style={S.sectionLabel}>Presets</div>
          {Object.keys(PRESETS).map(name => (
            <button key={name} style={S.presetBtn(activePreset===name)} onClick={()=>loadPreset(name)}>{name}</button>
          ))}
          <button style={{ ...S.presetBtn(false), marginTop:8, color:"#64748b" }} onClick={()=>{setPoints([]); setActivePreset(null);}}>✕ Clear Canvas</button>
        </div>

        {/* Main area */}
        <div style={S.main}>
          {mode === "draw" ? (
            <>
              <KaleidoscopeCanvas points={points} setPoints={setPoints} addPoint={addPoint} updatePoint={updatePoint} bladeCount={bladeCount} />
              <div style={S.hint}>Click to add points · Drag to reshape · Points auto-sort by radius</div>
            </>
          ) : (
            <>
              <Scene3D bladePoints={points} bladeCount={bladeCount} height={height} twist={twist} taper={taper}
                windSpeed={windSpeed} isSpinning={isSpinning} bloomTier={tier} />
              <div style={S.hint}>Drag to orbit · Scroll to zoom · Wind particles show flow direction</div>
            </>
          )}
        </div>

        {/* Right sidebar */}
        <div style={S.right}>
          {/* Bloom tier */}
          <div style={S.tierCard}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <span style={{ fontSize:16, color:tmeta.color }}>{tmeta.icon}</span>
              <span style={{ fontSize:12, fontWeight:500, color:tmeta.color }}>{tmeta.label}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#64748b" }}>
              <span>Cp: {cp.toFixed(3)}</span>
              <span>Power: {power.toFixed(1)}W</span>
            </div>
          </div>

          {/* Blade count */}
          <div>
            <div style={S.sectionLabel}>Blades</div>
            <div style={{ display:"flex", gap:3 }}>
              {[2,3,4,5,6,8].map(n => (
                <button key={n} style={S.bcBtn(bladeCount===n)} onClick={()=>setBladeCount(n)}>{n}</button>
              ))}
            </div>
          </div>

          {/* Wind */}
          <Slider label="Wind Speed" value={windSpeed} min={0} max={25} step={0.5} onChange={setWindSpeed} unit=" m/s" />

          {/* Extrusion */}
          <div style={{ borderTop:"1px solid rgba(42,53,85,0.3)", paddingTop:8 }}>
            <div style={S.sectionLabel}>Extrusion</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Slider label="Height" value={height} min={0.5} max={3} step={0.1} onChange={setHeight} unit="m" />
              <Slider label="Twist" value={twist} min={0} max={90} step={1} onChange={setTwist} unit="°" />
              <Slider label="Taper" value={taper} min={0} max={0.8} step={0.05} onChange={setTaper} />
            </div>
          </div>

          {/* Spin toggle */}
          <button style={S.spinBtn(isSpinning)} onClick={()=>setIsSpinning(!isSpinning)}>
            {isSpinning ? "⟳ Spinning" : "⏸ Paused"}
          </button>
        </div>
      </div>
    </div>
  );
}
