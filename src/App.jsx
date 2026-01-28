import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Stars, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// ================= CONFIG =================
export const PLAYER_SPEED = 0.12;
export const RUN_MULTIPLIER = 2.0;
export const TALK_RADIUS = 2.2;

export const DRIVE_SPEED = 0.18;
export const DRIVE_TURN = 0.045;
export const ENTER_RADIUS = 2.4;

export const CHUNK_SIZE = 20;
export const VIEW_RADIUS = 2;
export const WORLD_LIMIT = 8;

// ================= DIALOGUE =================
export const DIALOGUE = {
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

export const NPC_TYPES = Object.keys(DIALOGUE);

// ================= UTILS =================
export function hash(x, z) {
  return `${x},${z}`;
}

export function seededRand(seed) {
  let s = seed * 99991;
  return () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

// ================= PLAYER MODE =================
export function usePlayerMode() {
  const [mode, setMode] = useState("walk"); // "walk" | "drive"
  const [activeVehicle, setActiveVehicle] = useState(null);

  const enterVehicle = (v) => {
    setActiveVehicle(v);
    setMode("drive");
  };

  const exitVehicle = () => {
    if (activeVehicle) activeVehicle.__driver = null;
    setActiveVehicle(null);
    setMode("walk");
  };

  return { mode, activeVehicle, enterVehicle, exitVehicle };
}

// ================= GLOBAL ROAD GRID =================
export const MAIN_AVENUE_SPACING = 60;
export const STREET_SPACING = 20;
export const ROAD_WIDTH_MAIN = 3.2;
export const ROAD_WIDTH_STREET = 2.0;

function roadWarp(x, z) {
  return Math.sin(x * 0.03) * 1.2 + Math.cos(z * 0.04) * 1.0;
}

export function getRoadAt(x, z) {
  const wx = x + roadWarp(x, z);
  const wz = z + roadWarp(z, x);

  const onMainX = Math.abs(wx % MAIN_AVENUE_SPACING) < ROAD_WIDTH_MAIN;
  const onMainZ = Math.abs(wz % MAIN_AVENUE_SPACING) < ROAD_WIDTH_MAIN;

  const onStreetX = Math.abs(wx % STREET_SPACING) < ROAD_WIDTH_STREET;
  const onStreetZ = Math.abs(wz % STREET_SPACING) < ROAD_WIDTH_STREET;

  const isMain = onMainX || onMainZ;
  const isStreet = !isMain && (onStreetX || onStreetZ);

  return {
    isRoad: isMain || isStreet,
    type: isMain ? "main" : isStreet ? "street" : null,
    dir: onMainX || onStreetX ? "vertical" : "horizontal"
  };
}

// ================= WORLD PIECES =================
export const GroundTile = ({ x, z, type }) => {
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

export const Building = ({ x, z, w, d, h }) => (
  <mesh position={[x, h / 2, z]} castShadow receiveShadow>
    <boxGeometry args={[w, h, d]} />
    <meshStandardMaterial color="#1e293b" />
  </mesh>
);
// ================= NPC =================
export const NPC = ({ pos, type, playerPos }) => {
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

// ================= CHUNK GENERATOR (ROAD-AWARE) =================
export function generateChunk(cx, cz) {
  const rand = seededRand(cx * 10007 + cz * 30011);

  const buildings = [];
  const npcs = [];
  const roads = [];
  const vehicles = [];

  const half = CHUNK_SIZE / 2;
  const step = 4;

  for (let x = -half; x <= half; x += step) {
    for (let z = -half; z <= half; z += step) {
      const wx = cx * CHUNK_SIZE + x;
      const wz = cz * CHUNK_SIZE + z;
      const r = getRoadAt(wx, wz);

      if (r.isRoad) {
        roads.push({
          x: wx,
          z: wz,
          dir: r.dir,
          type: r.type
        });
      }
    }
  }

  const bCount = 10 + Math.floor(rand() * 8);
  let attempts = 0;
  while (buildings.length < bCount && attempts < 200) {
    attempts++;
    const x = (rand() - 0.5) * CHUNK_SIZE + cx * CHUNK_SIZE;
    const z = (rand() - 0.5) * CHUNK_SIZE + cz * CHUNK_SIZE;
    const r = getRoadAt(x, z);
    if (r.isRoad) continue;

    buildings.push({
      x,
      z,
      w: 2 + rand() * 1.5,
      d: 2 + rand() * 1.5,
      h: 3 + rand() * 6
    });
  }

  const nCount = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < nCount; i++) {
    let px = (rand() - 0.5) * CHUNK_SIZE + cx * CHUNK_SIZE;
    let pz = (rand() - 0.5) * CHUNK_SIZE + cz * CHUNK_SIZE;
    const r = getRoadAt(px, pz);
    if (r.isRoad) {
      px += r.dir === "vertical" ? 3 : 0;
      pz += r.dir === "horizontal" ? 3 : 0;
    }
    npcs.push({
      pos: [px, pz],
      type: NPC_TYPES[Math.floor(rand() * NPC_TYPES.length)]
    });
  }

  const vCount = Math.floor(rand() * 2);
  for (let i = 0; i < vCount; i++) {
    const t = rand();
    const axis = rand() > 0.5 ? "x" : "z";
    const base =
      axis === "x"
        ? Math.round((cx * CHUNK_SIZE) / MAIN_AVENUE_SPACING) * MAIN_AVENUE_SPACING
        : Math.round((cz * CHUNK_SIZE) / MAIN_AVENUE_SPACING) * MAIN_AVENUE_SPACING;

    const x =
      axis === "x"
        ? base
        : cx * CHUNK_SIZE - CHUNK_SIZE / 2 + t * CHUNK_SIZE;
    const z =
      axis === "z"
        ? base
        : cz * CHUNK_SIZE - CHUNK_SIZE / 2 + t * CHUNK_SIZE;

    const r = getRoadAt(x, z);
    if (!r.isRoad || r.type !== "main") continue;

    vehicles.push({
      x,
      z,
      dir: r.dir,
      speed: 0.03 + rand() * 0.02,
      type: rand() > 0.6 ? "hover" : rand() > 0.3 ? "wheel" : "surreal"
    });
  }

  return { cx, cz, buildings, npcs, roads, vehicles };
        }
// ================= PLAYER =================
export const Player = ({ position, rotation, moving, running }) => {
  const body = useRef();

  useFrame((state) => {
    if (moving && body.current) {
      const amp = running ? 0.25 : 0.15;
      const freq = running ? 16 : 10;
      body.current.position.y =
        Math.abs(Math.sin(state.clock.elapsedTime * freq)) * amp;
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
export const Joystick = ({ onInput }) => {
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
    if (stick.current)
      stick.current.style.transform = `translate(${x}px, ${y}px)`;
    onInput({ x: x / 40, y: y / 40 });
  };

  const end = () => {
    active.current = false;
    if (stick.current) stick.current.style.transform = "translate(0,0)";
    onInput({ x: 0, y: 0 });
  };

  return (
    <div
      className="absolute bottom-12 left-12 w-32 h-32 bg-white/20 rounded-full border-2 border-white flex items-center justify-center z-50 touch-none"
      onMouseDown={start}
      onMouseMove={move}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={end}
    >
      <div
        ref={stick}
        className="w-12 h-12 bg-white rounded-full shadow-lg pointer-events-none"
      />
    </div>
  );
};

// ================= RUN BUTTON =================
export const RunButton = ({ setRunning }) => (
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
// ================= CAMERA FOLLOW SYSTEM =================
export function useDriveCamera(cameraRef) {
  const followPlayer = (pos) => {
    if (!cameraRef.current) return;
    cameraRef.current.position.x = pos[0];
    cameraRef.current.position.z = pos[2] + 16;
    cameraRef.current.position.y = 12;
    cameraRef.current.lookAt(pos[0], 0, pos[2]);
  };

  const followVehicle = (veh) => {
    if (!cameraRef.current || !veh) return;

    const back =
      veh.dir === "vertical"
        ? new THREE.Vector3(0, 6, -12)
        : new THREE.Vector3(-12, 6, 0);

    const p = new THREE.Vector3(veh.x, 0, veh.z).add(back);
    cameraRef.current.position.lerp(p, 0.18);
    cameraRef.current.lookAt(veh.x, 0, veh.z);
  };

  return { followPlayer, followVehicle };
}

// ================= ROAD TILE =================
export const RoadTile = ({ x, z, dir, type }) => {
  const w = type === "main" ? 3.2 : 2.0;
  const l = 4;

  return (
    <mesh
      position={[x, 0.01, z]}
      rotation={[0, dir === "vertical" ? Math.PI / 2 : 0, 0]}
      receiveShadow
    >
      <boxGeometry args={[l, 0.05, w]} />
      <meshStandardMaterial color="#0b1220" />
    </mesh>
  );
};

// ================= VEHICLE (ENTERABLE + AI) =================
export const Vehicle = ({ data, playerPos, mode, enterVehicle }) => {
  const ref = useRef();
  const [near, setNear] = useState(false);

  useFrame(() => {
    if (!ref.current) return;

    // AI movement when not driven by player
    if (!(mode === "drive" && data.__driver === "player")) {
      if (data.dir === "vertical") data.z += data.speed;
      else data.x += data.speed;

      const limit = WORLD_LIMIT * CHUNK_SIZE;
      if (data.x > limit) data.x = -limit;
      if (data.z > limit) data.z = -limit;

      const r = getRoadAt(data.x, data.z);
      if (r.isRoad) {
        data.dir = r.dir;
        if (r.dir === "vertical") {
          const gx = Math.round(data.x / STREET_SPACING) * STREET_SPACING;
          data.x = gx;
        } else {
          const gz = Math.round(data.z / STREET_SPACING) * STREET_SPACING;
          data.z = gz;
        }
      }
    }

    ref.current.position.set(data.x, 0, data.z);
    ref.current.rotation.y =
      data.dir === "vertical" ? Math.PI / 2 : 0;

    if (playerPos) {
      const p = new THREE.Vector3(...playerPos);
      const d = p.distanceTo(ref.current.position);
      setNear(d < ENTER_RADIUS);
    }

    if (data.type === "hover") {
      ref.current.position.y = 0.45 + Math.sin(data.x * 0.2) * 0.1;
    } else if (data.type === "surreal") {
      ref.current.position.y = 0.3 + Math.cos(data.z * 0.3) * 0.2;
      ref.current.rotation.y += 0.01;
    } else {
      ref.current.position.y = 0.15;
    }
  });

  const color =
    data.type === "hover"
      ? "#22d3ee"
      : data.type === "surreal"
      ? "#a855f7"
      : "#f59e0b";

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.6, 0.8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>

      <pointLight
        position={[0.7, 0.2, 0]}
        intensity={0.7}
        distance={5}
        color="#ffffff"
      />

      {near && (
        <Text position={[0, 1.6, 0]} fontSize={0.28} color="#ffffff">
          Tap to Drive
        </Text>
      )}

      {near && (
        <mesh
          position={[0, 0.8, 0]}
          onClick={() => {
            data.__driver = "player";
            enterVehicle(data);
          }}
        >
          <sphereGeometry args={[0.6, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  );
};
// ================= APP =================
export default function App() {
  const [pos, setPos] = useState([0, 0, 0]);
  const [rot, setRot] = useState(0);
  const [input, setInput] = useState({ x: 0, y: 0 });
  const [running, setRunning] = useState(false);

  const cameraRef = useRef();
  const { mode, activeVehicle, enterVehicle, exitVehicle } = usePlayerMode();
  const { followPlayer, followVehicle } = useDriveCamera(cameraRef);

  const chunksRef = useRef(new Map());
  const [, force] = useState(0);

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
    force((v) => v + 1);
  };

  const GameLoop = () => {
    useFrame(() => {
      if (mode === "walk" && (input.x || input.y)) {
        const a = Math.atan2(input.x, input.y);
        setRot(a);

        const speed = running ? PLAYER_SPEED * RUN_MULTIPLIER : PLAYER_SPEED;
        const nx = pos[0] + input.x * speed;
        const nz = pos[2] + input.y * speed;
        setPos([nx, 0, nz]);
        updateChunks();
      }

      if (mode === "walk") {
        followPlayer(pos);
      } else if (mode === "drive" && activeVehicle) {
        followVehicle(activeVehicle);

        // Driving controls
        if (input.y !== 0) {
          activeVehicle.speed =
            DRIVE_SPEED * (input.y > 0 ? 1 : -1);
        }
        if (input.x !== 0) {
          activeVehicle.dir += input.x * DRIVE_TURN;
        }
      }
    });
    return null;
  };

  const chunks = Array.from(chunksRef.current.values());

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas shadows fog={{ color: "#0f172a", near: 20, far: 120 }}>
        <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 12, 16]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        <Stars radius={150} depth={70} count={2200} factor={4} />

        {chunks.map((c) => (
          <group key={hash(c.cx, c.cz)}>
            <GroundTile x={c.cx * CHUNK_SIZE} z={c.cz * CHUNK_SIZE} type="street" />

            {c.roads.map((r, i) => (
              <RoadTile key={`r-${i}`} x={r.x} z={r.z} dir={r.dir} type={r.type} />
            ))}

            {c.buildings.map((b, i) => (
              <Building key={`b-${i}`} x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} />
            ))}

            {c.npcs.map((n, i) => (
              <NPC key={`n-${i}`} pos={n.pos} type={n.type} playerPos={pos} />
            ))}

            {c.vehicles.map((v, i) => (
              <Vehicle
                key={`v-${i}`}
                data={v}
                playerPos={pos}
                mode={mode}
                enterVehicle={enterVehicle}
              />
            ))}
          </group>
        ))}

        {mode === "walk" && (
          <Player
            position={pos}
            rotation={rot}
            moving={!!(input.x || input.y)}
            running={running}
          />
        )}

        <GameLoop />
      </Canvas>

      <Joystick onInput={setInput} />
      <RunButton setRunning={setRunning} />

      {mode === "drive" && (
        <div
          className="absolute top-6 right-6 bg-white/20 backdrop-blur px-4 py-2 rounded-lg text-white"
          onClick={exitVehicle}
        >
          Exit Vehicle
        </div>
      )}
    </div>
  );
}
