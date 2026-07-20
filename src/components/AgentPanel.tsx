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
//   │ [Inbox] [Chat]   ← tabs   │   (only for email-agent)
//   │ ─────────────────────     │
//   │ Tab content:              │
//   │   Inbox → message list    │
//   │   Chat  → transcript      │
//   │           [input] [send]  │
//   └─────────────────────────┘
//
// Chat is wired to /api/agents/:id/chat which calls DeepSeek.
// Inbox is wired to /api/agents/email-agent/inbox which calls IMAP.
// ===========================================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Trash2,
  Loader2,
  Inbox as InboxIcon,
  MessageSquare,
  RefreshCw,
  MailWarning,
  Briefcase,
} from "lucide-react";

import { getAgentById } from "@/lib/agents";
import { useOfficeStore } from "@/store/useOfficeStore";

// ---- Inbox message type (kept in sync with lib/email.ts) ------------------
interface EmailMessage {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}
interface InboxResult {
  connected: boolean;
  configured: boolean;
  total: number;
  unread: number;
  messages: EmailMessage[];
}

// ---- Tracker type (kept in sync with lib/applications.ts) -----------------
type ApplicationStatus =
  | "applied"
  | "viewed"
  | "interview"
  | "offer"
  | "closed"
  | "updated";

interface Application {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  lastUpdate: string;
  daysSinceUpdate: number;
  latestEmail: EmailMessage;
  history: EmailMessage[];
}

interface TrackerResult {
  connected: boolean;
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  applications: Application[];
  error?: string;
}

type Tab = "chat" | "inbox" | "tracker";

