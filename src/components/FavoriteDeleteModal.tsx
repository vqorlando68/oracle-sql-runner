"use client";

import { useState, useMemo } from 'react';
import {
  X, Trash2, Database, Folder, FolderOpen,
  ChevronRight, ChevronDown, Star, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { Connection, Favorite, FavoriteSection } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type CheckState = 'checked' | 'unchecked' | 'indeterminate';

interface FavoriteDeleteModalProps {
  isOpen: boolean;
  isDark: boolean;
  connections: Connection[];
  favorites: Favorite[];
  favoriteSections: FavoriteSection[];
  onDelete: (ids: string[], deleteFromDb: boolean) => void;
  onCancel: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCheckState(ids: string[], selected: Set<string>): CheckState {
  const checkedCount = ids.filter(id => selected.has(id)).length;
  if (checkedCount === 0) return 'unchecked';
  if (checkedCount === ids.length) return 'checked';
  return 'indeterminate';
}

function CheckboxIcon({ state, isDark }: { state: CheckState; isDark: boolean }) {
  const base = 'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all';
  if (state === 'checked') {
    return (
      <div className={`${base} bg-red-500 border-red-500`}>
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
          <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (state === 'indeterminate') {
    return (
      <div className={`${base} bg-red-500/20 border-red-500/50`}>
        <div className="w-2 h-0.5 bg-red-400 rounded" />
      </div>
    );
  }
  return (
    <div className={`${base} ${isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-white'}`} />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FavoriteDeleteModal({
  isOpen,
  isDark,
  connections,
  favorites,
  favoriteSections,
  onDelete,
  onCancel,
}: FavoriteDeleteModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteFromDb, setDeleteFromDb] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({
    'locales-folder': true,
  });
  const [isConfirming, setIsConfirming] = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────

  const localFavs = useMemo(() => favorites.filter(f => !f.connectionId), [favorites]);

  // All connections that have favorites
  const connectionsWithFavs = useMemo(() =>
    connections.filter(c => favorites.some(f => f.connectionId === c.id)),
    [connections, favorites]
  );

  // Favorites for each connection
  const favsByConn = useMemo(() => {
    const map: Record<string, Favorite[]> = {};
    connectionsWithFavs.forEach(c => {
      map[c.id] = favorites.filter(f => f.connectionId === c.id);
    });
    return map;
  }, [connections, favorites, connectionsWithFavs]);

  // Whether any selected fav has a dbId (to show "delete from DB" option)
  const anySelectedHasDbId = useMemo(() =>
    [...selected].some(id => favorites.find(f => f.id === id)?.dbId != null),
    [selected, favorites]
  );

  const selectedCount = selected.size;

  // ── Toggle helpers ────────────────────────────────────────────────────────

  const toggleIds = (ids: string[], forceState?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allChecked = ids.every(id => next.has(id));
      const shouldCheck = forceState !== undefined ? forceState : !allChecked;
      ids.forEach(id => {
        if (shouldCheck) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const toggleExpand = (key: string) =>
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Render helpers ────────────────────────────────────────────────────────

  const rowBase = `flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-all select-none ${
    isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-100/80'
  }`;

  const renderFavoriteRow = (fav: Favorite) => {
    const isChecked = selected.has(fav.id);
    return (
      <div
        key={fav.id}
        onClick={() => toggleIds([fav.id])}
        className={`${rowBase} ${isChecked ? (isDark ? 'bg-red-500/8' : 'bg-red-50/60') : ''}`}
      >
        <CheckboxIcon state={isChecked ? 'checked' : 'unchecked'} isDark={isDark} />
        <Star className={`w-3.5 h-3.5 flex-shrink-0 ${isChecked ? 'text-red-400' : 'text-yellow-400/70'}`} />
        <span className={`text-xs truncate flex-1 ${isChecked ? 'line-through opacity-60' : ''}`}>
          {fav.name}
        </span>
        {fav.dbId != null && (
          <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${
            isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
          }`}>BD</span>
        )}
      </div>
    );
  };

  const renderSectionBlock = (section: FavoriteSection, sectionFavs: Favorite[], keyPrefix: string) => {
    if (sectionFavs.length === 0) return null;
    const sectionKey = `${keyPrefix}-${section.id}`;
    const isExpanded = !!expandedKeys[sectionKey];
    const sectionIds = sectionFavs.map(f => f.id);
    const checkState = getCheckState(sectionIds, selected);

    return (
      <div key={sectionKey} className="space-y-0.5">
        {/* Section header */}
        <div className={`${rowBase} font-semibold`}>
          {/* Expand toggle */}
          <span
            className="opacity-50 flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); toggleExpand(sectionKey); }}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          {/* Checkbox */}
          <span onClick={(e) => { e.stopPropagation(); toggleIds(sectionIds); }}>
            <CheckboxIcon state={checkState} isDark={isDark} />
          </span>
          {/* Icon */}
          <span className="flex-shrink-0" onClick={() => toggleExpand(sectionKey)}>
            {isExpanded
              ? <FolderOpen className="w-3.5 h-3.5 text-yellow-500/80" />
              : <Folder className="w-3.5 h-3.5 text-yellow-500/80" />
            }
          </span>
          <span className="text-xs truncate flex-1" onClick={() => toggleExpand(sectionKey)}>
            {section.name} <span className="opacity-45">({sectionFavs.length})</span>
          </span>
        </div>

        {/* Children */}
        {isExpanded && (
          <div className="pl-8 space-y-0.5 border-l border-gray-500/10 ml-5">
            {sectionFavs.map(fav => renderFavoriteRow(fav))}
          </div>
        )}
      </div>
    );
  };

  const renderConnectionBlock = (conn: Connection, connFavs: Favorite[]) => {
    if (connFavs.length === 0) return null;
    const folderKey = `conn-folder-${conn.id}`;
    const isExpanded = !!expandedKeys[folderKey];
    const connIds = connFavs.map(f => f.id);
    const checkState = getCheckState(connIds, selected);

    return (
      <div key={conn.id} className="space-y-0.5 pb-1 border-b border-gray-500/8 last:border-0">
        {/* Connection header */}
        <div className={`${rowBase} font-semibold`}>
          <span
            className="opacity-50 flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); toggleExpand(folderKey); }}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <span onClick={(e) => { e.stopPropagation(); toggleIds(connIds); }}>
            <CheckboxIcon state={checkState} isDark={isDark} />
          </span>
          <span className="flex-shrink-0" onClick={() => toggleExpand(folderKey)}>
            <Database className="w-4 h-4 text-blue-400/80" />
          </span>
          <span className="text-xs font-semibold truncate flex-1" onClick={() => toggleExpand(folderKey)}>
            {conn.name} <span className="opacity-45 font-normal">({connFavs.length})</span>
          </span>
        </div>

        {/* Sections within connection */}
        {isExpanded && (
          <div className="pl-5 space-y-1 border-l border-gray-500/10 ml-3.5 mt-0.5">
            {favoriteSections.map(section => {
              const sectionFavs = connFavs.filter(f => f.sectionId === section.id);
              return renderSectionBlock(section, sectionFavs, `conn-${conn.id}`);
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Confirmation step ─────────────────────────────────────────────────────

  const renderConfirmStep = () => {
    const selectedFavs = favorites.filter(f => selected.has(f.id));
    const withDbId = selectedFavs.filter(f => f.dbId != null);

    return (
      <div className="flex-1 p-6 flex flex-col justify-center items-center gap-4 text-center">
        <div className={`p-3 rounded-full ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-500'}`}>
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-base text-red-400">¿Confirmar borrado?</h3>
          <p className={`text-xs max-w-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Se eliminarán <strong className="text-red-400">{selectedCount} favorito(s)</strong> de forma permanente del almacenamiento local.
          </p>
          {deleteFromDb && withDbId.length > 0 && (
            <p className={`text-xs max-w-sm ${isDark ? 'text-amber-300' : 'text-amber-700'} mt-1 flex items-center justify-center gap-1.5`}>
              <Database className="w-3.5 h-3.5 flex-shrink-0" />
              También se eliminarán <strong>{withDbId.length}</strong> registro(s) de la base de datos.
            </p>
          )}
          {deleteFromDb && withDbId.length === 0 && (
            <p className={`text-xs max-w-sm opacity-50 mt-1`}>
              (Ninguno de los seleccionados tiene registro en la BD)
            </p>
          )}
        </div>

        <div className="flex gap-3 w-full max-w-xs mt-2">
          <button
            onClick={() => setIsConfirming(false)}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm border font-medium transition-colors flex items-center justify-center gap-2 ${
              isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <button
            onClick={() => {
              onDelete([...selected], deleteFromDb);
            }}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Confirmar
          </button>
        </div>
      </div>
    );
  };

  // ── Select all / none helpers ─────────────────────────────────────────────

  const allIds = useMemo(() => favorites.map(f => f.id), [favorites]);
  const allCheckState = getCheckState(allIds, selected);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className={`w-full max-w-xl rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] overflow-hidden ${
        isDark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
      }`}>

        {/* Header */}
        <div className={`p-5 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-500'}`}>
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Borrar Favoritos</h2>
              <p className="text-xs opacity-60">Selecciona qué favoritos deseas eliminar</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isConfirming ? renderConfirmStep() : (
          <>
            {/* Toolbar: select all / none */}
            <div className={`px-5 py-2.5 border-b flex items-center justify-between ${isDark ? 'border-gray-800/70 bg-gray-950/20' : 'border-gray-100 bg-gray-50/50'}`}>
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toggleIds(allIds, allCheckState !== 'checked')}
              >
                <CheckboxIcon state={allCheckState} isDark={isDark} />
                <span className="text-xs font-semibold opacity-80">Seleccionar todo</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                selectedCount > 0
                  ? (isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600')
                  : 'opacity-40'
              }`}>
                {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
              {favorites.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 opacity-40">
                  <Star className="w-8 h-8" />
                  <p className="text-sm text-center">No hay favoritos para borrar.</p>
                </div>
              )}

              {/* LOCALES */}
              {localFavs.length > 0 && (() => {
                const folderKey = 'locales-folder';
                const isExpanded = !!expandedKeys[folderKey];
                const localIds = localFavs.map(f => f.id);
                const checkState = getCheckState(localIds, selected);

                return (
                  <div className="space-y-0.5 pb-1 border-b border-gray-500/8">
                    <div className={`${rowBase} font-semibold`}>
                      <span
                        className="opacity-50 flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(folderKey); }}
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); toggleIds(localIds); }}>
                        <CheckboxIcon state={checkState} isDark={isDark} />
                      </span>
                      <span className="flex-shrink-0" onClick={() => toggleExpand(folderKey)}>
                        {isExpanded
                          ? <FolderOpen className="w-4 h-4 text-blue-400/80" />
                          : <Folder className="w-4 h-4 text-blue-400/80" />
                        }
                      </span>
                      <span className="text-xs font-semibold truncate flex-1" onClick={() => toggleExpand(folderKey)}>
                        Locales <span className="opacity-45 font-normal">({localFavs.length})</span>
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="pl-5 space-y-0.5 border-l border-gray-500/10 ml-3.5">
                        {localFavs.map(fav => renderFavoriteRow(fav))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* CONNECTIONS */}
              {connectionsWithFavs.map(conn =>
                renderConnectionBlock(conn, favsByConn[conn.id] ?? [])
              )}
            </div>

            {/* Footer */}
            <div className={`p-4 border-t space-y-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              {/* Delete from DB option */}
              <div
                className="flex items-start gap-2.5 cursor-pointer select-none"
                onClick={() => setDeleteFromDb(v => !v)}
                title="Eliminar también el registro en la base de datos"
              >
                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  deleteFromDb
                    ? 'bg-amber-500 border-amber-500'
                    : isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-white'
                }`}>
                  {deleteFromDb && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                      <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    Borrar también de la base de datos
                  </span>
                  {deleteFromDb && !anySelectedHasDbId && (
                    <span className="text-[10px] opacity-50 italic">
                      Ninguno de los seleccionados tiene registro en la BD
                    </span>
                  )}
                  {deleteFromDb && anySelectedHasDbId && (
                    <span className="text-[10px] text-amber-400/80">
                      {[...selected].filter(id => favorites.find(f => f.id === id)?.dbId != null).length} favorito(s) serán eliminados de la BD
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className={`flex-1 py-2 rounded-lg text-sm border font-medium transition-colors ${
                    isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  disabled={selectedCount === 0}
                  onClick={() => setIsConfirming(true)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Borrar ({selectedCount})
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
