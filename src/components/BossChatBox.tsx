// ===========================================================================
// components/BossChatBox.tsx
// ---------------------------------------------------------------------------
// Unified chatbox modal for the Command Center.
//
// Single-pane conversation view where:
//   - Master agents auto-post their activity updates into the feed
//   - The user can type messages and get DeepSeek AI responses
//   - Everything appears in one scrolling timeline, newest at the bottom
//
// Channel filter pills at the top let you focus on one department at a time.
// ===========================================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  Filter,
  Send,
  Bot,
  Loader2,
  Paperclip,
} from "lucide-react";

import {
  CHANNELS,
  CHANNEL_META,
  getAgentById as getCmdAgent,
  type Channel,
} from "@/lib/commandAgents";
import type { ActivityUpdate } from "@/lib/activityGenerator";
import { useCommandCenterStore } from "@/store/useCommandCenterStore";

// ---- Map channel → agent ID for the chat API (/api/agents/:id/chat) -----
const CHANNEL_TO_AGENT_ID: Record<Channel | "boss", string> = {
  email: "email-agent",
  shopee: "business-agent",
  tiktok: "business-agent",
  lazada: "business-agent",
  facebook: "business-agent",
  boss: "email-agent",
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
  source?: string;
}

// A union type for timeline items — either an agent activity update or a chat message
type TimelineItem =
  | { kind: "activity"; data: ActivityUpdate }
  | { kind: "chat"; data: ChatMessage };

