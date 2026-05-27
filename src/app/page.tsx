"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Undo, Redo, Hammer, Save, FolderOpen, Network, Activity, GitCompare, Eye, EyeOff,
  ChevronDown, ChevronUp, Maximize2, Minimize2, RefreshCw, Folder, ChevronRight,
  Package, LogOut, Key, Mail, Phone, ExternalLink, Copy, Sparkles, Code2, Cpu, HelpCircle
} from 'lucide-react';
import { ExecResult, SqlTab } from '@/types';
import DiagramEditor from '@/components/DiagramEditor';
import CompareObjectsModal from '@/components/CompareObjectsModal';
import DescribeObjectModal from '@/components/DescribeObjectModal';
import BackupModal from '@/components/BackupModal';
import HelpModal from '@/components/HelpModal';
import { generatePlsqlOutline, OutlineNode } from '@/lib/plsql-parser';

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
    isAuthenticated, login, logout,
    isDark, activeConnectionId, connections, addHistory,
    tabs, activeTabId, setActiveTab, addTab, removeTab, updateTabContent, formatOptions,
    favorites, favoriteSections, addFavoriteFromSql, updateFavoriteSql, addFavoriteSection,
    toast, hideToast, showToast,
    history, historyRetentionDays, setHistoryRetentionDays, purgeExpiredHistory,
    inactivityTimeoutEnabled, inactivityTimeoutMinutes, setInactivitySettings
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
  
  // States for query results pagination/incremental loading
  const [hasMoreRows, setHasMoreRows] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [lastExecutedSql, setLastExecutedSql] = useState<string | null>(null);
  const [lastBinds, setLastBinds] = useState<any>({});
  const [lastBindTypes, setLastBindTypes] = useState<any>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // States for tab context menu and close confirmations
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    tab: SqlTab;
  } | null>(null);
  const [tabsQueueToClose, setTabsQueueToClose] = useState<SqlTab[]>([]);
  const [currentTabToConfirm, setCurrentTabToConfirm] = useState<SqlTab | null>(null);

  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [detectedParams, setDetectedParams] = useState<string[]>([]);
  const [enableDbmsOutput, setEnableDbmsOutput] = useState(false);
  const [bottomTab, setBottomTab] = useState<'results' | 'dbms' | 'errors' | 'explain'>('results');
  const [isBottomPanelMinimized, setIsBottomPanelMinimized] = useState(false);
  const [explainPlan, setExplainPlan] = useState<string | null>(null);
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  const [historySettingsOpen, setHistorySettingsOpen] = useState(false);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [columnsPanelHeight, setColumnsPanelHeight] = useState(250);
  const [showNavigator, setShowNavigator] = useState(true);
  const [expandedNavigatorNodes, setExpandedNavigatorNodes] = useState<Record<string, boolean>>({});
  const [plsqlOutline, setPlsqlOutline] = useState<OutlineNode[]>([]);

  // Metadata Right Panel States
  const [showMetadataPanel, setShowMetadataPanel] = useState(true);
  const [metadataSchema, setMetadataSchema] = useState<string>('');

  // Split screen states
  const [splitMode, setSplitMode] = useState<'none' | 'vertical' | 'horizontal'>('none');
  const [secondaryActiveTabId, setSecondaryActiveTabId] = useState<string | null>(null);
  const [activeEditorSide, setActiveEditorSide] = useState<'primary' | 'secondary'>('primary');

  const secondaryEditorRef = useRef<any>(null);

  const handleSplitVerticalRef = useRef<() => void>(() => {});
  const handleSplitHorizontalRef = useRef<() => void>(() => {});
  const handleUnsplitRef = useRef<() => void>(() => {});

  const getCurrentEditor = () => {
    return (splitMode !== 'none' && activeEditorSide === 'secondary')
      ? secondaryEditorRef.current
      : editorRef.current;
  };

  // Synchronize layout handler refs for Monaco context menu actions
  useEffect(() => {
    handleSplitVerticalRef.current = () => {
      setSplitMode('vertical');
      if (!secondaryActiveTabId || secondaryActiveTabId === activeTabId) {
        const otherTab = tabs.find(t => t.id !== activeTabId);
        if (otherTab) {
          setSecondaryActiveTabId(otherTab.id);
        } else {
          setSecondaryActiveTabId(activeTabId);
        }
      }
    };
    handleSplitHorizontalRef.current = () => {
      setSplitMode('horizontal');
      if (!secondaryActiveTabId || secondaryActiveTabId === activeTabId) {
        const otherTab = tabs.find(t => t.id !== activeTabId);
        if (otherTab) {
          setSecondaryActiveTabId(otherTab.id);
        } else {
          setSecondaryActiveTabId(activeTabId);
        }
      }
    };
    handleUnsplitRef.current = () => {
      setSplitMode('none');
      setActiveEditorSide('primary');
    };
  }, [activeTabId, secondaryActiveTabId, tabs]);
  const [metadataSchemas, setMetadataSchemas] = useState<string[]>([]);
  const [isLoadingMetadataSchemas, setIsLoadingMetadataSchemas] = useState(false);
  const [metadataTable, setMetadataTable] = useState<string>('');
  const [metadataTables, setMetadataTables] = useState<string[]>([]);
  const [isLoadingMetadataTables, setIsLoadingMetadataTables] = useState(false);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [metadataColumns, setMetadataColumns] = useState<{columnName: string, dataType: string, nullable: boolean}[]>([]);
  const [isLoadingMetadataColumns, setIsLoadingMetadataColumns] = useState(false);

  // Describe Object (F4) States
  const [isDescribeOpen, setIsDescribeOpen] = useState(false);
  const [describeObjectName, setDescribeObjectName] = useState('');
  const triggerDescribeObjectRef = useRef<(name: string) => void>(() => {});

  // Save modal: 'overwrite' = confirm overwrite existing fav | 'new' = create new fav
  const [saveModal, setSaveModal] = useState<'overwrite' | 'new' | null>(null);

  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [shake, setShake] = useState(false);
  const [isRequestKeyOpen, setIsRequestKeyOpen] = useState(false);

  // Tab context menu and closing queue handlers
  useEffect(() => {
    const handleWindowClick = () => {
      setTabContextMenu(null);
    };
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, []);

  const checkIfTabIsModifiedFavorite = (tab: SqlTab): boolean => {
    if (!tab.favoriteId) return false;
    const fav = favorites.find(f => f.id === tab.favoriteId);
    if (!fav) return false;
    const normTabQuery = tab.query.replace(/\r\n/g, '\n').trim();
    const normFavQuery = fav.sql.replace(/\r\n/g, '\n').trim();
    return normTabQuery !== normFavQuery;
  };

  const startClosingQueue = (tabsList: SqlTab[]) => {
    setTabsQueueToClose(tabsList);
    processNextInCloseQueue(tabsList);
  };

  const processNextInCloseQueue = (currentQueue: SqlTab[]) => {
    if (currentQueue.length === 0) {
      setCurrentTabToConfirm(null);
      return;
    }

    const nextTab = currentQueue[0];
    const isModified = checkIfTabIsModifiedFavorite(nextTab);

    if (isModified) {
      setActiveTab(nextTab.id);
      setCurrentTabToConfirm(nextTab);
    } else {
      removeTab(nextTab.id);
      const remaining = currentQueue.slice(1);
      setTabsQueueToClose(remaining);
      processNextInCloseQueue(remaining);
    }
  };

  const handleCloseTab = (tabId: string) => {
    const tabToClose = tabs.find(t => t.id === tabId);
    if (tabToClose) {
      startClosingQueue([tabToClose]);
    }
  };

  const handleCloseOtherTabs = (tabId: string) => {
    const otherTabs = tabs.filter(t => t.id !== tabId);
    startClosingQueue(otherTabs);
  };

  const handleCloseAllTabs = () => {
    startClosingQueue(tabs);
  };

  const handleTabClick = (tabId: string) => {
    if (splitMode === 'none') {
      setActiveTab(tabId);
    } else {
      if (activeEditorSide === 'primary') {
        setActiveTab(tabId);
      } else {
        setSecondaryActiveTabId(tabId);
      }
    }
  };

  const handleTabContextMenu = (e: React.MouseEvent, tab: SqlTab) => {
    e.preventDefault();
    setTabContextMenu({
      x: e.clientX,
      y: e.clientY,
      tab
    });
  };

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
    setIsBottomPanelMinimized(false);

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
  const secondaryActiveTab = tabs.find(t => t.id === secondaryActiveTabId) || tabs[0];

  const currentFocusedTab = (splitMode !== 'none' && activeEditorSide === 'secondary')
    ? secondaryActiveTab
    : activeTab;

  // Favorite linked to the current tab (if any)

  // Update PL/SQL outline when query changes
  useEffect(() => {
    if (currentFocusedTab?.query) {
      const outline = generatePlsqlOutline(currentFocusedTab.query);
      setPlsqlOutline(outline);
    } else {
      setPlsqlOutline([]);
    }
  }, [currentFocusedTab?.query]);

  // Update F4 trigger ref on every render to ensure fresh states
  triggerDescribeObjectRef.current = (name: string) => {
    setDescribeObjectName(name);
    setIsDescribeOpen(true);
  };
  const activeFavorite = currentFocusedTab?.favoriteId
    ? favorites.find(f => f.id === currentFocusedTab.favoriteId)
    : null;

  // Insert text into the editor at the cursor position
  const insertTextAtCursor = (text: string) => {
    const editor = getCurrentEditor();
    if (editor && monacoRef.current) {
      const selection = editor.getSelection();
      const range = new monacoRef.current.Range(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn
      );
      const id = { major: 1, minor: 1 };
      const textEdit = { identifier: id, range: range, text: text, forceMoveMarkers: true };
      editor.executeEdits("my-source", [textEdit]);
      editor.focus();
    }
  };

  // Inactivity timeout tracker (default 60 minutes)
  useEffect(() => {
    if (!isAuthenticated || !inactivityTimeoutEnabled) return;

    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      const ms = inactivityTimeoutMinutes * 60 * 1000;
      timeoutId = setTimeout(() => {
        logout();
        useAppStore.getState().showToast('Sesión cerrada por inactividad', 'info');
      }, ms);
    };

    const handleActivity = () => {
      resetTimer();
    };

    // User activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Initial timer trigger
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, inactivityTimeoutEnabled, inactivityTimeoutMinutes, logout]);

  // Fetch schemas for active connection
  useEffect(() => {
    if (!activeConnection) {
      setMetadataSchemas([]);
      setMetadataSchema('');
      return;
    }

    const fetchSchemas = async () => {
      setIsLoadingMetadataSchemas(true);
      try {
        const res = await fetch('/api/oracle/schemas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection: activeConnection })
        });
        const data = await res.json();
        if (res.ok && data.schemas) {
          setMetadataSchemas(data.schemas);
          const defaultSchema = activeConnection.user?.toUpperCase() || data.schemas[0] || '';
          setMetadataSchema(defaultSchema);
        } else {
          const fallback = activeConnection.user?.toUpperCase() || '';
          setMetadataSchemas([fallback]);
          setMetadataSchema(fallback);
        }
      } catch (err) {
        console.error('Error fetching metadata schemas', err);
        const fallback = activeConnection.user?.toUpperCase() || '';
        setMetadataSchemas([fallback]);
        setMetadataSchema(fallback);
      } finally {
        setIsLoadingMetadataSchemas(false);
      }
    };

    fetchSchemas();
  }, [activeConnection]);

  // Fetch tables for selected schema
  useEffect(() => {
    if (!activeConnection || !metadataSchema) {
      setMetadataTables([]);
      setMetadataTable('');
      setMetadataColumns([]);
      return;
    }

    const fetchTables = async () => {
      setIsLoadingMetadataTables(true);
      try {
        const res = await fetch('/api/oracle/objects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: activeConnection,
            schema: metadataSchema.trim() || undefined,
            visibleTypes: ['TABLE']
          })
        });
        const data = await res.json();
        if (res.ok && data.objects && data.objects.TABLE) {
          const tableNames = data.objects.TABLE.map((t: any) => t.name).sort();
          setMetadataTables(tableNames);
          if (tableNames.length > 0) {
            setMetadataTable(tableNames[0]);
          } else {
            setMetadataTable('');
          }
        } else {
          setMetadataTables([]);
          setMetadataTable('');
        }
      } catch (err) {
        console.error('Error fetching metadata tables', err);
        setMetadataTables([]);
        setMetadataTable('');
      } finally {
        setIsLoadingMetadataTables(false);
      }
    };

    fetchTables();
  }, [activeConnection, metadataSchema]);

  // Fetch columns for selected table
  useEffect(() => {
    if (!activeConnection || !metadataSchema || !metadataTable) {
      setMetadataColumns([]);
      return;
    }

    const fetchColumns = async () => {
      setIsLoadingMetadataColumns(true);
      try {
        const res = await fetch('/api/oracle/table-columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: activeConnection,
            schema: metadataSchema,
            tableName: metadataTable
          })
        });
        const data = await res.json();
        if (res.ok && data.columns) {
          setMetadataColumns(data.columns);
        } else {
          setMetadataColumns([]);
        }
      } catch (err) {
        console.error('Error fetching metadata columns', err);
        setMetadataColumns([]);
      } finally {
        setIsLoadingMetadataColumns(false);
      }
    };

    fetchColumns();
  }, [activeConnection, metadataSchema, metadataTable]);

  // Filter tables by search query
  const filteredTables = metadataTables.filter(t => 
    t.toLowerCase().includes(tableSearch.toLowerCase())
  );

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
      <main className={`flex min-h-screen w-full items-center justify-center overflow-y-auto p-4 md:p-8 relative ${loginBg} font-sans transition-colors duration-300`}>
        {/* Malla Cyber 3D del fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* 3D Grid Perspective Viewport */}
          <div className="absolute inset-0 origin-center" style={{ perspective: '800px', perspectiveOrigin: '50% 50%' }}>
            {/* Cyber Grid element */}
            <div 
              className="absolute inset-x-[-50%] top-[10%] bottom-[-50%] opacity-20 dark:opacity-30 animate-grid-travel" 
              style={{
                backgroundImage: isDark 
                  ? 'linear-gradient(to right, rgba(59,130,246,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.15) 1px, transparent 1px)' 
                  : 'linear-gradient(to right, rgba(59,130,246,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.08) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                transform: 'rotateX(65deg) translateZ(0)',
                maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)'
              }}
            />
          </div>
          
          {/* Esferas de luz ambiental */}
          <div className="absolute -top-[20%] -left-[20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-[130px] animate-pulse duration-[8s]" />
          <div className="absolute -bottom-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-purple-500/10 dark:bg-purple-600/10 blur-[130px] animate-pulse duration-[10s]" />
          
          {/* Nodos flotantes en el espacio de fondo */}
          <div className="absolute top-[15%] left-[8%] p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-full animate-float-node pointer-events-none hidden md:block" style={{ animationDelay: '0s' }}>
            <Database className="w-5 h-5 text-blue-500/70 dark:text-blue-400/80" />
          </div>
          <div className="absolute top-[35%] right-[8%] p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-full animate-float-node pointer-events-none hidden md:block" style={{ animationDelay: '2.5s' }}>
            <Activity className="w-5 h-5 text-purple-500/70 dark:text-purple-400/80" />
          </div>
          <div className="absolute bottom-[15%] left-[12%] p-3.5 bg-teal-500/10 border border-teal-500/20 rounded-full animate-float-node pointer-events-none hidden md:block" style={{ animationDelay: '1.2s' }}>
            <Network className="w-5 h-5 text-teal-500/70 dark:text-teal-400/80" />
          </div>
        </div>
        
        {/* Estilo para animación de agitación (shake) y transiciones escalonadas (staggered fade-in) */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
            20%, 40%, 60%, 80% { transform: translateX(6px); }
          }
          .animate-shake {
            animation: shake 0.4s ease-in-out;
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(15px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in-up {
            opacity: 0;
            animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        <div className="w-full max-w-5xl relative z-10 flex flex-col md:flex-row gap-8 items-stretch justify-center">
          {/* Columna Izquierda: Presentación del Software */}
          <div className={`flex-1 flex flex-col justify-between p-6 md:p-8 rounded-3xl backdrop-blur-xl border transition-colors duration-300 ${
            isDark 
              ? 'bg-gray-900/50 border-gray-800/80 text-gray-200 shadow-2xl shadow-black/30' 
              : 'bg-white/60 border-gray-200/80 text-gray-800 shadow-2xl shadow-gray-200/20'
          }`}>
            <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl shadow-inner ${
                  isDark ? 'bg-gray-950/60 text-blue-400' : 'bg-gray-100/90 text-blue-600'
                }`}>
                  <Sparkles className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold tracking-widest text-blue-500 uppercase">Herramienta Avanzada</span>
                  <h2 className="text-xl font-bold tracking-tight">Oracle SQL Runner AI</h2>
                </div>
              </div>
              
              <p className="text-xs md:text-sm opacity-80 leading-relaxed">
                Un entorno de desarrollo integrado diseñado para potenciar y simplificar la gestión de bases de datos Oracle. Escribe, ejecuta, modela y optimiza de forma profesional con una suite de herramientas de última generación.
              </p>
            </div>

            {/* Características */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
              <div className={`p-4 rounded-2xl border transition-all hover:translate-y-[-2px] animate-fade-in-up ${
                isDark ? 'bg-gray-950/40 border-gray-800/60 hover:border-blue-500/20' : 'bg-gray-50/80 border-gray-200/40 hover:border-blue-500/30'
              }`} style={{ animationDelay: '300ms' }}>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 mt-0.5">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500">Editor PL/SQL</h3>
                    <p className="text-[11px] opacity-70 mt-1 leading-snug">Editor inteligente con soporte para compilación, planes de ejecución y ejecución parcial de sentencias (F5/F9).</p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border transition-all hover:translate-y-[-2px] animate-fade-in-up ${
                isDark ? 'bg-gray-950/40 border-gray-800/60 hover:border-indigo-500/20' : 'bg-gray-50/80 border-gray-200/40 hover:border-indigo-500/30'
              }`} style={{ animationDelay: '450ms' }}>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500 mt-0.5">
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-500">Modelo Relacional</h3>
                    <p className="text-[11px] opacity-70 mt-1 leading-snug">Diseño visual de diagramas ERD, detección automática de claves foráneas y relaciones entre tablas del esquema.</p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border transition-all hover:translate-y-[-2px] animate-fade-in-up ${
                isDark ? 'bg-gray-950/40 border-gray-800/60 hover:border-purple-500/20' : 'bg-gray-50/80 border-gray-200/40 hover:border-purple-500/30'
              }`} style={{ animationDelay: '600ms' }}>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500 mt-0.5">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-500">Explorador de Objetos</h3>
                    <p className="text-[11px] opacity-70 mt-1 leading-snug">Visualiza más de 60 tipos de objetos (tablas, secuencias, jobs, triggers, directorios) con filtros dinámicos.</p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border transition-all hover:translate-y-[-2px] animate-fade-in-up ${
                isDark ? 'bg-gray-950/40 border-gray-800/60 hover:border-teal-500/20' : 'bg-gray-50/80 border-gray-200/40 hover:border-teal-500/30'
              }`} style={{ animationDelay: '750ms' }}>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-teal-500/10 rounded-xl text-teal-500 mt-0.5">
                    <BookmarkCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-500">Sincronización</h3>
                    <p className="text-[11px] opacity-70 mt-1 leading-snug">Guarda favoritos localmente o sincronízalos automáticamente en las tablas de tu base de datos Oracle.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalles del sistema */}
            <div className="flex items-center justify-between text-[10px] opacity-50 border-t border-gray-500/15 pt-3 animate-fade-in-up" style={{ animationDelay: '900ms' }}>
              <span>Tecnología Next.js + Tailwind CSS</span>
              <span>Versión 2.0.0</span>
            </div>
          </div>

          {/* Columna Derecha: Login */}
          <div className="w-full md:w-[380px] flex flex-col justify-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <form 
              onSubmit={handleLoginSubmit}
              className={`backdrop-blur-xl border flex flex-col items-center rounded-3xl p-6 md:p-8 shadow-2xl transition-all duration-300 transform scale-100 w-full justify-between min-h-[380px] ${
                shake ? 'animate-shake border-red-500 shadow-red-500/10' : ''
              } ${
                isDark 
                  ? 'bg-gray-900/65 border-gray-800/80 text-gray-200 shadow-black/60' 
                  : 'bg-white/75 border-gray-200/80 text-gray-800 shadow-gray-300/40'
              }`}
            >
              <div className="w-full flex flex-col items-center">
                {/* Logotipo / Icono */}
                <div className={`p-4 rounded-2xl mb-6 shadow-inner ${
                  isDark ? 'bg-gray-950/40 text-blue-400' : 'bg-gray-100/85 text-blue-600'
                }`}>
                  <div className="relative">
                    <Cpu className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" style={{ animationDuration: '25s' }} />
                    <Database className="w-4 h-4 text-indigo-500 dark:text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Cabecera */}
                <h1 className="text-xl font-bold text-center tracking-tight">Acceso al Sistema</h1>
                <p className="text-[10px] opacity-60 mt-1 mb-8 text-center font-bold uppercase tracking-widest text-blue-500">Ingreso Autorizado</p>

                {/* Input de Clave */}
                <div className="w-full space-y-2 mb-6">
                  <label className="text-xs font-semibold opacity-70 ml-1">Contraseña de acceso</label>
                  <div className="relative w-full">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      placeholder="Ingresa la clave..."
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (loginError) setLoginError(false);
                      }}
                      className={`w-full py-3 pl-4 pr-12 rounded-2xl border text-sm font-semibold transition-all outline-none text-center tracking-widest ${
                        loginError 
                          ? 'border-red-500 bg-red-500/5 focus:ring-2 focus:ring-red-500/20 text-red-500' 
                          : isDark 
                            ? 'border-gray-800 bg-gray-950/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                            : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200`}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginError && (
                    <p className="text-[11px] text-red-500 text-center font-semibold mt-1">Clave incorrecta. Inténtalo de nuevo.</p>
                  )}
                </div>
              </div>

              <div className="w-full space-y-3">
                {/* Botón de Ingreso */}
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-2xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2"
                >
                  Ingresar al Programa
                </button>

                {/* Botón de Solicitar Clave */}
                <button
                  type="button"
                  onClick={() => setIsRequestKeyOpen(true)}
                  className={`w-full py-3 px-4 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    isDark 
                      ? 'border-gray-800 bg-gray-950/20 hover:bg-gray-950/50 text-gray-400 hover:text-gray-200' 
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100/80 text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Key className="w-3.5 h-3.5 text-blue-500" />
                  Solicitar Clave
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Modal de Solicitud de Clave */}
        {isRequestKeyOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300">
            <div className={`relative w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl p-8 flex flex-col items-center text-center transition-all duration-300 transform scale-100 ${
              isDark 
                ? 'bg-gray-950/90 border-blue-500/20 text-gray-100 shadow-blue-500/5' 
                : 'bg-white border-blue-200 text-gray-800 shadow-blue-500/10'
            }`}>
              
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setIsRequestKeyOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-400 hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className={`p-3.5 rounded-2xl mb-5 shadow-inner ${
                isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                <Key className="w-7 h-7" />
              </div>

              <div className="space-y-1 mb-5">
                <span className="text-[10px] font-bold tracking-widest text-blue-500 uppercase">Solicitud de Acceso</span>
                <h3 className="text-lg font-black tracking-tight">
                  Obtener Clave de Acceso
                </h3>
                <p className="text-xs opacity-75 mt-2 leading-relaxed">
                  Por favor ponte en contacto con el desarrollador del aplicativo utilizando los siguientes medios para recibir tu contraseña:
                </p>
              </div>

              {/* Información del Desarrollador */}
              <div className="w-full space-y-3 mb-6 font-sans text-xs">
                <div className={`p-4 rounded-2xl border text-left ${isDark ? 'bg-gray-900/40 border-gray-800/80' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="text-[10px] opacity-40 uppercase font-mono mb-1">Desarrollado por</div>
                  <div className="font-extrabold text-sm">Orlando Arturo Valverde Quiceno</div>
                </div>

                <div className={`p-3 rounded-2xl border flex items-center justify-between group transition-colors ${isDark ? 'bg-gray-900/40 border-gray-800/80 hover:border-blue-500/20' : 'bg-gray-50 border-gray-100 hover:border-blue-200'}`}>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    <span className="opacity-40 text-[10px] uppercase font-mono">Correo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs select-all">vqorlando@gmail.com</span>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('vqorlando@gmail.com');
                        useAppStore.getState().showToast('Correo copiado al portapapeles', 'success');
                      }}
                      className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-blue-500 cursor-pointer"
                      title="Copiar correo"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border flex items-center justify-between group transition-colors ${isDark ? 'bg-gray-900/40 border-gray-800/80 hover:border-blue-500/20' : 'bg-gray-50 border-gray-100 hover:border-blue-200'}`}>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    <span className="opacity-40 text-[10px] uppercase font-mono">Teléfono</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs select-all">+57 316 8226095</span>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('+573168226095');
                        useAppStore.getState().showToast('Teléfono copiado al portapapeles', 'success');
                      }}
                      className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-blue-500 cursor-pointer"
                      title="Copiar teléfono"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a 
                      href="https://wa.me/573168226095" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1 rounded-lg hover:bg-green-500/10 text-green-500 cursor-pointer"
                      title="Escribir por WhatsApp"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRequestKeyOpen(false)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 active:scale-[0.98] cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
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

    // Ctrl+F → Find
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.trigger('keyboard', 'actions.find', null);
    });

    // Ctrl+R → Replace
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => {
      editor.trigger('keyboard', 'editor.action.startFindReplaceAction', null);
    });

    // F4 → Describe selected object or word under cursor
    editor.addCommand(monaco.KeyCode.F4, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (model && selection) {
        const selectedText = model.getValueInRange(selection).trim();
        if (selectedText) {
          triggerDescribeObjectRef.current(selectedText);
        } else {
          const position = editor.getPosition();
          if (position) {
            const word = model.getWordAtPosition(position);
            if (word && word.word) {
              triggerDescribeObjectRef.current(word.word);
            } else {
              useAppStore.getState().showToast("Selecciona el nombre de un objeto primero o coloca el cursor sobre él", "info");
            }
          }
        }
      }
    });

    // Ctrl+B → Remove blank lines
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      const model = editor.getModel();
      if (model) {
        const value = model.getValue();
        const cleaned = value.split('\n').filter((line: string) => line.trim() !== '').join('\n');
        
        editor.executeEdits('remove-blank-lines', [{
          range: model.getFullModelRange(),
          text: cleaned,
          forceMoveMarkers: true
        }]);
        
        useAppStore.getState().showToast('Líneas en blanco eliminadas', 'success');
      }
    });

    // Monaco right-click context menu custom actions for splitting the editor
    editor.addAction({
      id: 'split-editor-vertical',
      label: 'Dividir Pantalla Verticalmente',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.1,
      run: () => {
        handleSplitVerticalRef.current();
      }
    });

    editor.addAction({
      id: 'split-editor-horizontal',
      label: 'Dividir Pantalla Horizontalmente',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.2,
      run: () => {
        handleSplitHorizontalRef.current();
      }
    });

    editor.addAction({
      id: 'unsplit-editor',
      label: 'Volver a estado normal',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.3,
      run: () => {
        handleUnsplitRef.current();
      }
    });
  };

  const handleSecondaryEditorDidMount = (editor: any, monaco: any) => {
    secondaryEditorRef.current = editor;

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

    // Ctrl+F → Find
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.trigger('keyboard', 'actions.find', null);
    });

    // Ctrl+R → Replace
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => {
      editor.trigger('keyboard', 'editor.action.startFindReplaceAction', null);
    });

    // F4 → Describe selected object or word under cursor
    editor.addCommand(monaco.KeyCode.F4, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (model && selection) {
        const selectedText = model.getValueInRange(selection).trim();
        if (selectedText) {
          triggerDescribeObjectRef.current(selectedText);
        } else {
          const position = editor.getPosition();
          if (position) {
            const word = model.getWordAtPosition(position);
            if (word && word.word) {
              triggerDescribeObjectRef.current(word.word);
            } else {
              useAppStore.getState().showToast("Selecciona el nombre de un objeto primero o coloca el cursor sobre él", "info");
            }
          }
        }
      }
    });

    // Ctrl+B → Remove blank lines
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      const model = editor.getModel();
      if (model) {
        const value = model.getValue();
        const cleaned = value.split('\n').filter((line: string) => line.trim() !== '').join('\n');
        
        editor.executeEdits('remove-blank-lines', [{
          range: model.getFullModelRange(),
          text: cleaned,
          forceMoveMarkers: true
        }]);
        
        useAppStore.getState().showToast('Líneas en blanco eliminadas', 'success');
      }
    });

    // Monaco right-click context menu custom actions for splitting the editor
    editor.addAction({
      id: 'split-editor-vertical',
      label: 'Dividir Pantalla Verticalmente',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.1,
      run: () => {
        handleSplitVerticalRef.current();
      }
    });

    editor.addAction({
      id: 'split-editor-horizontal',
      label: 'Dividir Pantalla Horizontalmente',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.2,
      run: () => {
        handleSplitHorizontalRef.current();
      }
    });

    editor.addAction({
      id: 'unsplit-editor',
      label: 'Volver a estado normal',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.3,
      run: () => {
        handleUnsplitRef.current();
      }
    });
  };

  const handleFormat = () => {
    try {
      const targetTab = currentFocusedTab;
      const formatted = format(targetTab.query, formatOptions as any);
      updateTabContent(targetTab.id, formatted);
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
      updateFavoriteSql(activeFavorite.id, currentFocusedTab.query);
      setSaveModal(null);
      useAppStore.getState().showToast(`"${activeFavorite.name}" actualizado`, 'success');
    }
  };

  const handleNewFavoriteConfirm = (name: string, sectionId: string) => {
    addFavoriteFromSql(currentFocusedTab.query, name, sectionId);
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
    
    const editor = getCurrentEditor();
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

    const editor = getCurrentEditor();
    const fullText = editor ? editor.getModel().getValue() : currentFocusedTab.query;
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

    const editor = getCurrentEditor();
    if (!editor) return;

    const selection = editor.getSelection();
    const selectedText = editor.getModel().getValueInRange(selection);
    
    let queryToRun: string;
    if (selectedText && selectedText.trim()) {
      queryToRun = selectedText.trim();
    } else {
      queryToRun = editor.getModel().getValue().trim();
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

  const handleExplainPlan = async () => {
    if (!activeConnection) {
      setError("Selecciona una conexión activa desde el panel lateral.");
      setBottomTab('results');
      return;
    }

    const editor = getCurrentEditor();
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

    const controller = startExecution('statement', queryToRun);

    try {
      const res = await fetch('/api/oracle/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          sql: queryToRun,
          binds: {}
        }),
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Explain plan failed');
      }

      setExplainPlan(data.plan);
      setBottomTab('explain');
      useAppStore.getState().showToast('Plan de ejecución generado', 'success');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setExplainPlan(null);
      setError(err.message);
      setBottomTab('results');
      useAppStore.getState().showToast(`Error al explicar: ${err.message}`, 'error');
    } finally {
      endExecution();
    }
  };

  // Sync ref values on render (when authenticated)
  executeStatementRef.current = handleExecuteStatement;
  executeScriptRef.current = handleExecuteScript;

  // ── Execute single SQL ─────────────────────────────────────────────────────
  const executeSql = async (query: string, binds: Record<string, any>, bindTypes?: Record<string, string>) => {
    // Reset pagination states before execution
    setHasMoreRows(false);
    setCurrentOffset(0);
    setLastExecutedSql(query);
    setLastBinds(binds);
    setLastBindTypes(bindTypes);

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
          enableDbmsOutput,
          offset: 0,
          limit: 200
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

      // If returned rows are exactly 200, there could be more
      const rowCount = data.rows ? data.rows.length : 0;
      setHasMoreRows(rowCount === 200);

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

  const handleLoadMore = async () => {
    if (!activeConnection || !lastExecutedSql || isLoadingMore) return;
    
    setIsLoadingMore(true);
    const nextOffset = currentOffset + 200;
    const controller = new AbortController();

    try {
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          sql: lastExecutedSql,
          binds: lastBinds,
          bindTypes: lastBindTypes,
          enableDbmsOutput: false,
          offset: nextOffset,
          limit: 200
        }),
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load more rows');
      }

      const newRows = data.rows || [];
      
      setResult(prev => {
        if (!prev) return data;
        return {
          ...prev,
          rows: [...prev.rows, ...newRows],
          duration: prev.duration + (data.duration || 0),
          rowCount: prev.rows.length + newRows.length
        };
      });

      setCurrentOffset(nextOffset);
      setHasMoreRows(newRows.length === 200);
      
      useAppStore.getState().showToast(`Se cargaron ${newRows.length} registros más`, 'success');
    } catch (err: any) {
      useAppStore.getState().showToast(`Error al cargar más: ${err.message}`, 'error');
    } finally {
      setIsLoadingMore(false);
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
    const editor = getCurrentEditor();
    if (editor) {
      editor.focus();
      editor.trigger('toolbar', 'undo', null);
    }
  };

  const handleRedo = () => {
    const editor = getCurrentEditor();
    if (editor) {
      editor.focus();
      editor.trigger('toolbar', 'redo', null);
    }
  };

  // ── Clipboard ──────────────────────────────────────────────────────────────
  const handleCut = () => {
    const editor = getCurrentEditor();
    if (editor) {
      editor.focus();
      editor.trigger('toolbar', 'editor.action.clipboardCutAction', null);
    }
  };
  const handleCopy = () => {
    const editor = getCurrentEditor();
    if (editor) {
      editor.focus();
      editor.trigger('toolbar', 'editor.action.clipboardCopyAction', null);
    }
  };
  const handlePaste = async () => {
    const editor = getCurrentEditor();
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

  // Render function for PL/SQL Object Navigator tree nodes
  const renderOutlineNode = (node: OutlineNode, depth: number = 0) => {
    const isFolder = node.type === 'folder' || node.type === 'package' || (node.type === 'subprogram' && node.children && node.children.length > 0);
    const isExpanded = expandedNavigatorNodes[node.id] !== false; // default to expanded
    
    const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedNavigatorNodes(prev => ({
        ...prev,
        [node.id]: !isExpanded
      }));
    };
    
    const handleNodeClick = () => {
      if (node.line) {
        handleGoToErrorLine(node.line, 1);
      }
    };
    
    // Select styling and icons to match the IDE screenshot
    let nodeIcon: React.ReactNode = null;
    if (node.type === 'package') {
      nodeIcon = <Package className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-500 shrink-0" />;
    } else if (node.type === 'folder') {
      nodeIcon = <Folder className="w-3.5 h-3.5 text-yellow-500 shrink-0 fill-yellow-500/20" />;
    } else if (node.type === 'subprogram') {
      nodeIcon = (
        <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-bold text-[11px] font-sans select-none shrink-0 italic">
          P()
        </span>
      );
    } else if (node.type === 'parameter') {
      nodeIcon = (
        <span className="text-blue-500 dark:text-blue-400 font-mono text-[9px] select-none shrink-0 font-semibold leading-none border border-blue-500/20 px-0.5 rounded bg-blue-500/5">
          {`(x,y)`}
        </span>
      );
    } else if (node.type === 'declaration') {
      nodeIcon = (
        <span className="text-blue-500 dark:text-blue-400 font-bold font-mono text-[11px] select-none shrink-0 w-3 text-center border border-blue-500/20 rounded bg-blue-500/5 leading-none">
          i
        </span>
      );
    }
    
    return (
      <div key={node.id} className="select-none w-full">
        <div 
          onClick={handleNodeClick}
          className={`flex items-center gap-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-xs transition-colors w-full ${
            node.type === 'package' ? 'font-semibold font-mono text-gray-800 dark:text-gray-150' : 'text-gray-600 dark:text-gray-300 font-mono'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          {isFolder ? (
            <button 
              onClick={toggleExpand}
              className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors shrink-0"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRight className="w-3 h-3 opacity-60" />}
            </button>
          ) : (
            <div className="w-4 shrink-0" />
          )}
          {nodeIcon}
          <span className="truncate flex-1" title={node.label}>{node.label}</span>
        </div>
        
        {isFolder && isExpanded && node.children && node.children.map(child => renderOutlineNode(child, depth + 1))}
      </div>
    );
  };

  const handleGoToErrorLine = (line: number, position: number) => {
    const editor = getCurrentEditor();
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
          <TbBtn isDark={isDark} icon={<Eraser className={iconSize} />} label="Limpiar" onClick={() => updateTabContent(currentFocusedTab.id, '')} />

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
          <TbBtn
            isDark={isDark}
            icon={isExecuting ? <Loader2 className={`${iconSize} animate-spin`} /> : <Activity className={iconSize} />}
            label="Explain Plan"
            onClick={handleExplainPlan}
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
            variant="primary"
          />
          <TbBtn
            isDark={isDark}
            icon={<GitCompare className={iconSize} />}
            label="Comparar Objetos"
            onClick={() => setIsCompareOpen(true)}
            variant="primary"
          />
          <TbBtn
            isDark={isDark}
            icon={<Database className={iconSize} />}
            label="Copia de Seguridad"
            onClick={() => setIsBackupOpen(true)}
            variant="primary"
          />
          <TbBtn
            isDark={isDark}
            icon={showMetadataPanel ? <EyeOff className={iconSize} /> : <Eye className={iconSize} />}
            label={showMetadataPanel ? "Ocultar Explorador de Tablas" : "Mostrar Explorador de Tablas"}
            onClick={() => setShowMetadataPanel(!showMetadataPanel)}
            active={showMetadataPanel}
            variant="success"
          />
          <TbBtn
            isDark={isDark}
            icon={<HelpCircle className={iconSize} />}
            label="Ayuda"
            onClick={() => setIsHelpOpen(true)}
            variant="default"
          />
          
          {/* DBMS Output toggle (compact) & Log Out Button */}
          <div className="ml-auto flex items-center gap-2">
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

            <TbSep isDark={isDark} />

            <TbBtn
              isDark={isDark}
              icon={<LogOut className={iconSize} />}
              label="Salir"
              onClick={() => {
                logout();
                setPasswordInput('');
                setShowPassword(false);
              }}
              variant="danger"
            />
          </div>
        </div>

        {/* Tabs Bar */}
        <div className={`flex items-center px-2 pt-2 border-b overflow-x-auto custom-scrollbar ${isDark ? 'border-gray-800 bg-gray-900/20' : 'border-gray-200 bg-gray-50'}`}>
          {tabs.map((tab, idx) => {
            const isPrimaryActive = tab.id === activeTab.id;
            const isSecondaryActive = splitMode !== 'none' && tab.id === secondaryActiveTabId;

            let tabClass = '';
            if (isPrimaryActive) {
              tabClass = isDark ? 'bg-gray-950 border-gray-800 text-blue-400 ring-t-2 ring-blue-500/20' : 'bg-white border-gray-200 text-blue-600 ring-t-2 ring-blue-500/10';
            } else if (isSecondaryActive) {
              tabClass = isDark ? 'bg-gray-950 border-gray-800 text-indigo-400 border-dashed ring-t-2 ring-indigo-500/20' : 'bg-white border-gray-200 text-indigo-600 border-dashed ring-t-2 ring-indigo-500/10';
            } else {
              tabClass = isDark ? 'bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-gray-800' : 'bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-gray-200';
            }

            return (
              <div 
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                onContextMenu={(e) => handleTabContextMenu(e, tab)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm border-t border-l border-r rounded-t-lg cursor-pointer max-w-[200px] transition-all relative ${tabClass}`}
              >
                <span className="truncate">{tab.title} {idx + 1}</span>
                
                {splitMode !== 'none' && (isPrimaryActive || isSecondaryActive) && (
                  <span className={`text-[9px] px-1 rounded font-bold shrink-0 ${
                    isPrimaryActive
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {isPrimaryActive 
                      ? (splitMode === 'vertical' ? 'Izq' : 'Sup') 
                      : (splitMode === 'vertical' ? 'Der' : 'Inf')}
                  </span>
                )}

                <button 
                  onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
                  className="p-0.5 rounded-md hover:bg-black/10 opacity-50 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button 
            onClick={() => addTab({ id: crypto.randomUUID(), title: 'Query', query: '' })}
            className="ml-2 p-1 rounded hover:bg-black/10 opacity-60 hover:opacity-100 mb-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className={`border-b border-inherit relative flex flex-row min-h-0 transition-all duration-300 ${
          isBottomPanelMinimized ? 'flex-1' : 'h-[45%]'
        }`}>
          {/* PL/SQL Object Navigator */}
          {plsqlOutline.length > 0 && showNavigator && (
            <div className={`w-64 border-r flex flex-col h-full shrink-0 ${
              isDark ? 'border-gray-800 bg-gray-950 text-gray-200' : 'border-gray-200 bg-white text-gray-800'
            }`}>
              {/* Navigator Header */}
              <div className={`p-2 border-b flex items-center justify-between font-semibold text-[10px] uppercase tracking-wider shrink-0 ${
                isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                <span className="flex items-center gap-1.5 font-bold">
                  <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" /> Navigator
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      if (activeTab?.query) {
                        setPlsqlOutline(generatePlsqlOutline(activeTab.query));
                      }
                    }}
                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-green-500 transition-colors"
                    title="Actualizar navegador"
                  >
                    <RefreshCw className="w-3 h-3 text-green-500" />
                  </button>
                  <button 
                    onClick={() => setShowNavigator(false)}
                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-red-500 transition-colors"
                    title="Cerrar navegador"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              {/* Tree content */}
              <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                {plsqlOutline.map(node => renderOutlineNode(node))}
              </div>
            </div>
          )}

          {/* Navigator Reopen Strip */}
          {plsqlOutline.length > 0 && !showNavigator && (
            <button
              onClick={() => setShowNavigator(true)}
              className={`w-6 h-full flex items-center justify-center border-r hover:bg-black/10 dark:hover:bg-white/5 transition-all text-xs shrink-0 ${
                isDark ? 'border-gray-800 bg-gray-950/40 text-gray-400' : 'border-gray-200 bg-gray-50/40 text-gray-500'
              }`}
              title="Mostrar Navegador de Objeto"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <div className={`flex-1 min-w-0 h-full flex ${
            splitMode === 'vertical' ? 'flex-row' : splitMode === 'horizontal' ? 'flex-col' : ''
          }`}>
            {/* Primary Editor Pane */}
            <div 
              onClick={() => {
                if (splitMode !== 'none') setActiveEditorSide('primary');
              }}
              className={`flex-1 min-w-0 h-full relative transition-all duration-200 ${
                splitMode !== 'none' && activeEditorSide === 'primary'
                  ? 'ring-1 ring-blue-500/40 bg-blue-500/5 dark:bg-blue-500/2'
                  : ''
              }`}
            >
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
              {/* Active Indicator Bar */}
              {splitMode !== 'none' && activeEditorSide === 'primary' && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10 animate-fade-in" />
              )}
            </div>

            {/* Split Separator Line */}
            {splitMode !== 'none' && (
              <div className={`shrink-0 bg-gray-200 dark:bg-gray-800 transition-colors ${
                splitMode === 'vertical' ? 'w-[2px] h-full' : 'h-[2px] w-full'
              }`} />
            )}

            {/* Secondary Editor Pane */}
            {splitMode !== 'none' && (
              <div 
                onClick={() => setActiveEditorSide('secondary')}
                className={`flex-1 min-w-0 h-full relative transition-all duration-200 ${
                  activeEditorSide === 'secondary'
                    ? 'ring-1 ring-indigo-500/40 bg-indigo-500/5 dark:bg-indigo-500/2'
                    : ''
                }`}
              >
                <Editor
                  height="100%"
                  defaultLanguage="sql"
                  theme={isDark ? 'vs-dark' : 'light'}
                  value={secondaryActiveTab.query}
                  onChange={(val) => updateTabContent(secondaryActiveTab.id, val || '')}
                  onMount={handleSecondaryEditorDidMount}
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
                {/* Active Indicator Bar */}
                {activeEditorSide === 'secondary' && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 z-10 animate-fade-in" />
                )}
              </div>
            )}
          </div>

          {showMetadataPanel && (
            <div className={`w-80 border-l flex flex-col h-full shrink-0 ${
              isDark ? 'border-gray-800 bg-gray-950 text-gray-250' : 'border-gray-200 bg-white text-gray-800'
            }`}>
              {/* Panel Header */}
              <div className={`p-2 border-b flex items-center justify-between font-semibold text-[10px] uppercase tracking-wider ${
                isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                <span className="flex items-center gap-1.5 font-bold">
                  <Database className="w-3.5 h-3.5 text-blue-500" /> Explorador de Tablas
                </span>
                <button 
                  onClick={() => setShowMetadataPanel(false)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-red-500 transition-colors"
                  title="Ocultar explorador"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Schema Selector */}
              <div className="p-2 border-b flex flex-col gap-1 shrink-0">
                <label className="text-[9px] font-bold opacity-60 uppercase">Esquema</label>
                <select
                  value={metadataSchema}
                  onChange={(e) => setMetadataSchema(e.target.value)}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  className={`w-full px-2 py-1 rounded border text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                    isDark 
                      ? 'bg-gray-900 border-gray-800 text-gray-200 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 text-gray-850 focus:ring-blue-500'
                  }`}
                >
                  {isLoadingMetadataSchemas ? (
                    <option value="">Cargando esquemas...</option>
                  ) : (
                    metadataSchemas.map(sch => (
                      <option key={sch} value={sch} className={isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800'}>
                        {sch}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Tables & Columns Container */}
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Tables List */}
                <div className="flex-1 min-h-0 flex flex-col border-b border-inherit">
                  <div className="p-2 pb-0.5 flex flex-col gap-1 shrink-0">
                    <label className="text-[9px] font-bold opacity-60 uppercase flex justify-between">
                      <span>Tablas ({filteredTables.length})</span>
                      <span className="normal-case opacity-45 font-normal">Doble clic para pegar</span>
                    </label>
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Filtrar tablas..."
                      className={`w-full px-2 py-0.5 rounded border text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-transparent ${
                        isDark ? 'border-gray-800 text-gray-250' : 'border-gray-300 text-gray-800'
                      }`}
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto px-2 py-1.5 custom-scrollbar space-y-0.5">
                    {isLoadingMetadataTables ? (
                      <div className="text-center py-4 text-xs opacity-50 flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Cargando...
                      </div>
                    ) : filteredTables.length > 0 ? (
                      filteredTables.map(tbl => (
                        <div
                          key={tbl}
                          onClick={() => setMetadataTable(tbl)}
                          onDoubleClick={() => insertTextAtCursor(tbl.toLowerCase())}
                          className={`px-1.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors truncate select-none ${
                            metadataTable === tbl
                              ? (isDark ? 'bg-blue-500/15 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-600 font-semibold')
                              : (isDark ? 'hover:bg-gray-900 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
                          }`}
                          title={`${tbl} (Doble clic para pegar)`}
                        >
                          📊 {tbl}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-xs opacity-40 italic">Ninguna tabla</div>
                    )}
                  </div>
                </div>

                {/* Resizable Divider */}
                <div 
                  className={`h-1.5 cursor-row-resize hover:bg-blue-500/50 transition-colors shrink-0 ${
                    isDark ? 'bg-gray-800' : 'bg-gray-200'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const startHeight = columnsPanelHeight;
                    
                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const deltaY = moveEvent.clientY - startY;
                      const newHeight = Math.max(80, Math.min(500, startHeight - deltaY));
                      setColumnsPanelHeight(newHeight);
                    };
                    
                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                    };
                    
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                  }}
                  title="Arrastra para cambiar la altura del panel de columnas"
                />

                {/* Columns List */}
                <div 
                  style={{ height: `${columnsPanelHeight}px` }}
                  className="min-h-0 flex flex-col shrink-0"
                >
                  <div className="p-2 pb-0.5 shrink-0">
                    <label className="text-[9px] font-bold opacity-60 uppercase flex justify-between">
                      <span>Columnas {metadataTable && `de ${metadataTable}`}</span>
                      <span className="normal-case opacity-45 font-normal">Clic para pegar</span>
                    </label>
                  </div>

                  <div className="flex-1 overflow-y-auto px-2 py-1 custom-scrollbar space-y-0.5">
                    {!metadataTable ? (
                      <div className="text-center py-6 text-[11px] opacity-40 italic">Selecciona una tabla</div>
                    ) : isLoadingMetadataColumns ? (
                      <div className="text-center py-6 text-[11px] opacity-50 flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Cargando...
                      </div>
                    ) : metadataColumns.length > 0 ? (
                      metadataColumns.map(col => (
                        <div
                          key={col.columnName}
                          onClick={() => insertTextAtCursor(col.columnName.toLowerCase())}
                          className={`px-1.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors flex justify-between items-center ${
                            isDark ? 'hover:bg-gray-900 text-gray-350' : 'hover:bg-gray-100 text-gray-700'
                          }`}
                          title={`Clic para pegar ${col.columnName}`}
                        >
                          <span className="truncate font-semibold text-blue-500/80 dark:text-blue-400/80">{col.columnName}</span>
                          <span className="text-[9px] opacity-50 shrink-0 font-normal pl-1.5">{col.dataType}{!col.nullable && '*'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-[11px] opacity-40 italic">Sin columnas</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`flex flex-col min-h-0 bg-opacity-50 transition-all duration-300 ${
          isBottomPanelMinimized ? 'h-10 shrink-0 overflow-hidden' : 'flex-1'
        } ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <div className={`px-2 flex items-center gap-1 border-b border-inherit ${isDark ? 'bg-gray-800/80' : 'bg-gray-200/50'}`}>
            <button 
              onClick={() => { setBottomTab('results'); setIsBottomPanelMinimized(false); }}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${bottomTab === 'results' ? 'border-blue-500 text-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <div className="flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Results</div>
            </button>
            <button 
              onClick={() => { setBottomTab('dbms'); setIsBottomPanelMinimized(false); }}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${bottomTab === 'dbms' ? 'border-blue-500 text-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <div className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> DBMS Output</div>
            </button>
            <button 
              onClick={() => { setBottomTab('errors'); setIsBottomPanelMinimized(false); }}
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
            <button 
              onClick={() => { setBottomTab('explain'); setIsBottomPanelMinimized(false); }}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${bottomTab === 'explain' ? 'border-blue-500 text-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-blue-500" /> 
                Explain Plan
              </div>
            </button>

            <div className="ml-auto flex items-center gap-2 pr-2">
              {result && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-green-500"><CheckCircle className="w-3.5 h-3.5" /> Success</span>
                  <span className="flex items-center gap-1 opacity-70"><Clock className="w-3.5 h-3.5" /> {result.duration}ms</span>
                  <span className="flex items-center gap-1 opacity-70"><Database className="w-3.5 h-3.5" /> {result.rowCount} rows</span>
                </div>
              )}
              
              <button
                onClick={() => setIsBottomPanelMinimized(!isBottomPanelMinimized)}
                className={`p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                  isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                }`}
                title={isBottomPanelMinimized ? "Restablecer espacio" : "Minimizar panel"}
              >
                {isBottomPanelMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
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
                  <ResultsTable 
                    data={result.rows} 
                    columns={result.columns} 
                    sql={activeTab.query} 
                    hasMore={hasMoreRows}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={handleLoadMore}
                  />
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

            {bottomTab === 'explain' && (
              <div className="h-full flex flex-col overflow-hidden">
                <div className={`p-2 border-b flex justify-between items-center ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className="text-sm opacity-70">Plan de Ejecución (EXPLAIN PLAN)</span>
                  {explainPlan && (
                    <button 
                      onClick={() => setExplainPlan(null)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-500 flex items-center gap-1 text-xs font-medium"
                      title="Limpiar Plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Limpiar Plan
                    </button>
                  )}
                </div>
                <div className="flex-1 p-4 overflow-auto custom-scrollbar font-mono text-xs whitespace-pre select-text">
                  {explainPlan ? (
                    <div className={`p-3 rounded-lg border leading-relaxed ${
                      isDark ? 'bg-gray-950/40 border-gray-800 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}>
                      {explainPlan}
                    </div>
                  ) : (
                    <div className="opacity-30 italic text-center mt-10">No hay un plan de ejecución cargado. Haz clic en &apos;Explain Plan&apos; en la barra de herramientas.</div>
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
        inactivityEnabled={inactivityTimeoutEnabled}
        inactivityMinutes={inactivityTimeoutMinutes}
        onSave={(days, inactivityEnabled, inactivityMinutes) => {
          setHistoryRetentionDays(days);
          setInactivitySettings(inactivityEnabled, inactivityMinutes);
          useAppStore.getState().showToast('Configuraciones guardadas', 'success');
        }}
        onPurge={() => {
          purgeExpiredHistory();
          useAppStore.getState().showToast('Historial expirado eliminado', 'success');
        }}
        onClearAll={() => {
          useAppStore.getState().clearHistory();
          useAppStore.getState().showToast('Todo el historial ha sido eliminado', 'info');
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
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border backdrop-blur-md bg-opacity-90 transition-all duration-300 transform translate-y-0 animate-bounce-short"
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
      <CompareObjectsModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        isDark={isDark}
        connections={connections}
        activeConnection={activeConnection}
        showToast={showToast}
      />
      <DescribeObjectModal
        isOpen={isDescribeOpen}
        onClose={() => setIsDescribeOpen(false)}
        isDark={isDark}
        activeConnection={activeConnection}
        objectName={describeObjectName}
        showToast={showToast}
      />
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        activeConnection={activeConnection}
        schema={metadataSchema}
        schemas={metadataSchemas}
        isDark={isDark}
        showToast={showToast}
      />
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        isDark={isDark}
      />

      {/* Menu contextual para pestañas */}
      {tabContextMenu && (
        <div 
          className="fixed z-[700] rounded-xl shadow-2xl border p-1 w-48 animate-fade-in backdrop-blur-md"
          style={{ 
            top: tabContextMenu.y, 
            left: tabContextMenu.x,
            backgroundColor: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? 'rgba(31, 41, 55, 0.8)' : 'rgba(229, 231, 235, 0.8)'
          }}
        >
          <button
            onClick={() => {
              handleCloseTab(tabContextMenu.tab.id);
              setTabContextMenu(null);
            }}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${
              isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            Cerrar Tab
          </button>
          <button
            onClick={() => {
              handleCloseOtherTabs(tabContextMenu.tab.id);
              setTabContextMenu(null);
            }}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${
              isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Cerrar los Otros Tabs
          </button>
          <button
            onClick={() => {
              handleCloseAllTabs();
              setTabContextMenu(null);
            }}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${
              isDark ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-600'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Cerrar Todos los Tabs
          </button>
        </div>
      )}

      {/* Modal confirmacion guardar favorito modificado al cerrar */}
      {currentTabToConfirm && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 ${
            isDark ? 'bg-gray-900 border-gray-700 text-gray-200 shadow-black/80' : 'bg-white border-gray-200 text-gray-800 shadow-gray-400/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-yellow-500/15">
                <BookmarkCheck className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">Guardar cambios</h2>
                <p className="text-xs opacity-50">El favorito ha sido modificado</p>
              </div>
            </div>
            <p className="text-sm">
              ¿Deseas guardar los cambios del favorito <span className="font-semibold text-yellow-400">
                {favorites.find(f => f.id === currentTabToConfirm.favoriteId)?.name || 'Favorito'}
              </span> antes de cerrar el tab?
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (currentTabToConfirm.favoriteId) {
                      updateFavoriteSql(currentTabToConfirm.favoriteId, currentTabToConfirm.query);
                      showToast('Favorito guardado exitosamente', 'success');
                    }
                    removeTab(currentTabToConfirm.id);
                    const remaining = tabsQueueToClose.slice(1);
                    setTabsQueueToClose(remaining);
                    processNextInCloseQueue(remaining);
                  }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-md"
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeTab(currentTabToConfirm.id);
                    const remaining = tabsQueueToClose.slice(1);
                    setTabsQueueToClose(remaining);
                    processNextInCloseQueue(remaining);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm border font-semibold transition-colors cursor-pointer ${
                    isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  No
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTabsQueueToClose([]);
                  setCurrentTabToConfirm(null);
                }}
                className={`w-full py-2 rounded-lg text-sm border font-semibold transition-colors cursor-pointer ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
