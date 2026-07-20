// ===========================================================================
// components/AgentLegend.tsx
// ---------------------------------------------------------------------------
// Bottom-left legend listing every agent. Clicking an item selects the bot
// in the 3D scene — useful for mobile users (where precise 3D clicking is
// hard) and for keyboard / screen-reader users who can't easily hit a tiny
// 3D mesh.
// ===========================================================================

"use client";

import { motion } from "framer-motion";
import { agents } from "@/lib/agents";
import { useOfficeStore } from "@/store/useOfficeStore";

export function AgentLegend() {
  const selectedId = useOfficeStore((s) => s.selectedId);
  const select = useOfficeStore((s) => s.select);

  return (
    <motion.nav
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 24 }}
      className="absolute bottom-4 left-4 z-10 max-w-[min(420px,calc(100vw-2rem))]"
      aria-label="Agents in the office"
    >
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-3 text-slate-100 shadow-xl backdrop-blur-md">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Workstations
        </p>
        <ul className="flex flex-col gap-1">
          {agents.map((a) => {
            const active = selectedId === a.id;
            return (
              <li key={a.id}>
                <button
                  onClick={() => select(active ? null : a.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-slate-700/50"
                  style={{
                    background: active ? `${a.color}22` : undefined,
                  }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: a.color,
                      boxShadow: `0 0 8px ${a.color}`,
                    }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{a.name}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {a.role}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </motion.nav>
  );
}

export default AgentLegend;
