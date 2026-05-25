"use client";

import { useState, useEffect, useRef } from 'react';
import {
  X, Database, Search, Plus, Trash2, Folder, Play, Loader2,
  CheckCircle2, AlertCircle, FileText, Check, FolderOpen
} from 'lucide-react';
import { Connection } from '@/types';
import { useAppStore } from '@/store/useAppStore';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConnection: Connection | null | undefined;
  schema: string;
  schemas: string[];
  isDark: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface BackupObject {
  name: string;
  type: string;
}

function getObjectExtension(type: string): string {
  const t = type.toUpperCase();
  switch (t) {
    case 'TABLE': return '.tbl';
    case 'VIEW': return '.vw';
    case 'PROCEDURE': return '.prc';
    case 'FUNCTION': return '.fnc';
    case 'PACKAGE': return '.pks';
    case 'PACKAGE BODY': return '.pkb';
    case 'TRIGGER': return '.trg';
    case 'SEQUENCE': return '.seq';
    case 'SYNONYM': return '.syn';
    case 'TYPE': return '.tps';
    case 'TYPE BODY': return '.tpb';
    case 'JOB':
    case 'SCHEDULER_JOB':
    case 'SCHEDULER JOB':
      return '.job';
    default: return '.sql';
  }
}

export default function BackupModal({
  isOpen,
  onClose,
  activeConnection,
  schema,
  schemas,
  isDark,
  showToast
}: BackupModalProps) {
  const { connections } = useAppStore();
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(activeConnection || null);
  const [connectionSchemas, setConnectionSchemas] = useState<string[]>(schemas);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);

  const [mode, setMode] = useState<'objects' | 'schema'>('objects');
  const [selectedSchema, setSelectedSchema] = useState(schema);
  const [directory, setDirectory] = useState('C:\\backups');
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [objectType, setObjectType] = useState('TABLE');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [dbObjects, setDbObjects] = useState<Record<string, { name: string; status: string }[]>>({});
  const [isLoadingObjects, setIsLoadingObjects] = useState(false);
  const [selectedObjects, setSelectedObjects] = useState<BackupObject[]>([]);
  
  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState(true);

  // Permission modal states
  const [showReadPrompt, setShowReadPrompt] = useState(false);
  const [showWritePrompt, setShowWritePrompt] = useState(false);
  const [pendingDirectory, setPendingDirectory] = useState('');
  const [pendingFolderName, setPendingFolderName] = useState('');
  const [pendingHandle, setPendingHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  const isCancelledRef = useRef(false);

  // Sync selected connection with active connection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedConnection(activeConnection || null);
      setConnectionSchemas(schemas);
      setSelectedSchema(schema);
    }
  }, [isOpen, activeConnection, schemas, schema]);

  // Load schemas for the selected connection
  useEffect(() => {
    if (!selectedConnection || !isOpen) return;

    if (selectedConnection.id === activeConnection?.id) {
      setConnectionSchemas(schemas);
      setSelectedSchema(schema);
      return;
    }

    const fetchConnectionSchemas = async () => {
      setIsLoadingSchemas(true);
      try {
        const res = await fetch('/api/oracle/schemas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection: selectedConnection })
        });
        const data = await res.json();
        if (res.ok && data.schemas) {
          setConnectionSchemas(data.schemas);
          const defaultSchema = selectedConnection.user?.toUpperCase() || data.schemas[0] || '';
          setSelectedSchema(defaultSchema);
        } else {
          const fallback = selectedConnection.user?.toUpperCase() || '';
          setConnectionSchemas([fallback]);
          setSelectedSchema(fallback);
        }
      } catch (err) {
        console.error('Error fetching connection schemas', err);
        const fallback = selectedConnection.user?.toUpperCase() || '';
        setConnectionSchemas([fallback]);
        setSelectedSchema(fallback);
      } finally {
        setIsLoadingSchemas(false);
      }
    };

    fetchConnectionSchemas();
  }, [selectedConnection, isOpen]);

  const fetchObjects = async () => {
    if (!selectedConnection) return;
    setIsLoadingObjects(true);
    try {
      const res = await fetch('/api/oracle/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: selectedConnection,
          schema: selectedSchema
        })
      });
      const data = await res.json();
      if (res.ok && data.objects) {
        setDbObjects(data.objects);
      } else {
        showToast(data.error || 'Error al obtener objetos', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al obtener objetos', 'error');
    } finally {
      setIsLoadingObjects(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedConnection) {
      fetchObjects();
    }
  }, [isOpen, selectedConnection, selectedSchema]);

  if (!isOpen) return null;

  // Filter objects based on type and query
  const availableObjectsForType = dbObjects[objectType] || [];
  const filteredAvailableObjects = availableObjectsForType.filter(obj => 
    obj.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedObjects.some(sel => sel.name === obj.name && sel.type === objectType)
  );

  const handleSelectObject = (name: string) => {
    setSelectedObjects(prev => [...prev, { name, type: objectType }]);
  };

  const handleSelectAllFiltered = () => {
    const newSelections = filteredAvailableObjects.map(obj => ({
      name: obj.name,
      type: objectType
    }));
    setSelectedObjects(prev => [...prev, ...newSelections]);
  };

  const handleExcludeObject = (name: string, type: string) => {
    setSelectedObjects(prev => prev.filter(obj => !(obj.name === name && obj.type === type)));
  };

  const handleClearAllSelections = () => {
    setSelectedObjects([]);
  };

  const getFolderName = (fullPath: string) => {
    if (!fullPath) return '';
    const parts = fullPath.split(/[\\/]/);
    return parts.filter(Boolean).pop() || fullPath;
  };

  const handleSelectFolder = async () => {
    if (isPickingFolder) return;
    setIsPickingFolder(true);
    try {
      // 1. Try local API to select physical directory (Windows STA)
      const res = await fetch('/api/oracle/select-directory', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success && data.path) {
        const selectedPath = data.path;
        const folderName = getFolderName(selectedPath);
        // Apply directly – server-side access doesn't need browser permission dialog
        setDirectory(selectedPath);
        setDirectoryHandle(null);
        showToast(`Carpeta "${folderName}" seleccionada`, 'info');
        return;
      } else if (data.cancelled) {
        // User cancelled picker – do nothing
        return;
      } else if (data.error) {
        showToast(`Error al abrir el selector: ${data.error}`, 'error');
        return;
      }
    } catch (err) {
      console.warn('Backend select-directory failed, falling back to browser picker:', err);
    } finally {
      setIsPickingFolder(false);
    }

    // 2. Fallback to browser's directory picker
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker();
        setPendingDirectory(handle.name);
        setPendingFolderName(handle.name);
        setPendingHandle(handle);
        setShowReadPrompt(true);
      } else {
        showToast('Su navegador no soporta el selector de carpetas. Por favor, escriba la ruta manualmente.', 'info');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast(`Error al seleccionar carpeta: ${err.message}`, 'error');
      }
    }
  };

  const handleRunBackup = async () => {
    if (!selectedConnection) return;
    if (!directory.trim()) {
      showToast('Debe especificar un directorio de destino', 'error');
      return;
    }
    if (mode === 'objects' && selectedObjects.length === 0) {
      showToast('Seleccione al menos un objeto para el backup', 'error');
      return;
    }

    setShowWritePrompt(true);
  };

  const executeBackupConfirmed = async () => {
    if (!selectedConnection) return;
    setIsExecuting(true);
    isCancelledRef.current = false;
    setLogs(['[Iniciando Backup...]']);
    setProgress(10);
    setResultMessage(null);

    try {
      let successCount = 0;
      let targetObjects: BackupObject[] = [];

      if (mode === 'schema') {
        setLogs(prev => [...prev, '[Obteniendo lista de objetos del esquema...]']);
        // Fetch all schema objects list
        const res = await fetch('/api/oracle/objects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection: selectedConnection, schema: selectedSchema })
        });
        const data = await res.json();
        if (!res.ok || !data.objects) {
          throw new Error(data.error || 'Error al obtener objetos del esquema');
        }

        // Flatten objects
        Object.keys(data.objects).forEach(type => {
          data.objects[type].forEach((obj: any) => {
            targetObjects.push({ name: obj.name, type });
          });
        });
      } else {
        targetObjects = [...selectedObjects];
      }

      if (targetObjects.length === 0) {
        throw new Error('No se encontraron objetos para exportar.');
      }

      let combinedSource = '';
      if (mode === 'schema') {
        combinedSource = `-- Backup del esquema ${selectedSchema.toUpperCase()}\n`;
        combinedSource += `-- Generado desde la conexión: ${selectedConnection.name}\n`;
        combinedSource += `-- Fecha: ${new Date().toLocaleString()}\n\n`;
      }

      const total = targetObjects.length;
      const filesWritten: string[] = [];

      for (let i = 0; i < total; i++) {
        // Check for cancellation
        if (isCancelledRef.current) {
          throw new Error('Backup cancelado por el usuario.');
        }

        const obj = targetObjects[i];
        setLogs(prev => [...prev, `Procesando (${i + 1}/${total}): ${obj.type} ${obj.name}...`]);

        try {
          const srcRes = await fetch('/api/oracle/object-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connection: selectedConnection, name: obj.name, type: obj.type, schema: selectedSchema })
          });
          const srcData = await srcRes.json();
          
          if (srcRes.ok && srcData.source !== undefined) {
            const sourceCode = srcData.source;

            if (mode === 'schema') {
              combinedSource += `-- Start of ${obj.type} ${obj.name}\n`;
              combinedSource += sourceCode;
              if (!sourceCode.trim().endsWith('/')) {
                combinedSource += '\n/\n';
              } else {
                combinedSource += '\n';
              }
              combinedSource += '\n';
              successCount++;
            } else {
              // Individual objects
              const filename = `${obj.name.toLowerCase()}${getObjectExtension(obj.type)}`;
              
              if (directoryHandle) {
                // Client-side writing using browser handle
                const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(sourceCode);
                await writable.close();
              } else {
                // Server-side writing using write_file endpoint
                const writeRes = await fetch('/api/oracle/backup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    connection: selectedConnection,
                    schema: selectedSchema,
                    mode: 'write_file',
                    directory,
                    filename,
                    content: sourceCode
                  })
                });
                const writeData = await writeRes.json();
                if (!writeRes.ok) {
                  throw new Error(writeData.error || 'Error al guardar archivo en servidor');
                }
              }

              successCount++;
              filesWritten.push(filename);
              setLogs(prev => [...prev, `✓ Guardado: ${filename}`]);
            }
          } else {
            setLogs(prev => [...prev, `✗ ERROR al obtener código fuente para ${obj.type} ${obj.name}`]);
          }
        } catch (err: any) {
          setLogs(prev => [...prev, `✗ ERROR en ${obj.type} ${obj.name}: ${err.message}`]);
        }

        setProgress(Math.floor(10 + (i / total) * 80));
      }

      // Check for cancellation before writing the consolidated schema file
      if (isCancelledRef.current) {
        throw new Error('Backup cancelado por el usuario.');
      }

      // If schema mode, write the combined file now
      if (mode === 'schema') {
        const safeConn = selectedConnection.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const safeSchema = selectedSchema.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const now = new Date();
        const dateStr = now.getFullYear() +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getDate()).padStart(2, '0') +
          String(now.getHours()).padStart(2, '0') +
          String(now.getMinutes()).padStart(2, '0') +
          String(now.getSeconds()).padStart(2, '0');
        
        const filename = `${safeConn}_${safeSchema}_export_${dateStr}.sql`.toLowerCase();

        if (directoryHandle) {
          const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(combinedSource);
          await writable.close();
        } else {
          const writeRes = await fetch('/api/oracle/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection: selectedConnection,
              schema: selectedSchema,
              mode: 'write_file',
              directory,
              filename,
              content: combinedSource
            })
          });
          const writeData = await writeRes.json();
          if (!writeRes.ok) {
            throw new Error(writeData.error || 'Error al guardar archivo en servidor');
          }
        }

        setProgress(100);
        setLogs(prev => [...prev, `[Listo! Backup completado con éxito.]`]);
        setResultMessage(`Esquema exportado en un solo archivo: ${filename}`);
        setResultSuccess(true);
        showToast(`Backup completado exitosamente: ${filename}`, 'success');
      } else {
        setProgress(100);
        setLogs(prev => [...prev, `[Listo! Backup completado con éxito.]`]);
        setResultMessage(`Backup de objetos finalizado. ${successCount} de ${targetObjects.length} archivos guardados.`);
        setResultSuccess(true);
        showToast('Copia de seguridad completada con éxito', 'success');
      }

    } catch (err: any) {
      setProgress(0);
      setLogs(prev => [...prev, `[ERROR/CANCELADO]: ${err.message}`]);
      setResultMessage(err.message);
      setResultSuccess(false);
      showToast(err.message, err.message.includes('cancelado') ? 'info' : 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const objectTypes = [
    'TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER', 'SEQUENCE', 'SYNONYM', 'TYPE', 'TYPE BODY', 'JOB'
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-6xl rounded-3xl border shadow-2xl flex flex-col overflow-hidden max-h-[90vh] transition-all duration-300 ${
        isDark ? 'bg-gray-900/90 border-gray-800 text-gray-200' : 'bg-white/95 border-gray-200 text-gray-800'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-gray-800/80 bg-gray-950/40' : 'border-gray-150 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-lg">Copia de Seguridad (Backup)</h2>
          </div>
          <button 
            onClick={onClose} 
            className={`p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* General Configs */}
          <div className={`grid grid-cols-1 md:grid-cols-5 gap-4 p-4 rounded-2xl border ${
            isDark ? 'bg-gray-950/30 border-gray-800/85' : 'bg-gray-50/50 border-gray-200'
          }`}>
            {/* Connection Selector */}
            <div className="flex flex-col gap-1.5 col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-blue-500" /> Conexión
              </label>
              <select
                value={selectedConnection?.id || ''}
                onChange={(e) => {
                  const conn = connections.find(c => c.id === e.target.value);
                  setSelectedConnection(conn || null);
                  setSelectedObjects([]); // Clear objects to prevent cross-db confusion
                }}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-all ${
                  isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-gray-300 text-gray-800'
                }`}
              >
                {connections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Mode selection */}
            <div className="flex flex-col gap-1.5 col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Modo de Copia</label>
              <div className={`flex rounded-xl p-1 gap-1 ${
                isDark ? 'bg-gray-900' : 'bg-gray-200/60'
              }`}>
                <button
                  type="button"
                  onClick={() => setMode('objects')}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'objects'
                      ? (isDark ? 'bg-gray-800 text-blue-400' : 'bg-white text-blue-600 shadow-sm')
                      : 'opacity-65 hover:opacity-100'
                  }`}
                >
                  Objetos
                </button>
                <button
                  type="button"
                  onClick={() => setMode('schema')}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'schema'
                      ? (isDark ? 'bg-gray-800 text-blue-400' : 'bg-white text-blue-600 shadow-sm')
                      : 'opacity-65 hover:opacity-100'
                  }`}
                >
                  Esquema
                </button>
              </div>
            </div>

            {/* Schema Selector */}
            <div className="flex flex-col gap-1.5 col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1">
                {isLoadingSchemas && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                Esquema
              </label>
              <select
                value={selectedSchema}
                onChange={(e) => setSelectedSchema(e.target.value)}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-all ${
                  isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-gray-300 text-gray-800'
                }`}
                disabled={isLoadingSchemas}
              >
                {connectionSchemas.map(sch => (
                  <option key={sch} value={sch}>{sch}</option>
                ))}
              </select>
            </div>

            {/* Target directory selection */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-blue-500" /> Carpeta Destino
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej. C:\backups"
                  value={directory}
                  onChange={(e) => {
                    setDirectory(e.target.value);
                    setDirectoryHandle(null); // Clear handle if typed manually
                  }}
                  className={`flex-1 px-3 py-1.5 rounded-xl border text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                    isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-gray-300 text-gray-800'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={isPickingFolder}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center justify-center gap-1.5 ${
                    isDark 
                      ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-blue-400 disabled:opacity-60' 
                      : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-blue-600 disabled:opacity-60'
                  }`}
                  title={isPickingFolder ? 'Abriendo selector...' : 'Seleccionar carpeta de destino'}
                >
                  {isPickingFolder
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <FolderOpen className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Conditional Layouts based on Mode */}
          {mode === 'objects' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-96">
              {/* Left Panel: Available Objects Selector */}
              <div className={`rounded-2xl border flex flex-col overflow-hidden ${
                isDark ? 'border-gray-800 bg-gray-950/20' : 'border-gray-200 bg-gray-50/20'
              }`}>
                {/* Available controls */}
                <div className={`p-3 border-b flex flex-col gap-2 ${
                  isDark ? 'border-gray-800 bg-gray-900/30' : 'border-gray-150 bg-gray-50'
                }`}>
                  <div className="flex gap-2">
                    <select
                      value={objectType}
                      onChange={(e) => setObjectType(e.target.value)}
                      style={{ colorScheme: isDark ? 'dark' : 'light' }}
                      className={`flex-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                        isDark ? 'bg-gray-950 border-gray-800 text-gray-200' : 'bg-white border-gray-250 text-gray-850'
                      }`}
                    >
                      {objectTypes.map(t => (
                        <option key={t} value={t}>
                          {t === 'JOB' ? 'SCHEDULER_JOB' : `${t}s`}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      disabled={filteredAvailableObjects.length === 0}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                    >
                      Todos
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por nombre..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-none focus:ring-1 focus:ring-blue-500 ${
                        isDark ? 'bg-gray-950 border-gray-800 text-gray-200' : 'bg-white border-gray-250 text-gray-850'
                      }`}
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                  </div>
                </div>

                {/* Available list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {isLoadingObjects ? (
                    <div className="flex items-center justify-center h-full gap-2 text-xs opacity-60">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Cargando objetos...
                    </div>
                  ) : filteredAvailableObjects.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs opacity-50 font-medium">
                      No hay objetos disponibles
                    </div>
                  ) : (
                    filteredAvailableObjects.map(obj => (
                      <div 
                        key={obj.name}
                        onClick={() => handleSelectObject(obj.name)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-mono cursor-pointer transition-colors group ${
                          isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-150/70'
                        }`}
                      >
                        <span className="truncate flex-1 pr-2">{obj.name}</span>
                        <Plus className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Panel: Selected Objects */}
              <div className={`rounded-2xl border flex flex-col overflow-hidden ${
                isDark ? 'border-gray-800 bg-gray-950/20' : 'border-gray-200 bg-gray-50/20'
              }`}>
                {/* Header controls */}
                <div className={`p-3 border-b flex items-center justify-between ${
                  isDark ? 'border-gray-800 bg-gray-900/30' : 'border-gray-150 bg-gray-50'
                }`}>
                  <span className="text-xs font-bold text-blue-500">
                    Escogidos ({selectedObjects.length})
                  </span>
                  {selectedObjects.length > 0 && (
                    <button
                      onClick={handleClearAllSelections}
                      className="text-[10px] text-red-500 font-bold hover:underline"
                    >
                      Limpiar todo
                    </button>
                  )}
                </div>

                {/* Selected list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {selectedObjects.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs opacity-50 font-medium text-center px-4">
                      Haga clic en los objetos del panel izquierdo para agregarlos al backup
                    </div>
                  ) : (
                    selectedObjects.map(obj => (
                      <div 
                        key={`${obj.name}-${obj.type}`}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-mono ${
                          isDark ? 'bg-gray-800/35 hover:bg-gray-800/65' : 'bg-gray-150/40 hover:bg-gray-150/70'
                        }`}
                      >
                        <div className="truncate flex-1 flex items-center gap-1.5 pr-2">
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase shrink-0 bg-blue-500/10 text-blue-500">
                            {obj.type === 'JOB' ? 'SCHEDULER_JOB' : obj.type.replace('BODY', 'BDY')}
                          </span>
                          <span className="truncate">{obj.name}</span>
                        </div>
                        <button 
                          onClick={() => handleExcludeObject(obj.name, obj.type)}
                          className="text-red-500 p-0.5 rounded-md hover:bg-red-500/15"
                          title="Excluir objeto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Full Schema view info
            <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center text-center gap-3 ${
              isDark ? 'bg-gray-950/20 border-gray-800' : 'bg-gray-50/50 border-gray-200'
            }`}>
              <div className={`p-4 rounded-full ${
                isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-55 text-blue-600'
              }`}>
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Respaldo Completo de Esquema</h3>
                <p className="text-xs opacity-60 max-w-md mt-1 leading-relaxed">
                  Este modo exportará la definición de TODOS los objetos del esquema seleccionado y los guardará compilados en un único archivo consolidado.
                </p>
              </div>
              <div className={`px-4 py-2 rounded-xl text-xs font-mono border mt-2 ${
                isDark ? 'bg-gray-950 border-gray-800/80' : 'bg-gray-100 border-gray-200'
              }`}>
                Nombre de archivo generado:<br />
                <span className="text-blue-500 font-bold">
                  {((activeConnection?.name || 'conexion') + '_' + (selectedSchema || 'schema') + '_export_fecha.sql').toLowerCase().replace(/[^a-z0-9_.]/g, '_')}
                </span>
              </div>
            </div>
          )}

          {/* Logs & Progress panel */}
          {(logs.length > 0 || isExecuting || resultMessage) && (
            <div className={`rounded-2xl border p-4 space-y-3 ${
              isDark ? 'border-gray-800 bg-black/40' : 'border-gray-200 bg-gray-50'
            }`}>
              {/* Progress bar */}
              {isExecuting && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold opacity-60 uppercase">
                    <span>Exportando...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-300 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Status Banner */}
              {resultMessage && (
                <div className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
                  resultSuccess 
                    ? (isDark ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-700 border border-green-200')
                    : (isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-700 border border-red-200')
                }`}>
                  {resultSuccess ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span className="font-semibold">{resultMessage}</span>
                </div>
              )}

              {/* Code console logs */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase opacity-60 tracking-wider">Consola de Eventos</label>
                <div className={`h-32 rounded-xl p-3 font-mono text-[11px] overflow-y-auto space-y-1 border select-text custom-scrollbar ${
                  isDark 
                    ? 'bg-black/85 border-gray-900 text-gray-300' 
                    : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}>
                  {logs.map((log, index) => (
                    <div key={index} className="truncate">{log}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${
          isDark ? 'border-gray-800/80 bg-gray-950/40' : 'border-gray-150 bg-gray-50'
        }`}>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
              isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Cerrar
          </button>
          
          {isExecuting ? (
            <button
              type="button"
              onClick={() => {
                isCancelledRef.current = true;
                setLogs(prev => [...prev, '[CANCELANDO COPÍA DE SEGURIDAD...]']);
              }}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-all flex items-center gap-1.5 shadow-lg shadow-red-600/15"
            >
              Cancelar Backup
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunBackup}
              disabled={!selectedConnection || (mode === 'objects' && selectedObjects.length === 0)}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/15"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Iniciar Backup
            </button>
          )}
        </div>
      </div>

      {/* Simulated Permission Dialog A (Read) */}
      {showReadPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all duration-300 ${
            isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <h3 className="text-base font-bold leading-6">
              Allow this site to view and copy files?
            </h3>
            <p className="text-xs opacity-85 mt-2 leading-relaxed">
              <span className="font-semibold">http://localhost:3000</span> will be able to view and make its own copies of files in <span className="font-semibold text-blue-500">{pendingFolderName}</span>
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowReadPrompt(false);
                  setPendingDirectory('');
                  setPendingFolderName('');
                  setPendingHandle(null);
                }}
                className="px-5 py-2 rounded-full text-xs font-semibold border border-[#005f60] bg-[#e0f7f8] hover:bg-[#d0f2f4] text-[#005f60] transition-colors"
              >
                Don't allow
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirectory(pendingDirectory);
                  setDirectoryHandle(pendingHandle);
                  setShowReadPrompt(false);
                  setPendingDirectory('');
                  setPendingFolderName('');
                  setPendingHandle(null);
                  showToast(`Carpeta "${pendingFolderName}" seleccionada`, 'info');
                }}
                className="px-6 py-2 rounded-full text-xs font-semibold bg-[#005f60] hover:bg-[#004f50] text-white transition-colors"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Permission Dialog B (Write) */}
      {showWritePrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all duration-300 ${
            isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <h3 className="text-base font-bold leading-6">
              Save changes to {getFolderName(directory)}?
            </h3>
            <p className="text-xs opacity-85 mt-2 leading-relaxed">
              <span className="font-semibold">http://localhost:3000</span> will be able to edit files in <span className="font-semibold text-blue-500">{getFolderName(directory)}</span>
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowWritePrompt(false);
                }}
                className="px-5 py-2 rounded-full text-xs font-semibold border border-[#005f60] bg-[#e0f7f8] hover:bg-[#d0f2f4] text-[#005f60] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWritePrompt(false);
                  executeBackupConfirmed();
                }}
                className="px-6 py-2 rounded-full text-xs font-semibold bg-[#005f60] hover:bg-[#004f50] text-white transition-colors"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
