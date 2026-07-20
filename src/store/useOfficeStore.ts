// ===========================================================================
// store/useOfficeStore.ts
// ---------------------------------------------------------------------------
// Tiny Zustand store for the cross-cutting UI state of the 3D office:
//   - which bot is currently selected (drives the overlay panel)
//   - which bot is currently hovered (drives emissive glow)
//   - the mini-chat transcript per agent (mocked, client-side for now)
//
// Keeping this out of React context means the 3D canvas (which lives inside
// <Canvas/>) and the HTML overlay (which lives outside it) can both read and
// mutate the same state without prop-drilling through the Canvas boundary.
// ===========================================================================

import { create } from "zustand";
import { agents } from "@/lib/agents";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  ts: number;
}

interface OfficeState {
  /** id of the currently selected agent, or null when none is selected. */
  selectedId: string | null;
  /** id of the currently hovered agent, or null. */
  hoveredId: string | null;
  /** Per-agent chat transcript, keyed by agent id. */
  transcripts: Record<string, ChatMessage[]>;

  select: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  pushMessage: (agentId: string, msg: Omit<ChatMessage, "id" | "ts">) => void;
  clearTranscript: (agentId: string) => void;
}

const emptyTranscripts = (): Record<string, ChatMessage[]> => {
  const out: Record<string, ChatMessage[]> = {};
  for (const a of agents) out[a.id] = [];
  return out;
};

export const useOfficeStore = create<OfficeState>((set) => ({
  selectedId: null,
  hoveredId: null,
  transcripts: emptyTranscripts(),

  select: (id) => set({ selectedId: id }),
  setHovered: (id) => set({ hoveredId: id }),

  pushMessage: (agentId, msg) =>
    set((state) => ({
      transcripts: {
        ...state.transcripts,
        [agentId]: [
          ...(state.transcripts[agentId] ?? []),
          { ...msg, id: crypto.randomUUID(), ts: Date.now() },
        ],
      },
    })),

  clearTranscript: (agentId) =>
    set((state) => ({
      transcripts: { ...state.transcripts, [agentId]: [] },
    })),
}));
