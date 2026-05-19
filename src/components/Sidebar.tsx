"use client";

import { useState } from 'react';
import { useAppStore, VARIOS_SECTION_ID } from '@/store/useAppStore';
import {
  Database, History, Star, Plus, Trash2, Edit2, Settings2,
  CheckCircle, Eye, Download, X, Copy, StarOff,
  FolderOpen, Clock
} from 'lucide-react';
import { Connection } from '@/types';
import ConnectionModal from './ConnectionModal';
import FavoriteNameModal from './FavoriteNameModal';
import { saveAs } from 'file-saver';
import Editor from '@monaco-editor/react';


// ─── Sidebar principal ────────────────────────────────────────────────────────
export default function Sidebar() {
  const {
    connections, activeConnectionId, setActiveConnection, removeConnection,
    history, removeHistory,
    favorites, favoriteSections, addFavorite, removeFavorite, runFavorite, addFavoriteSection, removeFavoriteSection,
    toggleTheme, isDark, addTab, tabs, setActiveTab, showToast,
  } = useAppStore();

  const [tab, setTab] = useState<'connections' | 'history' | 'favorites'>('connections');
  const [isConnModalOpen, setConnModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [sqlModal, setSqlModal] = useState<{ isOpen: boolean; sql: string }>({ isOpen: false, sql: '' });
  const [favModal, setFavModal] = useState<{ isOpen: boolean; historyId: string }>({ isOpen: false, historyId: '' });

  const existingFavoriteNames = favorites.map(f => f.name);

  const handleEdit = (conn: Connection) => { setEditingConn(conn); setConnModalOpen(true); };
  const handleAddNew = () => { setEditingConn(null); setConnModalOpen(true); };

  const handleStarClick = (e: React.MouseEvent, historyId: string, linkedFavoriteId?: string) => {
    e.stopPropagation();
    if (linkedFavoriteId) {
      // Already a favorite → remove it
      removeFavorite(linkedFavoriteId);
      showToast('Eliminado de favoritos', 'info');
    } else {
      setFavModal({ isOpen: true, historyId });
    }
  };

  const handleFavModalConfirm = (name: string, sectionId: string) => {
    addFavorite(favModal.historyId, name, sectionId);
    setFavModal({ isOpen: false, historyId: '' });
    showToast(`"${name}" guardado en favoritos`, 'success');
  };

  /**
   * Abre un item del historial en el editor.
   * Si ya existe un tab con el mismo SQL, navega a él en lugar de crear uno nuevo.
   */
  const openHistory = (sql: string) => {
    const existing = tabs.find(t => t.query === sql);
    if (existing) {
      setActiveTab(existing.id);
    } else {
      addTab({ id: crypto.randomUUID(), title: 'History Query', query: sql });
    }
  };

  /**
   * Abre un favorito en el editor.
   * Si ya existe un tab con el mismo nombre Y el mismo SQL, navega a él.
   * Siempre actualiza lastRunAt.
   */
  const openFavorite = (favId: string, name: string, sql: string) => {
    const existing = tabs.find(t => t.title === name && t.query === sql);
    if (existing) {
      setActiveTab(existing.id);
    } else {
      addTab({ id: crypto.randomUUID(), title: name, query: sql, favoriteId: favId });
    }
    runFavorite(favId);
  };

  const card = `p-3 rounded-md border text-sm cursor-pointer transition-colors`;
  const cardDark = `border-gray-800 bg-gray-800/30 hover:border-blue-500`;
  const cardLight = `border-gray-200 bg-white hover:border-blue-400`;
  const cardFavDark = `border-yellow-500/40 bg-yellow-500/5 hover:border-yellow-400`;
  const cardFavLight = `border-yellow-400/60 bg-yellow-50 hover:border-yellow-500`;

  return (
    <div className={`w-72 flex flex-col border-r transition-colors duration-300 ${isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-inherit">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />
          SQL Runner AI
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-inherit">
        {(['connections', 'history', 'favorites'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 px-1 text-xs font-medium border-b-2 flex justify-center items-center gap-1 ${
              tab === t
                ? t === 'favorites' ? 'border-yellow-400 text-yellow-400' : 'border-blue-500 text-blue-500'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            {t === 'connections' && <><Database className="w-3.5 h-3.5" /> Conns</>}
            {t === 'history' && <><History className="w-3.5 h-3.5" /> Historial</>}
            {t === 'favorites' && (
              <>
                <Star className="w-3.5 h-3.5" /> Favs
                {favorites.length > 0 && (
                  <span className="text-[10px] bg-yellow-500 text-black font-bold rounded-full px-1.5 leading-4">
                    {favorites.length}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

        {/* ── CONNECTIONS ── */}
        {tab === 'connections' && (
          <div className="space-y-3">
            <button onClick={handleAddNew} className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors">
              <Plus className="w-4 h-4" /> New Connection
            </button>
            {connections.map(conn => (
              <div
                key={conn.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  activeConnectionId === conn.id
                    ? (isDark ? 'bg-blue-900/20 border-blue-500/50' : 'bg-blue-50 border-blue-400')
                    : (isDark ? 'bg-gray-800/50 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-300')
                }`}
                onClick={() => setActiveConnection(conn.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2 text-sm">
                    {activeConnectionId === conn.id ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Database className="w-4 h-4 opacity-50" />}
                    {conn.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(conn); }} className="p-1 hover:bg-black/10 rounded">
                      <Edit2 className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeConnection(conn.id); }} className="p-1 hover:bg-red-500/20 rounded text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs opacity-60 truncate">{conn.user}@{conn.host}:{conn.port}/{conn.serviceName}</div>
              </div>
            ))}
            {connections.length === 0 && <div className="text-center text-sm opacity-50 mt-10">No connections yet.</div>}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div className="space-y-2">
            {history.map(item => {
              const isFav = !!item.linkedFavoriteId;
              return (
                <div
                  key={item.id}
                  onClick={() => openHistory(item.sql)}
                  className={`${card} ${isFav ? (isDark ? cardFavDark : cardFavLight) : (isDark ? cardDark : cardLight)}`}
                >
                  <div className="text-xs opacity-50 mb-1">{new Date(item.timestamp).toLocaleString()}</div>
                  <div className="font-mono text-xs truncate opacity-80 mb-2">{item.sql}</div>
                  <div className="flex justify-between items-center text-xs">
                    <span className={item.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                      {item.status === 'success' ? `${item.duration}ms` : 'Failed'}
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Estrella */}
                      <button
                        onClick={(e) => handleStarClick(e, item.id, item.linkedFavoriteId)}
                        className={`p-1 rounded transition-all ${
                          isFav
                            ? 'text-yellow-400 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 opacity-50 hover:opacity-100'
                        }`}
                        title={isFav ? 'Quitar de favoritos' : 'Guardar como favorito'}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-yellow-400' : ''}`} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSqlModal({ isOpen: true, sql: item.sql }); }} className="p-1 hover:bg-black/10 rounded text-blue-500" title="Ver SQL">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); saveAs(new Blob([item.sql], { type: 'text/plain;charset=utf-8' }), `query_${new Date(item.timestamp).getTime()}.sql`); }} className="p-1 hover:bg-black/10 rounded text-green-500" title="Descargar">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }} className="p-1 hover:bg-red-500/10 rounded text-red-500" title="Eliminar del historial">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {history.length === 0 && <div className="text-center text-sm opacity-50 mt-10">No history yet.</div>}
          </div>
        )}

        {/* ── FAVORITES ── */}
        {tab === 'favorites' && (
          <div className="space-y-5">
            {favoriteSections.map(section => {
              const sectionFavs = favorites.filter(f => f.sectionId === section.id);
              return (
                <div key={section.id}>
                  {/* Encabezado de sección */}
                  <div className={`flex items-center gap-2 mb-2 pb-1 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    <FolderOpen className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-70 truncate">{section.name}</span>
                    <span className={`text-[10px] px-1.5 rounded-full font-medium ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
                      {sectionFavs.length}
                    </span>
                    {/* Botón borrar sección: solo si vacía y no es Varios */}
                    {section.id !== VARIOS_SECTION_ID && sectionFavs.length === 0 && (
                      <button
                        onClick={() => { removeFavoriteSection(section.id); showToast('Sección eliminada', 'info'); }}
                        className={`ml-auto p-1 rounded transition-colors ${isDark ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                        title="Eliminar sección vacía"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {/* Si tiene items o es Varios, el contador queda al final con ml-auto */}
                    {(section.id === VARIOS_SECTION_ID || sectionFavs.length > 0) && (
                      <span className="ml-auto" />
                    )}
                  </div>

                  {/* Tarjetas de favoritos */}
                  <div className="space-y-2 pl-1">
                    {sectionFavs.map(fav => (
                      <div key={fav.id} className={`rounded-xl overflow-hidden border ${isDark ? 'border-yellow-500/25' : 'border-yellow-400/30'} shadow-sm`}>
                        {/* Barra nombre */}
                        <div className={`flex items-center justify-between px-3 py-2 ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                            <span className="text-xs font-semibold text-yellow-500 truncate">{fav.name}</span>
                          </div>
                          <button
                            onClick={() => { removeFavorite(fav.id); showToast('Eliminado de favoritos', 'info'); }}
                            className={`p-1 rounded flex-shrink-0 transition-colors ${isDark ? 'text-yellow-400/60 hover:text-red-400 hover:bg-red-500/10' : 'text-yellow-500/60 hover:text-red-500 hover:bg-red-50'}`}
                            title="Quitar de favoritos"
                          >
                            <StarOff className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Cuerpo: misma tarjeta que historial */}
                        <div
                          onClick={() => openFavorite(fav.id, fav.name, fav.sql)}
                          className={`p-3 text-sm cursor-pointer transition-colors ${isDark ? 'bg-gray-800/30 hover:bg-gray-800/60' : 'bg-white hover:bg-gray-50'}`}
                        >
                          {/* Última ejecución */}
                          <div className="flex items-center gap-1 text-xs opacity-40 mb-1">
                            <Clock className="w-3 h-3" />
                            {fav.lastRunAt
                              ? new Date(fav.lastRunAt).toLocaleString()
                              : 'Sin ejecuciones aún'}
                          </div>
                          <div className="font-mono text-xs truncate opacity-80 mb-2">{fav.sql}</div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="opacity-40 italic">Clic para abrir</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSqlModal({ isOpen: true, sql: fav.sql }); }}
                                className="p-1 hover:bg-black/10 rounded text-blue-500" title="Ver SQL"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); saveAs(new Blob([fav.sql], { type: 'text/plain;charset=utf-8' }), `${fav.name}.sql`); }}
                                className="p-1 hover:bg-black/10 rounded text-green-500" title="Descargar"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {sectionFavs.length === 0 && (
                      <div className="text-xs opacity-30 italic pl-1">Sin favoritos en esta sección</div>
                    )}
                  </div>
                </div>
              );
            })}

            {favorites.length === 0 && favoriteSections.every(s => favorites.filter(f => f.sectionId === s.id).length === 0) && (
              <div className="flex flex-col items-center gap-3 mt-8 opacity-40">
                <Star className="w-8 h-8" />
                <p className="text-sm text-center">Marca el ⭐ en el historial<br />para guardar favoritos.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-inherit">
        <button onClick={toggleTheme} className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100">
          <Settings2 className="w-4 h-4" />
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      {/* Modales */}
      {isConnModalOpen && (
        <ConnectionModal isOpen={isConnModalOpen} onClose={() => setConnModalOpen(false)} connection={editingConn} />
      )}

      {favModal.isOpen && (
        <FavoriteNameModal
          isDark={isDark}
          existingNames={existingFavoriteNames}
          sections={favoriteSections}
          onConfirm={handleFavModalConfirm}
          onCancel={() => setFavModal({ isOpen: false, historyId: '' })}
          onAddSection={(id, name) => addFavoriteSection(id, name)}
        />
      )}

      {sqlModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-4xl h-[80vh] flex flex-col rounded-xl shadow-2xl border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <h3 className="font-bold">Full SQL Instruction</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { navigator.clipboard.writeText(sqlModal.sql); showToast('SQL copied!'); }} className="p-1.5 rounded-md hover:bg-black/10 text-blue-500" title="Copy">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => { saveAs(new Blob([sqlModal.sql], { type: 'text/plain;charset=utf-8' }), `query_${Date.now()}.sql`); }} className="p-1.5 rounded-md hover:bg-black/10 text-green-500" title="Download">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setSqlModal({ isOpen: false, sql: '' })} className="p-1.5 rounded-md hover:bg-black/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-1">
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme={isDark ? 'vs-dark' : 'light'}
                value={sqlModal.sql}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, fontFamily: 'JetBrains Mono, Consolas, monospace', scrollBeyondLastLine: false, domReadOnly: true }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
