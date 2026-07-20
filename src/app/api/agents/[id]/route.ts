// ===========================================================================
// app/api/agents/[id]/route.ts
// ---------------------------------------------------------------------------
// GET /api/agents/:id  → returns the static config for a single agent.
// GET /api/agents      → returns the full agent list.
//
// This is the placeholder API surface. To make this "real", replace the
// body with whatever your backend needs — fetch from a database, an LLM
// service, an external CRM, etc. The response shape should stay the same
// so the frontend doesn't need to change.
// ===========================================================================

import { NextResponse } from "next/server";
import { agents, getAgentById } from "@/lib/agents";

// Allow Vercel to cache the list endpoint at the edge.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // /api/agents (no id) — list all
  if (!id || id === "list") {
    return NextResponse.json({ agents });
  }

  const agent = getAgentById(id);
  if (!agent) {
    return NextResponse.json(
      { error: `Agent "${id}" not found` },
      { status: 404 }
    );
  }

  // Strip the optional sampleReplies — those are only for client-side seeding.
  // In a real backend you probably wouldn't ship canned replies at all.
  const { sampleReplies, ...publicAgent } = agent;
  void sampleReplies;

  return NextResponse.json({ agent: publicAgent });
}
