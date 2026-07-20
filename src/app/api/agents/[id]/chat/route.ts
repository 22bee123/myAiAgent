// ===========================================================================
// app/api/agents/[id]/chat/route.ts
// ---------------------------------------------------------------------------
// POST /api/agents/:id/chat
//   body: { message: string }
//   res:  { reply: string, model: string, source: "deepseek" | "mock" }
//
// Wires the chat panel to the DeepSeek API. DeepSeek is OpenAI-compatible,
// so we can hit its /chat/completions endpoint directly with fetch — no SDK
// needed.
//
// The agent's system prompt comes from `systemPromptFor(agent)` in
// lib/agents.ts. Edit the prompt there to change how each agent behaves.
//
// If DEEPSEEK_API_KEY is not set (or is still the placeholder), we fall back
// to the canned mock replies so the demo still works without a key. This
// makes local dev frictionless and the Vercel preview functional even
// before the user plugs in real credentials.
// ===========================================================================

import { NextResponse } from "next/server";
import { getAgentById, systemPromptFor } from "@/lib/agents";
import { fetchInbox } from "@/lib/email";
import { buildTracker } from "@/lib/applications";

export const dynamic = "force-dynamic";
// DeepSeek calls can take a few seconds — give the route plenty of room.
export const maxDuration = 30;

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const PLACEHOLDER_KEY = "sk-REPLACE_ME_WITH_A_FRESH_KEY";
function isKeyConfigured(key: string | undefined): key is string {
  return !!key && key.length > 0 && key !== PLACEHOLDER_KEY;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = getAgentById(id);

  if (!agent) {
    return NextResponse.json(
      { error: `Agent "${id}" not found` },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const userMessage: string = (body?.message ?? "").toString().trim();

  if (!userMessage) {
    return NextResponse.json(
      { error: "Missing `message` in request body" },
      { status: 400 }
    );
  }

  // --- Real LLM call via DeepSeek -----------------------------------------
  if (isKeyConfigured(DEEPSEEK_API_KEY)) {
    try {
      // Build the system prompt. For the Email Agent, we additionally fetch
      // the user's real inbox and inject a compact summary into the prompt
      // so the LLM can answer questions like "what's in my inbox?" or
      // "any urgent emails?" with actual data instead of making things up.
      //
      // The inbox fetch is fast (one IMAP call) and gracefully falls back
      // to mock data when email isn't configured, in which case the prompt
      // tells the LLM to ask the user to connect their mailbox.
      let systemPrompt = systemPromptFor(agent);

      if (agent.id === "email-agent") {
        try {
          const inbox = await fetchInbox(8);
          if (inbox.connected && inbox.messages.length > 0) {
            const inboxSummary = inbox.messages
              .map(
                (m, i) =>
                  `${i + 1}. ${m.unread ? "[UNREAD]" : "[read]"} ` +
                  `From: ${m.from} | Subject: ${m.subject} | ` +
                  `Date: ${m.date} | Preview: ${m.snippet.slice(0, 120)}`
              )
              .join("\n");
            systemPrompt += [
              "",
              "---- LIVE INBOX DATA (use this to answer questions about the user's",
              "inbox; do NOT invent emails that aren't listed here) ----",
              `Total messages in inbox: ${inbox.total}`,
              `Unread: ${inbox.unread}`,
              `Most recent ${inbox.messages.length} messages:`,
              inboxSummary,
              "",
              "If the user asks you to send, reply to, or delete an email, tell",
              "them you can't take direct action yet — but you can draft the",
              "reply text and they can send it via the Send Email button.",
            ].join("\n");
          } else {
            systemPrompt += [
              "",
              "---- INBOX STATUS ----",
              "The user has NOT connected their mailbox yet (no IMAP credentials",
              "in .env.local). When they ask about their inbox, tell them",
              "honestly that email isn't connected, and offer to walk them",
              "through the setup steps (get a Gmail App Password from",
              "myaccount.google.com/apppasswords, then set EMAIL_HOST,",
              "EMAIL_USER, EMAIL_PASS, SMTP_HOST, SMTP_FROM in .env.local).",
            ].join("\n");
          }
        } catch (inboxErr) {
          // Don't fail the whole chat request if inbox fetch breaks — just
          // log it and let the LLM answer without inbox context.
          console.error(
            `[chat:${id}] inbox fetch failed, continuing without:`,
            inboxErr instanceof Error ? inboxErr.message : String(inboxErr)
          );
        }
      }

      // ---- Applications Agent: inject tracker context -----------------
      // Same pattern as email-agent above, but with the application tracker
      // instead of the raw inbox. The LLM gets a compact list of applications
      // + statuses so it can answer "any updates on my applications?" with
      // real data.
      if (agent.id === "applications-agent") {
        try {
          const tracker = await buildTracker(50);
          if (tracker.connected && tracker.applications.length > 0) {
            const trackerSummary = tracker.applications
              .slice(0, 20)
              .map(
                (a, i) =>
                  `${i + 1}. [${a.status.toUpperCase()}] ${a.role} @ ${a.company} ` +
                  `— last update ${a.daysSinceUpdate}d ago ` +
                  `(${new Date(a.lastUpdate).toLocaleDateString()}) ` +
                  `Latest email: "${a.latestEmail.subject}"`
              )
              .join("\n");
            systemPrompt += [
              "",
              "---- LIVE APPLICATION TRACKER (use this to answer questions about the",
              "user's job applications; do NOT invent applications that aren't",
              "listed here) ----",
              `Total applications being tracked: ${tracker.total}`,
              `By status: ${Object.entries(tracker.byStatus)
                .filter(([_, v]) => v > 0)
                .map(([k, v]) => `${v} ${k}`)
                .join(", ")}`,
              "",
              trackerSummary,
              "",
              "Statuses mean: applied = user submitted app; viewed = recruiter",
              "looked at it; interview = interview invited; offer = offer",
              "extended; closed = role closed/expired/rejected.",
              "",
              "If the user asks about an application not in this list, tell them",
              "you don't see it in their inbox and suggest they might have",
              "applied via a different email account.",
            ].join("\n");
          } else {
            systemPrompt += [
              "",
              "---- APPLICATION TRACKER STATUS ----",
              "The user has NOT connected their mailbox yet (no IMAP credentials",
              "in .env.local). When they ask about their applications, tell them",
              "honestly that email isn't connected, and offer to walk them through",
              "the setup steps (get a Gmail App Password from",
              "myaccount.google.com/apppasswords, then set EMAIL_HOST, EMAIL_USER,",
              "EMAIL_PASS, SMTP_HOST, SMTP_FROM in .env.local).",
            ].join("\n");
          }
        } catch (trackerErr) {
          console.error(
            `[chat:${id}] tracker fetch failed, continuing without:`,
            trackerErr instanceof Error ? trackerErr.message : String(trackerErr)
          );
        }
      }

      const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          // Slightly below default for snappier UI; raise if you want more
          // thorough replies.
          temperature: 0.6,
          // Hard cap so a runaway reply can't scroll the panel forever.
          max_tokens: 400,
          stream: false,
        }),
        // Don't let a slow DeepSeek call hang the request forever.
        signal: AbortSignal.timeout(25_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(
          `[chat:${id}] DeepSeek API error ${res.status}:`,
          errText.slice(0, 500)
        );
        return NextResponse.json(
          {
            reply:
              "I hit an error talking to DeepSeek just now. Check the server logs — your API key or model name might be off.",
            source: "error",
            model: DEEPSEEK_MODEL,
          },
          { status: 200 } // 200 so the UI still renders the message
        );
      }

      const data = await res.json();
      const reply: string =
        data?.choices?.[0]?.message?.content?.trim() ||
        "(DeepSeek returned an empty response — try rephrasing.)";

      return NextResponse.json({
        reply,
        source: "deepseek",
        model: DEEPSEEK_MODEL,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[chat:${id}] DeepSeek fetch failed:`, msg);
      return NextResponse.json({
        reply:
          "I couldn't reach DeepSeek just now. Check your network connection and that DEEPSEEK_API_KEY is set correctly in .env.local.",
        source: "error",
        model: DEEPSEEK_MODEL,
      });
    }
  }

  // --- Mock fallback (no API key configured) ------------------------------
  // Canned replies keep the demo working. Once a real key is in .env.local,
  // this branch never executes.
  const lower = userMessage.toLowerCase();
  let reply: string;

  if (/\b(hi|hello|hey|yo)\b/.test(lower)) {
    reply = `Hey! I'm ${agent.name}. ${agent.status}. (Demo reply — set DEEPSEEK_API_KEY in .env.local to enable real LLM responses.)`;
  } else if (/status|update|how are you|what'?s up/.test(lower)) {
    reply = `Status: ${agent.status}. (Demo reply — set DEEPSEEK_API_KEY to enable real responses.)`;
  } else if (/help|what can you do|capabilities/.test(lower)) {
    reply = agent.description ?? `I handle ${agent.role}.`;
  } else if (agent.sampleReplies && agent.sampleReplies.length > 0) {
    const idx = userMessage.length % agent.sampleReplies.length;
    reply = agent.sampleReplies[idx];
  } else {
    reply =
      "I heard you — but I'm still in mock mode. Set DEEPSEEK_API_KEY in .env.local and I'll have a proper answer.";
  }

  await new Promise((r) => setTimeout(r, 350));
  return NextResponse.json({ reply, source: "mock", model: "mock" });
}
