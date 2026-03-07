import { create } from "zustand";

export interface TerminalSession {
  id: string;
  name: string;
  isConnected: boolean;
}

interface TerminalState {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
  isOpen: boolean;
  panelHeight: number;
  isMaximized: boolean;
  sessionCounter: number;

  toggle: () => void;
  open: () => void;
  close: () => void;
  addSession: () => string;
  removeSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setActive: (id: string) => void;
  setHeight: (height: number) => void;
  toggleMaximize: () => void;
  setConnected: (id: string, connected: boolean) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,
  isOpen: false,
  panelHeight: 300,
  isMaximized: false,
  sessionCounter: 0,

  toggle: () => {
    const state = get();
    if (state.isOpen) {
      set({ isOpen: false, isMaximized: false });
    } else {
      // If no sessions, create one
      if (state.sessions.size === 0) {
        const id = get().addSession();
        set({ isOpen: true, activeSessionId: id });
      } else {
        set({ isOpen: true });
      }
    }
  },

  open: () => {
    const state = get();
    if (state.sessions.size === 0) {
      const id = get().addSession();
      set({ isOpen: true, activeSessionId: id });
    } else {
      set({ isOpen: true });
    }
  },

  close: () => set({ isOpen: false, isMaximized: false }),

  addSession: () => {
    const state = get();
    const counter = state.sessionCounter + 1;
    const id = `terminal-${counter}-${Date.now()}`;
    const session: TerminalSession = {
      id,
      name: `Terminal ${counter}`,
      isConnected: false,
    };
    const sessions = new Map(state.sessions);
    sessions.set(id, session);
    set({ sessions, activeSessionId: id, sessionCounter: counter });
    return id;
  },

  removeSession: (id: string) => {
    const state = get();
    const sessions = new Map(state.sessions);
    sessions.delete(id);

    let activeSessionId = state.activeSessionId;
    if (activeSessionId === id) {
      const keys = Array.from(sessions.keys());
      activeSessionId = keys.length > 0 ? keys[keys.length - 1] : null;
    }

    if (sessions.size === 0) {
      set({ sessions, activeSessionId: null, isOpen: false, isMaximized: false });
    } else {
      set({ sessions, activeSessionId });
    }
  },

  renameSession: (id: string, name: string) => {
    const state = get();
    const sessions = new Map(state.sessions);
    const session = sessions.get(id);
    if (session) {
      sessions.set(id, { ...session, name });
      set({ sessions });
    }
  },

  setActive: (id: string) => set({ activeSessionId: id }),

  setHeight: (height: number) =>
    set({ panelHeight: Math.max(150, Math.min(height, window.innerHeight * 0.7)) }),

  toggleMaximize: () =>
    set((state) => ({ isMaximized: !state.isMaximized })),

  setConnected: (id: string, connected: boolean) => {
    const state = get();
    const sessions = new Map(state.sessions);
    const session = sessions.get(id);
    if (session) {
      sessions.set(id, { ...session, isConnected: connected });
      set({ sessions });
    }
  },
}));
