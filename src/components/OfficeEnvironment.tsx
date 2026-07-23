// ===========================================================================
// components/OfficeEnvironment.tsx
// ---------------------------------------------------------------------------
// Architectural shell and environment decor for the 3D Tech Startup Office.
// Features:
//   - Room shell (20 x 18 x 4.8) with carpet tile flooring & lounge wood floor
//   - Enclosed ceiling with recessed LED light panels & hanging pendant lamps
//   - Glass-walled Boss Corner Office at the back center with logo wall & window
//   - 5 Department Workstation Pods with glass partition dividers & channel-colored trims
//   - Central Lounge & Social Hub (Conference table, L-couch, coffee bar)
//   - Server Rack ("The Backend") with blinking status LEDs
//   - Printer/Copier station & paper recycling
//   - KPI Whiteboard wall with sticky notes & live TV dashboard
//   - Windows with soft daylight blinds & ambient hallway plants
// ===========================================================================

"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { CHANNEL_META, type Channel } from "@/lib/commandAgents";

const ROOM = {
  width: 20,
  depth: 18,
  height: 4.8,
};
const WALL_THICKNESS = 0.2;

function useEnvMaterials() {
  return useMemo(
    () => ({
      carpetFloor: new THREE.MeshStandardMaterial({
        color: "#cbd5e1", // Light slate carpet tile
        roughness: 0.9,
        metalness: 0.05,
      }),
      woodFloor: new THREE.MeshStandardMaterial({
        color: "#b45309", // Warm oak hardwood for central lounge
        roughness: 0.5,
        metalness: 0.1,
      }),
      wall: new THREE.MeshStandardMaterial({
        color: "#f8fafc", // Soft off-white studio wall
        roughness: 0.95,
      }),
      wallAccent: new THREE.MeshStandardMaterial({
        color: "#0f172a", // Dark feature wall for logo & TV
        roughness: 0.6,
      }),
      ceiling: new THREE.MeshStandardMaterial({
        color: "#f1f5f9",
        roughness: 0.9,
      }),
      ceilingLight: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#ffffff",
        emissiveIntensity: 0.9,
      }),
      pendantLight: new THREE.MeshStandardMaterial({
        color: "#fbbf24",
        emissive: "#fbbf24",
        emissiveIntensity: 0.7,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#e0f2fe",
        transparent: true,
        opacity: 0.22,
        roughness: 0.1,
        transmission: 0.9,
        thickness: 0.08,
        ior: 1.5,
      }),
      glassFrame: new THREE.MeshStandardMaterial({
        color: "#334155",
        roughness: 0.3,
        metalness: 0.8,
      }),
      bossLogo: new THREE.MeshStandardMaterial({
        color: "#fbbf24",
        emissive: "#fbbf24",
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.9,
      }),
      couchFabric: new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.85,
      }),
      couchCushion: new THREE.MeshStandardMaterial({
        color: "#64748b",
        roughness: 0.85,
      }),
      coffeeTableWood: new THREE.MeshStandardMaterial({
        color: "#78350f",
        roughness: 0.5,
      }),
      espressoBody: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.3,
        metalness: 0.8,
      }),
      serverRack: new THREE.MeshStandardMaterial({
        color: "#020617",
        roughness: 0.4,
        metalness: 0.7,
      }),
      serverLED: new THREE.MeshStandardMaterial({
        color: "#22c55e",
        emissive: "#22c55e",
        emissiveIntensity: 0.9,
      }),
      printerBody: new THREE.MeshStandardMaterial({
        color: "#e2e8f0",
        roughness: 0.5,
      }),
      whiteboard: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.2,
      }),
      stickyNoteYellow: new THREE.MeshStandardMaterial({ color: "#fef08a" }),
      stickyNotePink: new THREE.MeshStandardMaterial({ color: "#fbcfe8" }),
      stickyNoteBlue: new THREE.MeshStandardMaterial({ color: "#bae6fd" }),
      tvScreen: new THREE.MeshStandardMaterial({
        color: "#0284c7",
        emissive: "#0284c7",
        emissiveIntensity: 0.6,
      }),
      plantPot: new THREE.MeshStandardMaterial({ color: "#f8fafc" }),
      plantLeaves: new THREE.MeshStandardMaterial({ color: "#166534" }),
    }),
    []
  );
}

