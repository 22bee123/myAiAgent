// ===========================================================================
// components/Bot.tsx
// ---------------------------------------------------------------------------
// "Mecha Chameleon Bat" — an anthropomorphic bot that sits in the office
// chair and works at the desk. Combines three visual influences:
//
//   🦎 Chameleon  — large independently-swiveling turret eyes, curled
//                   prehensile tail behind the chair, sticky paddle feet.
//   🦇 Bat        — pointed ears on top of the head, small folded bat
//                   wings on the back (subtle, mostly hidden behind the
//                   office shirt).
//   🤖 Mecha      — metallic plating in the agent's color, dark mechanical
//                   joints at the elbows/knees, glowing antenna tip and
//                   chest indicator.
//
// Plus an office uniform: white button-up shirt with a collar, a colored
// necktie in the agent's color, button row down the front, and a chest
// pocket on the left.
//
// Animation (all driven by useFrame):
//   - constant gentle bobbing (sin wave on Y)
//   - subtle head tilt
//   - independent slow eye swivel (classic chameleon "scanning" behavior)
//   - arms swing up/down to fake a typing motion on the desk keyboard
//
// Interaction (R3F's built-in raycasting — no manual raycaster):
//   - onPointerOver / onPointerOut  → toggle emissive glow on the mecha body
//   - onClick                       → call `onSelect` prop
//
// ----- How to swap primitives for a custom .glb model -----
// If `agent.model` is set (e.g. "/models/chameleon.glb"), uncomment the
// useGLTF branch below and place your model file in /public/models/. drei's
// <useGLTF> will load, cache, and play any embedded animations automatically.
//
//   import { useGLTF } from "@react-three/drei";
//
//   const { scene, animations } = useGLTF(agent.model!) as any;
//   const mixer = useRef<THREE.AnimationMixer>();
//   useFrame((_, dt) => mixer.current?.update(dt));
//   useEffect(() => {
//     mixer.current = new THREE.AnimationMixer(scene);
//     const clip = animations[0];
//     if (clip) mixer.current.clipAction(clip).play();
//   }, [scene, animations]);
//
//   return <primitive object={scene} position={position} />;
// ===========================================================================

"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { AgentConfig } from "@/lib/agents";

// ---------------------------------------------------------------------------
// Seated-pose constants.
//
// `agent.position` in lib/agents.ts is the DESK position (the workstation).
// The bot actually sits in the CHAIR, which is z+0.6 in front of the desk
// (this offset must match the chair placement in Office.tsx).
//
// The bot is rotated 180° around Y so it faces -Z (toward the monitor, which
// is at the back of the desk). After this rotation, the bot's local +Z axis
// points toward the monitor, so all "front" features (snout, eyes, tie,
// buttons) are placed at local +Z.
//
// SITTING_Y is the bot's group Y position when seated. Lower than a standing
// height so the bot's hips rest on the chair seat (top at y≈0.48).
// ---------------------------------------------------------------------------
const CHAIR_Z_OFFSET = 0.6;
const SITTING_Y = 0.6;

// Resting forward tilt of the arms. The arms reach forward toward the
// keyboard on the desk. -1.0 rad ≈ -57°, which puts the hands near the
// keyboard surface in front of the bot.
const ARM_RESTING_TILT = -1.0;

interface BotProps {
  agent: AgentConfig;
  /** Called when the user left-clicks the bot. */
  onSelect: (id: string) => void;
  /** Called when the user's pointer enters/leaves the bot's bounding region. */
  onHover: (id: string | null) => void;
}

