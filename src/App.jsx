import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Float, Stars, Trail, Sparkles, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Zap, MessageCircle } from 'lucide-react';

// --- CONFIG ---
const MAP_SIZE = 200; // Much bigger map
const PLAYER_SPEED = 0.3;
const NPC_COUNT = 15;

// --- ASSETS GENERATION (Procedural Textures) ---
// This generates a texture in memory so you don't need image files
const createGridTexture = (color1, color2) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color1;
    ctx.fillRect(0,0,64,64);
    ctx.fillStyle = color2;
    ctx.fillRect(0,0,32,32);
    ctx.fillRect(32,32,32,32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(100, 100);
    return tex;
};

// --- SHADERS ---
const WaterShader = {
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#00bfff') } },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.z += sin(pos.x * 0.5 + uTime) * 0.5;
        pos.z += cos(pos.y * 0.5 + uTime) * 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uTime;
      void main() {
        float foam = sin(vUv.x * 20.0 + uTime * 2.0) + cos(vUv.y * 20.0 + uTime);
        vec3 color = mix(uColor, vec3(1.0), step(1.5, foam) * 0.5);
        gl_FragColor = vec4(color, 0.8);
      }
    `
};

// --- COMPONENTS ---

// 1. THE WORLD (City, Park, Beach)
const World = () => {
    const cityTex = useMemo(() => createGridTexture('#1a1a1a', '#222'), []);
    const grassTex = useMemo(() => createGridTexture('#064e3b', '#065f46'), []);
    const sandTex = useMemo(() => createGridTexture('#f59e0b', '#d97706'), []);

    return (
        <group>
            {/* 1. CITY ZONE (Center) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial map={cityTex} />
            </mesh>
            {/* Road Markings */}
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0, 0]}>
                 <planeGeometry args={[10, 100]} />
                 <meshStandardMaterial color="#333" />
            </mesh>
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0, 0]}>
                 <planeGeometry args={[100, 10]} />
                 <meshStandardMaterial color="#333" />
            </mesh>

            {/* 2. PARK ZONE (North - Negative Z) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -100]} receiveShadow>
                <planeGeometry args={[200, 100]} />
                <meshStandardMaterial map={grassTex} color="#4ade80" />
            </mesh>

            {/* 3. BEACH ZONE (East - Positive X) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[100, -0.1, 0]} receiveShadow>
                <planeGeometry args={[100, 200]} />
                <meshStandardMaterial map={sandTex} color="#fcd34d" />
            </mesh>
            
            {/* 4. OCEAN (Far East) */}
            <Water position={[180, -1, 0]} />
        </group>
    );
};

const Water = ({ position }) => {
    const mesh = useRef();
    useFrame((state) => {
        if(mesh.current) mesh.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    });
    return (
        <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={position}>
            <planeGeometry args={[100, 300, 32, 32]} />
            <shaderMaterial args={[WaterShader]} transparent />
        </mesh>
    );
};

// 2. BUILDINGS & PROPS
const Building = ({ pos, size, color, isNeon }) => (
    <group position={pos}>
        <mesh castShadow receiveShadow position={[0, size[1]/2, 0]}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
        </mesh>
        {/* Windows */}
        {isNeon && (
            <mesh position={[0, size[1]/2, size[2]/2 + 0.05]}>
                <planeGeometry args={[size[0]*0.6, size[1]*0.8]} />
                <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={2} />
            </mesh>
        )}
    </group>
);

const Tree = ({ pos }) => (
    <group position={pos}>
        <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.4, 2]} />
            <meshStandardMaterial color="#78350f" />
        </mesh>
        <mesh position={[0, 3, 0]} castShadow>
            <dodecahedronGeometry args={[1.5]} />
            <meshStandardMaterial color="#22c55e" />
        </mesh>
    </group>
);

const Shop = ({ pos }) => (
    <group position={pos}>
        <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[4, 5, 6, 6]} />
            <meshStandardMaterial color="#be185d" />
        </mesh>
        <mesh position={[0, 7, 0]}>
             <coneGeometry args={[5, 3, 6]} />
             <meshStandardMaterial color="#facc15" />
        </mesh>
        <Text position={[0, 4, 4.5]} fontSize={1} color="white" font="bold">FORTUNE SHOP</Text>
        <Sparkles count={50} scale={8} size={4} color="yellow" position={[0, 2, 0]} />
    </group>
);

// 3. NPC SYSTEM
const NPC = ({ pos, name, color, msg, playerPos }) => {
    const group = useRef();
    const [showMsg, setShowMsg] = useState(false);

    useFrame((state) => {
        if(group.current) {
            // Simple wandering or idle animation
            group.current.rotation.y += 0.01;
            
            // Check distance to player
            const dist = new THREE.Vector3(...playerPos).distanceTo(group.current.position);
            setShowMsg(dist < 5);
        }
    });

    return (
        <group ref={group} position={pos}>
            {showMsg && (
                <Html position={[0, 3, 0]} center>
                    <div className="bg-white/90 p-2 rounded-lg text-black text-xs font-bold w-32 text-center border-2 border-black">
                        {msg}
                    </div>
                </Html>
            )}
            <mesh position={[0, 1, 0]} castShadow>
                <capsuleGeometry args={[0.3, 1, 4]} />
                <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 1.5, 0.2]}>
                <boxGeometry args={[0.4, 0.1, 0.2]} />
                <meshStandardMaterial color="black" />
            </mesh>
            <Text position={[0, 2.2, 0]} fontSize={0.3} color="white">{name}</Text>
        </group>
    );
};

// 4. PLAYER
const Player = ({ position, rotation, isMoving }) => {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
             <Float speed={isMoving ? 10 : 2} rotationIntensity={0.2} floatIntensity={0.2}>
                <group position={[0, 0.8, 0]}>
                    <mesh castShadow>
                        <capsuleGeometry args={[0.3, 0.8, 4, 16]} />
                        <meshStandardMaterial color="#ec4899" />
                    </mesh>
                    <mesh position={[0, 0.5, 0]}>
                        <sphereGeometry args={[0.35]} />
                        <meshStandardMaterial color="#ffdecb" />
                    </mesh>
                    <mesh position={[0, 0.6, -0.1]}>
                        <boxGeometry args={[0.5, 0.5, 0.5]} />
                        <meshStandardMaterial color="#4c1d95" />
                    </mesh>
                </group>
             </Float>
             <pointLight intensity={1} distance={5} color="#ec4899" />
        </group>
    );
};

// 5. AI CAT
const AICat = ({ targetPos }) => {
    const ref = useRef();
    useFrame(() => {
        if(ref.current) {
            ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, targetPos[0] - 1, 0.08);
            ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, targetPos[2] - 1, 0.08);
            ref.current.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
            ref.current.lookAt(targetPos[0], targetPos[1], targetPos[2]);
        }
    });
    return (
        <group ref={ref}>
             <mesh castShadow>
                 <sphereGeometry args={[0.25]} />
                 <meshStandardMaterial color="cyan" emissive="blue" emissiveIntensity={1} />
             </mesh>
             <Trail width={0.5} length={5} color="cyan" attenuation={(t) => t * t} />
        </group>
    );
};

// --- JOYSTICK ---
const Joystick = ({ onInput }) => {
    const stick = useRef();
    const center = useRef({ x: 0, y: 0 });
    const [active, setActive] = useState(false);

    const handleStart = (e) => {
        const t = e.changedTouches ? e.changedTouches[0] : e;
        center.current = { x: t.clientX, y: t.clientY };
        setActive(true);
    };

    const handleMove = (e) => {
        if(!active) return;
        const t = e.changedTouches ? e.changedTouches[0] : e;
        const dx = t.clientX - center.current.x;
        const dy = t.clientY - center.current.y;
        const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 50);
        const angle = Math.atan2(dy, dx);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        if(stick.current) stick.current.style.transform = `translate(${x}px, ${y}px)`;
        onInput({ x: x/50, y: y/50 });
    };

    const handleEnd = () => {
        setActive(false);
        if(stick.current) stick.current.style.transform = `translate(0,0)`;
        onInput({ x: 0, y: 0 });
    };

    return (
        <div 
            className="absolute bottom-12 left-12 w-32 h-32 bg-white/10 rounded-full border-2 border-white/30 backdrop-blur-md z-50 flex items-center justify-center"
            onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
            onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        >
            <div ref={stick} className="w-12 h-12 bg-white rounded-full shadow-lg pointer-events-none" />
        </div>
    );
};

// --- MAIN APP ---

export default function App() {
    // Game State
    const [pos, setPos] = useState([0, 0, 0]);
    const [rot, setRot] = useState(0);
    const [moveInput, setMoveInput] = useState({ x: 0, y: 0 });
    const [tokens, setTokens] = useState(50);
    const [shopOpen, setShopOpen] = useState(false);
    const [canShop, setCanShop] = useState(false);

    // Procedural World Data
    const worldData = useMemo(() => {
        const buildings = [];
        const trees = [];
        
        // City Buildings (Center)
        for(let i=0; i<30; i++) {
            const x = (Math.random()-0.5) * 80;
            const z = (Math.random()-0.5) * 80;
            if(Math.abs(x) < 8 || Math.abs(z) < 8) continue; // Road clear
            buildings.push({ pos: [x, 0, z], size: [3+Math.random()*4, 5+Math.random()*10, 3+Math.random()*4], color: '#334155', isNeon: Math.random()>0.5 });
        }
        
        // Trees (North Park)
        for(let i=0; i<40; i++) {
            trees.push({ pos: [(Math.random()-0.5)*180, 0, -60 - Math.random()*80] });
        }

        return { buildings, trees };
    }, []);

    const npcs = [
        { id: 1, name: "Officer Glitch", color: "blue", pos: [5, 0, 5], msg: "Watch out for cars!" },
        { id: 2, name: "Beach Bum", color: "orange", pos: [80, 0, 10], msg: "Surf's up!" },
        { id: 3, name: "Gardener", color: "green", pos: [-20, 0, -70], msg: "Don't step on the flowers." }
    ];

    const GameLogic = () => {
        useFrame((state) => {
            if(moveInput.x !== 0 || moveInput.y !== 0) {
                // Calc rotation
                const angle = Math.atan2(moveInput.x, moveInput.y);
                setRot(angle);

                // Calc move
                const nx = pos[0] + moveInput.x * PLAYER_SPEED;
                const nz = pos[2] + moveInput.y * PLAYER_SPEED;
                setPos([nx, pos[1], nz]);

                // Camera follow
                state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, nx, 0.1);
                state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, nz + 15, 0.1);
                state.camera.lookAt(nx, 0, nz);
            }
            
            // Shop Check (Fixed location at 15, 0, 15)
            const d = Math.sqrt(Math.pow(pos[0]-15, 2) + Math.pow(pos[2]-15, 2));
            setCanShop(d < 6);
        });
        return null;
    };

    return (
        <div className="w-full h-full bg-black relative overflow-hidden font-sans">
            <Canvas shadows dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[0, 15, 20]} fov={60} />
                <color attach="background" args={['#87ceeb']} /> {/* Sky Blue */}
                <fog attach="fog" args={['#87ceeb', 20, 90]} />
                
                <ambientLight intensity={0.6} />
                <directionalLight position={[50, 50, 20]} intensity={1.5} castShadow />
                
                {/* WORLD RENDER */}
                <World />
                
                {/* STATIC OBJECTS */}
                {worldData.buildings.map((b, i) => <Building key={i} {...b} />)}
                {worldData.trees.map((t, i) => <Tree key={i} {...t} />)}
                <Shop pos={[15, 0, 15]} />

                {/* DYNAMIC OBJECTS */}
                {npcs.map(n => <NPC key={n.id} {...n} playerPos={pos} />)}
                
                <Player position={pos} rotation={rot} isMoving={moveInput.x!==0 || moveInput.y!==0} />
                <AICat targetPos={pos} />
                
                <GameLogic />
            </Canvas>

            {/* UI HUD */}
            <div className="absolute top-4 left-4 bg-white/20 backdrop-blur p-2 px-4 rounded-full border border-white flex gap-2">
                <Zap fill="yellow" className="text-yellow-400" />
                <span className="text-white font-bold">{tokens} TOKENS</span>
            </div>

            {canShop && !shopOpen && (
                <button 
                    onClick={() => setShopOpen(true)}
                    className="absolute bottom-32 right-8 bg-yellow-400 text-black font-bold p-6 rounded-full border-4 border-white animate-bounce shadow-xl"
                >
                    OPEN SHOP
                </button>
            )}

            {shopOpen && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-2xl w-80 text-center">
                        <h2 className="text-2xl font-bold mb-4">Fortune Shop</h2>
                        <button onClick={() => {
                            if(tokens>=10) { setTokens(t=>t-10); alert("Fortune: Good luck comes to those who explore!"); }
                        }} className="bg-yellow-400 w-full p-3 rounded-lg font-bold mb-2">Buy Cookie (10 T)</button>
                        <button onClick={() => setShopOpen(false)} className="text-gray-500 underline mt-2">Close</button>
                    </div>
                </div>
            )}

            <Joystick onInput={setMoveInput} />
            
            <div className="absolute top-4 right-4 text-white text-right opacity-80 pointer-events-none">
                <p className="font-bold">EARLY-ZAH'S ODYSSEY</p>
                <p className="text-xs">Explore: City, Park, Beach</p>
            </div>
        </div>
    );
}


