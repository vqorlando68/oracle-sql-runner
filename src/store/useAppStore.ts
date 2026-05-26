import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Connection, HistoryRecord, SqlTab, FormatOptions,
  ExportOptions, GridOptions, AppToast, Favorite, FavoriteSection
} from '../types';
import { encrypt, decrypt } from '../lib/encryption';

export const VARIOS_SECTION_ID = 'section-varios';

interface AppState {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  connections: Connection[];
  activeConnectionId: string | null;
  history: HistoryRecord[];
  favorites: Favorite[];
  favoriteSections: FavoriteSection[];
  isDark: boolean;
  visibleObjectTypes: string[];
  inactivityTimeoutEnabled: boolean;
  inactivityTimeoutMinutes: number;
  setInactivitySettings: (enabled: boolean, minutes: number) => void;

  tabs: SqlTab[];
  activeTabId: string;

  formatOptions: FormatOptions;
  exportOptions: ExportOptions;
  gridOptions: GridOptions;
  toast: AppToast | null;

  // History retention
  historyRetentionDays: number;

  // Connections
  addConnection: (conn: Connection) => void;
  updateConnection: (conn: Connection) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string) => void;

  // History – removing a history item never touches favorites
  addHistory: (record: HistoryRecord) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  setHistoryRetentionDays: (days: number) => void;
  purgeExpiredHistory: () => void;

  // Favorites
  addFavorite: (historyId: string, name: string, sectionId: string) => void;
  addFavoriteFromSql: (sql: string, name: string, sectionId: string) => void;
  removeFavorite: (favoriteId: string) => void;
  clearAllFavorites: (deleteSections?: boolean) => void;
  updateFavoriteSql: (favoriteId: string, sql: string) => void;
  /** Call when user opens/runs a favorite – updates lastRunAt */
  runFavorite: (favoriteId: string) => void;

  // Sections
  addFavoriteSection: (id: string, name: string) => void;
  removeFavoriteSection: (id: string) => void;

  // DB Sync
  loadFavoritesFromDb: (connection: Connection, selectedDbFavoriteIds?: number[]) => Promise<void>;
  saveFavoritesToDb: (connection: Connection, selectedLocalFavoriteIds?: string[]) => Promise<void>;
  deleteFavoriteFromDb: (connection: Connection, dbId: number) => Promise<void>;

  toggleTheme: () => void;
  setVisibleObjectTypes: (types: string[]) => void;

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
      isAuthenticated: false,
      login: (password) => {
        if (password === 'scriptsoracle') {
          set({ isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => set({ isAuthenticated: false }),
      inactivityTimeoutEnabled: true,
      inactivityTimeoutMinutes: 60,
      setInactivitySettings: (enabled, minutes) => set({ inactivityTimeoutEnabled: enabled, inactivityTimeoutMinutes: minutes }),
      connections: [],
      activeConnectionId: null,
      history: [],
      favorites: [],
      favoriteSections: DEFAULT_SECTIONS,
      isDark: true,
      historyRetentionDays: 30,
      visibleObjectTypes: ['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER'],
      setVisibleObjectTypes: (types) => set({ visibleObjectTypes: types }),

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
      addHistory: (record) => set((state) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - state.historyRetentionDays);
        const cutoffISO = cutoff.toISOString();
        // Add new record and purge expired ones in one pass
        const filtered = state.history.filter(h => h.timestamp >= cutoffISO);
        return { history: [record, ...filtered] };
      }),
      removeHistory: (id) => set((state) => ({
        // Only removes from history – favorites are independent and unaffected
        history: state.history.filter((h) => h.id !== id),
      })),
      clearHistory: () => set({ history: [] }),
      setHistoryRetentionDays: (days) => set({ historyRetentionDays: days }),
      purgeExpiredHistory: () => set((state) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - state.historyRetentionDays);
        const cutoffISO = cutoff.toISOString();
        return { history: state.history.filter(h => h.timestamp >= cutoffISO) };
      }),

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

      clearAllFavorites: (deleteSections = false) => set((state) => ({
        favorites: [],
        favoriteSections: deleteSections ? DEFAULT_SECTIONS : state.favoriteSections,
        // Clear links to favorites in history
        history: state.history.map(h => ({ ...h, linkedFavoriteId: undefined })),
      })),

      addFavoriteFromSql: (sql, name, sectionId) => set((state) => {
        const newFav: Favorite = {
          id: crypto.randomUUID(),
          name,
          sql,
          sectionId,
          createdAt: new Date().toISOString(),
        };
        return { favorites: [...state.favorites, newFav] };
      }),

      updateFavoriteSql: (favoriteId, sql) => set((state) => ({
        favorites: state.favorites.map(f =>
          f.id === favoriteId ? { ...f, sql } : f
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

      // ── DB Sync ──────────────────────────────────────────────────────────────
      loadFavoritesFromDb: async (connection, selectedDbFavoriteIds) => {
        try {
          // 1. Fetch sections
          const secRes = await fetch('/api/oracle/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection,
              sql: 'SELECT id, name FROM TKR_FAVORITOS_SECCIONES ORDER BY id'
            })
          });
          if (!secRes.ok) {
            const errData = await secRes.json();
            if (errData.error?.includes('ORA-00942')) {
              throw new Error('Las tablas de favoritos (TKR_FAVORITOS) no existen en la base de datos. Ejecuta el script "tablas.sql" para crearlas.');
            }
            throw new Error(errData.error || 'Error al cargar secciones de favoritos');
          }
          const secData = await secRes.json();

          // 2. Fetch favorites
          const favRes = await fetch('/api/oracle/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection,
              sql: 'SELECT id, name, sql_query, seccion_id, created_at, last_run_at FROM TKR_FAVORITOS ORDER BY id'
            })
          });
          if (!favRes.ok) {
            const errData = await favRes.json();
            throw new Error(errData.error || 'Error al cargar favoritos');
          }
          const favData = await favRes.json();

          // 3. Merge sections
          const dbSections = secData.rows || [];
          const currentSections = [...useAppStore.getState().favoriteSections];
          const sectionIdMap: Record<string, string> = {};

          dbSections.forEach((dbSec: any) => {
            const dbSecId = dbSec.ID.toString();
            const dbSecName = dbSec.NAME;

            const existing = currentSections.find(s => s.name.toLowerCase() === dbSecName.toLowerCase());
            if (existing) {
              sectionIdMap[dbSecId] = existing.id;
            } else {
              const newId = dbSecName === 'Varios' ? VARIOS_SECTION_ID : crypto.randomUUID();
              currentSections.push({ id: newId, name: dbSecName });
              sectionIdMap[dbSecId] = newId;
            }
          });

          // 4. Merge favorites
          let dbFavorites = favData.rows || [];
          if (selectedDbFavoriteIds) {
            dbFavorites = dbFavorites.filter((dbFav: any) => selectedDbFavoriteIds.includes(dbFav.ID));
          }
          const currentFavorites = [...useAppStore.getState().favorites];

          dbFavorites.forEach((dbFav: any) => {
            const favName = dbFav.NAME;
            const favSql = dbFav.SQL_QUERY;
            const dbSecId = dbFav.SECCION_ID ? dbFav.SECCION_ID.toString() : null;
            const localSecId = dbSecId ? (sectionIdMap[dbSecId] || VARIOS_SECTION_ID) : VARIOS_SECTION_ID;
            const createdAt = dbFav.CREATED_AT || new Date().toISOString();
            const lastRunAt = dbFav.LAST_RUN_AT || undefined;

            const existingIdx = currentFavorites.findIndex(
              f => f.name.toLowerCase() === favName.toLowerCase() && f.sectionId === localSecId
            );

            const mappedFav: Favorite = {
              id: existingIdx >= 0 ? currentFavorites[existingIdx].id : crypto.randomUUID(),
              name: favName,
              sql: favSql,
              sectionId: localSecId,
              createdAt: typeof createdAt === 'string' ? createdAt : new Date(createdAt).toISOString(),
              lastRunAt: lastRunAt ? (typeof lastRunAt === 'string' ? lastRunAt : new Date(lastRunAt).toISOString()) : undefined,
              dbId: dbFav.ID
            };

            if (existingIdx >= 0) {
              currentFavorites[existingIdx] = mappedFav;
            } else {
              currentFavorites.push(mappedFav);
            }
          });

          set({
            favoriteSections: currentSections,
            favorites: currentFavorites
          });
        } catch (error: any) {
          throw error;
        }
      },

      saveFavoritesToDb: async (connection, selectedLocalFavoriteIds) => {
        try {
          // 1. Fetch current sections in DB
          const secRes = await fetch('/api/oracle/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection,
              sql: 'SELECT id, name FROM TKR_FAVORITOS_SECCIONES'
            })
          });

          if (!secRes.ok) {
            const errData = await secRes.json();
            if (errData.error?.includes('ORA-00942')) {
              throw new Error('Las tablas de favoritos (TKR_FAVORITOS) no existen en la base de datos. Ejecuta el script "tablas.sql" para crearlas.');
            }
            throw new Error(errData.error || 'Error al obtener secciones de la base de datos');
          }

          const secData = await secRes.json();
          const dbSections = secData.rows || [];

          // 2. Identify missing sections and insert them
          let localFavorites = useAppStore.getState().favorites;
          if (selectedLocalFavoriteIds) {
            localFavorites = localFavorites.filter(fav => selectedLocalFavoriteIds.includes(fav.id));
          }

          const localSections = useAppStore.getState().favoriteSections;
          const neededSectionIds = new Set(localFavorites.map(f => f.sectionId));
          const activeLocalSections = localSections.filter(sec => neededSectionIds.has(sec.id));

          const missingSections = activeLocalSections.filter(ls => 
            !dbSections.some((ds: any) => ds.NAME.toLowerCase() === ls.name.toLowerCase())
          );

          if (missingSections.length > 0) {
            await Promise.all(missingSections.map(async (sec) => {
              const insertRes = await fetch('/api/oracle/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  connection,
                  sql: 'INSERT INTO TKR_FAVORITOS_SECCIONES (name) VALUES (:name)',
                  binds: { name: sec.name },
                  autoCommit: true
                })
              });
              if (!insertRes.ok) {
                const insertErr = await insertRes.json();
                throw new Error(insertErr.error || `Error al guardar la sección "${sec.name}"`);
              }
            }));
          }

          // 3. Re-fetch sections to get all IDs
          const refetchRes = await fetch('/api/oracle/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection,
              sql: 'SELECT id, name FROM TKR_FAVORITOS_SECCIONES'
            })
          });
          const refetchData = await refetchRes.json();
          const updatedDbSections = refetchData.rows || [];

          // Build local-to-DB section ID map
          const sectionIdMap: Record<string, number> = {};
          localSections.forEach(ls => {
            const match = updatedDbSections.find((ds: any) => ds.NAME.toLowerCase() === ls.name.toLowerCase());
            if (match) {
              sectionIdMap[ls.id] = match.ID;
            }
          });

          // 4. Merge favorites into DB
          if (localFavorites.length > 0) {
            await Promise.all(localFavorites.map(async (fav) => {
              const dbSecId = sectionIdMap[fav.sectionId] || null;
              
              const mergeRes = await fetch('/api/oracle/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  connection,
                  sql: `MERGE INTO TKR_FAVORITOS t
                        USING dual ON (t.name = :name AND NVL(t.seccion_id, -1) = NVL(:seccion_id, -1))
                        WHEN MATCHED THEN
                          UPDATE SET t.sql_query = :sql_query, t.last_run_at = :last_run_at
                        WHEN NOT MATCHED THEN
                          INSERT (name, sql_query, seccion_id, last_run_at)
                          VALUES (:name, :sql_query, :seccion_id, :last_run_at)`,
                  binds: {
                    name: fav.name,
                    seccion_id: dbSecId,
                    sql_query: fav.sql,
                    last_run_at: fav.lastRunAt || null
                  },
                  bindTypes: {
                    last_run_at: fav.lastRunAt ? 'timestamp' : undefined
                  },
                  autoCommit: true
                })
              });

              if (!mergeRes.ok) {
                const mergeErr = await mergeRes.json();
                throw new Error(mergeErr.error || `Error al guardar el favorito "${fav.name}"`);
              }
            }));
          }

          // 5. Re-fetch favorites to update local dbId mapping
          const refetchFavsRes = await fetch('/api/oracle/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection,
              sql: 'SELECT id, name, seccion_id FROM TKR_FAVORITOS'
            })
          });
          if (refetchFavsRes.ok) {
            const refetchFavsData = await refetchFavsRes.json();
            const dbFavs = refetchFavsData.rows || [];
            
            const currentFavorites = useAppStore.getState().favorites;
            const updatedFavorites = currentFavorites.map(fav => {
              const localSec = localSections.find(s => s.id === fav.sectionId);
              const secName = localSec ? localSec.name.toLowerCase() : 'varios';
              
              const match = dbFavs.find((df: any) => {
                const dfSec = updatedDbSections.find((ds: any) => ds.ID === df.SECCION_ID);
                const dfSecName = dfSec ? dfSec.NAME.toLowerCase() : 'varios';
                return df.NAME.toLowerCase() === fav.name.toLowerCase() && dfSecName === secName;
              });
              
              if (match) {
                return { ...fav, dbId: match.ID };
              }
              return fav;
            });
            set({ favorites: updatedFavorites });
          }
        } catch (error: any) {
          throw error;
        }
      },

      deleteFavoriteFromDb: async (connection, dbId) => {
        try {
          const deleteRes = await fetch('/api/oracle/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection,
              sql: 'DELETE FROM TKR_FAVORITOS WHERE id = :id',
              binds: { id: dbId },
              autoCommit: true
            })
          });
          if (!deleteRes.ok) {
            const errData = await deleteRes.json();
            throw new Error(errData.error || 'Error al eliminar el favorito de la base de datos');
          }
        } catch (error: any) {
          throw error;
        }
      },

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
        const { toast, isAuthenticated, ...rest } = state;
        return rest;
      },
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const val = localStorage.getItem(name);
          if (!val) return null;
          try {
            // Retrocompatibilidad con datos planos anteriores
            if (val.trim().startsWith('{')) {
              return JSON.parse(val);
            }
            const decrypted = decrypt(val);
            return decrypted ? JSON.parse(decrypted) : null;
          } catch (e) {
            console.error("Error al obtener o descifrar almacenamiento:", e);
            return null;
          }
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          try {
            const strVal = JSON.stringify(value);
            const encrypted = encrypt(strVal);
            localStorage.setItem(name, encrypted);
          } catch (e) {
            console.error("Error al cifrar y guardar almacenamiento:", e);
          }
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return;
          localStorage.removeItem(name);
        },
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
