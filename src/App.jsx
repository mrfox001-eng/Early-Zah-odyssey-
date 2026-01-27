import React, { useState, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Stars, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// ---------------- CONFIG ----------------
const PLAYER_SPEED = 0.22;
const TALK_RADIUS = 2.2;

// ---------------- DIALOGUE ----------------
const DIALOGUE = {
  dreamer: [
    "I keep imagining better versions of today.",
    "Somewhere, a softer world exists. I think we’re building it slowly.",
    "I wanted to be a cloud once. This is close enough."
  ],
  cynic: [
    "I woke up, therefore I exist. Unfortunately.",
    "The city moves. I just tolerate it.",
    "You look like you're still trying. Bold choice."
  ],
  worker: [
    "I work so I don’t think too hard.",
    "Another day, another reason to keep going.",
    "At least the ground listens."
  ],
  wanderer: [
    "I walk so my thoughts don’t catch me.",
    "Every street feels like a question.",
    "Sometimes movement is the answer."
  ],
  optimist: [
    "You being here made the day lighter.",
    "The world’s strange, but we’re still in it.",
    "You look like someone who hasn’t given up."
  ]
};

// ---------------- WORLD ----------------
const Ground = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[200, 200]} />
    <meshStandardMaterial color="#334155" />
  </mesh>
);

const Building = ({ pos }) => (
  <mesh position={[pos[0], 2, pos[1]]} castShadow>
    <boxGeometry args={[4, 4, 4]} />
    <meshStandardMaterial color="#1e293b" />
  </mesh>
);

// ---------------- PLAYER ----------------
const Player = ({ position, rotation, moving }) => {
  const body = useRef();

  useFrame((state) => {
    if (moving && body.current) {
      body.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.15;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group ref={body}>
        <mesh castShadow position={[0, 0.8, 0]}>
          <capsuleGeometry args={[0.3, 0.9, 4, 16]} />
          <meshStandardMaterial color="#db2777" />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffdab9" />
        </mesh>
      </group>
    </group>
  );
};

// ---------------- NPC ----------------
const NPC = ({ pos, type, playerPos }) => {
  const ref = useRef();
  const [target] = useState(() => new THREE.Vector3(
    pos[0] + (Math.random() - 0.5) * 6,
    0,
    pos[1] + (Math.random() - 0.5) * 6
  ));
  const [line] = useState(() => DIALOGUE[type][Math.floor(Math.random() * DIALOGUE[type].length)]);
  const [talking, setTalking] = useState(false);

  useFrame(() => {
    if (!ref.current) return;

    const npcPos = ref.current.position;
    const p = new THREE.Vector3(...playerPos);
    const d = npcPos.distanceTo(p);

    if (d < TALK_RADIUS) {
      setTalking(true);
      ref.current.lookAt(p.x, npcPos.y, p.z);
    } else {
      setTalking(false);
      npcPos.lerp(target, 0.005);
    }
  });

  return (
    <group ref={ref} position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.3, 1, 4, 16]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>

      {talking && (
        <Text position={[0, 2.3, 0]} fontSize={0.28} color="white" maxWidth={4}>
          {line}
        </Text>
      )}
    </group>
  );
};

// ---------------- JOYSTICK ----------------
const Joystick = ({ onInput }) => {
  const stick = useRef();
  const center = useRef({ x: 0, y: 0 });
  const active = useRef(false);

  const start = (e) => {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    center.current = { x: t.clientX, y: t.clientY };
    active.current = true;
  };

  const move = (e) => {
    if (!active.current) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - center.current.x;
    const dy = t.clientY - center.current.y;
    const dist = Math.min(Math.hypot(dx, dy), 40);
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * dist;
    const y = Math.sin(a) * dist;
    stick.current.style.transform = `translate(${x}px, ${y}px)`;
    onInput({ x: x / 40, y: y / 40 });
  };

  const end = () => {
    active.current = false;
    stick.current.style.transform = "translate(0,0)";
    onInput({ x: 0, y: 0 });
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

// ---------------- APP ----------------
export default function App() {
  const [pos, setPos] = useState([0, 0, 0]);
  const [rot, setRot] = useState(0);
  const [input, setInput] = useState({ x: 0, y: 0 });

  const npcs = useMemo(() => ([
    { pos: [3, 3], type: "dreamer" },
    { pos: [-4, 2], type: "cynic" },
    { pos: [6, -5], type: "worker" },
    { pos: [-6, -4], type: "wanderer" },
    { pos: [1, -7], type: "optimist" }
  ]), []);

  const GameLoop = () => {
    useFrame((state) => {
      if (input.x || input.y) {
        const a = Math.atan2(input.x, input.y);
        setRot(a);
        const nx = pos[0] + input.x * PLAYER_SPEED;
        const nz = pos[2] + input.y * PLAYER_SPEED;
        setPos([nx, 0, nz]);
        state.camera.position.x = nx;
        state.camera.position.z = nz + 16;
        state.camera.lookAt(nx, 0, nz);
      }
    });
    return null;
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 15, 16]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        <Stars radius={80} depth={40} count={1500} factor={4} />

        <Ground />
        {[...Array(20)].map((_, i) => (
          <Building key={i} pos={[(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40]} />
        ))}

        {npcs.map((n, i) => (
          <NPC key={i} pos={n.pos} type={n.type} playerPos={pos} />
        ))}

        <Player position={pos} rotation={rot} moving={input.x || input.y} />
        <GameLoop />
      </Canvas>

      <Joystick onInput={setInput} />
    </div>
  );
}
