"use client";

import { useState } from 'react';
import { BookmarkPlus, Plus, XCircle } from 'lucide-react';
import { FavoriteSection } from '@/types';
import { VARIOS_SECTION_ID } from '@/store/useAppStore';

interface FavoriteNameModalProps {
  isDark: boolean;
  existingNames: string[];
  sections: FavoriteSection[];
  /** Pre-fill the name field (e.g. from tab title) */
  initialName?: string;
  onConfirm: (name: string, sectionId: string) => void;
  onCancel: () => void;
  onAddSection: (id: string, name: string) => void;
}

export default function FavoriteNameModal({
  isDark,
  existingNames,
  sections,
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

  const trimmedName = name.trim();
  const trimmedSecName = newSecName.trim();
  const isDuplicate = existingNames.some(n => n.toLowerCase() === trimmedName.toLowerCase());

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
    if (isDuplicate) { setNameError('Ya existe un favorito con ese nombre.'); return; }
    if (!sectionId) { setNameError('Debes seleccionar una sección.'); return; }
    onConfirm(trimmedName, sectionId);
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
            <p className="text-xs opacity-50">Asigna nombre y sección</p>
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
            {(nameError || isDuplicate) && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {nameError || 'Ya existe un favorito con ese nombre.'}
              </span>
            )}
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
              disabled={!trimmedName || isDuplicate || !sectionId}
              className="flex-1 py-2 rounded-lg text-sm bg-yellow-500 hover:bg-yellow-400 text-black font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
