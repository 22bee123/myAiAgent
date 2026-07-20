// ===========================================================================
// lib/activityGenerator.ts
// ---------------------------------------------------------------------------
// Generates "what the agent is doing right now" messages for the unified
// boss chatbox.
//
// Two flavors:
//   - Mock generators for Shopee / TikTok / Lazada / FB Page — these produce
//     realistic-looking updates from a pool of canned templates, so the
//     command center feels alive without needing real API connections.
//   - A REAL generator for the Email sub-agent — it actually fetches the
//     user's inbox via /api/agents/email-agent/inbox and posts when there
//     are new emails. This way at least one channel gives you real data.
//
// To wire up real data for the other platforms later, swap the corresponding
// generator function for one that calls a real API (Shopee Open Platform,
// TikTok Business API, Lazada Open Platform, Facebook Graph API).
// ===========================================================================

import type { Channel } from "@/lib/commandAgents";

// ---- Public types ---------------------------------------------------------
export interface ActivityUpdate {
  id: string;
  agentId: string; // e.g. "email-master", "shopee-sub"
  channel: Channel;
  text: string;
  ts: number;
  /** Optional severity — "info" | "warning" | "success". Drives color tint. */
  severity?: "info" | "warning" | "success";
}

// ---- Helpers --------------------------------------------------------------
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function peso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---- Per-channel + per-tier generators -----------------------------------
// Each returns a single update text (and optional severity).

// ========== EMAIL ==========
const EMAIL_MASTER_TEMPLATES = [
  "Triage complete — {n} new emails, {u} unread, {flagged} flagged for review.",
  "Found {flagged} email(s) that look urgent. Forwarding to your attention.",
  "Inbox scan done. {n} newsletters auto-archived, {u} real messages surfaced.",
  "Drafted {drafts} reply templates for recurring threads. Ready when you are.",
  "Spam filter caught {spam} junk emails in the last hour. Inbox stays clean.",
];

const EMAIL_SUB_TEMPLATES = [
  "Fetched {n} new emails via IMAP. Newest from: {sender}.",
  "Categorized {n} emails — {work} work, {promo} promo, {social} social.",
  "Drafted a reply to {sender}. Subject: '{subject}'. Awaiting your approval.",
  "Archived {n} newsletters you've never opened. Inbox looks cleaner now.",
  "Synced inbox — {n} new since last check. No action needed on your part.",
];

// ========== SHOPEE ==========
const SHOPEE_MASTER_TEMPLATES = [
  "Daily Shopee sales: {sales}. {orders} orders to fulfill today.",
  "{pending} orders need shipping labels printed. Instructing sub-agent.",
  "One return request came in — order {orderId}. Reviewing return policy.",
  "Shopee Coins campaign ends in 2 days. Consider boosting top SKUs.",
  "Top seller today: '{productName}' ({units} units sold).",
];

const SHOPEE_SUB_TEMPLATES = [
  "Synced order {orderId} — {status}. Total: {sales}.",
  "Inventory updated: -{units} units of SKU-{sku} (now at {stock} in stock).",
  "Printed shipping label for order {orderId}. Ready for pickup.",
  "Replied to buyer question on order {orderId}: '{question}' → '{answer}'.",
  "Marked order {orderId} as shipped. Tracking: {tracking}.",
];

// ========== TIKTOK ==========
const TIKTOK_MASTER_TEMPLATES = [
  "Daily TikTok summary: {views} views, {likes} likes, {followers} new followers.",
  "Your latest video is trending — {views} views in the last hour.",
  "{comments} new comments across your videos. {toxic} flagged for moderation.",
  "Best performing video today: '{title}' ({views} views, {shares} shares).",
  "Suggest posting in the next 30 min — that's your audience's peak window.",
];

const TIKTOK_SUB_TEMPLATES = [
  "Posted scheduled video: '{title}'. Live now at {url}.",
  "Replied to {n} comments on your latest video.",
  "Auto-moderated 1 toxic comment on '{title}'. Removed + user hidden.",
  "Generated 3 video ideas based on trending sounds: {ideas}.",
  "Synced analytics — your video '{title}' gained {views} new views overnight.",
];

