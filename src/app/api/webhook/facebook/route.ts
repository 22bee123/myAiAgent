// ===========================================================================
// app/api/webhook/facebook/route.ts
// ---------------------------------------------------------------------------
// Facebook Messenger Webhook endpoint.
//
// GET  → Webhook verification handshake (called once when you register the
//         webhook URL in the Meta Developer Dashboard).
// POST → Receives incoming Messenger events (messages, postbacks, etc.),
//         verifies the request signature, and dispatches each message to
//         the channel-master routing function for an AI-generated reply.
//
// IMPORTANT: Facebook requires the POST handler to return 200 within 20
// seconds or it will retry (and eventually disable) the webhook. We ACK
// immediately and process messages asynchronously in the background.
//
// Env vars required:
//   FB_VERIFY_TOKEN       – the string you chose when subscribing the webhook
//   FB_APP_SECRET         – your app's secret (for HMAC signature verification)
//   FB_PAGE_ACCESS_TOKEN  – Page token with `pages_messaging` permission
//   FB_PAGE_ID            – your Page's numeric ID
// ===========================================================================

import { NextRequest, NextResponse } from "next/server";
import { sendFacebookMessage } from "@/lib/facebook";
import type {
  WebhookBody,
  WebhookEntry,
  MessagingEvent,
} from "@/lib/facebookTypes";

// Force dynamic — webhook payloads are never cacheable.
export const dynamic = "force-dynamic";

// ---- Config ---------------------------------------------------------------

const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const FB_APP_SECRET = process.env.FB_APP_SECRET;

