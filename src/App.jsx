import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Float, Stars, Trail, MeshDistortMaterial, Sparkles, PerspectiveCamera, RoundedBox, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ShoppingBag, MapPin, Zap, Timer, AlertTriangle, ArrowUp } from 'lucide-react';

// --- GAME SETTINGS ---
const PLAYER_SPEED = 0.18;
const CITY_SIZE = 60;
const BUILDING_COUNT = 40;
const CAR_SPEED = 0.25;

// --- ASSETS & DATA ---
const COLORS = {
  neonPink: "#ff00ff",
  neonBlue: "#00ffff",
  road: "#1a1a1a",
  buildingDark: "#0f172a",
  buildingLight: "#1e293b",
  grass: "#059669"
};

const MISSIONS = [
  { 
    id: 1, 
    title: "The Glitch Courier", 
    desc: "A critical package is hidden behind the Neon Tower. Find it!", 
    type: 'find', 
    targetPos: [15, 0.5, -15], 
    reward: 100 
  },
  { 
    id: 2, 
    title: "Traffic Dodger", 
    desc: "Collect the Energy Orb on the main road without getting hit!", 
    type: 'danger', 
    targetPos: [0, 0.5, 12], 
    reward: 200 
  },
  { 
    id: 3, 
    title: "Elder's Request", 
    desc: "Visit the Elder Tree in the Park Sector.", 
    type: 'visit', 
    targetPos: [-18, 0, -18], 
    reward: 50 
  }
];

// --- UTILS ---
// Simple collision check between player and boxes
const checkCollision = (newPos, buildings) => {
    // City boundary check
    if (Math.abs(newPos[0]) > CITY_SIZE/2 || Math.abs(newPos[2]) > CITY_SIZE/2) return true;

    // Building check
    for (let b of buildings) {
        const dx = Math.abs(newPos[0] - b.position[0]);
        const dz = Math.abs(newPos[2] - b.position[2]);
        // Simple AABB collision (Player radius approx 0.5, Building width/depth varies)
        if (dx < (b.size[0]/2 + 0.3) && dz < (b.size[2]/2 + 0.3)) {
            return true;
        }
    }
    return false;
};

// --- SHADERS ---
const roadFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    float dash = step(0.5, fract(vUv.y * 20.0 + uTime * 2.0)) * step(0.45, vUv.x) * step(vUv.x, 0.55);
    vec3 color = mix(vec3(0.1), vec3(1.0, 1.0, 0.0), dash);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// --- 3D COMPONENTS ---

// 1. THE CITY (Procedural Buildings & Roads)
const City = ({ buildings }) => {
    return (
        <group>
            {/* Ground / Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={[CITY_SIZE, CITY_SIZE]} />
                <meshStandardMaterial color="#111" roughness={0.8} />
            </mesh>
            
            {/* Roads (Cross shape) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
                <planeGeometry args={[8, CITY_SIZE]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
                <planeGeometry args={[CITY_SIZE, 8]} />
                <meshStandardMaterial color="#222" />
            </mesh>

            {/* Buildings */}
            {buildings.map((b, i) => (
                <group key={i} position={b.position}>
                    <RoundedBox args={b.size} radius={0.1} receiveShadow castShadow>
                        <meshStandardMaterial 
                            color={b.color} 
                            emissive={b.emissive} 
                            emissiveIntensity={b.emissiveIntensity || 0}
                            roughness={0.2}
                        />
                    </RoundedBox>
                    {/* Windows / Detail */}
                    {Math.random() > 0.5 && (
                        <mesh position={[0, 0, b.size[2]/2 + 0.01]}>
                            <planeGeometry args={[b.size[0]*0.8, b.size[1]*0.8]} />
                            <meshStandardMaterial color="black" emissive={b.color} emissiveIntensity={2} />
                        </mesh>
                    )}
                </group>
            ))}
        </group>
    );
};

