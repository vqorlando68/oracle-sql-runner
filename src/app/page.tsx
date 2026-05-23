"use client";

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Sidebar from '@/components/Sidebar';
import ParamModal from '@/components/ParamModal';
import ResultsTable from '@/components/ResultsTable';
import FavoriteNameModal from '@/components/FavoriteNameModal';
import HistorySettingsModal from '@/components/HistorySettingsModal';
import Editor from '@monaco-editor/react';
import { extractSqlParams } from '@/lib/sql-parser';
import { getStatementAtCursor, splitStatements } from '@/lib/sql-utils';
import FormatterConfigModal from '@/components/FormatterConfigModal';
import { format } from 'sql-formatter';
import { saveAs } from 'file-saver';
import {
  Play, PlayCircle, Loader2, AlertTriangle, Clock, Database, Eraser, CheckCircle,
  Plus, X, MessageSquare, Trash2, Wand2, Settings2, BookmarkCheck, BookmarkPlus,
  Scissors, Clipboard, ClipboardPaste, CheckCircle2, Undo2, CalendarClock, FilePlus,
  Undo, Redo, Hammer, Save, FolderOpen, Network
} from 'lucide-react';
import { ExecResult } from '@/types';
import DiagramEditor from '@/components/DiagramEditor';

// ── Toolbar Icon Button ──────────────────────────────────────────────────────
function TbBtn({
  icon, label, onClick, disabled, active, variant, shortcut, isDark
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
  shortcut?: string;
  isDark: boolean;
}) {
  const v = variant || 'default';
  const base = 'relative p-2 rounded-lg flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed group';

  const colors: Record<string, string> = {
    default: isDark
      ? 'hover:bg-gray-700/70 text-gray-300 hover:text-gray-100'
      : 'hover:bg-gray-200/80 text-gray-600 hover:text-gray-900',
    primary: isDark
      ? 'hover:bg-blue-500/20 text-blue-400 hover:text-blue-300'
      : 'hover:bg-blue-100 text-blue-600 hover:text-blue-700',
    success: isDark
      ? 'hover:bg-green-500/20 text-green-400 hover:text-green-300'
      : 'hover:bg-green-100 text-green-600 hover:text-green-700',
    danger: isDark
      ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300'
      : 'hover:bg-red-100 text-red-600 hover:text-red-700',
    warning: isDark
      ? 'hover:bg-yellow-500/20 text-yellow-400 hover:text-yellow-300'
      : 'hover:bg-yellow-100 text-yellow-600 hover:text-yellow-700',
  };

  const activeStyle = active
    ? (isDark ? 'bg-blue-500/15 ring-1 ring-blue-500/40' : 'bg-blue-100 ring-1 ring-blue-400/40')
    : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${colors[v]} ${activeStyle}`}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {icon}
      {/* Tooltip */}
      <span className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 ${
        isDark ? 'bg-gray-700 text-gray-200 shadow-lg' : 'bg-gray-800 text-white shadow-lg'
      }`}>
        {label}{shortcut ? ` · ${shortcut}` : ''}
      </span>
    </button>
  );
}

function extractObjectNameAndType(sql: string): { name: string; type: string } | null {
  const cleanSql = sql.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)--.*$/gm, ''); // remove comments
  
  // 1. Try matching CREATE statement with optional modifiers
  const createRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:EDITIONABLE|NONEDITIONABLE|FORCE|NO\s+FORCE)\s+)*(PROCEDURE|FUNCTION|PACKAGE(?:\s+BODY)?|TRIGGER|TYPE(?:\s+BODY)?|VIEW)\s+("?[a-zA-Z0-9_]+"?(?:\."?[a-zA-Z0-9_]+"?)?)/i;
  let match = cleanSql.match(createRegex);
  
  // 2. Try matching ALTER ... COMPILE statement
  if (!match) {
    const alterRegex = /ALTER\s+(PROCEDURE|FUNCTION|PACKAGE|TRIGGER|TYPE|VIEW)\s+("?[a-zA-Z0-9_]+"?(?:\."?[a-zA-Z0-9_]+"?)?)\s+COMPILE(?:\s+BODY)?/i;
    match = cleanSql.match(alterRegex);
  }
  
  if (!match) return null;
  
  let type = match[1].toUpperCase();
  const rawName = match[2].split('.').pop() || '';
  
  // Normalize ALTER PACKAGE ... COMPILE BODY to PACKAGE BODY
  if (type === 'PACKAGE' && cleanSql.toUpperCase().includes('COMPILE BODY')) {
    type = 'PACKAGE BODY';
  }
  
  // If starts and ends with double quotes, preserve case and strip quotes
  let name = rawName;
  if (rawName.startsWith('"') && rawName.endsWith('"')) {
    name = rawName.slice(1, -1);
  } else {
    name = rawName.toUpperCase();
  }
  
  return { type, name };
}