// ---- GET: Webhook verification handshake ----------------------------------
// Facebook sends a GET with hub.mode, hub.verify_token, and hub.challenge.
// We echo hub.challenge back if the token matches; otherwise reject with 403.

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === FB_VERIFY_TOKEN) {
    console.log("[fb-webhook] ✅ Verification successful");
    // Facebook expects the challenge echoed back as plain text, not JSON.
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[fb-webhook] ❌ Verification failed — token mismatch");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ---- POST: Incoming Messenger events --------------------------------------

export async function POST(req: NextRequest) {
  // 1. Read the raw body (needed for signature verification AND parsing).
  const rawBody = await req.text();

  // 2. Verify the X-Hub-Signature-256 header.
  if (FB_APP_SECRET) {
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    const isValid = await verifySignature(rawBody, signature, FB_APP_SECRET);
    if (!isValid) {
      console.error("[fb-webhook] ❌ Invalid signature — rejecting request");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  } else {
    // No FB_APP_SECRET configured — skip verification but warn loudly.
    console.warn(
      "[fb-webhook] ⚠️  FB_APP_SECRET not set — skipping signature verification. " +
        "This is insecure in production!"
    );
  }

  // 3. Parse the JSON body.
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    console.error("[fb-webhook] Failed to parse JSON body");
    // Still return 200 — bad parse is our problem, not Facebook's.
    return NextResponse.json({ status: "parse_error" }, { status: 200 });
  }

  // 4. Only process "page" object events.
  if (body.object !== "page") {
    console.warn(`[fb-webhook] Ignoring non-page object: "${body.object}"`);
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // 5. ACK immediately (return 200) and process events in the background.
  //    This prevents Facebook from retrying if our AI takes a while.
  //
  //    NOTE: In Vercel serverless functions, the runtime may kill the process
  //    after the response is sent. For truly fire-and-forget background work
  //    on Vercel, use `waitUntil` (available on the Vercel Edge/Node runtime).
  //    We use a simple promise-based approach here which works for most cases.
  const processingPromise = processEntries(body.entry).catch((err) => {
    console.error("[fb-webhook] Background processing failed:", err);
  });

  // Use waitUntil if available (Vercel Node.js runtime exposes it).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctxWithWaitUntil = (globalThis as any).__nextWaitUntil;
  if (typeof ctxWithWaitUntil === "function") {
    ctxWithWaitUntil(processingPromise);
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// ---- Signature verification -----------------------------------------------

/**
 * Verifies the HMAC-SHA256 signature that Facebook includes in the
 * `X-Hub-Signature-256` header. Format: "sha256=<hex-digest>".
 */
async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signatureHeader.slice("sha256=".length);

  // Use the Web Crypto API (available in Node 18+ and all modern runtimes).
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );

  const expectedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison: compare character-by-character but always process
  // every character to avoid timing side-channels.
  if (receivedHex.length !== expectedHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < receivedHex.length; i++) {
    mismatch |= receivedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---- Event processing -----------------------------------------------------

/**
 * Iterates over all entries and messaging events, dispatching each incoming
 * user message to the channel-master router for an AI-generated reply.
 */
async function processEntries(entries: WebhookEntry[]): Promise<void> {
  for (const entry of entries) {
    if (!entry.messaging?.length) continue;

    for (const event of entry.messaging) {
      try {
        await handleMessagingEvent(event);
      } catch (err) {
        console.error(
          `[fb-webhook] Error handling event from ${event.sender?.id}:`,
          err
        );
        // Continue processing other events — don't let one failure block the rest.
      }
    }
  }
}

/**
 * Handles a single messaging event. Currently processes:
 *   - Text messages → routed to the AI channel master for a reply.
 *   - Postbacks → same treatment (uses the postback payload as "message").
 *
 * Ignores echoes (messages sent BY the Page) and delivery/read events.
 */
async function handleMessagingEvent(event: MessagingEvent): Promise<void> {
  const senderId = event.sender?.id;
  if (!senderId) return;

  // --- Text message ---
  if (event.message) {
    // Ignore echo messages (messages sent by the Page itself).
    if (event.message.is_echo) return;

    const text = event.message.text;
    if (!text) {
      // Attachment-only messages (images, stickers, etc.) — acknowledge but
      // don't process. You can extend this later to handle media.
      console.log(
        `[fb-webhook] Received non-text message from ${senderId} (attachment/sticker)`
      );
      return;
    }

    console.log(`[fb-webhook] 💬 Message from ${senderId}: "${text}"`);

    // Route through the AI agent hierarchy for a reply.
    const reply = await routeToChannelMaster("facebook", senderId, text);

    // Send the AI-generated reply back to the user.
    const result = await sendFacebookMessage(senderId, reply);
    if (!result.ok) {
      console.error(`[fb-webhook] Failed to send reply to ${senderId}:`, result.error);
    }
    return;
  }

  // --- Postback (button tap) ---
  if (event.postback) {
    const payload = event.postback.payload;
    console.log(`[fb-webhook] 🔘 Postback from ${senderId}: "${payload}"`);

    const reply = await routeToChannelMaster("facebook", senderId, payload);
    const result = await sendFacebookMessage(senderId, reply);
    if (!result.ok) {
      console.error(`[fb-webhook] Failed to send postback reply to ${senderId}:`, result.error);
    }
    return;
  }

  // --- Delivery / Read / Other events — silently ignore ---
}

// ---- Channel Master routing (stub) ----------------------------------------

/**
 * Routes an incoming message to the appropriate AI channel master for
 * processing. The channel master will coordinate with its sub-bots and
 * return a reply.
 *
 * TODO: Replace this stub with your actual Boss → Channel Master → Sub-bot
 * routing logic. This should:
 *   1. Look up the channel master agent for the given channel
 *   2. Pass the message through your AI pipeline (DeepSeek, GPT, etc.)
 *   3. Return the generated reply text
 *
 * For now, returns a friendly default reply so the webhook works end-to-end
 * while you build out the AI logic.
 *
 * @param channel   The channel this message came from (always "facebook" here).
 * @param senderId  The sender's Page-Scoped ID (PSID).
 * @param message   The incoming message text (or postback payload).
 * @returns         The reply text to send back to the user.
 */
async function routeToChannelMaster(
  channel: "facebook",
  senderId: string,
  message: string
): Promise<string> {
  // TODO: Wire this to your actual AI agent hierarchy.
  // Example integration point:
  //
  //   import { getMasterForChannel } from "@/lib/commandAgents";
  //   import { callDeepSeek } from "@/lib/deepseek";
  //
  //   const master = getMasterForChannel(channel);
  //   const systemPrompt = master.systemPrompt;
  //   const reply = await callDeepSeek(systemPrompt, message, senderId);
  //   return reply;

  console.log(
    `[fb-webhook] routeToChannelMaster(${channel}, ${senderId}, "${message}")`
  );

  // Default fallback reply — proves the webhook is working.
  return (
    "Thanks for your message! 🤖 Our AI agent is setting up and will be " +
    "fully operational soon. We'll get back to you shortly!"
  );
}