// ========== LAZADA ==========
const LAZADA_MASTER_TEMPLATES = [
  "Daily Lazada sales: {sales}. {orders} orders processed.",
  "1 order returned: order {orderId} (₱{amount} refund pending).",
  "Lazada Flash Sale starts tomorrow 12pm. 3 SKUs enrolled.",
  "{pending} orders awaiting shipment. Sub-agent is processing them now.",
  "Promo campaign 'Weekend Deals' generated {sales} in revenue so far.",
];

const LAZADA_SUB_TEMPLATES = [
  "Updated tracking for order {orderId} — status: {status}.",
  "Processed refund request #R-{refundId} for ₱{amount}. Buyer notified.",
  "Synced inventory: {n} SKUs updated, {low} marked as low-stock.",
  "Responded to customer review on '{productName}': thanked them for the feedback.",
  "Marked order {orderId} as ready-to-ship. Packed and labeled.",
];

// ========== FACEBOOK PAGE ==========
const FB_MASTER_TEMPLATES = [
  "Daily FB Page summary: {likes} new likes, {reach} post reach, {msgs} messages.",
  "1 customer message waiting — from {customerName}. Sub-agent is drafting a reply.",
  "Your post about '{topic}' got {reach} reach and {engagement} engagements.",
  "{comments} new comments across your posts. {questions} are questions to answer.",
  "Page insights: +{likes} followers this week. Best post: '{topic}'.",
];

const FB_SUB_TEMPLATES = [
  "Auto-replied to FAQ: '{question}' → '{answer}'. Customer notified.",
  "Scheduled 2 posts for tomorrow at 9am and 6pm (peak engagement windows).",
  "Replied to customer {customerName}: '{reply}'.",
  "Boosted post '{topic}' for ₱200 — targeting 18-34 audience in Metro Manila.",
  "Synced comments — {n} new. {toxic} hidden for spam, {questions} flagged for human reply.",
];

