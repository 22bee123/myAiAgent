// ===========================================================================
// components/Office.tsx
// ---------------------------------------------------------------------------
// Stylized low-poly 3D office room, built entirely from primitive Three.js
// geometries (boxes, cylinders, planes). No external .glb needed.
//
// Layout (top-down, X = left/right, Z = forward/back):
//
//       back wall  (z = -5)
//   ┌─────────────────────────────┐
//   │                             │
//   │   🪑 Desk        🪑 Desk     │   ← z = 0  (Email + Business agents)
//   │                             │
//   │           🪑 Desk           │   ← z = -3 (Research agent)
//   │                             │
//   └─────────────────────────────┘
//       front wall (z = +5, removed for camera visibility)
//
// Desks themselves are rendered here as part of the room shell. The bot that
// sits at each desk is rendered separately by <Bot/> in Scene.tsx, positioned
// at the same x/z as the desk.
// ===========================================================================

"use client";

import { useMemo } from "react";
import * as THREE from "three";

// ---- Room dimensions ------------------------------------------------------
const ROOM = {
  width: 12, // X
  depth: 10, // Z
  height: 4, // Y
};
const WALL_THICKNESS = 0.2;

// ---- Reusable materials (memoized so colors stay stable across renders) ---
function useMaterials() {
  return useMemo(
    () => ({
      floor: new THREE.MeshStandardMaterial({
        color: "#1f2937",
        roughness: 0.85,
        metalness: 0.05,
      }),
      wall: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.95,
        metalness: 0.0,
      }),
      desk: new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.6,
        metalness: 0.15,
      }),
      deskLeg: new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.7,
        metalness: 0.2,
      }),
      chair: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.7,
        metalness: 0.1,
      }),
      monitorFrame: new THREE.MeshStandardMaterial({
        color: "#020617",
        roughness: 0.5,
        metalness: 0.3,
      }),
      monitorScreen: new THREE.MeshStandardMaterial({
        color: "#0ea5e9",
        emissive: "#0ea5e9",
        emissiveIntensity: 0.55,
        roughness: 0.3,
      }),
      plantPot: new THREE.MeshStandardMaterial({
        color: "#92400e",
        roughness: 0.85,
      }),
      plantLeaves: new THREE.MeshStandardMaterial({
        color: "#15803d",
        roughness: 0.7,
      }),
      rug: new THREE.MeshStandardMaterial({
        color: "#7c2d12",
        roughness: 0.95,
      }),
    }),
    []
  );
}

// ---- Small sub-meshes -----------------------------------------------------
function Desk({ position }: { position: [number, number, number] }) {
  const m = useMaterials();
  // Desk top + 4 legs, positioned as a single group.
  return (
    <group position={position}>
      {/* desktop surface */}
      <mesh material={m.desk} castShadow receiveShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[1.8, 0.08, 0.9]} />
      </mesh>
      {/* 4 legs */}
      {[
        [-0.8, -0.85, -0.4],
        [0.8, -0.85, -0.4],
        [-0.8, -0.85, 0.4],
        [0.8, -0.85, 0.4],
      ].map((p, i) => (
        <mesh
          key={i}
          material={m.deskLeg}
          castShadow
          position={p as [number, number, number]}
        >
          <boxGeometry args={[0.06, 0.75, 0.06]} />
        </mesh>
      ))}
      {/* Monitor */}
      <group position={[0, 1.2, -0.3]}>
        {/* stand neck */}
        <mesh material={m.monitorFrame} castShadow position={[0, -0.18, 0]}>
          <boxGeometry args={[0.06, 0.36, 0.06]} />
        </mesh>
        {/* stand base */}
        <mesh material={m.monitorFrame} castShadow position={[0, -0.36, 0]}>
          <boxGeometry args={[0.3, 0.02, 0.2]} />
        </mesh>
        {/* screen frame */}
        <mesh material={m.monitorFrame} castShadow>
          <boxGeometry args={[1.0, 0.6, 0.05]} />
        </mesh>
        {/* screen face (emissive so it glows) */}
        <mesh material={m.monitorScreen} position={[0, 0, 0.026]}>
          <planeGeometry args={[0.92, 0.52]} />
        </mesh>
      </group>
      {/* Keyboard */}
      <mesh material={m.monitorFrame} position={[0, 0.79, 0.18]}>
        <boxGeometry args={[0.6, 0.02, 0.18]} />
      </mesh>
    </group>
  );
}

