"use client";

import { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, CheckSquare, Square, Folder, FolderOpen, ChevronDown, ChevronRight, Database, AlertCircle } from 'lucide-react';
import { Connection, Favorite, FavoriteSection } from '@/types';

interface FavoriteTransferModalProps {
  isOpen: boolean;
  isDark: boolean;
  connections: Connection[];
  favorites: Favorite[];
  favoriteSections: FavoriteSection[];
  onTransfer: (newFavs: Favorite[], overwrittenFavIds: string[]) => void;
  onCancel: () => void;
}

interface GroupedItems {
  sectionName: string;
  items: Array<{
    id: string;
    name: string;
    sql: string;
  }>;
}

export default function FavoriteTransferModal({
  isOpen,
  isDark,
  connections,
  favorites,
  favoriteSections,
  onTransfer,
  onCancel,
}: FavoriteTransferModalProps) {
  // Source and Destination pseudo-connections
  const pseudoConnections = useMemo(() => {
    return [
      { id: 'locales', name: 'Locales (No sincronizados)' },
      ...connections.map(c => ({ id: c.id, name: c.name }))
    ];
  }, [connections]);

  const [sourceId, setSourceId] = useState('locales');
  const [destId, setDestId] = useState(connections.length > 0 ? connections[0].id : 'locales');

  // Favorites available in source connection
  const sourceFavorites = useMemo(() => {
    return favorites.filter(f => 
      sourceId === 'locales' ? !f.connectionId : f.connectionId === sourceId
    );
  }, [favorites, sourceId]);

  // Selected favorite IDs to transfer
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset selected favorites when source changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [sourceId]);

  // Ensure destId !== sourceId automatically if possible
  useEffect(() => {
    if (sourceId === destId) {
      const alternative = pseudoConnections.find(c => c.id !== sourceId);
      if (alternative) {
        setDestId(alternative.id);
      }
    }
  }, [sourceId, destId, pseudoConnections]);

  // Checklist utilities
  const handleToggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSection = (group: GroupedItems) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const groupIds = group.items.map(item => item.id);
      const allSelected = groupIds.every(id => next.has(id));

      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const allIds = sourceFavorites.map(f => f.id);
    const isAllSelected = allIds.every(id => selectedIds.has(id));

    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  // Group items by section
  const groupedData = useMemo<GroupedItems[]>(() => {
    const groups: Record<string, GroupedItems> = {};
    sourceFavorites.forEach(fav => {
      const section = favoriteSections.find(s => s.id === fav.sectionId);
      const sectionName = section ? section.name : 'Varios';
      if (!groups[sectionName]) {
        groups[sectionName] = { sectionName, items: [] };
      }
      groups[sectionName].items.push({
        id: fav.id,
        name: fav.name,
        sql: fav.sql,
      });
    });
    return Object.values(groups);
  }, [sourceFavorites, favoriteSections]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Auto-expand all sections when groupedData changes
  useEffect(() => {
    if (groupedData.length > 0) {
      const initial: Record<string, boolean> = {};
      groupedData.forEach(g => {
        initial[g.sectionName] = true;
      });
      setExpandedSections(initial);
    }
  }, [groupedData]);

  // Search state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);

  // Compute search matches
  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const list: Array<{
      type: 'section' | 'favorite';
      id: string;
      sectionName: string;
      favoriteId?: string;
      name: string;
    }> = [];

    groupedData.forEach(group => {
      const isSecMatch = group.sectionName.toLowerCase().includes(query);
      if (isSecMatch) {
        list.push({
          type: 'section',
          id: `section:${group.sectionName}`,
          sectionName: group.sectionName,
          name: group.sectionName,
        });
      }
      group.items.forEach(item => {
        const isItemMatch = item.name.toLowerCase().includes(query);
        if (isItemMatch) {
          list.push({
            type: 'favorite',
            id: `favorite:${item.id}`,
            sectionName: group.sectionName,
            favoriteId: item.id,
            name: item.name,
          });
        }
      });
    });
    return list;
  }, [searchQuery, groupedData]);

  // Function to scroll and auto-expand match
  const scrollToMatch = (index: number) => {
    if (index < 0 || index >= matches.length) return;
    const match = matches[index];

    if (match.type === 'favorite') {
      setExpandedSections(prev => {
        if (!prev[match.sectionName]) {
          return { ...prev, [match.sectionName]: true };
        }
        return prev;
      });
    }

    setTimeout(() => {
      const elementId = match.type === 'section'
        ? `transfer-node-section-${match.sectionName}`
        : `transfer-node-favorite-${match.favoriteId}`;
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  };

  useEffect(() => {
    if (matches.length > 0) {
      setActiveMatchIndex(0);
      scrollToMatch(0);
    } else {
      setActiveMatchIndex(-1);
    }
  }, [matches]);

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const next = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(next);
    scrollToMatch(next);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prev = (activeMatchIndex - 1 + matches.length) % matches.length;
    setActiveMatchIndex(prev);
    scrollToMatch(prev);
  };

  // State machine for duplicate resolution wizard
  const [isProcessing, setIsProcessing] = useState(false);
  const [queue, setQueue] = useState<Favorite[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accumulatedNew, setAccumulatedNew] = useState<Favorite[]>([]);
  const [accumulatedOverwritten, setAccumulatedOverwritten] = useState<string[]>([]);
  const [conflictState, setConflictState] = useState<{
    sourceFav: Favorite;
    targetFav: Favorite;
  } | null>(null);

  // Global resolve flags
  const [overwriteAll, setOverwriteAll] = useState(false);
  const [skipAll, setSkipAll] = useState(false);

  // Start processing queue
  const handleStartTransfer = () => {
    if (selectedIds.size === 0) return;
    const selectedFavs = sourceFavorites.filter(f => selectedIds.has(f.id));

    setIsProcessing(true);
    setQueue(selectedFavs);
    setCurrentIndex(0);
    setAccumulatedNew([]);
    setAccumulatedOverwritten([]);
    setConflictState(null);
    setOverwriteAll(false);
    setSkipAll(false);
  };

  // Run the state machine when queue, index, or flags change
  useEffect(() => {
    if (!isProcessing || queue.length === 0) return;

    if (currentIndex >= queue.length) {
      // Completed successfully! Apply transfer
      onTransfer(accumulatedNew, accumulatedOverwritten);
      setIsProcessing(false);
      onCancel();
      return;
    }

    const sourceFav = queue[currentIndex];

    // Find if duplicate exists in target connection
    const targetFav = favorites.find(f => 
      (destId === 'locales' ? !f.connectionId : f.connectionId === destId) &&
      f.name.toLowerCase() === sourceFav.name.toLowerCase() &&
      f.sectionId === sourceFav.sectionId
    );

    if (!targetFav) {
      // No conflict -> copy directly
      const newFav: Favorite = {
        ...sourceFav,
        id: crypto.randomUUID(),
        connectionId: destId === 'locales' ? undefined : destId,
        dbId: undefined, // needs new sync
        createdAt: new Date().toISOString()
      };
      setAccumulatedNew(prev => [...prev, newFav]);
      setCurrentIndex(prev => prev + 1);
    } else {
      // Conflict exists!
      if (overwriteAll) {
        // Overwrite silently
        const overwrittenFav: Favorite = {
          ...sourceFav,
          id: targetFav.id, // keep target ID
          connectionId: destId === 'locales' ? undefined : destId,
          dbId: undefined, // needs sync
          createdAt: new Date().toISOString()
        };
        setAccumulatedOverwritten(prev => [...prev, targetFav.id]);
        setAccumulatedNew(prev => [...prev, overwrittenFav]);
        setCurrentIndex(prev => prev + 1);
      } else if (skipAll) {
        // Skip silently
        setCurrentIndex(prev => prev + 1);
      } else {
        // Prompt user
        setConflictState({ sourceFav, targetFav });
      }
    }
  }, [isProcessing, queue, currentIndex, overwriteAll, skipAll]);

  // Dialog actions
  const resolveConflict = (action: 'overwrite' | 'overwrite-all' | 'skip' | 'skip-all' | 'cancel') => {
    if (!conflictState) return;

    const { sourceFav, targetFav } = conflictState;

    if (action === 'cancel') {
      // Abort
      setIsProcessing(false);
      setConflictState(null);
      return;
    }

    if (action === 'overwrite' || action === 'overwrite-all') {
      if (action === 'overwrite-all') {
        setOverwriteAll(true);
      }
      const overwrittenFav: Favorite = {
        ...sourceFav,
        id: targetFav.id,
        connectionId: destId === 'locales' ? undefined : destId,
        dbId: undefined,
        createdAt: new Date().toISOString()
      };
      setAccumulatedOverwritten(prev => [...prev, targetFav.id]);
      setAccumulatedNew(prev => [...prev, overwrittenFav]);
    } else if (action === 'skip' || action === 'skip-all') {
      if (action === 'skip-all') {
        setSkipAll(true);
      }
      // do nothing, skip
    }

    setConflictState(null);
    setCurrentIndex(prev => prev + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-3xl rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] overflow-hidden ${
        isDark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
      }`}>
        
        {/* Header */}
        <div className={`p-5 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400">
              <ArrowRightLeft className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-base">Transferir Favoritos</h2>
              <p className="text-xs opacity-60">Copia o mueve favoritos entre tus conexiones de base de datos y locales</p>
            </div>
          </div>
          <button onClick={onCancel} disabled={isProcessing} className="p-1 rounded-lg hover:bg-black/10 transition-colors disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Resolution UI when there is a conflict */}
        {isProcessing && conflictState ? (
          <div className="flex-1 p-6 flex flex-col justify-center items-center gap-4 text-center overflow-y-auto">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full animate-bounce">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-base text-amber-400">Conflicto de Duplicado Detectado</h3>
              <p className="text-xs max-w-md opacity-80">
                Ya existe un favorito llamado <strong className="text-white">"{conflictState.sourceFav.name}"</strong> en la sección <strong className="text-white">"{favoriteSections.find(s => s.id === conflictState.sourceFav.sectionId)?.name || 'Varios'}"</strong> en la conexión de destino.
              </p>
              <p className="text-[10px] opacity-50">
                ¿Qué acción deseas realizar con este elemento y los posteriores?
              </p>
            </div>

            {/* Conflict details visual check */}
            <div className={`w-full max-w-md p-3.5 rounded-xl border text-left font-mono text-[10px] space-y-2 ${
              isDark ? 'bg-gray-950/60 border-gray-800' : 'bg-gray-50 border-gray-150'
            }`}>
              <div>
                <span className="text-purple-400 block font-bold">SQL ORIGEN:</span>
                <div className="max-h-24 overflow-y-auto whitespace-pre-wrap opacity-80 break-all">{conflictState.sourceFav.sql}</div>
              </div>
              <div className="h-px bg-gray-500/10" />
              <div>
                <span className="text-amber-500 block font-bold">SQL DESTINO ACTUAL:</span>
                <div className="max-h-24 overflow-y-auto whitespace-pre-wrap opacity-80 break-all">{conflictState.targetFav.sql}</div>
              </div>
            </div>

            {/* Resolve buttons */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-md mt-2">
              <button
                onClick={() => resolveConflict('overwrite')}
                className="py-2 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md cursor-pointer"
              >
                Sí (Sobrescribir)
              </button>
              <button
                onClick={() => resolveConflict('overwrite-all')}
                className="py-2 px-4 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md cursor-pointer"
              >
                Sí a Todos
              </button>
              <button
                onClick={() => resolveConflict('skip')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-750' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                No (Saltar)
              </button>
              <button
                onClick={() => resolveConflict('skip-all')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-750' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                No a Todos
              </button>
              <button
                onClick={() => resolveConflict('cancel')}
                className="col-span-2 py-1.5 text-xs font-medium text-red-500 hover:text-red-400 mt-2 hover:underline cursor-pointer"
              >
                Cancelar Operación
              </button>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="flex-1 p-6 flex flex-col justify-center items-center gap-2 opacity-65">
            <span className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Procesando favoritos ({currentIndex + 1} de {queue.length})...</span>
          </div>
        ) : (
          <>
            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* Selectors grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Source Connection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold opacity-75">Conexión de Origen</label>
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className={`py-2 px-3 rounded-lg text-xs outline-none border cursor-pointer ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-gray-150 focus:border-purple-500' 
                        : 'bg-white border-gray-300 text-gray-800 focus:border-purple-500'
                    }`}
                  >
                    {pseudoConnections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Destination Connection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold opacity-75">Conexión de Destino</label>
                  <select
                    value={destId}
                    onChange={(e) => setDestId(e.target.value)}
                    className={`py-2 px-3 rounded-lg text-xs outline-none border cursor-pointer ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-gray-150 focus:border-purple-500' 
                        : 'bg-white border-gray-300 text-gray-800 focus:border-purple-500'
                    }`}
                  >
                    {pseudoConnections.map(c => (
                      <option key={c.id} disabled={c.id === sourceId} value={c.id}>
                        {c.name} {c.id === sourceId ? '(Origen)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search bar and selection controllers */}
              <div className="flex flex-col gap-2.5">
                {/* Search Input Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <svg className={`h-4 w-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar sección o favorito..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.shiftKey) {
                          handlePrevMatch();
                        } else {
                          handleNextMatch();
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        handleNextMatch();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        handlePrevMatch();
                      }
                    }}
                    className={`w-full pl-9 pr-8 py-1.5 rounded-lg text-xs border outline-none transition-all ${
                      isDark 
                        ? 'bg-gray-800/80 border-gray-700 text-gray-100 placeholder-gray-500 focus:border-purple-500/50' 
                        : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-500/50'
                    }`}
                  />
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Master Control Bar */}
                {sourceFavorites.length > 0 && (
                  <div className={`px-3 py-2 rounded-lg border flex items-center justify-between text-[11px] font-semibold ${
                    isDark ? 'bg-gray-850/40 border-gray-800' : 'bg-gray-50 border-gray-150'
                  }`}>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer text-left"
                      >
                        {selectedIds.size === sourceFavorites.length ? (
                          <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
                        ) : (
                          <Square className="w-3.5 h-3.5 opacity-60" />
                        )}
                        {selectedIds.size === sourceFavorites.length ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>

                      <div className="w-px h-3 bg-gray-500/20" />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const all: Record<string, boolean> = {};
                            groupedData.forEach(g => {
                              all[g.sectionName] = true;
                            });
                            setExpandedSections(all);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors cursor-pointer ${
                            isDark 
                              ? 'border-gray-700 bg-gray-800/40 hover:bg-gray-800 text-purple-400' 
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-purple-600'
                          }`}
                        >
                          Expandir todo
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedSections({})}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors cursor-pointer ${
                            isDark 
                              ? 'border-gray-700 bg-gray-800/40 hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          Colapsar todo
                        </button>
                      </div>
                    </div>

                    <span className="opacity-60">
                      {selectedIds.size} de {sourceFavorites.length} seleccionados
                    </span>
                  </div>
                )}
              </div>

              {/* Favorites checklist (Hierarchical) */}
              <div className="flex flex-col flex-1 min-h-[300px]">
                <div className={`flex-1 rounded-xl border p-3.5 space-y-2 overflow-y-auto max-h-[350px] custom-scrollbar ${
                  isDark ? 'bg-gray-950/30 border-gray-800' : 'bg-gray-50 border-gray-150'
                }`}>
                  {groupedData.map(group => {
                    const groupIds = group.items.map(item => item.id);
                    const groupSelectedCount = groupIds.filter(id => selectedIds.has(id)).length;
                    const isGroupAllSelected = groupSelectedCount === groupIds.length;
                    const isExpanded = !!expandedSections[group.sectionName];

                    const isSectionActive = activeMatchIndex !== -1 && matches[activeMatchIndex]?.type === 'section' && matches[activeMatchIndex]?.sectionName === group.sectionName;
                    const isSectionSecondary = searchQuery.trim() !== '' && !isSectionActive && matches.some(m => m.type === 'section' && m.sectionName === group.sectionName);

                    let sectionBorderClass = '';
                    if (isSectionActive) {
                      sectionBorderClass = isDark 
                        ? 'ring-2 ring-purple-500/60 bg-purple-500/10 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                        : 'ring-2 ring-purple-500/60 bg-purple-50 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]';
                    } else if (isSectionSecondary) {
                      sectionBorderClass = isDark 
                        ? 'border-dashed border-purple-500/30 bg-purple-500/5' 
                        : 'border-dashed border-purple-300 bg-purple-50/20';
                    } else {
                      sectionBorderClass = isDark ? 'border-gray-800 bg-gray-850/20' : 'border-gray-150 bg-gray-55/30';
                    }

                    return (
                      <div 
                        key={group.sectionName} 
                        id={`transfer-node-section-${group.sectionName}`}
                        className={`rounded-xl border transition-all duration-200 p-3 space-y-2 ${sectionBorderClass}`}
                      >
                        
                        {/* Group header */}
                        <div 
                          className="flex items-center justify-between pb-1 select-none cursor-pointer"
                          onClick={() => setExpandedSections(prev => ({ ...prev, [group.sectionName]: !prev[group.sectionName] }))}
                        >
                          <div className="flex items-center gap-2 font-semibold text-xs text-left">
                            {/* Chevron expand/collapse */}
                            <div className="text-gray-400 p-0.5 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSection(group);
                              }}
                              className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                            >
                              {isGroupAllSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
                              ) : groupSelectedCount > 0 ? (
                                <CheckSquare className="w-3.5 h-3.5 opacity-80 text-purple-500/80" />
                              ) : (
                                <Square className="w-3.5 h-3.5 opacity-55" />
                              )}
                            </button>

                            {isExpanded ? (
                              <FolderOpen className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/10 flex-shrink-0" />
                            ) : (
                              <Folder className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/10 flex-shrink-0" />
                            )}

                            <span>{group.sectionName}</span>
                          </div>
                          <span className="text-[10px] opacity-40">
                            ({groupSelectedCount} / {groupIds.length})
                          </span>
                        </div>

                        {/* Group items */}
                        {isExpanded && (
                          <div className="space-y-1.5 pl-6 border-l border-gray-500/10 ml-2.5">
                            {group.items.map(item => {
                              const isSelected = selectedIds.has(item.id);
                              
                              const isItemActive = activeMatchIndex !== -1 && matches[activeMatchIndex]?.type === 'favorite' && matches[activeMatchIndex]?.favoriteId === item.id;
                              const isItemSecondary = searchQuery.trim() !== '' && !isItemActive && matches.some(m => m.type === 'favorite' && m.favoriteId === item.id);

                              let itemBgClass = '';
                              if (isItemActive) {
                                itemBgClass = isDark 
                                  ? 'bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/55 shadow-[0_0_8px_rgba(168,85,247,0.15)]' 
                                  : 'bg-purple-100 text-purple-900 ring-2 ring-purple-400';
                              } else if (isItemSecondary) {
                                itemBgClass = isDark 
                                  ? 'bg-purple-500/10 text-purple-400 border border-dashed border-purple-500/30' 
                                  : 'bg-purple-50/70 text-purple-800 border border-dashed border-purple-300';
                              } else if (isSelected) {
                                itemBgClass = isDark ? 'bg-gray-800/60 text-gray-100' : 'bg-gray-100/70 text-gray-850';
                              } else {
                                itemBgClass = 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300';
                              }

                              return (
                                <div
                                  key={item.id}
                                  id={`transfer-node-favorite-${item.id}`}
                                  onClick={() => handleToggleItem(item.id)}
                                  className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all duration-150 text-xs ${itemBgClass}`}
                                >
                                  <div className="mt-0.5 flex-shrink-0">
                                    {isSelected ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 opacity-40" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="font-semibold truncate block">{item.name}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {sourceFavorites.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-40 text-xs italic">
                      <Database className="w-8 h-8" />
                      <span>No hay favoritos en esta conexión para transferir.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={onCancel}
                className={`flex-1 py-2 rounded-lg text-sm border font-medium transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={handleStartTransfer}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/10 cursor-pointer"
              >
                Transferir ({selectedIds.size})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
