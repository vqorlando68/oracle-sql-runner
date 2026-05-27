"use client";

import { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, CheckSquare, Square, Folder, Database, AlertCircle } from 'lucide-react';
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
  const handleToggleFav = (id: string) => {
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

  const handleToggleSelectAll = () => {
    if (selectedIds.size === sourceFavorites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sourceFavorites.map(f => f.id)));
    }
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
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[80vh] overflow-hidden ${
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
          <div className="flex-1 p-6 flex flex-col justify-center items-center gap-4 text-center">
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
              isDark ? 'bg-gray-950/60 border-gray-800' : 'bg-gray-50 border-gray-100'
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
                className="py-2 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md"
              >
                Sí (Sobrescribir)
              </button>
              <button
                onClick={() => resolveConflict('overwrite-all')}
                className="py-2 px-4 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md"
              >
                Sí a Todos
              </button>
              <button
                onClick={() => resolveConflict('skip')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all ${
                  isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-750' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                No (Saltar)
              </button>
              <button
                onClick={() => resolveConflict('skip-all')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all ${
                  isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-750' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                No a Todos
              </button>
              <button
                onClick={() => resolveConflict('cancel')}
                className="col-span-2 py-1.5 text-xs font-medium text-red-500 hover:text-red-400 mt-2 hover:underline"
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
                    className={`py-2 px-3 rounded-lg text-xs outline-none border ${
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
                    className={`py-2 px-3 rounded-lg text-xs outline-none border ${
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

              {/* Favorites checklist */}
              <div className="flex flex-col flex-1 min-h-[220px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold opacity-75">
                    Favoritos de origen ({sourceFavorites.length})
                  </span>
                  {sourceFavorites.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      {selectedIds.size === sourceFavorites.length ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  )}
                </div>

                <div className={`flex-1 rounded-xl border p-3.5 space-y-1.5 overflow-y-auto max-h-[300px] custom-scrollbar ${
                  isDark ? 'bg-gray-950/30 border-gray-800' : 'bg-gray-50 border-gray-150'
                }`}>
                  {sourceFavorites.map(fav => {
                    const isSelected = selectedIds.has(fav.id);
                    const sectionName = favoriteSections.find(s => s.id === fav.sectionId)?.name || 'Varios';
                    
                    return (
                      <div
                        key={fav.id}
                        onClick={() => handleToggleFav(fav.id)}
                        className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all text-xs ${
                          isSelected
                            ? isDark ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : 'bg-purple-50 text-purple-800 border border-purple-200'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5 opacity-40" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{fav.name}</div>
                          <div className="flex items-center gap-1.5 text-[9px] opacity-50 mt-0.5">
                            <Folder className="w-3 h-3 text-yellow-500" />
                            <span>{sectionName}</span>
                          </div>
                        </div>
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
