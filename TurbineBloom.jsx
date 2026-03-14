import { useState, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Float } from "@react-three/drei";

const PRESETS = {
  "Breeze Petal": [
    {x:0,y:.05},{x:.15,y:.12},{x:.35,y:.18},{x:.55,y:.15},{x:.75,y:.08},{x:.95,y:.02}
  ],
  "Storm Scoop": [
    {x:0,y:.02},{x:.1,y:.2},{x:.25,y:.35},{x:.45,y:.3},{x:.65,y:.18},{x:.85,y:.05}
  ],
  "Zephyr Wing": [
    {x:0,y:.03},{x:.2,y:.08},{x:.4,y:.14},{x:.6,y:.12},{x:.8,y:.06},{x:1,y:.01}
  ],
  "Typhoon Sail": [
    {x:0,y:.04},{x:.12,y:.25},{x:.3,y:.4},{x:.5,y:.35},{x:.7,y:.2},{x:.9,y:.03}
  ],
  "Lotus Blade": [
    {x:0,y:.06},{x:.15,y:.15},{x:.3,y:.22},{x:.5,y:.22},{x:.7,y:.15},{x:.9,y:.06}
  ],
};

function catmullRom(points, segs=10) {
  if (points.length<2) return [...points];
  if (points.length===2) {
    const r=[];
    for(let i=0;i<=segs;i++){const t=i/segs;r.push({x:points[0].x+(points[1].x-points[0].x)*t,y:points[0].y+(points[1].y-points[0].y)*t});}
    return r;
  }
  const result=[],n=points.length;
  for(let i=0;i<n-1;i++){
    const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[Math.min(n-1,i+1)],p3=points[Math.min(n-1,i+2)];
    for(let j=0;j<segs;j++){
      const t=j/segs,t2=t*t,t3=t2*t;
      result.push({
        x:.5*((-t3+2*t2-t)*p0.x+(3*t3-5*t2+2)*p1.x+(-3*t3+4*t2+t)*p2.x+(t3-t2)*p3.x),
        y:.5*((-t3+2*t2-t)*p0.y+(3*t3-5*t2+2)*p1.y+(-3*t3+4*t2+t)*p2.y+(t3-t2)*p3.y),
      });
    }
  }
  result.push(points[n-1]);
  return result;
}

function mirrorBlades(pts,count,cx,cy,r){
  const out=[],step=(2*Math.PI)/count;
  for(let b=0;b<count;b++){
    const a=step*b,cos=Math.cos(a),sin=Math.sin(a);
    out.push(pts.map(p=>({x:cx+p.x*r*cos-p.y*r*sin,y:cy+p.x*r*sin+p.y*r*cos})));
  }
  return out;
}

function estimateCp(points,bc){
  if(points.length<2)return 0;
  const maxC=Math.max(...points.map(p=>p.y));
  const avgC=points.reduce((s,p)=>s+p.y,0)/points.length;
  return Math.min(0.25,maxC*.8)*.4+Math.min(0.42,(1-maxC)*.5*Math.min(bc*avgC*2,1))*.6;
}

function getTier(cp,ws){const p=.5*1.225*Math.pow(ws,3)*cp;if(p<5)return"dormant";if(p<50)return"seedling";if(p<200)return"flourishing";return"radiant";}

const TM={dormant:{label:"Dormant",color:"#64748b",icon:"○"},seedling:{label:"Seedling",color:"#2dd4bf",icon:"◐"},flourishing:{label:"Flourishing",color:"#fbbf24",icon:"◉"},radiant:{label:"Radiant",color:"#f472b6",icon:"✦"}};

