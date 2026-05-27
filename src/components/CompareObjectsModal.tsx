"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Database, Upload, GitCompare, FileText, Loader2, RefreshCw } from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';

interface CompareObjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  connections: any[];
  activeConnection: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const OBJECT_TYPES = [
  'TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER', 'INDEX', 'SEQUENCE', 'SYNONYM'
];

// Custom Searchable Dropdown Selector
function SearchableSelect({
  label,
  value,
  onChange,
  options,
  isLoading,
  isDark
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { name: string; status: string }[];
  isLoading: boolean;
  isDark: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  const listBg = isDark ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-200';
  const hoverBg = isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-105 text-gray-800';

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className="text-[10px] font-bold opacity-60">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs text-left outline-none focus:ring-1 focus:ring-blue-500 flex justify-between items-center transition-all ${
          isDark 
            ? 'bg-gray-900 border-gray-800 text-gray-200 focus:ring-blue-500' 
            : 'bg-white border-gray-300 text-gray-850 focus:ring-blue-500'
        }`}
      >
        <span className="truncate">{value || 'Seleccionar objeto...'}</span>
        <span className="text-[10px] opacity-50">▼</span>
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl z-[100] flex flex-col max-h-60 p-2 overflow-hidden ${listBg}`}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar objeto..."
            className={`w-full px-2.5 py-1.5 mb-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-transparent ${
              isDark ? 'border-gray-800 text-gray-200' : 'border-gray-300 text-gray-800'
            }`}
          />
          
          <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
            {isLoading ? (
              <div className="text-center py-4 text-xs opacity-50 flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando objetos...
              </div>
            ) : filtered.length > 0 ? (
              filtered.map(o => (
                <button
                  key={o.name}
                  type="button"
                  onClick={() => {
                    onChange(o.name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${hoverBg}`}
                >
                  <span className="truncate font-semibold">{o.name}</span>
                  <span className={`text-[8px] px-1 rounded font-bold ${
                    o.status === 'VALID'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {o.status}
                  </span>
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-xs opacity-40 italic">Ningún objeto encontrado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompareObjectsModal({
  isOpen,
  onClose,
  isDark,
  connections,
  activeConnection,
  showToast
}: CompareObjectsModalProps) {
  // Lado A (Izquierdo / Original)
  const [sourceTypeA, setSourceTypeA] = useState<'database' | 'file'>('database');
  const [connectionIdA, setConnectionIdA] = useState<string>('');
  const [schemaA, setSchemaA] = useState<string>('');
  const [objectTypeA, setObjectTypeA] = useState<string>('TABLE');
  const [objectNameA, setObjectNameA] = useState<string>('');
  const [fileContentA, setFileContentA] = useState<string>('');
  const [fileNameA, setFileNameA] = useState<string>('');

  // Lado B (Derecho / Modificado)
  const [sourceTypeB, setSourceTypeB] = useState<'database' | 'file'>('database');
  const [connectionIdB, setConnectionIdB] = useState<string>('');
  const [schemaB, setSchemaB] = useState<string>('');
  const [objectTypeB, setObjectTypeB] = useState<string>('TABLE');
  const [objectNameB, setObjectNameB] = useState<string>('');
  const [fileContentB, setFileContentB] = useState<string>('');
  const [fileNameB, setFileNameB] = useState<string>('');

  // Debounced schema states to avoid database overload during keystrokes
  const [debouncedSchemaA, setDebouncedSchemaA] = useState<string>('');
  const [debouncedSchemaB, setDebouncedSchemaB] = useState<string>('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSchemaA(schemaA);
    }, 500);
    return () => clearTimeout(handler);
  }, [schemaA]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSchemaB(schemaB);
    }, 500);
    return () => clearTimeout(handler);
  }, [schemaB]);

  // Database schema lists
  const [schemasA, setSchemasA] = useState<string[]>([]);
  const [isLoadingSchemasA, setIsLoadingSchemasA] = useState(false);

  const [schemasB, setSchemasB] = useState<string[]>([]);
  const [isLoadingSchemasB, setIsLoadingSchemasB] = useState(false);

  // Database objects cache states
  const [objectsA, setObjectsA] = useState<Record<string, { name: string; status: string }[]>>({});
  const [isLoadingObjectsA, setIsLoadingObjectsA] = useState(false);

  const [objectsB, setObjectsB] = useState<Record<string, { name: string; status: string }[]>>({});
  const [isLoadingObjectsB, setIsLoadingObjectsB] = useState(false);

  // Diff Editor values
  const [codeA, setCodeA] = useState<string>('-- Ejecuta la comparación para cargar el contenido del objeto A');
  const [codeB, setCodeB] = useState<string>('-- Ejecuta la comparación para cargar el contenido del objeto B');
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const fileInputRefA = useRef<HTMLInputElement>(null);
  const fileInputRefB = useRef<HTMLInputElement>(null);

  // Initialize connection IDs
  useEffect(() => {
    if (isOpen) {
      const defaultId = activeConnection?.id || connections[0]?.id || '';
      setConnectionIdA(defaultId);
      setConnectionIdB(defaultId);
      
      const conn = connections.find(c => c.id === defaultId);
      if (conn) {
        setSchemaA(conn.user?.toUpperCase() || '');
        setSchemaB(conn.user?.toUpperCase() || '');
      }
      setComparisonError(null);
    }
  }, [isOpen, activeConnection, connections]);

  // Sync schema default when connection change
  useEffect(() => {
    const connA = connections.find(c => c.id === connectionIdA);
    if (connA) {
      setSchemaA(connA.user?.toUpperCase() || '');
    }
  }, [connectionIdA, connections]);

  useEffect(() => {
    const connB = connections.find(c => c.id === connectionIdB);
    if (connB) {
      setSchemaB(connB.user?.toUpperCase() || '');
      if (sourceTypeA === 'database' && objectNameA) {
        setObjectTypeB(objectTypeA);
      }
    }
  }, [connectionIdB, connections, sourceTypeA, objectNameA, objectTypeA]);

  // Auto-select object in Lado B if it exists in the loaded list when copying from Lado A
  useEffect(() => {
    if (sourceTypeA === 'database' && objectNameA && sourceTypeB === 'database') {
      const list = objectsB[objectTypeA] || [];
      const exists = list.some(o => o.name.toUpperCase() === objectNameA.toUpperCase());
      if (exists) {
        setObjectNameB(objectNameA);
      } else {
        setObjectNameB('');
      }
    }
  }, [objectsB, objectNameA, objectTypeA, sourceTypeA, sourceTypeB]);

  // Fetch schemas for Lado A
  useEffect(() => {
    if (!isOpen || sourceTypeA !== 'database' || !connectionIdA) {
      setSchemasA([]);
      return;
    }

    const fetchSchemasA = async () => {
      setIsLoadingSchemasA(true);
      try {
        const conn = connections.find(c => c.id === connectionIdA);
        if (!conn) return;

        const res = await fetch('/api/oracle/schemas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection: conn })
        });
        const data = await res.json();
        if (res.ok && data.schemas) {
          setSchemasA(data.schemas);
        } else {
          setSchemasA([conn.user?.toUpperCase() || '']);
        }
      } catch (err) {
        console.error('Error fetching schemas A', err);
        const conn = connections.find(c => c.id === connectionIdA);
        setSchemasA(conn ? [conn.user?.toUpperCase() || ''] : []);
      } finally {
        setIsLoadingSchemasA(false);
      }
    };

    fetchSchemasA();
  }, [isOpen, sourceTypeA, connectionIdA, connections]);

  // Fetch schemas for Lado B
  useEffect(() => {
    if (!isOpen || sourceTypeB !== 'database' || !connectionIdB) {
      setSchemasB([]);
      return;
    }

    const fetchSchemasB = async () => {
      setIsLoadingSchemasB(true);
      try {
        const conn = connections.find(c => c.id === connectionIdB);
        if (!conn) return;

        const res = await fetch('/api/oracle/schemas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection: conn })
        });
        const data = await res.json();
        if (res.ok && data.schemas) {
          setSchemasB(data.schemas);
        } else {
          setSchemasB([conn.user?.toUpperCase() || '']);
        }
      } catch (err) {
        console.error('Error fetching schemas B', err);
        const conn = connections.find(c => c.id === connectionIdB);
        setSchemasB(conn ? [conn.user?.toUpperCase() || ''] : []);
      } finally {
        setIsLoadingSchemasB(false);
      }
    };

    fetchSchemasB();
  }, [isOpen, sourceTypeB, connectionIdB, connections]);

  // Fetch objects list for Lado A
  useEffect(() => {
    if (!isOpen || sourceTypeA !== 'database' || !connectionIdA) {
      setObjectsA({});
      return;
    }

    const fetchObjectsA = async () => {
      setIsLoadingObjectsA(true);
      try {
        const conn = connections.find(c => c.id === connectionIdA);
        if (!conn) return;

        const res = await fetch('/api/oracle/objects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: conn,
            schema: debouncedSchemaA.trim() || undefined,
            skipAuxiliary: true
          })
        });

        const data = await res.json();
        if (res.ok && data.objects) {
          setObjectsA(data.objects);
        } else {
          setObjectsA({});
        }
      } catch (err) {
        console.error('Error fetching objects A', err);
        setObjectsA({});
      } finally {
        setIsLoadingObjectsA(false);
      }
    };

    fetchObjectsA();
  }, [isOpen, sourceTypeA, connectionIdA, debouncedSchemaA, connections]);

  // Fetch objects list for Lado B
  useEffect(() => {
    if (!isOpen || sourceTypeB !== 'database' || !connectionIdB) {
      setObjectsB({});
      return;
    }

    const fetchObjectsB = async () => {
      setIsLoadingObjectsB(true);
      try {
        const conn = connections.find(c => c.id === connectionIdB);
        if (!conn) return;

        const res = await fetch('/api/oracle/objects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: conn,
            schema: debouncedSchemaB.trim() || undefined,
            skipAuxiliary: true
          })
        });

        const data = await res.json();
        if (res.ok && data.objects) {
          setObjectsB(data.objects);
        } else {
          setObjectsB({});
        }
      } catch (err) {
        console.error('Error fetching objects B', err);
        setObjectsB({});
      } finally {
        setIsLoadingObjectsB(false);
      }
    };

    fetchObjectsB();
  }, [isOpen, sourceTypeB, connectionIdB, debouncedSchemaB, connections]);

  if (!isOpen) return null;

  // File Upload Handlers
  const handleFileUploadA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileNameA(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFileContentA(evt.target?.result as string || '');
      showToast(`Archivo '${file.name}' cargado en Lado A`, 'info');
    };
    reader.readAsText(file);
  };

  const handleFileUploadB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileNameB(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFileContentB(evt.target?.result as string || '');
      showToast(`Archivo '${file.name}' cargado en Lado B`, 'info');
    };
    reader.readAsText(file);
  };

  // Fetch Object DDL from Endpoint
  const fetchObjectDdl = async (
    connId: string,
    schema: string,
    objType: string,
    objName: string
  ): Promise<string> => {
    const conn = connections.find(c => c.id === connId);
    if (!conn) throw new Error('Conexión inválida seleccionada');
    if (!objName.trim()) throw new Error('Nombre de objeto es requerido');

    const res = await fetch('/api/oracle/object-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connection: conn,
        name: objName.trim(),
        type: objType,
        schema: schema.trim() || undefined
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener código del objeto');
    }

    return data.source || '';
  };

  // Run Comparison
  const handleCompare = async () => {
    setComparisonError(null);
    setIsComparing(true);

    try {
      let finalCodeA = '';
      let finalCodeB = '';

      // 1. Resolve Side A
      if (sourceTypeA === 'database') {
        if (!objectNameA.trim()) {
          throw new Error('Especifica el nombre del objeto en el Lado A');
        }
        finalCodeA = await fetchObjectDdl(connectionIdA, schemaA, objectTypeA, objectNameA);
      } else {
        if (!fileContentA) {
          throw new Error('Carga un archivo local para el Lado A');
        }
        finalCodeA = fileContentA;
      }

      // 2. Resolve Side B
      if (sourceTypeB === 'database') {
        if (!objectNameB.trim()) {
          throw new Error('Especifica el nombre del objeto en el Lado B');
        }
        finalCodeB = await fetchObjectDdl(connectionIdB, schemaB, objectTypeB, objectNameB);
      } else {
        if (!fileContentB) {
          throw new Error('Carga un archivo local para el Lado B');
        }
        finalCodeB = fileContentB;
      }

      setCodeA(finalCodeA);
      setCodeB(finalCodeB);

      const cleanA = finalCodeA.replace(/\r\n/g, '\n').trim();
      const cleanB = finalCodeB.replace(/\r\n/g, '\n').trim();

      if (cleanA === cleanB) {
        showToast('Los objetos son completamente iguales', 'success');
      } else {
        showToast('Comparación completada exitosamente', 'success');
      }
    } catch (err: any) {
      setComparisonError(err.message || 'Error durante la comparación');
      showToast(err.message || 'Error de comparación', 'error');
    } finally {
      setIsComparing(false);
    }
  };

  const bgStyle = isDark ? 'bg-gray-950 text-gray-200' : 'bg-gray-5 text-gray-800';
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const panelBg = isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-gray-100/50 border-gray-200';
  const selectBg = isDark 
    ? 'bg-gray-900 border-gray-800 text-gray-200 focus:ring-blue-500' 
    : 'bg-white border-gray-300 text-gray-850 focus:ring-blue-500';

  return (
    <div 
      className={`fixed inset-0 z-[600] flex flex-col font-sans select-none overflow-hidden animate-fade-in pointer-events-auto ${bgStyle}`}
      style={{ colorScheme: isDark ? 'dark' : 'light' }}
    >
      {/* Header */}
      <div className={`h-16 border-b px-6 flex items-center justify-between shrink-0 ${headerBg}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 animate-pulse">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">Comparador de Objetos</h3>
            <p className="text-xs opacity-60">Analiza diferencias de código DDL o archivos locales lado a lado a pantalla completa</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
          title="Cerrar comparador"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Configuration Bar */}
      <div className={`p-4 border-b shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch ${isDark ? 'bg-gray-900/30' : 'bg-gray-50/20'}`}>
        {/* Lado A (Izquierdo) */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-3 ${panelBg}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Lado A (Original / Izquierda)</span>
            <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-0.5 border dark:border-gray-800">
              <button
                onClick={() => setSourceTypeA('database')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  sourceTypeA === 'database' 
                    ? (isDark ? 'bg-gray-800 text-white shadow-sm' : 'bg-white text-gray-800 shadow-sm border border-gray-200/50')
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Base de Datos
              </button>
              <button
                onClick={() => setSourceTypeA('file')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  sourceTypeA === 'file' 
                    ? (isDark ? 'bg-gray-800 text-white shadow-sm' : 'bg-white text-gray-800 shadow-sm border border-gray-200/50')
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Archivo Local
              </button>
            </div>
          </div>

          {sourceTypeA === 'database' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">Conexión</label>
                <select
                  value={connectionIdA}
                  onChange={(e) => setConnectionIdA(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${selectBg}`}
                >
                  {connections.map(c => (
                    <option key={c.id} value={c.id} className={isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800'}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">Esquema</label>
                <select
                  value={schemaA}
                  onChange={(e) => setSchemaA(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${selectBg}`}
                >
                  {isLoadingSchemasA ? (
                    <option value="" className={isDark ? 'bg-gray-900 text-gray-250' : 'bg-white text-gray-800'}>
                      Cargando esquemas...
                    </option>
                  ) : (
                    schemasA.map(sch => (
                      <option key={sch} value={sch} className={isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800'}>
                        {sch}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">Tipo Objeto</label>
                <select
                  value={objectTypeA}
                  onChange={(e) => {
                    setObjectTypeA(e.target.value);
                    setObjectNameA('');
                  }}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${selectBg}`}
                >
                  {OBJECT_TYPES.map(t => (
                    <option key={t} value={t} className={isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800'}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              
              <SearchableSelect
                label="Objeto"
                value={objectNameA}
                onChange={setObjectNameA}
                options={objectsA[objectTypeA] || []}
                isLoading={isLoadingObjectsA}
                isDark={isDark}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <button
                onClick={() => fileInputRefA.current?.click()}
                className="py-2 px-4 rounded-xl text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-md"
              >
                <Upload className="w-3.5 h-3.5" /> Subir Archivo
              </button>
              <input
                type="file"
                ref={fileInputRefA}
                onChange={handleFileUploadA}
                style={{ display: 'none' }}
                accept=".sql,.txt,.pkg,.pks,.pkb,.prc,.fnc,.trg"
              />
              <div className="flex items-center gap-1.5 text-xs opacity-75 truncate">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate font-mono">{fileNameA || 'Ningún archivo cargado'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Lado B (Derecho) */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-3 ${panelBg}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-green-500">Lado B (Modificado / Derecha)</span>
            <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-0.5 border dark:border-gray-800">
              <button
                onClick={() => setSourceTypeB('database')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  sourceTypeB === 'database' 
                    ? (isDark ? 'bg-gray-800 text-white shadow-sm' : 'bg-white text-gray-800 shadow-sm border border-gray-200/50')
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Base de Datos
              </button>
              <button
                onClick={() => setSourceTypeB('file')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  sourceTypeB === 'file' 
                    ? (isDark ? 'bg-gray-800 text-white shadow-sm' : 'bg-white text-gray-800 shadow-sm border border-gray-200/50')
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Archivo Local
              </button>
            </div>
          </div>

          {sourceTypeB === 'database' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">Conexión</label>
                <select
                  value={connectionIdB}
                  onChange={(e) => setConnectionIdB(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${selectBg}`}
                >
                  {connections.map(c => (
                    <option key={c.id} value={c.id} className={isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800'}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">Esquema</label>
                <select
                  value={schemaB}
                  onChange={(e) => setSchemaB(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${selectBg}`}
                >
                  {isLoadingSchemasB ? (
                    <option value="" className={isDark ? 'bg-gray-900 text-gray-250' : 'bg-white text-gray-800'}>
                      Cargando esquemas...
                    </option>
                  ) : (
                    schemasB.map(sch => (
                      <option key={sch} value={sch} className={isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800'}>
                        {sch}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">Tipo Objeto</label>
                <select
                  value={objectTypeB}
                  onChange={(e) => {
                    setObjectTypeB(e.target.value);
                    setObjectNameB('');
                  }}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${selectBg}`}
                >
                  {OBJECT_TYPES.map(t => (
                    <option key={t} value={t} className={isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800'}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              
              <SearchableSelect
                label="Objeto"
                value={objectNameB}
                onChange={setObjectNameB}
                options={objectsB[objectTypeB] || []}
                isLoading={isLoadingObjectsB}
                isDark={isDark}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <button
                onClick={() => fileInputRefB.current?.click()}
                className="py-2 px-4 rounded-xl text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-md"
              >
                <Upload className="w-3.5 h-3.5" /> Subir Archivo
              </button>
              <input
                type="file"
                ref={fileInputRefB}
                onChange={handleFileUploadB}
                style={{ display: 'none' }}
                accept=".sql,.txt,.pkg,.pks,.pkb,.prc,.fnc,.trg"
              />
              <div className="flex items-center gap-1.5 text-xs opacity-75 truncate">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate font-mono">{fileNameB || 'Ningún archivo cargado'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Button & Errors */}
      {comparisonError && (
        <div className="px-6 py-2 bg-red-500/10 text-red-500 text-xs font-semibold border-b border-red-500/20 shrink-0">
          ⚠️ Error: {comparisonError}
        </div>
      )}

      <div className="py-2.5 border-b shrink-0 flex items-center justify-center bg-gray-500/5">
        <button
          onClick={handleCompare}
          disabled={isComparing}
          className="py-2.5 px-6 rounded-2xl text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98]"
        >
          {isComparing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando Objetos...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" /> Ejecutar Comparación
            </>
          )}
        </button>
      </div>

      {/* Monaco Diff Editor Area */}
      <div className="flex-1 min-h-0 relative">
        {isComparing && (
          <div className="absolute inset-0 z-[120] flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px] gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/25 blur-md animate-ping" />
              <div className="relative p-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
            </div>
            <span className="text-xs font-semibold">Consultando y comparando fuentes de código...</span>
          </div>
        )}
        
        <DiffEditor
          height="100%"
          theme={isDark ? 'vs-dark' : 'light'}
          original={codeA}
          modified={codeB}
          language="sql"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            lineHeight: 20,
            renderSideBySide: true,
            smoothScrolling: true,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