function TbSep({ isDark }: { isDark: boolean }) {
  return <div className={`w-px h-6 mx-0.5 ${isDark ? 'bg-gray-700/60' : 'bg-gray-300/80'}`} />;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const {
    isAuthenticated, login,
    isDark, activeConnectionId, connections, addHistory,
    tabs, activeTabId, setActiveTab, addTab, removeTab, updateTabContent, formatOptions,
    favorites, favoriteSections, addFavoriteFromSql, updateFavoriteSql, addFavoriteSection,
    toast, hideToast, showToast,
    history, historyRetentionDays, setHistoryRetentionDays, purgeExpiredHistory
  } = useAppStore();
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionElapsedTime, setExecutionElapsedTime] = useState(0);
  const [executionType, setExecutionType] = useState<'statement' | 'script' | 'compile' | null>(null);
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number } | null>(null);
  const [executionCurrentSql, setExecutionCurrentSql] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<any>(null);

  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compileErrors, setCompileErrors] = useState<{ line: number; position: number; text: string }[]>([]);
  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [detectedParams, setDetectedParams] = useState<string[]>([]);
  const [enableDbmsOutput, setEnableDbmsOutput] = useState(false);
  const [bottomTab, setBottomTab] = useState<'results' | 'dbms' | 'errors'>('results');
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  const [historySettingsOpen, setHistorySettingsOpen] = useState(false);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  // Save modal: 'overwrite' = confirm overwrite existing fav | 'new' = create new fav
  const [saveModal, setSaveModal] = useState<'overwrite' | 'new' | null>(null);

  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [shake, setShake] = useState(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const executeStatementRef = useRef<() => void>(() => {});
  const executeScriptRef = useRef<() => void>(() => {});

  const startExecution = (type: 'statement' | 'script' | 'compile', sql: string | null = null) => {
    setIsExecuting(true);
    setExecutionType(type);
    setExecutionElapsedTime(0);
    setExecutionCurrentSql(sql);
    setExecutionProgress(null);
    setError(null);
    setResult(null);
    setCompileErrors([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setExecutionElapsedTime(Date.now() - startTime);
    }, 100);

    return controller;
  };

  const endExecution = () => {
    setIsExecuting(false);
    setExecutionType(null);
    setExecutionCurrentSql(null);
    setExecutionProgress(null);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    abortControllerRef.current = null;
  };

  const handleCancelExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    endExecution();
    setError("Ejecución cancelada por el usuario.");
    setBottomTab('results');
    useAppStore.getState().showToast("Ejecución cancelada", "info");
  };

  const handleSaveToFile = () => {
    if (!activeTab || !activeTab.query.trim()) {
      useAppStore.getState().showToast('El editor está vacío', 'error');
      return;
    }
    const blob = new Blob([activeTab.query], { type: 'text/plain;charset=utf-8' });
    const filename = `${activeTab.title || 'query'}.sql`;
    saveAs(blob, filename);
    useAppStore.getState().showToast('Archivo SQL guardado', 'success');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleOpenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (activeTab) {
        updateTabContent(activeTab.id, content);
        useAppStore.getState().showToast(`Archivo "${file.name}" cargado`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const activeConnection = connections.find(c => c.id === activeConnectionId);
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  // Favorite linked to the current tab (if any)
  const activeFavorite = activeTab?.favoriteId
    ? favorites.find(f => f.id === activeTab.favoriteId)
    : null;

  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const success = login(passwordInput);
    if (success) {
      setLoginError(false);
    } else {
      setLoginError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  if (!isAuthenticated) {
    const loginBg = isDark 
      ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-black text-gray-100' 
      : 'bg-gradient-to-br from-blue-50 via-gray-50 to-gray-100 text-gray-800';

    return (
      <main className={`flex h-screen w-full items-center justify-center overflow-hidden p-4 relative ${loginBg} font-sans transition-colors duration-300`}>
        {/* Decoración ambiental: Esferas de luz difuminadas */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] pointer-events-none animate-pulse duration-[8s]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-yellow-500/5 dark:bg-yellow-500/5 blur-[140px] pointer-events-none animate-pulse duration-[10s]" />
        
        {/* Estilo para animación de agitación (shake) */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
            20%, 40%, 60%, 80% { transform: translateX(6px); }
          }
          .animate-shake {
            animation: shake 0.4s ease-in-out;
          }
        `}</style>

        <div className="w-full max-w-md relative z-10">
          <form 
            onSubmit={handleLoginSubmit}
            className={`backdrop-blur-xl border flex flex-col items-center rounded-3xl p-8 shadow-2xl transition-all duration-300 transform scale-100 ${
              shake ? 'animate-shake border-red-500 shadow-red-500/10' : ''
            } ${
              isDark 
                ? 'bg-gray-900/60 border-gray-800/80 text-gray-200 shadow-black/60' 
                : 'bg-white/75 border-gray-200/80 text-gray-800 shadow-gray-300/40'
            }`}
          >
            {/* Logotipo / Icono */}
            <div className={`p-4 rounded-2xl mb-6 shadow-inner ${
              isDark ? 'bg-gray-950/40 text-blue-400' : 'bg-gray-100/80 text-blue-600'
            }`}>
              <Database className="w-8 h-8 animate-pulse text-blue-500 dark:text-blue-400" />
            </div>

            {/* Cabecera */}
            <h1 className="text-2xl font-bold text-center tracking-tight">Oracle SQL Runner AI</h1>
            <p className="text-xs opacity-60 mt-1 mb-8 text-center font-medium uppercase tracking-wider">Acceso Protegido</p>

            {/* Input de Clave */}
            <div className="w-full space-y-2 mb-6">
              <label className="text-xs font-semibold opacity-70 ml-1">Contraseña de acceso</label>
              <input
                type="password"
                autoFocus
                placeholder="Ingresa la clave..."
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (loginError) setLoginError(false);
                }}
                className={`w-full py-3 px-4 rounded-2xl border text-sm font-medium transition-all outline-none text-center tracking-widest ${
                  loginError 
                    ? 'border-red-500 bg-red-500/5 focus:ring-2 focus:ring-red-500/20' 
                    : isDark 
                      ? 'border-gray-800 bg-gray-950/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                      : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {loginError && (
                <p className="text-[11px] text-red-500 text-center font-semibold mt-1">Clave incorrecta. Inténtalo de nuevo.</p>
              )}
            </div>

            {/* Botón de Ingreso */}
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2"
            >
              Ingresar al Programa
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Editor handlers ─────────────────────────────────────────────────────────

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ctrl+Enter → Execute (legacy)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeStatementRef.current();
    });

    // F9 → Execute current statement / selection
    editor.addCommand(monaco.KeyCode.F9, () => {
      executeStatementRef.current();
    });

    // F5 → Execute entire script
    editor.addCommand(monaco.KeyCode.F5, () => {
      executeScriptRef.current();
    });
  };

  const handleFormat = () => {
    try {
      const formatted = format(activeTab.query, formatOptions as any);
      updateTabContent(activeTab.id, formatted);
    } catch (e) {
      console.error('Format error', e);
    }
  };

  const handleSave = () => {
    if (activeFavorite) {
      setSaveModal('overwrite');
    } else {
      setSaveModal('new');
    }
  };

  const handleOverwriteConfirm = () => {
    if (activeFavorite) {
      updateFavoriteSql(activeFavorite.id, activeTab.query);
      setSaveModal(null);
      useAppStore.getState().showToast(`"${activeFavorite.name}" actualizado`, 'success');
    }
  };

  const handleNewFavoriteConfirm = (name: string, sectionId: string) => {
    addFavoriteFromSql(activeTab.query, name, sectionId);
    setSaveModal(null);
    useAppStore.getState().showToast(`"${name}" guardado en favoritos`, 'success');
  };

  // ── F9: Execute single statement (selection or statement at cursor) ────────
  const handleExecuteStatement = () => {
    if (!activeConnection) {
      setError("Selecciona una conexión activa desde el panel lateral.");
      setBottomTab('results');
      return;
    }
    
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    const selectedText = editor.getModel().getValueInRange(selection);
    
    let queryToRun: string;
    if (selectedText && selectedText.trim()) {
      queryToRun = selectedText.trim();
    } else {
      // Get statement at cursor position
      const cursorLine = editor.getPosition()?.lineNumber || 1;
      const fullText = editor.getModel().getValue();
      queryToRun = getStatementAtCursor(fullText, cursorLine);
    }

    if (!queryToRun.trim()) return;

    // Detect params
    const params = extractSqlParams(queryToRun);
    if (params.length > 0) {
      setDetectedParams(params);
      setParamsModalOpen(true);
    } else {
      executeSql(queryToRun, {});
    }
  };

  // ── F5: Execute entire script ──────────────────────────────────────────────
  const handleExecuteScript = async () => {
    if (!activeConnection) {
      setError("Selecciona una conexión activa desde el panel lateral.");
      setBottomTab('results');
      return;
    }

    const editor = editorRef.current;
    const fullText = editor ? editor.getModel().getValue() : activeTab.query;
    if (!fullText.trim()) return;

    const statements = splitStatements(fullText);
    if (statements.length === 0) return;

    const controller = startExecution('script');
    let lastResult: ExecResult | null = null;
    let totalAffected = 0;
    let totalDuration = 0;
    let hasError = false;

    for (let i = 0; i < statements.length; i++) {
      if (controller.signal.aborted) {
        hasError = true;
        break;
      }
      const stmt = statements[i];
      setExecutionProgress({ current: i + 1, total: statements.length });
      setExecutionCurrentSql(stmt);

      try {
        const res = await fetch('/api/oracle/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: activeConnection,
            sql: stmt,
            binds: {},
            enableDbmsOutput
          }),
          signal: controller.signal
        });

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Execution failed');
        }

        totalDuration += data.duration || 0;
        totalAffected += data.rowsAffected || 0;

        // Keep the last result with rows (SELECT) for display
        if (data.rows && data.rows.length > 0) {
          lastResult = data;
        } else if (!lastResult) {
          lastResult = data;
        }

        addHistory({
          id: crypto.randomUUID(),
          sql: stmt,
          timestamp: new Date().toISOString(),
          connectionId: activeConnection!.id,
          duration: data.duration,
          status: 'success',
          rowCount: data.rowCount
        });

        // Check if this was a compile statement and fetch errors if any
        const objInfo = extractObjectNameAndType(stmt);
        if (objInfo && !controller.signal.aborted) {
          const errorCheckSql = `
            SELECT line, position, text 
            FROM user_errors 
            WHERE name = :name AND type = :type 
            ORDER BY sequence
          `;
          const errRes = await fetch('/api/oracle/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection: activeConnection,
              sql: errorCheckSql,
              binds: { name: objInfo.name, type: objInfo.type }
            }),
            signal: controller.signal
          });
          const errData = await errRes.json();
          if (errRes.ok && errData.rows && errData.rows.length > 0) {
            const formattedErrors = errData.rows.map((row: any) => {
              const line = row.LINE || row.line || 0;
              const pos = row.POSITION || row.position || 0;
              const text = row.TEXT || row.text || '';
              return `Línea ${line}, Columna ${pos}: ${text}`;
            }).join('\n');

            const errors = errData.rows.map((row: any) => ({
              line: row.LINE || row.line || 0,
              position: row.POSITION || row.position || 0,
              text: row.TEXT || row.text || ''
            }));

            setCompileErrors(errors);
            setError(`Compilado con errores en ${objInfo.type} ${objInfo.name}`);
            setBottomTab('errors');
            hasError = true;
            break;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          hasError = true;
          break;
        }
        setError(`Error en statement:\n${stmt.substring(0, 200)}...\n\n${err.message}`);
        setBottomTab('results');
        addHistory({
          id: crypto.randomUUID(),
          sql: stmt,
          timestamp: new Date().toISOString(),
          connectionId: activeConnection!.id,
          duration: 0,
          status: 'error',
          error: err.message
        });
        hasError = true;
        break;
      }
    }

    if (!hasError && lastResult) {
      setResult({
        ...lastResult,
        duration: totalDuration,
        rowCount: lastResult.rows?.length || totalAffected
      });
      if (enableDbmsOutput && lastResult.dbmsOutput && lastResult.dbmsOutput.length > 0) {
        setBottomTab('dbms');
      } else {
        setBottomTab('results');
      }
    }

    const wasAborted = controller.signal.aborted;
    endExecution();

    if (!hasError && !wasAborted) {
      useAppStore.getState().showToast(
        `Script ejecutado: ${statements.length} statement${statements.length > 1 ? 's' : ''} · ${totalDuration}ms`,
        'success'
      );
    }
  };

  // ── Compilar PL/SQL ────────────────────────────────────────────────────────
  const handleCompile = async () => {
    if (!activeConnection) {
      setError("Selecciona una conexión activa desde el panel lateral.");
      setBottomTab('results');
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    const selectedText = editor.getModel().getValueInRange(selection);
    
    let queryToRun: string;
    if (selectedText && selectedText.trim()) {
      queryToRun = selectedText.trim();
    } else {
      const cursorLine = editor.getPosition()?.lineNumber || 1;
      const fullText = editor.getModel().getValue();
      queryToRun = getStatementAtCursor(fullText, cursorLine);
    }

    if (!queryToRun.trim()) return;

    const controller = startExecution('compile', queryToRun);

    try {
      // 1. Run the compilation/execution query
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          sql: queryToRun,
          binds: {},
          enableDbmsOutput
        }),
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Compilation failed');
      }

      setResult(data);
      if (enableDbmsOutput && data.dbmsOutput && data.dbmsOutput.length > 0) {
        setBottomTab('dbms');
      } else {
        setBottomTab('results');
      }

      addHistory({
        id: crypto.randomUUID(),
        sql: queryToRun,
        timestamp: new Date().toISOString(),
        connectionId: activeConnection!.id,
        duration: data.duration,
        status: 'success',
        rowCount: data.rowCount
      });

      // 2. Check for PL/SQL object creation
      const objInfo = extractObjectNameAndType(queryToRun);
      
      if (objInfo) {
        // Check if there are compilation errors in user_errors
        const errorCheckSql = `
          SELECT line, position, text 
          FROM user_errors 
          WHERE name = :name AND type = :type 
          ORDER BY sequence
        `;

        if (controller.signal.aborted) return;

        const errRes = await fetch('/api/oracle/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: activeConnection,
            sql: errorCheckSql,
            binds: { name: objInfo.name, type: objInfo.type }
          }),
          signal: controller.signal
        });

        const errData = await errRes.json();
        if (errRes.ok && errData.rows && errData.rows.length > 0) {
          const formattedErrors = errData.rows.map((row: any) => {
            const line = row.LINE || row.line || 0;
            const pos = row.POSITION || row.position || 0;
            const text = row.TEXT || row.text || '';
            return `Línea ${line}, Columna ${pos}: ${text}`;
          }).join('\n');

          const errors = errData.rows.map((row: any) => ({
            line: row.LINE || row.line || 0,
            position: row.POSITION || row.position || 0,
            text: row.TEXT || row.text || ''
          }));

          setCompileErrors(errors);
          setError(`Compilado con errores en ${objInfo.type} ${objInfo.name}`);
          setBottomTab('errors');
          useAppStore.getState().showToast(`Compilado con errores en ${objInfo.name}`, 'error');
          return;
        }
      }

      // No compilation errors
      useAppStore.getState().showToast('Compilado exitosamente ✓', 'success');

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      setBottomTab('results');
      addHistory({
        id: crypto.randomUUID(),
        sql: queryToRun,
        timestamp: new Date().toISOString(),
        connectionId: activeConnection!.id,
        duration: 0,
        status: 'error',
        error: err.message
      });
    } finally {
      endExecution();
    }
  };

  // Sync ref values on render (when authenticated)
  executeStatementRef.current = handleExecuteStatement;
  executeScriptRef.current = handleExecuteScript;

  // ── Execute single SQL ─────────────────────────────────────────────────────
  const executeSql = async (query: string, binds: Record<string, any>, bindTypes?: Record<string, string>) => {
    const controller = startExecution('statement', query);

    try {
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          sql: query,
          binds,
          bindTypes,
          enableDbmsOutput
        }),
        signal: controller.signal
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Execution failed');
      }

      setResult(data);
      if (enableDbmsOutput && data.dbmsOutput && data.dbmsOutput.length > 0) {
        setBottomTab('dbms');
      } else {
        setBottomTab('results');
      }

      addHistory({
        id: crypto.randomUUID(),
        sql: query,
        timestamp: new Date().toISOString(),
        connectionId: activeConnection!.id,
        duration: data.duration,
        status: 'success',
        rowCount: data.rowCount
      });

      // Check if this was a compile statement and fetch errors if any
      const objInfo = extractObjectNameAndType(query);
      if (objInfo && !controller.signal.aborted) {
        const errorCheckSql = `
          SELECT line, position, text 
          FROM user_errors 
          WHERE name = :name AND type = :type 
          ORDER BY sequence
        `;
        const errRes = await fetch('/api/oracle/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: activeConnection,
            sql: errorCheckSql,
            binds: { name: objInfo.name, type: objInfo.type }
          }),
          signal: controller.signal
        });
        const errData = await errRes.json();
        if (errRes.ok && errData.rows && errData.rows.length > 0) {
          const formattedErrors = errData.rows.map((row: any) => {
            const line = row.LINE || row.line || 0;
            const pos = row.POSITION || row.position || 0;
            const text = row.TEXT || row.text || '';
            return `Línea ${line}, Columna ${pos}: ${text}`;
          }).join('\n');

          const errors = errData.rows.map((row: any) => ({
            line: row.LINE || row.line || 0,
            position: row.POSITION || row.position || 0,
            text: row.TEXT || row.text || ''
          }));

          setCompileErrors(errors);
          setError(`Compilado con errores en ${objInfo.type} ${objInfo.name}`);
          setBottomTab('errors');
          useAppStore.getState().showToast(`Compilado con errores en ${objInfo.name}`, 'error');
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      setBottomTab('results');
      addHistory({
        id: crypto.randomUUID(),
        sql: query,
        timestamp: new Date().toISOString(),
        connectionId: activeConnection!.id,
        duration: 0,
        status: 'error',
        error: err.message
      });
    } finally {
      endExecution();
    }
  };

  // ── COMMIT / ROLLBACK ──────────────────────────────────────────────────────
  const handleCommit = async () => {
    if (!activeConnection) return;
    try {
      const res = await fetch('/api/oracle/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection: activeConnection })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      useAppStore.getState().showToast('COMMIT exitoso ✓', 'success');
    } catch (err: any) {
      useAppStore.getState().showToast(`COMMIT error: ${err.message}`, 'error');
    }
  };

  const handleRollback = async () => {
    if (!activeConnection) return;
    try {
      const res = await fetch('/api/oracle/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection: activeConnection })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      useAppStore.getState().showToast('ROLLBACK exitoso ↩', 'info');
    } catch (err: any) {
      useAppStore.getState().showToast(`ROLLBACK error: ${err.message}`, 'error');
    }
  };

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const handleUndo = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      editor.trigger('toolbar', 'undo', null);
    }
  };

  const handleRedo = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      editor.trigger('toolbar', 'redo', null);
    }
  };

  // ── Clipboard ──────────────────────────────────────────────────────────────
  const handleCut = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      editor.trigger('toolbar', 'editor.action.clipboardCutAction', null);
    }
  };
  const handleCopy = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      editor.trigger('toolbar', 'editor.action.clipboardCopyAction', null);
    }
  };
  const handlePaste = async () => {
    const editor = editorRef.current;
    if (editor) {
      try {
        const text = await navigator.clipboard.readText();
        editor.focus();
        const selection = editor.getSelection();
        editor.executeEdits('toolbar', [{
          range: selection,
          text: text,
          forceMoveMarkers: true
        }]);
      } catch {
        // Fallback: use Monaco action
        editor.focus();
        editor.trigger('toolbar', 'editor.action.clipboardPasteAction', null);
      }
    }
  };

  const handleGoToErrorLine = (line: number, position: number) => {
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: position || 1 });
    }
  };

  const iconSize = 'w-[18px] h-[18px]';
  const bg = isDark ? 'bg-gray-950 text-gray-200' : 'bg-white text-gray-800';

  return (
    <main className={`flex h-screen w-full overflow-hidden ${bg} font-sans transition-colors duration-300`}>
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Icon Toolbar ───────────────────────────────────────────── */}
        <div className={`h-11 border-b flex items-center px-2 gap-0.5 overflow-x-auto custom-scrollbar ${
          isDark ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-gray-50/80'
        }`}>
          {/* Connection indicator */}
          <div className="flex items-center mr-1">
            {activeConnection ? (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> {activeConnection.name}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Sin conexión
              </div>
            )}
          </div>

          <TbSep isDark={isDark} />

          {/* ── Group: New / Clear ── */}
          <TbBtn isDark={isDark} icon={<FilePlus className={iconSize} />} label="Nuevo Tab" onClick={() => addTab({ id: crypto.randomUUID(), title: 'Query', query: '' })} />
          <TbBtn isDark={isDark} icon={<Eraser className={iconSize} />} label="Limpiar" onClick={() => updateTabContent(activeTab.id, '')} />

          <TbSep isDark={isDark} />

          {/* ── Group: Clipboard & History ── */}
          <TbBtn isDark={isDark} icon={<Undo className={iconSize} />} label="Deshacer" onClick={handleUndo} />
          <TbBtn isDark={isDark} icon={<Redo className={iconSize} />} label="Rehacer" onClick={handleRedo} />
          <TbSep isDark={isDark} />
          <TbBtn isDark={isDark} icon={<Scissors className={iconSize} />} label="Cortar" onClick={handleCut} />
          <TbBtn isDark={isDark} icon={<Clipboard className={iconSize} />} label="Copiar" onClick={handleCopy} />
          <TbBtn isDark={isDark} icon={<ClipboardPaste className={iconSize} />} label="Pegar" onClick={handlePaste} />

          <TbSep isDark={isDark} />

          {/* ── Group: Format / Save ── */}
          <TbBtn isDark={isDark} icon={<Wand2 className={iconSize} />} label="Formatear SQL" onClick={handleFormat} variant="primary" />
          <TbBtn isDark={isDark} icon={<Settings2 className={iconSize} />} label="Config. Formato" onClick={() => setFormatModalOpen(true)} />
          <TbBtn
            isDark={isDark}
            icon={activeFavorite ? <BookmarkCheck className={iconSize} /> : <BookmarkPlus className={iconSize} />}
            label={activeFavorite ? `Sobreescribir "${activeFavorite.name}"` : 'Guardar como favorito'}
            onClick={handleSave}
            disabled={!activeTab?.query?.trim()}
            variant="warning"
          />
          <TbBtn
            isDark={isDark}
            icon={<Save className={iconSize} />}
            label="Guardar en archivo"
            onClick={handleSaveToFile}
            disabled={!activeTab?.query?.trim()}
            variant="success"
          />
          <TbBtn
            isDark={isDark}
            icon={<FolderOpen className={iconSize} />}
            label="Abrir archivo"
            onClick={handleOpenFileClick}
            variant="default"
          />

          <TbSep isDark={isDark} />

          {/* ── Group: Execute ── */}
          <TbBtn
            isDark={isDark}
            icon={isExecuting ? <Loader2 className={`${iconSize} animate-spin`} /> : <Play className={iconSize} />}
            label="Ejecutar Statement"
            shortcut="F9"
            onClick={handleExecuteStatement}
            disabled={isExecuting || !activeConnection}
            variant="primary"
          />
          <TbBtn
            isDark={isDark}
            icon={isExecuting ? <Loader2 className={`${iconSize} animate-spin`} /> : <PlayCircle className={iconSize} />}
            label="Ejecutar Script"
            shortcut="F5"
            onClick={handleExecuteScript}
            disabled={isExecuting || !activeConnection}
            variant="primary"
          />
          <TbBtn
            isDark={isDark}
            icon={isExecuting ? <Loader2 className={`${iconSize} animate-spin`} /> : <Hammer className={iconSize} />}
            label="Compilar PL/SQL"
            onClick={handleCompile}
            disabled={isExecuting || !activeConnection}
            variant="primary"
          />

          <TbSep isDark={isDark} />

          {/* ── Group: Transaction ── */}
          <TbBtn
            isDark={isDark}
            icon={<CheckCircle2 className={iconSize} />}
            label="COMMIT"
            onClick={handleCommit}
            disabled={!activeConnection}
            variant="success"
          />
          <TbBtn
            isDark={isDark}
            icon={<Undo2 className={iconSize} />}
            label="ROLLBACK"
            onClick={handleRollback}
            disabled={!activeConnection}
            variant="danger"
          />

          <TbSep isDark={isDark} />

          {/* ── Group: Settings ── */}
          <TbBtn isDark={isDark} icon={<CalendarClock className={iconSize} />} label="Config. Historial" onClick={() => setHistorySettingsOpen(true)} />
          <TbBtn
            isDark={isDark}
            icon={<Network className={iconSize} />}
            label="Diagrama Relacional"
            onClick={() => setIsDiagramOpen(true)}
            disabled={!activeConnection}
            variant="primary"
          />
          
          {/* DBMS Output toggle (compact) */}
          <div className="ml-auto flex items-center">
            <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2.5 py-1 rounded-full transition-colors ${
              enableDbmsOutput
                ? (isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-100 text-green-600')
                : 'opacity-60 hover:opacity-100'
            }`}>
              <input 
                type="checkbox" 
                checked={enableDbmsOutput} 
                onChange={(e) => setEnableDbmsOutput(e.target.checked)} 
                className="rounded border-gray-300 w-3 h-3"
              />
              DBMS_OUT
            </label>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className={`flex items-center px-2 pt-2 border-b overflow-x-auto custom-scrollbar ${isDark ? 'border-gray-800 bg-gray-900/20' : 'border-gray-200 bg-gray-50'}`}>
          {tabs.map((tab, idx) => (
            <div 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm border-t border-l border-r rounded-t-lg cursor-pointer max-w-[200px] ${
                activeTab.id === tab.id 
                  ? (isDark ? 'bg-gray-950 border-gray-800 text-blue-400' : 'bg-white border-gray-200 text-blue-600') 
                  : (isDark ? 'bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-gray-800' : 'bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-gray-200')
              }`}
            >
              <span className="truncate">{tab.title} {idx + 1}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
                className="p-0.5 rounded-md hover:bg-black/10 opacity-50 hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button 
            onClick={() => addTab({ id: crypto.randomUUID(), title: 'Query', query: '' })}
            className="ml-2 p-1 rounded hover:bg-black/10 opacity-60 hover:opacity-100 mb-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="h-[45%] border-b border-inherit relative">
          <Editor
            height="100%"
            defaultLanguage="sql"
            theme={isDark ? 'vs-dark' : 'light'}
            value={activeTab.query}
            onChange={(val) => updateTabContent(activeTab.id, val || '')}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              lineHeight: 24,
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
            }}
          />
        </div>

        <div className={`flex-1 flex flex-col min-h-0 bg-opacity-50 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <div className={`px-2 flex items-center gap-1 border-b border-inherit ${isDark ? 'bg-gray-800/80' : 'bg-gray-200/50'}`}>
            <button 
              onClick={() => setBottomTab('results')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${bottomTab === 'results' ? 'border-blue-500 text-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <div className="flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Results</div>
            </button>
            <button 
              onClick={() => setBottomTab('dbms')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${bottomTab === 'dbms' ? 'border-blue-500 text-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <div className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> DBMS Output</div>
            </button>
            <button 
              onClick={() => setBottomTab('errors')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${bottomTab === 'errors' ? 'border-red-500 text-red-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> 
                Errores
                {compileErrors.length > 0 && (
                  <span className="text-[10px] bg-red-500 text-white font-bold rounded-full px-1.5 leading-4">
                    {compileErrors.length}
                  </span>
                )}
              </div>
            </button>

            {result && (
              <div className="flex items-center gap-4 text-xs ml-auto pr-2">
                <span className="flex items-center gap-1 text-green-500"><CheckCircle className="w-3.5 h-3.5" /> Success</span>
                <span className="flex items-center gap-1 opacity-70"><Clock className="w-3.5 h-3.5" /> {result.duration}ms</span>
                <span className="flex items-center gap-1 opacity-70"><Database className="w-3.5 h-3.5" /> {result.rowCount} rows</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative">
            {null}

            {bottomTab === 'results' && (
              <>
                {error ? (
                  <div className="p-6 h-full overflow-auto">
                    <div className="flex gap-3 text-red-500 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold mb-1">Error de Ejecución</h3>
                        <pre className="text-xs font-mono whitespace-pre-wrap">{error}</pre>
                      </div>
                    </div>
                  </div>
                ) : result ? (
                  <ResultsTable data={result.rows} columns={result.columns} sql={activeTab.query} />
                ) : (
                  <div className="h-full flex items-center justify-center opacity-30 text-sm flex-col gap-2">
                    <Database className="w-8 h-8 mb-2 opacity-50" />
                    Ejecuta una consulta para ver resultados
                  </div>
                )}
              </>
            )}

            {bottomTab === 'dbms' && (
              <div className="h-full flex flex-col">
                <div className={`p-2 border-b flex justify-between items-center ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className="text-sm opacity-70">Server Output</span>
                  <button 
                    onClick={() => { if(result) { setResult({...result, dbmsOutput: []}); } }}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-500 flex items-center gap-1 text-xs font-medium"
                    title="Clear Output"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear Output
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-auto custom-scrollbar font-mono text-sm">
                  {result?.dbmsOutput && result.dbmsOutput.length > 0 ? (
                    result.dbmsOutput.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">{line}</div>
                    ))
                  ) : (
                    <div className="opacity-30 italic text-center mt-10">No DBMS_OUTPUT. Activa la casilla &apos;DBMS_OUT&apos; antes de ejecutar PL/SQL.</div>
                  )}
                </div>
              </div>
            )}

            {bottomTab === 'errors' && (
              <div className="h-full flex flex-col overflow-hidden">
                <div className={`p-2 border-b flex justify-between items-center ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className="text-sm opacity-70">Errores de Compilación (Doble clic en una fila para ir a la línea en el editor)</span>
                  {compileErrors.length > 0 && (
                    <button 
                      onClick={() => setCompileErrors([])}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-500 flex items-center gap-1 text-xs font-medium"
                      title="Clear Errors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Limpiar Errores
                    </button>
                  )}
                </div>
                <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                  {compileErrors.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className={`border-b text-gray-400 font-semibold ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                            <th className="py-2 px-3 w-16">Línea</th>
                            <th className="py-2 px-3 w-16">Col.</th>
                            <th className="py-2 px-3">Mensaje de Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compileErrors.map((err, idx) => (
                            <tr 
                              key={idx} 
                              onDoubleClick={() => handleGoToErrorLine(err.line, err.position)}
                              className={`border-b font-mono transition-colors cursor-pointer select-none ${
                                isDark 
                                  ? 'border-gray-800/60 hover:bg-red-500/5 text-gray-300' 
                                  : 'border-gray-100 hover:bg-red-50/30 text-gray-700'
                              }`}
                              title="Doble clic para ir a la línea en el editor"
                            >
                              <td className="py-2.5 px-3 font-semibold text-red-500 dark:text-red-400">{err.line}</td>
                              <td className="py-2.5 px-3 opacity-60">{err.position}</td>
                              <td className="py-2.5 px-3 text-red-600/90 dark:text-red-300/90 whitespace-pre-wrap">{err.text}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="opacity-30 italic text-center mt-10">No hay errores de compilación.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ParamModal
        isOpen={paramsModalOpen}
        onClose={() => setParamsModalOpen(false)}
        params={detectedParams}
        onExecute={(binds, bindTypes) => executeSql(activeTab.query, binds, bindTypes)}
      />
      <FormatterConfigModal 
        isOpen={formatModalOpen}
        onClose={() => setFormatModalOpen(false)}
      />
      <HistorySettingsModal
        isOpen={historySettingsOpen}
        isDark={isDark}
        currentDays={historyRetentionDays}
        historyCount={history.length}
        onSave={(days) => setHistoryRetentionDays(days)}
        onPurge={() => {
          purgeExpiredHistory();
          useAppStore.getState().showToast('Historial expirado eliminado', 'success');
        }}
        onClose={() => setHistorySettingsOpen(false)}
      />

      {/* ── Modal: confirmar sobreescritura de favorito ── */}
      {saveModal === 'overwrite' && activeFavorite && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 ${
            isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-yellow-500/15">
                <BookmarkCheck className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">Sobreescribir favorito</h2>
                <p className="text-xs opacity-50">El contenido actual del editor reemplazará al favorito</p>
              </div>
            </div>
            <p className={`text-sm px-3 py-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              ¿Deseas sobreescribir <span className="font-semibold text-yellow-400">{activeFavorite.name}</span> con el SQL actual?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSaveModal(null)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleOverwriteConfirm}
                className="flex-1 py-2 rounded-lg text-sm bg-yellow-500 hover:bg-yellow-400 text-black font-semibold transition-colors"
              >
                Sobreescribir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: guardar nuevo favorito desde editor ── */}
      {saveModal === 'new' && (
        <FavoriteNameModal
          isDark={isDark}
          existingNames={favorites.map(f => f.name)}
          sections={favoriteSections}
          initialName={activeTab?.title ?? ''}
          onConfirm={handleNewFavoriteConfirm}
          onCancel={() => setSaveModal(null)}
          onAddSection={(id, name) => addFavoriteSection(id, name)}
        />
      )}

      {isExecuting && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 flex flex-col items-center text-center gap-6 transform scale-100 transition-all ${
            isDark ? 'bg-gray-900/80 border-gray-700/80 text-gray-200 shadow-black/80' : 'bg-white/80 border-gray-200/80 text-gray-800 shadow-gray-400/30'
          }`}>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md animate-ping" />
              <div className="relative p-4 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>
            
            <div className="space-y-1 w-full">
              <h3 className="font-bold text-lg tracking-tight">
                {executionType === 'script' ? 'Ejecutando Script' : executionType === 'compile' ? 'Compilando PL/SQL' : 'Ejecutando Sentencia'}
              </h3>
              {executionProgress && (
                <p className="text-xs opacity-60 font-semibold uppercase tracking-wider">
                  Sentencia {executionProgress.current} de {executionProgress.total}
                </p>
              )}
            </div>

            <div className={`px-6 py-3 rounded-2xl font-mono text-3xl font-bold tracking-wider ${
              isDark ? 'bg-gray-950/60 text-blue-400 border border-gray-800' : 'bg-gray-100 text-blue-600 border border-gray-200'
            }`}>
              {(executionElapsedTime / 1000).toFixed(1)}s
            </div>

            {executionCurrentSql && (
              <div className={`w-full max-h-24 overflow-y-auto text-left font-mono text-[10px] p-3 rounded-lg border leading-normal custom-scrollbar ${
                isDark ? 'bg-gray-950/40 border-gray-800/80 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                <span className="whitespace-pre-wrap">{executionCurrentSql}</span>
              </div>
            )}

            <button
              onClick={handleCancelExecution}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-red-500/10 hover:shadow-red-500/20 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" /> Cancelar Ejecución
            </button>
          </div>
        </div>
      )}



      {toast && (
        <div className="fixed bottom-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border backdrop-blur-md bg-opacity-90 transition-all duration-300 transform translate-y-0 animate-bounce-short"
          style={{
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)',
            color: isDark ? '#e2e8f0' : '#1e293b'
          }}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />}
          {toast.type === 'info' && <Database className="w-5 h-5 text-blue-500 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={hideToast} className="ml-2 p-0.5 rounded-md hover:bg-black/10 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        accept=".sql,.txt"
        style={{ display: 'none' }}
        onChange={handleOpenFileChange}
      />
      <DiagramEditor
        isOpen={isDiagramOpen}
        onClose={() => setIsDiagramOpen(false)}
        isDark={isDark}
        activeConnection={activeConnection}
        showToast={showToast}
      />
    </main>
  );
}
