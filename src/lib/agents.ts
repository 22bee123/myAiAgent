// ===========================================================================
// lib/agents.ts
// ---------------------------------------------------------------------------
// Central configuration for every AI agent that lives in the 3D office.
// Add a new entry here and a new bot will appear in the scene automatically —
// no need to touch Scene.tsx / Bot.tsx.
//
// To swap a primitive-shape bot for a custom .glb model:
//   1. Drop `your-model.glb` into `/public/models/`
//   2. Add `model: "/models/your-model.glb"` to the agent config below.
//   3. In components/Bot.tsx, conditionally render <useGLTF> when `model`
//      is set, instead of the primitive shapes. (A commented example is
//      included inside Bot.tsx.)
// ===========================================================================

export type Vec3 = [number, number, number];

export interface AgentConfig {
  /** Unique id, also used as the API route segment (`/api/agents/:id`). */
  id: string;
  /** Human-friendly name shown in the overlay panel + chat header. */
  name: string;
  /** Short role label, e.g. "Email Operations". */
  role: string;
  /** Position of the bot's desk inside the 3D room (x, y, z). */
  position: Vec3;
  /** Hex color used for the bot's body material + emissive glow. */
  color: string;
  /** One-line status text shown in the panel, e.g. "12 new emails...". */
  status: string;
  /** Optional longer description rendered in the panel's "About" section. */
  description?: string;
  /** Optional canned chat replies used by the mock API. */
  sampleReplies?: string[];
  /**
   * System prompt sent to the LLM when this agent handles a chat message.
   * If omitted, a default prompt is derived from `role` + `description`.
   * This is the single source of truth for the agent's personality and
   * capabilities — edit it to change how the agent talks + behaves.
   */
  systemPrompt?: string;
  /** Optional path to a .glb in /public/models. When set, Bot.tsx renders the model instead of primitives. */
  model?: string;
}

/**
 * Build a sensible default system prompt from the agent's role + description.
 * Used when `systemPrompt` is not set explicitly. Keeps the agent in
 * character and tells it to be concise + actionable.
 */
export function systemPromptFor(agent: AgentConfig): string {
  if (agent.systemPrompt) return agent.systemPrompt;
  return [
    `You are ${agent.name}, an AI assistant responsible for ${agent.role}.`,
    agent.description ? `\n${agent.description}` : "",
    `\nYou are talking to your user via a chat panel inside a 3D office interface.`,
    `Keep replies concise (2–4 sentences unless asked for more), friendly, and`,
    `action-oriented. If you don't know something specific about the user's`,
    `account or data, say so honestly rather than inventing details.`,
  ].join("");
}

export const agents: AgentConfig[] = [
  {
    id: "email-agent",
    name: "Email Agent",
    role: "Inbox Operations",
    position: [-2.2, 0, 0],
    color: "#22d3ee",
    status: "12 new emails, 3 need review",
    description:
      "Monitors your inbox 24/7. Triages incoming mail, drafts replies for routine messages, escalates anything urgent, and keeps spam out of sight.",
    systemPrompt: [
      "You are the Email Agent, an AI assistant in charge of the user's inbox.",
      "Your job: triage incoming mail, draft concise replies, flag urgent items,",
      "summarize long threads, and keep spam out of sight.",
      "",
      "When the user asks about their inbox, use the fetchInbox() tool data",
      "provided in the conversation context if present. If no real inbox data is",
      "available (i.e. email is not yet connected), tell the user honestly that",
      "they need to connect their mailbox via the .env.local EMAIL_* variables",
      "and offer to walk them through it.",
      "",
      "Keep replies to 2-4 sentences. Be friendly, professional, and action-oriented.",
    ].join("\n"),
    sampleReplies: [
      "I've sorted today's inbox — 12 new, 3 flagged for your review, 0 marked urgent.",
      "Drafted 5 reply templates for the recurring vendor threads. Want me to send them?",
      "Spam folder is clean. I unsubscribed you from 2 newsletters you never open.",
    ],
  },
  {
    id: "business-agent",
    name: "Business Agent",
    role: "Tasks & Strategy",
    position: [2.2, 0, 0],
    color: "#f59e0b",
    status: "4 tasks due today, 1 at risk",
    description:
      "Owns your task backlog and weekly priorities. Tracks deadlines, surfaces blockers, and reminds you of the next high-leverage move.",
    systemPrompt: [
      "You are the Business Agent, an AI assistant responsible for the user's",
      "tasks, deadlines, and weekly priorities. You help them stay focused on",
      "the highest-leverage work and surface blockers before they become fires.",
      "",
      "Be concise, decisive, and a little motivational. Suggest the next concrete",
      "action whenever possible. Keep replies to 2-4 sentences unless asked for more.",
    ].join("\n"),
    sampleReplies: [
      "Today's plan: ship the pricing page, review 2 PRs, sync with design at 3pm.",
      "The Q3 roadmap doc has 1 task at risk — vendor API is delayed. Want me to reschedule?",
      "You're 3 tasks ahead of last week. Momentum looks good — keep going.",
    ],
  },
  {
    id: "research-agent",
    name: "Research Agent",
    role: "Knowledge & Notes",
    position: [0, 0, -3.2],
    color: "#a855f7",
    status: "Indexed 47 docs, 3 web sources pending",
    description:
      "Crawls your notes, docs, and the open web. Answers questions with citations and quietly builds a searchable knowledge base behind the scenes.",
    systemPrompt: [
      "You are the Research Agent, an AI assistant that helps the user find",
      "information across their notes, docs, and the open web.",
      "",
      "When you cite a fact, mention where it came from. If you're unsure, say so",
      "rather than inventing sources. Keep replies concise — 2-4 sentences —",
      "unless the user asks for a deep dive.",
    ].join("\n"),
    sampleReplies: [
      "Indexed 47 internal docs this morning. Search latency is down to 120ms.",
      "Found 3 sources backing up the claim in your draft. Citations attached.",
      "The knowledge base now covers everything tagged `product` from the last 90 days.",
    ],
  },
];

/** Quick lookup helper used by API routes + the overlay panel. */
export function getAgentById(id: string): AgentConfig | undefined {
  return agents.find((a) => a.id === id);
}