function KCanvas({points,setPoints,addPoint,updatePoint,bladeCount}){
  const ref=useRef(null),dragIdx=useRef(null),animRef=useRef(0),timeRef=useRef(0);
  useEffect(()=>{
    const cvs=ref.current;if(!cvs)return;
    const ctx=cvs.getContext("2d");
    const resize=()=>{const p=cvs.parentElement,dpr=Math.min(devicePixelRatio,2);cvs.width=p.clientWidth*dpr;cvs.height=p.clientHeight*dpr;cvs.style.width=p.clientWidth+"px";cvs.style.height=p.clientHeight+"px";};
    resize();window.addEventListener("resize",resize);
    let run=true;
    const draw=()=>{
      if(!run)return;
      timeRef.current+=.016;
      const dpr=Math.min(devicePixelRatio,2),w=cvs.width/dpr,h=cvs.height/dpr;
      ctx.resetTransform();ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
      const cx=w/2,cy=h/2,radius=Math.min(cx,cy)*.78;
      const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*1.5);
      bg.addColorStop(0,"#0f1628");bg.addColorStop(1,"#0a0e1a");
      ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
      ctx.strokeStyle="rgba(45,212,191,0.07)";ctx.lineWidth=1;
      for(let r=.25;r<=1;r+=.25){ctx.beginPath();ctx.arc(cx,cy,radius*r,0,Math.PI*2);ctx.stroke();}
      ctx.strokeStyle="rgba(45,212,191,0.05)";
      for(let i=0;i<bladeCount;i++){const a=(i/bladeCount)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*radius,cy+Math.sin(a)*radius);ctx.stroke();}
      if(points.length>=2){
        const smooth=catmullRom(points,10),mirrored=mirrorBlades(smooth,bladeCount,cx,cy,radius);
        mirrored.forEach(bl=>{if(bl.length<2)return;ctx.beginPath();ctx.moveTo(bl[0].x,bl[0].y);bl.forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle="rgba(45,212,191,0.12)";ctx.lineWidth=7;ctx.stroke();});
        mirrored.forEach((bl,idx)=>{if(bl.length<2)return;ctx.beginPath();ctx.moveTo(bl[0].x,bl[0].y);bl.forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle=`hsla(${174+idx*(30/bladeCount)},70%,55%,0.8)`;ctx.lineWidth=2.5;ctx.stroke();});
        points.forEach((pt,i)=>{
          const wx=cx+pt.x*radius,wy=cy+pt.y*radius;
          ctx.beginPath();ctx.arc(wx,wy,7,0,Math.PI*2);ctx.fillStyle="rgba(45,212,191,0.18)";ctx.fill();
          ctx.beginPath();ctx.arc(wx,wy,3.5,0,Math.PI*2);ctx.fillStyle=i===0?"#fbbf24":"#2dd4bf";ctx.fill();
          if(i>0){const prev=points[i-1];ctx.beginPath();ctx.moveTo(cx+prev.x*radius,cy+prev.y*radius);ctx.lineTo(wx,wy);ctx.strokeStyle="rgba(45,212,191,0.25)";ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);}
        });
      }
      const hg=ctx.createRadialGradient(cx,cy,0,cx,cy,14);hg.addColorStop(0,"rgba(45,212,191,0.5)");hg.addColorStop(1,"rgba(45,212,191,0)");
      ctx.fillStyle=hg;ctx.beginPath();ctx.arc(cx,cy,14,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#2dd4bf";ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();
      const ps=1+Math.sin(timeRef.current*2)*.015;
      ctx.beginPath();ctx.arc(cx,cy,radius*ps,0,Math.PI*2);ctx.strokeStyle="rgba(45,212,191,0.15)";ctx.lineWidth=1.5;ctx.stroke();
      animRef.current=requestAnimationFrame(draw);
    };
    animRef.current=requestAnimationFrame(draw);
    return()=>{run=false;cancelAnimationFrame(animRef.current);window.removeEventListener("resize",resize);};
  },[points,bladeCount]);
  const getC=(e)=>{const rect=ref.current.getBoundingClientRect();return{x:(e.touches?e.touches[0].clientX:e.clientX)-rect.left,y:(e.touches?e.touches[0].clientY:e.clientY)-rect.top};};
  const findN=(px)=>{const cvs=ref.current,dpr=Math.min(devicePixelRatio,2),w=cvs.width/dpr,h=cvs.height/dpr,cx=w/2,cy=h/2,radius=Math.min(cx,cy)*.78;for(let i=0;i<points.length;i++){if(Math.hypot(px.x-(cx+points[i].x*radius),px.y-(cy+points[i].y*radius))<14)return i;}return null;};
  const onDown=(e)=>{const px=getC(e),near=findN(px);if(near!==null){dragIdx.current=near;return;}const cvs=ref.current,dpr=Math.min(devicePixelRatio,2),w=cvs.width/dpr,h=cvs.height/dpr,cx=w/2,cy=h/2,radius=Math.min(cx,cy)*.78;addPoint({x:Math.max(0,Math.min(1,(px.x-cx)/radius)),y:Math.max(0,Math.min(.5,Math.abs((px.y-cy)/radius)))});};
  const onMove=(e)=>{if(dragIdx.current===null)return;const px=getC(e),cvs=ref.current,dpr=Math.min(devicePixelRatio,2),w=cvs.width/dpr,h=cvs.height/dpr,cx=w/2,cy=h/2,radius=Math.min(cx,cy)*.78;updatePoint(dragIdx.current,{x:Math.max(0,Math.min(1,(px.x-cx)/radius)),y:Math.max(0,Math.min(.5,Math.abs((px.y-cy)/radius)))});};
  const onUp=()=>{dragIdx.current=null;setPoints([...points].sort((a,b)=>a.x-b.x));};
  return <canvas ref={ref} style={{width:"100%",height:"100%",cursor:"crosshair"}} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>;
}

