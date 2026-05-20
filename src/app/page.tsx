"use client";

import { useState, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Sidebar from '@/components/Sidebar';
import ParamModal from '@/components/ParamModal';
import ResultsTable from '@/components/ResultsTable';
import FavoriteNameModal from '@/components/FavoriteNameModal';
import Editor from '@monaco-editor/react';
import { extractSqlParams } from '@/lib/sql-parser';
import FormatterConfigModal from '@/components/FormatterConfigModal';
import { format } from 'sql-formatter';
import { Play, Loader2, AlertTriangle, Clock, Database, Eraser, CheckCircle, Plus, X, MessageSquare, Trash2, Wand2, Settings2, BookmarkCheck, BookmarkPlus, Save } from 'lucide-react';
import { ExecResult } from '@/types';

export default function Home() {
  const {
    isAuthenticated, login,
    isDark, activeConnectionId, connections, addHistory,
    tabs, activeTabId, setActiveTab, addTab, removeTab, updateTabContent, formatOptions,
    favorites, favoriteSections, addFavoriteFromSql, updateFavoriteSql, addFavoriteSection,
    toast, hideToast
  } = useAppStore();
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [detectedParams, setDetectedParams] = useState<string[]>([]);
  const [enableDbmsOutput, setEnableDbmsOutput] = useState(false);
  const [bottomTab, setBottomTab] = useState<'results' | 'dbms'>('results');
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  // Save modal: 'overwrite' = confirm overwrite existing fav | 'new' = create new fav
  const [saveModal, setSaveModal] = useState<'overwrite' | 'new' | null>(null);

  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [shake, setShake] = useState(false);

  const editorRef = useRef<any>(null);

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

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecuteClick();
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
      // Tab comes from a favorite — ask to overwrite
      setSaveModal('overwrite');
    } else {
      // New favorite from editor SQL
      setSaveModal('new');
    }
  };

  const handleOverwriteConfirm = () => {
    if (activeFavorite) {
      updateFavoriteSql(activeFavorite.id, activeTab.query);
      setSaveModal(null);
      // Toast from store
      useAppStore.getState().showToast(`"${activeFavorite.name}" actualizado`, 'success');
    }
  };

  const handleNewFavoriteConfirm = (name: string, sectionId: string) => {
    addFavoriteFromSql(activeTab.query, name, sectionId);
    setSaveModal(null);
    useAppStore.getState().showToast(`"${name}" guardado en favoritos`, 'success');
  };

  const handleExecuteClick = () => {
    if (!activeConnection) {
      setError("Please select an active connection from the sidebar.");
      setBottomTab('results');
      return;
    }
    
    const editor = editorRef.current;
    let selectedText = editor ? editor.getModel().getValueInRange(editor.getSelection()) : '';
    let queryToRun = selectedText || activeTab.query;
    
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

  const executeSql = async (query: string, binds: Record<string, any>, bindTypes?: Record<string, string>) => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

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
        })
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
    } catch (err: any) {
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
      setIsExecuting(false);
    }
  };

  const bg = isDark ? 'bg-gray-950 text-gray-200' : 'bg-white text-gray-800';

  return (
    <main className={`flex h-screen w-full overflow-hidden ${bg} font-sans transition-colors duration-300`}>
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className={`h-14 border-b flex items-center justify-between px-4 ${isDark ? 'border-gray-800 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            {activeConnection ? (
              <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                <CheckCircle className="w-4 h-4" /> {activeConnection.name}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 font-medium">
                <AlertTriangle className="w-4 h-4" /> No connection selected
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer opacity-80 hover:opacity-100">
              <input 
                type="checkbox" 
                checked={enableDbmsOutput} 
                onChange={(e) => setEnableDbmsOutput(e.target.checked)} 
                className="rounded border-gray-300"
              />
              DBMS_OUTPUT
            </label>
            <div className="w-px h-5 bg-gray-500/20"></div>
            <div className={`flex items-center rounded-md border ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-300 bg-white'} overflow-hidden`}>
              <button 
                onClick={handleFormat}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-2 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                title="Format SQL"
              >
                <Wand2 className="w-4 h-4" /> Format
              </button>
              <div className={`w-px h-full ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
              <button 
                onClick={() => setFormatModalOpen(true)}
                className={`px-2 py-1.5 flex items-center justify-center ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                title="Format Settings"
              >
                <Settings2 className="w-4 h-4 opacity-70" />
              </button>
            </div>
            <button
              onClick={() => updateTabContent(activeTab.id, '')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition-colors`}
            >
              <Eraser className="w-4 h-4" /> Clear
            </button>
            {/* ── Save button ─────────────────────────────── */}
            <button
              onClick={handleSave}
              disabled={!activeTab?.query?.trim()}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-40 ${
                activeFavorite
                  ? (isDark ? 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/30' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-300')
                  : (isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200')
              }`}
              title={activeFavorite ? `Sobreescribir favorito "${activeFavorite.name}"` : 'Guardar como favorito'}
            >
              {activeFavorite
                ? <><BookmarkCheck className="w-4 h-4" /> Guardar</>
                : <><BookmarkPlus className="w-4 h-4" /> Guardar</>}
            </button>
            <button 
              onClick={handleExecuteClick}
              disabled={isExecuting || !activeConnection}
              className="px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Execute <span className="opacity-60 text-xs ml-1">(Ctrl+Enter)</span>
            </button>
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

            {result && (
              <div className="flex items-center gap-4 text-xs ml-auto pr-2">
                <span className="flex items-center gap-1 text-green-500"><CheckCircle className="w-3.5 h-3.5" /> Success</span>
                <span className="flex items-center gap-1 opacity-70"><Clock className="w-3.5 h-3.5" /> {result.duration}ms</span>
                <span className="flex items-center gap-1 opacity-70"><Database className="w-3.5 h-3.5" /> {result.rowCount} rows</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative">
            {isExecuting ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px] z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-sm font-medium animate-pulse opacity-80">Executing query...</span>
                </div>
              </div>
            ) : null}

            {bottomTab === 'results' && (
              <>
                {error ? (
                  <div className="p-6 h-full overflow-auto">
                    <div className="flex gap-3 text-red-500 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold mb-1">Execution Error</h3>
                        <pre className="text-xs font-mono whitespace-pre-wrap">{error}</pre>
                      </div>
                    </div>
                  </div>
                ) : result ? (
                  <ResultsTable data={result.rows} columns={result.columns} sql={activeTab.query} />
                ) : (
                  <div className="h-full flex items-center justify-center opacity-30 text-sm flex-col gap-2">
                    <Database className="w-8 h-8 mb-2 opacity-50" />
                    Run a query to see results
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
                    <div className="opacity-30 italic text-center mt-10">No DBMS_OUTPUT. Make sure to check the 'DBMS_OUTPUT' box before executing PL/SQL.</div>
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
    </main>
  );
}
