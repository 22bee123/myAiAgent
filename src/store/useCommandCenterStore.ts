// ===========================================================================
// store/useCommandCenterStore.ts
// ---------------------------------------------------------------------------
// Zustand store for the command center.
//
// State:
//   - updates: the unified activity feed (every agent's posts, newest first)
//   - chatOpen: whether the boss chatbox modal is open
//   - filterChannel: when set, the chatbox only shows updates from this
//     channel (e.g. "email" to see only email agent posts). When null,
//     shows all channels.
//
// Actions:
//   - pushUpdate(u): add a new update to the feed (capped at 200 to avoid
//     unbounded memory growth)
//   - openChat(channel?): open the chatbox, optionally filtered
//   - closeChat(): close the chatbox
//   - clearFeed(): wipe the feed (for debugging / "mark all as read")
// ===========================================================================

import { create } from "zustand";
import type { ActivityUpdate } from "@/lib/activityGenerator";
import type { Channel } from "@/lib/commandAgents";

const MAX_FEED_SIZE = 200;

interface CommandCenterState {
  updates: ActivityUpdate[];
  chatOpen: boolean;
  filterChannel: Channel | null;

  pushUpdate: (u: ActivityUpdate) => void;
  openChat: (channel?: Channel | null) => void;
  closeChat: () => void;
  clearFeed: () => void;
}

export const useCommandCenterStore = create<CommandCenterState>((set) => ({
  updates: [],
  chatOpen: false,
  filterChannel: null,

  pushUpdate: (u) =>
    set((state) => {
      const next = [u, ...state.updates];
      // Trim to MAX_FEED_SIZE (oldest get dropped from the end)
      if (next.length > MAX_FEED_SIZE) next.length = MAX_FEED_SIZE;
      return { updates: next };
    }),

  openChat: (channel = null) =>
    set({ chatOpen: true, filterChannel: channel }),

  closeChat: () => set({ chatOpen: false }),

  clearFeed: () => set({ updates: [] }),
}));
