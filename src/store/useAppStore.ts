import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Connection, HistoryRecord, SqlTab, FormatOptions,
  ExportOptions, GridOptions, AppToast, Favorite, FavoriteSection
} from '../types';

export const VARIOS_SECTION_ID = 'section-varios';

interface AppState {
  connections: Connection[];
  activeConnectionId: string | null;
  history: HistoryRecord[];
  favorites: Favorite[];
  favoriteSections: FavoriteSection[];
  isDark: boolean;

  tabs: SqlTab[];
  activeTabId: string;

  formatOptions: FormatOptions;
  exportOptions: ExportOptions;
  gridOptions: GridOptions;
  toast: AppToast | null;

  // Connections
  addConnection: (conn: Connection) => void;
  updateConnection: (conn: Connection) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string) => void;

  // History – removing a history item never touches favorites
  addHistory: (record: HistoryRecord) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;

  // Favorites
  addFavorite: (historyId: string, name: string, sectionId: string) => void;
  removeFavorite: (favoriteId: string) => void;
  /** Call when user opens/runs a favorite – updates lastRunAt */
  runFavorite: (favoriteId: string) => void;

  // Sections
  addFavoriteSection: (id: string, name: string) => void;
  removeFavoriteSection: (id: string) => void;

  toggleTheme: () => void;

  addTab: (tab: SqlTab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, query: string) => void;

  setFormatOptions: (options: FormatOptions) => void;
  setExportOptions: (options: ExportOptions) => void;
  setGridOptions: (options: GridOptions) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

const DEFAULT_SECTIONS: FavoriteSection[] = [
  { id: VARIOS_SECTION_ID, name: 'Varios' },
];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      history: [],
      favorites: [],
      favoriteSections: DEFAULT_SECTIONS,
      isDark: true,

      tabs: [{ id: 'default', title: 'Query 1', query: '-- Write your Oracle SQL here\nSELECT * FROM DUAL;' }],
      activeTabId: 'default',

      formatOptions: {
        language: 'plsql',
        tabWidth: 2,
        useTabs: false,
        keywordCase: 'upper',
        identifierCase: 'preserve',
        dataTypeCase: 'upper',
        functionCase: 'upper',
        logicalOperatorNewline: 'before',
        expressionWidth: 50,
        linesBetweenQueries: 1,
        denseOperators: false,
        newlineBeforeSemicolon: false
      },

      exportOptions: {
        includeNullText: false,
        includeSqlStatement: false,
        includeColumnHeaders: true,
        headerLowercase: false,
        headerQuoted: false,
        exportAsInList: false,
        inListColumn: '',
        delimiter: 'comma',
        delimiterAscii: 44,
        includeDelimiterAfterLastCol: false,
        columnsToExclude: 'BFile,BLOB,CLOB,Long,User-Defined',
        stringQuoting: 'dont_quote',
        numberQuoting: 'dont_quote',
        dateFormat: 'YYYY-MM-DD HH24:MI:SS'
      },

      gridOptions: {
        dateFormat: 'YYYY-MM-DD HH24:MI:SS',
        numberFormat: 'none',
        truncateLength: 50
      },
      toast: null,

      // ── Connections ──────────────────────────────────────────────────────────
      addConnection: (conn) => set((state) => ({ connections: [...state.connections, conn] })),
      updateConnection: (conn) => set((state) => ({
        connections: state.connections.map((c) => (c.id === conn.id ? conn : c)),
      })),
      removeConnection: (id) => set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
      })),
      setActiveConnection: (id) => set({ activeConnectionId: id }),

      // ── History ──────────────────────────────────────────────────────────────
      addHistory: (record) => set((state) => ({ history: [record, ...state.history] })),
      removeHistory: (id) => set((state) => ({
        // Only removes from history – favorites are independent and unaffected
        history: state.history.filter((h) => h.id !== id),
      })),
      clearHistory: () => set({ history: [] }),

      // ── Favorites ────────────────────────────────────────────────────────────
      addFavorite: (historyId, name, sectionId) => set((state) => {
        const histItem = state.history.find(h => h.id === historyId);
        if (!histItem) return {};
        const newFav: Favorite = {
          id: crypto.randomUUID(),
          name,
          sql: histItem.sql,
          sectionId,
          createdAt: new Date().toISOString(),
        };
        return {
          favorites: [...state.favorites, newFav],
          history: state.history.map(h =>
            h.id === historyId ? { ...h, linkedFavoriteId: newFav.id } : h
          ),
        };
      }),

      removeFavorite: (favoriteId) => set((state) => ({
        favorites: state.favorites.filter(f => f.id !== favoriteId),
        // Clear the link on any history item that pointed to this favorite
        history: state.history.map(h =>
          h.linkedFavoriteId === favoriteId ? { ...h, linkedFavoriteId: undefined } : h
        ),
      })),

      runFavorite: (favoriteId) => set((state) => ({
        favorites: state.favorites.map(f =>
          f.id === favoriteId ? { ...f, lastRunAt: new Date().toISOString() } : f
        ),
      })),

      // ── Sections ─────────────────────────────────────────────────────────────
      addFavoriteSection: (id, name) => set((state) => {
        // "Varios" section always exists — ensure it stays first
        const withoutVarios = state.favoriteSections.filter(s => s.id !== VARIOS_SECTION_ID);
        const varios = state.favoriteSections.find(s => s.id === VARIOS_SECTION_ID) ?? { id: VARIOS_SECTION_ID, name: 'Varios' };
        return { favoriteSections: [varios, ...withoutVarios, { id, name }] };
      }),

      removeFavoriteSection: (id) => set((state) => {
        // Cannot remove "Varios" and cannot remove a section that has favorites
        if (id === VARIOS_SECTION_ID) return {};
        if (state.favorites.some(f => f.sectionId === id)) return {};
        return { favoriteSections: state.favoriteSections.filter(s => s.id !== id) };
      }),

      // ── Theme ────────────────────────────────────────────────────────────────
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),

      // ── Tabs ─────────────────────────────────────────────────────────────────
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

      // ── Options ──────────────────────────────────────────────────────────────
      setFormatOptions: (options) => set({ formatOptions: options }),
      setExportOptions: (options) => set({ exportOptions: options }),
      setGridOptions: (options) => set({ gridOptions: options }),
      showToast: (message, type = 'success') => {
        set({ toast: { message, type } });
        setTimeout(() => {
          set((state) => {
            if (state.toast?.message === message) return { toast: null };
            return {};
          });
        }, 3000);
      },
      hideToast: () => set({ toast: null })
    }),
    {
      name: 'oracle-sql-runner-storage',
      partialize: (state) => {
        const { toast, ...rest } = state;
        return rest;
      },
      // Ensure "Varios" always exists after rehydration
      merge: (persisted: any, current) => {
        const merged = { ...current, ...persisted };
        const sections: FavoriteSection[] = merged.favoriteSections ?? DEFAULT_SECTIONS;
        if (!sections.find((s: FavoriteSection) => s.id === VARIOS_SECTION_ID)) {
          merged.favoriteSections = [{ id: VARIOS_SECTION_ID, name: 'Varios' }, ...sections];
        }
        if (!merged.favorites) merged.favorites = [];
        return merged;
      }
    }
  )
);
