// ===========================================================================
// components/CommandBot.tsx
// ---------------------------------------------------------------------------
// Seated Mecha Chameleon Bat character component for the 3D Command Center.
//
// All 11 bots sit in their ergonomic workstation chairs in active working
// poses:
//   - "typing"          → Both arms extended forward, active alternating typing
//   - "mouse_work"      → Left hand on keyboard, right hand micro-moving mouse
//   - "coffee_break"    → Leaning back, right arm holding coffee mug near snout
//   - "screen_pointing" → One hand on desk, right arm extended pointing at screen
//   - "headset_call"    → Wearing headset over ears, head nodding on call
//   - "boss_executive"  → Seated in executive chair with gold crown & headset
// ===========================================================================

"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CommandAgent } from "@/lib/commandAgents";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

// Seated position constants relative to the workstation local space:
// Workstation Chair is located at Z = 0.65. Bot sits at Y = 0.58 on chair seat.
const CHAIR_Z_OFFSET = 0.65;
const SITTING_Y = 0.58;

// Forward arm tilt reaching toward keyboard
const ARM_RESTING_TILT = -0.95;

interface CommandBotProps {
  agent: CommandAgent;
}

export function CommandBot({ agent }: CommandBotProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const eyeLRef = useRef<THREE.Group>(null);
  const eyeRRef = useRef<THREE.Group>(null);

  const isBoss = agent.tier === "boss";
  const scale = isBoss ? 1.25 : 1.0;
  const pose = agent.poseType ?? "typing";

  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const [hovered, setHovered] = useState(false);

  const openChat = useCommandCenterStore((s) => s.openChat);

  // ---- Materials ---------------------------------------------------------
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
      crown: new THREE.MeshStandardMaterial({
        color: "#fbbf24",
        emissive: "#fbbf24",
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.9,
      }),
      mug: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }),
      coffee: new THREE.MeshStandardMaterial({ color: "#451a03", roughness: 0.3 }),
      headset: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.3,
        metalness: 0.8,
      }),
    };
  }, [agent.color, isBoss]);

  // ---- Per-frame animation driven by Pose --------------------------------
  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;

    // Seated breathing bobbing
    if (groupRef.current) {
      const bob = Math.sin(t * 1.5) * 0.025;
      groupRef.current.position.y = SITTING_Y + bob;
    }

    // Head animation
    if (headRef.current) {
      if (pose === "headset_call") {
        // Gentle rhythmic head nod on call
        headRef.current.rotation.x = Math.sin(t * 3) * 0.06;
        headRef.current.rotation.y = Math.sin(t * 1.2) * 0.1;
      } else {
        headRef.current.rotation.z = Math.sin(t * 0.7) * 0.06;
        headRef.current.rotation.y = Math.sin(t * 0.4) * 0.08;
      }
    }

    // Chameleon eyes swivel
    if (eyeLRef.current) eyeLRef.current.rotation.y = Math.sin(t * 0.5) * 0.6;
    if (eyeRRef.current) eyeRRef.current.rotation.y = Math.sin(t * 0.5 + 1.7) * 0.6;

    // Arm animations per pose type
    if (armLRef.current && armRRef.current) {
      if (pose === "typing" || pose === "boss_executive") {
        // Fast alternating typing swing
        const typeL = Math.sin(t * 7) * 0.14;
        const typeR = Math.sin(t * 7 + 0.4) * 0.14;
        armLRef.current.rotation.x = ARM_RESTING_TILT + typeL;
        armRRef.current.rotation.x = ARM_RESTING_TILT + typeR;
      } else if (pose === "mouse_work") {
        // Left hand typing, Right hand micro-moving mouse
        const typeL = Math.sin(t * 5) * 0.1;
        const mouseR = Math.sin(t * 4) * 0.05;
        armLRef.current.rotation.x = ARM_RESTING_TILT + typeL;
        armRRef.current.rotation.x = ARM_RESTING_TILT + 0.1;
        armRRef.current.rotation.z = -0.1 + mouseR;
      } else if (pose === "coffee_break") {
        // Left hand on desk, Right hand raising coffee mug near snout
        armLRef.current.rotation.x = ARM_RESTING_TILT;
        armRRef.current.rotation.x = -1.8 + Math.sin(t * 1.5) * 0.08;
        armRRef.current.rotation.y = -0.4;
      } else if (pose === "screen_pointing") {
        // Left hand typing, Right hand extended pointing up at screen
        armLRef.current.rotation.x = ARM_RESTING_TILT + Math.sin(t * 6) * 0.1;
        armRRef.current.rotation.x = -0.4 + Math.sin(t * 2) * 0.06;
        armRRef.current.rotation.y = 0.2;
      } else if (pose === "headset_call") {
        // Left arm touching headset ear, Right hand on desk
        armLRef.current.rotation.x = -1.9;
        armLRef.current.rotation.y = 0.5;
        armRRef.current.rotation.x = ARM_RESTING_TILT;
      }
    }

    // Hover glow transition
    const targetIntensity = hovered ? (isBoss ? 0.7 : 0.5) : isBoss ? 0.25 : 0.15;
    // eslint-disable-next-line react-hooks/immutability
    mats.mechaBody.emissiveIntensity = THREE.MathUtils.lerp(
      mats.mechaBody.emissiveIntensity,
      targetIntensity,
      0.15
    );
  });

  // Pointer interactions
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
    openChat(isBoss ? null : (agent.channel as never));
  };

  // Precomputed chameleon tail curve
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
      position={agent.position}
      rotation={[0, agent.rotationY, 0]}
    >
      {/* Bot group is placed at local workstation chair position [0, SITTING_Y, CHAIR_Z_OFFSET]
          and rotated 180° (Math.PI) so it faces local -Z (toward the desk & screens). */}
      <group
        ref={groupRef}
        position={[0, SITTING_Y, CHAIR_Z_OFFSET]}
        rotation={[0, Math.PI, 0]}
        scale={[scale, scale, scale]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        {/* ============ HEAD GROUP ============ */}
        <group ref={headRef} position={[0, 0.55, 0]}>
          {/* Main Mecha Head Box */}
          <mesh material={mats.mechaBody} castShadow>
            <boxGeometry args={[0.36, 0.32, 0.36]} />
          </mesh>
          {/* Snout extending forward (+Z local = facing desk) */}
          <mesh material={mats.mechaBody} castShadow position={[0, -0.02, 0.22]}>
            <boxGeometry args={[0.18, 0.14, 0.12]} />
          </mesh>

          {/* Chameleon Turret Eyes */}
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

          {/* Pointed Bat Ears */}
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

          {/* Glowing Antenna Tip */}
          <mesh material={mats.dark} position={[0, 0.3, 0.06]} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
          </mesh>
          <mesh material={mats.screen} position={[0, 0.4, 0.11]}>
            <sphereGeometry args={[0.03, 12, 12]} />
          </mesh>

          {/* Headset accessory for headset_call or boss */}
          {(pose === "headset_call" || isBoss) && (
            <group position={[0, 0.1, 0]}>
              {/* Headband */}
              <mesh material={mats.headset} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.2, 0.015, 8, 16, Math.PI]} />
              </mesh>
              {/* Ear cup left */}
              <mesh material={mats.headset} position={[-0.21, 0, 0.05]}>
                <boxGeometry args={[0.04, 0.12, 0.1]} />
              </mesh>
              {/* Ear cup right */}
              <mesh material={mats.headset} position={[0.21, 0, 0.05]}>
                <boxGeometry args={[0.04, 0.12, 0.1]} />
              </mesh>
              {/* Microphone boom */}
              <mesh material={mats.headset} position={[-0.18, -0.08, 0.18]} rotation={[0.4, 0.3, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.18, 8]} />
              </mesh>
            </group>
          )}

          {/* Boss Floating Gold Crown */}
          {isBoss && (
            <group position={[0, 0.62, 0]}>
              <mesh material={mats.crown} castShadow rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.16, 0.16, 0.08, 8]} />
              </mesh>
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
            </group>
          )}
        </group>

        {/* ============ TORSO (Office Shirt + Tie) ============ */}
        <mesh material={mats.dark} position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.1, 8]} />
        </mesh>
        <mesh material={mats.shirt} castShadow position={[0, 0.15, 0]}>
          <boxGeometry args={[0.52, 0.55, 0.36]} />
        </mesh>

        {/* Collar & Tie */}
        <mesh
          material={mats.shirt}
          castShadow
          position={[-0.07, 0.4, 0.1]}
          rotation={[0.4, 0, -0.3]}
        >
          <boxGeometry args={[0.1, 0.04, 0.16]} />
        </mesh>
        <mesh
          material={mats.shirt}
          castShadow
          position={[0.07, 0.4, 0.1]}
          rotation={[0.4, 0, 0.3]}
        >
          <boxGeometry args={[0.1, 0.04, 0.16]} />
        </mesh>
        <mesh material={mats.tie} castShadow position={[0, 0.36, 0.19]}>
          <boxGeometry args={[0.08, 0.06, 0.03]} />
        </mesh>
        <mesh material={mats.tie} castShadow position={[0, 0.18, 0.19]}>
          <boxGeometry args={[0.06, 0.3, 0.02]} />
        </mesh>

        {/* ============ ARMS (Posed per PoseType) ============ */}
        <group ref={armLRef} position={[-0.3, 0.32, 0]}>
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

        <group ref={armRRef} position={[0.3, 0.32, 0]}>
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

          {/* Coffee Mug in Right Hand for coffee_break pose */}
          {pose === "coffee_break" && (
            <group position={[0, -0.44, 0.08]}>
              <mesh material={mats.mug} castShadow>
                <cylinderGeometry args={[0.04, 0.035, 0.08, 12]} />
              </mesh>
              <mesh material={mats.coffee} position={[0, 0.035, 0]}>
                <cylinderGeometry args={[0.034, 0.034, 0.005, 12]} />
              </mesh>
            </group>
          )}
        </group>

        {/* ============ SEATED LEGS ============ */}
        {/* Thighs extended horizontally forward resting on chair */}
        <mesh
          material={mats.mechaBody}
          castShadow
          position={[-0.13, -0.05, 0.12]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.06, 0.06, 0.22, 10]} />
        </mesh>
        <mesh
          material={mats.mechaBody}
          castShadow
          position={[0.13, -0.05, 0.12]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.06, 0.06, 0.22, 10]} />
        </mesh>
        {/* Lower Legs going down to floor */}
        <mesh material={mats.mechaBody} castShadow position={[-0.13, -0.32, 0.22]}>
          <cylinderGeometry args={[0.05, 0.04, 0.5, 10]} />
        </mesh>
        <mesh material={mats.mechaBody} castShadow position={[0.13, -0.32, 0.22]}>
          <cylinderGeometry args={[0.05, 0.04, 0.5, 10]} />
        </mesh>
        {/* Chameleon Sticky Paddle Feet flat on floor */}
        <mesh material={mats.dark} castShadow position={[-0.13, -0.58, 0.24]}>
          <boxGeometry args={[0.1, 0.04, 0.16]} />
        </mesh>
        <mesh material={mats.dark} castShadow position={[0.13, -0.58, 0.24]}>
          <boxGeometry args={[0.1, 0.04, 0.16]} />
        </mesh>

        {/* ============ CURLED CHAMELEON TAIL ============ */}
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

        {/* ============ FOLDED BAT WINGS ============ */}
        <group position={[0, 0.18, -0.18]}>
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
      </group>
    </group>
  );
}

export default CommandBot;
