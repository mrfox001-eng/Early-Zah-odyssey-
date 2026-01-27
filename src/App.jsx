import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Float, Stars, Trail, Sparkles, PerspectiveCamera, RoundedBox, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import { Zap, MapPin, ShoppingBag, ArrowUpCircle } from 'lucide-react';

// --- CONSTANTS ---
const MAP_SIZE = 120;
const PLAYER_SPEED = 0.25;
const CAMERA_HEIGHT = 18;
const CAMERA_DISTANCE = 22;

// --- COLORS ---
const PALETTE = {
  skin: "#ffdab9",
  hair: "#ff1493", // Hot pink
  outfit: "#ffffff",
  asphalt: "#1e293b",
  grass: "#10b981",
  water: "#0ea5e9",
  sand: "#fcd34d",
  neon: "#a855f7"
};

// --- SHADERS (Procedural Textures) ---
// These ensure the floor is never black and looks detailed
const floorVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const floorFragmentShader = `
  varying vec2 vUv;
  uniform vec3 colorPrimary;
  uniform vec3 colorSecondary;
  uniform float scale;
  
  void main() {
    // Create a grid/tile pattern
    vec2 grid = fract(vUv * scale);
    float line = step(0.95, grid.x) + step(0.95, grid.y);
    vec3 color = mix(colorPrimary, colorSecondary, line);
    
    // Add some noise/texture
    float noise = sin(vUv.x * 50.0) * sin(vUv.y * 50.0) * 0.05;
    
    gl_FragColor = vec4(color + noise, 1.0);
  }
`;

// --- COMPONENTS ---

// 1. THE MAP (Procedural Biomes)
const GroundSegment = ({ position, type, size }) => {
  const uniforms = useMemo(() => {
    let c1, c2, s;
    if (type === 'city') { c1 = new THREE.Color(PALETTE.asphalt); c2 = new THREE.Color('#334155'); s = 20.0; }
    else if (type === 'park') { c1 = new THREE.Color(PALETTE.grass); c2 = new THREE.Color('#059669'); s = 10.0; }
    else if (type === 'beach') { c1 = new THREE.Color(PALETTE.sand); c2 = new THREE.Color('#fbbf24'); s = 5.0; }
    else { c1 = new THREE.Color(PALETTE.water); c2 = new THREE.Color('#38bdf8'); s = 8.0; }
    
    return {
      colorPrimary: { value: c1 },
      colorSecondary: { value: c2 },
      scale: { value: s }
    };
  }, [type]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position[0], -0.1, position[2]]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <shaderMaterial 
        vertexShader={floorVertexShader} 
        fragmentShader={floorFragmentShader} 
        uniforms={uniforms} 
      />
    </mesh>
  );
};

// 2. BUILDINGS (Neon City Style)
const Building = ({ pos, size, color }) => (
  <group position={pos}>
    <RoundedBox args={size} radius={0.2} receiveShadow castShadow position={[0, size[1]/2, 0]}>
      <meshStandardMaterial color={color} roughness={0.2} metalness={0.6} />
    </RoundedBox>
    {/* Windows */}
    <mesh position={[0, size[1]/2, size[2]/2 + 0.05]}>
      <planeGeometry args={[size[0]*0.7, size[1]*0.8]} />
      <meshStandardMaterial color={color} emissive="white" emissiveIntensity={0.5} />
    </mesh>
    {/* Roof Light */}
    <mesh position={[0, size[1], 0]} rotation={[-Math.PI/2, 0, 0]}>
       <circleGeometry args={[size[0]*0.3]} />
       <meshBasicMaterial color={color} />
    </mesh>
  </group>
);

const Tree = ({ pos }) => (
  <group position={pos}>
    <mesh castShadow position={[0, 1.5, 0]}>
      <cylinderGeometry args={[0.2, 0.5, 3]} />
      <meshStandardMaterial color="#451a03" />
    </mesh>
    <mesh castShadow position={[0, 4, 0]}>
      <dodecahedronGeometry args={[2]} />
      <meshStandardMaterial color="#22c55e" />
    </mesh>
  </group>
);

