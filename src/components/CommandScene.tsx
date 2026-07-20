// ===========================================================================
// components/CommandScene.tsx
// ---------------------------------------------------------------------------
// 3D scene for the Command Center. Marked "use client" because Three.js
// needs the browser.
//
// Layout (top-down view of the room, X = left/right, Z = front/back):
//
//                  back wall (z = -6)
//   ┌──────────────────────────────────────────┐
//   │                                          │
//   │                  👑 Boss                  │   z = -4.5 (elevated)
//   │                    │                     │
//   │       ╱  ╱  │  ╲  ╲                      │
//   │      ╱  ╱   │   ╲  ╲                     │
//   │   📧  🛒  📱  🛍️  📘   ← masters         │   z = -1.5
//   │    │    │   │   │    │                   │
//   │    │    │   │   │    │                   │
//   │   📧  🛒  📱  🛍️  📘   ← subs            │   z = +1.5
//   │                                          │
//   │              (camera looks this way)     │
//   └──────────────────────────────────────────┘
//                  front (z = +6, open — no wall)
//
// Boss is on a raised circular platform at the back. 5 master bots stand
// in a row across the middle. 5 sub bots stand in a row across the front.
// Glowing colored lines connect Boss → each Master, and each Master → its
// Sub, so the hierarchy is visually obvious from any angle.
// ===========================================================================

"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  AdaptiveDpr,
  Line,
  Html,
} from "@react-three/drei";
import * as THREE from "three";

import {
  BOSS,
  MASTER_AGENTS,
  SUB_AGENTS,
  CHANNEL_META,
  type CommandAgent,
} from "@/lib/commandAgents";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";
import { CommandBot } from "@/components/CommandBot";

// ---- Room dimensions ------------------------------------------------------
const ROOM = {
  width: 16,
  depth: 14,
  height: 4.5,
};
const WALL_THICKNESS = 0.2;

// ---- Reusable materials (memoized) ---------------------------------------
function useRoomMaterials() {
  return useMemo(
    () => ({
      floor: new THREE.MeshStandardMaterial({
        color: "#e7e5e4",
        roughness: 0.9,
        metalness: 0.02,
      }),
      wall: new THREE.MeshStandardMaterial({
        color: "#fafaf9",
        roughness: 0.98,
        metalness: 0.0,
      }),
      platform: new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.6,
        metalness: 0.3,
      }),
      platformGlow: new THREE.MeshStandardMaterial({
        color: "#fbbf24",
        emissive: "#fbbf24",
        emissiveIntensity: 0.6,
        roughness: 0.4,
      }),
      windowFrame: new THREE.MeshStandardMaterial({
        color: "#fafaf9",
        roughness: 0.6,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#bae6fd",
        transparent: true,
        opacity: 0.18,
        roughness: 0.05,
        transmission: 0.85,
        thickness: 0.05,
        ior: 1.45,
      }),
      sky: new THREE.MeshStandardMaterial({
        color: "#7dd3fc",
        emissive: "#7dd3fc",
        emissiveIntensity: 0.35,
        roughness: 1.0,
      }),
      ceilingLight: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#ffffff",
        emissiveIntensity: 0.85,
        roughness: 0.3,
      }),
    }),
    []
  );
}

// ---- Boss platform (raised circular disk at the back) --------------------
function BossPlatform() {
  const m = useRoomMaterials();
  return (
    <group position={[BOSS.position[0], 0, BOSS.position[2]]}>
      {/* Cylindrical platform */}
      <mesh material={m.platform} castShadow receiveShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 0.4, 32]} />
      </mesh>
      {/* Glowing ring on top of the platform — gold to match the boss */}
      <mesh
        material={m.platformGlow}
        position={[0, 0.41, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.05, 1.15, 32]} />
      </mesh>
      {/* Step in front of the platform — like a small throne dais */}
      <mesh material={m.platform} castShadow receiveShadow position={[0, 0.1, 1.1]}>
        <boxGeometry args={[2, 0.2, 0.6]} />
      </mesh>
    </group>
  );
}

