"use client";

import { useState } from 'react';
import { BookmarkPlus, Plus, XCircle, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FavoriteSection, Connection, Favorite } from '@/types';
import { VARIOS_SECTION_ID } from '@/store/useAppStore';

interface FavoriteNameModalProps {
  isDark: boolean;
  favorites: Favorite[];
  sections: FavoriteSection[];
  connections: Connection[];
  defaultConnectionId?: string;
  /** Pre-fill the name field (e.g. from tab title) */
  initialName?: string;
  onConfirm: (
    name: string,
    sectionId: string,
    connectionId: string | undefined,
    saveToDb: boolean,
    overwrite: boolean
  ) => void;
  onCancel: () => void;
  onAddSection: (id: string, name: string) => void;
}

export default function FavoriteNameModal({
  isDark,
  favorites,
  sections,
  connections,
  defaultConnectionId = '',
  initialName = '',
  onConfirm,
  onCancel,
  onAddSection,
}: FavoriteNameModalProps) {
  const defaultSection = sections.find(s => s.id === VARIOS_SECTION_ID) ?? sections[0];
  const [name, setName] = useState(initialName);
  const [sectionId, setSectionId] = useState(defaultSection?.id ?? '');
  const [newSecName, setNewSecName] = useState('');
  const [showNewSec, setShowNewSec] = useState(false);
  const [nameError, setNameError] = useState('');
  const [secError, setSecError] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState(defaultConnectionId);
  const [saveToDb, setSaveToDb] = useState(false);

  const trimmedName = name.trim();
  const trimmedSecName = newSecName.trim();

  // Dynamic duplicate check based on name and selected connection
  const isDuplicate = trimmedName.length > 0 && favorites.some(f => 
    f.name.toLowerCase() === trimmedName.toLowerCase() && 
    (selectedConnectionId ? f.connectionId === selectedConnectionId : !f.connectionId)
  );

  const inputCls = (err: boolean) =>
    `w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${
      isDark
        ? `bg-gray-800 text-gray-100 placeholder-gray-500 ${err ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'}`
        : `bg-gray-50 text-gray-800 placeholder-gray-400 ${err ? 'border-red-400' : 'border-gray-300 focus:border-blue-500'}`
    }`;

  const handleAddSection = () => {
    if (!trimmedSecName) { setSecError('El nombre no puede estar vacío.'); return; }
    if (sections.some(s => s.name.toLowerCase() === trimmedSecName.toLowerCase())) {
      setSecError('Ya existe una sección con ese nombre.'); return;
    }
    const newId = crypto.randomUUID();
    onAddSection(newId, trimmedSecName);
    setSectionId(newId);
    setNewSecName('');
    setShowNewSec(false);
    setSecError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedName) { setNameError('El nombre no puede estar vacío.'); return; }
    if (!sectionId) { setNameError('Debes seleccionar una sección.'); return; }
    onConfirm(trimmedName, sectionId, selectedConnectionId || undefined, saveToDb, isDuplicate);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 ${
        isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
      }`}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-yellow-500/15">
            <BookmarkPlus className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="font-bold text-base">Guardar como favorito</h2>
            <p className="text-xs opacity-50">Asigna nombre, conexión y sección</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Nombre */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium opacity-70">Nombre del favorito</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              placeholder="ej. Reporte ventas mensual"
              className={inputCls(!!nameError || isDuplicate)}
            />
            {nameError && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {nameError}
              </span>
            )}
            {/* Duplicate warning — non-blocking */}
            {isDuplicate && !nameError && (
              <div className={`flex items-start gap-1.5 px-2.5 py-2 rounded-lg text-xs ${
                isDark ? 'bg-amber-500/10 text-amber-300 border border-amber-500/25' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Ya existe un favorito con ese nombre {selectedConnectionId ? 'en la conexión seleccionada' : 'localmente'}.{' '}
                  <strong>Al guardar se sobrescribirá</strong> el existente
                  {saveToDb ? ' (local y en la BD)' : ' localmente'}.
                </span>
              </div>
            )}
          </div>

          {/* Selector de Conexión */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium opacity-70">Almacenar en (Conexión / Local)</label>
            <select
              value={selectedConnectionId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedConnectionId(val);
                if (!val) {
                  setSaveToDb(false);
                }
              }}
              className={`w-full ${inputCls(false)} cursor-pointer`}
            >
              <option value="">Localmente (Sin conexión)</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>
                  Conexión: {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sección */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium opacity-70">
              Sección <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className={`flex-1 ${inputCls(false)} cursor-pointer`}
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewSec(v => !v)}
                title="Nueva sección"
                className={`px-2 rounded-lg border text-sm transition-colors ${
                  isDark
                    ? 'border-gray-600 hover:bg-gray-700 text-gray-300'
                    : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showNewSec && (
              <div className="flex flex-col gap-1 mt-1 pl-1 border-l-2 border-yellow-500/40">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newSecName}
                    onChange={(e) => { setNewSecName(e.target.value); setSecError(''); }}
                    placeholder="Nombre de la nueva sección"
                    className={inputCls(!!secError)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSection(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3 py-2 rounded-lg text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-semibold transition-colors"
                  >
                    Crear
                  </button>
                </div>
                {secError && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> {secError}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Save to DB checkbox */}
          <div
            className={`flex items-center gap-2.5 cursor-pointer select-none px-3 py-2.5 rounded-xl border transition-all ${
              !selectedConnectionId
                ? (isDark ? 'opacity-40 border-gray-800 bg-gray-900/30' : 'opacity-40 border-gray-200 bg-gray-50')
                : saveToDb
                ? (isDark ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-emerald-400 bg-emerald-50')
                : (isDark ? 'border-gray-700 hover:border-gray-600 bg-gray-800/30' : 'border-gray-200 hover:border-gray-300 bg-gray-50')
            }`}
            onClick={() => selectedConnectionId && setSaveToDb(v => !v)}
            title={!selectedConnectionId ? 'Selecciona una conexión para guardar en la BD' : 'Guardar también en la base de datos seleccionada'}
          >
            {/* Checkbox visual */}
            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
              saveToDb && selectedConnectionId
                ? 'bg-emerald-500 border-emerald-500'
                : isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-white'
            }`}>
              {saveToDb && selectedConnectionId && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                  <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                Guardar también en la base de datos
              </span>
              {!selectedConnectionId && (
                <span className="text-[10px] opacity-60">Sin conexión seleccionada</span>
              )}
              {saveToDb && selectedConnectionId && (
                <span className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Se guardará en la BD de la conexión seleccionada
                </span>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!trimmedName || !sectionId}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isDuplicate
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : 'bg-yellow-500 hover:bg-yellow-400 text-black'
              }`}
            >
              {isDuplicate ? 'Sobrescribir' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
