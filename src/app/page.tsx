"use client";

import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Sidebar from '@/components/Sidebar';
import ParamModal from '@/components/ParamModal';
import ResultsTable from '@/components/ResultsTable';
import Editor from '@monaco-editor/react';
import { extractSqlParams } from '@/lib/sql-parser';
import { Play, Loader2, AlertTriangle, Clock, Database, Eraser, CheckCircle, Plus, X } from 'lucide-react';
import { ExecResult } from '@/types';

export default function Home() {
  const { 
    isDark, activeConnectionId, connections, addHistory,
    tabs, activeTabId, setActiveTab, addTab, removeTab, updateTabContent
  } = useAppStore();
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [detectedParams, setDetectedParams] = useState<string[]>([]);
  const editorRef = useRef<any>(null);

  const activeConnection = connections.find(c => c.id === activeConnectionId);
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecuteClick();
    });
  };

  const handleExecuteClick = () => {
    if (!activeConnection) {
      setError("Please select an active connection from the sidebar.");
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

  const executeSql = async (query: string, binds: Record<string, any>) => {
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
          binds
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Execution failed');
      }

      setResult(data);
      addHistory({
        id: crypto.randomUUID(),
        sql: query,
        timestamp: new Date().toISOString(),
        connectionId: activeConnection!.id,
        duration: data.duration,
        isFavorite: false,
        status: 'success',
        rowCount: data.rowCount
      });
    } catch (err: any) {
      setError(err.message);
      addHistory({
        id: crypto.randomUUID(),
        sql: query,
        timestamp: new Date().toISOString(),
        connectionId: activeConnection!.id,
        duration: 0,
        isFavorite: false,
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
          <div className="flex items-center gap-2">
            <button 
              onClick={() => updateTabContent(activeTab.id, '')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition-colors`}
            >
              <Eraser className="w-4 h-4" /> Clear
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
          <div className={`px-4 py-2 text-xs font-semibold flex items-center gap-4 border-b border-inherit ${isDark ? 'bg-gray-800/80' : 'bg-gray-200/50'}`}>
            <span className="uppercase tracking-wider opacity-60">Results</span>
            {result && (
              <div className="flex items-center gap-4 text-xs">
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
              <ResultsTable data={result.rows} columns={result.columns} />
            ) : (
              <div className="h-full flex items-center justify-center opacity-30 text-sm flex-col gap-2">
                <Database className="w-8 h-8 mb-2 opacity-50" />
                Run a query to see results
              </div>
            )}
          </div>
        </div>
      </div>

      <ParamModal
        isOpen={paramsModalOpen}
        onClose={() => setParamsModalOpen(false)}
        params={detectedParams}
        onExecute={(binds) => executeSql(activeTab.query, binds)}
      />
    </main>
  );
}
