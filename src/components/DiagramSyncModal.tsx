"use client";
import { useState, useEffect } from 'react';
import { CloudDownload, CloudUpload, X, Search, Trash2, HelpCircle, FileText, AlertTriangle } from 'lucide-react';
import DiagramInstructionsModal from './DiagramInstructionsModal';

interface DiagramSyncModalProps {
  isOpen: boolean;
  isDark: boolean;
  mode: 'save' | 'load';
  dbModels?: Array<{ ID: number; NOMBRE_MODELO: string }>;
  currentTitle: string;
  initialErrorMsg?: string;
  onSave?: (name: string) => Promise<void>;
  onLoad?: (id: number, name: string) => Promise<void>;
  onDelete?: (id: number, name: string) => Promise<void>;
  onCancel: () => void;
}

export default function DiagramSyncModal({
  isOpen,
  isDark,
  mode,
  dbModels = [],
  currentTitle,
  initialErrorMsg = '',
  onSave,
  onLoad,
  onDelete,
  onCancel
}: DiagramSyncModalProps) {
  const [modelName, setModelName] = useState(currentTitle);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState(initialErrorMsg);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [modelToDelete, setModelToDelete] = useState<{ id: number; name: string } | null>(null);

  // Sync state with props
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(initialErrorMsg);
      if (mode === 'save') {
        setModelName(currentTitle);
      } else {
        setSelectedModelId(null);
      }
    }
  }, [isOpen, mode, currentTitle, initialErrorMsg]);

  if (!isOpen) return null;

  // Filter existing models
  const filteredModels = dbModels.filter(m =>
    m.NOMBRE_MODELO.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if current name already exists in database
  const nameExistsInDb = dbModels.some(
    m => m.NOMBRE_MODELO.trim().toLowerCase() === modelName.trim().toLowerCase()
  );

  const handleConfirm = async () => {
    setErrorMsg('');
    if (mode === 'save') {
      if (!modelName.trim()) {
        setErrorMsg('El nombre del modelo no puede estar vacío.');
        return;
      }
      setIsSubmitting(true);
      try {
        if (onSave) {
          await onSave(modelName.trim());
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al guardar el modelo.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (selectedModelId === null) {
        setErrorMsg('Selecciona un modelo para cargar.');
        return;
      }
      const selectedModel = dbModels.find(m => m.ID === selectedModelId);
      if (!selectedModel) return;

      setIsSubmitting(true);
      try {
        if (onLoad) {
          await onLoad(selectedModel.ID, selectedModel.NOMBRE_MODELO);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al cargar el modelo.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDeleteModelClick = (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    setModelToDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!modelToDelete) return;
    const { id, name } = modelToDelete;
    setModelToDelete(null);
    setErrorMsg('');
    try {
      if (onDelete) {
        await onDelete(id, name);
        if (selectedModelId === id) {
          setSelectedModelId(null);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el modelo.');
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
                {mode === 'save' ? 'Guardar diagrama en BD' : 'Cargar diagrama de BD'}
              </h2>
              <p className="text-xs opacity-50">
                {mode === 'save'
                  ? 'Guarda el modelo actual en la tabla TKR_MODELOS_RELACIONALES'
                  : 'Carga un modelo guardado en una pestaña nueva'}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-black/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs rounded-lg border border-red-500/35 bg-red-500/10 text-red-400 flex items-start gap-2.5">
              <span className="flex-1 leading-relaxed">{errorMsg}</span>
              {(errorMsg.includes('TKR_MODELOS_RELACIONALES') || errorMsg.includes('ORA-00942')) && (
                <button
                  type="button"
                  onClick={() => setShowSqlModal(true)}
                  title="Ver instrucciones para crear la tabla en Oracle"
                  className={`flex-shrink-0 mt-0.5 p-1 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95
                    ${isDark
                      ? 'text-amber-400 hover:bg-amber-500/20 hover:text-amber-300'
                      : 'text-amber-600 hover:bg-amber-100 hover:text-amber-700'
                    }`}
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <DiagramInstructionsModal
            isOpen={showSqlModal}
            isDark={isDark}
            onClose={() => setShowSqlModal(false)}
          />

          {mode === 'save' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold opacity-80">Nombre del Modelo</label>
                <input
                  type="text"
                  placeholder="Ej. Modelo de Ventas..."
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className={`w-full py-2 px-3 rounded-lg border text-sm font-medium transition-all outline-none ${
                    isDark
                      ? 'border-gray-800 bg-gray-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                {nameExistsInDb && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-500 font-semibold mt-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Ya existe un modelo con este nombre en la base de datos y se sobrescribirá.
                  </div>
                )}
              </div>

              {dbModels.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold opacity-65">Modelos existentes en la BD</span>
                  <div className={`border rounded-xl divide-y overflow-hidden max-h-[200px] overflow-y-auto ${
                    isDark ? 'border-gray-800 divide-gray-800' : 'border-gray-150 divide-gray-150'
                  }`}>
                    {dbModels.map(m => (
                      <div
                        key={m.ID}
                        onClick={() => setModelName(m.NOMBRE_MODELO)}
                        className={`p-2.5 text-xs truncate cursor-pointer transition-colors flex items-center gap-2 ${
                          modelName.trim().toLowerCase() === m.NOMBRE_MODELO.trim().toLowerCase()
                            ? (isDark ? 'bg-blue-500/10 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-600 font-semibold')
                            : (isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50')
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 opacity-60" />
                        <span className="truncate flex-1">{m.NOMBRE_MODELO}</span>
                        <span className="opacity-40 text-[10px]">ID: {m.ID}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
                isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <Search className="w-4 h-4 opacity-50" />
                <input
                  type="text"
                  placeholder="Buscar modelo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none w-full text-xs"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}>
                    <X className="w-3.5 h-3.5 opacity-55 hover:opacity-90" />
                  </button>
                )}
              </div>

              {/* Models List */}
              {filteredModels.length === 0 ? (
                <div className="text-center py-10 opacity-40 text-xs italic">
                  {dbModels.length === 0 ? 'No hay modelos en la base de datos.' : 'No se encontraron modelos.'}
                </div>
              ) : (
                <div className={`border rounded-xl divide-y overflow-hidden max-h-[300px] overflow-y-auto ${
                  isDark ? 'border-gray-800 divide-gray-800' : 'border-gray-150 divide-gray-150'
                }`}>
                  {filteredModels.map(m => {
                    const isSelected = selectedModelId === m.ID;
                    return (
                      <div
                        key={m.ID}
                        onClick={() => setSelectedModelId(m.ID)}
                        onDoubleClick={handleConfirm}
                        className={`p-3 text-xs cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                          isSelected
                            ? (isDark ? 'bg-blue-500/10 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-600 font-semibold')
                            : (isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50')
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="w-4 h-4 opacity-60 flex-shrink-0" />
                          <span className="truncate">{m.NOMBRE_MODELO}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="opacity-40 text-[10px] font-mono">ID: {m.ID}</span>
                          <button
                            onClick={(e) => handleDeleteModelClick(e, m.ID, m.NOMBRE_MODELO)}
                            className="p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                            title="Eliminar de la BD"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
            disabled={isSubmitting || (mode === 'save' ? !modelName.trim() : selectedModelId === null)}
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
            {mode === 'save' ? 'Guardar en BD' : 'Cargar en Diagrama'}
          </button>
        </div>

      </div>

      {/* Sub-modal de Confirmación de Eliminación con Estilo Premium */}
      {modelToDelete && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div 
            className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 flex flex-col items-center text-center transition-all ${
              isDark ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
            }`}
          >
            <div className={`p-3 rounded-full mb-4 ${isDark ? 'bg-red-500/15' : 'bg-red-50'}`}>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-base font-bold mb-2">¿Eliminar modelo?</h3>
            <p className="text-xs opacity-75 mb-6 leading-relaxed">
              ¿Estás seguro de que deseas eliminar el modelo <strong className="font-semibold text-red-400">"{modelToDelete.name}"</strong> de la base de datos? Esta acción no se puede deshacer.
            </p>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setModelToDelete(null)}
                className={`flex-1 py-2 rounded-lg text-sm border font-semibold transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/10"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
