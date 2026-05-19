import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Connection, HistoryRecord, SqlParam, SqlTab } from '../types';

interface AppState {
  connections: Connection[];
  activeConnectionId: string | null;
  history: HistoryRecord[];
  isDark: boolean;
  
  tabs: SqlTab[];
  activeTabId: string;

  addConnection: (conn: Connection) => void;
  updateConnection: (conn: Connection) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string) => void;
  
  addHistory: (record: HistoryRecord) => void;
  removeHistory: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;
  
  toggleTheme: () => void;

  addTab: (tab: SqlTab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, query: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      history: [],
      isDark: true,
      
      tabs: [{ id: 'default', title: 'Query 1', query: '-- Write your Oracle SQL here\nSELECT * FROM DUAL;' }],
      activeTabId: 'default',

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

      addTab: (tab) => set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id })),
      removeTab: (id) => set((state) => {
        const newTabs = state.tabs.filter((t) => t.id !== id);
        if (newTabs.length === 0) {
          const defaultTab = { id: crypto.randomUUID(), title: 'Query 1', query: '' };
          return { tabs: [defaultTab], activeTabId: defaultTab.id };
        }
        return { tabs: newTabs, activeTabId: state.activeTabId === id ? newTabs[newTabs.length - 1].id : state.activeTabId };
      }),
      setActiveTab: (id) => set({ activeTabId: id }),
      updateTabContent: (id, query) => set((state) => ({
        tabs: state.tabs.map((t) => (t.id === id ? { ...t, query } : t)),
      })),
    }),
    {
      name: 'oracle-sql-runner-storage',
    }
  )
);