// 3. PHYSICAL SHOP
const ShopBuilding = ({ pos }) => (
  <group position={pos}>
    <mesh position={[0, 0.1, 0]}>
       <cylinderGeometry args={[6, 6, 0.2]} />
       <meshBasicMaterial color="#fcd34d" transparent opacity={0.3} />
    </mesh>
    <group position={[0, 3, 0]}>
      <mesh castShadow>
        <boxGeometry args={[5, 6, 5]} />
        <meshStandardMaterial color="#db2777" />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <coneGeometry args={[4, 3, 4]} />
        <meshStandardMaterial color="#fcd34d" />
      </mesh>
      <Text position={[0, 0.5, 2.6]} fontSize={0.8} color="yellow" anchorX="center">FORTUNE</Text>
      <Text position={[0, -0.5, 2.6]} fontSize={0.5} color="white" anchorX="center">OPEN 24/7</Text>
    </group>
    <Sparkles count={30} scale={6} size={4} color="#fcd34d" position={[0, 2, 0]} />
  </group>
);

// 4. CHARACTER (Early-Zah)
const Player = ({ position, rotation, isMoving }) => {
  const group = useRef();
  
  useFrame((state) => {
    if(group.current && isMoving) {
        // Bobbing animation
        group.current.position.y = Math.sin(state.clock.elapsedTime * 10) * 0.1;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group ref={group}>
        {/* Body */}
        <mesh castShadow position={[0, 0.75, 0]}>
          <capsuleGeometry args={[0.35, 0.8, 4, 16]} />
          <meshStandardMaterial color={PALETTE.outfit} />
        </mesh>
        {/* Skirt */}
        <mesh position={[0, 0.4, 0]}>
            <coneGeometry args={[0.45, 0.5, 32]} />
            <meshStandardMaterial color={PALETTE.neon} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.45, 0]}>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshStandardMaterial color={PALETTE.skin} />
        </mesh>
        {/* Hair */}
        <mesh position={[0, 1.5, -0.1]}>
           <sphereGeometry args={[0.35, 32, 32]} />
           <meshStandardMaterial color={PALETTE.hair} />
        </mesh>
        {/* Ponytails */}
        <mesh position={[0.3, 1.5, -0.1]}>
           <sphereGeometry args={[0.15]} />
           <meshStandardMaterial color={PALETTE.hair} />
        </mesh>
        <mesh position={[-0.3, 1.5, -0.1]}>
           <sphereGeometry args={[0.15]} />
           <meshStandardMaterial color={PALETTE.hair} />
        </mesh>
      </group>
      <pointLight intensity={0.5} color={PALETTE.hair} distance={3} position={[0, 2, 0]} />
    </group>
  );
};

// 5. AI CAT
const AICat = ({ targetPos }) => {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) {
        // Smooth follow
        ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, targetPos[0] - 1.2, 0.08);
        ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, targetPos[2] - 1.2, 0.08);
        ref.current.position.y = 1 + Math.sin(Date.now() * 0.005) * 0.3;
        ref.current.lookAt(targetPos[0], targetPos[1], targetPos[2]);
    }
  });
  return (
    <group ref={ref}>
        <Trail width={0.4} length={6} color="cyan" attenuation={(t) => t * t}>
            <mesh castShadow>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshStandardMaterial color="cyan" emissive="blue" emissiveIntensity={2} />
            </mesh>
        </Trail>
        {/* Cat Ears */}
        <mesh position={[0.15, 0.2, 0]} rotation={[0,0,-0.2]}><coneGeometry args={[0.08, 0.2]} /><meshBasicMaterial color="white"/></mesh>
        <mesh position={[-0.15, 0.2, 0]} rotation={[0,0,0.2]}><coneGeometry args={[0.08, 0.2]} /><meshBasicMaterial color="white"/></mesh>
    </group>
  );
};

// 6. NPC
const NPC = ({ pos, name, msg }) => (
    <group position={pos}>
        <mesh position={[0, 1, 0]} castShadow>
            <capsuleGeometry args={[0.3, 1, 4]} />
            <meshStandardMaterial color="gray" />
        </mesh>
        <Text position={[0, 2.3, 0]} fontSize={0.3} color="white" outlineWidth={0.02} outlineColor="black">{name}</Text>
        {/* Chat Bubble Simulation */}
        <group position={[0, 3, 0]}>
             <mesh>
                <planeGeometry args={[2, 0.8]} />
                <meshBasicMaterial color="white" transparent opacity={0.8} />
             </mesh>
             <Text position={[0, 0, 0.01]} fontSize={0.15} color="black" maxWidth={1.8} textAlign="center">
                {msg}
             </Text>
        </group>
    </group>
);

