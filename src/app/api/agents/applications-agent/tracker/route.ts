// ===========================================================================
// app/api/agents/applications-agent/tracker/route.ts
// ---------------------------------------------------------------------------
// GET /api/agents/applications-agent/tracker?limit=50
//
// Returns the consolidated job-application tracker. Scans the user's inbox
// (via lib/applications.ts) and returns one entry per application, each
// with the latest status + history of related emails.
//
// Used by:
//   - The Applications Agent's panel tab (status board)
//   - The Applications Agent's chat (the LLM gets this data as context so
//     it can answer "any updates on my applications?" with real data)
// ===========================================================================

import { NextResponse } from "next/server";
import { buildTracker } from "@/lib/applications";

export const dynamic = "force-dynamic";
// IMAP scan can take a few seconds on a large inbox
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

  try {
    const tracker = await buildTracker(limit);
    return NextResponse.json(tracker);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tracker] build failed:", msg);
    return NextResponse.json(
      {
        error: msg,
        connected: false,
        total: 0,
        byStatus: {
          applied: 0,
          viewed: 0,
          interview: 0,
          offer: 0,
          closed: 0,
          updated: 0,
        },
        applications: [],
      },
      { status: 200 }
    );
  }
}