// ---- Substitution helper --------------------------------------------------
// Replaces {tokens} in a template with values from the provided map.
function substitute(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

// ---- Random variable generators per channel ------------------------------
// These produce the {token} values for the templates above. Each call gives
// fresh random values so the messages feel realistic and varied.

function emailVars() {
  return {
    n: 3 + Math.floor(Math.random() * 12),
    u: 1 + Math.floor(Math.random() * 5),
    flagged: Math.floor(Math.random() * 3),
    drafts: 1 + Math.floor(Math.random() * 5),
    spam: 5 + Math.floor(Math.random() * 20),
    sender: pick([
      "Acme Recruiting",
      "Indeed",
      "Jobstreet",
      "Stratpoint HR",
      "micro1 AI",
      "Microsoft Teams",
      "GitHub",
    ]),
    subject: pick([
      "Interview invitation",
      "Following up on your application",
      "Your invoice is ready",
      "New comment on your PR",
      "Weekly digest",
    ]),
    work: 1 + Math.floor(Math.random() * 6),
    promo: 1 + Math.floor(Math.random() * 8),
    social: 1 + Math.floor(Math.random() * 4),
  };
}

function shopeeVars() {
  const orderId = `SHX${Math.floor(Math.random() * 90000000 + 10000000)}`;
  return {
    sales: peso(500 + Math.floor(Math.random() * 8000)),
    orders: 1 + Math.floor(Math.random() * 8),
    pending: 1 + Math.floor(Math.random() * 4),
    orderId,
    units: 1 + Math.floor(Math.random() * 5),
    sku: Math.floor(Math.random() * 9000 + 1000),
    stock: 5 + Math.floor(Math.random() * 50),
    status: pick(["To Ship", "Shipping", "Delivered", "Returned"]),
    tracking: `SLSG${Math.floor(Math.random() * 900000 + 100000)}`,
    productName: pick([
      "Wireless Earbuds Pro",
      "USB-C Hub 7-in-1",
      "Mechanical Keyboard 60%",
      "Phone Case iPhone 15",
      "LED Desk Lamp",
    ]),
    question: pick([
      "When will this arrive?",
      "Is this still in stock?",
      "Do you have other colors?",
    ]),
    answer: pick([
      "Ships tomorrow, arrives in 2-3 days.",
      "Yes, 12 units left in stock!",
      "Yes, we have black, white, and blue.",
    ]),
  };
}

function tiktokVars() {
  return {
    views: `${(1 + Math.random() * 50).toFixed(1)}k`,
    likes: `${Math.floor(100 + Math.random() * 4000)}`,
    followers: `${Math.floor(5 + Math.random() * 80)}`,
    comments: `${Math.floor(5 + Math.random() * 60)}`,
    toxic: `${Math.floor(Math.random() * 3)}`,
    shares: `${Math.floor(10 + Math.random() * 200)}`,
    title: pick([
      "5 productivity tips that actually work",
      "Behind the scenes of my setup",
      "Trying the new AI tool everyone's talking about",
      "Day in the life of a remote dev",
      "How I built my AI office",
    ]),
    url: `tiktok.com/@paulkian/video/${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    n: 1 + Math.floor(Math.random() * 5),
    ideas: "AI productivity, day-in-the-life vlog, app review",
  };
}

function lazadaVars() {
  const orderId = `LZ${Math.floor(Math.random() * 90000000 + 10000000)}`;
  return {
    sales: peso(300 + Math.floor(Math.random() * 6000)),
    orders: 1 + Math.floor(Math.random() * 6),
    orderId,
    amount: 100 + Math.floor(Math.random() * 2000),
    pending: 1 + Math.floor(Math.random() * 4),
    status: pick(["Packed", "Shipped", "Out for delivery", "Delivered"]),
    refundId: Math.floor(Math.random() * 9000 + 1000),
    n: 1 + Math.floor(Math.random() * 8),
    low: Math.floor(Math.random() * 3),
    productName: pick([
      "Bluetooth Speaker",
      "Smart Watch",
      "Wireless Charger",
      "Laptop Stand",
    ]),
  };
}

function fbVars() {
  return {
    likes: `${Math.floor(5 + Math.random() * 50)}`,
    reach: `${Math.floor(200 + Math.random() * 5000)}`,
    msgs: `${Math.floor(Math.random() * 5)}`,
    engagement: `${Math.floor(20 + Math.random() * 400)}`,
    comments: `${Math.floor(5 + Math.random() * 40)}`,
    questions: `${Math.floor(Math.random() * 4)}`,
    topic: pick([
      "our new product launch",
      "the upcoming sale",
      "behind the scenes",
      "customer success story",
      "weekend promo",
    ]),
    customerName: pick([
      "Maria Santos",
      "Juan Dela Cruz",
      "Andrea Lim",
      "Mark Reyes",
      "Bea Cruz",
    ]),
    reply: pick([
      "Hi! Yes, the item is still available. You can order via the link in our bio.",
      "Thanks for reaching out! Our team will get back to you within 24 hours.",
      "Hi! Shipping takes 2-3 business days within Metro Manila.",
    ]),
    n: 1 + Math.floor(Math.random() * 8),
    toxic: Math.floor(Math.random() * 2),
    question: pick([
      "Do you deliver to provinces?",
      "What are your business hours?",
      "Is this still available?",
    ]),
    answer: pick([
      "Yes, we deliver nationwide via LBC/JRS!",
      "We're open Mon-Sat, 9am-6pm.",
      "Yes, it's in stock!",
    ]),
  };
}

// ---- Main entry points ----------------------------------------------------
// generateMockUpdate(channel, tier) — for mocked channels.
// generateRealEmailUpdate() — fetches real inbox and returns an update if
// there's something new since the last check.

export function generateMockUpdate(
  channel: Channel,
  tier: "master" | "sub"
): { text: string; severity?: ActivityUpdate["severity"] } {
  if (channel === "email") {
    // Email uses real data via generateRealEmailUpdate; this branch only
    // runs as a fallback if the real fetch fails.
    const v = emailVars();
    const template = pick(
      tier === "master" ? EMAIL_MASTER_TEMPLATES : EMAIL_SUB_TEMPLATES
    );
    return { text: substitute(template, v) };
  }

  if (channel === "shopee") {
    const v = shopeeVars();
    const template = pick(
      tier === "master" ? SHOPEE_MASTER_TEMPLATES : SHOPEE_SUB_TEMPLATES
    );
    return {
      text: substitute(template, v),
      severity: v.pending > 2 ? "warning" : "info",
    };
  }

  if (channel === "tiktok") {
    const v = tiktokVars();
    const template = pick(
      tier === "master" ? TIKTOK_MASTER_TEMPLATES : TIKTOK_SUB_TEMPLATES
    );
    return {
      text: substitute(template, v),
      severity: parseFloat(v.views) > 20 ? "success" : "info",
    };
  }

  if (channel === "lazada") {
    const v = lazadaVars();
    const template = pick(
      tier === "master" ? LAZADA_MASTER_TEMPLATES : LAZADA_SUB_TEMPLATES
    );
    return {
      text: substitute(template, v),
      severity: v.low > 0 ? "warning" : "info",
    };
  }

  // facebook
  const v = fbVars();
  const template = pick(
    tier === "master" ? FB_MASTER_TEMPLATES : FB_SUB_TEMPLATES
  );
  return {
    text: substitute(template, v),
    severity: parseInt(v.msgs) > 0 ? "warning" : "info",
  };
}

// ---- Real Email update generator -----------------------------------------
// Fetches the latest 5 emails from the inbox. If there are any unread emails
// that weren't already reported, returns an update describing them.
//
// `lastSeenUids` is a Set of UIDs we've already posted about — pass it in
// to avoid duplicate posts. We add the new UIDs we see this round so the
// caller can update its tracking set.

let lastSeenEmailUids = new Set<number>();

export async function generateRealEmailUpdate(): Promise<
  { text: string; severity: ActivityUpdate["severity"]; newUids: number[] } | null
> {
  try {
    const res = await fetch(
      `/api/agents/email-agent/inbox?limit=5`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.connected || !data.messages?.length) return null;

    // Find unread emails we haven't reported yet
    const newUnread = data.messages.filter(
      (m: { uid: number; unread: boolean; from: string; subject: string }) =>
        m.unread && !lastSeenEmailUids.has(m.uid)
    );

    // Always mark what we've seen (even read ones, so we don't re-report
    // them if they get marked unread later)
    for (const m of data.messages) {
      lastSeenEmailUids.add(m.uid);
    }
    // Keep the set from growing unbounded — only keep last 50
    if (lastSeenEmailUids.size > 50) {
      const arr = Array.from(lastSeenEmailUids).slice(-50);
      lastSeenEmailUids = new Set(arr);
    }

    if (newUnread.length === 0) {
      // No new unread — return a periodic status instead, but only ~1 in 3
      // times so we don't spam the feed.
      if (Math.random() > 0.33) return null;
      return {
        text: `Inbox check complete. ${data.unread} unread of ${data.total} total. No new mail since last check.`,
        severity: "info",
        newUids: [],
      };
    }

    // Build a summary of the new unread emails
    const summary = newUnread
      .slice(0, 3)
      .map(
        (m: { from: string; subject: string }) =>
          `• ${m.from.split("<")[0].trim()} — "${m.subject}"`
      )
      .join("\n");

    return {
      text:
        newUnread.length === 1
          ? `📬 1 new email:\n${summary}`
          : `📬 ${newUnread.length} new emails:\n${summary}`,
      severity: newUnread.length > 2 ? "warning" : "info",
      newUids: newUnread.map((m: { uid: number }) => m.uid),
    };
  } catch (err) {
    console.error("[email-update] fetch failed:", err);
    return null;
  }
}

// ---- Convenience: build a complete update object --------------------------
export function buildUpdate(
  agentId: string,
  channel: Channel,
  text: string,
  severity: ActivityUpdate["severity"] = "info"
): ActivityUpdate {
  return {
    id: makeId(),
    agentId,
    channel,
    text,
    severity,
    ts: Date.now(),
  };
}
