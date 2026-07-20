// ===========================================================================
// app/page.tsx
// ---------------------------------------------------------------------------
// Main page — composes the full-screen 3D <Scene/> with the HTML
// <AgentPanel/> overlay and a top-left legend explaining how to interact.
//
// This file is a Client Component because:
//   - Next.js 16 App Router no longer allows `next/dynamic` with `ssr: false`
//     inside Server Components.
//   - The entire page is interactive — there's no server data fetching to
//     preserve, so we lose nothing by marking it client-side.
//   - All metadata / SEO is handled by layout.tsx.
//
// <Scene/> is dynamically imported with `ssr: false` because:
//   - Three.js touches `window`/`document` at module load time
//   - We need the canvas to mount only in the browser
// ===========================================================================

"use client";

import dynamic from "next/dynamic";
import { AgentLegend } from "@/components/AgentLegend";

// Lazy-load the 3D scene on the client only. The loader placeholder is
// shown while the bundle is being fetched.
const Scene = dynamic(
  () => import("@/components/Scene").then((m) => m.Scene),
  {
    ssr: false,
    loading: () => <SceneLoader />,
  }
);

// Dynamically import the panel too — it depends on framer-motion + the store,
// neither of which are needed on the server.
const AgentPanel = dynamic(
  () => import("@/components/AgentPanel").then((m) => m.AgentPanel),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950">
      {/* 3D canvas — fills the whole viewport */}
      <Scene />

      {/* Top-left title + interaction hint */}
      <header className="pointer-events-none absolute left-4 top-4 z-10 max-w-[min(420px,calc(100vw-2rem))]">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-4 py-3 text-slate-100 shadow-xl backdrop-blur-md">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">
              AI Agent Office
            </h1>
            <span className="text-xs text-slate-400">v0.1</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Click a bot to open its panel. Drag to orbit, scroll to zoom,
            hover to highlight.
          </p>
        </div>
      </header>

      {/* Bottom-left legend — quick at-a-glance of who's in the office */}
      <AgentLegend />

      {/* Right-hand overlay panel — shows when a bot is selected */}
      <AgentPanel />
    </main>
  );
}

// ---- Inline loading placeholder (kept here because it's tiny) -------------
function SceneLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
        <p className="text-sm">Booting the office…</p>
      </div>
    </div>
  );
}
