"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAppStore, VARIOS_SECTION_ID } from '@/store/useAppStore';
import {
  Database, History, Star, Plus, Trash2, Edit2, Settings2,
  CheckCircle, Eye, Download, X, Copy, StarOff,
  FolderOpen, Folder, Clock, CloudDownload, CloudUpload,
  ChevronRight, ChevronDown, ChevronUp, Table, Code, Zap, Package, RefreshCw, Search, Play, Hammer, AlertTriangle,
  Hash, User, Shield, Link, Settings, FileText, Info
} from 'lucide-react';
import { Connection } from '@/types';
import ConnectionModal from './ConnectionModal';
import FavoriteNameModal from './FavoriteNameModal';
import FavoriteSyncModal from './FavoriteSyncModal';
import SqlInstructionsModal from './SqlInstructionsModal';
import { saveAs } from 'file-saver';
import Editor from '@monaco-editor/react';
import { ORLANDO_IMAGE_BASE64 } from '@/constants/orlandoImage';


// ─── Metadata for Oracle object types ───────────────────────────────────────
const OBJECT_TYPE_METADATA: Record<string, { label: string; icon: any; color: string }> = {
  'TABLE': { label: 'Tablas', icon: Table, color: 'text-blue-400' },
  'VIEW': { label: 'Vistas', icon: Eye, color: 'text-green-400' },
  'MATERIALIZED VIEW': { label: 'Vistas Materializadas', icon: Eye, color: 'text-teal-400' },
  'INDEX': { label: 'Índices', icon: Search, color: 'text-purple-400' },
  'SEQUENCE': { label: 'Secuencias', icon: Hash, color: 'text-yellow-500' },
  'SYNONYM': { label: 'Sinónimos', icon: Copy, color: 'text-indigo-400' },
  'PROCEDURE': { label: 'Procedimientos', icon: Play, color: 'text-orange-400' },
  'FUNCTION': { label: 'Funciones', icon: Code, color: 'text-pink-400' },
  'PACKAGE': { label: 'Paquetes', icon: Package, color: 'text-purple-400' },
  'TRIGGER': { label: 'Triggers', icon: Zap, color: 'text-yellow-400' },
  'TYPE': { label: 'Tipos', icon: Settings, color: 'text-cyan-400' },
  'DATABASE LINK': { label: 'Database Links', icon: Database, color: 'text-blue-300' },
  'DIRECTORY': { label: 'Directorios', icon: FolderOpen, color: 'text-yellow-600' },
  'JOB': { label: 'Jobs', icon: Clock, color: 'text-red-400' },
  'USER': { label: 'Usuarios', icon: User, color: 'text-emerald-400' },
  'ROLE': { label: 'Roles', icon: Shield, color: 'text-sky-400' },
  'TABLESPACE': { label: 'Tablespaces', icon: Database, color: 'text-gray-400' },
  'PROFILE': { label: 'Perfiles', icon: Shield, color: 'text-zinc-400' },
  'DATAFILE': { label: 'Datafiles', icon: FileText, color: 'text-gray-500' }
};

const ALL_ORACLE_OBJECT_TYPES = [
  'TABLE', 'VIEW', 'MATERIALIZED VIEW', 'INDEX', 'SEQUENCE', 'SYNONYM',
  'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER', 'TYPE', 'TYPE BODY',
  'DATABASE LINK', 'DIRECTORY', 'CLUSTER', 'TABLE PARTITION', 'INDEX PARTITION', 'LOB',
  'JAVA SOURCE', 'JAVA CLASS', 'JAVA RESOURCE', 'LIBRARY', 'OPERATOR', 'CONTEXT',
  'DIMENSION', 'OUTLINE', 'QUEUE', 'QUEUE TABLE', 'JOB', 'SCHEDULE', 'PROGRAM',
  'CHAIN', 'RULE SET', 'EVALUATION CONTEXT', 'XML SCHEMA', 'XMLTYPE TABLE', 'MINING MODEL',
  'EDITION', 'FLASHBACK ARCHIVE', 'ANALYTIC VIEW', 'ATTRIBUTE DIMENSION', 'HIERARCHY',
  'SQL TRANSLATION PROFILE', 'LOCKDOWN PROFILE', 'ROLE', 'USER', 'PROFILE', 'TABLESPACE',
  'DATAFILE', 'CONTROL FILE', 'REDO LOG', 'UNDO SEGMENT', 'TEMPORARY TABLE',
  'GLOBAL TEMPORARY TABLE', 'EXTERNAL TABLE', 'NESTED TABLE', 'OBJECT TABLE',
  'INDEX ORGANIZED TABLE', 'BITMAP INDEX', 'FUNCTION-BASED INDEX', 'DOMAIN INDEX',
  'PARTITIONED TABLE', 'PARTITIONED INDEX', 'SUBPARTITION', 'MATERIALIZED VIEW LOG',
  'SNAPSHOT LOG', 'RESOURCE PLAN', 'CONSUMER GROUP', 'CREDENTIAL', 'WALLET', 'PFILE',
  'SPFILE', 'RESTORE POINT', 'AUDIT POLICY', 'UNIFIED AUDIT POLICY', 'VECTOR INDEX',
  'PROPERTY GRAPH', 'JSON RELATIONAL DUALITY VIEW', 'BLOCKCHAIN TABLE', 'IMMUTABLE TABLE'
];

const getTypeMetadata = (type: string) => {
  const meta = OBJECT_TYPE_METADATA[type];
  if (meta) return meta;
  
  const label = type
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') + 's';
    
  return {
    label,
    icon: FolderOpen,
    color: 'text-gray-400'
  };
};

