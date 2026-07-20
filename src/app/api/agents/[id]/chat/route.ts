// ===========================================================================
// app/api/agents/[id]/chat/route.ts
// ---------------------------------------------------------------------------
// POST /api/agents/:id/chat
//   body: { message: string }
//   res:  { reply: string }
//
// MOCK IMPLEMENTATION — picks a canned reply from the agent config so the UI
// has something to render. To wire to a real LLM:
//
//   1. Install your SDK (e.g. z-ai-web-dev-sdk, openai, anthropic).
//   2. Read the agent's system prompt from a per-agent file under
//      `lib/prompts/<id>.ts`.
//   3. Forward the user message + system prompt to the LLM.
//   4. Stream or await the response and return `{ reply }`.
//
//   Example (using z-ai-web-dev-sdk):
//
//     import ZAI from "z-ai-web-dev-sdk";
//     const zai = await ZAI.create();
//     const completion = await zai.chat.completions.create({
//       messages: [
//         { role: "system", content: systemPromptFor(id) },
//         { role: "user", content: message },
//       ],
//     });
//     return NextResponse.json({ reply: completion.choices[0].message.content });
// ===========================================================================

import { NextResponse } from "next/server";
import { getAgentById } from "@/lib/agents";

export const dynamic = "force-dynamic";

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

  // --- Mock reply logic ---------------------------------------------------
  // Cycle through the agent's sample replies, but also handle a few obvious
  // conversational intents so the demo doesn't feel completely canned.
  const lower = userMessage.toLowerCase();

  let reply: string;

  if (/\b(hi|hello|hey|yo)\b/.test(lower)) {
    reply = `Hey! I'm ${agent.name}. ${agent.status}.`;
  } else if (/status|update|how are you|what'?s up/.test(lower)) {
    reply = `Status: ${agent.status}.`;
  } else if (/help|what can you do|capabilities/.test(lower)) {
    reply = agent.description ?? `I handle ${agent.role}.`;
  } else if (agent.sampleReplies && agent.sampleReplies.length > 0) {
    // Deterministic pick based on message length so the same question
    // gets the same reply across reloads (less jarring during demo).
    const idx = userMessage.length % agent.sampleReplies.length;
    reply = agent.sampleReplies[idx];
  } else {
    reply = "I heard you — but I'm still in mock mode. Wire me to a real LLM and I'll have a proper answer.";
  }

  // Simulate small latency so the "typing…" indicator is visible.
  await new Promise((r) => setTimeout(r, 350));

  return NextResponse.json({ reply });
}
