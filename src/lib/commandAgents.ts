// ===========================================================================
// lib/commandAgents.ts
// ---------------------------------------------------------------------------
// Config for 3D AI Command Center Tech Startup Office Layout.
//
// Layout:
//   - Boss Office: elevated glass office at the back center [0, 0, -6.0]
//   - 5 Department Pods (Email, Shopee, TikTok, Lazada, FB Page) arranged
//     around the central social lounge.
//   - Each agent is assigned a workstation position, rotation, and pose.
// ===========================================================================

export type AgentTier = "boss" | "master" | "sub";

export type Vec3 = [number, number, number];

export type PoseType =
  | "typing"
  | "mouse_work"
  | "coffee_break"
  | "screen_pointing"
  | "headset_call"
  | "boss_executive";

export interface CommandAgent {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  channel: string; // "email" | "shopee" | "tiktok" | "lazada" | "facebook" | "boss"
  emoji: string;
  color: string; // hex
  /** 3D position of the workstation seat (x, y, z). */
  position: Vec3;
  /** Y-axis rotation of the workstation facing direction (radians). */
  rotationY: number;
  /** Active character working pose. */
  poseType: PoseType;
  /** How often (ms) this agent posts to the boss chatbox. 0 = never auto-posts. */
  postInterval: number;
  /** Short blurb shown under the card name. */
  blurb: string;
}

// ---- Channels (one master + one sub per channel) --------------------------
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

// ---- Boss (the user) ------------------------------------------------------
export const BOSS: CommandAgent = {
  id: "boss",
  name: "Me (Boss)",
  role: "Chief Executive",
  tier: "boss",
  channel: "boss",
  emoji: "👑",
  color: "#fbbf24", // gold
  position: [0, 0, -5.8], // inside the glass corner office at the back
  rotationY: 0, // facing +Z toward the main room floor
  poseType: "boss_executive",
  postInterval: 0,
  blurb: "Click to view the unified activity feed",
};

// ---- Per-channel workstation configurations -------------------------------
// Pod 1 - Email (Teal): Left back, facing +X (right towards lounge)
// Pod 2 - Shopee (Orange): Left front, facing +X
// Pod 3 - TikTok (Pink): Center front, facing -Z (back towards lounge)
// Pod 4 - Lazada (Blue): Right front, facing -X (left towards lounge)
// Pod 5 - FB Page (Purple): Right back, facing -X

const POD_CONFIGS: Record<
  Channel,
  {
    masterPos: Vec3;
    subPos: Vec3;
    rotationY: number;
    masterPose: PoseType;
    subPose: PoseType;
  }
> = {
  email: {
    masterPos: [-6.4, 0, -3.2],
    subPos: [-6.4, 0, -1.0],
    rotationY: Math.PI / 2, // facing +X
    masterPose: "typing",
    subPose: "mouse_work",
  },
  shopee: {
    masterPos: [-6.4, 0, 2.2],
    subPos: [-6.4, 0, 4.4],
    rotationY: Math.PI / 2, // facing +X
    masterPose: "screen_pointing",
    subPose: "typing",
  },
  tiktok: {
    masterPos: [-1.4, 0, 5.2],
    subPos: [1.4, 0, 5.2],
    rotationY: Math.PI, // facing -Z
    masterPose: "coffee_break",
    subPose: "mouse_work",
  },
  lazada: {
    masterPos: [6.4, 0, 2.2],
    subPos: [6.4, 0, 4.4],
    rotationY: -Math.PI / 2, // facing -X
    masterPose: "headset_call",
    subPose: "typing",
  },
  facebook: {
    masterPos: [6.4, 0, -3.2],
    subPos: [6.4, 0, -1.0],
    rotationY: -Math.PI / 2, // facing -X
    masterPose: "coffee_break",
    subPose: "mouse_work",
  },
};

// ---- Master agents (one per channel) --------------------------------------
export const MASTER_AGENTS: CommandAgent[] = CHANNELS.map((channel) => {
  const meta = CHANNEL_META[channel];
  const cfg = POD_CONFIGS[channel];
  return {
    id: `${channel}-master`,
    name: `${meta.label} Master`,
    role: "Coordinator",
    tier: "master",
    channel,
    emoji: meta.emoji,
    color: meta.color,
    position: cfg.masterPos,
    rotationY: cfg.rotationY,
    poseType: cfg.masterPose,
    postInterval: 25000 + Math.random() * 10000,
    blurb: `Decides what the ${meta.label} sub-agent should do`,
  };
});

// ---- Sub agents (one per channel) -----------------------------------------
export const SUB_AGENTS: CommandAgent[] = CHANNELS.map((channel) => {
  const meta = CHANNEL_META[channel];
  const cfg = POD_CONFIGS[channel];
  return {
    id: `${channel}-sub`,
    name: `${meta.label} Sub`,
    role: "Worker",
    tier: "sub",
    channel,
    emoji: meta.emoji,
    color: meta.color,
    position: cfg.subPos,
    rotationY: cfg.rotationY,
    poseType: cfg.subPose,
    postInterval: 18000 + Math.random() * 12000,
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
