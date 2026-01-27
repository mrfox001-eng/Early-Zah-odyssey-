import React, { useState, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Stars, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// ================= CONFIG =================
const PLAYER_SPEED = 0.12;       // calmer walk
const RUN_MULTIPLIER = 2.0;      // hold-to-run
const TALK_RADIUS = 2.2;

const CHUNK_SIZE = 20;
const VIEW_RADIUS = 2;
const WORLD_LIMIT = 8;

// ================= DIALOGUE =================
const DIALOGUE = {
  dreamer: [
    "I keep imagining better versions of today.",
    "Somewhere, a softer world exists.",
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
const NPC_TYPES = Object.keys(DIALOGUE);

// ================= UTILS =================
function hash(x, z) {
  return `${x},${z}`;
}
function seededRand(seed) {
  let s = seed * 99991;
  return () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

// ================= WORLD PIECES =================
const GroundTile = ({ x, z, type }) => {
  const color =
    type === "park" ? "#14532d" :
    type === "plaza" ? "#4b5563" :
    "#1f2933";

  return (
    <mesh position={[x, -0.01, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[CHUNK_SIZE, CHUNK_SIZE]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

const Building = ({ x, z, w, d, h }) => (
  <mesh position={[x, h / 2, z]} castShadow receiveShadow>
    <boxGeometry args={[w, h, d]} />
    <meshStandardMaterial color="#1e293b" />
  </mesh>
);

// ================= NPC =================
const NPC = ({ pos, type, playerPos }) => {
  const ref = useRef();
  const [line] = useState(
    () => DIALOGUE[type][Math.floor(Math.random() * DIALOGUE[type].length)]
  );
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

// ================= CHUNK GENERATOR =================
function generateChunk(cx, cz) {
  const rand = seededRand(cx * 10007 + cz * 30011);
  const biome =
    rand() > 0.85 ? "park" :
    rand() > 0.7 ? "plaza" :
    "street";

  const buildings = [];
  const npcs = [];

  if (biome === "street" || biome === "plaza") {
    const count = 6 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      buildings.push({
        x: (rand() - 0.5) * CHUNK_SIZE + cx * CHUNK_SIZE,
        z: (rand() - 0.5) * CHUNK_SIZE + cz * CHUNK_SIZE,
        w: 2 + rand() * 1.5,
        d: 2 + rand() * 1.5,
        h: 3 + rand() * 6
      });
    }
  }

  const npcCount = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < npcCount; i++) {
    npcs.push({
      pos: [
        (rand() - 0.5) * CHUNK_SIZE + cx * CHUNK_SIZE,
        (rand() - 0.5) * CHUNK_SIZE + cz * CHUNK_SIZE
      ],
      type: NPC_TYPES[Math.floor(rand() * NPC_TYPES.length)]
    });
  }

  return { cx, cz, biome, buildings, npcs };
  }
// ================= PLAYER =================
const Player = ({ position, rotation, moving, running }) => {
  const body = useRef();
  useFrame((state) => {
    if (moving && body.current) {
      const amp = running ? 0.25 : 0.15;
      const freq = running ? 16 : 10;
      body.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * freq)) * amp;
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

// ================= JOYSTICK =================
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

// ================= RUN BUTTON =================
const RunButton = ({ setRunning }) => (
  <div
    className="absolute bottom-12 right-12 w-20 h-20 rounded-full bg-pink-500/70 border-2 border-white flex items-center justify-center text-white font-bold select-none"
    onMouseDown={() => setRunning(true)}
    onMouseUp={() => setRunning(false)}
    onMouseLeave={() => setRunning(false)}
    onTouchStart={() => setRunning(true)}
    onTouchEnd={() => setRunning(false)}
  >
    RUN
  </div>
);

// ================= APP =================
export default function App() {
  const [pos, setPos] = useState([0, 0, 0]);
  const [rot, setRot] = useState(0);
  const [input, setInput] = useState({ x: 0, y: 0 });
  const [running, setRunning] = useState(false);

  const chunksRef = useRef(new Map());
  const [, force] = useState(0);

  const ambientRef = useRef(null);
  const stepRef = useRef(null);

  useEffect(() => {
    ambientRef.current = new Audio("/sounds/ambient-city.mp3");
    ambientRef.current.loop = true;
    ambientRef.current.volume = 0.4;
    ambientRef.current.play().catch(() => {});

    stepRef.current = new Audio("/sounds/step.mp3");
    stepRef.current.volume = 0.25;

    const onKey = (e) => {
      if (e.key === "Shift") setRunning(e.type === "keydown");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const getChunk = (cx, cz) => {
    const k = hash(cx, cz);
    if (!chunksRef.current.has(k)) {
      chunksRef.current.set(k, generateChunk(cx, cz));
    }
    return chunksRef.current.get(k);
  };

  const updateChunks = () => {
    const cx = Math.floor(pos[0] / CHUNK_SIZE);
    const cz = Math.floor(pos[2] / CHUNK_SIZE);

    const keep = new Set();
    for (let x = -VIEW_RADIUS; x <= VIEW_RADIUS; x++) {
      for (let z = -VIEW_RADIUS; z <= VIEW_RADIUS; z++) {
        const k = hash(cx + x, cz + z);
        keep.add(k);
        getChunk(cx + x, cz + z);
      }
    }

    for (const k of chunksRef.current.keys()) {
      if (!keep.has(k)) chunksRef.current.delete(k);
    }
    force(v => v + 1);
  };

  const GameLoop = () => {
    useFrame((state) => {
      if (input.x || input.y) {
        const a = Math.atan2(input.x, input.y);
        setRot(a);

        const speed = running ? PLAYER_SPEED * RUN_MULTIPLIER : PLAYER_SPEED;

        let nx = pos[0] + input.x * speed;
        let nz = pos[2] + input.y * speed;

        const limit = WORLD_LIMIT * CHUNK_SIZE;
        nx = THREE.MathUtils.clamp(nx, -limit, limit);
        nz = THREE.MathUtils.clamp(nz, -limit, limit);

        let blocked = false;
        for (const c of chunksRef.current.values()) {
          for (const b of c.buildings) {
            const pad = 0.6;
            if (
              nx > b.x - b.w / 2 - pad &&
              nx < b.x + b.w / 2 + pad &&
              nz > b.z - b.d / 2 - pad &&
              nz < b.z + b.d / 2 + pad
            ) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
        }

        if (!blocked) {
          setPos([nx, 0, nz]);
          if (stepRef.current?.paused) {
            stepRef.current.playbackRate = running ? 1.8 : 1.0;
            stepRef.current.currentTime = 0;
            stepRef.current.play().catch(() => {});
          }
        }

        state.camera.position.x = nx;
        state.camera.position.z = nz + 16;
        state.camera.lookAt(nx, 0, nz);

        updateChunks();
      }
    });
    return null;
  };

  const chunks = Array.from(chunksRef.current.values());

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas shadows fog={{ color: "#0f172a", near: 20, far: 90 }}>
        <PerspectiveCamera makeDefault position={[0, 15, 16]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        <Stars radius={120} depth={60} count={1800} factor={4} />

        {chunks.map((c) => (
          <group key={hash(c.cx, c.cz)}>
            <GroundTile x={c.cx * CHUNK_SIZE} z={c.cz * CHUNK_SIZE} type={c.biome} />
            {c.buildings.map((b, i) => (
              <Building key={i} x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} />
            ))}
            {c.npcs.map((n, i) => (
              <NPC key={i} pos={n.pos} type={n.type} playerPos={pos} />
            ))}
          </group>
        ))}

        <Player position={pos} rotation={rot} moving={!!(input.x || input.y)} running={running} />
        <GameLoop />
      </Canvas>

      <Joystick onInput={setInput} />
      <RunButton setRunning={setRunning} />
    </div>
  );
}
