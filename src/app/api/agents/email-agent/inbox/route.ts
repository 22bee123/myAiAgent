// ===========================================================================
// app/api/agents/email-agent/inbox/route.ts
// ---------------------------------------------------------------------------
// GET /api/agents/email-agent/inbox?limit=10
//
// Returns the latest messages from the connected mailbox (via IMAP). If
// email is not configured (no EMAIL_* env vars), returns mock data with
// `connected: false` so the frontend can show a "connect your email" prompt.
//
// Used by:
//   - The Email Agent's panel (to show recent messages)
//   - The Email Agent's chat (the LLM can be given this data as context so
//     it can answer questions about the user's actual inbox)
// ===========================================================================

import { NextResponse } from "next/server";
import { fetchInbox, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 50);

  try {
    const inbox = await fetchInbox(limit);
    return NextResponse.json({
      ...inbox,
      configured: isEmailConfigured(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[inbox] fetch failed:", msg);
    return NextResponse.json(
      {
        error: msg,
        configured: isEmailConfigured(),
        // On error, fall back to mock data so the UI doesn't break.
        connected: false,
        total: 0,
        unread: 0,
        messages: [],
      },
      { status: 200 }
    );
  }
}
