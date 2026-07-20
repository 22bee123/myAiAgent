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
// White-office palette: light floors + walls, light wood desks, dark gray
// office chairs, navy accent rug for contrast against the bright floor.
function useMaterials() {
  return useMemo(
    () => ({
      floor: new THREE.MeshStandardMaterial({
        color: "#e7e5e4", // warm light gray (office carpet / tile)
        roughness: 0.9,
        metalness: 0.02,
      }),
      wall: new THREE.MeshStandardMaterial({
        color: "#fafaf9", // off-white (eggshell)
        roughness: 0.98,
        metalness: 0.0,
      }),
      desk: new THREE.MeshStandardMaterial({
        color: "#d6d3d1", // light wood / white laminate
        roughness: 0.55,
        metalness: 0.1,
      }),
      deskLeg: new THREE.MeshStandardMaterial({
        color: "#a8a29e", // brushed silver gray
        roughness: 0.4,
        metalness: 0.6,
      }),
      chair: new THREE.MeshStandardMaterial({
        color: "#44403c", // dark gray fabric office chair
        roughness: 0.85,
        metalness: 0.05,
      }),
      monitorFrame: new THREE.MeshStandardMaterial({
        color: "#1c1917", // screens stay dark
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
        color: "#fafaf9", // white ceramic pot
        roughness: 0.6,
        metalness: 0.05,
      }),
      plantLeaves: new THREE.MeshStandardMaterial({
        color: "#16a34a", // natural green
        roughness: 0.7,
      }),
      rug: new THREE.MeshStandardMaterial({
        color: "#1e293b", // navy/slate accent rug for contrast
        roughness: 0.95,
      }),
      // Ceiling strip lights — bright white emissive (was reusing monitor
      // screen color before, which made them look cyan).
      ceilingLight: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#ffffff",
        emissiveIntensity: 0.85,
        roughness: 0.3,
      }),
      // Window frame — white painted wood around the window.
      windowFrame: new THREE.MeshStandardMaterial({
        color: "#fafaf9",
        roughness: 0.6,
        metalness: 0.05,
      }),
      // Window glass — transparent, slightly tinted, with low roughness so
      // it picks up reflections.
      glass: new THREE.MeshPhysicalMaterial({
        color: "#bae6fd",
        transparent: true,
        opacity: 0.18,
        roughness: 0.05,
        metalness: 0.0,
        transmission: 0.85,
        thickness: 0.05,
        ior: 1.45,
      }),
      // Sky outside the window — bright blue gradient. We use a flat color
      // here; the gradient is approximated by stacking two planes (one sky
      // blue, one slightly lighter near the horizon) inside the Window
      // component.
      sky: new THREE.MeshStandardMaterial({
        color: "#7dd3fc",
        emissive: "#7dd3fc",
        emissiveIntensity: 0.35,
        roughness: 1.0,
      }),
      skyHorizon: new THREE.MeshStandardMaterial({
        color: "#e0f2fe",
        emissive: "#e0f2fe",
        emissiveIntensity: 0.4,
        roughness: 1.0,
      }),
      // Couch fabric — warm gray. Pairs with the navy rug.
      couchFabric: new THREE.MeshStandardMaterial({
        color: "#78716c",
        roughness: 0.9,
        metalness: 0.0,
      }),
      // Couch cushions — slightly lighter shade for contrast.
      couchCushion: new THREE.MeshStandardMaterial({
        color: "#a8a29e",
        roughness: 0.9,
        metalness: 0.0,
      }),
      // Water dispenser body — white plastic.
      dispenserBody: new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        roughness: 0.4,
        metalness: 0.1,
      }),
      // Water bottle — translucent blue.
      waterBottle: new THREE.MeshPhysicalMaterial({
        color: "#bfdbfe",
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        transmission: 0.7,
        thickness: 0.1,
        ior: 1.33,
      }),
      // Water in the dispenser tray — same translucent blue.
      waterTap: new THREE.MeshStandardMaterial({
        color: "#0ea5e9",
        roughness: 0.3,
        metalness: 0.5,
      }),
      // Coffee table top — warm wood.
      tableTop: new THREE.MeshStandardMaterial({
        color: "#b08968",
        roughness: 0.5,
        metalness: 0.05,
      }),
      // Coffee on the table — small dark cylinder.
      coffeeMug: new THREE.MeshStandardMaterial({
        color: "#fef3c7",
        roughness: 0.5,
      }),
      coffee: new THREE.MeshStandardMaterial({
        color: "#3f2317",
        roughness: 0.4,
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
      {/* backrest — on the +Z side (away from the desk) so a seated person
          faces -Z toward the monitor. Previously this was at -Z, which would
          have made the seated person face away from the desk. */}
      <mesh material={m.chair} castShadow position={[0, 0.75, 0.22]}>
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

// ---------------------------------------------------------------------------
// Window — mounted on the back wall, with a sky "outdoor" plane behind it.
// The wall stays solid (cutting a hole through a box would require CSG or
// custom geometry); instead we place a small sky plane on the OUTER face of
// the wall, and the window frame + glass on the INNER face. From inside the
// room, looking through the glass, you see the sky. Reads convincingly
// without needing boolean geometry.
//
// Orientation: the window sits on the back wall (z = -ROOM.depth/2), facing
// +Z (into the room). The sky plane is at z = back wall z - a bit further
// back, facing +Z as well.
// ---------------------------------------------------------------------------
function WindowOnWall({
  position, // [x, y, z] center of the window on the wall
  width = 2.4,
  height = 1.6,
}: {
  position: [number, number, number];
  width?: number;
  height?: number;
}) {
  const m = useMaterials();
  const frameThickness = 0.08;
  const frameDepth = 0.1;

  return (
    <group position={position}>
      {/* Sky "outdoor" plane — sits just behind the wall, facing the room.
          Two stacked planes give a cheap horizon gradient. */}
      <mesh
        material={m.sky}
        position={[0, 0, -0.18]}
        rotation={[0, 0, 0]}
      >
        <planeGeometry args={[width + 1, height + 1]} />
      </mesh>
      <mesh
        material={m.skyHorizon}
        position={[0, -height / 2 - 0.2, -0.18]}
      >
        <planeGeometry args={[width + 1, 0.8]} />
      </mesh>

      {/* Glass pane — slightly in front of the sky, transparent. */}
      <mesh material={m.glass} position={[0, 0, 0.01]}>
        <planeGeometry args={[width, height]} />
      </mesh>

      {/* Outer frame — 4 thin boxes forming a rectangle around the glass. */}
      {/* top */}
      <mesh
        material={m.windowFrame}
        castShadow
        position={[0, height / 2 + frameThickness / 2, 0]}
      >
        <boxGeometry args={[width + frameThickness * 2, frameThickness, frameDepth]} />
      </mesh>
      {/* bottom (sill) — wider so it looks like a real window sill */}
      <mesh
        material={m.windowFrame}
        castShadow
        position={[0, -height / 2 - frameThickness / 2, 0.02]}
      >
        <boxGeometry args={[width + frameThickness * 2 + 0.1, frameThickness + 0.02, frameDepth + 0.06]} />
      </mesh>
      {/* left */}
      <mesh
        material={m.windowFrame}
        castShadow
        position={[-width / 2 - frameThickness / 2, 0, 0]}
      >
        <boxGeometry args={[frameThickness, height, frameDepth]} />
      </mesh>
      {/* right */}
      <mesh
        material={m.windowFrame}
        castShadow
        position={[width / 2 + frameThickness / 2, 0, 0]}
      >
        <boxGeometry args={[frameThickness, height, frameDepth]} />
      </mesh>
      {/* Cross mullions — a plus-shaped divider in the middle for a
          classic 4-pane office window look. */}
      <mesh material={m.windowFrame} position={[0, 0, 0.02]}>
        <boxGeometry args={[width, 0.04, 0.04]} />
      </mesh>
      <mesh material={m.windowFrame} position={[0, 0, 0.02]}>
        <boxGeometry args={[0.04, height, 0.04]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Couch — 3-seater office couch against a wall. Built from boxes:
//   - base (the seat block)
//   - backrest (tall thin box at the back)
//   - 2 armrests on the sides
//   - 3 seat cushions on top (slightly lighter color)
//   - 2 back cushions leaning against the backrest
//
// `rotationY` rotates the whole couch so you can place it against any wall.
// 0 = facing +Z (default — against the back wall, facing into the room)
// π/2 = facing +X (against the left wall, facing right into the room)
// ---------------------------------------------------------------------------
function Couch({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  const m = useMaterials();
  const seatW = 2.4; // total couch width (3 seats)
  const seatD = 0.95; // depth from front to back
  const baseH = 0.35; // base block height
  const cushionW = (seatW - 0.06) / 3; // 3 cushions with small gaps

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* ---- Base block ---- */}
      <mesh material={m.couchFabric} castShadow receiveShadow position={[0, baseH / 2, 0]}>
        <boxGeometry args={[seatW, baseH, seatD]} />
      </mesh>
      {/* ---- Backrest ---- */}
      <mesh
        material={m.couchFabric}
        castShadow
        position={[0, baseH + 0.35, -seatD / 2 + 0.1]}
      >
        <boxGeometry args={[seatW, 0.8, 0.18]} />
      </mesh>
      {/* ---- Armrests ---- */}
      <mesh
        material={m.couchFabric}
        castShadow
        position={[-seatW / 2 - 0.05, baseH + 0.18, 0]}
      >
        <boxGeometry args={[0.18, 0.55, seatD]} />
      </mesh>
      <mesh
        material={m.couchFabric}
        castShadow
        position={[seatW / 2 + 0.05, baseH + 0.18, 0]}
      >
        <boxGeometry args={[0.18, 0.55, seatD]} />
      </mesh>
      {/* ---- 3 seat cushions (lighter shade) ---- */}
      {[-1, 0, 1].map((i) => (
        <mesh
          key={i}
          material={m.couchCushion}
          castShadow
          position={[i * (cushionW + 0.02), baseH + 0.1, 0.05]}
        >
          <boxGeometry args={[cushionW, 0.18, seatD - 0.12]} />
        </mesh>
      ))}
      {/* ---- 2 back cushions leaning against the backrest ---- */}
      {[-0.55, 0.55].map((x, i) => (
        <mesh
          key={i}
          material={m.couchCushion}
          castShadow
          position={[x, baseH + 0.42, -seatD / 2 + 0.22]}
          rotation={[0.15, 0, 0]} // slight forward lean
        >
          <boxGeometry args={[0.9, 0.55, 0.16]} />
        </mesh>
      ))}
      {/* ---- 4 short legs (dark) ---- */}
      {[
        [-seatW / 2 + 0.1, -seatD / 2 + 0.1],
        [seatW / 2 - 0.1, -seatD / 2 + 0.1],
        [-seatW / 2 + 0.1, seatD / 2 - 0.1],
        [seatW / 2 - 0.1, seatD / 2 - 0.1],
      ].map((p, i) => (
        <mesh
          key={i}
          material={m.deskLeg}
          castShadow
          position={[p[0], 0.05, p[1]]}
        >
          <boxGeometry args={[0.06, 0.1, 0.06]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Water dispenser — tall thin box with a translucent water bottle on top
// and a tap at the bottom. Classic office water cooler.
// ---------------------------------------------------------------------------
function WaterDispenser({
  position,
}: {
  position: [number, number, number];
}) {
  const m = useMaterials();
  return (
    <group position={position}>
      {/* Body — main white plastic column */}
      <mesh material={m.dispenserBody} castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[0.4, 1.1, 0.4]} />
      </mesh>
      {/* Tap area — small dark recessed front panel */}
      <mesh material={m.dark} position={[0, 0.55, 0.21]}>
        <boxGeometry args={[0.18, 0.22, 0.02]} />
      </mesh>
      {/* Two taps — red (hot) and blue (cold) */}
      <mesh material={m.waterTap} position={[-0.04, 0.6, 0.22]}>
        <cylinderGeometry args={[0.025, 0.025, 0.06, 12]} rotation={[Math.PI / 2, 0, 0]} />
      </mesh>
      <mesh material={m.coffee} position={[0.04, 0.5, 0.22]}>
        <cylinderGeometry args={[0.025, 0.025, 0.06, 12]} rotation={[Math.PI / 2, 0, 0]} />
      </mesh>
      {/* Drip tray */}
      <mesh material={m.dark} position={[0, 0.3, 0.22]}>
        <boxGeometry args={[0.3, 0.04, 0.1]} />
      </mesh>
      {/* Water jug on top — translucent blue cylinder with a neck */}
      <mesh material={m.waterBottle} castShadow position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.55, 16]} />
      </mesh>
      {/* Neck — thin cylinder going into the dispenser body */}
      <mesh material={m.waterBottle} position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.18, 12]} />
      </mesh>
      {/* Water level inside the jug (slightly smaller cylinder, same blue) */}
      <mesh material={m.waterBottle} position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.4, 16]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Coffee table — small low table with a mug on top. Pairs with the couch.
// ---------------------------------------------------------------------------
function CoffeeTable({
  position,
}: {
  position: [number, number, number];
}) {
  const m = useMaterials();
  return (
    <group position={position}>
      {/* Tabletop */}
      <mesh material={m.tableTop} castShadow receiveShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[1.0, 0.05, 0.6]} />
      </mesh>
      {/* 4 legs */}
      {[
        [-0.42, -0.42],
        [0.42, -0.42],
        [-0.42, 0.42],
        [0.42, 0.42],
      ].map((p, i) => (
        <mesh
          key={i}
          material={m.tableTop}
          castShadow
          position={[p[0], 0.2, p[1]]}
        >
          <boxGeometry args={[0.05, 0.4, 0.05]} />
        </mesh>
      ))}
      {/* Coffee mug on the table */}
      <mesh material={m.coffeeMug} castShadow position={[0.15, 0.45, 0]}>
        <cylinderGeometry args={[0.05, 0.045, 0.09, 12]} />
      </mesh>
      <mesh material={m.coffee} position={[0.15, 0.49, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 0.01, 12]} />
      </mesh>
      {/* Mug handle */}
      <mesh material={m.coffeeMug} position={[0.21, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.025, 0.008, 8, 16, Math.PI]} />
      </mesh>
      {/* Small book / notebook on the table */}
      <mesh material={m.couchCushion} castShadow position={[-0.2, 0.43, 0.05]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.22, 0.03, 0.16]} />
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
          the actual <pointLight>s in Scene.tsx). Bright white emissive to
          look like real office fluorescent panels. */}
      {[-3, 0, 3].map((x) => (
        <mesh
          key={x}
          material={m.ceilingLight}
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

      {/* ---- Window on the back wall ----
          Centered on the back wall, above the research-agent's desk head
          height so it doesn't overlap the desk or monitor. The window's
          `position.z` is just inside the wall surface (z = -ROOM.depth/2 +
          0.11) so the frame sits flush against the wall.

          The back wall is at z = -ROOM.depth/2 = -5. Wall thickness is 0.2,
          so the inner face is at z = -4.9. We place the window group at
          z = -4.85 so the frame is just in front of the wall. The sky
          plane behind it (at z = window_z - 0.18 ≈ -5.03) is just outside
          the wall, so it's hidden behind the wall from most angles and
          only visible through the glass. */}
      <WindowOnWall
        position={[0, 2.6, -ROOM.depth / 2 + 0.15]}
        width={3.2}
        height={1.6}
      />

      {/* ---- Couch + coffee table against the left wall ----
          Couch rotated 90° so its backrest is against the left wall and it
          faces +X (into the room). Couch depth is ~0.95, so its center
          x = -ROOM.width/2 + 0.6 keeps the backrest flush with the wall. */}
      <Couch
        position={[-ROOM.width / 2 + 0.6, 0, 2.5]}
        rotationY={Math.PI / 2}
      />
      {/* Coffee table in front of the couch */}
      <CoffeeTable position={[-ROOM.width / 2 + 1.7, 0, 2.5]} />

      {/* ---- Water dispenser next to the couch, against the left wall.
          Moved here after the front-right corner + right-wall positions
          were both off-screen from the default camera angle (which is at
          [6,5,7] looking at [0,1,0] — anything in the front-right area
          falls outside the camera's view frustum). Next to the couch it's
          clearly visible and reads as part of the "lounge corner". */}
      <WaterDispenser
        position={[-ROOM.width / 2 + 0.5, 0, 4.0]}
      />
    </group>
  );
}

export default Office;
