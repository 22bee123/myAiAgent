// ===========================================================================
// components/CommandCenter.tsx
// ---------------------------------------------------------------------------
// Top-level wrapper for the 3D Command Center.
//
// Composition:
//   <main>
//     <CommandScene />      ← 3D canvas with 11 bots in hierarchy + connectors
//     <BossChatBox />       ← HTML modal that opens when you click any bot
//   </main>
//
// The background activity loop runs here (not inside CommandScene) so it
// keeps running even when the canvas is unmounted (e.g. during hot reload).
// Each agent posts updates to the Zustand store on its own schedule.
//
// Clicking any bot opens the BossChatBox modal — Boss opens the unified
// feed (all channels), any other bot opens the feed filtered to its channel.
// ===========================================================================

"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  MASTER_AGENTS,
  SUB_AGENTS,
  CHANNELS,
} from "@/lib/commandAgents";
import {
  generateMockUpdate,
  generateRealEmailUpdate,
  buildUpdate,
} from "@/lib/activityGenerator";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

// Lazy-load the 3D scene (Three.js is heavy and needs the browser)
const CommandScene = dynamic(
  () => import("@/components/CommandScene").then((m) => m.CommandScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          <p className="text-sm">Booting the command center…</p>
        </div>
      </div>
    ),
  }
);

// Lazy-load the chatbox too (framer-motion + store)
const BossChatBox = dynamic(
  () => import("@/components/BossChatBox").then((m) => m.BossChatBox),
  { ssr: false }
);

export function CommandCenter() {
  const pushUpdate = useCommandCenterStore((s) => s.pushUpdate);

  // Stable ref to pushUpdate so the background loop effect doesn't re-run
  // on every store change.
  const pushUpdateRef = useRef(pushUpdate);
  useEffect(() => {
    pushUpdateRef.current = pushUpdate;
  }, [pushUpdate]);

  // ---- Background activity loop ----
  // One timer chain per agent (10 total: 5 masters + 5 subs). Boss doesn't
  // auto-post. Each agent posts on its own schedule with ±20% jitter.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedulePost = (
      agentId: string,
      channel: (typeof CHANNELS)[number],
      tier: "master" | "sub",
      baseInterval: number
    ) => {
      const tick = async () => {
        let text: string | null = null;
        let severity: "info" | "warning" | "success" = "info";

        if (agentId === "email-sub") {
          // Real email check — only posts if there's something to report
          const real = await generateRealEmailUpdate();
          if (real) {
            text = real.text;
            severity = real.severity;
          }
        } else {
          // Mocked generator
          const mock = generateMockUpdate(channel, tier);
          text = mock.text;
          severity = mock.severity ?? "info";
        }

        if (text) {
          pushUpdateRef.current(
            buildUpdate(agentId, channel, text, severity)
          );
        }

        // Schedule next tick with jitter
        const jitter = baseInterval * (0.8 + Math.random() * 0.4);
        timers.push(setTimeout(tick, jitter));
      };

      // Stagger the first post — masters fire first, then subs
      const initialDelay =
        tier === "master"
          ? 1500 + Math.random() * 3000
          : 4000 + Math.random() * 4000;
      timers.push(setTimeout(tick, initialDelay));
    };

    MASTER_AGENTS.forEach((agent) => {
      schedulePost(agent.id, agent.channel as never, "master", agent.postInterval);
    });
    SUB_AGENTS.forEach((agent) => {
      schedulePost(agent.id, agent.channel as never, "sub", agent.postInterval);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950">
      {/* 3D scene fills the whole viewport */}
      <CommandScene />

      {/* The unified chatbox modal — renders only when chatOpen is true */}
      <BossChatBox />
    </main>
  );
}

export default CommandCenter;
