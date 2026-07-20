// ===========================================================================
// components/AgentCard.tsx
// ---------------------------------------------------------------------------
// Reusable card for a master or sub agent in the command center.
//
// Two sizes:
//   - tier="master" — slightly larger, more prominent
//   - tier="sub"    — smaller, secondary
//
// Clicking the card opens the boss chatbox filtered to that agent's channel,
// so you can see just the email agent's posts, just the Shopee agent's posts,
// etc.
// ===========================================================================

"use client";

import { motion } from "framer-motion";
import type { CommandAgent } from "@/lib/commandAgents";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

interface AgentCardProps {
  agent: CommandAgent;
  index: number; // for stagger animation
}

export function AgentCard({ agent, index }: AgentCardProps) {
  const openChat = useCommandCenterStore((s) => s.openChat);
  const updateCount = useCommandCenterStore(
    (s) => s.updates.filter((u) => u.agentId === agent.id).length
  );

  const isMaster = agent.tier === "master";

  return (
    <motion.button
      onClick={() => openChat(agent.channel as never)}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 24,
        delay: 0.1 + index * 0.05,
      }}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative flex flex-col items-center gap-1.5 rounded-xl border bg-slate-900/80 text-slate-100 shadow-lg backdrop-blur-sm transition ${
        isMaster ? "px-4 py-3" : "px-3 py-2"
      }`}
      style={{
        borderColor: `${agent.color}66`,
        boxShadow: `0 4px 12px rgba(0,0,0,0.3), 0 0 0 1px ${agent.color}20`,
      }}
      aria-label={`Open ${agent.name} activity feed`}
    >
      {/* Hover glow */}
      <span
        className="absolute inset-0 -z-10 rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at center, ${agent.color}25 0%, transparent 70%)`,
        }}
        aria-hidden
      />

      {/* Avatar */}
      <div
        className={`flex items-center justify-center rounded-full text-xl shadow ${
          isMaster ? "h-11 w-11" : "h-8 w-8 text-base"
        }`}
        style={{
          background: `linear-gradient(135deg, ${agent.color}99, ${agent.color}44)`,
          boxShadow: `0 0 12px ${agent.color}60`,
        }}
      >
        {agent.emoji}
      </div>

      {/* Name + role */}
      <div className="text-center">
        <div
          className={`font-semibold leading-tight ${
            isMaster ? "text-sm" : "text-xs"
          }`}
        >
          {agent.name}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400">
          {agent.role}
        </div>
      </div>

      {/* Update count badge (only if this agent has posted) */}
      {updateCount > 0 && (
        <div
          className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-slate-900 shadow"
          style={{ background: agent.color }}
        >
          {updateCount > 99 ? "99+" : updateCount}
        </div>
      )}

      {/* Live activity dot — animates when this agent has posted recently */}
      {updateCount > 0 && (
        <span
          className="absolute -left-1 -top-1 h-2 w-2 rounded-full"
          style={{ background: agent.color }}
          aria-hidden
        />
      )}
    </motion.button>
  );
}

export default AgentCard;
