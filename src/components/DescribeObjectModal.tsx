"use client";

import React, { useState, useEffect } from 'react';
import { X, Database, Code, ShieldCheck, List, Layers, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface DescribeObjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  activeConnection: any;
  objectName: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DescribeObjectModal({
  isOpen,
  onClose,
  isDark,
  activeConnection,
  objectName,
  showToast
}: DescribeObjectModalProps) {
  const [activeTab, setActiveTab] = useState<'columns' | 'constraints' | 'indexes' | 'triggers' | 'ddl'>('columns');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editorRef = React.useRef<any>(null);
  const activeTabRef = React.useRef(activeTab);
  activeTabRef.current = activeTab;

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
  };

  // Intercept Ctrl+F when DDL tab is active to open Monaco's find widget
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
        if (activeTabRef.current === 'ddl' && editorRef.current) {
          e.preventDefault();
          editorRef.current.focus();
          const action = editorRef.current.getAction('actions.find');
          if (action) {
            action.run();
          } else {
            editorRef.current.trigger('keyboard', 'actions.find', null);
          }
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown, true); // use capture phase to intercept before Monaco
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && objectName && activeConnection) {
      const fetchDetails = async () => {
        setIsLoading(true);
        setError(null);
        setData(null);
        try {
          const res = await fetch('/api/oracle/describe-object', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection: activeConnection,
              name: objectName
            })
          });
          const result = await res.json();
          if (res.ok && result.data) {
            setData(result.data);
            if (result.data.objectType === 'TABLE') {
              setActiveTab('columns');
            } else {
              setActiveTab('ddl');
            }
          } else {
            setError(result.error || 'No se pudo recuperar la información del objeto');
            showToast(result.error || 'Error al buscar objeto', 'error');
          }
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Error de conexión');
          showToast(err.message || 'Error de conexión', 'error');
        } finally {
          setIsLoading(false);
        }
      };

      fetchDetails();
    }
  }, [isOpen, objectName, activeConnection, showToast]);

  if (!isOpen) return null;

  const bgStyle = isDark ? 'bg-gray-950 text-gray-200 border-gray-800' : 'bg-white text-gray-800 border-gray-200';
  const overlayBg = 'bg-black/60 backdrop-blur-sm';
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200';
  const cardBg = isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-gray-100/50 border-gray-200';

  const tabBtnClass = (tab: typeof activeTab) => {
    const isActive = activeTab === tab;
    return `px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
      isActive 
        ? 'border-blue-500 text-blue-500' 
        : 'border-transparent opacity-60 hover:opacity-100'
    }`;
  };

  return (
    <div className={`fixed inset-0 z-[700] flex items-center justify-center p-4 ${overlayBg} animate-fade-in`}>
      <div 
        className={`w-full max-w-4xl h-[85vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden font-sans ${bgStyle}`}
        style={{ colorScheme: isDark ? 'dark' : 'light' }}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${headerBg}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight truncate max-w-md">
                  {objectName || 'Detalle de Objeto'}
                </h3>
                {data && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    data.status === 'VALID'
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {data.status}
                  </span>
                )}
              </div>
              <p className="text-xs opacity-60">
                {data ? `${data.objectType} · Esquema: ${data.owner}` : 'Recuperando metadatos de la base de datos...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
            title="Cerrar visor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 relative flex flex-col">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-xs opacity-60 font-medium">Buscando objeto en la base de datos...</span>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="p-3 rounded-full bg-red-500/10 text-red-500 mb-3 border border-red-500/20">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>
              <h4 className="font-bold text-sm text-red-500">Error al Describir Objeto</h4>
              <p className="text-xs opacity-60 mt-1 max-w-md">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Tab Bar if it's a TABLE */}
              {data.objectType === 'TABLE' && (
                <div className={`flex items-center px-4 border-b shrink-0 ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50/40 border-gray-200'}`}>
                  <button onClick={() => setActiveTab('columns')} className={tabBtnClass('columns')}>
                    <span className="flex items-center gap-1.5"><List className="w-3.5 h-3.5" /> Columnas</span>
                  </button>
                  <button onClick={() => setActiveTab('constraints')} className={tabBtnClass('constraints')}>
                    <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Constraints</span>
                  </button>
                  <button onClick={() => setActiveTab('indexes')} className={tabBtnClass('indexes')}>
                    <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Índices</span>
                  </button>
                  <button onClick={() => setActiveTab('triggers')} className={tabBtnClass('triggers')}>
                    <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Triggers</span>
                  </button>
                  <button onClick={() => setActiveTab('ddl')} className={tabBtnClass('ddl')}>
                    <span className="flex items-center gap-1.5"><Code className="w-3.5 h-3.5" /> Código DDL</span>
                  </button>
                </div>
              )}

              {/* Detail Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar">
                {activeTab === 'columns' && data.objectType === 'TABLE' && (
                  <div className="border rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={isDark ? 'bg-gray-900/80 border-b border-gray-850' : 'bg-gray-100/80 border-b border-gray-250'}>
                          <th className="p-3 font-semibold w-1/3">Nombre Columna</th>
                          <th className="p-3 font-semibold">Tipo Dato</th>
                          <th className="p-3 font-semibold text-center w-24">Nulo</th>
                          <th className="p-3 font-semibold w-5/12">Comentarios</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-inherit">
                        {data.columns?.map((col: any) => (
                          <tr key={col.columnName} className={isDark ? 'hover:bg-gray-900/50' : 'hover:bg-gray-55/50'}>
                            <td className="p-3 font-mono font-bold text-blue-500/80 dark:text-blue-400/80 truncate">{col.columnName}</td>
                            <td className="p-3 font-mono text-gray-500 dark:text-gray-400">{col.dataType}</td>
                            <td className="p-3 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                col.nullable 
                                  ? 'bg-gray-500/10 text-gray-400' 
                                  : 'bg-red-500/10 text-red-500'
                              }`}>
                                {col.nullable ? 'SÍ' : 'NO'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-600 dark:text-gray-400 italic font-sans">{col.comments || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'constraints' && data.objectType === 'TABLE' && (
                  <div className="space-y-3">
                    {data.constraints && data.constraints.length > 0 ? (
                      data.constraints.map((c: any) => {
                        let typeLabel = c.constraintType;
                        let typeColor = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
                        if (c.constraintType === 'P') {
                          typeLabel = 'PRIMARY KEY';
                          typeColor = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                        } else if (c.constraintType === 'R') {
                          typeLabel = 'FOREIGN KEY';
                          typeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
                        } else if (c.constraintType === 'C') {
                          typeLabel = 'CHECK';
                          typeColor = 'bg-purple-500/10 text-purple-500 border-purple-500/20';
                        } else if (c.constraintType === 'U') {
                          typeLabel = 'UNIQUE';
                          typeColor = 'bg-green-500/10 text-green-500 border-green-500/20';
                        }

                        return (
                          <div key={c.constraintName} className={`p-4 rounded-2xl border flex flex-col gap-2 ${cardBg}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-gray-300 dark:text-gray-250 truncate">
                                🔑 {c.constraintName}
                              </span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${typeColor}`}>
                                {typeLabel}
                              </span>
                            </div>
                            <div className="text-xs space-y-1 mt-1 opacity-80">
                              <p>
                                <span className="font-semibold">Columnas:</span>{' '}
                                <code className="font-mono px-1 rounded bg-black/10 dark:bg-white/5">{c.columns.join(', ')}</code>
                              </p>
                              {c.constraintType === 'R' && (
                                <p>
                                  <span className="font-semibold">Referencia:</span>{' '}
                                  <code className="font-mono px-1 rounded bg-black/10 dark:bg-white/5">{c.rTableName}({c.rColumns.join(', ')})</code>
                                </p>
                              )}
                              {c.constraintType === 'C' && c.searchCondition && (
                                <p>
                                  <span className="font-semibold">Condición:</span>{' '}
                                  <code className="font-mono px-1 rounded bg-black/10 dark:bg-white/5 text-purple-400">{c.searchCondition}</code>
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-xs opacity-50 italic">Sin constraints definidas</div>
                    )}
                  </div>
                )}

                {activeTab === 'indexes' && data.objectType === 'TABLE' && (
                  <div className="space-y-3">
                    {data.indexes && data.indexes.length > 0 ? (
                      data.indexes.map((idx: any) => (
                        <div key={idx.indexName} className={`p-4 rounded-2xl border flex flex-col gap-2 ${cardBg}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-gray-300 dark:text-gray-250">
                              ⚡ {idx.indexName}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${
                              idx.uniqueness === 'UNIQUE'
                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}>
                              {idx.uniqueness}
                            </span>
                          </div>
                          <div className="text-xs mt-1 opacity-80">
                            <p>
                              <span className="font-semibold">Columnas Indexadas:</span>{' '}
                              <code className="font-mono px-1 rounded bg-black/10 dark:bg-white/5">{idx.columns.join(', ')}</code>
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-xs opacity-50 italic">Sin índices creados</div>
                    )}
                  </div>
                )}

                {activeTab === 'triggers' && data.objectType === 'TABLE' && (
                  <div className="space-y-3">
                    {data.triggers && data.triggers.length > 0 ? (
                      data.triggers.map((t: any) => (
                        <div key={t.triggerName} className={`p-4 rounded-2xl border flex flex-col gap-2 ${cardBg}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-gray-300 dark:text-gray-250">
                              ⚙️ {t.triggerName}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${
                              t.status === 'ENABLED'
                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                : 'bg-red-500/10 text-red-500 border-red-500/20'
                            }`}>
                              {t.status}
                            </span>
                          </div>
                          <div className="text-xs space-y-0.5 mt-1 opacity-85">
                            <p><span className="font-semibold">Tipo:</span> {t.triggerType}</p>
                            <p><span className="font-semibold">Evento:</span> {t.triggeringEvent}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-xs opacity-50 italic">Sin disparadores (triggers) asociados</div>
                    )}
                  </div>
                )}

                {activeTab === 'ddl' && (
                  <div className="h-[55vh] border rounded-2xl overflow-hidden">
                    <Editor
                      height="100%"
                      defaultLanguage="sql"
                      theme={isDark ? 'vs-dark' : 'light'}
                      value={data.ddl}
                      onMount={handleEditorMount}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono, Consolas, monospace',
                        lineHeight: 20,
                        padding: { top: 12, bottom: 12 },
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs opacity-50">
              No hay datos para mostrar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
