// ===========================================================================
// components/CommandCenter.tsx
// ---------------------------------------------------------------------------
// The full command center layout.
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │                         ┌─────────────┐                          │
//   │                         │  👑 Me (Boss) │   ← BossCard (clickable)
//   │                         └─────────────┘                          │
//   │                                │                                 │
//   │   ┌──────┬──────┬──────┬──────┼──────┬──────┐                    │
//   │   │Email │Shopee│TikTok│Lazada│FBPage│     ← 5 master cards      │
//   │   │Master│Master│Master│Master│Master│       (clickable, opens    │
//   │   └──────┴──────┴──────┴──────┴──────┘        filtered feed)     │
//   │      │       │      │      │      │                            │
//   │   ┌──────┬──────┬──────┬──────┬──────┐                          │
//   │   │Email │Shopee│TikTok│Lazada│FBPage│   ← 5 sub cards          │
//   │   │ Sub  │ Sub  │ Sub  │ Sub  │ Sub  │     (clickable)          │
//   │   └──────┴──────┴──────┴──────┴──────┘                          │
//   └──────────────────────────────────────────────────────────────────┘
//
// Background activity loop:
//   - Each agent (master + sub) has its own setInterval based on its
//     `postInterval` (defined in commandAgents.ts).
//   - When the interval fires, we call the appropriate generator from
//     lib/activityGenerator.ts to produce a message, then pushUpdate() to
//     the store. The BossChatBox (if open) re-renders to show the new post.
//   - For the email-sub agent specifically, we use generateRealEmailUpdate()
//     which actually fetches the user's inbox — so email posts are based on
//     real data, not mocks.
// ===========================================================================

"use client";

import { useEffect, useRef } from "react";
import {
  BOSS,
  MASTER_AGENTS,
  SUB_AGENTS,
  CHANNELS,
  CHANNEL_META,
} from "@/lib/commandAgents";
import {
  generateMockUpdate,
  generateRealEmailUpdate,
  buildUpdate,
} from "@/lib/activityGenerator";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";
import { BossCard } from "@/components/BossCard";
import { AgentCard } from "@/components/AgentCard";
import { BossChatBox } from "@/components/BossChatBox";

export function CommandCenter() {
  const pushUpdate = useCommandCenterStore((s) => s.pushUpdate);

  // Keep a stable ref to pushUpdate so the background-loop effect doesn't
  // re-run on every store change. Zustand action identities are stable by
  // default, but using a ref makes this explicit and lint-clean.
  const pushUpdateRef = useRef(pushUpdate);
  useEffect(() => {
    pushUpdateRef.current = pushUpdate;
  }, [pushUpdate]);

  // ---- Background activity loop ----
  // Set up one interval per agent (10 agents total: 5 masters + 5 subs).
  // Each agent posts on its own schedule. Email-sub uses real data.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    // Schedule a single post for an agent, then schedule the next one
    // (recursive setTimeout instead of setInterval so each agent's timing
    // is independent and slightly randomized).
    const schedulePost = (
      agentId: string,
      channel: (typeof CHANNELS)[number],
      tier: "master" | "sub",
      baseInterval: number
    ) => {
      const tick = async () => {
        // Generate the update
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

        // Schedule next tick (with ±20% jitter so agents don't sync up)
        const jitter = baseInterval * (0.8 + Math.random() * 0.4);
        timers.push(setTimeout(tick, jitter));
      };

      // First post after a short initial delay (staggered by tier so the
      // initial feed has a nice mix of masters and subs, not all at once)
      const initialDelay =
        tier === "master"
          ? 1500 + Math.random() * 3000
          : 4000 + Math.random() * 4000;
      timers.push(setTimeout(tick, initialDelay));
    };

    // Schedule posts for every master + sub agent
    MASTER_AGENTS.forEach((agent) => {
      schedulePost(agent.id, agent.channel as never, "master", agent.postInterval);
    });
    SUB_AGENTS.forEach((agent) => {
      schedulePost(agent.id, agent.channel as never, "sub", agent.postInterval);
    });

    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, #fbbf2422 0%, transparent 50%), radial-gradient(circle at 20% 80%, #22d3ee15 0%, transparent 50%), radial-gradient(circle at 80% 80%, #ec489915 0%, transparent 50%)",
        }}
        aria-hidden
      />

      {/* Header */}
      <header className="relative z-10 px-6 pt-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          🏢 Command Center
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Your AI agent hierarchy — click any node to view its activity feed
        </p>
      </header>

      {/* Hierarchy diagram */}
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8">
        {/* ---- Boss row (top) ---- */}
        <div className="mb-4">
          <BossCard />
        </div>

        {/* ---- Connectors: Boss → Masters (SVG) ---- */}
        <ConnectorRow count={MASTER_AGENTS.length} color={BOSS.color} />

        {/* ---- Master agents row ---- */}
        <div className="grid w-full grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {MASTER_AGENTS.map((agent, i) => (
            <div key={agent.id} className="flex justify-center">
              <AgentCard agent={agent} index={i} />
            </div>
          ))}
        </div>

        {/* ---- Connectors: Master → Sub per channel (vertical lines) ---- */}
        <div className="grid w-full grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {CHANNELS.map((ch) => (
            <div
              key={ch}
              className="flex h-6 items-start justify-center"
              aria-hidden
            >
              <div
                className="h-full w-0.5"
                style={{
                  background: `linear-gradient(to bottom, ${CHANNEL_META[ch].color}, ${CHANNEL_META[ch].color}33)`,
                }}
              />
            </div>
          ))}
        </div>

        {/* ---- Sub agents row ---- */}
        <div className="grid w-full grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {SUB_AGENTS.map((agent, i) => (
            <div key={agent.id} className="flex justify-center">
              <AgentCard agent={agent} index={i} />
            </div>
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <footer className="relative z-10 pb-6 text-center text-xs text-slate-500">
        Agents post updates autonomously · Email channel uses your real inbox ·
        other channels are mocked for now
      </footer>

      {/* The unified chatbox modal (renders only when chatOpen) */}
      <BossChatBox />
    </main>
  );
}

// ---- Sub-component: SVG connector row ------------------------------------
// Draws N vertical lines from a single point at the top, fanning out to N
// points at the bottom. Used to connect Boss (1 node) → Masters (5 nodes).
function ConnectorRow({
  count,
  color,
}: {
  count: number;
  color: string;
}) {
  // SVG viewBox: 100 wide × 40 tall. Top anchor at (50, 0). Bottom anchors
  // spread evenly across the width.
  const width = 100;
  const height = 40;
  const bottomY = height;
  const tops: { x: number }[] = [];
  for (let i = 0; i < count; i++) {
    tops.push({
      x: (width / (count + 1)) * (i + 1),
    });
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-10 w-full max-w-md"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Each line goes from (50, 0) to (bottomX, bottomY) */}
      {tops.map((p, i) => (
        <line
          key={i}
          x1={50}
          y1={0}
          x2={p.x}
          y2={bottomY}
          stroke={color}
          strokeWidth={0.6}
          strokeOpacity={0.55}
        />
      ))}
      {/* Vertical drop from boss card to the fan-out point */}
      <line
        x1={50}
        y1={0}
        x2={50}
        y2={6}
        stroke={color}
        strokeWidth={0.8}
        strokeOpacity={0.8}
      />
    </svg>
  );
}

export default CommandCenter;
