// ===========================================================================
// app/api/agents/route.ts
// ---------------------------------------------------------------------------
// GET /api/agents → list all configured agents (without their sample replies).
//
// Frontend uses this to render UI lists. The 3D scene reads agents directly
// from lib/agents (static import) for performance — no need to round-trip
// through the network just to populate the canvas.
// ===========================================================================

import { NextResponse } from "next/server";
import { agents } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicAgents = agents.map(({ sampleReplies, ...rest }) => {
    void sampleReplies;
    return rest;
  });
  return NextResponse.json({ agents: publicAgents });
}
