"use client";

import { useState, useEffect, useMemo } from 'react';
import { CloudDownload, CloudUpload, X, CheckSquare, Square, Folder, FolderOpen, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import SqlInstructionsModal from './SqlInstructionsModal';
import { Favorite, FavoriteSection, Connection } from '@/types';

interface FavoriteSyncModalProps {
  isOpen: boolean;
  isDark: boolean;
  mode: 'save' | 'load';
  localFavorites: Favorite[];
  localSections: FavoriteSection[];
  dbFavorites?: any[];
  dbSections?: any[];
  initialErrorMsg?: string;
  onConfirm: (selectedIds: any[], selectedConnection?: Connection) => Promise<void>;
  onCancel: () => void;
  connections?: Connection[];
  activeConnectionId?: string | null;
}

interface GroupedItems {
  sectionName: string;
  items: Array<{
    id: string | number;
    name: string;
    sql: string;
    dbId?: number;
  }>;
}

export default function FavoriteSyncModal({
  isOpen,
  isDark,
  mode,
  localFavorites,
  localSections,
  dbFavorites = [],
  dbSections = [],
  initialErrorMsg = '',
  onConfirm,
  onCancel,
  connections = [],
  activeConnectionId = null,
}: FavoriteSyncModalProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(() => {
    return activeConnectionId || (connections.length > 0 ? connections[0].id : '');
  });
  const [currentDbFavorites, setCurrentDbFavorites] = useState<any[]>(dbFavorites);
  const [currentDbSections, setCurrentDbSections] = useState<any[]>(dbSections);
  const [isLoadingDbData, setIsLoadingDbData] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialErrorMsg);
  const [showSqlModal, setShowSqlModal] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<any>>(() => {
    if (mode === 'save') {
      const activeLocal = localFavorites.filter(
        fav => !fav.connectionId || fav.connectionId === (activeConnectionId || (connections.length > 0 ? connections[0].id : ''))
      );
      return new Set(activeLocal.map(f => f.id));
    } else {
      return new Set(dbFavorites.map(f => f.ID));
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupedData, setGroupedData] = useState<GroupedItems[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Sync groupedData and selectedIds on state or prop changes
  useEffect(() => {
    if (mode === 'save') {
      const groups: Record<string, GroupedItems> = {};
      const activeLocalFavorites = localFavorites.filter(
        fav => !fav.connectionId || fav.connectionId === selectedConnectionId
      );
      activeLocalFavorites.forEach(fav => {
        const section = localSections.find(s => s.id === fav.sectionId);
        const sectionName = section ? section.name : 'Varios';
        if (!groups[sectionName]) {
          groups[sectionName] = { sectionName, items: [] };
        }
        groups[sectionName].items.push({
          id: fav.id,
          name: fav.name,
          sql: fav.sql,
          dbId: fav.dbId,
        });
      });
      setGroupedData(Object.values(groups));
      // Reset selectedIds when loaded favorites change (connection switch)
      setSelectedIds(new Set(activeLocalFavorites.map(f => f.id)));
    } else {
      const groups: Record<string, GroupedItems> = {};
      currentDbFavorites.forEach(fav => {
        const dbSec = currentDbSections.find(s => s.ID === fav.SECCION_ID);
        const sectionName = dbSec ? dbSec.NAME : 'Varios';
        if (!groups[sectionName]) {
          groups[sectionName] = { sectionName, items: [] };
        }
        groups[sectionName].items.push({
          id: fav.ID,
          name: fav.NAME,
          sql: fav.SQL_QUERY,
          dbId: fav.ID,
        });
      });
      setGroupedData(Object.values(groups));
      // Reset selectedIds when loaded db favorites change (connection switch)
      setSelectedIds(new Set(currentDbFavorites.map(f => f.ID)));
    }
  }, [currentDbFavorites, currentDbSections, localFavorites, localSections, mode, selectedConnectionId]);

  // Auto-expand all sections on load
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
  const [hoveredItem, setHoveredItem] = useState<{
    item: { id: string | number; name: string; sql: string; dbId?: number };
    x: number;
    y: number;
  } | null>(null);

  // Compute search matches (insensitively checks section name and favorite name)
  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const list: Array<{
      type: 'section' | 'favorite';
      id: string;
      sectionName: string;
      favoriteId?: string | number;
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
      // Auto-expand section if it is collapsed
      setExpandedSections(prev => {
        if (!prev[match.sectionName]) {
          return { ...prev, [match.sectionName]: true };
        }
        return prev;
      });
    }

    // Wait slightly for React DOM render if section was just expanded
    setTimeout(() => {
      const elementId = match.type === 'section'
        ? `sync-node-section-${match.sectionName}`
        : `sync-node-favorite-${match.favoriteId}`;
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  };

  // Reset/set activeMatchIndex when matches change
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

  if (!isOpen) return null;

  const handleToggleItem = (id: any) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleToggleSection = (group: GroupedItems) => {
    const next = new Set(selectedIds);
    const groupIds = group.items.map(item => item.id);
    const allSelected = groupIds.every(id => next.has(id));

    if (allSelected) {
      groupIds.forEach(id => next.delete(id));
    } else {
      groupIds.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelectAll = () => {
    const next = new Set();
    const allIds = groupedData.flatMap(g => g.items.map(item => item.id));
    const isAllSelected = allIds.every(id => selectedIds.has(id));

    if (!isAllSelected) {
      allIds.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleConnectionChange = async (connId: string) => {
    setSelectedConnectionId(connId);
    if (mode === 'save') {
      return;
    }
    const conn = connections.find(c => c.id === connId);
    if (!conn) return;

    setIsLoadingDbData(true);
    setErrorMsg('');
    try {
      // 1. Fetch DB sections
      const secRes = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: conn,
          sql: 'SELECT id, name FROM TKR_FAVORITOS_SECCIONES ORDER BY id'
        })
      });

      if (!secRes.ok) {
        const errData = await secRes.json();
        if (errData.error?.includes('ORA-00942')) {
          throw new Error('Las tablas de favoritos (TKR_FAVORITOS) no existen en la base de datos. Ejecuta el script "tablas.sql" para crearlas.');
        }
        throw new Error(errData.error || 'Error al cargar secciones de favoritos de la base de datos.');
      }
      const secData = await secRes.json();

      // 2. Fetch DB favorites
      const favRes = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: conn,
          sql: 'SELECT id, name, sql_query, seccion_id, created_at, last_run_at FROM TKR_FAVORITOS ORDER BY id'
        })
      });

      if (!favRes.ok) {
        const errData = await favRes.json();
        throw new Error(errData.error || 'Error al cargar favoritos de la base de datos.');
      }
      const favData = await favRes.json();

      setCurrentDbSections(secData.rows || []);
      setCurrentDbFavorites(favData.rows || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al cargar favoritos de la BD');
      setCurrentDbSections([]);
      setCurrentDbFavorites([]);
    } finally {
      setIsLoadingDbData(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) {
      setErrorMsg('Debes seleccionar al menos un favorito.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const conn = connections.find(c => c.id === selectedConnectionId);
      await onConfirm(Array.from(selectedIds), conn);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error al sincronizar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allFlatIds = groupedData.flatMap(g => g.items.map(item => item.id));
  const totalCount = allFlatIds.length;
  const isAllSelected = totalCount > 0 && allFlatIds.every(id => selectedIds.has(id));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-3xl rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] ${
        isDark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
      }`}>
        
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${mode === 'save' ? 'bg-yellow-500/15' : 'bg-blue-500/15'}`}>
              {mode === 'save' ? (
                <CloudUpload className="w-5 h-5 text-yellow-400" />
              ) : (
                <CloudDownload className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-base">
                {mode === 'save' ? 'Guardar favoritos en BD' : 'Cargar favoritos de BD'}
              </h2>
              <p className="text-xs opacity-50">
                {mode === 'save'
                  ? 'Selecciona qué favoritos locales deseas subir a la BD'
                  : 'Selecciona qué favoritos de la BD deseas importar'}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-black/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className={`px-5 py-3 border-b flex items-center gap-3 ${
          isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50/50 border-gray-100'
        }`}>
          <div className="relative flex-1">
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
                  ? 'bg-gray-800/80 border-gray-700 text-gray-105 placeholder-gray-500 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30' 
                  : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30'
              }`}
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-655 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Navigation Controls */}
          {searchQuery.trim() !== '' && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-medium opacity-60 min-w-[40px] text-center">
                {matches.length > 0 ? `${activeMatchIndex + 1} de ${matches.length}` : '0 de 0'}
              </span>
              <div className="flex rounded-lg border dark:border-gray-700 overflow-hidden">
                <button
                  type="button"
                  disabled={matches.length === 0}
                  onClick={handlePrevMatch}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    isDark 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:text-gray-600 disabled:hover:bg-gray-800' 
                      : 'bg-white hover:bg-gray-100 text-gray-600 disabled:text-gray-300 disabled:hover:bg-white'
                  }`}
                  title="Anterior coincidencia"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </button>
                <div className="w-px bg-gray-200 dark:bg-gray-700" />
                <button
                  type="button"
                  disabled={matches.length === 0}
                  onClick={handleNextMatch}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    isDark 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:text-gray-600 disabled:hover:bg-gray-800' 
                      : 'bg-white hover:bg-gray-100 text-gray-600 disabled:text-gray-300 disabled:hover:bg-white'
                  }`}
                  title="Siguiente coincidencia"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Connection Selector */}
        {connections.length > 0 && (
          <div className={`px-5 py-3 border-b flex flex-col gap-2 ${
            isDark ? 'bg-gray-900/30 border-gray-800' : 'bg-gray-50/30 border-gray-100'
          }`}>
            <label className="text-[10px] uppercase font-bold tracking-wider opacity-60">
              {mode === 'save' ? 'Conexión de destino' : 'Conexión de origen'}
            </label>
            <select
              value={selectedConnectionId}
              onChange={(e) => handleConnectionChange(e.target.value)}
              disabled={isLoadingDbData || isSubmitting}
              className={`w-full px-3 py-2 rounded-lg text-xs border outline-none transition-all cursor-pointer ${
                isDark 
                  ? 'bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500/50' 
                  : 'bg-white border-gray-200 text-gray-800 focus:border-blue-500/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.user}@{conn.host})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Master Control */}
        {totalCount > 0 && !isLoadingDbData && (
          <div className={`px-5 py-3 border-b flex items-center justify-between text-xs font-semibold ${
            isDark ? 'bg-gray-800/40 border-gray-800' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare className={`w-4 h-4 ${mode === 'save' ? 'text-yellow-500' : 'text-blue-500'}`} />
                ) : (
                  <Square className="w-4 h-4 opacity-60" />
                )}
                {isAllSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </button>

              <div className="w-px h-4 bg-gray-500/20" />

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
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                    isDark 
                      ? 'border-gray-700 bg-gray-800/40 hover:bg-gray-800 text-blue-400' 
                      : 'border-gray-200 bg-white hover:bg-gray-55 text-blue-600'
                  }`}
                >
                  Expandir todo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSections({});
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                    isDark 
                      ? 'border-gray-700 bg-gray-800/40 hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                      : 'border-gray-200 bg-white hover:bg-gray-55 text-gray-600'
                  }`}
                >
                  Colapsar todo
                </button>
              </div>
            </div>

            <span className="opacity-60">
              {selectedIds.size} de {totalCount} seleccionados
            </span>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-lg border border-red-500/35 bg-red-500/10 text-red-400 flex items-start gap-2.5">
              <span className="flex-1 leading-relaxed">{errorMsg}</span>
              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                title="Ver instrucciones para crear las tablas en Oracle"
                className={`flex-shrink-0 mt-0.5 p-1 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95
                  ${
                    isDark
                      ? 'text-amber-400 hover:bg-amber-500/20 hover:text-amber-300'
                      : 'text-amber-600 hover:bg-amber-100 hover:text-amber-700'
                  }`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          <SqlInstructionsModal
            isOpen={showSqlModal}
            isDark={isDark}
            onClose={() => setShowSqlModal(false)}
          />

          {isLoadingDbData ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs opacity-65 font-medium animate-pulse">Cargando favoritos de la base de datos...</p>
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-8 opacity-40 text-sm italic">
              No se encontraron favoritos para mostrar.
            </div>
          ) : (
            groupedData.map(group => {
              const groupIds = group.items.map(item => item.id);
              const groupSelectedCount = groupIds.filter(id => selectedIds.has(id)).length;
              const isGroupAllSelected = groupSelectedCount === groupIds.length;
              const isExpanded = !!expandedSections[group.sectionName];

              const isSectionActive = activeMatchIndex !== -1 && matches[activeMatchIndex]?.type === 'section' && matches[activeMatchIndex]?.sectionName === group.sectionName;
              const isSectionSecondary = searchQuery.trim() !== '' && !isSectionActive && matches.some(m => m.type === 'section' && m.sectionName === group.sectionName);

              let sectionBorderClass = '';
              if (isSectionActive) {
                sectionBorderClass = mode === 'save'
                  ? (isDark ? 'ring-2 ring-yellow-500/60 bg-yellow-500/10 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'ring-2 ring-yellow-500/60 bg-yellow-50 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.1)]')
                  : (isDark ? 'ring-2 ring-blue-500/60 bg-blue-500/10 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'ring-2 ring-blue-500/60 bg-blue-50 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]');
              } else if (isSectionSecondary) {
                sectionBorderClass = mode === 'save'
                  ? (isDark ? 'border-dashed border-yellow-500/30 bg-yellow-500/5' : 'border-dashed border-yellow-350 bg-yellow-50/20')
                  : (isDark ? 'border-dashed border-blue-500/30 bg-blue-500/5' : 'border-dashed border-blue-300 bg-blue-55/20');
              } else {
                sectionBorderClass = isDark ? 'border-gray-800 bg-gray-850/20' : 'border-gray-150 bg-gray-50/30';
              }

              return (
                <div 
                  key={group.sectionName} 
                  id={`sync-node-section-${group.sectionName}`}
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
                          <CheckSquare className={`w-3.5 h-3.5 ${mode === 'save' ? 'text-yellow-500' : 'text-blue-500'}`} />
                        ) : groupSelectedCount > 0 ? (
                          <CheckSquare className={`w-3.5 h-3.5 opacity-80 ${mode === 'save' ? 'text-yellow-500/80' : 'text-blue-500/80'}`} />
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
                          itemBgClass = mode === 'save'
                            ? (isDark ? 'bg-yellow-500/20 text-yellow-300 ring-2 ring-yellow-500/55 shadow-[0_0_8px_rgba(234,179,8,0.15)]' : 'bg-yellow-100 text-yellow-900 ring-2 ring-yellow-400')
                            : (isDark ? 'bg-blue-500/20 text-blue-300 ring-2 ring-blue-500/55 shadow-[0_0_8px_rgba(59,130,246,0.15)]' : 'bg-blue-100 text-blue-900 ring-2 ring-blue-400');
                        } else if (isItemSecondary) {
                          itemBgClass = mode === 'save'
                            ? (isDark ? 'bg-yellow-500/10 text-yellow-400 border border-dashed border-yellow-500/30' : 'bg-yellow-50/70 text-yellow-800 border border-dashed border-yellow-300')
                            : (isDark ? 'bg-blue-500/10 text-blue-400 border border-dashed border-blue-500/30' : 'bg-blue-50/70 text-blue-800 border border-dashed border-blue-300');
                        } else if (isSelected) {
                          itemBgClass = isDark ? 'bg-gray-800/60 text-gray-100' : 'bg-gray-100/70 text-gray-800';
                        } else {
                          itemBgClass = 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300';
                        }

                        return (
                          <div
                            key={item.id}
                            id={`sync-node-favorite-${item.id}`}
                            onClick={() => handleToggleItem(item.id)}
                            onMouseEnter={(e) => {
                              setHoveredItem({
                                item,
                                x: e.clientX,
                                y: e.clientY
                              });
                            }}
                            onMouseMove={(e) => {
                              setHoveredItem({
                                item,
                                x: e.clientX,
                                y: e.clientY
                              });
                            }}
                            onMouseLeave={() => {
                              setHoveredItem(null);
                            }}
                            className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all duration-150 text-xs ${itemBgClass}`}
                          >
                            <div className="mt-0.5 flex-shrink-0">
                              {isSelected ? (
                                <CheckSquare className={`w-3.5 h-3.5 ${mode === 'save' ? 'text-yellow-500' : 'text-blue-500'}`} />
                              ) : (
                                <Square className="w-3.5 h-3.5 opacity-40" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.dbId && (
                                  <span className={`text-[10px] px-1 rounded font-mono ${
                                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    ID: {item.dbId}
                                  </span>
                                )}
                                <span className="font-semibold truncate">{item.name}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className={`flex-1 py-2 rounded-lg text-sm border font-medium transition-colors ${
              isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            } disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting || selectedIds.size === 0 || isLoadingDbData}
            onClick={handleConfirm}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 text-black disabled:opacity-40 disabled:cursor-not-allowed ${
              mode === 'save'
                ? 'bg-yellow-500 hover:bg-yellow-400'
                : 'bg-blue-500 hover:bg-blue-400 text-white'
            }`}
          >
            {isSubmitting && (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {mode === 'save' ? 'Guardar en BD' : 'Cargar en Aplicativo'}
          </button>
        </div>

        {/* Floating Tooltip Card */}
        {hoveredItem && (
          <div
            style={{
              position: 'fixed',
              left: `${Math.min(hoveredItem.x + 15, typeof window !== 'undefined' ? window.innerWidth - 360 : 500)}px`,
              top: `${Math.min(hoveredItem.y + 15, typeof window !== 'undefined' ? window.innerHeight - 250 : 500)}px`,
              maxWidth: '340px',
              width: 'max-content',
              zIndex: 300,
            }}
            className={`pointer-events-none p-3.5 rounded-xl border shadow-2xl transition-opacity duration-150 ${
              isDark
                ? 'bg-gray-900/95 border-gray-700/80 text-gray-100 shadow-black/80'
                : 'bg-white/95 border-gray-200/80 text-gray-800 shadow-gray-400/30'
            }`}
          >
            <div className="flex items-center justify-between gap-4 border-b border-gray-500/10 pb-1.5 mb-1.5 min-w-[240px]">
              <span className="font-semibold text-xs truncate max-w-[180px]">{hoveredItem.item.name}</span>
              {hoveredItem.item.dbId && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                  isDark ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}>
                  DB ID: {hoveredItem.item.dbId}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider opacity-45 font-semibold">Instrucción SQL</span>
              <pre className={`text-[10px] font-mono p-2 rounded-lg max-h-40 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed border ${
                isDark ? 'bg-black/35 border-white/5 text-emerald-400' : 'bg-gray-50 border-gray-100 text-emerald-700'
              }`}>
                {hoveredItem.item.sql || '(Sin consulta SQL)'}
              </pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