// ---- Window on the back wall (reuse the design from Office.tsx) ----------
function WindowOnWall({
  position,
  width = 4,
  height = 2,
}: {
  position: [number, number, number];
  width?: number;
  height?: number;
}) {
  const m = useRoomMaterials();
  return (
    <group position={position}>
      <mesh material={m.sky} position={[0, 0, -0.18]}>
        <planeGeometry args={[width + 1, height + 1]} />
      </mesh>
      <mesh material={m.glass} position={[0, 0, 0.01]}>
        <planeGeometry args={[width, height]} />
      </mesh>
      {/* Frame: 4 sides */}
      <mesh
        material={m.windowFrame}
        castShadow
        position={[0, height / 2 + 0.04, 0]}
      >
        <boxGeometry args={[width + 0.16, 0.08, 0.1]} />
      </mesh>
      <mesh
        material={m.windowFrame}
        castShadow
        position={[0, -height / 2 - 0.04, 0.02]}
      >
        <boxGeometry args={[width + 0.26, 0.1, 0.16]} />
      </mesh>
      <mesh
        material={m.windowFrame}
        castShadow
        position={[-width / 2 - 0.04, 0, 0]}
      >
        <boxGeometry args={[0.08, height, 0.1]} />
      </mesh>
      <mesh
        material={m.windowFrame}
        castShadow
        position={[width / 2 + 0.04, 0, 0]}
      >
        <boxGeometry args={[0.08, height, 0.1]} />
      </mesh>
      {/* Cross mullions */}
      <mesh material={m.windowFrame} position={[0, 0, 0.02]}>
        <boxGeometry args={[width, 0.04, 0.04]} />
      </mesh>
      <mesh material={m.windowFrame} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.04, height, 0.04]} />
      </mesh>
    </group>
  );
}

// ---- Connector lines: Boss → Masters, Master → Sub -----------------------
// Glowing colored lines that show the reporting hierarchy. Each line is a
// drei <Line> which renders a thin tube between two points.
function Connectors() {
  // Lines from Boss to each Master (5 lines fanning out)
  const bossToMasterLines = MASTER_AGENTS.map((master) => ({
    color: master.color,
    points: [
      // Start at the boss's chest height (y = 0.4 platform + 0.55 chest)
      [BOSS.position[0], 0.95, BOSS.position[2]] as [number, number, number],
      // End at the master's chest height
      [master.position[0], 0.55, master.position[2]] as [number, number, number],
    ],
  }));

  // Lines from each Master to its Sub (5 vertical-ish lines)
  const masterToSubLines = MASTER_AGENTS.map((master, i) => {
    const sub = SUB_AGENTS[i];
    return {
      color: master.color,
      points: [
        [master.position[0], 0.55, master.position[2]] as [number, number, number],
        [sub.position[0], 0.55, sub.position[2]] as [number, number, number],
      ],
    };
  });

  return (
    <group>
      {bossToMasterLines.map((line, i) => (
        <Line
          key={`bm-${i}`}
          points={line.points}
          color={line.color}
          lineWidth={2}
          transparent
          opacity={0.55}
        />
      ))}
      {masterToSubLines.map((line, i) => (
        <Line
          key={`ms-${i}`}
          points={line.points}
          color={line.color}
          lineWidth={2}
          transparent
          opacity={0.55}
        />
      ))}
    </group>
  );
}

// ---- Top-left header (HTML overlay inside Canvas via <Html>) -------------
// Shows the title + interaction hint, pinned to the top-left of the canvas.
function SceneHeader() {
  return (
    <Html
      position={[-ROOM.width / 2 + 0.5, ROOM.height - 0.5, -ROOM.depth / 2 + 0.5]}
      transform
      occlude={false}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          background: "rgba(15, 23, 42, 0.85)",
          color: "#e2e8f0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          backdropFilter: "blur(8px)",
        }}
      >
        🏢 Command Center
        <div
          style={{
            fontSize: 10,
            fontWeight: 400,
            color: "#94a3b8",
            marginTop: 2,
          }}
        >
          Click any bot to view its activity feed · drag to orbit
        </div>
      </div>
    </Html>
  );
}

// ---- Bottom-left legend (HTML overlay) -----------------------------------
// Quick at-a-glance of all channels + update count.
function SceneLegend() {
  const updateCount = useCommandCenterStore((s) => s.updates.length);
  const openChat = useCommandCenterStore((s) => s.openChat);

  return (
    <Html position={[-ROOM.width / 2 + 0.5, 0.5, ROOM.depth / 2 - 0.5]} transform>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(15, 23, 42, 0.85)",
          color: "#e2e8f0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 11,
          border: "1px solid rgba(148, 163, 184, 0.3)",
          backdropFilter: "blur(8px)",
          pointerEvents: "auto",
          minWidth: 180,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#94a3b8",
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Channels
        </div>
        {Object.entries(CHANNEL_META).map(([key, meta]) => (
          <div
            key={key}
            onClick={() => openChat(key as never)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 0",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: meta.color,
                boxShadow: `0 0 6px ${meta.color}`,
              }}
            />
            <span>{meta.emoji}</span>
            <span style={{ flex: 1 }}>{meta.label}</span>
          </div>
        ))}
        {updateCount > 0 && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 6,
              borderTop: "1px solid rgba(148, 163, 184, 0.2)",
              fontSize: 10,
              color: "#fbbf24",
              fontWeight: 600,
            }}
          >
            ● {updateCount} live update{updateCount === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </Html>
  );
}