// --- CONTROLS ---
const Joystick = ({ onInput }) => {
    const [active, setActive] = useState(false);
    const stick = useRef();
    const center = useRef({x:0, y:0});

    const start = (e) => {
        const t = e.changedTouches ? e.changedTouches[0] : e;
        center.current = {x: t.clientX, y: t.clientY};
        setActive(true);
    };
    
    const move = (e) => {
        if(!active) return;
        const t = e.changedTouches ? e.changedTouches[0] : e;
        const dx = t.clientX - center.current.x;
        const dy = t.clientY - center.current.y;
        const dist = Math.min(Math.sqrt(dx*dx+dy*dy), 40);
        const ang = Math.atan2(dy, dx);
        const x = Math.cos(ang)*dist;
        const y = Math.sin(ang)*dist;
        if(stick.current) stick.current.style.transform = `translate(${x}px, ${y}px)`;
        onInput({x: x/40, y: y/40});
    };

    const end = () => {
        setActive(false);
        if(stick.current) stick.current.style.transform = `translate(0,0)`;
        onInput({x:0, y:0});
    };

    return (
        <div 
            className="absolute bottom-10 left-10 w-32 h-32 bg-white/20 backdrop-blur rounded-full border-2 border-white/50 flex items-center justify-center z-50 touch-none"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        >
            <div ref={stick} className="w-12 h-12 bg-white rounded-full shadow-lg pointer-events-none" />
        </div>
    );
};

// --- GAME LOGIC ---

