// ===========================================================================
// components/AgentPanel.tsx
// ---------------------------------------------------------------------------
// HTML UI overlay (NOT in the 3D canvas) shown when a bot is selected.
//
// Reads from the Zustand store so it can live completely outside <Canvas/>
// and still react to selection / hover changes from inside the 3D scene.
//
// Layout (right-hand side, scrollable on small screens):
//   ┌─────────────────────────┐
//   │ ✕ close                  │
//   │ ● Email Agent             │
//   │   Inbox Operations        │
//   │ ─────────────────────     │
//   │ STATUS: 12 new emails…    │
//   │ About: <description>      │
//   │ ─────────────────────     │
//   │ Mini chat                 │
//   │  ┌─────────────────────┐  │
//   │  │ transcript scroll    │ │
//   │  └─────────────────────┘  │
//   │  [input box] [send]       │
//   └─────────────────────────┘
//
// The chat currently uses mocked data via /api/agents/:id/chat. Swap that
// fetch call for a real LLM-backed API route when ready.
// ===========================================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Trash2, Loader2 } from "lucide-react";

import { agents, getAgentById } from "@/lib/agents";
import { useOfficeStore } from "@/store/useOfficeStore";

export function AgentPanel() {
  const selectedId = useOfficeStore((s) => s.selectedId);
  const select = useOfficeStore((s) => s.select);
  const transcripts = useOfficeStore((s) => s.transcripts);
  const pushMessage = useOfficeStore((s) => s.pushMessage);
  const clearTranscript = useOfficeStore((s) => s.clearTranscript);

  const agent = selectedId ? getAgentById(selectedId) : undefined;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever the transcript grows.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts, selectedId]);

  // When the panel is first opened for an agent, seed a welcome message so
  // the chat doesn't look empty.
  useEffect(() => {
    if (!agent) return;
    const t = transcripts[agent.id] ?? [];
    if (t.length === 0 && agent.sampleReplies && agent.sampleReplies[0]) {
      pushMessage(agent.id, { role: "agent", text: agent.sampleReplies[0] });
    }
  }, [selectedId]);

  const send = useCallback(async () => {
    if (!agent || !input.trim() || sending) return;
    const userText = input.trim();
    setInput("");

    // 1. Echo the user's message into the transcript immediately.
    pushMessage(agent.id, { role: "user", text: userText });

    // 2. Call the mocked chat API route. Replace this URL with a real
    //    LLM-backed endpoint when ready — the response shape stays the same.
    setSending(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });
      const data = await res.json();
      pushMessage(agent.id, {
        role: "agent",
        text:
          data.reply ??
          "Hmm, I didn't catch that. Could you rephrase? (mocked response)",
      });
    } catch {
      pushMessage(agent.id, {
        role: "agent",
        text: "I lost connection to my brain for a second. Please try again.",
      });
    } finally {
      setSending(false);
    }
  }, [agent, input, sending, pushMessage]);

  // Keyboard: Enter to send, Shift+Enter for newline.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <AnimatePresence>
      {agent && (
        <motion.aside
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="absolute right-4 top-4 bottom-4 z-20 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md"
          role="dialog"
          aria-label={`${agent.name} panel`}
        >
          {/* ---- Header ---- */}
          <header
            className="flex items-start justify-between gap-3 border-b border-slate-700/60 p-4"
            style={{
              background: `linear-gradient(135deg, ${agent.color}22, transparent)`,
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
                style={{
                  background: agent.color,
                  boxShadow: `0 0 12px ${agent.color}`,
                }}
                aria-hidden
              />
              <div>
                <h2 className="text-base font-semibold leading-tight">
                  {agent.name}
                </h2>
                <p className="text-xs text-slate-400">{agent.role}</p>
              </div>
            </div>
            <button
              onClick={() => select(null)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-700/50 hover:text-white"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* ---- Body ---- */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Status block */}
            <section className="mb-4">
              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Status
              </h3>
              <p
                className="rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: `${agent.color}55`,
                  background: `${agent.color}11`,
                }}
              >
                {agent.status}
              </p>
            </section>

            {/* Description */}
            {agent.description && (
              <section className="mb-5">
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  About
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {agent.description}
                </p>
              </section>
            )}

            {/* Chat */}
            <section className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Mini chat
                </h3>
                {(transcripts[agent.id] ?? []).length > 0 && (
                  <button
                    onClick={() => clearTranscript(agent.id)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700/50 hover:text-white"
                    title="Clear transcript"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>

              {/* Transcript */}
              <div
                ref={scrollRef}
                className="mb-3 max-h-64 min-h-[120px] space-y-2 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950/60 p-3 text-sm"
              >
                {(transcripts[agent.id] ?? []).length === 0 && (
                  <p className="text-xs italic text-slate-500">
                    Say something to {agent.name}…
                  </p>
                )}
                {(transcripts[agent.id] ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "text-right"
                        : "text-left"
                    }
                  >
                    <span
                      className={
                        "inline-block max-w-[85%] rounded-lg px-2.5 py-1.5 text-left text-[13px] " +
                        (m.role === "user"
                          ? "bg-slate-700 text-white"
                          : "border text-slate-100")
                      }
                      style={
                        m.role === "agent"
                          ? {
                              borderColor: `${agent.color}66`,
                              background: `${agent.color}15`,
                            }
                          : undefined
                      }
                    >
                      {m.text}
                    </span>
                  </div>
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {agent.name} is typing…
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  placeholder={`Message ${agent.name}…`}
                  className="flex-1 resize-none rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-900 transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: agent.color }}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                Mocked replies via <code>/api/agents/:id/chat</code>. Wire to a
                real LLM route later.
              </p>
            </section>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default AgentPanel;

// Silence "agents" unused import in case file gets tree-shaken aggressively.
void agents;