// ---- Main scene ----------------------------------------------------------
export function CommandScene() {
  const m = useRoomMaterials();
  const openChat = useCommandCenterStore((s) => s.openChat);

  // All 11 bots in render order
  const allBots: CommandAgent[] = [BOSS, ...MASTER_AGENTS, ...SUB_AGENTS];

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [0, 5, 9], fov: 50 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onPointerMissed={() => openChat(null)}
    >
      <AdaptiveDpr pixelated={false} />

      {/* Bright soft-gray background + light fog */}
      <color attach="background" args={["#f1f5f9"]} />
      <fog attach="fog" args={["#f1f5f9", 20, 38]} />

      {/* ---- Lighting ---- */}
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      {/* Boss accent light — gold, from above the platform */}
      <pointLight
        position={[BOSS.position[0], 3, BOSS.position[2]]}
        color={BOSS.color}
        intensity={1.2}
        distance={6}
        decay={2}
      />
      {/* Per-channel accent lights at the master row */}
      {MASTER_AGENTS.map((a) => (
        <pointLight
          key={a.id}
          position={[a.position[0], 2.5, a.position[2]]}
          color={a.color}
          intensity={0.5}
          distance={3}
          decay={2}
        />
      ))}

      <Suspense fallback={null}>
        {/* ---- Floor ---- */}
        <mesh
          material={m.floor}
          receiveShadow
          position={[0, -0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[ROOM.width, ROOM.depth]} />
        </mesh>

        {/* ---- Walls (back + 2 sides; front omitted for camera) ---- */}
        <mesh
          material={m.wall}
          receiveShadow
          position={[0, ROOM.height / 2, -ROOM.depth / 2]}
        >
          <boxGeometry args={[ROOM.width, ROOM.height, WALL_THICKNESS]} />
        </mesh>
        <mesh
          material={m.wall}
          receiveShadow
          position={[-ROOM.width / 2, ROOM.height / 2, 0]}
        >
          <boxGeometry args={[WALL_THICKNESS, ROOM.height, ROOM.depth]} />
        </mesh>
        <mesh
          material={m.wall}
          receiveShadow
          position={[ROOM.width / 2, ROOM.height / 2, 0]}
        >
          <boxGeometry args={[WALL_THICKNESS, ROOM.height, ROOM.depth]} />
        </mesh>

        {/* ---- Ceiling strip lights ---- */}
        {[-4, 0, 4].map((x) => (
          <mesh
            key={x}
            material={m.ceilingLight}
            position={[x, ROOM.height - 0.05, 0]}
          >
            <boxGeometry args={[2, 0.04, 0.4]} />
          </mesh>
        ))}

        {/* ---- Window on the back wall (offset to the right so it doesn't
            sit directly behind the boss) ---- */}
        <WindowOnWall
          position={[5.5, 2.8, -ROOM.depth / 2 + 0.15]}
          width={3}
          height={1.8}
        />
        {/* Second smaller window on the left */}
        <WindowOnWall
          position={[-5.5, 2.8, -ROOM.depth / 2 + 0.15]}
          width={3}
          height={1.8}
        />

        {/* ---- Boss platform ---- */}
        <BossPlatform />

        {/* ---- Connector lines (drawn BEFORE bots so bots render on top) ---- */}
        <Connectors />

        {/* ---- The 11 bots ---- */}
        {allBots.map((agent) => (
          <CommandBot key={agent.id} agent={agent} />
        ))}

        {/* ---- Soft contact shadows ---- */}
        <ContactShadows
          position={[0, 0.005, 0]}
          opacity={0.3}
          scale={18}
          blur={2.6}
          far={5}
          resolution={1024}
          color="#0f172a"
        />

        {/* ---- HTML overlays pinned to the 3D scene ---- */}
        <SceneHeader />
        <SceneLegend />
      </Suspense>

      {/* ---- Camera controls ---- */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 1, -1]}
      />
    </Canvas>
  );
}

export default CommandScene;