export default function App() {
    // Core State
    const [pos, setPos] = useState([0, 0, 0]);
    const [rot, setRot] = useState(0);
    const [input, setInput] = useState({x:0, y:0});
    const [tokens, setTokens] = useState(0);
    const [shopOpen, setShopOpen] = useState(false);
    const [missionMsg, setMissionMsg] = useState("Explore the city and find the Fortune Shop!");

    // Procedural World Generation (Memoized so it doesn't reload)
    const world = useMemo(() => {
        const buildings = [];
        const trees = [];
        const shopPos = [15, 0, 15];

        // 1. City Zone (Center)
        for(let i=0; i<40; i++) {
            const x = (Math.random()-0.5) * 60;
            const z = (Math.random()-0.5) * 60;
            // Clear Roads
            if (Math.abs(x) < 5 || Math.abs(z) < 5) continue;
            // Clear Shop
            if (Math.abs(x - shopPos[0]) < 8 && Math.abs(z - shopPos[2]) < 8) continue;
            
            buildings.push({
                pos: [x, 0, z],
                size: [3+Math.random()*3, 6+Math.random()*10, 3+Math.random()*3],
                color: Math.random() > 0.5 ? '#475569' : '#334155'
            });
        }

        // 2. Park Zone (Negative Z)
        for(let i=0; i<30; i++) {
            const x = (Math.random()-0.5) * 100;
            const z = -40 - Math.random() * 40;
            trees.push({ pos: [x, 0, z] });
        }

        return { buildings, trees, shopPos };
    }, []);

    const npcs = [
        { id: 1, name: "Citizen 01", msg: "The weather is digital today.", pos: [5, 0, 8] },
        { id: 2, name: "Worker", msg: "I lost my keys in the park.", pos: [-10, 0, -20] },
        { id: 3, name: "Surfer", msg: "The water data is cold.", pos: [50, 0, 0] }
    ];

    // Game Loop
    const GameLoop = () => {
        useFrame((state) => {
            if (input.x !== 0 || input.y !== 0) {
                // Movement
                const angle = Math.atan2(input.x, input.y);
                setRot(angle);
                
                const nx = pos[0] + input.x * PLAYER_SPEED;
                const nz = pos[2] + input.y * PLAYER_SPEED;
                
                // Simple Bounds
                if(nx > -60 && nx < 60 && nz > -60 && nz < 60) {
                    setPos([nx, 0, nz]); // Ensure Y is always 0 (ground level)
                }

                // Camera Follow (Smooth)
                const camX = THREE.MathUtils.lerp(state.camera.position.x, nx, 0.1);
                const camZ = THREE.MathUtils.lerp(state.camera.position.z, nz + CAMERA_DISTANCE, 0.1);
                state.camera.position.set(camX, CAMERA_HEIGHT, camZ);
                state.camera.lookAt(nx, 0, nz);
            }
        });
        return null;
    };

    const handleShop = () => {
        const dist = Math.sqrt(Math.pow(pos[0]-world.shopPos[0], 2) + Math.pow(pos[2]-world.shopPos[2], 2));
        if (dist < 8) {
            setShopOpen(true);
        } else {
            alert("You are too far from the shop! Go to the pink building.");
        }
    };

    const buyCookie = () => {
        if (tokens >= 0) { // Free for demo
            setTokens(t => t + 10); // Grant tokens instead for fun
            setMissionMsg("Fortune: You will create something amazing today.");
            setShopOpen(false);
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', background: 'black', overflow: 'hidden', position: 'relative' }}>
            
            {/* 3D SCENE */}
            <Canvas shadows dpr={[1, 1.5]}> {/* Lower DPR for performance */}
                <PerspectiveCamera makeDefault position={[0, CAMERA_HEIGHT, CAMERA_DISTANCE]} fov={50} />
                
                {/* Lighting (Guaranteed Visibility) */}
                <ambientLight intensity={0.7} />
                <directionalLight position={[50, 50, 25]} intensity={1.5} castShadow shadow-mapSize={[1024,1024]} />
                <Stars radius={100} depth={50} count={3000} factor={4} fade />
                <Cloud opacity={0.5} speed={0.4} width={100} depth={1.5} segments={20} position={[0, 20, -50]} />

                {/* --- WORLD --- */}
                {/* City Floor */}
                <GroundSegment position={[0, 0, 0]} size={80} type="city" />
                {/* Park Floor */}
                <GroundSegment position={[0, 0, -80]} size={80} type="park" />
                {/* Beach Floor */}
                <GroundSegment position={[80, 0, 0]} size={80} type="beach" />
                {/* Ocean */}
                <GroundSegment position={[160, 0, 0]} size={80} type="water" />

                {/* Objects */}
                {world.buildings.map((b, i) => <Building key={i} {...b} />)}
                {world.trees.map((t, i) => <Tree key={i} {...t} />)}
                <ShopBuilding pos={world.shopPos} />
                
                {/* NPCs */}
                {npcs.map(n => <NPC key={n.id} {...n} />)}

                {/* Player */}
                <Player position={pos} rotation={rot} isMoving={input.x !== 0 || input.y !== 0} />
                <AICat targetPos={pos} />

                <GameLoop />
            </Canvas>

            {/* UI LAYOUT */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                
                {/* Top HUD */}
                <div className="flex justify-between p-4 pointer-events-auto">
                    <div className="bg-black/50 backdrop-blur border border-white/20 rounded-xl p-3 flex items-center gap-3 text-white">
                        <div className="bg-yellow-400 p-2 rounded-lg text-black"><Zap size={16} /></div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase font-bold">Credits</p>
                            <p className="text-xl font-bold font-mono">{tokens}</p>
                        </div>
                    </div>
                    
                    <button onClick={handleShop} className="bg-pink-600 hover:bg-pink-500 text-white p-3 rounded-full border-2 border-white shadow-lg transition-transform active:scale-90">
                        <ShoppingBag size={24} />
                    </button>
                </div>

                {/* Mission Message */}
                <div className="absolute top-20 w-full flex justify-center">
                    <div className="bg-white/10 backdrop-blur px-6 py-2 rounded-full border border-white/20 text-white font-bold text-shadow">
                        {missionMsg}
                    </div>
                </div>

                {/* Bottom Controls */}
                <Joystick onInput={setInput} />
                
                <div className="absolute bottom-10 right-10 text-white/50 text-right text-xs">
                    <p>EARLY-ZAH ONLINE</p>
                    <p>v2.0.4 stable</p>
                </div>

            </div>

            {/* SHOP MODAL */}
            {shopOpen && (
                <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-6 pointer-events-auto">
                    <div className="bg-gray-900 border-2 border-yellow-500 w-full max-w-sm rounded-2xl p-6 text-center shadow-[0_0_50px_rgba(234,179,8,0.4)]">
                        <h2 className="text-3xl font-black text-yellow-500 italic mb-2">FORTUNE SHOP</h2>
                        <p className="text-gray-400 mb-6 text-sm">Unlock the secrets of the digital world.</p>
                        
                        <div className="bg-black/40 p-4 rounded-xl mb-4 border border-white/10 flex items-center gap-4">
                            <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-2xl">🥠</div>
                            <div className="text-left">
                                <p className="font-bold text-white">Mystic Cookie</p>
                                <p className="text-xs text-green-400">Guaranteed Wisdom</p>
                            </div>
                        </div>

                        <button 
                            onClick={buyCookie}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl mb-3 transition-colors"
                        >
                            OPEN COOKIE (FREE)
                        </button>
                        
                        <button 
                            onClick={() => setShopOpen(false)}
                            className="text-gray-500 text-sm hover:text-white"
                        >
                            Return to City
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}


