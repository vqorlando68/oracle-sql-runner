"use client";

import { useState, useEffect } from 'react';
import { CloudDownload, CloudUpload, X, CheckSquare, Square, Folder, HelpCircle } from 'lucide-react';
import SqlInstructionsModal from './SqlInstructionsModal';
import { Favorite, FavoriteSection } from '@/types';

interface FavoriteSyncModalProps {
  isOpen: boolean;
  isDark: boolean;
  mode: 'save' | 'load';
  localFavorites: Favorite[];
  localSections: FavoriteSection[];
  dbFavorites?: any[];
  dbSections?: any[];
  initialErrorMsg?: string;
  onConfirm: (selectedIds: any[]) => Promise<void>;
  onCancel: () => void;
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
}: FavoriteSyncModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<any>>(() => {
    if (mode === 'save') {
      return new Set(localFavorites.map(f => f.id));
    } else {
      return new Set(dbFavorites.map(f => f.ID));
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialErrorMsg);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Group items by section
  const [groupedData, setGroupedData] = useState<GroupedItems[]>(() => {
    if (mode === 'save') {
      const groups: Record<string, GroupedItems> = {};
      localFavorites.forEach(fav => {
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
      return Object.values(groups);
    } else {
      const groups: Record<string, GroupedItems> = {};
      dbFavorites.forEach(fav => {
        const dbSec = dbSections.find(s => s.ID === fav.SECCION_ID);
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
      return Object.values(groups);
    }
  });

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

  const handleConfirm = async () => {
    if (selectedIds.size === 0) {
      setErrorMsg('Debes seleccionar al menos un favorito.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onConfirm(Array.from(selectedIds));
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
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] ${
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

        {/* Master Control */}
        {totalCount > 0 && (
          <div className={`px-5 py-3 border-b flex items-center justify-between text-xs font-semibold ${
            isDark ? 'bg-gray-800/40 border-gray-800' : 'bg-gray-50 border-gray-100'
          }`}>
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {isAllSelected ? (
                <CheckSquare className={`w-4 h-4 ${mode === 'save' ? 'text-yellow-500' : 'text-blue-500'}`} />
              ) : (
                <Square className="w-4 h-4 opacity-60" />
              )}
              {isAllSelected ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
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

          {totalCount === 0 ? (
            <div className="text-center py-8 opacity-40 text-sm italic">
              No se encontraron favoritos para mostrar.
            </div>
          ) : (
            groupedData.map(group => {
              const groupIds = group.items.map(item => item.id);
              const groupSelectedCount = groupIds.filter(id => selectedIds.has(id)).length;
              const isGroupAllSelected = groupSelectedCount === groupIds.length;

              return (
                <div key={group.sectionName} className={`rounded-xl border ${
                  isDark ? 'border-gray-800 bg-gray-850/20' : 'border-gray-150 bg-gray-50/30'
                } p-3 space-y-2`}>
                  
                  {/* Group header */}
                  <div className="flex items-center justify-between pb-2 border-b border-inherit">
                    <button
                      onClick={() => handleToggleSection(group)}
                      className="flex items-center gap-2 font-semibold text-xs text-left"
                    >
                      {isGroupAllSelected ? (
                        <CheckSquare className={`w-3.5 h-3.5 ${mode === 'save' ? 'text-yellow-500' : 'text-blue-500'}`} />
                      ) : groupSelectedCount > 0 ? (
                        <CheckSquare className="w-3.5 h-3.5 opacity-60" />
                      ) : (
                        <Square className="w-3.5 h-3.5 opacity-55" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/10 flex-shrink-0" />
                      <span>{group.sectionName}</span>
                    </button>
                    <span className="text-[10px] opacity-40">
                      ({groupSelectedCount} / {groupIds.length})
                    </span>
                  </div>

                  {/* Group items */}
                  <div className="space-y-1.5 pl-1.5">
                    {group.items.map(item => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleItem(item.id)}
                          className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                            isSelected
                              ? isDark
                                ? 'bg-gray-800/60'
                                : 'bg-gray-100/70'
                              : 'hover:bg-black/5'
                          }`}
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
                            <div className="font-mono text-[10px] opacity-50 truncate mt-0.5">
                              {item.sql}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
            disabled={isSubmitting || selectedIds.size === 0}
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

      </div>
    </div>
  );
}
