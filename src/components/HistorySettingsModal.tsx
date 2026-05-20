"use client";

import { useState } from 'react';
import { CalendarClock, Trash2, X } from 'lucide-react';

interface HistorySettingsModalProps {
  isOpen: boolean;
  isDark: boolean;
  currentDays: number;
  historyCount: number;
  onSave: (days: number) => void;
  onPurge: () => void;
  onClose: () => void;
}

export default function HistorySettingsModal({
  isOpen, isDark, currentDays, historyCount, onSave, onPurge, onClose
}: HistorySettingsModalProps) {
  const [days, setDays] = useState(currentDays);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(days);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl border flex flex-col overflow-hidden ${
        isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
      }`}>
        {/* Header */}
        <div className={`flex items-center gap-3 p-5 border-b ${isDark ? 'border-gray-800 bg-gray-950/30' : 'border-gray-100 bg-gray-50/50'}`}>
          <div className={`p-2.5 rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <CalendarClock className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm">Configuración del Historial</h2>
            <p className="text-xs opacity-50 mt-0.5">Configura cuántos días mantener el historial</p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Info */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs ${
            isDark ? 'bg-gray-800/60 text-gray-300' : 'bg-gray-100 text-gray-600'
          }`}>
            <CalendarClock className="w-4 h-4 opacity-60 flex-shrink-0" />
            <span>Actualmente tienes <strong className="text-blue-500">{historyCount}</strong> registros en el historial.</span>
          </div>

          {/* Days Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold opacity-70">Días de retención</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= 365) setDays(v);
                }}
                className={`w-20 px-3 py-2 rounded-xl text-sm text-center border font-mono font-bold ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'
                } outline-none transition-colors`}
              />
            </div>
            <p className="text-[11px] opacity-40">Los registros más antiguos de {days} día{days !== 1 ? 's' : ''} se eliminarán automáticamente.</p>
          </div>

          {/* Purge button */}
          <button
            onClick={onPurge}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
              isDark
                ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar historial expirado ahora
          </button>
        </div>

        {/* Footer */}
        <div className={`flex gap-2 p-5 border-t ${isDark ? 'border-gray-800 bg-gray-950/20' : 'border-gray-100 bg-gray-50/30'}`}>
          <button
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors active:scale-[0.98]"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
