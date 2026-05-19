"use client";

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Database, History, Star, Plus, Trash2, Edit2, PlayCircle, Settings2, CheckCircle, XCircle, Eye, Download, X, Copy } from 'lucide-react';
import { Connection } from '@/types';
import ConnectionModal from './ConnectionModal';
import { saveAs } from 'file-saver';
import Editor from '@monaco-editor/react';

export default function Sidebar() {
  const { connections, activeConnectionId, setActiveConnection, removeConnection, history, removeHistory, toggleTheme, isDark, addTab, showToast } = useAppStore();
  const [tab, setTab] = useState<'connections' | 'history' | 'favorites'>('connections');
  const [isConnModalOpen, setConnModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [sqlModal, setSqlModal] = useState<{ isOpen: boolean, sql: string }>({ isOpen: false, sql: '' });

  const handleEdit = (conn: Connection) => {
    setEditingConn(conn);
    setConnModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingConn(null);
    setConnModalOpen(true);
  };

  return (
    <div className={`w-72 flex flex-col border-r transition-colors duration-300 ${isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>
      <div className="flex items-center justify-between p-4 border-b border-inherit">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />
          SQL Runner AI
        </h1>
      </div>

      <div className="flex border-b border-inherit">
        <button onClick={() => setTab('connections')} className={`flex-1 py-3 px-2 text-sm font-medium border-b-2 flex justify-center gap-2 ${tab === 'connections' ? 'border-blue-500 text-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}>
          <Database className="w-4 h-4" /> Conns
        </button>
        <button onClick={() => setTab('history')} className={`flex-1 py-3 px-2 text-sm font-medium border-b-2 flex justify-center gap-2 ${tab === 'history' ? 'border-blue-500 text-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}>
          <History className="w-4 h-4" /> Hist
        </button>
        <button onClick={() => setTab('favorites')} className={`flex-1 py-3 px-2 text-sm font-medium border-b-2 flex justify-center gap-2 ${tab === 'favorites' ? 'border-blue-500 text-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}>
          <Star className="w-4 h-4" /> Favs
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {tab === 'connections' && (
          <div className="space-y-3">
            <button
              onClick={handleAddNew}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Plus className="w-4 h-4" /> New Connection
            </button>

            {connections.map(conn => (
              <div
                key={conn.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  activeConnectionId === conn.id 
                    ? (isDark ? 'bg-blue-900/20 border-blue-500/50' : 'bg-blue-50 border-blue-400')
                    : (isDark ? 'bg-gray-800/50 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-300')
                }`}
                onClick={() => setActiveConnection(conn.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-2 text-sm">
                    {activeConnectionId === conn.id ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Database className="w-4 h-4 opacity-50" />}
                    {conn.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(conn); }} className="p-1 hover:bg-black/10 rounded">
                      <Edit2 className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeConnection(conn.id); }} className="p-1 hover:bg-red-500/20 rounded text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs opacity-60 truncate">
                  {conn.user}@{conn.host}:{conn.port}/{conn.serviceName}
                </div>
              </div>
            ))}
            {connections.length === 0 && (
              <div className="text-center text-sm opacity-50 mt-10">No connections yet.</div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-2">
            {history.map(item => (
              <div 
                key={item.id} 
                onClick={() => addTab({ id: crypto.randomUUID(), title: 'History Query', query: item.sql })}
                className={`p-3 rounded-md border text-sm cursor-pointer hover:border-blue-500 transition-colors ${isDark ? 'border-gray-800 bg-gray-800/30' : 'border-gray-200 bg-white'}`}
              >
                <div className="text-xs opacity-50 mb-1">{new Date(item.timestamp).toLocaleString()}</div>
                <div className="font-mono text-xs truncate opacity-80 mb-2">{item.sql}</div>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className={item.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                    {item.status === 'success' ? `${item.duration}ms` : 'Failed'}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSqlModal({ isOpen: true, sql: item.sql }); }} 
                      className="p-1 hover:bg-black/10 rounded text-blue-500" 
                      title="View Full SQL"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const blob = new Blob([item.sql], { type: "text/plain;charset=utf-8" });
                        saveAs(blob, `query_${new Date(item.timestamp).getTime()}.sql`);
                      }} 
                      className="p-1 hover:bg-black/10 rounded text-green-500" 
                      title="Download SQL"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }} 
                      className="p-1 hover:bg-red-500/10 rounded text-red-500" 
                      title="Delete from History"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="text-center text-sm opacity-50 mt-10">No history yet.</div>
            )}
          </div>
        )}

        {tab === 'favorites' && (
          <div className="space-y-2">
            {history.filter(h => h.isFavorite).map(item => (
              <div 
                key={item.id} 
                onClick={() => addTab({ id: crypto.randomUUID(), title: 'Favorite Query', query: item.sql })}
                className={`p-3 rounded-md border text-sm cursor-pointer hover:border-blue-500 transition-colors ${isDark ? 'border-gray-800 bg-gray-800/30' : 'border-gray-200 bg-white'}`}
              >
                <div className="font-mono text-xs truncate opacity-80 mb-2">{item.sql}</div>
              </div>
            ))}
            {history.filter(h => h.isFavorite).length === 0 && (
              <div className="text-center text-sm opacity-50 mt-10">No favorites yet.</div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-inherit">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100"
        >
          <Settings2 className="w-4 h-4" />
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      {isConnModalOpen && (
        <ConnectionModal
          isOpen={isConnModalOpen}
          onClose={() => setConnModalOpen(false)}
          connection={editingConn}
        />
      )}

      {sqlModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-4xl h-[80vh] flex flex-col rounded-xl shadow-2xl ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'} border`}>
            <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <h3 className="font-bold">Full SQL Instruction</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(sqlModal.sql);
                    showToast('SQL copied to clipboard!');
                  }}
                  className="p-1.5 rounded-md hover:bg-black/10 text-blue-500"
                  title="Copy to Clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    const blob = new Blob([sqlModal.sql], { type: "text/plain;charset=utf-8" });
                    saveAs(blob, `query_${Date.now()}.sql`);
                  }}
                  className="p-1.5 rounded-md hover:bg-black/10 text-green-500"
                  title="Download SQL"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setSqlModal({ isOpen: false, sql: '' })} className="p-1.5 rounded-md hover:bg-black/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative p-1">
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme={isDark ? 'vs-dark' : 'light'}
                value={sqlModal.sql}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  lineHeight: 20,
                  scrollBeyondLastLine: false,
                  domReadOnly: true,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