function TMesh({bladePoints,bladeCount,height,twist,taper,windSpeed,isSpinning,bloomTier}){
  const gRef=useRef(),spinRef=useRef(0);
  const geos=useMemo(()=>{
    if(bladePoints.length<2)return null;
    const sm=catmullRom(bladePoints,6),br=.6,hs=20,cs=sm.length,gs=[];
    for(let b=0;b<bladeCount;b++){
      const pos=[],idx=[];
      for(let h=0;h<=hs;h++){const hf=h/hs,y=height*.25+hf*height*.8,tw=twist*hf*Math.PI/180,tp=1-taper*Math.abs(hf-.5)*2,cos=Math.cos(tw),sin=Math.sin(tw);for(let c=0;c<cs;c++){const pt=sm[c],lx=pt.x*br*tp,lz=pt.y*br*tp;pos.push(lx*cos-lz*sin,y,lx*sin+lz*cos);}}
      for(let h=0;h<hs;h++)for(let c=0;c<cs-1;c++){const a=h*cs+c,b2=a+cs;idx.push(a,b2,a+1,a+1,b2,b2+1);}
      const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();geo.rotateY((b/bladeCount)*Math.PI*2);gs.push(geo);
    }
    return gs;
  },[bladePoints,bladeCount,height,twist,taper]);
  useFrame((_,dt)=>{if(!gRef.current||!isSpinning)return;const tsr=(4*Math.PI)/bladeCount;spinRef.current+=(windSpeed*tsr)/(0.6*2*Math.PI)*dt*1.8;gRef.current.rotation.y=spinRef.current;});
  const tc={dormant:"#4a6670",seedling:"#2dd4bf",flourishing:"#34d399",radiant:"#a78bfa"};
  const mat=useMemo(()=>new THREE.MeshStandardMaterial({color:tc[bloomTier]||"#2dd4bf",metalness:.55,roughness:.35,side:THREE.DoubleSide}),[bloomTier]);
  const smat=useMemo(()=>new THREE.MeshStandardMaterial({color:"#64748b",metalness:.7,roughness:.3}),[]);
  if(!geos)return null;
  return(
    <group ref={gRef}>
      <mesh position={[0,height*.65,0]} material={smat}><cylinderGeometry args={[.04,.04,height*1.3,16]}/></mesh>
      {geos.map((g,i)=><mesh key={i} geometry={g} material={mat}/>)}
      <mesh position={[0,height*1.05,0]} rotation={[Math.PI/2,0,0]} material={smat}><torusGeometry args={[.18,.012,8,32]}/></mesh>
      <mesh position={[0,height*.25,0]} rotation={[Math.PI/2,0,0]} material={smat}><torusGeometry args={[.18,.012,8,32]}/></mesh>
      {Array.from({length:bladeCount}).map((_,b)=>{const a=(b/bladeCount)*Math.PI*2;return[height*.25,height*1.05].map((yp,si)=>(<mesh key={`s${b}${si}`} position={[Math.cos(a)*.22,yp,Math.sin(a)*.22]} rotation={[0,-a+Math.PI/2,Math.PI/2]} material={smat}><cylinderGeometry args={[.008,.008,.4,6]}/></mesh>));})}
    </group>
  );
}

