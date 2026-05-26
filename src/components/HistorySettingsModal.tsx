"use client";

import { useState, useEffect } from 'react';
import { CalendarClock, Trash2, X, Clock, AlertTriangle } from 'lucide-react';

interface HistorySettingsModalProps {
  isOpen: boolean;
  isDark: boolean;
  currentDays: number;
  historyCount: number;
  inactivityEnabled: boolean;
  inactivityMinutes: number;
  onSave: (days: number, inactivityEnabled: boolean, inactivityMinutes: number) => void;
  onPurge: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

export default function HistorySettingsModal({
  isOpen, isDark, currentDays, historyCount, inactivityEnabled, inactivityMinutes, onSave, onPurge, onClearAll, onClose
}: HistorySettingsModalProps) {
  const [days, setDays] = useState(currentDays);
  const [inactivityEnabledState, setInactivityEnabledState] = useState(inactivityEnabled);
  const [inactivityMinutesState, setInactivityMinutesState] = useState(inactivityMinutes);

  // Custom prompt states
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [promptValue, setPromptValue] = useState(inactivityMinutes.toString());

  // Custom confirm states
  const [isConfirmAllOpen, setIsConfirmAllOpen] = useState(false);

  // Sync state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setDays(currentDays);
      setInactivityEnabledState(inactivityEnabled);
      setInactivityMinutesState(inactivityMinutes);
      setPromptValue(inactivityMinutes.toString());
    }
  }, [isOpen, currentDays, inactivityEnabled, inactivityMinutes]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(days, inactivityEnabledState, inactivityMinutesState);
    onClose();
  };

  const handleInactivityToggle = (checked: boolean) => {
    if (checked) {
      setPromptValue(inactivityMinutesState.toString());
      setIsPromptOpen(true);
    } else {
      setInactivityEnabledState(false);
    }
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

          {/* Purge & Clear all buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPurge}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[11px] font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                isDark
                  ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar expirado
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmAllOpen(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[11px] font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                isDark
                  ? 'border-red-950 bg-red-950/20 text-red-400 hover:bg-red-900/30'
                  : 'border-red-200 bg-red-100/50 text-red-700 hover:bg-red-200/60'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar todo
            </button>
          </div>

          {/* Divider */}
          <div className={`border-t ${isDark ? 'border-gray-800' : 'border-gray-150'} my-4`} />

          {/* Inactivity section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Inactividad de Sesión</span>
              </div>
              
              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={inactivityEnabledState}
                  onChange={(e) => handleInactivityToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-9 h-5 rounded-full peer transition-all duration-300 relative ${
                  isDark ? 'bg-gray-800' : 'bg-gray-200'
                } peer-checked:bg-blue-600 after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full`} />
              </label>
            </div>

            <p className="text-[11px] opacity-50 leading-relaxed">
              Cierra la sesión automáticamente y vuelve a la pantalla de login tras un periodo de inactividad detectada.
            </p>

            {inactivityEnabledState && (
              <div className="flex items-center justify-between gap-3 mt-2 pl-6 animate-fade-in-up" style={{ animationDuration: '300ms' }}>
                <span className="text-xs font-medium opacity-85">Tiempo límite (minutos):</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={inactivityMinutesState}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (v >= 1 && v <= 1440) setInactivityMinutesState(v);
                  }}
                  className={`w-20 px-2.5 py-1.5 rounded-xl text-xs text-center border font-mono font-bold ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'
                  } outline-none transition-colors`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex gap-2 p-5 border-t ${isDark ? 'border-gray-800 bg-gray-950/20' : 'border-gray-100 bg-gray-50/30'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors active:scale-[0.98]"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* Modal Custom Prompt de Tiempo de Inactividad */}
      {isPromptOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className={`w-full max-w-xs rounded-2xl shadow-2xl border p-5 flex flex-col gap-4 ${
            isDark ? 'bg-gray-900 border-gray-700 text-gray-200 shadow-black/80' : 'bg-white border-gray-200 text-gray-800 shadow-gray-300/40'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider">Configurar Límite</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] opacity-75">Ingrese el tiempo en minutos (mínimo 1):</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-sm border font-mono font-bold text-center ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'
                } outline-none transition-colors`}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPromptOpen(false);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-400' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseInt(promptValue, 10);
                  if (!isNaN(val) && val >= 1) {
                    setInactivityMinutesState(val);
                    setInactivityEnabledState(true);
                    setIsPromptOpen(false);
                  } else {
                    alert("Por favor ingrese un número válido mayor o igual a 1.");
                  }
                }}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors active:scale-[0.98]"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Custom Confirm para Eliminar Todo el Historial */}
      {isConfirmAllOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className={`w-full max-w-xs rounded-2xl shadow-2xl border p-5 flex flex-col gap-4 ${
            isDark ? 'bg-gray-900 border-gray-700 text-gray-200 shadow-black/80' : 'bg-white border-gray-200 text-gray-800 shadow-gray-300/40'
          }`}>
            <div className="flex items-center gap-2.5 text-red-500">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider">¿Eliminar Historial?</h3>
            </div>

            <p className="text-xs opacity-75 leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente todos los registros del historial? Esta acción no se puede deshacer.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmAllOpen(false)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-400' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setIsConfirmAllOpen(false);
                }}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors active:scale-[0.98]"
              >
                Eliminar Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