// 2. PLAYER CONTROLLER
const Player = ({ position, rotation, isMoving }) => {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
             <group position={[0, 0.7, 0]}>
                {/* Character Model */}
                <Float speed={isMoving ? 10 : 2} rotationIntensity={isMoving ? 0.5 : 0.1} floatIntensity={isMoving ? 0.2 : 0.5}>
                    {/* Body */}
                    <mesh castShadow position={[0, -0.2, 0]}>
                        <capsuleGeometry args={[0.25, 0.6, 4, 16]} />
                        <meshStandardMaterial color="#ec4899" />
                    </mesh>
                    {/* Skirt */}
                    <mesh position={[0, -0.5, 0]}>
                        <coneGeometry args={[0.4, 0.4, 32]} />
                        <meshStandardMaterial color="#db2777" />
                    </mesh>
                    {/* Head */}
                    <mesh position={[0, 0.4, 0]}>
                        <sphereGeometry args={[0.28, 32, 32]} />
                        <meshStandardMaterial color="#ffdecb" />
                    </mesh>
                    {/* Hair */}
                    <mesh position={[0, 0.45, -0.1]}>
                        <boxGeometry args={[0.55, 0.55, 0.5]} />
                        <meshStandardMaterial color="#4c1d95" />
                    </mesh>
                    {/* Eyes */}
                    <mesh position={[0.1, 0.45, 0.25]}>
                        <sphereGeometry args={[0.05]} />
                        <meshStandardMaterial color="black" />
                    </mesh>
                    <mesh position={[-0.1, 0.45, 0.25]}>
                        <sphereGeometry args={[0.05]} />
                        <meshStandardMaterial color="black" />
                    </mesh>
                </Float>
             </group>
             {/* Shadow Blob */}
             <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
                 <circleGeometry args={[0.4, 32]} />
                 <meshBasicMaterial color="black" transparent opacity={0.3} />
             </mesh>
             <pointLight intensity={0.5} color="#ec4899" distance={3} />
        </group>
    );
};

// 3. AI CAT COMPANION
const AICat = ({ targetPos }) => {
    const ref = useRef();
    useFrame(() => {
        if(ref.current) {
            // Follow player with delay
            ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, targetPos[0] - 0.8, 0.05);
            ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, targetPos[2] - 0.8, 0.05);
            ref.current.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
            ref.current.lookAt(targetPos[0], targetPos[1], targetPos[2]);
        }
    });
    return (
        <group ref={ref} position={[0,0,0]}>
             <mesh castShadow>
                 <sphereGeometry args={[0.2]} />
                 <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1} />
             </mesh>
             {/* Ears */}
             <mesh position={[0.1, 0.15, 0]}> <coneGeometry args={[0.08, 0.15]} /> <meshBasicMaterial color="#00ffff" /> </mesh>
             <mesh position={[-0.1, 0.15, 0]}> <coneGeometry args={[0.08, 0.15]} /> <meshBasicMaterial color="#00ffff" /> </mesh>
             <Trail width={0.4} length={4} color="#00ffff" attenuation={(t) => t * t} />
        </group>
    );
};

// 4. TRAFFIC SYSTEM
const Car = ({ startPos, axis, speed, color }) => {
    const ref = useRef();
    const [offset, setOffset] = useState(Math.random() * 20);
    
    useFrame((state) => {
        if(ref.current) {
            const time = state.clock.elapsedTime * speed + offset;
            const limit = CITY_SIZE / 2 + 5;
            
            // Loop the car movement
            let pos = (time % (limit * 2)) - limit;
            
            if (axis === 'x') {
                ref.current.position.set(pos, 0.5, startPos[2]);
                ref.current.rotation.y = speed > 0 ? Math.PI / 2 : -Math.PI / 2;
            } else {
                ref.current.position.set(startPos[0], 0.5, pos);
                ref.current.rotation.y = speed > 0 ? 0 : Math.PI;
            }
        }
    });

    return (
        <group ref={ref}>
            <mesh castShadow>
                <boxGeometry args={[1.5, 0.8, 3]} />
                <meshStandardMaterial color={color} />
            </mesh>
            {/* Headlights */}
            <mesh position={[0, 0, 1.5]}>
                <boxGeometry args={[1.2, 0.2, 0.1]} />
                <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={2} />
            </mesh>
        </group>
    );
};

