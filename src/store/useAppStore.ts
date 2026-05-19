import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Connection, HistoryRecord, SqlParam } from '../types';

interface AppState {
  connections: Connection[];
  activeConnectionId: string | null;
  history: HistoryRecord[];
  isDark: boolean;
  
  addConnection: (conn: Connection) => void;
  updateConnection: (conn: Connection) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string) => void;
  
  addHistory: (record: HistoryRecord) => void;
  removeHistory: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;
  
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      history: [],
      isDark: true,
      
      addConnection: (conn) => set((state) => ({ connections: [...state.connections, conn] })),
      updateConnection: (conn) => set((state) => ({
        connections: state.connections.map((c) => (c.id === conn.id ? conn : c)),
      })),
      removeConnection: (id) => set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
      })),
      setActiveConnection: (id) => set({ activeConnectionId: id }),
      
      addHistory: (record) => set((state) => ({ history: [record, ...state.history] })),
      removeHistory: (id) => set((state) => ({ history: state.history.filter((h) => h.id !== id) })),
      toggleFavorite: (id) => set((state) => ({
        history: state.history.map((h) => (h.id === id ? { ...h, isFavorite: !h.isFavorite } : h)),
      })),
      clearHistory: () => set((state) => ({ history: state.history.filter(h => h.isFavorite) })), // Keep favorites when clearing
      
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
    }),
    {
      name: 'oracle-sql-runner-storage',
    }
  )
);
