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
      const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: systemPromptFor(agent) },
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