export function OfficeEnvironment() {
  const m = useEnvMaterials();

  return (
    <group>
      {/* ================= FLOORING ================= */}
      {/* Main Slate Carpet Floor */}
      <mesh
        material={m.carpetFloor}
        receiveShadow
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
      </mesh>

      {/* Central Lounge Warm Hardwood Flooring Inset */}
      <mesh
        material={m.woodFloor}
        receiveShadow
        position={[0, 0.005, 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[7.5, 6.0]} />
      </mesh>

      {/* ================= CEILING & LIGHTING ================= */}
      {/* Enclosed Ceiling Shell */}
      <mesh
        material={m.ceiling}
        position={[0, ROOM.height, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
      </mesh>

      {/* Recessed LED Panel Lights (Grid over room) */}
      {[-6, 0, 6].map((x) =>
        [-5, 0, 5].map((z, zi) => (
          <mesh
            key={`${x}-${z}-${zi}`}
            material={m.ceilingLight}
            position={[x, ROOM.height - 0.04, z]}
          >
            <boxGeometry args={[1.8, 0.04, 0.8]} />
          </mesh>
        ))
      )}

      {/* Warm Hanging Pendant Lamps over Central Lounge */}
      {[-1.5, 1.5].map((x, i) => (
        <group key={i} position={[x, ROOM.height - 0.9, 0.5]}>
          {/* Cord */}
          <mesh material={m.glassFrame} position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.9, 8]} />
          </mesh>
          {/* Shade */}
          <mesh material={m.glassFrame}>
            <coneGeometry args={[0.22, 0.25, 16]} />
          </mesh>
          {/* Glowing Bulb */}
          <mesh material={m.pendantLight} position={[0, -0.08, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
          </mesh>
        </group>
      ))}

      {/* ================= ROOM WALLS ================= */}
      {/* Back Wall */}
      <mesh
        material={m.wall}
        receiveShadow
        position={[0, ROOM.height / 2, -ROOM.depth / 2]}
      >
        <boxGeometry args={[ROOM.width, ROOM.height, WALL_THICKNESS]} />
      </mesh>
      {/* Left Wall */}
      <mesh
        material={m.wall}
        receiveShadow
        position={[-ROOM.width / 2, ROOM.height / 2, 0]}
      >
        <boxGeometry args={[WALL_THICKNESS, ROOM.height, ROOM.depth]} />
      </mesh>
      {/* Right Wall */}
      <mesh
        material={m.wall}
        receiveShadow
        position={[ROOM.width / 2, ROOM.height / 2, 0]}
      >
        <boxGeometry args={[WALL_THICKNESS, ROOM.height, ROOM.depth]} />
      </mesh>

      {/* Dark Feature Accent Wall at Back Left for Live TV & Branding */}
      <mesh
        material={m.wallAccent}
        position={[-6.5, ROOM.height / 2, -ROOM.depth / 2 + 0.12]}
      >
        <boxGeometry args={[5.5, ROOM.height - 0.4, 0.04]} />
      </mesh>

      {/* ================= GLASS BOSS OFFICE ================= */}
      {/* Positioned at Back Center [0, 0, -6.0], size 8.0 wide x 4.8 deep */}
      <group position={[0, 0, -6.0]}>
        {/* Elevated Wood Dais Platform */}
        <mesh material={m.woodFloor} receiveShadow position={[0, 0.08, 0]}>
          <boxGeometry args={[8.2, 0.16, 4.8]} />
        </mesh>
        {/* Entrance Steps */}
        <mesh material={m.glassFrame} position={[0, 0.05, 2.5]}>
          <boxGeometry args={[2.2, 0.1, 0.4]} />
        </mesh>

        {/* Front Glass Walls with Sliding Door Frame */}
        {/* Left Front Glass */}
        <mesh material={m.glass} position={[-2.8, 1.8, 2.4]}>
          <boxGeometry args={[2.4, 3.2, 0.06]} />
        </mesh>
        <mesh material={m.glassFrame} position={[-2.8, 1.8, 2.4]}>
          <boxGeometry args={[2.44, 3.24, 0.08]} />
        </mesh>
        {/* Right Front Glass */}
        <mesh material={m.glass} position={[2.8, 1.8, 2.4]}>
          <boxGeometry args={[2.4, 3.2, 0.06]} />
        </mesh>
        <mesh material={m.glassFrame} position={[2.8, 1.8, 2.4]}>
          <boxGeometry args={[2.44, 3.24, 0.08]} />
        </mesh>
        {/* Doorway Frame Center */}
        <mesh material={m.glassFrame} position={[0, 3.1, 2.4]}>
          <boxGeometry args={[3.2, 0.12, 0.12]} />
        </mesh>

        {/* Side Glass Walls */}
        <mesh material={m.glass} position={[-4.0, 1.8, 0]}>
          <boxGeometry args={[0.06, 3.2, 4.6]} />
        </mesh>
        <mesh material={m.glass} position={[4.0, 1.8, 0]}>
          <boxGeometry args={[0.06, 3.2, 4.6]} />
        </mesh>

        {/* Back Wall Boss Company Logo Sign */}
        <group position={[0, 2.8, -2.25]}>
          <mesh material={m.bossLogo}>
            <boxGeometry args={[2.8, 0.6, 0.05]} />
          </mesh>
          <mesh material={m.glassFrame} position={[0, -0.4, 0]}>
            <boxGeometry args={[2.2, 0.08, 0.03]} />
          </mesh>
        </group>

        {/* Boss Window View behind desk (Back Wall cutout view) */}
        <mesh material={m.tvScreen} position={[0, 2.2, -2.3]}>
          <planeGeometry args={[5.2, 2.2]} />
        </mesh>
      </group>

      {/* ================= 5 POD CUBICLE PARTITIONS ================= */}
      {/* Glass partitions separating the department pods with glowing top trims */}
      {(Object.keys(CHANNEL_META) as Channel[]).map((channel) => {
        const meta = CHANNEL_META[channel];
        const trimMat = new THREE.MeshStandardMaterial({
          color: meta.color,
          emissive: meta.color,
          emissiveIntensity: 0.6,
        });

        // Determine partition positions based on pod locations
        const posMap: Record<Channel, [number, number, number]> = {
          email: [-6.4, 0, -2.1],
          shopee: [-6.4, 0, 3.3],
          tiktok: [0, 0, 5.2],
          lazada: [6.4, 0, 3.3],
          facebook: [6.4, 0, -2.1],
        };

        const [px, py, pz] = posMap[channel];
        const isCenter = channel === "tiktok";

        return (
          <group key={channel} position={[px, py, pz]}>
            {/* Glass Divider Pane */}
            <mesh material={m.glass} position={[0, 0.85, 0]}>
              <boxGeometry args={isCenter ? [3.8, 1.3, 0.05] : [0.05, 1.3, 2.8]} />
            </mesh>
            {/* Channel Colored Top Glowing Trim */}
            <mesh material={trimMat} position={[0, 1.52, 0]}>
              <boxGeometry args={isCenter ? [3.8, 0.06, 0.07] : [0.07, 0.06, 2.8]} />
            </mesh>
          </group>
        );
      })}

      {/* ================= CENTRAL LOUNGE & SOCIAL HUB ================= */}
      <group position={[0, 0, 0.5]}>
        {/* Round Meeting Table */}
        <mesh material={m.coffeeTableWood} castShadow position={[0, 0.72, -0.8]}>
          <cylinderGeometry args={[1.0, 1.0, 0.06, 24]} />
        </mesh>
        <mesh material={m.glassFrame} position={[0, 0.36, -0.8]}>
          <cylinderGeometry args={[0.08, 0.22, 0.72, 16]} />
        </mesh>
        {/* 4 Meeting Chairs around table */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <group
              key={i}
              position={[
                Math.cos(angle) * 1.35,
                0,
                -0.8 + Math.sin(angle) * 1.35,
              ]}
              rotation={[0, -angle + Math.PI / 2, 0]}
            >
              <mesh material={m.couchFabric} castShadow position={[0, 0.42, 0]}>
                <boxGeometry args={[0.42, 0.06, 0.42]} />
              </mesh>
              <mesh material={m.couchFabric} castShadow position={[0, 0.72, 0.18]}>
                <boxGeometry args={[0.42, 0.55, 0.06]} />
              </mesh>
              <mesh material={m.glassFrame} position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
              </mesh>
            </group>
          );
        })}

        {/* L-Shaped Lounge Couch */}
        <group position={[-1.8, 0, 1.4]} rotation={[0, Math.PI / 4, 0]}>
          <mesh material={m.couchFabric} castShadow position={[0, 0.35, 0]}>
            <boxGeometry args={[2.2, 0.32, 0.85]} />
          </mesh>
          <mesh material={m.couchCushion} castShadow position={[0, 0.52, -0.3]}>
            <boxGeometry args={[2.2, 0.48, 0.2]} />
          </mesh>
          {/* L-Extension */}
          <mesh material={m.couchFabric} castShadow position={[0.7, 0.35, 0.75]}>
            <boxGeometry args={[0.8, 0.32, 0.7]} />
          </mesh>
        </group>

        {/* Low Wooden Coffee Table with Books */}
        <group position={[-0.8, 0, 1.2]}>
          <mesh material={m.coffeeTableWood} castShadow position={[0, 0.28, 0]}>
            <boxGeometry args={[1.1, 0.05, 0.6]} />
          </mesh>
          <mesh material={m.glassFrame} position={[0, 0.14, 0]}>
            <boxGeometry args={[0.9, 0.26, 0.45]} />
          </mesh>
        </group>

        {/* Refreshment & Coffee Bar Station */}
        <group position={[2.2, 0, 1.2]}>
          {/* Sideboard Cabinet */}
          <mesh material={m.glassFrame} castShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[1.5, 0.9, 0.6]} />
          </mesh>
          {/* Espresso Coffee Machine */}
          <mesh material={m.espressoBody} castShadow position={[-0.35, 1.05, 0]}>
            <boxGeometry args={[0.35, 0.32, 0.35]} />
          </mesh>
          {/* Water Cooler Dispenser */}
          <mesh material={m.printerBody} castShadow position={[0.35, 1.15, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.5, 16]} />
          </mesh>
        </group>
      </group>

      {/* ================= OFFICE AMENITIES & WALL DECOR ================= */}
      {/* Server Rack ("The Backend") against Right Wall */}
      <group position={[ROOM.width / 2 - 0.4, 0, -5.5]}>
        <mesh material={m.serverRack} castShadow position={[0, 1.4, 0]}>
          <boxGeometry args={[0.65, 2.8, 0.9]} />
        </mesh>
        {/* Blinking LED Indicators */}
        {[0.6, 1.0, 1.4, 1.8, 2.2].map((y, i) => (
          <mesh key={i} material={m.serverLED} position={[-0.33, y, 0.2]}>
            <boxGeometry args={[0.02, 0.04, 0.4]} />
          </mesh>
        ))}
      </group>

      {/* Copier / Printer Station against Right Wall */}
      <group position={[ROOM.width / 2 - 0.5, 0, 5.5]}>
        <mesh material={m.printerBody} castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[0.8, 1.1, 0.7]} />
        </mesh>
        <mesh material={m.glassFrame} position={[0, 1.12, 0]}>
          <boxGeometry args={[0.6, 0.06, 0.5]} />
        </mesh>
        {/* Paper Recycling Bin beside printer */}
        <mesh material={m.couchFabric} position={[0, 0.2, 0.6]}>
          <boxGeometry args={[0.35, 0.4, 0.35]} />
        </mesh>
      </group>

      {/* KPI Whiteboard Wall on Left Wall */}
      <group position={[-ROOM.width / 2 + 0.14, 2.4, 0]}>
        <mesh material={m.whiteboard} castShadow>
          <boxGeometry args={[0.04, 1.6, 3.2]} />
        </mesh>
        {/* Sticky Notes on Whiteboard */}
        <mesh material={m.stickyNoteYellow} position={[0.03, 0.3, -0.8]}>
          <boxGeometry args={[0.01, 0.2, 0.2]} />
        </mesh>
        <mesh material={m.stickyNotePink} position={[0.03, 0.3, -0.4]}>
          <boxGeometry args={[0.01, 0.2, 0.2]} />
        </mesh>
        <mesh material={m.stickyNoteBlue} position={[0.03, -0.2, 0.4]}>
          <boxGeometry args={[0.01, 0.25, 0.35]} />
        </mesh>
      </group>

      {/* Live System Metrics TV Dashboard (Mounted on Back Left Wall Accent) */}
      <group position={[-6.5, 2.8, -ROOM.depth / 2 + 0.16]}>
        <mesh material={m.glassFrame} castShadow>
          <boxGeometry args={[2.8, 1.5, 0.06]} />
        </mesh>
        <mesh material={m.tvScreen} position={[0, 0, 0.035]}>
          <planeGeometry args={[2.65, 1.35]} />
        </mesh>
      </group>

      {/* Large Office Windows on Left & Right Walls with daylight blinds */}
      {[-4.0, 4.0].map((z, i) => (
        <group key={i} position={[-ROOM.width / 2 + 0.12, 2.6, z]}>
          <mesh material={m.glass}>
            <boxGeometry args={[0.04, 2.2, 2.6]} />
          </mesh>
          <mesh material={m.glassFrame}>
            <boxGeometry args={[0.08, 2.3, 2.7]} />
          </mesh>
        </group>
      ))}

      {/* Decorative Hallway Plants in Corners */}
      {[-8.5, 8.5].map((x, i) => (
        <group key={i} position={[x, 0, ROOM.depth / 2 - 1.2]}>
          <mesh material={m.plantPot} castShadow position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.3, 0.22, 0.7, 16]} />
          </mesh>
          <mesh material={m.plantLeaves} castShadow position={[0, 1.1, 0]}>
            <dodecahedronGeometry args={[0.55, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default OfficeEnvironment;
