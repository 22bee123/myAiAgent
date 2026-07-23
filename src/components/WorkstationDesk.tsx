// ===========================================================================
// components/WorkstationDesk.tsx
// ---------------------------------------------------------------------------
// High-detail 3D workstation furniture component for the Command Center.
// Renders:
//   - Desk (Master executive / Sub task desk)
//   - Ergonomic chair (Executive high-back for Master/Boss, Task chair for Sub)
//   - Monitor rig (Triple monitor setup for Master/Boss, Dual for Sub)
//   - Rich desk clutter (Keyboard, mouse pad, optical mouse, desk lamp, mug,
//     potted succulent, document stack, sticky notepad)
//   - Under-desk detail (CPU tower case, trash bin, cable management box)
//   - Desk nameplate / channel sticker
//   - Activity pulse monitor glow when updates arrive
// ===========================================================================

"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CommandAgent } from "@/lib/commandAgents";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

interface WorkstationDeskProps {
  agent: CommandAgent;
}

export function WorkstationDesk({ agent }: WorkstationDeskProps) {
  const isBoss = agent.tier === "boss";
  const isMaster = agent.tier === "master";

  // Check live updates for activity pulse glow
  const updates = useCommandCenterStore((s) => s.updates);
  const hasRecentUpdate = useMemo(() => {
    if (isBoss) return updates.length > 0;
    const latest = updates[0];
    return latest?.channel === agent.channel;
  }, [updates, isBoss, agent.channel]);

  // Pulse animation ref for monitor screen emissive
  const screenMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (screenMatRef.current) {
      const baseIntensity = isBoss ? 0.75 : 0.55;
      if (hasRecentUpdate) {
        // Subtle pulse wave when active update is live
        const pulse = Math.sin(state.clock.elapsedTime * 8) * 0.35 + 0.35;
        screenMatRef.current.emissiveIntensity = baseIntensity + pulse;
      } else {
        screenMatRef.current.emissiveIntensity = baseIntensity;
      }
    }
  });

  // ---- Materials ---------------------------------------------------------
  const m = useMemo(() => {
    const channelColor = new THREE.Color(agent.color);
    return {
      deskTop: new THREE.MeshStandardMaterial({
        color: isBoss ? "#1e293b" : "#f1f5f9", // Dark walnut executive vs clean white laminate
        roughness: 0.4,
        metalness: 0.1,
      }),
      deskTrim: new THREE.MeshStandardMaterial({
        color: isBoss ? "#fbbf24" : agent.color,
        roughness: 0.3,
        metalness: 0.6,
      }),
      deskLegs: new THREE.MeshStandardMaterial({
        color: "#334155",
        roughness: 0.3,
        metalness: 0.7,
      }),
      chairLeather: new THREE.MeshStandardMaterial({
        color: isBoss ? "#0f172a" : isMaster ? "#1e293b" : "#334155",
        roughness: 0.7,
        metalness: 0.1,
      }),
      chairFrame: new THREE.MeshStandardMaterial({
        color: "#64748b",
        roughness: 0.3,
        metalness: 0.8,
      }),
      monitorFrame: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.4,
        metalness: 0.6,
      }),
      monitorScreen: new THREE.MeshStandardMaterial({
        color: channelColor,
        emissive: channelColor,
        emissiveIntensity: isBoss ? 0.75 : 0.55,
        roughness: 0.2,
      }),
      screenCode: new THREE.MeshStandardMaterial({
        color: "#38bdf8",
        emissive: "#38bdf8",
        emissiveIntensity: 0.4,
        roughness: 0.2,
      }),
      keyboardBase: new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.5,
        metalness: 0.4,
      }),
      keycaps: new THREE.MeshStandardMaterial({
        color: "#e2e8f0",
        roughness: 0.6,
      }),
      mousePad: new THREE.MeshStandardMaterial({
        color: agent.color,
        roughness: 0.9,
      }),
      mouseBody: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.3,
        metalness: 0.5,
      }),
      lampMetal: new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.3,
        metalness: 0.8,
      }),
      lampLight: new THREE.MeshStandardMaterial({
        color: "#fef08a",
        emissive: "#fef08a",
        emissiveIntensity: 0.9,
      }),
      mugBody: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.4,
      }),
      mugCoffee: new THREE.MeshStandardMaterial({
        color: "#451a03",
        roughness: 0.3,
      }),
      potCeramic: new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        roughness: 0.6,
      }),
      plantLeaf: new THREE.MeshStandardMaterial({
        color: "#15803d",
        roughness: 0.7,
      }),
      paper: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.9,
      }),
      stickyNote: new THREE.MeshStandardMaterial({
        color: "#fef08a",
        roughness: 0.9,
      }),
      cpuCase: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.4,
        metalness: 0.6,
      }),
      cpuLED: new THREE.MeshStandardMaterial({
        color: agent.color,
        emissive: agent.color,
        emissiveIntensity: 0.8,
      }),
      trashBin: new THREE.MeshStandardMaterial({
        color: "#64748b",
        roughness: 0.5,
        metalness: 0.5,
      }),
      nameplateBase: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.3,
        metalness: 0.8,
      }),
    };
  }, [agent.color, isBoss, isMaster]);

  // Dimensions
  const deskW = isBoss ? 2.4 : isMaster ? 2.0 : 1.7;
  const deskD = isBoss ? 1.0 : 0.85;

  return (
    <group position={agent.position} rotation={[0, agent.rotationY, 0]}>
      {/* ================= DESK STRUCTURE ================= */}
      {/* Desktop Main Surface */}
      <mesh material={m.deskTop} castShadow receiveShadow position={[0, 0.72, 0]}>
        <boxGeometry args={[deskW, 0.06, deskD]} />
      </mesh>
      {/* Channel Accent Front Trim Line */}
      <mesh material={m.deskTrim} position={[0, 0.72, deskD / 2 + 0.005]}>
        <boxGeometry args={[deskW, 0.06, 0.01]} />
      </mesh>

      {/* Modern T-Frame Metal Desk Legs */}
      {[-deskW / 2 + 0.12, deskW / 2 - 0.12].map((x, i) => (
        <group key={i} position={[x, 0.35, 0]}>
          {/* Vertical Leg Pillar */}
          <mesh material={m.deskLegs} castShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.06, 0.68, 0.08]} />
          </mesh>
          {/* Bottom Foot Rail */}
          <mesh material={m.deskLegs} castShadow position={[0, -0.32, 0]}>
            <boxGeometry args={[0.06, 0.04, deskD - 0.15]} />
          </mesh>
          {/* Top Support Rail under desktop */}
          <mesh material={m.deskLegs} position={[0, 0.32, 0]}>
            <boxGeometry args={[0.06, 0.04, deskD - 0.2]} />
          </mesh>
        </group>
      ))}

      {/* Rear Cable Routing Channel */}
      <mesh material={m.deskLegs} position={[0, 0.66, -deskD / 2 + 0.08]}>
        <boxGeometry args={[deskW - 0.4, 0.06, 0.1]} />
      </mesh>

      {/* ================= ERGONOMIC CHAIR ================= */}
      {/* Chair is positioned at Z = 0.65 in local space facing -Z toward desk */}
      <group position={[0, 0, 0.65]}>
        {/* Chair Seat Base */}
        <mesh material={m.chairLeather} castShadow position={[0, 0.46, 0]}>
          <boxGeometry args={[0.54, 0.08, 0.52]} />
        </mesh>
        {/* Chair Backrest */}
        <mesh material={m.chairLeather} castShadow position={[0, 0.82, 0.24]}>
          <boxGeometry args={[0.52, isBoss || isMaster ? 0.72 : 0.58, 0.08]} />
        </mesh>
        {/* Headrest (Boss / Master executive feature) */}
        {(isBoss || isMaster) && (
          <mesh material={m.chairLeather} castShadow position={[0, 1.24, 0.24]}>
            <boxGeometry args={[0.34, 0.16, 0.07]} />
          </mesh>
        )}
        {/* Armrests (Left & Right) */}
        {[-0.3, 0.3].map((x, i) => (
          <group key={i} position={[x, 0.6, 0.05]}>
            <mesh material={m.chairFrame} castShadow>
              <boxGeometry args={[0.04, 0.24, 0.36]} />
            </mesh>
            <mesh material={m.chairLeather} position={[0, 0.13, 0]}>
              <boxGeometry args={[0.07, 0.03, 0.34]} />
            </mesh>
          </group>
        ))}
        {/* Center Support Hydraulic Stem */}
        <mesh material={m.chairFrame} position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.4, 12]} />
        </mesh>
        {/* 5-Star Wheel Base */}
        {[0, 1, 2, 3, 4].map((i) => {
          const angle = (i / 5) * Math.PI * 2;
          return (
            <group key={i} rotation={[0, angle, 0]}>
              <mesh material={m.chairFrame} position={[0, 0.04, 0.18]}>
                <boxGeometry args={[0.04, 0.03, 0.32]} />
              </mesh>
              <mesh material={m.monitorFrame} position={[0, 0.02, 0.32]}>
                <sphereGeometry args={[0.028, 8, 8]} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ================= MONITOR SETUP ================= */}
      {/* Monitors are positioned near the rear edge of the desk facing the bot (+Z direction) */}
      <group position={[0, 0.75, -deskD / 2 + 0.18]}>
        {/* Heavy-duty Monitor Arm Stand Base */}
        <mesh material={m.lampMetal} castShadow position={[0, 0.02, 0]}>
          <boxGeometry args={[0.22, 0.04, 0.16]} />
        </mesh>
        {/* Vertical Mounting Pole */}
        <mesh material={m.lampMetal} castShadow position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.44, 12]} />
        </mesh>

        {/* Center Main Screen */}
        <group position={[0, 0.38, 0.04]}>
          {/* Bezel Frame */}
          <mesh material={m.monitorFrame} castShadow>
            <boxGeometry args={[0.96, 0.56, 0.04]} />
          </mesh>
          {/* Glowing Display Screen */}
          <mesh
            ref={screenMatRef}
            material={m.monitorScreen}
            position={[0, 0, 0.022]}
          >
            <planeGeometry args={[0.9, 0.5]} />
          </mesh>
          {/* Simulated Code Lines / Dashboard graphic overlay */}
          {[-0.15, -0.05, 0.05, 0.15].map((y, i) => (
            <mesh key={i} material={m.screenCode} position={[-0.1, y, 0.023]}>
              <planeGeometry args={[0.4 + (i % 2) * 0.2, 0.02]} />
            </mesh>
          ))}
        </group>

        {/* Triple Monitors for Master/Boss vs Dual Monitors for Sub */}
        {isBoss || isMaster ? (
          <>
            {/* Left Angled Side Screen */}
            <group position={[-0.92, 0.38, 0.16]} rotation={[0, 0.35, 0]}>
              <mesh material={m.monitorFrame} castShadow>
                <boxGeometry args={[0.82, 0.52, 0.04]} />
              </mesh>
              <mesh material={m.monitorScreen} position={[0, 0, 0.022]}>
                <planeGeometry args={[0.76, 0.46]} />
              </mesh>
            </group>
            {/* Right Angled Side Screen */}
            <group position={[0.92, 0.38, 0.16]} rotation={[0, -0.35, 0]}>
              <mesh material={m.monitorFrame} castShadow>
                <boxGeometry args={[0.82, 0.52, 0.04]} />
              </mesh>
              <mesh material={m.monitorScreen} position={[0, 0, 0.022]}>
                <planeGeometry args={[0.76, 0.46]} />
              </mesh>
            </group>
          </>
        ) : (
          /* Dual Screen setup for Sub bots */
          <group position={[0.82, 0.38, 0.12]} rotation={[0, -0.25, 0]}>
            <mesh material={m.monitorFrame} castShadow>
              <boxGeometry args={[0.82, 0.52, 0.04]} />
            </mesh>
            <mesh material={m.monitorScreen} position={[0, 0, 0.022]}>
              <planeGeometry args={[0.76, 0.46]} />
            </mesh>
          </group>
        )}
      </group>

      {/* ================= DESK CLUTTER ================= */}
      {/* Mechanical Keyboard */}
      <group position={[0, 0.76, 0.08]}>
        <mesh material={m.keyboardBase} castShadow>
          <boxGeometry args={[0.54, 0.02, 0.16]} />
        </mesh>
        <mesh material={m.keycaps} position={[0, 0.012, 0]}>
          <boxGeometry args={[0.5, 0.008, 0.13]} />
        </mesh>
      </group>

      {/* Mouse Pad & Optical Mouse */}
      <group position={[0.42, 0.755, 0.08]}>
        {/* Mouse Pad */}
        <mesh material={m.mousePad} receiveShadow>
          <boxGeometry args={[0.24, 0.005, 0.28]} />
        </mesh>
        {/* Mouse Body */}
        <mesh material={m.mouseBody} castShadow position={[0, 0.02, 0]}>
          <boxGeometry args={[0.07, 0.03, 0.11]} />
        </mesh>
      </group>

      {/* Desk Lamp (Left Corner) */}
      <group position={[-deskW / 2 + 0.18, 0.75, -deskD / 2 + 0.18]}>
        {/* Lamp Base */}
        <mesh material={m.lampMetal} castShadow>
          <cylinderGeometry args={[0.08, 0.09, 0.02, 16]} />
        </mesh>
        {/* Lower Arm */}
        <mesh
          material={m.lampMetal}
          position={[0, 0.16, 0]}
          rotation={[0.3, 0, 0]}
        >
          <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
        </mesh>
        {/* Upper Arm angled over keyboard */}
        <mesh
          material={m.lampMetal}
          position={[0, 0.32, 0.1]}
          rotation={[-0.6, 0, 0]}
        >
          <cylinderGeometry args={[0.012, 0.012, 0.26, 8]} />
        </mesh>
        {/* Shade Head */}
        <mesh
          material={m.lampMetal}
          position={[0, 0.38, 0.2]}
          rotation={[0.8, 0, 0]}
        >
          <coneGeometry args={[0.07, 0.1, 16]} />
        </mesh>
        {/* Bulb Light */}
        <mesh material={m.lampLight} position={[0, 0.36, 0.2]}>
          <sphereGeometry args={[0.03, 12, 12]} />
        </mesh>
      </group>

      {/* Ceramic Coffee Mug */}
      <group position={[-0.42, 0.75, -0.05]}>
        <mesh material={m.mugBody} castShadow position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.045, 0.04, 0.09, 16]} />
        </mesh>
        <mesh material={m.mugCoffee} position={[0, 0.085, 0]}>
          <cylinderGeometry args={[0.038, 0.038, 0.005, 16]} />
        </mesh>
        {/* Mug Handle */}
        <mesh
          material={m.mugBody}
          position={[-0.05, 0.05, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <torusGeometry args={[0.025, 0.008, 8, 16]} />
        </mesh>
      </group>

      {/* Potted Succulent Plant */}
      <group position={[deskW / 2 - 0.2, 0.75, -deskD / 2 + 0.22]}>
        <mesh material={m.potCeramic} castShadow position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.07, 0.05, 0.12, 12]} />
        </mesh>
        <mesh material={m.plantLeaf} castShadow position={[0, 0.15, 0]}>
          <dodecahedronGeometry args={[0.07, 1]} />
        </mesh>
      </group>

      {/* Document Stack & Sticky Notes */}
      <group position={[-0.5, 0.75, 0.18]} rotation={[0, 0.12, 0]}>
        <mesh material={m.paper} castShadow position={[0, 0.01, 0]}>
          <boxGeometry args={[0.22, 0.02, 0.3]} />
        </mesh>
        <mesh material={m.stickyNote} castShadow position={[0.12, 0.022, 0.05]}>
          <boxGeometry args={[0.09, 0.005, 0.09]} />
        </mesh>
      </group>

      {/* ================= UNDER-DESK DETAILS ================= */}
      {/* Metallic PC Tower Case */}
      <group position={[deskW / 2 - 0.24, 0.22, -0.05]}>
        <mesh material={m.cpuCase} castShadow>
          <boxGeometry args={[0.22, 0.42, 0.44]} />
        </mesh>
        {/* Front Panel LED Strip */}
        <mesh material={m.cpuLED} position={[0, 0, 0.225]}>
          <boxGeometry args={[0.015, 0.36, 0.005]} />
        </mesh>
      </group>

      {/* Small Under-Desk Mesh Trash Bin */}
      <group position={[-deskW / 2 + 0.22, 0.14, 0.1]}>
        <mesh material={m.trashBin} castShadow>
          <cylinderGeometry args={[0.12, 0.09, 0.28, 12]} />
        </mesh>
        {/* Crumpled paper inside */}
        <mesh material={m.paper} position={[0, 0.08, 0]}>
          <dodecahedronGeometry args={[0.06, 0]} />
        </mesh>
      </group>

      {/* ================= DESK NAMEPLATE ================= */}
      <group position={[0, 0.76, deskD / 2 - 0.04]}>
        <mesh material={m.nameplateBase} castShadow>
          <boxGeometry args={[0.42, 0.03, 0.06]} />
        </mesh>
        <mesh material={m.deskTrim} position={[0, 0.018, 0]}>
          <boxGeometry args={[0.38, 0.008, 0.04]} />
        </mesh>
      </group>
    </group>
  );
}

export default WorkstationDesk;
