// ===========================================================================
// components/Bot.tsx
// ---------------------------------------------------------------------------
// Reusable AI-agent bot, rendered from primitive Three.js geometries:
//   - box body
//   - sphere head
//   - cylinder arms + legs (very stylized, low-poly)
//
// Animation:
//   - constant gentle bobbing (sin wave on Y)
//   - arms move up/down to simulate typing on the desk
//   - head subtle tilt
//
// Interaction (R3F's built-in raycasting — no manual raycaster):
//   - onPointerOver / onPointerOut  → toggle emissive glow + cursor
//   - onClick                       → call `onSelect` prop (sets store state)
//
// ----- How to swap primitives for a custom .glb model -----
// If `agent.model` is set (e.g. "/models/robot.glb"), uncomment the useGLTF
// branch below and place your model file in /public/models/. drei's <useGLTF>
// will load, cache, and play any embedded animations automatically.
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
  // armRef is just the arms — we rotate them to fake typing.
  const armLRef = useRef<THREE.Mesh>(null);
  const armRRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);

  // Each bot gets a small random phase offset so they don't all bob in sync.
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const [hovered, setHovered] = useState(false);

  // Memoize materials so we don't leak GPU memory on every render.
  // `bodyMat` is the only one whose emissive changes (hover / select glow).
  const { bodyMat, headMat, limbMat, eyeMat, screenMat } = useMemo(() => {
    const baseColor = new THREE.Color(agent.color);
    return {
      bodyMat: new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.15,
        roughness: 0.4,
        metalness: 0.3,
      }),
      headMat: new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        roughness: 0.5,
        metalness: 0.1,
      }),
      limbMat: new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.5,
        metalness: 0.2,
      }),
      eyeMat: new THREE.MeshStandardMaterial({
        color: "#020617",
        emissive: "#020617",
      }),
      screenMat: new THREE.MeshStandardMaterial({
        color: agent.color,
        emissive: agent.color,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      }),
    };
  }, [agent.color]);

  // Drive emissive intensity up on hover (cheap visual highlight).
  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    if (groupRef.current) {
      // Idle bobbing — about 4cm amplitude, slow.
      groupRef.current.position.y = agent.position[1] + 0.78 + Math.sin(t * 1.5) * 0.04;
      // Subtle head tilt — adds "alive" feel without being distracting.
      if (headRef.current) {
        headRef.current.rotation.z = Math.sin(t * 0.7) * 0.08;
      }
    }
    // Typing motion — arms swing up/down quickly, slightly out of phase.
    const typingL = Math.sin(t * 6) * 0.25;
    const typingR = Math.sin(t * 6 + 0.4) * 0.25;
    if (armLRef.current) armLRef.current.rotation.x = 0.2 + typingL;
    if (armRRef.current) armRRef.current.rotation.x = 0.2 + typingR;

    // Smooth emissive glow toward target based on hover state.
    // Mutating a memoized material's property inside useFrame is the standard
    // R3F pattern for cheap per-frame effects — the linter's
    // react-hooks/immutability rule would otherwise flag it as a hook-value
    // mutation, which it isn't (we own this object via useMemo).
    const target = hovered ? 0.6 : 0.15;
    // eslint-disable-next-line react-hooks/immutability
    bodyMat.emissiveIntensity = THREE.MathUtils.lerp(
      bodyMat.emissiveIntensity,
      target,
      0.15
    );
  });

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

  return (
    <group
      ref={groupRef}
      position={agent.position}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {/* ---- Head (sphere) ---- */}
      <mesh ref={headRef} material={headMat} castShadow position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.22, 24, 24]} />
      </mesh>
      {/* Eyes (small dark spheres on the front of the head) */}
      <mesh material={eyeMat} position={[-0.08, 0.58, 0.18]}>
        <sphereGeometry args={[0.035, 8, 8]} />
      </mesh>
      <mesh material={eyeMat} position={[0.08, 0.58, 0.18]}>
        <sphereGeometry args={[0.035, 8, 8]} />
      </mesh>
      {/* Antenna — small emissive sphere on a thin pole */}
      <mesh material={limbMat} position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 6]} />
      </mesh>
      <mesh material={screenMat} position={[0, 1.04, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
      </mesh>

      {/* ---- Body (box) ---- */}
      <mesh material={bodyMat} castShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[0.5, 0.55, 0.35]} />
      </mesh>
      {/* Chest indicator — small emissive panel matching agent color */}
      <mesh material={screenMat} position={[0, 0.2, 0.18]}>
        <planeGeometry args={[0.16, 0.08]} />
      </mesh>

      {/* ---- Arms (cylinders) ---- */}
      <mesh
        ref={armLRef}
        material={limbMat}
        castShadow
        position={[-0.32, 0.3, 0]}
      >
        <cylinderGeometry args={[0.05, 0.05, 0.4, 10]} />
      </mesh>
      <mesh
        ref={armRRef}
        material={limbMat}
        castShadow
        position={[0.32, 0.3, 0]}
      >
        <cylinderGeometry args={[0.05, 0.05, 0.4, 10]} />
      </mesh>

      {/* ---- Legs (cylinders) ---- */}
      <mesh material={limbMat} castShadow position={[-0.13, -0.25, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 10]} />
      </mesh>
      <mesh material={limbMat} castShadow position={[0.13, -0.25, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 10]} />
      </mesh>

      {/* ---- Floating name tag (always faces the camera via billboard) ---- */}
      {/* Implemented as a tiny colored plate floating above the head; the
          actual readable text is rendered as HTML <Html> in AgentTag.tsx so
          we get crisp DOM text instead of canvas-text. Keeping the bar here
          gives the tag a visual anchor. */}
      <mesh position={[0, 1.3, 0]} material={bodyMat}>
        <boxGeometry args={[0.55, 0.12, 0.02]} />
      </mesh>
    </group>
  );
}

export default Bot;