// ─── Sidebar principal ────────────────────────────────────────────────────────
export default function Sidebar() {
  const {
    connections, activeConnectionId, setActiveConnection, removeConnection,
    history, removeHistory,
    favorites, favoriteSections, addFavorite, removeFavorite, runFavorite, addFavoriteSection, removeFavoriteSection, clearAllFavorites,
    toggleTheme, isDark, addTab, tabs, activeTabId, setActiveTab, showToast,
    loadFavoritesFromDb, saveFavoritesToDb, deleteFavoriteFromDb, updateTabContent,
    visibleObjectTypes, setVisibleObjectTypes,
  } = useAppStore();

  const [tab, setTab] = useState<'connections' | 'schema' | 'history' | 'favorites'>('connections');
  const [isConnModalOpen, setConnModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [expandedFavSections, setExpandedFavSections] = useState<Record<string, boolean>>({});
  const [hoveredFav, setHoveredFav] = useState<any>(null);
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);
  const [deleteSectionsCheckbox, setDeleteSectionsCheckbox] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [favSearchQuery, setFavSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);

  // Memoized list of matching sections or favorites
  const matchedFavItems = useMemo(() => {
    if (!favSearchQuery.trim()) return [];
    const query = favSearchQuery.toLowerCase();
    const list: Array<{ type: 'section' | 'favorite'; id: string; parentId?: string }> = [];
    
    favoriteSections.forEach(sec => {
      const secMatch = sec.name.toLowerCase().includes(query);
      if (secMatch) {
        list.push({ type: 'section', id: sec.id });
      }
      
      const secFavs = favorites.filter(f => f.sectionId === sec.id);
      secFavs.forEach(fav => {
        if (fav.name.toLowerCase().includes(query)) {
          list.push({ type: 'favorite', id: fav.id, parentId: sec.id });
        }
      });
    });
    
    return list;
  }, [favSearchQuery, favoriteSections, favorites]);

  // Reset active match index when query or matches change
  useEffect(() => {
    if (matchedFavItems.length > 0) {
      setActiveMatchIndex(0);
    } else {
      setActiveMatchIndex(-1);
    }
  }, [favSearchQuery, matchedFavItems]);

  // Auto-expand and scroll to active search match
  useEffect(() => {
    if (activeMatchIndex >= 0 && activeMatchIndex < matchedFavItems.length) {
      const activeItem = matchedFavItems[activeMatchIndex];
      
      // Auto-expand parent section if it's a favorite child
      if (activeItem.type === 'favorite' && activeItem.parentId) {
        setExpandedFavSections(prev => ({
          ...prev,
          [activeItem.parentId!]: true
        }));
      }

      // Scroll the highlighted element into view
      const timer = setTimeout(() => {
        const elementId = `fav-tree-node-${activeItem.type}-${activeItem.id}`;
        const el = document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 80);

      return () => clearTimeout(timer);
    }
  }, [activeMatchIndex, matchedFavItems]);

  // States for database objects
  const [objects, setObjects] = useState<any>(null);
  const [isLoadingObjects, setIsLoadingObjects] = useState(false);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [objectSearch, setObjectSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  
  const [isSelectObjectsModalOpen, setSelectObjectsModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState('');
  const [tempSelectedTypes, setTempSelectedTypes] = useState<string[]>([]);
  const [isAboutModalOpen, setAboutModalOpen] = useState(false);

  useEffect(() => {
    if (isSelectObjectsModalOpen) {
      setTempSelectedTypes(visibleObjectTypes || []);
      setModalFilter('');
    }
  }, [isSelectObjectsModalOpen, visibleObjectTypes]);

  const filteredModalTypes = ALL_ORACLE_OBJECT_TYPES.filter(type => {
    if (!modalFilter) return true;
    const q = modalFilter.toLowerCase();
    const meta = getTypeMetadata(type);
    return type.toLowerCase().includes(q) || meta.label.toLowerCase().includes(q);
  });
  
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    name: string;
    type: string;
    status: string;
  } | null>(null);
  const [compileErrorsModal, setCompileErrorsModal] = useState<{
    name: string;
    type: string;
    errors: { line: number; position: number; text: string }[];
  } | null>(null);
  const [deleteObjectModal, setDeleteObjectModal] = useState<{
    name: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const activeConnection = connections.find(c => c.id === activeConnectionId);

  const fetchObjects = async () => {
    if (!activeConnection) return;
    setIsLoadingObjects(true);
    try {
      const res = await fetch('/api/oracle/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection: activeConnection })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener objetos');
      setObjects(data.objects);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoadingObjects(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, name: string, type: string, status: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      name,
      type,
      status
    });
  };

  const handleCompileObject = async (name: string, type: string) => {
    if (!activeConnection) return;
    
    let compileSql = '';
    const upperType = type.toUpperCase();
    if (upperType === 'PACKAGE BODY') {
      compileSql = `ALTER PACKAGE "${name}" COMPILE BODY`;
    } else if (upperType === 'PACKAGE') {
      compileSql = `ALTER PACKAGE "${name}" COMPILE`;
    } else {
      compileSql = `ALTER ${upperType} "${name}" COMPILE`;
    }
    
    showToast(`Compilando ${type} ${name}...`, 'info');
    try {
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          sql: compileSql
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de compilación');
      
      // Check if there are compilation errors in user_errors
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
          binds: { name: name, type: upperType }
        })
      });
      const errData = await errRes.json();
      if (errRes.ok && errData.rows && errData.rows.length > 0) {
        const errors = errData.rows.map((row: any) => ({
          line: row.LINE || row.line || 0,
          position: row.POSITION || row.position || 0,
          text: row.TEXT || row.text || ''
        }));
        
        setCompileErrorsModal({
          name,
          type,
          errors
        });
        
        showToast(`Compilado con errores en ${name}`, 'error');
      } else {
        showToast(`${type} ${name} compilado exitosamente ✓`, 'success');
      }
      
      fetchObjects();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteObject = async (name: string, type: string) => {
    if (!activeConnection) return;
    
    let dropSql = '';
    const upperType = type.toUpperCase();
    if (upperType === 'PACKAGE BODY') {
      dropSql = `DROP PACKAGE BODY "${name}"`;
    } else {
      dropSql = `DROP ${upperType} "${name}"`;
    }
    
    try {
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          sql: dropSql
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar el objeto');
      
      showToast(`${type} ${name} eliminado exitosamente`, 'success');
      setDeleteObjectModal(null);
      fetchObjects();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveObjectToFile = async (name: string, type: string) => {
    if (!activeConnection) return;
    showToast(`Obteniendo definición de ${name}...`, 'info');
    try {
      const res = await fetch('/api/oracle/object-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          name,
          type
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener código fuente');
      
      const blob = new Blob([data.source], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `${name}_${type.replace(/\s+/g, '_')}.sql`);
      showToast(`Archivo guardado exitosamente`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (tab === 'schema' && activeConnectionId) {
      fetchObjects();
    } else if (!activeConnectionId) {
      setObjects(null);
    }
  }, [tab, activeConnectionId]);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const handleObjectDoubleClick = async (name: string, type: string) => {
    if (!activeConnection) return;
    setIsLoadingSource(true);
    try {
      const res = await fetch('/api/oracle/object-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          name,
          type
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener código fuente');
      
      const titleName = `${name} (${type})`;
      const existing = tabs.find(t => t.title === titleName);
      if (existing) {
        updateTabContent(existing.id, data.source);
        setActiveTab(existing.id);
      } else {
        addTab({
          id: crypto.randomUUID(),
          title: titleName,
          query: data.source
        });
      }
      showToast(`Objeto ${name} cargado en el editor`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoadingSource(false);
    }
  };

  const filterObjects = (list: { name: string; status: string }[] | undefined) => {
    if (!list) return [];
    if (!objectSearch) return list;
    const q = objectSearch.toLowerCase();
    return list.filter(item => item.name.toLowerCase().includes(q));
  };

  const renderFolder = (
    label: string,
    key: string,
    list: { name: string; status: string }[] | undefined,
    icon: React.ReactNode,
    defaultType: string
  ) => {
    const isExpanded = !!expandedFolders[key];
    const filtered = filterObjects(list);
    const count = list ? list.length : 0;
    
    if (count === 0) return null;
    if (objectSearch && filtered.length === 0) return null;

    return (
      <div key={key} className="space-y-0.5">
        <div
          onClick={() => toggleFolder(key)}
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
            isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-200/50'
          }`}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
          <span className="font-sans font-semibold text-xs flex-1 truncate">{label}</span>
          <span className={`text-[10px] px-1.5 rounded-full ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
            {count}
          </span>
        </div>
        
        {isExpanded && (
          <div className="pl-4 space-y-0.5 border-l border-gray-500/10 ml-2">
            {filtered.map((item) => {
              let actualName = item.name;
              let actualType = defaultType;
              const isInvalid = item.status === 'INVALID';
              if (defaultType === 'PACKAGE' && item.name.endsWith(' (BODY)')) {
                actualName = item.name.replace(' (BODY)', '');
                actualType = 'PACKAGE BODY';
              }

              return (
                <div
                  key={item.name}
                  onDoubleClick={() => handleObjectDoubleClick(actualName, actualType)}
                  onContextMenu={(e) => handleContextMenu(e, actualName, actualType, item.status)}
                  className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer transition-colors ${
                    isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                  } ${isInvalid ? 'text-red-500 dark:text-red-400 font-semibold' : ''}`}
                  title={`${item.name} (${item.status === 'INVALID' ? 'Inválido / Descompilado' : 'Válido'})\nDoble clic para cargar en el editor. Clic derecho para opciones.`}
                >
                  {icon}
                  <span className="truncate flex-1" style={{ fontSize: '11px' }}>{item.name}</span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-[10px] opacity-40 py-1 pl-2 italic">Sin resultados</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const togglePackage = (pkgName: string) => {
    setExpandedPackages(prev => ({
      ...prev,
      [pkgName]: !prev[pkgName]
    }));
  };

  const renderPackagesFolder = (
    specs: { name: string; status: string }[] | undefined,
    bodies: { name: string; status: string }[] | undefined
  ) => {
    const isExpanded = !!expandedFolders.PACKAGE;
    const uniquePkgs = Array.from(new Set([
      ...(specs || []).map(s => s.name),
      ...(bodies || []).map(b => b.name)
    ])).sort();
    
    // Filter packages by search query
    const filtered = uniquePkgs.filter(pkg => 
      !objectSearch || pkg.toLowerCase().includes(objectSearch.toLowerCase())
    );

    const count = uniquePkgs.length;
    if (count === 0) return null;
    if (objectSearch && filtered.length === 0) return null;

    return (
      <div key="PACKAGE" className="space-y-0.5">
        {/* Main Packages Folder */}
        <div
          onClick={() => toggleFolder('PACKAGE')}
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
            isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-200/50'
          }`}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
          <span className="font-sans font-semibold text-xs flex-1 truncate">Paquetes</span>
          <span className={`text-[10px] px-1.5 rounded-full ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
            {count}
          </span>
        </div>

        {isExpanded && (
          <div className="pl-4 space-y-0.5 border-l border-gray-500/10 ml-2">
            {filtered.map((pkg) => {
              const isPkgExpanded = !!expandedPackages[pkg];
              const specObj = specs?.find(s => s.name === pkg);
              const bodyObj = bodies?.find(b => b.name === pkg);
              const hasSpec = !!specObj;
              const hasBody = !!bodyObj;

              const isSpecInvalid = specObj?.status === 'INVALID';
              const isBodyInvalid = bodyObj?.status === 'INVALID';

              return (
                <div key={pkg} className="space-y-0.5">
                  {/* Package Node */}
                  <div
                    onClick={() => togglePackage(pkg)}
                    className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer transition-colors ${
                      isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {isPkgExpanded ? (
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    ) : (
                      <ChevronRight className="w-3 h-3 opacity-60" />
                    )}
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                    <span className="truncate flex-1" style={{ fontSize: '11px' }}>{pkg}</span>
                  </div>

                  {/* Subnodes: Spec & Body */}
                  {isPkgExpanded && (
                    <div className="pl-4 space-y-0.5 border-l border-gray-500/10 ml-1.5">
                      {hasSpec && (
                        <div
                          onDoubleClick={() => handleObjectDoubleClick(pkg, 'PACKAGE')}
                          onContextMenu={(e) => handleContextMenu(e, pkg, 'PACKAGE', specObj?.status || 'VALID')}
                          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md cursor-pointer transition-colors ${
                            isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                          } ${isSpecInvalid ? 'text-red-500 dark:text-red-400 font-semibold' : ''}`}
                          title={`Especificación (${specObj?.status === 'INVALID' ? 'Inválido' : 'Válido'})\nDoble clic para cargar Especificación en el editor. Clic derecho para opciones.`}
                        >
                          <Code className="w-3 h-3 text-purple-300" />
                          <span style={{ fontSize: '10px' }}>Especificación</span>
                        </div>
                      )}
                      {hasBody && (
                        <div
                          onDoubleClick={() => handleObjectDoubleClick(pkg, 'PACKAGE BODY')}
                          onContextMenu={(e) => handleContextMenu(e, pkg, 'PACKAGE BODY', bodyObj?.status || 'VALID')}
                          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md cursor-pointer transition-colors ${
                            isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                          } ${isBodyInvalid ? 'text-red-500 dark:text-red-400 font-semibold' : ''}`}
                          title={`Cuerpo (${bodyObj?.status === 'INVALID' ? 'Inválido' : 'Válido'})\nDoble clic para cargar Cuerpo en el editor. Clic derecho para opciones.`}
                        >
                          <Code className="w-3 h-3 text-purple-500" />
                          <span style={{ fontSize: '10px' }}>Cuerpo (Body)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-[10px] opacity-40 py-1 pl-2 italic">Sin resultados</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [sqlModal, setSqlModal] = useState<{
    isOpen: boolean;
    sql: string;
    id?: string;
    dbId?: number;
    sectionName?: string;
    name?: string;
  }>({ isOpen: false, sql: '' });
  const [favModal, setFavModal] = useState<{ isOpen: boolean; historyId: string }>({ isOpen: false, historyId: '' });
  const [syncModal, setSyncModal] = useState<{
    isOpen: boolean;
    mode: 'save' | 'load';
    dbFavorites?: any[];
    dbSections?: any[];
  } | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    favoriteId: string;
    dbId?: number;
    name: string;
  } | null>(null);
  const [isDeletingFromDb, setIsDeletingFromDb] = useState(false);
  const [showSqlInstructions, setShowSqlInstructions] = useState(false);

  const handleSaveFavoritesToDb = () => {
    if (!activeConnection) {
      showToast('Selecciona una conexión activa primero.', 'error');
      return;
    }
    if (favorites.length === 0) {
      showToast('No tienes favoritos locales para guardar.', 'info');
      return;
    }
    setSyncModal({
      isOpen: true,
      mode: 'save'
    });
  };

  const handleConfirmSave = async (selectedIds: string[]) => {
    if (!activeConnection) return;
    try {
      await saveFavoritesToDb(activeConnection, selectedIds);
      showToast('Favoritos guardados en la BD con éxito.', 'success');
      setSyncModal(null);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Error al guardar favoritos en la BD';
      showToast(msg, 'error');
      // Si el error es de tablas inexistentes, abrir el modal con instrucciones SQL
      if (msg.includes('tablas.sql') || msg.includes('ORA-00942')) {
        setShowSqlInstructions(true);
      }
      throw err;
    }
  };

  const handleLoadFavoritesFromDb = async () => {
    if (!activeConnection) {
      showToast('Selecciona una conexión activa primero.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      // 1. Fetch DB sections
      const secRes = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          sql: 'SELECT id, name FROM TKR_FAVORITOS_SECCIONES ORDER BY id'
        })
      });

      if (!secRes.ok) {
        const errData = await secRes.json();
        if (errData.error?.includes('ORA-00942')) {
          throw new Error('Las tablas de favoritos (TKR_FAVORITOS) no existen en la base de datos. Ejecuta el script "tablas.sql" para crearlas.');
        }
        throw new Error(errData.error || 'Error al cargar secciones de favoritos de la base de datos.');
      }
      const secData = await secRes.json();

      // 2. Fetch DB favorites
      const favRes = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          sql: 'SELECT id, name, sql_query, seccion_id, created_at, last_run_at FROM TKR_FAVORITOS ORDER BY id'
        })
      });

      if (!favRes.ok) {
        const errData = await favRes.json();
        throw new Error(errData.error || 'Error al cargar favoritos de la base de datos.');
      }
      const favData = await favRes.json();

      const dbSections = secData.rows || [];
      const dbFavorites = favData.rows || [];

      if (dbFavorites.length === 0) {
        showToast('No hay favoritos guardados en la base de datos.', 'info');
        return;
      }

      setSyncModal({
        isOpen: true,
        mode: 'load',
        dbFavorites,
        dbSections
      });
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Error al cargar favoritos de la BD';
      showToast(msg, 'error');
      // Si el error es de tablas inexistentes, abrir el modal con instrucciones SQL
      if (msg.includes('tablas.sql') || msg.includes('ORA-00942')) {
        setShowSqlInstructions(true);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmLoad = async (selectedIds: number[]) => {
    if (!activeConnection) return;
    try {
      await loadFavoritesFromDb(activeConnection, selectedIds);
      showToast('Favoritos cargados de la BD con éxito.', 'success');
      setSyncModal(null);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al cargar favoritos de la BD', 'error');
      throw err;
    }
  };

  const handleDeleteConfirm = async (choice: 'both' | 'local') => {
    if (!deleteConfirmModal) return;
    const { favoriteId, dbId, name } = deleteConfirmModal;

    if (choice === 'both' && dbId && activeConnection) {
      setIsDeletingFromDb(true);
      try {
        await deleteFavoriteFromDb(activeConnection, dbId);
        removeFavorite(favoriteId);
        showToast(`"${name}" eliminado de la base de datos y favoritos`, 'success');
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Error al eliminar de la base de datos', 'error');
        setIsDeletingFromDb(false);
        return; // Don't close or clear on error so they can see it or try again.
      } finally {
        setIsDeletingFromDb(false);
      }
    } else {
      // choice === 'local' or no dbId/connection
      removeFavorite(favoriteId);
      showToast(`"${name}" removido de favoritos locales`, 'info');
    }

    setDeleteConfirmModal(null);
  };

  const existingFavoriteNames = favorites.map(f => f.name);

  const handleEdit = (conn: Connection) => { setEditingConn(conn); setConnModalOpen(true); };
  const handleAddNew = () => { setEditingConn(null); setConnModalOpen(true); };

  const handleStarClick = (e: React.MouseEvent, historyId: string, linkedFavoriteId?: string) => {
    e.stopPropagation();
    if (linkedFavoriteId) {
      // Already a favorite → check if synced to DB to ask for deletion
      const fav = favorites.find(f => f.id === linkedFavoriteId);
      if (fav && fav.dbId && activeConnection) {
        setDeleteConfirmModal({
          isOpen: true,
          favoriteId: fav.id,
          dbId: fav.dbId,
          name: fav.name
        });
      } else {
        removeFavorite(linkedFavoriteId);
        showToast('Eliminado de favoritos', 'info');
      }
    } else {
      setFavModal({ isOpen: true, historyId });
    }
  };

  const handleFavModalConfirm = (name: string, sectionId: string) => {
    addFavorite(favModal.historyId, name, sectionId);
    setFavModal({ isOpen: false, historyId: '' });
    showToast(`"${name}" guardado en favoritos`, 'success');
  };

  /**
   * Abre un item del historial en el editor.
   * Si ya existe un tab con el mismo SQL, navega a él en lugar de crear uno nuevo.
   */
  const openHistory = (sql: string) => {
    const existing = tabs.find(t => t.query === sql);
    if (existing) {
      setActiveTab(existing.id);
    } else {
      addTab({ id: crypto.randomUUID(), title: 'History Query', query: sql });
    }
  };

  /**
   * Abre un favorito en el editor.
   * Si ya existe un tab con el mismo nombre Y el mismo SQL, navega a él.
   * Siempre actualiza lastRunAt.
   */
  const openFavorite = (favId: string, name: string, sql: string) => {
    const existing = tabs.find(t => t.title === name && t.query === sql);
    if (existing) {
      setActiveTab(existing.id);
    } else {
      addTab({ id: crypto.randomUUID(), title: name, query: sql, favoriteId: favId });
    }
    runFavorite(favId);
  };

  const card = `p-3 rounded-md border text-sm cursor-pointer transition-colors`;
  const cardDark = `border-gray-800 bg-gray-800/30 hover:border-blue-500`;
  const cardLight = `border-gray-200 bg-white hover:border-blue-400`;
  const cardFavDark = `border-yellow-500/40 bg-yellow-500/5 hover:border-yellow-400`;
  const cardFavLight = `border-yellow-400/60 bg-yellow-50 hover:border-yellow-500`;

  return (
    <div className={`w-72 flex flex-col border-r transition-colors duration-300 ${isDark ? 'bg-gray-900 border-gray-800 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-inherit">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />
          SQL Runner AI
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-inherit">
        {(['connections', 'schema', 'history', 'favorites'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            onContextMenu={(e) => {
              if (t === 'schema') {
                e.preventDefault();
                setSelectObjectsModalOpen(true);
              }
            }}
            className={`flex-1 py-3 px-1 text-xs font-medium border-b-2 flex justify-center items-center gap-1 ${
              tab === t
                ? t === 'favorites' ? 'border-yellow-400 text-yellow-400' : 'border-blue-500 text-blue-500'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            {t === 'connections' && <><Database className="w-3.5 h-3.5" /> Conns</>}
            {t === 'schema' && <><Settings2 className="w-3.5 h-3.5" /> Objetos</>}
            {t === 'history' && <><History className="w-3.5 h-3.5" /> Historial</>}
            {t === 'favorites' && (
              <>
                <Star className="w-3.5 h-3.5" /> Favs
                {favorites.length > 0 && (
                  <span className="text-[10px] bg-yellow-500 text-black font-bold rounded-full px-1.5 leading-4">
                    {favorites.length}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

        {/* ── CONNECTIONS ── */}
        {tab === 'connections' && (
          <div className="space-y-3">
            <button onClick={handleAddNew} className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors">
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
                <div className="text-xs opacity-60 truncate">{conn.user}@{conn.host}:{conn.port}/{conn.serviceName}</div>
              </div>
            ))}
            {connections.length === 0 && <div className="text-center text-sm opacity-50 mt-10">No connections yet.</div>}
          </div>
        )}

        {/* ── SCHEMA / OBJECTS ── */}
        {tab === 'schema' && (
          <div className="space-y-4">
            {!activeConnection ? (
              <div className="text-center text-sm opacity-50 mt-10">
                Selecciona una conexión activa para ver los objetos.
              </div>
            ) : (
              <>
                {/* Header label with settings trigger */}
                <div 
                  className="flex items-center justify-between mb-1 opacity-75 select-none cursor-pointer hover:opacity-100 transition-opacity" 
                  onContextMenu={(e) => { e.preventDefault(); setSelectObjectsModalOpen(true); }}
                  onClick={() => setSelectObjectsModalOpen(true)}
                  title="Clic derecho / clic para configurar objetos visibles"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">Objetos</span>
                  <div className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded">
                    <Settings2 className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                </div>

                {/* Refresh and Search Bar */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
                    isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-300'
                  }`}>
                    <Search className="w-4 h-4 opacity-50" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={objectSearch}
                      onChange={(e) => setObjectSearch(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-xs"
                    />
                    {objectSearch && (
                      <button onClick={() => setObjectSearch('')}>
                        <X className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={fetchObjects}
                    disabled={isLoadingObjects}
                    className={`p-2 rounded-lg border transition-colors ${
                      isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-100'
                    }`}
                    title="Actualizar Objetos"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingObjects ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {isLoadingObjects ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-60">
                    <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Cargando objetos...</span>
                  </div>
                ) : isLoadingSource ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-60">
                    <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Cargando definición...</span>
                  </div>
                ) : !objects ? (
                  <div className="text-center text-xs opacity-50 py-10">
                    No se han cargado objetos. Haz clic en actualizar.
                  </div>
                ) : (
                  <div 
                    className="space-y-1 font-mono text-xs select-none min-h-[150px]"
                    onContextMenu={(e) => { e.preventDefault(); setSelectObjectsModalOpen(true); }}
                  >
                    {visibleObjectTypes.map(type => {
                      if (type === 'PACKAGE' || type === 'PACKAGE BODY') {
                        // Render Packages once
                        if (type === 'PACKAGE') {
                          const showSpec = visibleObjectTypes.includes('PACKAGE');
                          const showBody = visibleObjectTypes.includes('PACKAGE BODY');
                          return renderPackagesFolder(
                            showSpec ? objects.PACKAGE : [],
                            showBody ? objects['PACKAGE BODY'] : []
                          );
                        }
                        return null;
                      }

                      const meta = getTypeMetadata(type);
                      const list = objects[type];
                      return renderFolder(meta.label, type, list, <meta.icon className={`w-3.5 h-3.5 ${meta.color}`} />, type);
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div className="space-y-2">
            {history.map(item => {
              const isFav = !!item.linkedFavoriteId;
              return (
                <div
                  key={item.id}
                  onClick={() => openHistory(item.sql)}
                  className={`${card} ${isFav ? (isDark ? cardFavDark : cardFavLight) : (isDark ? cardDark : cardLight)}`}
                >
                  <div className="text-xs opacity-50 mb-1">{new Date(item.timestamp).toLocaleString()}</div>
                  <div className="font-mono text-xs truncate opacity-80 mb-2">{item.sql}</div>
                  <div className="flex justify-between items-center text-xs">
                    <span className={item.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                      {item.status === 'success' ? `${item.duration}ms` : 'Failed'}
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Estrella */}
                      <button
                        onClick={(e) => handleStarClick(e, item.id, item.linkedFavoriteId)}
                        className={`p-1 rounded transition-all ${
                          isFav
                            ? 'text-yellow-400 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 opacity-50 hover:opacity-100'
                        }`}
                        title={isFav ? 'Quitar de favoritos' : 'Guardar como favorito'}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-yellow-400' : ''}`} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSqlModal({ isOpen: true, sql: item.sql }); }} className="p-1 hover:bg-black/10 rounded text-blue-500" title="Ver SQL">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); saveAs(new Blob([item.sql], { type: 'text/plain;charset=utf-8' }), `query_${new Date(item.timestamp).getTime()}.sql`); }} className="p-1 hover:bg-black/10 rounded text-green-500" title="Descargar">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }} className="p-1 hover:bg-red-500/10 rounded text-red-500" title="Eliminar del historial">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {history.length === 0 && <div className="text-center text-sm opacity-50 mt-10">No history yet.</div>}
          </div>
        )}

        {/* ── FAVORITES ── */}
        {tab === 'favorites' && (
          <div className="space-y-4">
            {/* Botones de Sincronización con BD */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={handleSaveFavoritesToDb}
                disabled={isSyncing || !activeConnectionId}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  !activeConnectionId
                    ? 'opacity-40 cursor-not-allowed border-gray-700 text-gray-500'
                    : isDark
                    ? 'border-yellow-500/35 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                    : 'border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                }`}
                title={!activeConnectionId ? 'Selecciona una conexión activa para guardar' : 'Guardar favoritos locales en la base de datos conectada'}
              >
                {isSyncing ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                Guardar en BD
              </button>
              <button
                type="button"
                onClick={handleLoadFavoritesFromDb}
                disabled={isSyncing || !activeConnectionId}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  !activeConnectionId
                    ? 'opacity-40 cursor-not-allowed border-gray-700 text-gray-500'
                    : isDark
                    ? 'border-blue-500/35 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                    : 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
                title={!activeConnectionId ? 'Selecciona una conexión activa para cargar' : 'Cargar favoritos desde la base de datos conectada'}
              >
                {isSyncing ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CloudDownload className="w-3.5 h-3.5" />
                )}
                Cargar de BD
              </button>
            </div>

            {/* Buscador de Favoritos y Secciones */}
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar sección o favorito..."
                  value={favSearchQuery}
                  onChange={(e) => setFavSearchQuery(e.target.value)}
                  className={`w-full py-2 pl-8 pr-20 rounded-xl text-xs border ${
                    isDark
                      ? 'bg-gray-950/40 border-gray-800 focus:border-blue-500 text-gray-200'
                      : 'bg-white border-gray-200 focus:border-blue-500 text-gray-800'
                  } outline-none transition-colors`}
                />
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                
                {/* Controles de Navegación de Búsqueda */}
                {matchedFavItems.length > 0 && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-[9px] opacity-60 font-semibold mr-1">
                      {activeMatchIndex + 1}/{matchedFavItems.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMatchIndex(prev => (prev - 1 + matchedFavItems.length) % matchedFavItems.length);
                      }}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-200 cursor-pointer"
                      title="Coincidencia anterior"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMatchIndex(prev => (prev + 1) % matchedFavItems.length);
                      }}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-200 cursor-pointer"
                      title="Siguiente coincidencia"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Controles para Expandir/Colapsar todo */}
            <div className="flex gap-2 justify-between items-center text-xs pb-2 border-b border-gray-500/10">
              <span className="opacity-50 font-bold uppercase tracking-wider text-[9px]">Árbol de favoritos</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    favoriteSections.forEach(s => {
                      all[s.id] = true;
                    });
                    setExpandedFavSections(all);
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                    isDark 
                      ? 'border-gray-800 bg-gray-900/50 hover:bg-gray-800 text-blue-400' 
                      : 'border-gray-200 bg-white hover:bg-gray-100 text-blue-600'
                  }`}
                >
                  Expandir todo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedFavSections({});
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                    isDark 
                      ? 'border-gray-800 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                      : 'border-gray-200 bg-white hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  Colapsar todo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteSectionsCheckbox(false);
                    setIsConfirmDeleteAllOpen(true);
                  }}
                  disabled={favorites.length === 0}
                  className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                    isDark 
                      ? 'border-red-900/30 bg-red-950/20 hover:bg-red-900/30 text-red-400 disabled:opacity-40 disabled:cursor-not-allowed' 
                      : 'border-red-100 bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  Borrar todo
                </button>
              </div>
            </div>

            {/* Árbol Jerárquico de Favoritos */}
            <div className="space-y-1 font-sans">
              {favoriteSections.map(section => {
                const sectionFavs = favorites.filter(f => f.sectionId === section.id);
                const isExpanded = !!expandedFavSections[section.id];
                
                const toggleSection = () => {
                  setExpandedFavSections(prev => ({
                    ...prev,
                    [section.id]: !prev[section.id]
                  }));
                };

                // Match details for section name
                const isMatchedSec = matchedFavItems.some(item => item.type === 'section' && item.id === section.id);
                const isActiveSec = activeMatchIndex >= 0 && matchedFavItems[activeMatchIndex]?.type === 'section' && matchedFavItems[activeMatchIndex]?.id === section.id;

                const sectionHighlightClass = isActiveSec
                  ? (isDark ? 'bg-blue-500/25 ring-2 ring-blue-500/50 text-blue-300 font-bold' : 'bg-blue-100/80 ring-2 ring-blue-500/50 text-blue-800 font-bold')
                  : isMatchedSec
                  ? (isDark ? 'bg-yellow-500/10 text-yellow-400 font-semibold' : 'bg-yellow-50 text-yellow-800 font-semibold')
                  : '';

                return (
                  <div key={section.id} id={`fav-tree-node-section-${section.id}`} className="space-y-0.5">
                    {/* Fila de Sección */}
                    <div 
                      onClick={toggleSection}
                      className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${
                        isDark 
                          ? 'hover:bg-gray-800/30 text-gray-300' 
                          : 'hover:bg-gray-200/50 text-gray-700'
                      } ${sectionHighlightClass}`}
                    >
                      {/* Chevron de Expansión */}
                      <span className="opacity-60 transition-transform duration-200 flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </span>

                      {/* Icono de Carpeta */}
                      <span className="flex-shrink-0">
                        {isExpanded ? (
                          <FolderOpen className="w-4 h-4 text-yellow-500/80" />
                        ) : (
                          <Folder className="w-4 h-4 text-yellow-500/80" />
                        )}
                      </span>

                      {/* Nombre y Total */}
                      <span className="text-xs font-semibold truncate flex-1">
                        {section.name} <span className="opacity-45">({sectionFavs.length})</span>
                      </span>

                      {/* Borrar Sección Vacía */}
                      {section.id !== VARIOS_SECTION_ID && sectionFavs.length === 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavoriteSection(section.id);
                            showToast('Sección eliminada', 'info');
                          }}
                          className={`p-1 rounded transition-colors ${
                            isDark ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title="Eliminar sección vacía"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Hijos (Favoritos) */}
                    {isExpanded && (
                      <div className="pl-5 space-y-0.5 border-l border-gray-500/10 ml-3.5">
                        {sectionFavs.map(fav => {
                          const isTabActive = tabs.find(t => t.id === activeTabId)?.favoriteId === fav.id || tabs.find(t => t.title === fav.name && t.query === fav.sql);

                          // Match details for favorite child node
                          const isMatchedFav = matchedFavItems.some(item => item.type === 'favorite' && item.id === fav.id);
                          const isActiveFav = activeMatchIndex >= 0 && matchedFavItems[activeMatchIndex]?.type === 'favorite' && matchedFavItems[activeMatchIndex]?.id === fav.id;

                          const favHighlightClass = isActiveFav
                            ? (isDark ? 'bg-blue-500/25 ring-2 ring-blue-500/50 text-blue-300 font-bold' : 'bg-blue-100/80 ring-2 ring-blue-500/50 text-blue-800 font-bold')
                            : isMatchedFav
                            ? (isDark ? 'bg-yellow-500/10 text-yellow-400 font-semibold' : 'bg-yellow-50 text-yellow-800 font-semibold')
                            : '';

                          return (
                            <div 
                              key={fav.id}
                              id={`fav-tree-node-favorite-${fav.id}`}
                              className="relative group/fav"
                            >
                              <div
                                onClick={() => openFavorite(fav.id, fav.name, fav.sql)}
                                onMouseEnter={(e) => {
                                  setHoveredFav(fav);
                                  setMousePos({ x: e.clientX + 15, y: e.clientY + 10 });
                                }}
                                onMouseMove={(e) => {
                                  setMousePos({ x: e.clientX + 15, y: e.clientY + 10 });
                                }}
                                onMouseLeave={() => {
                                  setHoveredFav(null);
                                }}
                                className={`flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer transition-all border ${
                                  isTabActive
                                    ? isDark 
                                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 font-semibold' 
                                      : 'bg-yellow-50 border-yellow-400/40 text-yellow-700 font-semibold'
                                    : isDark 
                                      ? 'hover:bg-gray-800/20 border-transparent text-gray-400 hover:text-gray-200' 
                                      : 'hover:bg-gray-150 border-transparent text-gray-600 hover:text-gray-800'
                                } ${favHighlightClass}`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <Star className={`w-3.5 h-3.5 flex-shrink-0 ${
                                    isTabActive ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500/60 dark:text-gray-400/60'
                                  }`} />
                                  <span className="text-xs truncate">{fav.name}</span>
                                </div>

                                {/* Botones rápidos en hover */}
                                <div className="opacity-0 group-hover/fav:opacity-100 flex items-center gap-0.5 transition-opacity ml-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSqlModal({
                                        isOpen: true,
                                        sql: fav.sql,
                                        id: fav.id,
                                        dbId: fav.dbId,
                                        sectionName: section.name,
                                        name: fav.name
                                      });
                                    }}
                                    className={`p-0.5 rounded transition-colors ${
                                      isDark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-250 text-blue-600'
                                    }`}
                                    title="Ver SQL completo"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveAs(new Blob([fav.sql], { type: 'text/plain;charset=utf-8' }), `${fav.name}.sql`);
                                    }}
                                    className={`p-0.5 rounded transition-colors ${
                                      isDark ? 'hover:bg-gray-700 text-green-400' : 'hover:bg-gray-250 text-green-600'
                                    }`}
                                    title="Descargar SQL"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (fav.dbId && activeConnection) {
                                        setDeleteConfirmModal({
                                          isOpen: true,
                                          favoriteId: fav.id,
                                          dbId: fav.dbId,
                                          name: fav.name
                                        });
                                      } else {
                                        removeFavorite(fav.id);
                                        showToast('Eliminado de favoritos', 'info');
                                      }
                                    }}
                                    className={`p-0.5 rounded transition-colors ${
                                      isDark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-250 text-red-600'
                                    }`}
                                    title="Quitar de favoritos"
                                  >
                                    <StarOff className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {sectionFavs.length === 0 && (
                          <div className="text-[10px] opacity-35 italic pl-2 py-0.5">Sin favoritos en esta sección</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {favorites.length === 0 && favoriteSections.every(s => favorites.filter(f => f.sectionId === s.id).length === 0) && (
                <div className="flex flex-col items-center gap-3 mt-8 opacity-40">
                  <Star className="w-8 h-8" />
                  <p className="text-sm text-center">Marca el ⭐ en el historial<br />para guardar favoritos.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-inherit flex items-center justify-between">
        <button onClick={toggleTheme} className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
          <Settings2 className="w-4 h-4" />
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button onClick={() => setAboutModalOpen(true)} className="flex items-center gap-1.5 text-sm opacity-70 hover:opacity-100 text-blue-500 hover:text-blue-400 transition-all font-semibold cursor-pointer">
          <Info className="w-4 h-4" />
          Acerca de
        </button>
      </div>

      {/* Modales */}
      {isConnModalOpen && (
        <ConnectionModal isOpen={isConnModalOpen} onClose={() => setConnModalOpen(false)} connection={editingConn} />
      )}

      {favModal.isOpen && (
        <FavoriteNameModal
          isDark={isDark}
          existingNames={existingFavoriteNames}
          sections={favoriteSections}
          onConfirm={handleFavModalConfirm}
          onCancel={() => setFavModal({ isOpen: false, historyId: '' })}
          onAddSection={(id, name) => addFavoriteSection(id, name)}
        />
      )}

      {sqlModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-4xl h-[80vh] flex flex-col rounded-xl shadow-2xl border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm truncate">{sqlModal.name || 'Full SQL Instruction'}</h3>
                <div className="flex items-center gap-3 text-xs opacity-60 mt-1 flex-wrap">
                  {sqlModal.dbId && (
                    <span className={`px-1.5 py-0.5 rounded font-mono ${isDark ? 'bg-gray-800 text-yellow-400' : 'bg-gray-150 text-yellow-700'}`}>
                      DB ID: {sqlModal.dbId}
                    </span>
                  )}
                  {sqlModal.sectionName && (
                    <span>Sección: <strong className="opacity-90">{sqlModal.sectionName}</strong></span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button onClick={() => { navigator.clipboard.writeText(sqlModal.sql); showToast('SQL copied!'); }} className="p-1.5 rounded-md hover:bg-black/10 text-blue-500" title="Copy">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => { saveAs(new Blob([sqlModal.sql], { type: 'text/plain;charset=utf-8' }), `${sqlModal.name || 'query'}.sql`); }} className="p-1.5 rounded-md hover:bg-black/10 text-green-500" title="Download">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setSqlModal({ isOpen: false, sql: '' })} className="p-1.5 rounded-md hover:bg-black/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-1">
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme={isDark ? 'vs-dark' : 'light'}
                value={sqlModal.sql}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, fontFamily: 'JetBrains Mono, Consolas, monospace', scrollBeyondLastLine: false, domReadOnly: true }}
              />
            </div>
          </div>
        </div>
      )}

      {syncModal && syncModal.isOpen && (
        <FavoriteSyncModal
          isOpen={syncModal.isOpen}
          isDark={isDark}
          mode={syncModal.mode}
          localFavorites={favorites}
          localSections={favoriteSections}
          dbFavorites={syncModal.dbFavorites}
          dbSections={syncModal.dbSections}
          onConfirm={syncModal.mode === 'save' ? handleConfirmSave : handleConfirmLoad}
          onCancel={() => setSyncModal(null)}
        />
      )}

      {deleteConfirmModal && deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className={`w-full max-w-md flex flex-col rounded-2xl shadow-2xl border overflow-hidden transform transition-all duration-300 scale-100 ${
            isDark 
              ? 'bg-gray-900 border-gray-800 text-gray-200 shadow-black/80' 
              : 'bg-white border-gray-200 text-gray-800 shadow-gray-400/50'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-start gap-4 p-5 ${isDark ? 'border-b border-gray-800/80 bg-gray-950/20' : 'border-b border-gray-100 bg-gray-50/50'}`}>
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'}`}>
                <Trash2 className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-6">¿Eliminar de la Base de Datos?</h3>
                <p className="text-xs opacity-60 mt-0.5 truncate">Favorito: <strong className="opacity-90">{deleteConfirmModal.name}</strong></p>
              </div>
              <button 
                onClick={() => setDeleteConfirmModal(null)} 
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-2">
              <p className="text-xs leading-relaxed opacity-80">
                Este favorito está registrado en la base de datos conectada (ID: {deleteConfirmModal.dbId}).
              </p>
              <p className="text-xs leading-relaxed opacity-60">
                ¿Deseas eliminarlo físicamente de la base de datos o únicamente quitarlo de tu lista de favoritos locales?
              </p>
            </div>

            {/* Modal Footer / Actions */}
            <div className={`p-5 flex flex-col gap-2 ${isDark ? 'bg-gray-950/20' : 'bg-gray-50/30'}`}>
              <button
                disabled={isDeletingFromDb}
                onClick={() => handleDeleteConfirm('both')}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-white shadow-lg bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer`}
              >
                {isDeletingFromDb ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Borrando de la BD...
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    Sí, borrar de la BD y local
                  </>
                )}
              </button>
              
              <button
                disabled={isDeletingFromDb}
                onClick={() => handleDeleteConfirm('local')}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                  isDark
                    ? 'border-gray-700 hover:border-gray-500 bg-gray-800/40 text-gray-200 hover:bg-gray-800/60'
                    : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <StarOff className="w-3.5 h-3.5 text-yellow-500" />
                No, solo quitar de favoritos locales
              </button>

              <button
                disabled={isDeletingFromDb}
                onClick={() => setDeleteConfirmModal(null)}
                className={`w-full py-1 text-xs font-medium opacity-60 hover:opacity-100 transition-opacity text-center mt-1 cursor-pointer`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Contextual */}
      {contextMenu && (
        <div
          className={`fixed z-[500] min-w-[180px] rounded-xl shadow-2xl border backdrop-blur-md p-1.5 flex flex-col gap-0.5 ${
            isDark ? 'bg-gray-900/95 border-gray-700/80 text-gray-200' : 'bg-white/95 border-gray-200/80 text-gray-800'
          }`}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleObjectDoubleClick(contextMenu.name, contextMenu.type);
              setContextMenu(null);
            }}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors text-left ${
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5 opacity-70" />
            Cargar en el editor
          </button>
          
          <button
            onClick={() => {
              handleSaveObjectToFile(contextMenu.name, contextMenu.type);
              setContextMenu(null);
            }}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors text-left ${
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}
          >
            <Download className="w-3.5 h-3.5 opacity-70" />
            Guardar en archivo
          </button>
          
          {contextMenu.type.toUpperCase() !== 'TABLE' && (
            <button
              onClick={() => {
                handleCompileObject(contextMenu.name, contextMenu.type);
                setContextMenu(null);
              }}
              className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors text-left ${
                isDark ? 'hover:bg-gray-800 text-blue-400 hover:text-blue-300' : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              Compilar objeto
            </button>
          )}
          
          <div className={`h-px my-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />
          
          <button
            onClick={() => {
              setDeleteObjectModal({ name: contextMenu.name, type: contextMenu.type });
              setContextMenu(null);
            }}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors text-left ${
              isDark ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300' : 'hover:bg-red-55 text-red-600 hover:text-red-700'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Borrar (DROP)
          </button>
        </div>
      )}

      {/* Modal confirmacion DROP de objeto */}
      {deleteObjectModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 ${
            isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base">Confirmar eliminación</h2>
                <p className="text-xs opacity-50">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm">
              ¿Estás seguro de que deseas eliminar permanentemente el objeto <span className="font-semibold text-red-500">{deleteObjectModal.type} {deleteObjectModal.name}</span> de la base de datos?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteObjectModal(null)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleDeleteObject(deleteObjectModal.name, deleteObjectModal.type);
                  setDeleteObjectModal(null);
                }}
                className="flex-1 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
              >
                Eliminar (DROP)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmacion borrar todos los favoritos */}
      {isConfirmDeleteAllOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 ${
            isDark ? 'bg-gray-900 border-gray-700 text-gray-200 shadow-black/80' : 'bg-white border-gray-200 text-gray-800 shadow-gray-400/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                <Trash2 className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="font-bold text-base">Borrar todos los favoritos</h2>
                <p className="text-xs opacity-50">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm">
              ¿Estás seguro de que deseas eliminar permanentemente <strong>todos los favoritos</strong> guardados localmente?
            </p>
            <label className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer select-none text-xs opacity-80 hover:opacity-100 transition-opacity">
              <input
                type="checkbox"
                checked={deleteSectionsCheckbox}
                onChange={(e) => setDeleteSectionsCheckbox(e.target.checked)}
                className={`rounded border-gray-300 h-3.5 w-3.5 focus:ring-blue-500/20 text-blue-600 cursor-pointer transition-colors ${
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                }`}
              />
              <span>Borrar también las secciones personalizadas</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteAllOpen(false)}
                className={`flex-1 py-2 rounded-lg text-sm border font-semibold transition-colors cursor-pointer ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-600'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllFavorites(deleteSectionsCheckbox);
                  setIsConfirmDeleteAllOpen(false);
                  showToast(
                    deleteSectionsCheckbox
                      ? 'Todos los favoritos y secciones locales han sido eliminados'
                      : 'Todos los favoritos locales han sido eliminados',
                    'success'
                  );
                }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-red-500/30 active:scale-[0.98] cursor-pointer"
              >
                Eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {compileErrorsModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[80vh] overflow-hidden ${
            isDark ? 'bg-gray-900 border-gray-700 text-gray-200 shadow-black/80' : 'bg-white border-gray-200 text-gray-800 shadow-gray-400/30'
          }`}>
            <div className={`flex items-start gap-4 p-5 border-b ${isDark ? 'border-gray-800/80 bg-gray-950/20' : 'border-gray-100 bg-gray-50/50'}`}>
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-6">Errores de Compilación</h3>
                <p className="text-xs opacity-60 mt-0.5 truncate">{compileErrorsModal.type} <strong className="opacity-90">{compileErrorsModal.name}</strong></p>
              </div>
              <button 
                onClick={() => setCompileErrorsModal(null)} 
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
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
                    {compileErrorsModal.errors.map((err, idx) => (
                      <tr 
                        key={idx} 
                        className={`border-b font-mono transition-colors ${
                          isDark 
                            ? 'border-gray-800/60 hover:bg-red-500/5 text-gray-300' 
                            : 'border-gray-100 hover:bg-red-50/30 text-gray-700'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-red-500 dark:text-red-400">{err.line}</td>
                        <td className="py-2.5 px-3 opacity-60">{err.position}</td>
                        <td className="py-2.5 px-3 text-red-600/90 dark:text-red-300/90 whitespace-pre-wrap">{err.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`p-4 flex justify-end border-t ${isDark ? 'border-gray-800 bg-gray-950/20' : 'border-gray-100 bg-gray-50/30'}`}>
              <button
                onClick={() => setCompileErrorsModal(null)}
                className={`py-2 px-5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                  isDark
                    ? 'border-gray-700 hover:border-gray-500 bg-gray-800 text-gray-200'
                    : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700'
                }`}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal instrucciones SQL (tablas.sql) */}
      <SqlInstructionsModal
        isOpen={showSqlInstructions}
        isDark={isDark}
        onClose={() => setShowSqlInstructions(false)}
      />

      {/* Modal Acerca de (Orlando Arturo Valverde Quiceno) */}
      {isAboutModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity duration-300">
          {/* Futuristic animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[40%] -left-[40%] w-[80%] h-[80%] rounded-full bg-blue-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute -bottom-[40%] -right-[40%] w-[80%] h-[80%] rounded-full bg-purple-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(59,130,246,0.05)_98%,rgba(59,130,246,0.1)_100%)] bg-[length:100%_24px] pointer-events-none opacity-40 animate-scanline" />
          </div>

          <div className={`relative w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl p-8 flex flex-col items-center text-center transition-all duration-500 transform scale-100 ${
            isDark 
              ? 'bg-gray-950/80 border-blue-500/30 text-gray-100 shadow-blue-500/5' 
              : 'bg-white/90 border-blue-200 text-gray-800 shadow-blue-500/10'
          }`} style={{ boxShadow: isDark ? '0 0 40px rgba(59, 130, 246, 0.15)' : '0 10px 40px rgba(0, 0, 0, 0.08)' }}>
            
            {/* Holographic Glowing Ring around Portrait */}
            <div className="relative mb-6 group">
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-75 blur-xs group-hover:opacity-100 transition-opacity duration-500 animate-spin" style={{ animationDuration: '12s' }} />
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 group-hover:scale-105 transition-transform duration-500" />
              
              {/* Scanline HUD overlay on the portrait */}
              <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-inherit bg-gray-900 flex-shrink-0 z-10">
                <img 
                  src={ORLANDO_IMAGE_BASE64} 
                  alt="Orlando Arturo Valverde Quiceno" 
                  className="w-full h-full object-cover select-none scale-105 group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-blue-500/5 mix-blend-color" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(59,130,246,0.15)_50%)] bg-[length:100%_4px] opacity-60" />
                <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 opacity-60 animate-hud-scan" />
              </div>
            </div>

            {/* Developer Identity */}
            <div className="space-y-1 mb-6">
              <span className="text-[10px] font-extrabold tracking-widest text-blue-500 uppercase">Lead Developer</span>
              <h3 className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Orlando Arturo Valverde Quiceno
              </h3>
              <p className="text-xs opacity-60 font-medium">Arquitecto & Desarrollador Principal</p>
            </div>

            {/* Futuristic Stats / Info Grid */}
            <div className="w-full space-y-3 mb-6 font-mono text-xs">
              <div className={`p-3 rounded-2xl border flex items-center justify-between group transition-colors ${isDark ? 'bg-gray-900/40 border-gray-800/80 hover:border-blue-500/20' : 'bg-gray-50 border-gray-100 hover:border-blue-200'}`}>
                <span className="opacity-40 text-[10px] uppercase">E-Mail</span>
                <span 
                  onClick={() => {
                    navigator.clipboard.writeText('vqorlando@gmail.com');
                    showToast('Correo copiado al portapapeles', 'success');
                  }} 
                  className="font-bold text-blue-500 hover:text-blue-400 cursor-pointer transition-colors"
                  title="Haga clic para copiar"
                >
                  vqorlando@gmail.com
                </span>
              </div>
              <div className={`p-3 rounded-2xl border flex items-center justify-between group transition-colors ${isDark ? 'bg-gray-900/40 border-gray-800/80 hover:border-blue-500/20' : 'bg-gray-50 border-gray-100 hover:border-blue-200'}`}>
                <span className="opacity-40 text-[10px] uppercase">Teléfono</span>
                <span 
                  onClick={() => {
                    navigator.clipboard.writeText('+573168226095');
                    showToast('Teléfono copiado al portapapeles', 'success');
                  }}
                  className="font-bold text-blue-500 hover:text-blue-400 cursor-pointer transition-colors"
                  title="Haga clic para copiar"
                >
                  +57 316 8226095
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="w-full text-xs opacity-80 leading-relaxed mb-6">
              <p className="mb-2">
                Este programa ha sido diseñado para simplificar la ejecución y administración de consultas en Oracle Database.
              </p>
              <div className={`p-3.5 rounded-2xl border bg-gradient-to-r ${
                isDark 
                  ? 'from-blue-950/20 to-purple-950/20 border-blue-500/10 text-blue-300' 
                  : 'from-blue-50/50 to-purple-50/50 border-blue-100 text-blue-800'
              }`}>
                <p className="font-semibold flex items-center justify-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  Programa desarrollado con ayuda de Antigravity.
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setAboutModalOpen(false)}
              className="py-2.5 px-8 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 active:scale-[0.98] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Configuración de Objetos Visibles */}
      {isSelectObjectsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300">
          <div className={`w-full max-w-4xl max-h-[85vh] rounded-2xl border flex flex-col shadow-2xl transition-all duration-300 transform scale-100 ${
            isDark ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
          }`}>
            {/* Cabecera */}
            <div className={`p-5 flex items-center justify-between border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2.5">
                <Settings2 className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="text-base font-bold tracking-tight">Configurar Objetos Visibles</h3>
                  <p className="text-xs opacity-60">Selecciona cuáles tipos de objetos deseas que aparezcan en el árbol de navegación.</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectObjectsModalOpen(false)}
                className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Barra de Acciones Rápidas y Filtro */}
            <div className={`p-4 flex flex-col sm:flex-row gap-3 items-center justify-between border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              {/* Buscador */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm w-full sm:max-w-xs ${
                isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-300'
              }`}>
                <Search className="w-4 h-4 opacity-50 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar tipo de objeto..."
                  value={modalFilter}
                  onChange={(e) => setModalFilter(e.target.value)}
                  className="bg-transparent border-none outline-none w-full text-xs"
                />
                {modalFilter && (
                  <button onClick={() => setModalFilter('')}>
                    <X className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
                  </button>
                )}
              </div>

              {/* Botones de acción rápida */}
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setTempSelectedTypes(ALL_ORACLE_OBJECT_TYPES)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    isDark ? 'border-gray-800 hover:border-gray-600 bg-gray-800/50 text-gray-200' : 'border-gray-200 hover:border-gray-300 bg-gray-50 text-gray-700'
                  }`}
                >
                  Marcar Todos
                </button>
                <button
                  onClick={() => setTempSelectedTypes([])}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    isDark ? 'border-gray-800 hover:border-gray-600 bg-gray-800/50 text-gray-200' : 'border-gray-200 hover:border-gray-300 bg-gray-50 text-gray-700'
                  }`}
                >
                  Desmarcar Todos
                </button>
                <button
                  onClick={() => setTempSelectedTypes(['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER'])}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    isDark ? 'border-gray-800 hover:border-gray-600 bg-gray-800/50 text-gray-200' : 'border-gray-200 hover:border-gray-300 bg-gray-50 text-gray-700'
                  }`}
                >
                  Por Defecto
                </button>
              </div>
            </div>

            {/* Listado de Checkboxes */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredModalTypes.map((type) => {
                  const meta = getTypeMetadata(type);
                  const isChecked = tempSelectedTypes.includes(type);
                  const Icon = meta.icon;

                  return (
                    <label
                      key={type}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 ${
                        isChecked
                          ? isDark 
                            ? 'bg-blue-900/10 border-blue-500/50 text-white' 
                            : 'bg-blue-50/50 border-blue-400 text-blue-900'
                          : isDark
                          ? 'border-gray-800 bg-gray-800/20 hover:border-gray-700 text-gray-400 hover:text-gray-300'
                          : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setTempSelectedTypes(prev => prev.filter(t => t !== type));
                          } else {
                            setTempSelectedTypes(prev => [...prev, type]);
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isChecked ? meta.color : 'opacity-40'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate leading-none">{meta.label}</p>
                        <p className="text-[10px] opacity-40 font-mono mt-0.5 truncate">{type}</p>
                      </div>
                    </label>
                  );
                })}
                {filteredModalTypes.length === 0 && (
                  <div className="col-span-full text-center py-10 opacity-50 text-xs italic">
                    No se encontraron tipos de objeto que coincidan con la búsqueda.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`p-4 flex justify-end gap-3 border-t ${isDark ? 'border-gray-800 bg-gray-950/20' : 'border-gray-100 bg-gray-50/30'}`}>
              <button
                onClick={() => setSelectObjectsModalOpen(false)}
                className={`py-2 px-5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${
                  isDark
                    ? 'border-gray-700 hover:border-gray-500 bg-gray-800 text-gray-200'
                    : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setVisibleObjectTypes(tempSelectedTypes);
                  setSelectObjectsModalOpen(false);
                  showToast('Configuración de objetos actualizada', 'success');
                }}
                className="py-2 px-6 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {hoveredFav && (
        <div 
          className={`fixed z-[300] w-96 md:w-[480px] p-5 rounded-2xl border shadow-2xl backdrop-blur-md pointer-events-none transition-opacity duration-200 font-sans text-xs ${
            isDark 
              ? 'bg-gray-950/95 border-blue-500/30 text-gray-100 shadow-black/90' 
              : 'bg-white/98 border-blue-200 text-gray-800 shadow-gray-400/50'
          }`}
          style={{ 
            top: `${Math.min(mousePos.y, typeof window !== 'undefined' ? window.innerHeight - 340 : mousePos.y)}px`, 
            left: `${Math.min(mousePos.x, typeof window !== 'undefined' ? window.innerWidth - 500 : mousePos.x)}px` 
          }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-inherit">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="font-extrabold truncate text-sm">{hoveredFav.name}</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="text-[10px] opacity-40 uppercase font-semibold mb-1">Consulta SQL Guardada</div>
              <div className="font-mono bg-black/15 dark:bg-black/45 p-3 rounded-xl max-h-64 overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all opacity-95 border border-inherit">
                {hoveredFav.sql}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-[10px] opacity-60 border-t border-inherit pt-2">
              <div>
                <span className="block opacity-40 font-mono">FECHA CREACIÓN</span>
                <span className="font-semibold">{new Date(hoveredFav.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="block opacity-40 font-mono">ÚLTIMA EJECUCIÓN</span>
                <span className="font-semibold">{hoveredFav.lastRunAt ? new Date(hoveredFav.lastRunAt).toLocaleString() : 'Sin ejecuciones aún'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
