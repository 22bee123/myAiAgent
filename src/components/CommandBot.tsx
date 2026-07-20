// ===========================================================================
// components/CommandBot.tsx
// ---------------------------------------------------------------------------
// Standing variant of the Mecha Chameleon Bat, used in the 3D Command Center.
//
// Same visual design as Bot.tsx (chameleon turret eyes, bat ears, curled
// tail, folded wings, office shirt + tie) but:
//   - Stands upright (no chair offset, no seated pose)
//   - Faces +Z (toward the camera) by default — no 180° rotation
//   - Arms hang at the sides (not reaching forward to a keyboard)
//   - Legs are vertical (standing, not sitting)
//   - Takes a CommandAgent (from lib/commandAgents.ts) instead of AgentConfig
//   - Clicking opens the chatbox filtered to the agent's channel
//
// Boss variant (tier === "boss"):
//   - 1.3x scale
//   - Floating gold crown above the head
//   - Slightly stronger emissive glow
// ===========================================================================

"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { CommandAgent } from "@/lib/commandAgents";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

interface CommandBotProps {
  agent: CommandAgent;
}

export function CommandBot({ agent }: CommandBotProps) {
  const groupRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const eyeLRef = useRef<THREE.Group>(null);
  const eyeRRef = useRef<THREE.Group>(null);

  const isBoss = agent.tier === "boss";
  const scale = isBoss ? 1.3 : 1;

  // Random phase offset so bots don't all bob in sync
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const [hovered, setHovered] = useState(false);

  const openChat = useCommandCenterStore((s) => s.openChat);

  // ---- Materials (memoized) ----------------------------------------------
  const mats = useMemo(() => {
    const c = new THREE.Color(agent.color);
    return {
      mechaBody: new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: isBoss ? 0.25 : 0.15,
        roughness: 0.35,
        metalness: 0.7,
      }),
      shirt: new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        roughness: 0.85,
        metalness: 0.0,
      }),
      dark: new THREE.MeshStandardMaterial({
        color: "#1f2937",
        roughness: 0.5,
        metalness: 0.4,
      }),
      tie: new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.1,
        roughness: 0.3,
        metalness: 0.2,
      }),
      eye: new THREE.MeshStandardMaterial({
        color: "#fef3c7",
        roughness: 0.4,
        metalness: 0.1,
      }),
      pupil: new THREE.MeshStandardMaterial({
        color: "#020617",
        emissive: c,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      }),
      wing: new THREE.MeshStandardMaterial({
        color: "#1e1b4b",
        emissive: c,
        emissiveIntensity: 0.08,
        roughness: 0.6,
        metalness: 0.2,
      }),
      screen: new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      }),
      // Boss-only: gold crown material
      crown: new THREE.MeshStandardMaterial({
        color: "#fbbf24",
        emissive: "#fbbf24",
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.9,
      }),
    };
  }, [agent.color, isBoss]);

  // ---- Animation loop -----------------------------------------------------
  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    if (groupRef.current) {
      // Idle bobbing — slightly more pronounced for the boss
      const amp = isBoss ? 0.06 : 0.04;
      groupRef.current.position.y =
        agent.position[1] + Math.sin(t * 1.5) * amp;
    }
    // Subtle head tilt
    if (headRef.current) {
      headRef.current.rotation.z = Math.sin(t * 0.7) * 0.08;
    }
    // Gentle arm sway (much subtler than the typing motion in Bot.tsx)
    const sway = Math.sin(t * 1.2) * 0.05;
    if (armLRef.current) armLRef.current.rotation.x = 0.1 + sway;
    if (armRRef.current) armRRef.current.rotation.x = 0.1 - sway;
    // Chameleon eyes — independent slow swivel
    if (eyeLRef.current) {
      eyeLRef.current.rotation.y = Math.sin(t * 0.5) * 0.7;
    }
    if (eyeRRef.current) {
      eyeRRef.current.rotation.y = Math.sin(t * 0.5 + 1.7) * 0.7;
    }
    // Smooth emissive glow on hover
    const target = hovered ? (isBoss ? 0.7 : 0.5) : isBoss ? 0.25 : 0.15;
    // eslint-disable-next-line react-hooks/immutability
    mats.mechaBody.emissiveIntensity = THREE.MathUtils.lerp(
      mats.mechaBody.emissiveIntensity,
      target,
      0.15
    );
  });

  // ---- Pointer handlers ---------------------------------------------------
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "default";
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Boss click → open unified feed (no filter); others → filtered to channel
    openChat(isBoss ? null : (agent.channel as never));
  };

  // ---- Tail curve (precomputed) ------------------------------------------
  const tailSegments = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const angle = i * 0.95;
        const radius = 0.11 - i * 0.013;
        return {
          pos: [
            Math.cos(angle) * radius,
            -0.05 - i * 0.04,
            -0.18 - Math.sin(angle) * radius * 0.4,
          ] as [number, number, number],
          size: Math.max(0.04 - i * 0.005, 0.018),
        };
      }),
    []
  );

  return (
    <group
      ref={groupRef}
      position={agent.position}
      scale={[scale, scale, scale]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {/* ============ HEAD GROUP ============ */}
      <group ref={headRef} position={[0, 0.95, 0]}>
        <mesh material={mats.mechaBody} castShadow>
          <boxGeometry args={[0.36, 0.32, 0.36]} />
        </mesh>
        {/* Snout — faces +Z (toward camera) */}
        <mesh material={mats.mechaBody} castShadow position={[0, -0.02, 0.22]}>
          <boxGeometry args={[0.18, 0.14, 0.12]} />
        </mesh>

        {/* Turret eyes — bulging spheres on the sides */}
        <group ref={eyeLRef} position={[-0.2, 0.08, 0.05]}>
          <mesh material={mats.eye} castShadow>
            <sphereGeometry args={[0.11, 16, 16]} />
          </mesh>
          <mesh material={mats.pupil} position={[0, 0, 0.09]}>
            <sphereGeometry args={[0.045, 12, 12]} />
          </mesh>
        </group>
        <group ref={eyeRRef} position={[0.2, 0.08, 0.05]}>
          <mesh material={mats.eye} castShadow>
            <sphereGeometry args={[0.11, 16, 16]} />
          </mesh>
          <mesh material={mats.pupil} position={[0, 0, 0.09]}>
            <sphereGeometry args={[0.045, 12, 12]} />
          </mesh>
        </group>

        {/* Bat ears */}
        <mesh
          material={mats.dark}
          castShadow
          position={[-0.12, 0.24, -0.04]}
          rotation={[-0.3, 0, -0.1]}
        >
          <coneGeometry args={[0.06, 0.16, 8]} />
        </mesh>
        <mesh
          material={mats.dark}
          castShadow
          position={[0.12, 0.24, -0.04]}
          rotation={[-0.3, 0, 0.1]}
        >
          <coneGeometry args={[0.06, 0.16, 8]} />
        </mesh>

        {/* Antenna with glowing tip */}
        <mesh material={mats.dark} position={[0, 0.3, 0.06]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
        </mesh>
        <mesh material={mats.screen} position={[0, 0.4, 0.11]}>
          <sphereGeometry args={[0.03, 12, 12]} />
        </mesh>

        {/* Boss-only: floating gold crown above the head */}
        {isBoss && (
          <group position={[0, 0.62, 0]}>
            {/* Crown base ring */}
            <mesh material={mats.crown} castShadow rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.08, 8]} />
            </mesh>
            {/* Crown points (5 cones around the top) */}
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2;
              return (
                <mesh
                  key={i}
                  material={mats.crown}
                  castShadow
                  position={[Math.cos(a) * 0.16, 0.1, Math.sin(a) * 0.16]}
                >
                  <coneGeometry args={[0.04, 0.12, 6]} />
                </mesh>
              );
            })}
            {/* Jewel on each point */}
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2;
              return (
                <mesh
                  key={`j${i}`}
                  material={mats.screen}
                  position={[Math.cos(a) * 0.16, 0.18, Math.sin(a) * 0.16]}
                >
                  <sphereGeometry args={[0.025, 8, 8]} />
                </mesh>
              );
            })}
          </group>
        )}
      </group>

      {/* ============ NECK ============ */}
      <mesh material={mats.dark} position={[0, 0.76, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.1, 8]} />
      </mesh>

      {/* ============ TORSO (office shirt) ============ */}
      <mesh material={mats.shirt} castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[0.52, 0.55, 0.36]} />
      </mesh>
      {/* Collar */}
      <mesh
        material={mats.shirt}
        castShadow
        position={[-0.07, 0.8, 0.1]}
        rotation={[0.4, 0, -0.3]}
      >
        <boxGeometry args={[0.1, 0.04, 0.16]} />
      </mesh>
      <mesh
        material={mats.shirt}
        castShadow
        position={[0.07, 0.8, 0.1]}
        rotation={[0.4, 0, 0.3]}
      >
        <boxGeometry args={[0.1, 0.04, 0.16]} />
      </mesh>
      {/* Tie knot + tie */}
      <mesh material={mats.tie} castShadow position={[0, 0.76, 0.19]}>
        <boxGeometry args={[0.08, 0.06, 0.03]} />
      </mesh>
      <mesh material={mats.tie} castShadow position={[0, 0.58, 0.19]}>
        <boxGeometry args={[0.06, 0.3, 0.02]} />
      </mesh>
      {/* Buttons */}
      {[0.45, 0.53, 0.61, 0.69].map((y, i) => (
        <mesh key={i} material={mats.dark} position={[0.08, y, 0.19]}>
          <sphereGeometry args={[0.012, 8, 8]} />
        </mesh>
      ))}
      {/* Chest pocket */}
      <mesh material={mats.shirt} position={[-0.15, 0.62, 0.19]}>
        <boxGeometry args={[0.08, 0.08, 0.01]} />
      </mesh>

      {/* Tier badge on the chest (M for Master, S for Sub) — small colored
          square on the right chest so you can tell master vs sub apart at
          a glance. Boss has no badge (the crown is enough). */}
      {!isBoss && (
        <mesh position={[0.15, 0.62, 0.19]} material={mats.screen}>
          <boxGeometry args={[0.06, 0.06, 0.01]} />
        </mesh>
      )}

      {/* ============ ARMS (hanging at sides) ============ */}
      {/* Arms pivot at the shoulder and hang down. Gentle sway via useFrame. */}
      <group ref={armLRef} position={[-0.3, 0.72, 0]} rotation={[0.1, 0, 0]}>
        <mesh material={mats.shirt} castShadow position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.32, 10]} />
        </mesh>
        <mesh material={mats.dark} castShadow position={[0, -0.33, 0]}>
          <cylinderGeometry args={[0.062, 0.062, 0.04, 10]} />
        </mesh>
        <mesh material={mats.mechaBody} castShadow position={[0, -0.37, 0]}>
          <cylinderGeometry args={[0.045, 0.04, 0.06, 10]} />
        </mesh>
        <mesh material={mats.dark} castShadow position={[0, -0.42, 0]}>
          <boxGeometry args={[0.07, 0.04, 0.06]} />
        </mesh>
      </group>
      <group ref={armRRef} position={[0.3, 0.72, 0]} rotation={[0.1, 0, 0]}>
        <mesh material={mats.shirt} castShadow position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.32, 10]} />
        </mesh>
        <mesh material={mats.dark} castShadow position={[0, -0.33, 0]}>
          <cylinderGeometry args={[0.062, 0.062, 0.04, 10]} />
        </mesh>
        <mesh material={mats.mechaBody} castShadow position={[0, -0.37, 0]}>
          <cylinderGeometry args={[0.045, 0.04, 0.06, 10]} />
        </mesh>
        <mesh material={mats.dark} castShadow position={[0, -0.42, 0]}>
          <boxGeometry args={[0.07, 0.04, 0.06]} />
        </mesh>
      </group>

      {/* ============ LEGS (standing) ============ */}
      {/* Two vertical legs going from hip to floor */}
      <mesh material={mats.mechaBody} castShadow position={[-0.13, 0.15, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.45, 10]} />
      </mesh>
      <mesh material={mats.mechaBody} castShadow position={[0.13, 0.15, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.45, 10]} />
      </mesh>
      {/* Knee joints */}
      <mesh material={mats.dark} position={[-0.13, 0.15, 0.06]}>
        <sphereGeometry args={[0.05, 10, 10]} />
      </mesh>
      <mesh material={mats.dark} position={[0.13, 0.15, 0.06]}>
        <sphereGeometry args={[0.05, 10, 10]} />
      </mesh>
      {/* Feet — flat boxes on the floor */}
      <mesh material={mats.dark} castShadow position={[-0.13, -0.08, 0.05]}>
        <boxGeometry args={[0.12, 0.06, 0.2]} />
      </mesh>
      <mesh material={mats.dark} castShadow position={[0.13, -0.08, 0.05]}>
        <boxGeometry args={[0.12, 0.06, 0.2]} />
      </mesh>

      {/* ============ TAIL (curled chameleon tail, behind) ============ */}
      {tailSegments.map((seg, i) => (
        <mesh
          key={i}
          material={mats.mechaBody}
          castShadow
          position={seg.pos}
        >
          <sphereGeometry args={[seg.size, 12, 12]} />
        </mesh>
      ))}
      <mesh material={mats.screen} position={[0.05, -0.32, -0.2]}>
        <sphereGeometry args={[0.022, 12, 12]} />
      </mesh>

      {/* ============ BAT WINGS (folded on back) ============ */}
      <group position={[0, 0.58, -0.18]}>
        <mesh
          material={mats.wing}
          castShadow
          position={[-0.1, 0.05, 0]}
          rotation={[0, -0.5, 0.4]}
        >
          <boxGeometry args={[0.02, 0.25, 0.22]} />
        </mesh>
        <mesh
          material={mats.wing}
          castShadow
          position={[0.1, 0.05, 0]}
          rotation={[0, 0.5, -0.4]}
        >
          <boxGeometry args={[0.02, 0.25, 0.22]} />
        </mesh>
      </group>

      {/* ============ FLOATING NAME TAG (HTML, always faces camera) ============ */}
      <Html
        center
        distanceFactor={10}
        position={[0, isBoss ? 2.1 : 1.6, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            padding: "3px 10px",
            borderRadius: 8,
            fontSize: isBoss ? 14 : 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
            transform: "translateY(-50%)",
            background: isBoss ? agent.color : "rgba(15, 23, 42, 0.85)",
            color: isBoss ? "#0b1120" : "#e2e8f0",
            border: `1px solid ${agent.color}`,
            boxShadow: isBoss
              ? `0 0 20px ${agent.color}`
              : `0 0 8px ${agent.color}55`,
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
            letterSpacing: 0.2,
          }}
        >
          {agent.emoji} {agent.name}
        </div>
      </Html>
    </group>
  );
}

export default CommandBot;
