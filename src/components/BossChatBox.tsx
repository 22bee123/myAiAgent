// ===========================================================================
// components/BossChatBox.tsx
// ---------------------------------------------------------------------------
// The unified activity feed chatbox — opens as a centered modal when you
// click the Boss card (or any agent card).
//
// Shows a scrolling chat-style feed of every agent's posts. Each post has:
//   - The agent's avatar (emoji) in its channel color
//   - The agent name + tier (Master/Sub)
//   - The message text (can be multi-line)
//   - A relative timestamp (just now / 30s / 2m / 1h / etc.)
//
// Header has:
//   - Title ("Activity Feed" or "{Channel} Activity" when filtered)
//   - Channel filter pills — click to filter to one channel, or "All"
//   - Clear button (wipes the feed)
//   - Close button
//
// The feed auto-scrolls to the top (newest) when new updates arrive, but
// only if the user is already at the top — so scrolling down to read older
// posts doesn't yank you back.
// ===========================================================================

"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Filter } from "lucide-react";

import {
  CHANNELS,
  CHANNEL_META,
  getAgentById,
  type Channel,
} from "@/lib/commandAgents";
import type { ActivityUpdate } from "@/lib/activityGenerator";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

export function BossChatBox() {
  const chatOpen = useCommandCenterStore((s) => s.chatOpen);
  const closeChat = useCommandCenterStore((s) => s.closeChat);
  const filterChannel = useCommandCenterStore((s) => s.filterChannel);
  const openChat = useCommandCenterStore((s) => s.openChat);
  const updates = useCommandCenterStore((s) => s.updates);
  const clearFeed = useCommandCenterStore((s) => s.clearFeed);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Apply the channel filter (if any)
  const visibleUpdates = useMemo(() => {
    if (!filterChannel) return updates;
    return updates.filter((u) => u.channel === filterChannel);
  }, [updates, filterChannel]);

  // Auto-scroll to top (newest first) when new updates arrive AND user is
  // near the top. We use "near top" instead of "near bottom" because the
  // feed is newest-first (reversed from a typical chat).
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    // If user is within 100px of the top, snap to top on new updates
    if (el.scrollTop < 100) {
      el.scrollTop = 0;
    }
  }, [visibleUpdates.length]);

  // Esc key closes the modal
  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, closeChat]);

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeChat}
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
            aria-hidden
          />

          {/* Modal */}
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 text-slate-100 shadow-2xl"
            role="dialog"
            aria-label="Activity feed chatbox"
          >
            {/* ---- Header ---- */}
            <header className="border-b border-slate-700/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <div>
                    <h2 className="text-base font-semibold">
                      {filterChannel
                        ? `${CHANNEL_META[filterChannel].emoji} ${CHANNEL_META[filterChannel].label} Activity`
                        : "👑 Unified Activity Feed"}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {visibleUpdates.length} update
                      {visibleUpdates.length === 1 ? "" : "s"} · live from your
                      agents
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {updates.length > 0 && (
                    <button
                      onClick={clearFeed}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700/50 hover:text-white"
                      title="Clear all updates"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                  <button
                    onClick={closeChat}
                    className="rounded p-1 text-slate-400 hover:bg-slate-700/50 hover:text-white"
                    aria-label="Close chatbox"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Channel filter pills */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <FilterPill
                  active={!filterChannel}
                  onClick={() => openChat(null)}
                  label="All"
                  emoji="👥"
                />
                {CHANNELS.map((ch) => (
                  <FilterPill
                    key={ch}
                    active={filterChannel === ch}
                    onClick={() => openChat(ch)}
                    label={CHANNEL_META[ch].label}
                    emoji={CHANNEL_META[ch].emoji}
                    color={CHANNEL_META[ch].color}
                  />
                ))}
              </div>
            </header>

            {/* ---- Feed (scrollable) ---- */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4"
              style={{ minHeight: 300 }}
            >
              {visibleUpdates.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                  <div className="text-4xl">💤</div>
                  <p className="text-sm">
                    No activity yet. Agents are warming up — updates will
                    appear here within ~20s.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleUpdates.map((u) => (
                    <FeedItem key={u.id} update={u} />
                  ))}
                </div>
              )}
            </div>

            {/* ---- Footer ---- */}
            <footer className="border-t border-slate-700/60 bg-slate-950/40 px-4 py-2 text-[10px] text-slate-500">
              Live feed · agents post autonomously every 15-30s · newest first ·
              press <kbd className="rounded bg-slate-700 px-1">Esc</kbd> to close
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---- Sub-components -------------------------------------------------------

function FilterPill({
  active,
  onClick,
  label,
  emoji,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition"
      style={{
        background: active ? `${color ?? "#475569"}22` : "transparent",
        borderColor: active ? `${color ?? "#475569"}88` : "#334155",
        color: active ? color ?? "#cbd5e1" : "#94a3b8",
      }}
    >
      <span>{emoji}</span>
      {label}
    </button>
  );
}

function FeedItem({ update }: { update: ActivityUpdate }) {
  const agent = getAgentById(update.agentId);
  if (!agent) return null;

  const severityColors = {
    info: { border: "#334155", bg: "transparent" },
    warning: { border: "#eab30855", bg: "#eab30811" },
    success: { border: "#22c55e55", bg: "#22c55e11" },
  };
  const sev =
    severityColors[update.severity ?? "info"] ?? severityColors.info;

  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
        style={{
          background: `linear-gradient(135deg, ${agent.color}99, ${agent.color}44)`,
          boxShadow: `0 0 8px ${agent.color}50`,
        }}
      >
        {agent.emoji}
      </div>

      {/* Message body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: agent.color }}
          >
            {agent.name}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            {agent.tier}
          </span>
          <span className="ml-auto text-[10px] text-slate-500">
            {formatRelativeTime(update.ts)}
          </span>
        </div>
        <div
          className="mt-0.5 rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap break-words text-slate-200"
          style={{ borderColor: sev.border, background: sev.bg }}
        >
          {update.text}
        </div>
      </div>
    </motion.div>
  );
}

// ---- Helpers --------------------------------------------------------------
function formatRelativeTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ts).toLocaleString();
}