function Chair({ position }: { position: [number, number, number] }) {
  const m = useMaterials();
  return (
    <group position={position}>
      {/* seat */}
      <mesh material={m.chair} castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
      </mesh>
      {/* backrest */}
      <mesh material={m.chair} castShadow position={[0, 0.75, -0.22]}>
        <boxGeometry args={[0.5, 0.6, 0.06]} />
      </mesh>
      {/* pole */}
      <mesh material={m.deskLeg} castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 12]} />
      </mesh>
      {/* 5-leg base */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            material={m.deskLeg}
            castShadow
            position={[Math.cos(a) * 0.18, 0.04, Math.sin(a) * 0.18]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.32, 0.04, 0.04]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  const m = useMaterials();
  return (
    <group position={position}>
      {/* pot */}
      <mesh material={m.plantPot} castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.4, 8]} />
      </mesh>
      {/* leaves — three squashed icosahedrons of decreasing size */}
      <mesh material={m.plantLeaves} castShadow position={[0, 0.6, 0]}>
        <icosahedronGeometry args={[0.28, 0]} />
      </mesh>
      <mesh material={m.plantLeaves} castShadow position={[0.1, 0.85, 0.05]}>
        <icosahedronGeometry args={[0.2, 0]} />
      </mesh>
      <mesh material={m.plantLeaves} castShadow position={[-0.08, 1.05, -0.05]}>
        <icosahedronGeometry args={[0.15, 0]} />
      </mesh>
    </group>
  );
}

// ---- Main room shell ------------------------------------------------------
export function Office() {
  const m = useMaterials();

  // Desks: one for each agent (positions MUST match agents.ts).
  const desks: { pos: [number, number, number] }[] = [
    { pos: [-2.2, 0, 0] }, // email-agent
    { pos: [2.2, 0, 0] }, // business-agent
    { pos: [0, 0, -3.2] }, // research-agent
  ];

  return (
    <group>
      {/* ---- Floor ---- */}
      <mesh
        material={m.floor}
        receiveShadow
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
      </mesh>

      {/* Center rug for warmth */}
      <mesh
        material={m.rug}
        receiveShadow
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[5, 4]} />
      </mesh>

      {/* ---- Walls (back + 2 sides; front omitted for camera) ---- */}
      {/* Back wall */}
      <mesh
        material={m.wall}
        receiveShadow
        position={[0, ROOM.height / 2, -ROOM.depth / 2]}
      >
        <boxGeometry args={[ROOM.width, ROOM.height, WALL_THICKNESS]} />
      </mesh>
      {/* Left wall */}
      <mesh
        material={m.wall}
        receiveShadow
        position={[-ROOM.width / 2, ROOM.height / 2, 0]}
      >
        <boxGeometry args={[WALL_THICKNESS, ROOM.height, ROOM.depth]} />
      </mesh>
      {/* Right wall */}
      <mesh
        material={m.wall}
        receiveShadow
        position={[ROOM.width / 2, ROOM.height / 2, 0]}
      >
        <boxGeometry args={[WALL_THICKNESS, ROOM.height, ROOM.depth]} />
      </mesh>

      {/* Ceiling strip lights (purely decorative — real light comes from
          the actual <pointLight>s in Scene.tsx) */}
      {[-3, 0, 3].map((x) => (
        <mesh
          key={x}
          material={m.monitorScreen}
          position={[x, ROOM.height - 0.05, 0]}
        >
          <boxGeometry args={[2, 0.04, 0.4]} />
        </mesh>
      ))}

      {/* ---- Desks + chairs ---- */}
      {desks.map((d, i) => (
        <group key={i}>
          <Desk position={d.pos} />
          {/* Chair sits in front of desk, facing it (i.e. +Z direction) */}
          <Chair position={[d.pos[0], 0, d.pos[2] + 0.6]} />
        </group>
      ))}

      {/* ---- Plants in the corners ---- */}
      <Plant
        position={[-ROOM.width / 2 + 0.6, 0, -ROOM.depth / 2 + 0.6]}
      />
      <Plant position={[ROOM.width / 2 - 0.6, 0, -ROOM.depth / 2 + 0.6]} />
    </group>
  );
}

export default Office;
