// ===========================================================================
// components/Scene.tsx
// ---------------------------------------------------------------------------
// The 3D canvas. Marked "use client" because:
//   - Next.js App Router renders server components by default
//   - Three.js + R3F need `window`/`document`, which only exist on the client
//
// Composition:
//   <Canvas>                ← R3F root
//     <color attach="background">
//     <ambientLight>        ← soft global fill
//     <directionalLight>    ← sun-like key light, casts the shadows
//     <pointLight>          × 3 ← per-bot colored accent lights
//     <OrbitControls>       ← drei, gives us drag-to-orbit + scroll-to-zoom
//     <Suspense>            ← needed for any async-loaded assets (useGLTF etc)
//       <Office/>           ← the room shell
//       {agents.map(<Bot/>)} ← one bot per agent config entry
// ===========================================================================

"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  ContactShadows,
  AdaptiveDpr,
} from "@react-three/drei";
import * as THREE from "three";

import { agents } from "@/lib/agents";
import { useOfficeStore } from "@/store/useOfficeStore";
import { Office } from "@/components/Office";
import { Bot } from "@/components/Bot";

// Small floating label rendered above each bot using drei's <Html>.
// `occlude` would hide it behind walls but adds perf cost — left off here.
function BotTag({ id, name, color }: { id: string; name: string; color: string }) {
  const select = useOfficeStore((s) => s.select);
  const selectedId = useOfficeStore((s) => s.selectedId);
  const hoveredId = useOfficeStore((s) => s.hoveredId);

  const isActive = selectedId === id || hoveredId === id;

  return (
    <Html
      center
      distanceFactor={8}
      position={[0, 1.55, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          padding: "2px 8px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
          transform: "translateY(-50%)",
          background: isActive ? color : "rgba(15, 23, 42, 0.85)",
          color: isActive ? "#0b1120" : "#e2e8f0",
          border: `1px solid ${color}`,
          boxShadow: isActive ? `0 0 18px ${color}` : "none",
          transition: "all 120ms ease-out",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        {name}
      </div>
    </Html>
  );
}

export function Scene() {
  const select = useOfficeStore((s) => s.select);
  const setHovered = useOfficeStore((s) => s.setHovered);

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [6, 5, 7], fov: 50 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onPointerMissed={() => select(null)}
    >
      {/* Adaptive resolution — keep things smooth on lower-end devices */}
      <AdaptiveDpr pixelated={false} />

      {/* Scene background + base fog for depth perception */}
      <color attach="background" args={["#05070d"]} />
      <fog attach="fog" args={["#05070d", 14, 28]} />

      {/* ---- Lighting ---- */}
      {/* Soft global fill so the unlit sides of objects aren't pitch black */}
      <ambientLight intensity={0.45} />
      {/* Key directional light — this is the only shadow caster */}
      <directionalLight
        position={[6, 9, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      {/* Per-bot accent lights — they tint the immediate area in agent color,
          so even from far away you can tell which workstation is which. */}
      {agents.map((a) => (
        <pointLight
          key={a.id}
          position={[a.position[0], 2.2, a.position[2]]}
          color={a.color}
          intensity={1.2}
          distance={4}
          decay={2}
        />
      ))}

      <Suspense fallback={null}>
        <Office />

        {agents.map((agent) => (
          <group key={agent.id} position={[0, 0, 0]}>
            <Bot
              agent={agent}
              onSelect={select}
              onHover={setHovered}
            />
            <group position={agent.position}>
              <BotTag id={agent.id} name={agent.name} color={agent.color} />
            </group>
          </group>
        ))}

        {/* Soft contact shadows under everything — much cheaper than full
            shadow maps and looks great on a low-poly scene. */}
        <ContactShadows
          position={[0, 0.005, 0]}
          opacity={0.5}
          scale={14}
          blur={2.4}
          far={5}
          resolution={1024}
          color="#000000"
        />
      </Suspense>

      {/* ---- Camera controls ---- */}
      {/* Limited polar angle so you can't flip under the floor. Damping on
          for a much nicer "weighty" feel. */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 1, 0]}
      />
    </Canvas>
  );
}

export default Scene;