function WP({windSpeed,isSpinning}){
  const ref=useRef();const count=150;
  const[positions,velocities]=useMemo(()=>{const p=new Float32Array(count*3),v=new Float32Array(count*3);for(let i=0;i<count;i++){p[i*3]=(Math.random()-.5)*4;p[i*3+1]=Math.random()*2.5;p[i*3+2]=(Math.random()-.5)*4;v[i*3]=.3+Math.random()*.5;v[i*3+1]=(Math.random()-.5)*.1;v[i*3+2]=(Math.random()-.5)*.2;}return[p,v];},[]);
  useFrame((_,dt)=>{if(!ref.current||!isSpinning)return;const arr=ref.current.geometry.attributes.position.array,sp=windSpeed*.08;for(let i=0;i<count;i++){arr[i*3]+=velocities[i*3]*sp*dt*10;arr[i*3+1]+=velocities[i*3+1]*dt*3;arr[i*3+2]+=velocities[i*3+2]*dt*3;if(arr[i*3]>2.5){arr[i*3]=-2.5;arr[i*3+1]=Math.random()*2.5;arr[i*3+2]=(Math.random()-.5)*4;}}ref.current.geometry.attributes.position.needsUpdate=true;});
  return(<points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial size={.02} color="#5eead4" transparent opacity={Math.min(.7,windSpeed/15)} sizeAttenuation/></points>);
}

function Scene3D(props){
  const bgc={dormant:"#0a0e1a",seedling:"#0b1020",flourishing:"#0d1225",radiant:"#10152e"};
  const bg=bgc[props.bloomTier]||"#0a0e1a";
  return(
    <Canvas camera={{position:[1.8,1.6,1.8],fov:45}} gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.2}}>
      <color attach="background" args={[bg]}/><fog attach="fog" args={[bg,4,12]}/>
      <ambientLight intensity={.35}/><directionalLight position={[3,5,2]} intensity={1.2}/>
      <pointLight position={[-2,3,-1]} intensity={.4} color="#5eead4"/>
      <pointLight position={[1,.5,2]} intensity={.2} color="#a78bfa"/>
      <Float speed={.5} rotationIntensity={0} floatIntensity={.3}><TMesh {...props}/></Float>
      <WP windSpeed={props.windSpeed} isSpinning={props.isSpinning}/>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.01,0]}><circleGeometry args={[3,64]}/><meshStandardMaterial color="#0f1628" metalness={.1} roughness={.9}/></mesh>
      <ContactShadows position={[0,0,0]} opacity={.35} scale={5} blur={2.5} far={3}/>
      <OrbitControls enableDamping dampingFactor={.05} minDistance={1} maxDistance={6} target={[0,.8,0]} maxPolarAngle={Math.PI/2+.3} autoRotate autoRotateSpeed={.5}/>
    </Canvas>
  );
}

