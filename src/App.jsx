import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Float, Stars, Trail, MeshDistortMaterial, Sparkles, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ShoppingBag, MessageCircle, Package, MapPin, Zap, ArrowUp } from 'lucide-react';

// --- CONSTANTS ---
const MOVEMENT_SPEED = 0.15;
const CAT_FOLLOW_SPEED = 0.08;
const INTERACTION_DIST = 3.5; // Distance to trigger interact button

const COLORS = {
  groundA: "#2e1065", // Dark purple
  groundB: "#ec4899", // Pink
  sky: "#0f172a"
};

// --- GAME DATA ---
const NPC_DATA = [
  { id: 'elder', position: [8, 0, 8], color: '#10b981', label: 'Elder Tree', type: 'npc' },
  { id: 'monolith', position: [-8, 1, -8], color: '#3b82f6', label: 'Data Monolith', type: 'puzzle' },
  { id: 'rock', position: [8, 1, -8], color: '#f59e0b', label: 'Floating Rock', type: 'landmark' },
  { id: 'parcel_spawn', position: [-5, 0.5, 5], color: '#ec4899', label: 'Lost Parcel', type: 'item', hidden: true },
];

const SHOP_ITEMS = [
  { id: 'skin_neon', name: 'Neon Suit', cost: 100, color: '#00ffcc' },
  { id: 'skin_gold', name: 'Royal Gold', cost: 200, color: '#ffcc00' },
  { id: 'fortune', name: 'Fortune Cookie', cost: 20, type: 'consumable' },
];

const FORTUNES = [
  "The cat sees what you cannot.",
  "Turn left at the next glitch.",
  "Your code is clean, your path is clear.",
  "A bug is just a feature waiting to be discovered."
];

const PUZZLE_SEQUENCE = ['red', 'green', 'blue', 'red'];

