// ===========================================================================
// lib/commandAgents.ts
// ---------------------------------------------------------------------------
// Hierarchy config for the Command Center view.
//
// Layout (top to bottom):
//
//                        ┌──────────────┐
//                        │  Me (Boss)   │
//                        └──────────────┘
//                               │
//         ┌────────┬───────────┼───────────┬────────┐
//         ↓        ↓           ↓           ↓        ↓
//      ┌─────┐ ┌─────┐     ┌─────┐     ┌─────┐  ┌─────┐
//      │Email│ │Shopee│    │TikTok│    │Lazada│  │FBPg │  ← master agents
//      │Master│ │Master│   │Master│    │Master│  │Mastr│
//      └─────┘ └─────┘     └─────┘     └─────┘  └─────┘
//         │        │           │           │        │
//         ↓        ↓           ↓           ↓        ↓
//      ┌─────┐ ┌─────┐     ┌─────┐     ┌─────┐  ┌─────┐
//      │Email│ │Shopee│    │TikTok│    │Lazada│  │FBPg │  ← sub agents
//      │ Sub │ │ Sub │     │ Sub │     │ Sub │  │ Sub │
//      └─────┘ └─────┘     └─────┘     └─────┘  └─────┘
//
// Each "channel" is one master+sub pair (Email, Shopee, TikTok, Lazada, FB).
// Master agents decide WHAT to do, sub agents execute and report back.
// ===========================================================================

export type AgentTier = "boss" | "master" | "sub";

export type Vec3 = [number, number, number];

export interface CommandAgent {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  channel: string; // "email" | "shopee" | "tiktok" | "lazada" | "facebook" | "boss"
  emoji: string;
  color: string; // hex
  /** 3D position in the command center room (x, y, z). */
  position: Vec3;
  /** How often (ms) this agent posts to the boss chatbox. 0 = never auto-posts. */
  postInterval: number;
  /** Short blurb shown under the card name. */
  blurb: string;
}

// ---- 3D layout constants --------------------------------------------------
// The room is 16 wide × 12 deep. Hierarchy is arranged back-to-front:
//   Boss   at z = -4.5 (back), elevated on a platform (y = 0.4)
//   Masters at z = -1.5, spread across x = [-4, -2, 0, 2, 4]
//   Subs    at z = +1.5, spread across x = [-4, -2, 0, 2, 4]
const MASTER_Z = -1.5;
const SUB_Z = 1.5;
const X_SPREAD: number[] = [-4, -2, 0, 2, 4];

// ---- Boss (the user) ------------------------------------------------------
export const BOSS: CommandAgent = {
  id: "boss",
  name: "Me (Boss)",
  role: "You",
  tier: "boss",
  channel: "boss",
  emoji: "👑",
  color: "#fbbf24", // gold
  position: [0, 0.4, -4.5], // elevated on a platform at the back
  postInterval: 0, // boss doesn't auto-post — user clicks to view the feed
  blurb: "Click to view the unified activity feed",
};

// ---- Channels (one master + one sub per channel) --------------------------
// Each channel = one platform the user operates on. Adding a new platform is
// just adding an entry here + a generator in lib/activityGenerator.ts.
export const CHANNELS = [
  "email",
  "shopee",
  "tiktok",
  "lazada",
  "facebook",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_META: Record<
  Channel,
  { label: string; emoji: string; color: string }
> = {
  email: { label: "Email", emoji: "📧", color: "#22d3ee" },
  shopee: { label: "Shopee", emoji: "🛒", color: "#f97316" },
  tiktok: { label: "TikTok", emoji: "📱", color: "#ec4899" },
  lazada: { label: "Lazada", emoji: "🛍️", color: "#3b82f6" },
  facebook: { label: "FB Page", emoji: "📘", color: "#6366f1" },
};

// ---- Master agents (one per channel) --------------------------------------
export const MASTER_AGENTS: CommandAgent[] = CHANNELS.map((channel, i) => {
  const meta = CHANNEL_META[channel];
  return {
    id: `${channel}-master`,
    name: `${meta.label} Master`,
    role: "Coordinator",
    tier: "master",
    channel,
    emoji: meta.emoji,
    color: meta.color,
    position: [X_SPREAD[i], 0, MASTER_Z],
    postInterval: 25000 + Math.random() * 10000, // 25-35s
    blurb: `Decides what the ${meta.label} sub-agent should do`,
  };
});

// ---- Sub agents (one per channel) -----------------------------------------
export const SUB_AGENTS: CommandAgent[] = CHANNELS.map((channel, i) => {
  const meta = CHANNEL_META[channel];
  return {
    id: `${channel}-sub`,
    name: `${meta.label} Sub`,
    role: "Worker",
    tier: "sub",
    channel,
    emoji: meta.emoji,
    color: meta.color,
    position: [X_SPREAD[i], 0, SUB_Z],
    postInterval: 18000 + Math.random() * 12000, // 18-30s (subs post more often)
    blurb: `Executes ${meta.label} tasks and reports back`,
  };
});

// ---- Convenience lookups --------------------------------------------------
export const ALL_AGENTS: CommandAgent[] = [BOSS, ...MASTER_AGENTS, ...SUB_AGENTS];

export function getAgentById(id: string): CommandAgent | undefined {
  return ALL_AGENTS.find((a) => a.id === id);
}

export function getMasterForChannel(channel: Channel): CommandAgent {
  return MASTER_AGENTS.find((a) => a.channel === channel)!;
}

export function getSubForChannel(channel: Channel): CommandAgent {
  return SUB_AGENTS.find((a) => a.channel === channel)!;
}
