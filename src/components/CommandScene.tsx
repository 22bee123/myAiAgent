// ===========================================================================
// components/CommandScene.tsx
// ---------------------------------------------------------------------------
// 3D Scene for the Tech Startup Office AI Agent Command Center.
//
// Composition:
//   - <OfficeEnvironment />  ← 3D architectural shell, glass Boss office,
//                               5 pods, central lounge, server rack & decor
//   - <WorkstationDesk />    ← 11 desks, ergonomic chairs, dual/triple screens,
//                               clutter, CPU towers, trash bins
//   - <CommandBot />          ← 11 bots seated in working poses
//   - <Connectors />          ← Hierarchy conduits Boss → Masters → Subs
//   - <SlackPresenceTags />   ← Minimal Slack-style presence tags attached
//                               above monitor screens
// ===========================================================================

"use client";

import { Suspense } from "react";
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
  ALL_AGENTS,
  type CommandAgent,
} from "@/lib/commandAgents";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";
import { CommandBot } from "@/components/CommandBot";
import { WorkstationDesk } from "@/components/WorkstationDesk";
import { OfficeEnvironment } from "@/components/OfficeEnvironment";

// ---- Connector lines: Boss → Masters, Master → Sub -----------------------
function Connectors() {
  // Lines from Boss to each Master (5 conduits fanning out from glass office)
  const bossToMasterLines = MASTER_AGENTS.map((master) => ({
    color: master.color,
    points: [
      [BOSS.position[0], 1.2, BOSS.position[2]] as [number, number, number],
      [master.position[0], 0.8, master.position[2]] as [number, number, number],
    ],
  }));

  // Lines from each Master to its Sub
  const masterToSubLines = MASTER_AGENTS.map((master, i) => {
    const sub = SUB_AGENTS[i];
    return {
      color: master.color,
      points: [
        [master.position[0], 0.8, master.position[2]] as [number, number, number],
        [sub.position[0], 0.8, sub.position[2]] as [number, number, number],
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
          lineWidth={2.2}
          transparent
          opacity={0.45}
        />
      ))}
      {masterToSubLines.map((line, i) => (
        <Line
          key={`ms-${i}`}
          points={line.points}
          color={line.color}
          lineWidth={2.2}
          transparent
          opacity={0.45}
        />
      ))}
    </group>
  );
}

// ---- Minimal Slack-style Presence Tag -----------------------------------
// Rendered subtly directly above each monitor in local workstation space.
function SlackPresenceTag({ agent }: { agent: CommandAgent }) {
  const isBoss = agent.tier === "boss";
  const openChat = useCommandCenterStore((s) => s.openChat);

  const statusText = isBoss
    ? "Active"
    : agent.poseType === "typing"
    ? "Typing..."
    : agent.poseType === "mouse_work"
    ? "Working"
    : agent.poseType === "coffee_break"
    ? "Coffee Break"
    : agent.poseType === "screen_pointing"
    ? "Reviewing"
    : "On Call";

  return (
    <group position={agent.position} rotation={[0, agent.rotationY, 0]}>
      <Html
        center
        distanceFactor={11}
        position={[0, 1.85, -0.3]} // Floating subtly above the workstation monitor
        style={{ pointerEvents: "auto" }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            openChat(isBoss ? null : (agent.channel as never));
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 8px",
            borderRadius: 6,
            background: "rgba(15, 23, 42, 0.85)",
            border: `1px solid ${agent.color}88`,
            boxShadow: `0 2px 8px rgba(0, 0, 0, 0.4), 0 0 10px ${agent.color}33`,
            color: "#f8fafc",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            fontSize: 10,
            fontWeight: 600,
            whiteSpace: "nowrap",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            userSelect: "none",
          }}
        >
          {/* Online Presence Indicator Dot */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: agent.color,
              boxShadow: `0 0 6px ${agent.color}`,
            }}
          />
          <span>{agent.emoji}</span>
          <span>{agent.name}</span>
          <span
            style={{
              fontSize: 9,
              color: "#94a3b8",
              fontWeight: 400,
              marginLeft: 2,
            }}
          >
            · {statusText}
          </span>
        </div>
      </Html>
    </group>
  );
}

// ---- Top-left header (HTML overlay pinned to scene) ----------------------
function SceneHeader() {
  return (
    <Html
      position={[-9.2, 4.3, -8.2]}
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
        🏢 AI Command Center HQ
        <div
          style={{
            fontSize: 10,
            fontWeight: 400,
            color: "#94a3b8",
            marginTop: 2,
          }}
        >
          Seated active workstations · Click any agent to inspect activity feed
        </div>
      </div>
    </Html>
  );
}

// ---- Bottom-left channels sidebar (HTML overlay) ------------------------
function SceneLegend() {
  const updateCount = useCommandCenterStore((s) => s.updates.length);
  const openChat = useCommandCenterStore((s) => s.openChat);

  return (
    <Html position={[-9.2, 0.6, 7.8]} transform>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(15, 23, 42, 0.88)",
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
          Department Pods
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

// ---- Main 3D Office Scene ------------------------------------------------
export function CommandScene() {
  const openChat = useCommandCenterStore((s) => s.openChat);

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [0, 8.5, 14.5], fov: 48 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onPointerMissed={() => openChat(null)}
    >
      <AdaptiveDpr pixelated={false} />

      {/* Modern Studio Background & Warm Atmosphere Fog */}
      <color attach="background" args={["#0f172a"]} />
      <fog attach="fog" args={["#0f172a", 24, 45]} />

      {/* ---- Lighting Setup ---- */}
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />

      {/* Boss Accent Gold Spotlight */}
      <pointLight
        position={[BOSS.position[0], 3.8, BOSS.position[2]]}
        color={BOSS.color}
        intensity={1.5}
        distance={8}
        decay={2}
      />

      {/* Department Pod Accent Lights */}
      {MASTER_AGENTS.map((a) => (
        <pointLight
          key={a.id}
          position={[a.position[0], 3.2, a.position[2]]}
          color={a.color}
          intensity={0.7}
          distance={5}
          decay={2}
        />
      ))}

      <Suspense fallback={null}>
        {/* ---- 3D Office Architectural Shell ---- */}
        <OfficeEnvironment />

        {/* ---- Workstation Furniture & Clutter ---- */}
        {ALL_AGENTS.map((agent) => (
          <WorkstationDesk key={`desk-${agent.id}`} agent={agent} />
        ))}

        {/* ---- Seated Working AI Agents ---- */}
        {ALL_AGENTS.map((agent) => (
          <CommandBot key={`bot-${agent.id}`} agent={agent} />
        ))}

        {/* ---- Slack-style Presence Tags ---- */}
        {ALL_AGENTS.map((agent) => (
          <SlackPresenceTag key={`tag-${agent.id}`} agent={agent} />
        ))}

        {/* ---- Reporting Hierarchy Conduits ---- */}
        <Connectors />

        {/* ---- Soft Contact Shadows ---- */}
        <ContactShadows
          position={[0, 0.005, 0]}
          opacity={0.35}
          scale={22}
          blur={2.5}
          far={6}
          resolution={1024}
          color="#020617"
        />

        {/* ---- HTML overlays pinned to 3D room coordinates ---- */}
        <SceneHeader />
        <SceneLegend />
      </Suspense>

      {/* ---- Interactive Camera Orbit Controls ---- */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 1.2, 0]}
      />
    </Canvas>
  );
}

export default CommandScene;
