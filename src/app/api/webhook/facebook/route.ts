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

import { NextRequest, NextResponse, after } from "next/server";
import {
  sendFacebookMessage,
  uploadFacebookPhoto,
  createFacebookPost,
} from "@/lib/facebook";
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
  //    In Vercel serverless functions, `after()` ensures the function stays
  //    alive after sending the 200 OK response to Facebook.
  after(async () => {
    try {
      await processEntries(body.entry);
    } catch (err) {
      console.error("[fb-webhook] Background processing failed:", err);
    }
  });

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
 *   - Image attachments → automatically publishes the photo to the Facebook Page feed!
 *   - Post commands (e.g. "post to page: ...") → publishes text post to Page feed.
 *   - Text messages → routed to the AI channel master for an AI reply.
 *   - Postbacks → routed to AI channel master.
 *
 * Ignores echoes (messages sent BY the Page) and delivery/read events.
 */
async function handleMessagingEvent(event: MessagingEvent): Promise<void> {
  const senderId = event.sender?.id;
  if (!senderId) return;

  // --- Text message / Attachment ---
  if (event.message) {
    // Ignore echo messages (messages sent by the Page itself).
    if (event.message.is_echo) return;

    const text = (event.message.text ?? "").trim();
    const attachments = event.message.attachments ?? [];

    // 1. Check for Image Attachments -> Auto-post Photo to Facebook Page Feed!
    const imageAttachment = attachments.find((att) => att.type === "image");
    if (imageAttachment?.payload?.url) {
      const imageUrl = imageAttachment.payload.url as string;
      console.log(`[fb-webhook] 📸 Image attachment received from ${senderId}: ${imageUrl}`);

      const postResult = await uploadFacebookPhoto(imageUrl, true, text || undefined);

      if (postResult.ok) {
        const confirmText = `📸 ✅ Success! Your photo has been automatically published to your Facebook Page!\n\nPost ID: ${postResult.data.id}${text ? `\nCaption: "${text}"` : ""}`;
        await sendFacebookMessage(senderId, confirmText);
      } else {
        console.error(`[fb-webhook] Failed to publish photo post:`, postResult.error);
        const errText = `❌ Failed to auto-post photo to Facebook Page: ${postResult.error}`;
        await sendFacebookMessage(senderId, errText);
      }
      return;
    }

    // 2. Check for explicit text-only auto-post commands (e.g. "post to page: Hello world!")
    const postCommandMatch = text.match(/^(?:post|publish|auto\s*post|share)\s*(?:to\s*page|on\s*page)?\s*:\s*(.+)$/i);
    if (postCommandMatch && postCommandMatch[1]) {
      const contentToPost = postCommandMatch[1].trim();
      console.log(`[fb-webhook] 📢 Text auto-post command detected: "${contentToPost}"`);

      const postResult = await createFacebookPost(contentToPost);

      if (postResult.ok) {
        const confirmText = `📢 ✅ Success! Your post has been published to your Facebook Page!\n\nPost ID: ${postResult.data.id}`;
        await sendFacebookMessage(senderId, confirmText);
      } else {
        console.error(`[fb-webhook] Failed to publish text post:`, postResult.error);
        const errText = `❌ Failed to publish post to Facebook Page: ${postResult.error}`;
        await sendFacebookMessage(senderId, errText);
      }
      return;
    }

    if (!text) {
      console.log(`[fb-webhook] Received non-text/non-image message from ${senderId}`);
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

// ---- Channel Master routing (AI Integration) ------------------------------

/**
 * Routes an incoming Facebook message to the AI engine (DeepSeek) to generate
 * an intelligent response.
 */
async function routeToChannelMaster(
  channel: "facebook",
  senderId: string,
  message: string
): Promise<string> {
  console.log(
    `[fb-webhook] 🤖 Processing message for ${channel} from sender ${senderId}: "${message}"`
  );

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    console.warn("[fb-webhook] DEEPSEEK_API_KEY not configured, using default reply");
    return "Thanks for your message! 🤖 Our AI Facebook Assistant is setting up and will be fully operational soon!";
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are the official AI Assistant for our Facebook Page. " +
              "Provide helpful, friendly, and concise responses (1-3 sentences max) to user messages.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.6,
        max_tokens: 250,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[fb-webhook] DeepSeek API error ${res.status}:`, errText);
      return "Thanks for reaching out! We've received your message and will reply shortly.";
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (reply) {
      console.log(`[fb-webhook] ✨ DeepSeek generated reply: "${reply}"`);
      return reply;
    }
  } catch (err) {
    console.error("[fb-webhook] Error calling DeepSeek:", err);
  }

  return "Thanks for reaching out! We've received your message and will reply shortly.";
}
