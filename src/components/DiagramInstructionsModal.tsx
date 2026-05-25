"use client";
import { useState } from 'react';
import { X, Copy, Check, Terminal, Database, ChevronRight } from 'lucide-react';
import { DIAGRAM_SQL_CONTENT } from '@/constants/diagramSql';

interface DiagramInstructionsModalProps {
  isOpen: boolean;
  isDark: boolean;
  onClose: () => void;
}

export default function DiagramInstructionsModal({ isOpen, isDark, onClose }: DiagramInstructionsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(DIAGRAM_SQL_CONTENT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl border overflow-hidden
          transition-all duration-300
          ${isDark
            ? 'bg-gray-950/95 border-gray-700/60 text-gray-100 shadow-black/80'
            : 'bg-white/95 border-gray-200 text-gray-800 shadow-gray-400/40'
          }`}
        style={{ maxHeight: '85vh', backdropFilter: 'blur(12px)' }}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b flex-shrink-0
          ${isDark ? 'border-gray-800 bg-gray-900/60' : 'border-gray-100 bg-gray-50/80'}`}>
          <div className={`p-2 rounded-xl flex-shrink-0
            ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
            <Terminal className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm">Creación de Estructura de Modelos Relacionales</h2>
            <p className="text-xs opacity-50 mt-0.5">
              Ejecuta este script en tu base de datos Oracle para habilitar el guardado de diagramas
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0
              ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info banner */}
        <div className={`px-5 py-3 flex items-start gap-3 border-b text-xs flex-shrink-0
          ${isDark ? 'border-gray-800/60 bg-amber-500/5' : 'border-amber-100 bg-amber-50/70'}`}>
          <Database className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <div className={`leading-relaxed ${isDark ? 'text-amber-300/80' : 'text-amber-800'}`}>
            <span className="font-semibold">La tabla necesaria no existe en esta base de datos.</span>
            {' '}Copia el script, conéctate a tu base de datos Oracle con SQL*Plus, SQL Developer u otra herramienta,
            y ejecútalo para crear la tabla <span className="font-mono font-semibold">TKR_MODELOS_RELACIONALES</span>,
            la secuencia y el disparador de auto-incremento.
          </div>
        </div>

        {/* Steps */}
        <div className={`px-5 py-3 flex items-center gap-4 text-xs border-b flex-shrink-0
          ${isDark ? 'border-gray-800/60' : 'border-gray-100'}`}>
          {[
            { step: '1', label: 'Copia el script' },
            { step: '2', label: 'Abre tu cliente SQL' },
            { step: '3', label: 'Pega y ejecuta' },
          ].map((s, i) => (
            <div key={s.step} className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0
                ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                {s.step}
              </span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{s.label}</span>
              {i < 2 && <ChevronRight className="w-3 h-3 opacity-30" />}
            </div>
          ))}
        </div>

        {/* Code viewer */}
        <div className="flex-1 min-h-0 relative">
          <pre
            className={`h-full overflow-auto p-5 text-xs leading-relaxed font-mono custom-scrollbar
              ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
            style={{
              fontFamily: '"JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace',
              fontSize: '0.72rem',
              lineHeight: '1.6',
              maxHeight: '45vh',
            }}
          >
            {DIAGRAM_SQL_CONTENT}
          </pre>
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 flex items-center justify-between border-t flex-shrink-0
          ${isDark ? 'border-gray-800 bg-gray-900/40' : 'border-gray-100 bg-gray-50/60'}`}>
          <p className="text-xs opacity-40">
            tkr_modelos_relacionales.sql — Oracle SQL Script
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors
                ${isDark
                  ? 'border-gray-700 hover:bg-gray-800 text-gray-300'
                  : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
            >
              Cerrar
            </button>
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200
                ${copied
                  ? isDark
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-green-100 text-green-700 border border-green-300'
                  : isDark
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                    : 'bg-blue-600 text-white border border-blue-600 hover:bg-blue-700'
                }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Script
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