export function BossChatBox() {
  const chatOpen = useCommandCenterStore((s) => s.chatOpen);
  const closeChat = useCommandCenterStore((s) => s.closeChat);
  const filterChannel = useCommandCenterStore((s) => s.filterChannel);
  const openChat = useCommandCenterStore((s) => s.openChat);
  const updates = useCommandCenterStore((s) => s.updates);
  const clearFeed = useCommandCenterStore((s) => s.clearFeed);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset chat when channel changes
  useEffect(() => {
    setChatMessages([]);
    setInputText("");
    setSelectedImage(null);
    setImagePreviewUrl(null);
  }, [filterChannel]);

  // Filter updates to only show master agent posts (extra safety on top of
  // the CommandCenter change — in case old sub posts are still in the store)
  const visibleUpdates = useMemo(() => {
    let filtered = updates.filter((u) => u.agentId.endsWith("-master"));
    if (filterChannel) {
      filtered = filtered.filter((u) => u.channel === filterChannel);
    }
    return filtered;
  }, [updates, filterChannel]);

  // Merge activity feed + chat messages into one sorted timeline (oldest first)
  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const u of visibleUpdates) {
      items.push({ kind: "activity", data: u });
    }
    for (const m of chatMessages) {
      items.push({ kind: "chat", data: m });
    }
    items.sort((a, b) => {
      const tsA = a.kind === "activity" ? a.data.ts : a.data.ts;
      const tsB = b.kind === "activity" ? b.data.ts : b.data.ts;
      return tsA - tsB;
    });
    return items;
  }, [visibleUpdates, chatMessages]);

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    // Only auto-scroll if user is near the bottom
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [timeline.length]);

  // Esc key closes the modal
  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, closeChat]);

  // Focus input when modal opens
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [chatOpen, filterChannel]);

  // Determine which agent to message
  const agentId = CHANNEL_TO_AGENT_ID[filterChannel ?? "boss"];
  const agentLabel = filterChannel
    ? `${CHANNEL_META[filterChannel].emoji} ${CHANNEL_META[filterChannel].label} Master`
    : "👑 Boss AI";

  // Send message
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if ((!text && !selectedImage) || sending) return;

    let imageBase64: string | undefined = undefined;
    let imageMime: string | undefined = undefined;
    let imageName: string | undefined = undefined;

    if (selectedImage) {
      // Read file as base64
      const reader = new FileReader();
      imageBase64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedImage);
      });
      imageMime = selectedImage.type;
      imageName = selectedImage.name;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: text + (selectedImage ? `\n[Attached Image: ${selectedImage.name}]` : ""),
      ts: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setSending(true);

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, imageBase64, imageMime, imageName }),
      });
      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: "assistant",
        text: data.reply ?? "Sorry, I couldn't generate a response.",
        ts: Date.now(),
        source: data.source,
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: "Network error — couldn't reach the server. Please try again.",
          ts: Date.now(),
          source: "error",
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [inputText, sending, agentId, selectedImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    }
  };

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
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 text-slate-100 shadow-2xl"
            role="dialog"
            aria-label="Command Center chatbox"
          >
            {/* ---- Header ---- */}
            <header className="border-b border-slate-700/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      background: filterChannel
                        ? `linear-gradient(135deg, ${CHANNEL_META[filterChannel].color}99, ${CHANNEL_META[filterChannel].color}44)`
                        : "linear-gradient(135deg, #fbbf2499, #fbbf2444)",
                    }}
                  >
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">
                      {filterChannel
                        ? `${CHANNEL_META[filterChannel].emoji} ${CHANNEL_META[filterChannel].label} Channel`
                        : "👑 Command Center"}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {visibleUpdates.length} update
                      {visibleUpdates.length === 1 ? "" : "s"} from masters ·{" "}
                      {sending ? (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <Loader2 className="inline h-3 w-3 animate-spin" />
                          AI thinking…
                        </span>
                      ) : (
                        "type below to chat"
                      )}
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

            {/* ---- Unified Timeline (scrollable) ---- */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto p-4"
              style={{ minHeight: 320 }}
            >
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-500">
                  <Bot className="h-10 w-10 text-slate-600" />
                  <p className="text-sm">
                    {filterChannel
                      ? `Waiting for ${CHANNEL_META[filterChannel].label} Master updates…`
                      : "Waiting for master agent updates…"}
                  </p>
                  <p className="text-xs text-slate-600">
                    Updates appear automatically · Type a message below to chat
                  </p>
                </div>
              ) : (
                timeline.map((item) => {
                  if (item.kind === "activity") {
                    return (
                      <ActivityBubble
                        key={item.data.id}
                        update={item.data}
                      />
                    );
                  }
                  return (
                    <ChatBubble
                      key={item.data.id}
                      msg={item.data}
                      agentLabel={agentLabel}
                    />
                  );
                })
              )}

              {/* Typing indicator */}
              {sending && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-slate-400"
                >
                  <div className="flex gap-1">
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms]" />
                  </div>
                  AI is thinking…
                </motion.div>
              )}
            </div>

            {/* ---- Chat Input ---- */}
            <div className="border-t border-slate-700/60 bg-slate-950/50 p-3">
              {/* Image Preview */}
              {imagePreviewUrl && (
                <div className="mb-3 relative inline-block">
                  <img src={imagePreviewUrl} alt="Preview" className="h-20 w-auto rounded-md border border-slate-700 object-cover" />
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 border border-slate-600 hover:bg-slate-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition border border-slate-700"
                  title="Attach Image"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={selectedImage ? "Add a caption prompt for AI..." : `Message ${agentLabel}…`}
                  disabled={sending}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={(!inputText.trim() && !selectedImage) || sending}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md transition hover:from-amber-400 hover:to-orange-500 disabled:opacity-30 disabled:hover:from-amber-500"
                  title="Send message"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
              <p className="mt-1.5 text-center text-[9px] text-slate-600">
                Press Enter to send · powered by DeepSeek AI · press{" "}
                <kbd className="rounded bg-slate-700 px-1">Esc</kbd> to close
              </p>
            </div>
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

/** Master agent activity update rendered as a left-aligned chat bubble */
function ActivityBubble({ update }: { update: ActivityUpdate }) {
  const agent = getCmdAgent(update.agentId);
  if (!agent) return null;

  const severityColors = {
    info: { border: "#334155", bg: "rgba(51, 65, 85, 0.3)" },
    warning: { border: "#eab30855", bg: "#eab30818" },
    success: { border: "#22c55e55", bg: "#22c55e18" },
  };
  const sev =
    severityColors[update.severity ?? "info"] ?? severityColors.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex justify-start"
    >
      <div className="flex max-w-[88%] gap-2.5">
        {/* Agent Avatar */}
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
          style={{
            background: `linear-gradient(135deg, ${agent.color}99, ${agent.color}44)`,
            boxShadow: `0 0 8px ${agent.color}40`,
          }}
        >
          {agent.emoji}
        </div>

        {/* Message */}
        <div
          className="rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm leading-relaxed text-slate-200"
          style={{ borderColor: sev.border, background: sev.bg }}
        >
          <p
            className="mb-1 text-[10px] font-semibold"
            style={{ color: agent.color }}
          >
            {agent.name}
            <span className="ml-1.5 font-normal uppercase tracking-wider text-slate-500">
              {agent.tier}
            </span>
          </p>
          <p className="whitespace-pre-wrap break-words">{update.text}</p>
          <p className="mt-1 text-[9px] text-slate-500">
            {formatRelativeTime(update.ts)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/** User or AI reply chat bubble */
function ChatBubble({
  msg,
  agentLabel,
}: {
  msg: ChatMessage;
  agentLabel: string;
}) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-md bg-gradient-to-br from-amber-500/90 to-orange-600/90 text-white"
            : "rounded-bl-md border border-indigo-500/30 bg-indigo-950/40 text-slate-200"
        }`}
      >
        {!isUser && (
          <p className="mb-1 text-[10px] font-semibold text-indigo-400">
            🤖 {agentLabel}
          </p>
        )}
        {isUser && (
          <p className="mb-1 text-[10px] font-semibold text-amber-200/80">
            You
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        <p
          className={`mt-1 text-[9px] ${
            isUser ? "text-amber-200/60" : "text-slate-500"
          }`}
        >
          {formatRelativeTime(msg.ts)}
          {msg.source && !isUser && (
            <span className="ml-1.5">
              · via{" "}
              {msg.source === "deepseek"
                ? "DeepSeek"
                : msg.source === "mock"
                ? "Demo"
                : msg.source}
            </span>
          )}
        </p>
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
