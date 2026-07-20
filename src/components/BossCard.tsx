// ===========================================================================
// components/BossCard.tsx
// ---------------------------------------------------------------------------
// The "Me (Boss)" card at the top of the command center.
//
// Clicking it opens the unified chatbox where all agents post their
// findings. The card shows a gold crown, the boss name, and a live count
// of how many updates have been posted (with a small dot indicator).
// ===========================================================================

"use client";

import { motion } from "framer-motion";
import { BOSS } from "@/lib/commandAgents";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

export function BossCard() {
  const openChat = useCommandCenterStore((s) => s.openChat);
  const updateCount = useCommandCenterStore((s) => s.updates.length);

  return (
    <motion.button
      onClick={() => openChat(null)}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex flex-col items-center gap-2 rounded-2xl border-2 bg-slate-900/90 px-8 py-5 text-slate-100 shadow-2xl backdrop-blur-md transition"
      style={{
        borderColor: BOSS.color,
        boxShadow: `0 0 30px ${BOSS.color}40, 0 8px 16px rgba(0,0,0,0.4)`,
      }}
      aria-label="Open the unified activity feed chatbox"
    >
      {/* Pulsing glow ring on hover */}
      <span
        className="absolute inset-0 -z-10 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at center, ${BOSS.color}30 0%, transparent 70%)`,
        }}
        aria-hidden
      />

      {/* Avatar with crown emoji */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${BOSS.color}, ${BOSS.color}88)`,
          boxShadow: `0 0 24px ${BOSS.color}80`,
        }}
      >
        {BOSS.emoji}
      </div>

      {/* Name + role */}
      <div className="text-center">
        <div className="text-base font-bold tracking-tight">{BOSS.name}</div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400">
          You · Click to view feed
        </div>
      </div>

      {/* Live update count badge */}
      {updateCount > 0 && (
        <div
          className="absolute -right-2 -top-2 flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-xs font-bold text-slate-900 shadow-lg"
          style={{ background: BOSS.color }}
        >
          {updateCount > 99 ? "99+" : updateCount}
        </div>
      )}

      {/* Live pulse dot when there are new updates */}
      {updateCount > 0 && (
        <span
          className="absolute -left-2 -top-2 flex h-3 w-3"
          aria-hidden
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: BOSS.color }}
          />
          <span
            className="relative inline-flex h-3 w-3 rounded-full"
            style={{ background: BOSS.color }}
          />
        </span>
      )}
    </motion.button>
  );
}

export default BossCard;