// --- SHADERS ---
const terrainVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const terrainFragmentShader = `
  uniform vec3 colorA;
  uniform vec3 colorB;
  uniform float time;
  varying vec2 vUv;
  void main() {
    float grid = step(0.95, fract(vUv.x * 20.0)) + step(0.95, fract(vUv.y * 20.0));
    float wave = sin(vUv.x * 10.0 + time) * 0.1 + cos(vUv.y * 10.0 + time * 0.5) * 0.1;
    vec3 color = mix(colorA, colorB, vUv.y + wave);
    vec3 finalColor = mix(color, vec3(1.0), grid * 0.2);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// --- 3D COMPONENTS ---

function Terrain() {
  const mesh = useRef();
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    colorA: { value: new THREE.Color(COLORS.groundA) },
    colorB: { value: new THREE.Color(COLORS.groundB) }
  }), []);

  useFrame((state) => {
    if(mesh.current) {
        mesh.current.material.uniforms.time.value = state.clock.getElapsedTime() * 0.5;
    }
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
      <planeGeometry args={[100, 100, 64, 64]} />
      <shaderMaterial 
        vertexShader={terrainVertexShader} 
        fragmentShader={terrainFragmentShader} 
        uniforms={uniforms} 
      />
    </mesh>
  );
}

function Player({ position, color, isCarrying }) {
  return (
    <group position={position}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        {/* Body */}
        <mesh castShadow position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.3, 0.8, 4, 16]} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Head */}
        <mesh castShadow position={[0, 1.1, 0]}>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial color="#ffdecb" />
        </mesh>
        {/* Hair/Visor */}
        <mesh position={[0, 1.15, 0.2]}>
            <boxGeometry args={[0.4, 0.1, 0.2]} />
            <meshStandardMaterial color="#111" />
        </mesh>
        
        {/* Visual Inventory: Carrying the parcel */}
        {isCarrying && (
            <group position={[0, 1.5, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[0.4, 0.4, 0.4]} />
                    <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.5} />
                </mesh>
                <Sparkles count={5} scale={1} color="#fff" />
            </group>
        )}
      </Float>
      <pointLight intensity={1} distance={5} color={color} />
    </group>
  );
}

function AICat({ targetPos }) {
  const catRef = useRef();
  
  useFrame(() => {
    if (catRef.current) {
      const targetX = targetPos[0] - 1.5;
      const targetZ = targetPos[2] - 1.5;
      catRef.current.position.x = THREE.MathUtils.lerp(catRef.current.position.x, targetX, CAT_FOLLOW_SPEED);
      catRef.current.position.z = THREE.MathUtils.lerp(catRef.current.position.z, targetZ, CAT_FOLLOW_SPEED);
      catRef.current.position.y = Math.sin(Date.now() * 0.005) * 0.2 + 0.5;
      catRef.current.lookAt(targetPos[0], targetPos[1], targetPos[2]);
    }
  });

  return (
    <group ref={catRef} position={[2, 1, 2]}>
      <Trail width={0.3} length={6} color="#00ffff" attenuation={(t) => t * t}>
        <mesh>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
        </mesh>
      </Trail>
      <mesh position={[0.15, 0.2, 0]}>
        <coneGeometry args={[0.08, 0.2, 16]} />
        <meshStandardMaterial color="#00ffff" />
      </mesh>
      <mesh position={[-0.15, 0.2, 0]}>
        <coneGeometry args={[0.08, 0.2, 16]} />
        <meshStandardMaterial color="#00ffff" />
      </mesh>
    </group>
  );
}

function WorldObject({ data, isVisible }) {
    if (!isVisible && data.hidden) return null;

    return (
        <group position={data.position}>
            <Text position={[0, 3, 0]} fontSize={0.5} color="white" anchorX="center" anchorY="middle">
                {data.label}
            </Text>
            <Float floatIntensity={1} speed={2}>
                <mesh castShadow>
                    {data.type === 'npc' && <torusKnotGeometry args={[0.8, 0.2, 100, 16]} />}
                    {data.type === 'puzzle' && <boxGeometry args={[1.5, 3, 1.5]} />}
                    {data.type === 'landmark' && <dodecahedronGeometry args={[1]} />}
                    {data.type === 'item' && <boxGeometry args={[0.6, 0.6, 0.6]} />}
                    <MeshDistortMaterial color={data.color} speed={3} distort={0.4} />
                </mesh>
            </Float>
            <Sparkles count={15} scale={3} size={2} speed={0.4} opacity={0.5} color={data.color} />
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -1, 0]}>
                <ringGeometry args={[1.5, 1.6, 32]} />
                <meshBasicMaterial color={data.color} transparent opacity={0.5} />
            </mesh>
        </group>
    );
}

const WaypointArrow = ({ playerPos, targetPos }) => {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (ref.current && targetPos) {
            ref.current.position.set(playerPos[0], playerPos[1] + 2.5, playerPos[2]);
            ref.current.lookAt(targetPos[0], targetPos[1], targetPos[2]);
            // Point down at player but rotate towards target logic is complex, simpler: float above player
            // Actually, let's make it float above player and point to target
             ref.current.lookAt(targetPos[0], targetPos[1] + 2.5, targetPos[2]);
        }
    });
    
    if(!targetPos) return null;

    return (
        <group ref={ref}>
            <group rotation={[0, 0, 0]}> 
                 <mesh position={[0, 0, 1]} rotation={[Math.PI/2, 0, 0]}>
                    <coneGeometry args={[0.2, 0.8, 8]} />
                    <meshBasicMaterial color="#ffff00" depthTest={false} transparent opacity={0.8} />
                 </mesh>
            </group>
        </group>
    );
};

// --- UI COMPONENT: JOYSTICK ---

function Joystick({ onMove }) {
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const centerRef = useRef({ x: 0, y: 0 });

  const handleStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setActive(true);
    centerRef.current = { x: clientX, y: clientY };
  };

  const handleMove = (e) => {
    if (!active) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 50);
    const angle = Math.atan2(dy, dx);
    
    const newX = Math.cos(angle) * dist;
    const newY = Math.sin(angle) * dist;
    
    setPos({ x: newX, y: newY });
    onMove({ x: newX / 50, y: newY / 50 });
  };

  const handleEnd = () => {
    setActive(false);
    setPos({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  return (
    <div 
        className="absolute bottom-8 left-8 w-32 h-32 bg-white/10 backdrop-blur-md rounded-full border border-white/20 touch-none flex items-center justify-center z-40"
        onMouseDown={handleStart} onTouchStart={handleStart}
        onMouseMove={handleMove} onTouchMove={handleMove}
        onMouseUp={handleEnd} onTouchEnd={handleEnd}
        onMouseLeave={handleEnd}
    >
        <div 
            className="w-12 h-12 bg-white/80 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }} 
        />
    </div>
  );
}

// --- MAIN APP COMPONENT ---

export default function App() {
  // Movement State
  const [pos, setPos] = useState([0, 0, 0]);
  const [input, setInput] = useState({ x: 0, y: 0 });
  
  // Game Logic State
  const [tokens, setTokens] = useState(10);
  const [isCarrying, setIsCarrying] = useState(false);
  const [outfitColor, setOutfitColor] = useState("#ec4899");
  
  // Mission State
  const [missionState, setMissionState] = useState({ active: false, step: 0, type: null }); 
  const [spawnParcel, setSpawnParcel] = useState(false);
  const [interactionTarget, setInteractionTarget] = useState(null); // Which object is close?
  
  // UI State
  const [dialogue, setDialogue] = useState(null);
  const [showShop, setShowShop] = useState(false);
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [puzzleInput, setPuzzleInput] = useState([]);

  // --- GAME LOOP & PROXIMITY CHECK ---
  const GameLogic = () => {
    useFrame((state) => {
      // 1. Movement
      if (input.x !== 0 || input.y !== 0) {
        setPos(p => [
            p[0] + input.x * MOVEMENT_SPEED,
            p[1],
            p[2] + input.y * MOVEMENT_SPEED
        ]);
      }

      // 2. Proximity Detection
      let nearest = null;
      let minDist = Infinity;
      
      NPC_DATA.forEach(npc => {
          // Logic to determine if object exists in world
          if (npc.id === 'parcel_spawn' && !spawnParcel) return; // Parcel not active
          
          const dist = Math.sqrt(
              Math.pow(pos[0] - npc.position[0], 2) + 
              Math.pow(pos[2] - npc.position[2], 2)
          );

          if (dist < INTERACTION_DIST && dist < minDist) {
              minDist = dist;
              nearest = npc;
          }
      });

      // Update target if changed (prevents flicker)
      if (nearest?.id !== interactionTarget?.id) {
          setInteractionTarget(nearest);
      }
    });
    return null;
  };

  // --- INTERACTION LOGIC ---
  const handleInteract = () => {
      if (!interactionTarget) return;
      const target = interactionTarget;

      // 1. ELDER TREE (Mission Giver)
      if (target.id === 'elder') {
          if (!missionState.active) {
              setDialogue("Elder: Greetings! A Data Parcel was lost near the Merchant zone. Please retrieve it.");
              setMissionState({ active: true, type: 'delivery' });
              setSpawnParcel(true); // Spawn the item in the world
          } else if (missionState.type === 'delivery' && isCarrying) {
              setDialogue("Elder: Wonderful! You found the missing data. Here is your reward.");
              setTokens(t => t + 50);
              setMissionState({ active: false, type: null });
              setIsCarrying(false);
          } else if (missionState.type === 'delivery' && !isCarrying) {
              setDialogue("Elder: Use your scanner arrow to find the parcel.");
          } else {
              setDialogue("Elder: The winds are calm today.");
          }
      }

      // 2. PARCEL (Item)
      if (target.id === 'parcel_spawn') {
          setDialogue("System: Parcel Acquired. Deliver to Elder.");
          setIsCarrying(true);
          setSpawnParcel(false); // Remove from world
      }

      // 3. MONOLITH (Puzzle)
      if (target.id === 'monolith') {
          setShowPuzzle(true);
      }

      // 4. ROCK (Flavor)
      if (target.id === 'rock') {
          setDialogue("It's humming with a strange energy...");
      }
  };

  // --- PUZZLE LOGIC ---
  const handlePuzzleClick = (color) => {
    const newSeq = [...puzzleInput, color];
    setPuzzleInput(newSeq);
    
    if (newSeq.length === PUZZLE_SEQUENCE.length) {
        const isCorrect = newSeq.every((val, index) => val === PUZZLE_SEQUENCE[index]);
        if (isCorrect) {
            setDialogue("Monolith: Access Granted. +100 Tokens.");
            setTokens(t => t + 100);
            setShowPuzzle(false);
        } else {
            setDialogue("Monolith: Sequence Failed.");
        }
        setPuzzleInput([]);
    }
  };

  // --- SHOP LOGIC ---
  const buyItem = (item) => {
    if (tokens >= item.cost) {
        setTokens(t => t - item.cost);
        if (item.type === 'consumable') {
            const f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
            setDialogue(`Fortune: "${f}"`);
        } else {
            setOutfitColor(item.color);
            setDialogue(`Equipped ${item.name}!`);
        }
    } else {
        setDialogue("Not enough tokens!");
    }
  };

  // Helper for arrow target
  const getObjectivePos = () => {
      if (!missionState.active) return null;
      if (missionState.type === 'delivery' && !isCarrying) return NPC_DATA.find(n => n.id === 'parcel_spawn').position;
      if (missionState.type === 'delivery' && isCarrying) return NPC_DATA.find(n => n.id === 'elder').position;
      return null;
  };

  return (
    <div className="w-full h-full bg-black text-white font-sans select-none overflow-hidden relative">
      
      {/* 3D SCENE */}
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
        <OrbitControls target={pos} maxDistance={20} minDistance={5} enablePan={false} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 5]} intensity={1.5} castShadow />
        <Stars radius={100} depth={50} count={5000} factor={4} fade />
        
        <Terrain />
        
        {/* Render World Objects */}
        {NPC_DATA.map(npc => (
            <WorldObject key={npc.id} data={npc} isVisible={!(npc.id === 'parcel_spawn' && !spawnParcel)} />
        ))}

        <Player position={pos} color={outfitColor} isCarrying={isCarrying} />
        <AICat targetPos={pos} />
        
        {/* Navigation Arrow */}
        {missionState.active && <WaypointArrow playerPos={pos} targetPos={getObjectivePos()} />}
        
        <GameLogic />
      </Canvas>

      {/* --- UI HUD --- */}
      
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur border border-white/20 p-2 px-4 rounded-full flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-yellow-400" />
        <span className="font-bold text-xl">{tokens}</span>
      </div>

      {missionState.active && (
          <div className="absolute top-16 left-4 bg-blue-900/80 backdrop-blur border border-blue-400 p-3 rounded-lg max-w-[200px]">
              <p className="text-xs text-blue-200 uppercase font-bold">Current Objective</p>
              <p className="text-sm font-medium">{isCarrying ? "Return to Elder" : "Find the Parcel"}</p>
          </div>
      )}

      {/* --- ACTION BUTTONS --- */}
      
      <div className="absolute top-4 right-4 flex gap-3">
        <button 
            onClick={() => setShowShop(!showShop)}
            className="p-3 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 active:scale-95 transition-all"
        >
            <ShoppingBag size={24} />
        </button>
      </div>

      {/* INTERACTION BUTTON (Context Sensitive) */}
      {interactionTarget && !dialogue && !showPuzzle && !showShop && (
        <div className="absolute bottom-32 right-8 animate-in slide-in-from-bottom-4 fade-in z-50">
            <button 
                onClick={handleInteract}
                className="w-24 h-24 bg-pink-600 rounded-full border-4 border-white/30 shadow-[0_0_30px_rgba(236,72,153,0.6)] flex flex-col items-center justify-center active:scale-95 transition-transform"
            >
                {interactionTarget.type === 'item' ? <Package size={32} /> : <MessageCircle size={32} />}
                <span className="text-[10px] font-bold uppercase mt-1">
                    {interactionTarget.type === 'item' ? 'Grab' : 'Interact'}
                </span>
            </button>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* Dialogue */}
      {dialogue && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900/90 border border-gray-500 p-6 rounded-2xl w-[90%] max-w-sm text-center z-50 shadow-2xl">
              <MessageCircle className="mx-auto mb-2 text-pink-500" />
              <p className="text-lg mb-4">{dialogue}</p>
              <button onClick={() => setDialogue(null)} className="bg-white text-black px-6 py-2 rounded-full font-bold">Close</button>
          </div>
      )}

      {/* Shop */}
      {showShop && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 border border-gray-600 w-full max-w-md rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold">Token Exchange</h2>
                      <button onClick={() => setShowShop(false)} className="text-gray-400">✕</button>
                  </div>
                  <div className="space-y-3">
                      {SHOP_ITEMS.map(item => (
                          <div key={item.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-xl">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full" style={{ background: item.color || '#fff' }} />
                                  <div>
                                      <p className="font-bold">{item.name}</p>
                                      <p className="text-xs text-yellow-400">{item.cost} Tokens</p>
                                  </div>
                              </div>
                              <button onClick={() => buyItem(item)} className="bg-blue-600 px-3 py-1 rounded-lg text-sm font-bold active:bg-blue-700">Buy</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Puzzle Overlay */}
      {showPuzzle && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="bg-gray-900 p-8 rounded-2xl border border-blue-500 text-center w-[90%] max-w-sm">
                <h2 className="text-2xl font-bold mb-2 text-blue-400">Security Access</h2>
                <p className="text-xs text-gray-400 mb-6">Input Sequence: <span className="text-white">Red, Green, Blue, Red</span></p>
                
                <div className="flex gap-4 mb-6 justify-center">
                    {['red', 'green', 'blue'].map(c => (
                        <button 
                            key={c}
                            onClick={() => handlePuzzleClick(c)}
                            className="w-16 h-16 rounded-lg border-2 border-white/20 active:scale-90 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                
                <div className="flex gap-2 justify-center h-4">
                    {puzzleInput.map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-white" style={{ background: c }} />
                    ))}
                </div>

                <button onClick={() => setShowPuzzle(false)} className="mt-8 text-gray-400 text-sm hover:text-white underline">Cancel</button>
            </div>
        </div>
      )}

      {/* --- CONTROLS --- */}
      <Joystick onMove={setInput} />

    </div>
  );
}