// 5. PHYSICAL SHOP BUILDING
const ShopBuilding = ({ position }) => {
    return (
        <group position={position}>
            {/* Base */}
            <mesh castShadow position={[0, 2, 0]}>
                <boxGeometry args={[6, 4, 6]} />
                <meshStandardMaterial color="#4c0519" />
            </mesh>
            {/* Roof */}
            <mesh position={[0, 4.5, 0]}>
                <coneGeometry args={[4.5, 2, 4]} />
                <meshStandardMaterial color="#be123c" />
            </mesh>
            {/* Neon Sign */}
            <Text position={[0, 3, 3.1]} fontSize={0.8} color="#facc15" anchorX="center" anchorY="middle">
                FORTUNE
            </Text>
            {/* Entrance Zone */}
            <mesh position={[0, 0.1, 4]} rotation={[-Math.PI/2, 0, 0]}>
                <circleGeometry args={[2]} />
                <meshBasicMaterial color="#facc15" transparent opacity={0.3} />
            </mesh>
            <Sparkles position={[0, 1, 4]} scale={[3, 2, 3]} color="yellow" count={20} />
        </group>
    );
};

// 6. MISSION ITEMS
const MissionObjective = ({ pos, type }) => {
    return (
        <group position={pos}>
            <Float speed={5} rotationIntensity={1} floatIntensity={1}>
                {type === 'danger' ? (
                    <mesh>
                         <dodecahedronGeometry args={[0.5]} />
                         <meshStandardMaterial color="red" emissive="red" emissiveIntensity={2} />
                    </mesh>
                ) : (
                    <mesh>
                        <boxGeometry args={[0.6, 0.6, 0.6]} />
                        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={1} />
                    </mesh>
                )}
            </Float>
            <Sparkles count={20} scale={2} color={type === 'danger' ? "red" : "green"} />
            {/* Beacon */}
            <mesh position={[0, 10, 0]}>
                 <cylinderGeometry args={[0.05, 0.05, 20]} />
                 <meshBasicMaterial color={type === 'danger' ? "red" : "green"} transparent opacity={0.2} />
            </mesh>
        </group>
    );
};


// --- JOYSTICK COMPONENT (Improved) ---
const Joystick = ({ onInput }) => {
    const stickRef = useRef();
    const baseRef = useRef();
    const touchId = useRef(null);
    const center = useRef({ x: 0, y: 0 });

    const handleStart = (e) => {
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        touchId.current = touch.identifier;
        const rect = baseRef.current.getBoundingClientRect();
        center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        updateStick(touch.clientX, touch.clientY);
    };

    const handleMove = (e) => {
        const touch = e.changedTouches ? Array.from(e.changedTouches).find(t => t.identifier === touchId.current) : e;
        if (!touch) return;
        updateStick(touch.clientX, touch.clientY);
    };

    const handleEnd = () => {
        touchId.current = null;
        if (stickRef.current) stickRef.current.style.transform = `translate(0px, 0px)`;
        onInput({ x: 0, y: 0 });
    };

    const updateStick = (clientX, clientY) => {
        const maxDist = 40;
        const dx = clientX - center.current.x;
        const dy = clientY - center.current.y;
        const dist = Math.min(Math.sqrt(dx*dx + dy*dy), maxDist);
        const angle = Math.atan2(dy, dx);
        
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        
        if (stickRef.current) {
            stickRef.current.style.transform = `translate(${x}px, ${y}px)`;
        }
        
        // Normalize output -1 to 1
        onInput({ x: x / maxDist, y: y / maxDist });
    };

    return (
        <div 
            ref={baseRef}
            className="absolute bottom-10 left-10 w-32 h-32 rounded-full bg-white/10 backdrop-blur border-2 border-white/20 touch-none pointer-events-auto flex items-center justify-center z-50"
            onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
            onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        >
            <div ref={stickRef} className="w-12 h-12 rounded-full bg-white/80 shadow-[0_0_15px_rgba(255,255,255,0.8)] pointer-events-none" />
        </div>
    );
};


// --- MAIN APP LOGIC ---

