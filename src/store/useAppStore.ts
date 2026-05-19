import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Connection, HistoryRecord, SqlTab, FormatOptions, ExportOptions, GridOptions, AppToast } from '../types';

interface AppState {
  connections: Connection[];
  activeConnectionId: string | null;
  history: HistoryRecord[];
  isDark: boolean;
  
  tabs: SqlTab[];
  activeTabId: string;
  
  formatOptions: FormatOptions;
  exportOptions: ExportOptions;
  gridOptions: GridOptions;
  toast: AppToast | null;

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
  
  setFormatOptions: (options: FormatOptions) => void;
  setExportOptions: (options: ExportOptions) => void;
  setGridOptions: (options: GridOptions) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
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
      }
    }
  )
);