function Sl({label,value,min,max,step,onChange,unit=""}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:2}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#94a3b8"}}>
        <span style={{textTransform:"uppercase",letterSpacing:1}}>{label}</span>
        <span style={{fontFamily:"monospace",color:"#2dd4bf"}}>{value.toFixed(step<1?1:0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={{width:"100%",accentColor:"#2dd4bf",height:4,cursor:"pointer"}}/>
    </div>
  );
}

export default function TurbineBloom(){
  const[mode,setMode]=useState("draw");
  const[points,setPoints]=useState([...PRESETS["Breeze Petal"]]);
  const[bladeCount,setBladeCount]=useState(3);
  const[windSpeed,setWindSpeed]=useState(6);
  const[height,setHeight]=useState(1.5);
  const[twist,setTwist]=useState(0);
  const[taper,setTaper]=useState(0);
  const[isSpinning,setIsSpinning]=useState(true);
  const[activePreset,setActivePreset]=useState("Breeze Petal");

  const cp=estimateCp(points,bladeCount);
  const power=.5*1.225*Math.pow(windSpeed,3)*cp;
  const tier=getTier(cp,windSpeed);
  const tm=TM[tier];
  const addPoint=(pt)=>setPoints(p=>[...p,pt]);
  const updatePoint=(i,pt)=>setPoints(p=>{const n=[...p];n[i]=pt;return n;});
  const loadPreset=(name)=>{setPoints([...PRESETS[name]]);setActivePreset(name);};

  return(
    <div style={{width:"100%",height:"100vh",display:"flex",flexDirection:"column",background:"#0a0e1a",color:"#e2e8f0",fontFamily:"system-ui,sans-serif",overflow:"hidden"}}>
      {/* Header */}
      <div style={{height:48,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",borderBottom:"1px solid rgba(42,53,85,0.4)",background:"rgba(15,22,40,0.8)",backdropFilter:"blur(8px)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#2dd4bf,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"white",fontWeight:700}}>✦</div>
          <span style={{fontSize:13,fontWeight:600}}>Turbine<span style={{color:"#2dd4bf"}}>Bloom</span></span>
          <span style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:"#161d33",color:"#64748b",border:"1px solid rgba(42,53,85,0.5)"}}>v0.1</span>
        </div>
        <div style={{display:"flex",background:"#161d33",borderRadius:8,border:"1px solid rgba(42,53,85,0.5)",padding:2}}>
          {["draw","view"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{padding:"6px 16px",borderRadius:6,border:"none",fontSize:12,fontWeight:500,cursor:"pointer",transition:"all 0.2s",background:mode===m?"rgba(45,212,191,0.15)":"transparent",color:mode===m?"#2dd4bf":"#64748b"}}>
              {m==="draw"?"✎ Draw":"◇ View 3D"}
            </button>
          ))}
        </div>
        <span style={{fontSize:9,color:"#64748b"}}>Draw a blade → See it bloom</span>
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Left */}
        <div style={{width:164,borderRight:"1px solid rgba(42,53,85,0.4)",background:"rgba(15,22,40,0.5)",overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:2,color:"#64748b",marginBottom:2}}>Presets</div>
          {Object.keys(PRESETS).map(name=>(
            <button key={name} onClick={()=>loadPreset(name)} style={{textAlign:"left",padding:"7px 10px",borderRadius:8,border:activePreset===name?"1px solid rgba(45,212,191,0.3)":"1px solid rgba(42,53,85,0.4)",background:activePreset===name?"rgba(45,212,191,0.1)":"rgba(22,29,51,0.5)",color:activePreset===name?"#2dd4bf":"#94a3b8",fontSize:11,fontWeight:500,cursor:"pointer"}}>{name}</button>
          ))}
          <button onClick={()=>{setPoints([]);setActivePreset(null);}} style={{marginTop:8,textAlign:"left",padding:"7px 10px",borderRadius:8,border:"1px solid rgba(42,53,85,0.4)",background:"rgba(22,29,51,0.5)",color:"#64748b",fontSize:11,cursor:"pointer"}}>✕ Clear</button>
        </div>

        {/* Center */}
        <div style={{flex:1,position:"relative"}}>
          {mode==="draw"?<KCanvas points={points} setPoints={setPoints} addPoint={addPoint} updatePoint={updatePoint} bladeCount={bladeCount}/>
            :<Scene3D bladePoints={points} bladeCount={bladeCount} height={height} twist={twist} taper={taper} windSpeed={windSpeed} isSpinning={isSpinning} bloomTier={tier}/>}
          <div style={{position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",background:"rgba(22,29,51,0.8)",backdropFilter:"blur(6px)",borderRadius:20,padding:"5px 14px",border:"1px solid rgba(42,53,85,0.3)",fontSize:10,color:"#64748b",pointerEvents:"none",whiteSpace:"nowrap"}}>
            {mode==="draw"?"Click to add points · Drag to reshape":"Drag to orbit · Scroll to zoom"}
          </div>
        </div>

        {/* Right */}
        <div style={{width:192,borderLeft:"1px solid rgba(42,53,85,0.4)",background:"rgba(15,22,40,0.5)",overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:10,flexShrink:0}}>
          <div style={{borderRadius:10,padding:10,border:`1px solid ${tm.color}30`,background:`linear-gradient(135deg,${tm.color}08,${tm.color}04)`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:16,color:tm.color}}>{tm.icon}</span>
              <span style={{fontSize:12,fontWeight:500,color:tm.color}}>{tm.label}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#64748b"}}>
              <span>Cp: {cp.toFixed(3)}</span><span>Power: {power.toFixed(1)}W</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:2,color:"#64748b",marginBottom:4}}>Blades</div>
            <div style={{display:"flex",gap:3}}>
              {[2,3,4,5,6,8].map(n=>(
                <button key={n} onClick={()=>setBladeCount(n)} style={{flex:1,padding:"5px 0",borderRadius:6,border:bladeCount===n?"1px solid rgba(45,212,191,0.3)":"1px solid rgba(42,53,85,0.4)",background:bladeCount===n?"rgba(45,212,191,0.15)":"rgba(22,29,51,0.5)",color:bladeCount===n?"#2dd4bf":"#94a3b8",fontSize:11,fontWeight:500,cursor:"pointer"}}>{n}</button>
              ))}
            </div>
          </div>
          <Sl label="Wind Speed" value={windSpeed} min={0} max={25} step={.5} onChange={setWindSpeed} unit=" m/s"/>
          <div style={{borderTop:"1px solid rgba(42,53,85,0.3)",paddingTop:8}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:2,color:"#64748b",marginBottom:6}}>Extrusion</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Sl label="Height" value={height} min={.5} max={3} step={.1} onChange={setHeight} unit="m"/>
              <Sl label="Twist" value={twist} min={0} max={90} step={1} onChange={setTwist} unit="°"/>
              <Sl label="Taper" value={taper} min={0} max={.8} step={.05} onChange={setTaper}/>
            </div>
          </div>
          <button onClick={()=>setIsSpinning(!isSpinning)} style={{padding:"7px 0",borderRadius:8,border:isSpinning?"1px solid rgba(45,212,191,0.3)":"1px solid rgba(42,53,85,0.4)",background:isSpinning?"rgba(45,212,191,0.12)":"rgba(22,29,51,0.5)",color:isSpinning?"#2dd4bf":"#94a3b8",fontSize:11,fontWeight:500,cursor:"pointer",width:"100%"}}>
            {isSpinning?"⟳ Spinning":"⏸ Paused"}
          </button>
        </div>
      </div>
    </div>
  );
}
