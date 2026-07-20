# AI Agent Office — 3D Workspace

A stylized, low-poly 3D office where each AI agent works at its own desk. Click a bot to open a status panel and chat with that agent. Built with Next.js (App Router), React Three Fiber, drei, and Tailwind CSS.

![AI Agent Office](https://img.shields.io/badge/Next.js-16-black) ![React Three Fiber](https://img.shields.io/badge/R3F-9-blueviolet) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## Features

- **Low-poly 3D office** — walls, floor, desks, chairs, monitors, plants, and ceiling strip lights, all built from primitive Three.js geometries (no external models required).
- **Animated bots** — each agent bobs gently, "types" on its desk, and has a glowing screen + chest indicator. Animations are driven by `useFrame`.
- **Hover + click interactions** — R3F's built-in raycasting handles pointer events. Hovering highlights a bot with an emissive glow; clicking opens its panel.
- **HTML overlay panel** — opens when a bot is clicked. Shows the agent's status, description, and a mini chat interface (mocked replies for now).
- **Floating name tags** — drei's `<Html>` renders crisp DOM labels above each bot.
- **OrbitControls** — drag to orbit, scroll to zoom, with damping for a weighty feel.
- **Soft shadows + per-bot accent lights** — each workstation is tinted in the agent's color so you can tell them apart at a glance.
- **Add a new bot in 30 seconds** — drop a new entry into `src/lib/agents.ts` and a new bot appears in the scene automatically.
- **Mock API** — `GET /api/agents`, `GET /api/agents/:id`, `POST /api/agents/:id/chat`. Ready to swap for a real LLM-backed endpoint.

---

## Tech stack

| Layer            | Choice                                             |
| ---------------- | -------------------------------------------------- |
| Framework        | Next.js 16 (App Router, TypeScript)                |
| 3D rendering     | `three` + `@react-three/fiber` + `@react-three/drei` |
| Styling          | Tailwind CSS 4 + shadcn/ui primitives              |
| State            | Zustand (selected bot, hover, chat transcripts)    |
| Animation (UI)   | Framer Motion                                      |
| Icons            | lucide-react                                       |

---

## Project structure

```
.
├── public/
│   ├── logo.svg
│   └── robots.txt
│   └── models/              # ← drop custom .glb files here
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── agents/
│   │   │       ├── route.ts                # GET /api/agents (list)
│   │   │       └── [id]/
│   │   │           ├── route.ts            # GET /api/agents/:id
│   │   │           └── chat/route.ts       # POST /api/agents/:id/chat (mock)
│   │   ├── globals.css
│   │   ├── layout.tsx                       # root layout + metadata
│   │   └── page.tsx                         # main page (composes Scene + panel)
│   ├── components/
│   │   ├── Scene.tsx                        # <Canvas> + lights + OrbitControls
│   │   ├── Office.tsx                       # low-poly room geometry
│   │   ├── Bot.tsx                          # reusable bot (primitive shapes)
│   │   ├── AgentPanel.tsx                   # HTML overlay panel + chat
│   │   └── AgentLegend.tsx                  # bottom-left bot list
│   ├── lib/
│   │   └── agents.ts                        # ← ADD NEW BOTS HERE
│   └── store/
│       └── useOfficeStore.ts                # Zustand store
├── next.config.ts
├── package.json
└── README.md
```

> The user-facing structure follows the prompt exactly (`app/page.tsx`, `components/Scene.tsx`, `components/Bot.tsx`, `components/AgentPanel.tsx`, `lib/agents.ts`). The `src/` prefix is the standard Next.js convention and is fully supported by Vercel — nothing in the deployment workflow changes.

---

## Getting started (local dev)

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm / pnpm / yarn / bun — any works

### Install & run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
# → http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the 3D office with three bots (Email Agent, Business Agent, Research Agent).

### Useful scripts

```bash
npm run dev       # start dev server with HMR
npm run build     # production build (verifies the project compiles cleanly)
npm run start     # start the production server
npm run lint      # ESLint
```

---

## How to use

1. **Drag** anywhere on the canvas to orbit around the office.
2. **Scroll** to zoom in/out (clamped to sensible limits).
3. **Hover** a bot → it glows in its own color, and a name tag appears above its head.
4. **Click** a bot → the right-hand panel slides in with the agent's status + a mini chat.
5. **Type a message** in the chat input and hit Enter (or click the send button). The bot replies via the mock API.
6. **Click empty space** (or the X in the panel) to close it.

You can also click items in the **bottom-left legend** to select bots — handy on mobile where precise 3D clicking is harder.

---

## Adding a new agent

Open `src/lib/agents.ts` and add a new entry to the `agents` array:

```ts
{
  id: "calendar-agent",
  name: "Calendar Agent",
  role: "Scheduling",
  position: [-4.4, 0, -3.2],     // x, y, z in the 3D room
  color: "#10b981",                // hex color for body + accent light
  status: "3 events today, 1 conflict",
  description: "Keeps your schedule sane. Detects conflicts, suggests focus blocks, and protects deep-work time.",
  sampleReplies: [
    "You have 3 events today. The 2pm sync overlaps with your focus block — want me to move it?",
    "Tomorrow looks light. I blocked 9–11am for the proposal draft.",
  ],
}
```

That's it. The bot will appear in the scene on the next reload — no other file changes needed.

> Make sure the `position` you pick isn't inside a wall or overlapping another bot's desk. The room is 12 wide × 10 deep, centered at the origin.

---

## Swapping primitive bots for custom `.glb` models

Each `Bot` is built from boxes, spheres, and cylinders. To use a custom 3D model instead:

1. Drop `your-model.glb` into `/public/models/`.
2. Add `model: "/models/your-model.glb"` to the agent config in `src/lib/agents.ts`.
3. In `src/components/Bot.tsx`, replace the primitive-shape JSX with a `useGLTF` call (commented example is at the top of that file):

   ```tsx
   import { useGLTF } from "@react-three/drei";

   // inside the component:
   if (agent.model) {
     const { scene } = useGLTF(agent.model);
     return (
       <primitive
         object={scene}
         position={agent.position}
         onPointerOver={handleOver}
         onPointerOut={handleOut}
         onClick={handleClick}
       />
     );
   }
   // …else fall through to the default primitive-shape bot
   ```

4. drei's `useGLTF` automatically caches the model and (if present) plays its embedded animations when you wire up an `AnimationMixer` (snippet also in `Bot.tsx`).

> Tip: for production, run `npx @gltf-transform/cli optimize public/models/your-model.glb` to compress the file ~70% before deploying.

---

## Wiring the chat to a real LLM

The chat currently calls `POST /api/agents/:id/chat` and gets back a canned reply. To plug in a real LLM:

1. Open `src/app/api/agents/[id]/chat/route.ts`.
2. Replace the mock reply block with your SDK call. Example using `z-ai-web-dev-sdk`:

   ```ts
   import ZAI from "z-ai-web-dev-sdk";

   const zai = await ZAI.create();
   const completion = await zai.chat.completions.create({
     messages: [
       { role: "system", content: `You are ${agent.name}. ${agent.description}` },
       { role: "user", content: userMessage },
     ],
   });
   return NextResponse.json({ reply: completion.choices[0].message.content });
   ```

3. Add `ZAI_API_KEY` to your `.env.local` and to your Vercel project's Environment Variables.

The frontend contract (`{ reply: string }`) doesn't change, so no UI work is needed.

---

## Deployment on Vercel

This project is **zero-config Vercel compatible** — no custom server, no edge runtime hacks, no exotic build flags.

### Option A — Vercel dashboard (recommended for first deploy)

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Vercel auto-detects Next.js — leave all settings at their defaults:
   - **Framework preset**: Next.js
   - **Build command**: `next build` (auto)
   - **Output directory**: `.next` (auto)
   - **Install command**: `npm install` (auto)
4. Click **Deploy**. The first build takes ~1–2 minutes.
5. Add any environment variables (e.g. `ZAI_API_KEY`) under **Settings → Environment Variables** if you wire up a real LLM later.

### Option B — Vercel CLI

```bash
# Install the CLI once
npm i -g vercel

# From the project root:
vercel            # preview deployment
vercel --prod     # production deployment
```

Follow the prompts (accept all defaults — they're correct for Next.js).

### Verify after deploy

- Open the deployment URL. You should see the 3D office render within ~1 second.
- Click a bot → the panel slides in from the right.
- Type a message → the bot replies (mocked, ~350ms latency).

If the canvas is blank, check the browser console — the most common cause is a slow network on first load (the Three.js bundle is ~600KB gzipped and needs to download before the scene mounts).

---

## Performance notes

- **Bundle size**: Three.js adds ~600KB gzipped. The Scene component is dynamically imported with `ssr: false` so it never blocks first paint of the page shell.
- **DPR**: clamped to `[1, 1.8]` and `<AdaptiveDpr>` reduces resolution under load.
- **Shadows**: a single `directionalLight` casts shadows at 2048×2048. Cheap `ContactShadows` from drei handles the soft floor shadow.
- **Mobile**: tested down to 375×667 viewports. The panel goes full-width minus 2rem margin; the legend stays usable.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Blank canvas, no errors in console | Three.js bundle still loading | Wait a few seconds, or check the Network tab |
| `window is not defined` at build time | Something in the 3D path wasn't marked client-side | Ensure every file that imports `three` / `@react-three/*` starts with `"use client";` or is dynamically imported with `ssr: false` |
| Bots not clickable | Pointer events being swallowed | Make sure no HTML overlay with `pointer-events: auto` covers the canvas. The panel + legend both have proper pointer-events scoping. |
| Build fails on Vercel | Node version mismatch | Set `engines.node: ">=20"` in `package.json` or pick Node 20 in the Vercel project settings |

---

## License

MIT — do whatever you want.
