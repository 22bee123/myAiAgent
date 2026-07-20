// ===========================================================================
// app/page.tsx
// ---------------------------------------------------------------------------
// Main page — renders the Command Center (hierarchy of AI agents reporting
// to you, the boss). Clicking the boss card (or any agent card) opens the
// unified activity feed chatbox where every agent posts its findings.
//
// This page is a Client Component because the CommandCenter needs to run
// background intervals (the agent activity loop) which require browser APIs.
// ===========================================================================

"use client";

import dynamic from "next/dynamic";

// Lazy-load the CommandCenter (it uses framer-motion + zustand + many
// sub-components, none of which are needed for SSR).
const CommandCenter = dynamic(
  () => import("@/components/CommandCenter").then((m) => m.CommandCenter),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          <p className="text-sm">Booting the command center…</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return <CommandCenter />;
}