export default function App() {
    // Refs
    const controlsRef = useRef({ x: 0, y: 0 });
    
    // State
    const [playerPos, setPlayerPos] = useState([0, 0, 0]);
    const [playerRot, setPlayerRot] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [tokens, setTokens] = useState(0);
    const [activeMission, setActiveMission] = useState(null);
    const [shopOpen, setShopOpen] = useState(false);
    const [canEnterShop, setCanEnterShop] = useState(false);
    const [gameMsg, setGameMsg] = useState("Welcome to Neon City. Find the Elder.");

    // Procedural City Generation (Memoized)
    const cityData = useMemo(() => {
        const buildings = [];
        const shopPos = [10, 0, 10]; // Fixed Shop location
        
        for (let i = 0; i < BUILDING_COUNT; i++) {
            // Random position but avoid roads (x approx 0, z approx 0) and shop
            let x = (Math.random() - 0.5) * CITY_SIZE;
            let z = (Math.random() - 0.5) * CITY_SIZE;
            
            // Keep roads clear (Road width 8)
            if (Math.abs(x) < 5 || Math.abs(z) < 5) continue;
            // Keep shop area clear
            if (Math.abs(x - shopPos[0]) < 6 && Math.abs(z - shopPos[2]) < 6) continue;

            const height = 2 + Math.random() * 6;
            buildings.push({
                position: [x, height/2, z],
                size: [2 + Math.random()*2, height, 2 + Math.random()*2],
                color: Math.random() > 0.8 ? COLORS.neonPink : COLORS.buildingLight,
                emissive: Math.random() > 0.9 ? COLORS.neonBlue : "black",
                emissiveIntensity: 0.5
            });
        }
        return { buildings, shopPos };
    }, []);

    // Game Loop
    const GameLoop = () => {
        useFrame((state) => {
            const { x, y } = controlsRef.current;
            
            if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
                setIsMoving(true);
                
                // Calculate Rotation (Face direction)
                const targetRot = Math.atan2(x, y); // x is left/right, y is up/down on screen
                setPlayerRot(targetRot);
                
                // Calculate Forward Movement relative to Camera (Camera is fixed offset)
                // In standard 3D mapping: Y-stick is Z-world, X-stick is X-world
                const moveX = x * PLAYER_SPEED;
                const moveZ = y * PLAYER_SPEED;

                // Proposed new position
                const newPos = [
                    playerPos[0] + moveX,
                    playerPos[1],
                    playerPos[2] + moveZ
                ];

                // Collision Check
                if (!checkCollision(newPos, cityData.buildings)) {
                    setPlayerPos(newPos);
                }

                // Camera Follow (Smooth Lerp)
                state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, playerPos[0], 0.1);
                state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, playerPos[2] + 10, 0.1); // +10 offset Z
                state.camera.lookAt(playerPos[0], 0, playerPos[2]); // Look at player
            } else {
                setIsMoving(false);
                // Idle Camera
                state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, playerPos[0], 0.05);
                state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, playerPos[2] + 12, 0.05);
                state.camera.lookAt(playerPos[0], 0, playerPos[2]);
            }

            // Logic Checks
            // 1. Shop Entry
            const distToShop = Math.sqrt(Math.pow(playerPos[0] - cityData.shopPos[0], 2) + Math.pow(playerPos[2] - cityData.shopPos[2], 2));
            if (distToShop < 4) {
                if(!canEnterShop) setCanEnterShop(true);
            } else {
                if(canEnterShop) setCanEnterShop(false);
            }

            // 2. Mission Objectives
            if (activeMission) {
                const distToTarget = Math.sqrt(Math.pow(playerPos[0] - activeMission.targetPos[0], 2) + Math.pow(playerPos[2] - activeMission.targetPos[2], 2));
                if (distToTarget < 1.5) {
                    // Complete Mission
                    setTokens(t => t + activeMission.reward);
                    setGameMsg(`Mission Complete! +${activeMission.reward} Tokens`);
                    setActiveMission(null);
                }
            }
        });
        return null;
    };

    // --- UI HANDLERS ---
    const handleJoystick = (data) => {
        controlsRef.current = data;
    };

    const startMission = (id) => {
        const m = MISSIONS.find(m => m.id === id);
        setActiveMission(m);
        setGameMsg(m.desc);
        setShopOpen(false); // Close shop if open
    };

    const buyCookie = () => {
        if (tokens >= 20) {
            setTokens(t => t - 20);
            const fortunes = ["Luck is on the road.", "Look behind the blue building.", "Avoid the red cars.", "A great surprise awaits."];
            setGameMsg(`Fortune: ${fortunes[Math.floor(Math.random()*fortunes.length)]}`);
        } else {
            setGameMsg("Not enough tokens (Need 20).");
        }
    };

    return (
        <div className="w-full h-full bg-black relative select-none font-mono text-white overflow-hidden">
            
            {/* 3D RENDERER */}
            <Canvas shadows dpr={[1, 2]}>
                {/* Camera is controlled by GameLoop now, but we set initial */}
                <PerspectiveCamera makeDefault position={[0, 10, 12]} fov={50} />
                
                {/* Environment */}
                <color attach="background" args={['#050510']} />
                <fog attach="fog" args={['#050510', 10, 40]} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[10, 20, 10]} intensity={1} castShadow shadow-mapSize={[1024, 1024]} />
                <Stars radius={100} depth={50} count={5000} factor={4} fade />
                
                {/* World */}
                <City buildings={cityData.buildings} />
                <ShopBuilding position={cityData.shopPos} />
                
                {/* Dynamic Elements */}
                <Car startPos={[0, 0, -20]} axis="z" speed={5} color="red" />
                <Car startPos={[0, 0, 20]} axis="z" speed={-4} color="blue" />
                <Car startPos={[-20, 0, 0]} axis="x" speed={6} color="orange" />

                {/* Player & AI */}
                <Player position={playerPos} rotation={playerRot} isMoving={isMoving} />
                <AICat targetPos={playerPos} />
                
                {/* Mission Markers */}
                {activeMission && <MissionObjective pos={activeMission.targetPos} type={activeMission.type} />}

                <GameLoop />
            </Canvas>


            {/* --- HUD UI --- */}
            
            {/* Top Bar */}
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-2">
                    <div className="bg-black/60 backdrop-blur border border-pink-500/50 p-2 rounded-lg flex items-center gap-2 pointer-events-auto">
                        <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
                        <span className="font-bold text-xl tracking-wider text-yellow-400">{tokens} CREDITS</span>
                    </div>
                    {activeMission && (
                        <div className="bg-blue-900/80 border border-blue-400 p-3 rounded-lg max-w-[250px] animate-in slide-in-from-left">
                            <h3 className="text-blue-300 text-xs font-bold uppercase mb-1">CURRENT MISSION</h3>
                            <p className="text-sm font-bold text-white">{activeMission.title}</p>
                            <p className="text-xs text-blue-200 mt-1">{activeMission.desc}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Message Feed */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-md text-center pointer-events-none">
                <p className="text-pink-400 font-bold text-shadow-sm bg-black/40 inline-block px-4 py-1 rounded-full backdrop-blur-sm border border-white/10">
                    {gameMsg}
                </p>
            </div>

            {/* Controls */}
            <Joystick onInput={handleJoystick} />

            {/* Action Buttons */}
            {canEnterShop && !shopOpen && (
                <div className="absolute bottom-32 right-8 z-50">
                    <button 
                        onClick={() => setShopOpen(true)}
                        className="bg-yellow-500 text-black font-bold p-6 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.6)] animate-bounce border-4 border-white"
                    >
                        ENTER SHOP
                    </button>
                </div>
            )}

            {/* SHOP INTERFACE */}
            {shopOpen && (
                <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-gray-900 border-2 border-pink-600 rounded-3xl overflow-hidden shadow-2xl relative">
                        <div className="bg-pink-700 p-4">
                            <h2 className="text-2xl font-black italic tracking-widest text-center">FORTUNE PAGODA</h2>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Shop Item */}
                            <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-yellow-500/20 p-3 rounded-lg">
                                        <Zap className="text-yellow-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg">Fortune Cookie</p>
                                        <p className="text-gray-400 text-sm">Reveals secrets of the city</p>
                                    </div>
                                </div>
                                <button onClick={buyCookie} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors">
                                    20 CR
                                </button>
                            </div>

                            <div className="h-px bg-white/10 my-4" />

                            <h3 className="text-pink-400 font-bold uppercase text-sm">Available Missions</h3>
                            <div className="grid grid-cols-1 gap-3 max-h-[200px] overflow-y-auto">
                                {MISSIONS.map(m => (
                                    <button 
                                        key={m.id}
                                        onClick={() => startMission(m.id)}
                                        className="text-left bg-gray-800 hover:bg-gray-700 p-3 rounded-lg border border-gray-600 hover:border-pink-500 transition-all group"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold group-hover:text-pink-300">{m.title}</span>
                                            <span className="text-xs bg-black/50 px-2 py-1 rounded text-green-400">{m.reward} CR</span>
                                        </div>
                                        <p className="text-xs text-gray-400 line-clamp-1">{m.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-black/20 text-center">
                            <button onClick={() => setShopOpen(false)} className="text-gray-400 hover:text-white underline text-sm">
                                Leave Shop
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