export function AgentPanel() {
  const selectedId = useOfficeStore((s) => s.selectedId);
  const select = useOfficeStore((s) => s.select);
  const transcripts = useOfficeStore((s) => s.transcripts);
  const pushMessage = useOfficeStore((s) => s.pushMessage);
  const clearTranscript = useOfficeStore((s) => s.clearTranscript);

  const agent = selectedId ? getAgentById(selectedId) : undefined;
  const isEmailAgent = agent?.id === "email-agent";
  const isApplicationsAgent = agent?.id === "applications-agent";

  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- Inbox state (only used when agent is email-agent) -----------------
  const [inbox, setInbox] = useState<InboxResult | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  // ---- Tracker state (only used when agent is applications-agent) --------
  const [tracker, setTracker] = useState<TrackerResult | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerError, setTrackerError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const res = await fetch(`/api/agents/email-agent/inbox?limit=10`);
      const data = (await res.json()) as InboxResult & { error?: string };
      if (data.error && !data.messages?.length) {
        setInboxError(data.error);
      }
      setInbox(data);
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : "Failed to load inbox");
    } finally {
      setInboxLoading(false);
    }
  }, []);

  const loadTracker = useCallback(async () => {
    setTrackerLoading(true);
    setTrackerError(null);
    try {
      const res = await fetch(`/api/agents/applications-agent/tracker?limit=50`);
      const data = (await res.json()) as TrackerResult & { error?: string };
      if (data.error && !data.applications?.length) {
        setTrackerError(data.error);
      }
      setTracker(data);
    } catch (err) {
      setTrackerError(
        err instanceof Error ? err.message : "Failed to load tracker"
      );
    } finally {
      setTrackerLoading(false);
    }
  }, []);

  // Auto-scroll chat to bottom whenever the transcript grows.
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

  // Reset to chat tab + load inbox/tracker when switching agents.
  useEffect(() => {
    if (selectedId === "email-agent") {
      // Don't auto-jump to inbox — let the user click. But pre-fetch so the
      // inbox tab is instant when they do click.
      loadInbox();
    } else if (selectedId === "applications-agent") {
      // Pre-fetch the tracker so the Applications tab is instant.
      loadTracker();
    } else {
      setTab("chat");
      setInbox(null);
      setTracker(null);
    }
  }, [selectedId, loadInbox, loadTracker]);

  const send = useCallback(async () => {
    if (!agent || !input.trim() || sending) return;
    const userText = input.trim();
    setInput("");

    // 1. Echo the user's message into the transcript immediately.
    pushMessage(agent.id, { role: "user", text: userText });

    // 2. Call the chat API route (hits DeepSeek when DEEPSEEK_API_KEY is set).
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
          "Hmm, I didn't catch that. Could you rephrase?",
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

          {/* ---- Tabs (email-agent: Inbox+Chat, applications-agent: Applications+Chat) ---- */}
          {(isEmailAgent || isApplicationsAgent) && (
            <div className="flex border-b border-slate-700/60 bg-slate-950/40">
              {isEmailAgent && (
                <TabButton
                  active={tab === "inbox"}
                  onClick={() => setTab("inbox")}
                  color={agent.color}
                  icon={<InboxIcon className="h-3.5 w-3.5" />}
                  label="Inbox"
                  badge={
                    inbox && inbox.unread > 0
                      ? String(inbox.unread)
                      : undefined
                  }
                />
              )}
              {isApplicationsAgent && (
                <TabButton
                  active={tab === "tracker"}
                  onClick={() => setTab("tracker")}
                  color={agent.color}
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  label="Applications"
                  badge={
                    tracker && tracker.total > 0
                      ? String(tracker.total)
                      : undefined
                  }
                />
              )}
              <TabButton
                active={tab === "chat"}
                onClick={() => setTab("chat")}
                color={agent.color}
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="Chat"
              />
            </div>
          )}

          {/* ---- Body ---- */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* ===== INBOX TAB (email-agent only) ===== */}
            {isEmailAgent && tab === "inbox" ? (
              <InboxView
                inbox={inbox}
                loading={inboxLoading}
                error={inboxError}
                onRefresh={loadInbox}
                color={agent.color}
              />
            ) : isApplicationsAgent && tab === "tracker" ? (
              /* ===== APPLICATIONS TAB (applications-agent only) ===== */
              <TrackerView
                tracker={tracker}
                loading={trackerLoading}
                error={trackerError}
                onRefresh={loadTracker}
                color={agent.color}
              />
            ) : (
              <>
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
                    Powered by DeepSeek via <code>/api/agents/:id/chat</code>.
                  </p>
                </section>
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function TabButton({
  active,
  onClick,
  color,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition"
      style={{
        color: active ? color : "#94a3b8",
        background: active ? `${color}15` : "transparent",
        borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
      }}
    >
      {icon}
      {label}
      {badge && (
        <span
          className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
          style={{ background: color }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function InboxView({
  inbox,
  loading,
  error,
  onRefresh,
  color,
}: {
  inbox: InboxResult | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  color: string;
}) {
  // Loading state (first fetch)
  if (loading && !inbox) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color }} />
        <p className="text-xs">Loading inbox…</p>
      </div>
    );
  }

  // Error state (no inbox data at all)
  if (!inbox && error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
        <p className="font-semibold">Couldn&apos;t load inbox</p>
        <p className="mt-1 text-red-300/80">{error}</p>
        <button
          onClick={onRefresh}
          className="mt-2 rounded border border-red-400/40 px-2 py-1 text-[10px] hover:bg-red-900/40"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <section className="flex flex-col">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {inbox?.connected
            ? `${inbox.total} total · ${inbox.unread} unread`
            : "Inbox (demo)"}
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-40"
          title="Refresh inbox"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Demo mode banner */}
      {inbox && !inbox.connected && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
          <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-semibold">Demo mode — email not connected</p>
            <p className="mt-0.5 text-amber-300/80">
              Showing mock messages. To see your real inbox, set{" "}
              <code className="rounded bg-amber-900/40 px-1">EMAIL_*</code> vars
              in <code className="rounded bg-amber-900/40 px-1">.env.local</code>{" "}
              and restart. See README for Gmail setup steps.
            </p>
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="space-y-1.5">
        {inbox?.messages.length === 0 && (
          <p className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-6 text-center text-xs italic text-slate-500">
            No messages in inbox.
          </p>
        )}
        {inbox?.messages.map((m) => (
          <article
            key={m.uid}
            className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5 text-xs transition hover:border-slate-600"
          >
            <div className="flex items-center gap-2">
              {/* Unread dot */}
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: m.unread ? color : "transparent",
                  border: m.unread ? "none" : "1px solid #475569",
                }}
                aria-label={m.unread ? "unread" : "read"}
              />
              <span className="flex-1 truncate font-medium text-slate-200">
                {m.from}
              </span>
              <span className="shrink-0 text-[10px] text-slate-500">
                {formatRelativeTime(m.date)}
              </span>
            </div>
            <p className="mt-1 truncate font-semibold text-slate-100">
              {m.subject}
            </p>
            <p className="mt-0.5 line-clamp-2 text-slate-400">{m.snippet}</p>
          </article>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-slate-500">
        Via <code>/api/agents/email-agent/inbox</code> (IMAP).
      </p>
    </section>
  );
}

// ===========================================================================
// TrackerView — Applications Agent's status board
// ===========================================================================
function TrackerView({
  tracker,
  loading,
  error,
  onRefresh,
  color,
}: {
  tracker: TrackerResult | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  color: string;
}) {
  // Loading state (first fetch)
  if (loading && !tracker) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color }} />
        <p className="text-xs">Scanning inbox for applications…</p>
      </div>
    );
  }

  // Error state
  if (!tracker && error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
        <p className="font-semibold">Couldn&apos;t load tracker</p>
        <p className="mt-1 text-red-300/80">{error}</p>
        <button
          onClick={onRefresh}
          className="mt-2 rounded border border-red-400/40 px-2 py-1 text-[10px] hover:bg-red-900/40"
        >
          Try again
        </button>
      </div>
    );
  }

  const statusConfig: Record<
    ApplicationStatus,
    { label: string; bg: string; text: string; dot: string }
  > = {
    applied: { label: "Applied", bg: "#1e3a8a22", text: "#93c5fd", dot: "#3b82f6" },
    viewed: { label: "Viewed", bg: "#ca8a0422", text: "#fde68a", dot: "#eab308" },
    interview: { label: "Interview", bg: "#9333ea22", text: "#d8b4fe", dot: "#a855f7" },
    offer: { label: "Offer", bg: "#16a34a22", text: "#86efac", dot: "#22c55e" },
    closed: { label: "Closed", bg: "#7f1d1d22", text: "#fca5a5", dot: "#ef4444" },
    updated: { label: "Updated", bg: "#47556922", text: "#cbd5e1", dot: "#64748b" },
  };

  return (
    <section className="flex flex-col">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {tracker?.connected
            ? `${tracker.total} tracked`
            : "Tracker (demo)"}
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-40"
          title="Refresh tracker"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Demo mode banner */}
      {tracker && !tracker.connected && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
          <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-semibold">Demo mode — email not connected</p>
            <p className="mt-0.5 text-amber-300/80">
              Showing mock applications. To track your real applications, set{" "}
              <code className="rounded bg-amber-900/40 px-1">EMAIL_*</code> vars
              in <code className="rounded bg-amber-900/40 px-1">.env.local</code>.
            </p>
          </div>
        </div>
      )}

      {/* Status summary chips */}
      {tracker && tracker.applications.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["interview", "viewed", "applied", "offer", "closed"] as ApplicationStatus[])
            .filter((s) => tracker.byStatus[s] > 0)
            .map((s) => {
              const cfg = statusConfig[s];
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: cfg.bg, color: cfg.text }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: cfg.dot }}
                  />
                  {tracker.byStatus[s]} {cfg.label}
                </span>
              );
            })}
        </div>
      )}

      {/* Application list */}
      <div className="space-y-1.5">
        {tracker?.applications.length === 0 && (
          <p className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-6 text-center text-xs italic text-slate-500">
            No applications found in your recent emails.
          </p>
        )}
        {tracker?.applications.map((app) => {
          const cfg = statusConfig[app.status];
          return (
            <article
              key={app.id}
              className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5 text-xs transition hover:border-slate-600"
            >
              {/* Top row: status pill + days since update */}
              <div className="mb-1 flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  style={{ background: cfg.bg, color: cfg.text }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: cfg.dot }}
                  />
                  {cfg.label}
                </span>
                <span
                  className="shrink-0 text-[10px] font-medium"
                  style={{
                    color:
                      app.daysSinceUpdate > 7 ? "#fca5a5" : "#94a3b8",
                  }}
                >
                  {app.daysSinceUpdate === 0
                    ? "today"
                    : `${app.daysSinceUpdate}d ago`}
                </span>
              </div>

              {/* Company + role */}
              <p className="truncate font-semibold text-slate-100">
                {app.role}
              </p>
              <p className="truncate text-slate-400">{app.company}</p>

              {/* Latest email subject */}
              <p className="mt-1.5 line-clamp-1 text-[11px] italic text-slate-500">
                ↳ {app.latestEmail.subject}
              </p>
            </article>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-slate-500">
        Auto-detected from your inbox via{" "}
        <code>/api/agents/applications-agent/tracker</code>.
      </p>
    </section>
  );
}

// ---- Helpers --------------------------------------------------------------
function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default AgentPanel;
