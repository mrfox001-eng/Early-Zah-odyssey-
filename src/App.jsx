import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Stars, PerspectiveCamera, RoundedBox, Float } from '@react-three/drei';
import * as THREE from 'three';
import { ShoppingBag, Zap } from 'lucide-react';

// --- CONFIG ---
const PLAYER_SPEED = 0.25;

// --- 3D COMPONENTS ---

// 1. SAFE GROUND (Standard Material - No Shaders)
const Ground = () => {
  return (
    <group>
      {/* City Floor (Grey) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Park Floor (Green) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -100]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#15803d" />
      </mesh>
      {/* Beach Floor (Yellow) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[100, -0.05, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
};

// 2. BUILDINGS
const Building = ({ pos, size, color }) => (
  <group position={pos}>
    <mesh castShadow receiveShadow position={[0, size[1]/2, 0]}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
    {/* Simple Window Glow */}
    <mesh position={[0, size[1]/2, size[2]/2 + 0.1]}>
      <planeGeometry args={[size[0]*0.6, size[1]*0.8]} />
      <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.5} />
    </mesh>
  </group>
);

// 3. PLAYER CHARACTER
const Player = ({ position, rotation, isMoving }) => {
  const group = useRef();
  
  useFrame((state) => {
    if(group.current && isMoving) {
       // Simple bounce animation
       group.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.2;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group ref={group}>
        {/* Body */}
        <mesh castShadow position={[0, 0.75, 0]}>
          <capsuleGeometry args={[0.3, 0.8, 4, 16]} />
          <meshStandardMaterial color="#db2777" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.4, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffdab9" />
        </mesh>
        {/* Hair */}
        <mesh position={[0, 1.5, -0.1]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color="#4c1d95" />
        </mesh>
      </group>
      <pointLight intensity={1} distance={4} color="white" position={[0, 2, 0]} />
    </group>
  );
};

// 4. SHOP
const Shop = ({ pos }) => (
  <group position={pos}>
    <mesh position={[0, 2, 0]} castShadow>
      <boxGeometry args={[4, 4, 4]} />
      <meshStandardMaterial color="#facc15" />
    </mesh>
    <Text position={[0, 5, 0]} fontSize={1} color="white">SHOP</Text>
  </group>
);

// 5. NPC
const NPC = ({ pos, color }) => (
  <group position={pos}>
    <mesh position={[0, 1, 0]}>
      <capsuleGeometry args={[0.3, 1.2, 4, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
    <Text position={[0, 2.2, 0]} fontSize={0.3} color="white">Citizen</Text>
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
        const dist = Math.min(Math.sqrt(dx*dx+dy*dy), 40); // Max drag distance
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
            className="absolute bottom-12 left-12 w-32 h-32 bg-white/20 rounded-full border-2 border-white flex items-center justify-center z-50 touch-none"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        >
            <div ref={stick} className="w-12 h-12 bg-white rounded-full shadow-lg pointer-events-none" />
        </div>
    );
};

// --- MAIN APP ---

export default function App() {
    const [pos, setPos] = useState([0, 0, 0]);
    const [rot, setRot] = useState(0);
    const [input, setInput] = useState({x:0, y:0});
    const [tokens, setTokens] = useState(0);
    const [shopOpen, setShopOpen] = useState(false);

    // Static World Data
    const world = useMemo(() => {
        const b = [];
        for(let i=0; i<20; i++) {
            b.push({
                pos: [(Math.random()-0.5)*60, 0, (Math.random()-0.5)*60],
                size: [2+Math.random()*2, 4+Math.random()*6, 2+Math.random()*2],
                color: Math.random() > 0.5 ? '#1e293b' : '#334155'
            });
        }
        return { buildings: b, shopPos: [15, 0, 15] };
    }, []);

    // Game Loop
    const GameLoop = () => {
        useFrame((state) => {
            if (input.x !== 0 || input.y !== 0) {
                const angle = Math.atan2(input.x, input.y);
                setRot(angle);
                
                const nx = pos[0] + input.x * PLAYER_SPEED;
                const nz = pos[2] + input.y * PLAYER_SPEED;
                setPos([nx, 0, nz]);

                // Camera follow
                state.camera.position.x = nx;
                state.camera.position.z = nz + 20;
                state.camera.lookAt(nx, 0, nz);
            }
        });
        return null;
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#0f172a', width: '100%', height: '100%' }}>
            
            <Canvas shadows dpr={[1, 1.5]}>
                <PerspectiveCamera makeDefault position={[0, 15, 20]} fov={50} />
                
                {/* Standard Lights - Guaranteed to work */}
                <ambientLight intensity={0.8} />
                <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
                <Stars radius={100} depth={50} count={2000} factor={4} />

                {/* World */}
                <Ground />
                {world.buildings.map((b, i) => <Building key={i} {...b} />)}
                <Shop pos={world.shopPos} />
                <NPC pos={[-5, 0, -5]} color="blue" />
                <NPC pos={[5, 0, 8]} color="orange" />

                {/* Player */}
                <Player position={pos} rotation={rot} isMoving={input.x!==0 || input.y!==0} />
                
                <GameLoop />
            </Canvas>

            {/* UI Overlay */}
            <div className="absolute top-0 left-0 w-full p-4 pointer-events-none">
                <div className="flex justify-between pointer-events-auto">
                    <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-full border border-white/20 text-white flex items-center gap-2">
                        <Zap size={16} className="text-yellow-400" />
                        <span className="font-bold">{tokens} CR</span>
                    </div>
                    
                    <button 
                        onClick={() => {
                            const d = Math.sqrt(Math.pow(pos[0]-15,2) + Math.pow(pos[2]-15,2));
                            if(d < 8) setShopOpen(true);
                            else alert("Go to the YELLOW building to shop!");
                        }}
                        className="bg-pink-600 text-white p-3 rounded-full shadow-lg"
                    >
                        <ShoppingBag size={24} />
                    </button>
                </div>
            </div>

            {/* Shop Modal */}
            {shopOpen && (
                <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center pointer-events-auto">
                    <div className="bg-white p-6 rounded-2xl w-80 text-center">
                        <h2 className="text-2xl font-bold mb-4">Fortune Shop</h2>
                        <button 
                            onClick={() => { setTokens(t=>t+10); alert("Fortune: Today is a good day!"); setShopOpen(false); }}
                            className="bg-yellow-400 w-full py-3 rounded-lg font-bold mb-3"
                        >
                            Get Fortune (Free)
                        </button>
                        <button onClick={() => setShopOpen(false)} className="text-gray-500 underline">Close</button>
                    </div>
                </div>
            )}

            <Joystick onInput={setInput} />
            
            {/* If the screen is still black, this text proves the UI layer is working */}
            <div className="absolute bottom-4 right-4 text-white/30 text-xs">
                Render Safe Mode Active
            </div>

        </div>
    );
}