export function Bot({ agent, onSelect, onHover }: BotProps) {
  // groupRef is the whole bot — we bob the entire group up & down.
  const groupRef = useRef<THREE.Group>(null);
  // armLRef / armRRef — arm groups that pivot at the shoulder for typing.
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  // headRef — head group for the subtle tilt animation.
  const headRef = useRef<THREE.Group>(null);
  // eyeLRef / eyeRRef — eye groups that swivel independently (chameleon).
  const eyeLRef = useRef<THREE.Group>(null);
  const eyeRRef = useRef<THREE.Group>(null);

  // Each bot gets a small random phase offset so they don't all bob in sync.
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const [hovered, setHovered] = useState(false);

  // Memoize materials so we don't leak GPU memory on every render.
  // `mechaBody` is the only one whose emissive changes (hover / select glow).
  const mats = useMemo(() => {
    const agentColor = new THREE.Color(agent.color);
    return {
      // Mecha body parts — metallic, in the agent's color.
      mechaBody: new THREE.MeshStandardMaterial({
        color: agentColor,
        emissive: agentColor,
        emissiveIntensity: 0.15,
        roughness: 0.35,
        metalness: 0.7,
      }),
      // Office shirt — white, slightly rough cotton.
      shirt: new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        roughness: 0.85,
        metalness: 0.0,
      }),
      // Dark mechanical parts — joints, hands, feet, ears, neck.
      dark: new THREE.MeshStandardMaterial({
        color: "#1f2937",
        roughness: 0.5,
        metalness: 0.4,
      }),
      // Tie — agent color, slightly glossy.
      tie: new THREE.MeshStandardMaterial({
        color: agentColor,
        emissive: agentColor,
        emissiveIntensity: 0.1,
        roughness: 0.3,
        metalness: 0.2,
      }),
      // Eye sclera — cream colored (chameleon eyes are often yellowish).
      eye: new THREE.MeshStandardMaterial({
        color: "#fef3c7",
        roughness: 0.4,
        metalness: 0.1,
      }),
      // Pupil — dark with emissive agent-color center (glowing mecha eye).
      pupil: new THREE.MeshStandardMaterial({
        color: "#020617",
        emissive: agentColor,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      }),
      // Bat wings — dark membrane with subtle agent-color glow at the edges.
      wing: new THREE.MeshStandardMaterial({
        color: "#1e1b4b",
        emissive: agentColor,
        emissiveIntensity: 0.08,
        roughness: 0.6,
        metalness: 0.2,
      }),
      // Emissive accent material — antenna tip, tail tip, chest indicator.
      screen: new THREE.MeshStandardMaterial({
        color: agentColor,
        emissive: agentColor,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      }),
    };
  }, [agent.color]);

  // ---- Per-frame animation loop -------------------------------------------
  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    if (groupRef.current) {
      // Idle bobbing — about 4cm amplitude, slow. Y baseline is SITTING_Y
      // so the bot stays in the chair while it bobs.
      groupRef.current.position.y =
        agent.position[1] + SITTING_Y + Math.sin(t * 1.5) * 0.04;
      // Keep Z locked to the chair position (z+0.6 from the desk).
      groupRef.current.position.z = agent.position[2] + CHAIR_Z_OFFSET;
    }
    // Subtle head tilt — adds "alive" feel without being distracting.
    if (headRef.current) {
      headRef.current.rotation.z = Math.sin(t * 0.7) * 0.08;
    }
    // Typing motion — arms swing up/down quickly, slightly out of phase.
    const typingL = Math.sin(t * 6) * 0.18;
    const typingR = Math.sin(t * 6 + 0.4) * 0.18;
    if (armLRef.current) armLRef.current.rotation.x = ARM_RESTING_TILT + typingL;
    if (armRRef.current) armRRef.current.rotation.x = ARM_RESTING_TILT + typingR;

    // Chameleon eyes — independent slow swivel. Each eye scans a different
    // direction at a different phase, classic chameleon behavior.
    if (eyeLRef.current) {
      eyeLRef.current.rotation.y = Math.sin(t * 0.5) * 0.7;
    }
    if (eyeRRef.current) {
      eyeRRef.current.rotation.y = Math.sin(t * 0.5 + 1.7) * 0.7;
    }

    // Smooth emissive glow toward target based on hover state.
    // Mutating a memoized material's property inside useFrame is the standard
    // R3F pattern for cheap per-frame effects.
    const target = hovered ? 0.6 : 0.15;
    // eslint-disable-next-line react-hooks/immutability
    mats.mechaBody.emissiveIntensity = THREE.MathUtils.lerp(
      mats.mechaBody.emissiveIntensity,
      target,
      0.15
    );
  });

  // ---- Pointer handlers (same as before) ----------------------------------
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    onHover(agent.id);
    document.body.style.cursor = "pointer";
  };
  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    onHover(null);
    document.body.style.cursor = "default";
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(agent.id);
  };

  // ---- Tail curve — precompute once so it's stable across renders --------
  // A chameleon's tail curls into a tight spiral. We approximate it with a
  // series of small spheres along a shrinking spiral, ending with an
  // emissive tip. The tail sits behind the bot (local -Z, between the bot
  // and the chair back).
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
      // Initial seated position: x = desk x, y = seated height, z = chair
      // (desk z + 0.6). The useFrame loop keeps y and z locked to these
      // values; x is set once here.
      position={[
        agent.position[0],
        agent.position[1] + SITTING_Y,
        agent.position[2] + CHAIR_Z_OFFSET,
      ]}
      // Rotate 180° around Y so the bot faces -Z (toward the monitor on
      // the back of the desk). After this rotation, local +Z = world -Z =
      // toward the monitor, so all "front" features (snout, eyes, tie,
      // buttons) go at local +Z.
      rotation={[0, Math.PI, 0]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {/* ============ HEAD GROUP (chameleon + bat) ============ */}
      <group ref={headRef} position={[0, 0.55, 0]}>
        {/* Main head: rounded box, mecha chameleon style */}
        <mesh material={mats.mechaBody} castShadow>
          <boxGeometry args={[0.36, 0.32, 0.36]} />
        </mesh>
        {/* Snout: small box extending forward (local +Z = toward monitor) */}
        <mesh material={mats.mechaBody} castShadow position={[0, -0.02, 0.22]}>
          <boxGeometry args={[0.18, 0.14, 0.12]} />
        </mesh>

        {/* Turret eyes — large spheres on the sides, swivel independently.
            Classic chameleon feature: bulging eye turrets that rotate. */}
        <group ref={eyeLRef} position={[-0.2, 0.08, 0.05]}>
          <mesh material={mats.eye} castShadow>
            <sphereGeometry args={[0.11, 16, 16]} />
          </mesh>
          {/* Pupil — looking forward (local +Z) */}
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

        {/* Bat ears — two cones on top, pointing up-back (local -Z) */}
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

        {/* Antenna with glowing tip — mecha feature, pointing up-forward */}
        <mesh
          material={mats.dark}
          position={[0, 0.3, 0.06]}
          rotation={[0.3, 0, 0]}
        >
          <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
        </mesh>
        <mesh material={mats.screen} position={[0, 0.4, 0.11]}>
          <sphereGeometry args={[0.03, 12, 12]} />
        </mesh>
      </group>

      {/* ============ NECK (dark mechanical) ============ */}
      <mesh material={mats.dark} position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.1, 8]} />
      </mesh>

      {/* ============ TORSO (office shirt) ============ */}
      {/* Main shirt body */}
      <mesh material={mats.shirt} castShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[0.52, 0.55, 0.36]} />
      </mesh>
      {/* Shirt collar — two angled boxes forming a V at the front (local +Z) */}
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
      {/* Tie knot — small box at top of tie */}
      <mesh material={mats.tie} castShadow position={[0, 0.36, 0.19]}>
        <boxGeometry args={[0.08, 0.06, 0.03]} />
      </mesh>
      {/* Tie — vertical thin box in agent color, hangs down the front */}
      <mesh material={mats.tie} castShadow position={[0, 0.18, 0.19]}>
        <boxGeometry args={[0.06, 0.3, 0.02]} />
      </mesh>
      {/* Buttons — small spheres down the front (slightly offset from tie) */}
      {[0.05, 0.13, 0.21, 0.29].map((y, i) => (
        <mesh key={i} material={mats.dark} position={[0.08, y, 0.19]}>
          <sphereGeometry args={[0.012, 8, 8]} />
        </mesh>
      ))}
      {/* Chest pocket — small flat box on left chest */}
      <mesh material={mats.shirt} position={[-0.15, 0.22, 0.19]}>
        <boxGeometry args={[0.08, 0.08, 0.01]} />
      </mesh>

      {/* ============ ARMS (mechanical with shirt sleeves, reaching to keyboard) ============ */}
      {/* Each arm is a single group pivoting at the shoulder. The group is
          tilted forward (ARM_RESTING_TILT) so the sleeve + cuff + forearm +
          hand all reach forward toward the keyboard. The useFrame loop adds
          a small ±0.18 rad typing swing on top of this resting tilt. */}
      <group ref={armLRef} position={[-0.3, 0.32, 0]} rotation={[ARM_RESTING_TILT, 0, 0]}>
        {/* Upper arm sleeve — white shirt */}
        <mesh material={mats.shirt} castShadow position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.32, 10]} />
        </mesh>
        {/* Cuff — dark band at end of sleeve */}
        <mesh material={mats.dark} castShadow position={[0, -0.33, 0]}>
          <cylinderGeometry args={[0.062, 0.062, 0.04, 10]} />
        </mesh>
        {/* Forearm — mecha color, extending past the cuff */}
        <mesh material={mats.mechaBody} castShadow position={[0, -0.37, 0]}>
          <cylinderGeometry args={[0.045, 0.04, 0.06, 10]} />
        </mesh>
        {/* Hand — small dark box (chameleon "mitten" hand) */}
        <mesh material={mats.dark} castShadow position={[0, -0.42, 0]}>
          <boxGeometry args={[0.07, 0.04, 0.06]} />
        </mesh>
      </group>
      <group ref={armRRef} position={[0.3, 0.32, 0]} rotation={[ARM_RESTING_TILT, 0, 0]}>
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

      {/* ============ LEGS (seated pose) ============ */}
      {/* Thighs — short horizontal cylinders going forward (toward desk).
          Visible just below the shirt hem, resting on the chair seat. */}
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
      {/* Lower legs — vertical, going from knee down to the floor */}
      <mesh material={mats.mechaBody} castShadow position={[-0.13, -0.32, 0.22]}>
        <cylinderGeometry args={[0.05, 0.04, 0.5, 10]} />
      </mesh>
      <mesh material={mats.mechaBody} castShadow position={[0.13, -0.32, 0.22]}>
        <cylinderGeometry args={[0.05, 0.04, 0.5, 10]} />
      </mesh>
      {/* Chameleon feet — flat sticky paddle feet on the floor */}
      <mesh material={mats.dark} castShadow position={[-0.13, -0.58, 0.24]}>
        <boxGeometry args={[0.1, 0.04, 0.16]} />
      </mesh>
      <mesh material={mats.dark} castShadow position={[0.13, -0.58, 0.24]}>
        <boxGeometry args={[0.1, 0.04, 0.16]} />
      </mesh>

      {/* ============ TAIL (curled chameleon tail, behind the bot) ============ */}
      {/* Spiral of small spheres shrinking toward the tip. Sits at local -Z
          (between the bot's back and the chair back). */}
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
      {/* Tail tip — small emissive ball at the end of the spiral */}
      <mesh material={mats.screen} position={[0.05, -0.32, -0.2]}>
        <sphereGeometry args={[0.022, 12, 12]} />
      </mesh>

      {/* ============ BAT WINGS (folded on back, local -Z) ============ */}
      {/* Small folded bat wings visible behind the shoulders. Subtle so they
          don't overwhelm the office-shirt look. */}
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

      {/* ============ NAME TAG BAR (visual anchor for floating label) ============ */}
      {/* Small colored plate above the head — gives the HTML <Html> name tag
          a visual anchor in the 3D scene. */}
      <mesh position={[0, 1.3, 0]} material={mats.mechaBody}>
        <boxGeometry args={[0.55, 0.12, 0.02]} />
      </mesh>
    </group>
  );
}

export default Bot;
