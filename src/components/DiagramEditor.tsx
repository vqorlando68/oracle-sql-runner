"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Plus, Minus, Maximize2, Download, Upload, Trash2, 
  Settings, Database, HelpCircle, Columns, RefreshCw, ZoomIn, ZoomOut, Check,
  MessageSquare, CloudUpload, CloudDownload
} from 'lucide-react';
import { saveAs } from 'file-saver';
import Editor from '@monaco-editor/react';
import { useAppStore } from '@/store/useAppStore';
import DiagramSyncModal from './DiagramSyncModal';
import DiagramInstructionsModal from './DiagramInstructionsModal';

interface ColumnMetadata {
  tableName: string;
  columnName: string;
  dataType: string;
  nullable: string;
}

interface RelationMetadata {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

interface IndexMetadata {
  tableName: string;
  indexName: string;
  uniqueness: string;
  columnName: string;
  columnPosition: number;
  descend: string;
}

interface PrimaryKeyMetadata {
  tableName: string;
  columnName: string;
  constraintName: string;
}

interface TriggerMetadata {
  tableName: string;
  triggerName: string;
  triggerDdl: string;
}

interface ConstraintMetadata {
  tableName: string;
  constraintName: string;
  constraintType: string;
  columnName: string;
  searchCondition: string | null;
}

interface DiagramTab {
  id: string;
  title: string;
  selectedConnection: any;
  selectedTables: string[];
  nodes: Record<string, NodeState>;
  tableData: {
    columns: ColumnMetadata[];
    relations: RelationMetadata[];
    indexes: IndexMetadata[];
    primaryKeys: PrimaryKeyMetadata[];
    triggers: TriggerMetadata[];
    constraints: ConstraintMetadata[];
  };
  notes: NoteState[];
  commentsData: Record<string, { tableComment?: string; columns: Record<string, string> }>;
  showComments: Record<string, boolean>;
  pan: { x: number; y: number };
  zoom: number;
}

interface NodeState {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  indexesHeight?: number;
}

interface NoteState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
}

interface DiagramEditorProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  activeConnection: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#ef4444', // Red
  '#06b6d4', // Cyan
];

export default function DiagramEditor({
  isOpen,
  onClose,
  isDark,
  activeConnection,
  showToast
}: DiagramEditorProps) {
  const { connections } = useAppStore();
  const [selectedConnection, setSelectedConnection] = useState<any>(activeConnection);

  // Tabs management states
  const [diagramTabs, setDiagramTabs] = useState<DiagramTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [tabToClose, setTabToClose] = useState<string | null>(null);

  // Database tables states
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Canvas states
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const [tableData, setTableData] = useState<{
    columns: ColumnMetadata[];
    relations: RelationMetadata[];
    indexes: IndexMetadata[];
    primaryKeys: PrimaryKeyMetadata[];
    triggers: TriggerMetadata[];
    constraints: ConstraintMetadata[];
  }>({ columns: [], relations: [], indexes: [], primaryKeys: [], triggers: [], constraints: [] });

  // Selection states
  const [activeSelectedNodes, setActiveSelectedNodes] = useState<string[]>([]);

  // DDL generation states
  const [isDdlModalOpen, setIsDdlModalOpen] = useState(false);
  const [ddlModalTables, setDdlModalTables] = useState<string[]>([]);

  // Comments fetching cache ref
  const fetchedCommentsRef = useRef<Set<string>>(new Set());
  
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [hoveredRelation, setHoveredRelation] = useState<string | null>(null);
  
  const [diagramTitle, setDiagramTitle] = useState<string>('Modelo Relacional Activo');
  const [notes, setNotes] = useState<NoteState[]>([]);

  // Comments states
  const [commentsData, setCommentsData] = useState<Record<string, { tableComment?: string; columns: Record<string, string> }>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  
  // Navigation states (Zoom & Pan)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  
  // Drag states
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resize states
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [initialResizeDims, setInitialResizeDims] = useState({ width: 0, height: 0 });
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  
  // Resize indexes divider states
  const [resizingIndexNodeId, setResizingIndexNodeId] = useState<string | null>(null);
  const [initialIndexesHeight, setInitialIndexesHeight] = useState<number>(80);
  const [resizeIndexStartPos, setResizeIndexStartPos] = useState({ y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DB Sync states for models
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncModalMode, setSyncModalMode] = useState<'save' | 'load'>('save');
  const [dbModels, setDbModels] = useState<Array<{ ID: number; NOMBRE_MODELO: string }>>([]);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [syncError, setSyncError] = useState('');

  // DB Sync functions for relational models
  const fetchDbModels = async () => {
    if (!selectedConnection) return [];
    try {
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: selectedConnection,
          sql: 'SELECT id, nombre_modelo FROM TKR_MODELOS_RELACIONALES ORDER BY nombre_modelo'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener modelos de la BD');
      }
      return data.rows || [];
    } catch (err: any) {
      throw err;
    }
  };

  const handleOpenSaveDb = async () => {
    if (!selectedConnection) {
      showToast('Selecciona una conexión activa primero.', 'error');
      return;
    }
    if (selectedTables.length === 0) {
      showToast('No hay tablas en el diagrama para guardar.', 'info');
      return;
    }
    setSyncError('');
    setIsSyncModalOpen(true);
    setSyncModalMode('save');
    try {
      const models = await fetchDbModels();
      setDbModels(models);
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || 'Error al conectar con la base de datos.');
      if (err.message?.includes('TKR_MODELOS_RELACIONALES') || err.message?.includes('ORA-00942')) {
        setIsInstructionsModalOpen(true);
        setIsSyncModalOpen(false);
      }
    }
  };

  const handleOpenLoadDb = async () => {
    if (!selectedConnection) {
      showToast('Selecciona una conexión activa primero.', 'error');
      return;
    }
    setSyncError('');
    setIsSyncModalOpen(true);
    setSyncModalMode('load');
    try {
      const models = await fetchDbModels();
      setDbModels(models);
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || 'Error al conectar con la base de datos.');
      if (err.message?.includes('TKR_MODELOS_RELACIONALES') || err.message?.includes('ORA-00942')) {
        setIsInstructionsModalOpen(true);
        setIsSyncModalOpen(false);
      }
    }
  };

  const handleSaveToDb = async (name: string) => {
    if (!selectedConnection) return;
    const modelData = {
      title: name,
      tables: selectedTables,
      nodes,
      notes,
      pan,
      zoom,
      commentsData,
      showComments,
      tableData,
      savedConnection: selectedConnection 
        ? {
            name: selectedConnection.name,
            user: selectedConnection.user,
            host: selectedConnection.host,
            port: selectedConnection.port,
            serviceName: selectedConnection.serviceName
          }
        : 'Fuera de Línea'
    };

    const sql = `
      DECLARE
        v_count NUMBER;
      BEGIN
        SELECT COUNT(*) INTO v_count FROM TKR_MODELOS_RELACIONALES WHERE nombre_modelo = :nombre_modelo;
        IF v_count > 0 THEN
          UPDATE TKR_MODELOS_RELACIONALES SET modelo_json = :modelo_json WHERE nombre_modelo = :nombre_modelo;
        ELSE
          INSERT INTO TKR_MODELOS_RELACIONALES (nombre_modelo, modelo_json) VALUES (:nombre_modelo, :modelo_json);
        END IF;
      END;
    `;

    try {
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: selectedConnection,
          sql,
          binds: {
            nombre_modelo: name,
            modelo_json: JSON.stringify(modelData, null, 2)
          },
          bindTypes: {
            modelo_json: 'clob'
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el modelo en la BD');
      }
      showToast(`Modelo '${name}' guardado en la base de datos`, 'success');
      setIsSyncModalOpen(false);
    } catch (err: any) {
      throw err;
    }
  };

  const handleLoadFromDb = async (id: number, name: string) => {
    if (!selectedConnection) return;
    try {
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: selectedConnection,
          sql: 'SELECT modelo_json FROM TKR_MODELOS_RELACIONALES WHERE id = :id',
          binds: { id }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al cargar el modelo de la BD');
      }
      
      const row = data.rows?.[0];
      if (!row || !row.MODELO_JSON) {
        throw new Error('No se encontró el contenido del modelo.');
      }

      const model = JSON.parse(row.MODELO_JSON);
      loadDiagramModel(model);
      showToast(`Modelo '${name}' cargado desde la base de datos`, 'success');
      setIsSyncModalOpen(false);
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeleteFromDb = async (id: number, name: string) => {
    if (!selectedConnection) return;
    try {
      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: selectedConnection,
          sql: 'DELETE FROM TKR_MODELOS_RELACIONALES WHERE id = :id',
          binds: { id }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar el modelo de la BD');
      }
      showToast(`Modelo '${name}' eliminado de la base de datos`, 'success');
      
      // Refresh list
      const models = await fetchDbModels();
      setDbModels(models);
    } catch (err: any) {
      throw err;
    }
  };

  // Sync selectedConnection with parent's activeConnection when diagram opens or connection changes
  useEffect(() => {
    if (isOpen) {
      setSelectedConnection(activeConnection);
    }
  }, [isOpen, activeConnection]);

  // Initialize first tab when diagram opens
  useEffect(() => {
    if (isOpen && diagramTabs.length === 0) {
      const initialTabId = crypto.randomUUID();
      const initialTab: DiagramTab = {
        id: initialTabId,
        title: 'Modelo 1',
        selectedConnection: activeConnection,
        selectedTables: [],
        nodes: {},
        tableData: { columns: [], relations: [], indexes: [], primaryKeys: [], triggers: [], constraints: [] },
        notes: [],
        commentsData: {},
        showComments: {},
        pan: { x: 0, y: 0 },
        zoom: 1.0
      };
      setDiagramTabs([initialTab]);
      setActiveTabId(initialTabId);
      
      // Load initial state into active local states
      setDiagramTitle(initialTab.title);
      setSelectedConnection(initialTab.selectedConnection);
      setSelectedTables([]);
      setNodes({});
      setTableData({ columns: [], relations: [], indexes: [], primaryKeys: [], triggers: [], constraints: [] });
      setNotes([]);
      setCommentsData({});
      setShowComments({});
      setPan({ x: 0, y: 0 });
      setZoom(1.0);
      setActiveSelectedNodes([]);
      fetchedCommentsRef.current.clear();
    }
  }, [isOpen, activeConnection, diagramTabs.length]);

  // Synchronize canvas title text field with active tab's title in tabs list
  useEffect(() => {
    if (!activeTabId) return;
    setDiagramTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: diagramTitle } : t));
  }, [diagramTitle, activeTabId]);

  // Fetch available tables on open
  useEffect(() => {
    if (!isOpen || !selectedConnection) {
      setAvailableTables([]);
      return;
    }

    const fetchAvailableTables = async () => {
      setIsLoadingTables(true);
      try {
        const res = await fetch('/api/oracle/objects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection: selectedConnection })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al obtener tablas de la base de datos');
        
        // Extract names of TABLE objects
        const tables = (data.objects?.TABLE || []).map((obj: any) => obj.name || obj);
        setAvailableTables(tables);
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setIsLoadingTables(false);
      }
    };

    fetchAvailableTables();
  }, [isOpen, selectedConnection]);

  // Fetch columns and relations when selected tables change
  useEffect(() => {
    if (selectedTables.length === 0) {
      setTableData({ columns: [], relations: [], indexes: [], primaryKeys: [], triggers: [], constraints: [] });
      return;
    }

    const fetchMetadata = async () => {
      if (!selectedConnection) {
        // Offline mode: do not fetch from DB, use whatever is already in tableData (loaded from JSON)
        return;
      }
      setIsLoadingMetadata(true);
      try {
        const res = await fetch('/api/oracle/table-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: selectedConnection,
            tables: selectedTables
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cargar metadatos relacionales');
        
        setTableData({
          columns: data.columns || [],
          relations: data.relations || [],
          indexes: data.indexes || [],
          primaryKeys: data.primaryKeys || [],
          triggers: data.triggers || [],
          constraints: data.constraints || []
        });

        // Automatically fetch comments for any table that doesn't have them
        selectedTables.forEach(t => {
          fetchCommentsForTable(t);
        });
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    fetchMetadata();
  }, [selectedTables, selectedConnection]);

  // Handle table selection toggle
  const handleToggleTable = (tableName: string) => {
    if (selectedTables.includes(tableName)) {
      setSelectedTables(prev => prev.filter(t => t !== tableName));
      setNodes(prev => {
        const updated = { ...prev };
        delete updated[tableName];
        return updated;
      });
      setActiveSelectedNodes(prev => prev.filter(t => t !== tableName));
    } else {
      setSelectedTables(prev => [...prev, tableName]);
      // Set default position near the center of visible view or random offset
      setNodes(prev => ({
        ...prev,
        [tableName]: {
          x: 200 + Math.random() * 100 - pan.x / zoom,
          y: 200 + Math.random() * 100 - pan.y / zoom,
          width: 240,
          height: 250,
          color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
        }
      }));
      // Fetch comments automatically
      fetchCommentsForTable(tableName);
    }
  };

  const handleSelectAll = () => {
    setSelectedTables(availableTables);
    const newNodes: Record<string, NodeState> = {};
    availableTables.forEach((tableName, idx) => {
      newNodes[tableName] = {
        x: 100 + (idx % 4) * 280,
        y: 100 + Math.floor(idx / 4) * 290,
        width: 240,
        height: 250,
        color: PRESET_COLORS[idx % PRESET_COLORS.length]
      };
      // Fetch comments automatically
      fetchCommentsForTable(tableName);
    });
    setNodes(newNodes);
    showToast('Todas las tablas añadidas al diagrama', 'info');
  };

  const handleClearAll = () => {
    setSelectedTables([]);
    setNodes({});
    setNotes([]);
    setActiveSelectedNodes([]);
    setCommentsData({});
    setShowComments({});
    fetchedCommentsRef.current.clear();
    showToast('Lienzo limpiado', 'info');
  };

  // Dragging Node Logic
  const handleNodeHeaderMouseDown = (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (resizingNodeId || resizingIndexNodeId) return;

    // Trigger selection logic
    handleNodeMouseDown(e, tableName);

    setDraggingNodeId(tableName);
    let x = 0;
    let y = 0;
    if (tableName.startsWith('note-')) {
      const noteId = tableName.replace('note-', '');
      const note = notes.find(n => n.id === noteId);
      if (note) {
        x = note.x;
        y = note.y;
      }
    } else {
      const node = nodes[tableName];
      if (node) {
        x = node.x;
        y = node.y;
      }
    }
    
    setDragOffset({
      x: e.clientX - x * zoom,
      y: e.clientY - y * zoom
    });
  };

  // Resizing Node Logic
  const handleResizeHandleMouseDown = (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingNodeId(tableName);
    
    let width = 200;
    let height = 150;
    if (tableName.startsWith('note-')) {
      const noteId = tableName.replace('note-', '');
      const note = notes.find(n => n.id === noteId);
      if (note) {
        width = note.width;
        height = note.height;
      }
    } else {
      const node = nodes[tableName];
      if (node) {
        width = node.width;
        height = node.height;
      }
    }
    
    setInitialResizeDims({ width, height });
    setResizeStartPos({
      x: e.clientX,
      y: e.clientY
    });
  };

  // Canvas Panning Logic
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (draggingNodeId || resizingNodeId || resizingIndexNodeId) return;

    // Clear selection if we click on the canvas directly and not holding Ctrl
    if (!e.ctrlKey && !e.metaKey) {
      setActiveSelectedNodes([]);
    }

    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  };

  const handleIndexDividerMouseDown = (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingIndexNodeId(tableName);
    const node = nodes[tableName];
    setInitialIndexesHeight(node.indexesHeight || 80);
    setResizeIndexStartPos({
      y: e.clientY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggingNodeId) {
      // Divide by zoom so the node movement follows the mouse speed under scale
      const x = (e.clientX - dragOffset.x) / zoom;
      const y = (e.clientY - dragOffset.y) / zoom;
      if (draggingNodeId.startsWith('note-')) {
        const noteId = draggingNodeId.replace('note-', '');
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, x, y } : n));
      } else {
        setNodes(prev => ({
          ...prev,
          [draggingNodeId]: {
            ...prev[draggingNodeId],
            x,
            y
          }
        }));
      }
    } else if (resizingNodeId) {
      const dx = (e.clientX - resizeStartPos.x) / zoom;
      const dy = (e.clientY - resizeStartPos.y) / zoom;
      if (resizingNodeId.startsWith('note-')) {
        const noteId = resizingNodeId.replace('note-', '');
        setNotes(prev => prev.map(n => n.id === noteId ? {
          ...n,
          width: Math.max(120, initialResizeDims.width + dx),
          height: Math.max(80, initialResizeDims.height + dy)
        } : n));
      } else {
        setNodes(prev => ({
          ...prev,
          [resizingNodeId]: {
            ...prev[resizingNodeId],
            width: Math.max(160, initialResizeDims.width + dx),
            height: Math.max(120, initialResizeDims.height + dy)
          }
        }));
      }
    } else if (resizingIndexNodeId) {
      const dy = (e.clientY - resizeIndexStartPos.y) / zoom;
      const node = nodes[resizingIndexNodeId];
      const maxIdxHeight = node.height - 40 - 50; // Header is 40, cols need at least 50
      const newHeight = Math.max(30, Math.min(maxIdxHeight, initialIndexesHeight - dy));
      setNodes(prev => ({
        ...prev,
        [resizingIndexNodeId]: {
          ...prev[resizingIndexNodeId],
          indexesHeight: newHeight
        }
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setResizingNodeId(null);
    setResizingIndexNodeId(null);
  };

  // Zooming Logic
  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(3.0, zoom * zoomFactor);
    } else {
      newZoom = Math.max(0.2, zoom / zoomFactor);
    }
    
    // Zoom relative to pointer position
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const prevX = (mouseX - pan.x) / zoom;
      const prevY = (mouseY - pan.y) / zoom;
      
      setZoom(newZoom);
      setPan({
        x: mouseX - prevX * newZoom,
        y: mouseY - prevY * newZoom
      });
    }
  };

  const handleZoomIn = () => setZoom(z => Math.min(3.0, z * 1.2));
  const handleZoomOut = () => setZoom(z => Math.max(0.2, z / 1.2));
  const handleZoomReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Node selection helper
  const handleNodeMouseDown = (e: React.MouseEvent, tableName: string) => {
    if ((e.target as HTMLElement).closest('button')) return;

    if (e.ctrlKey || e.metaKey) {
      setActiveSelectedNodes(prev => {
        if (prev.includes(tableName)) {
          return prev.filter(t => t !== tableName);
        } else {
          return [...prev, tableName];
        }
      });
    } else {
      if (!activeSelectedNodes.includes(tableName)) {
        setActiveSelectedNodes([tableName]);
      }
    }
  };

  // Right click context menu (DDL) helper
  const handleNodeContextMenu = (e: React.MouseEvent, tableName: string) => {
    e.preventDefault();
    e.stopPropagation();

    let targetTables = activeSelectedNodes;
    if (!activeSelectedNodes.includes(tableName)) {
      targetTables = [tableName];
      setActiveSelectedNodes([tableName]);
    }

    setDdlModalTables(targetTables);
    setIsDdlModalOpen(true);
  };

  // DDL builder
  const generateDdl = (selectedTablesSubset: string[]) => {
    const escapeSqlString = (str: string) => str.replace(/'/g, "''");

    // Helper to clean SQL expressions/triggers: lowercase all identifiers and strip double quotes
    // while preserving case inside single-quoted string literals.
    const cleanSqlExpression = (expr: string) => {
      if (!expr) return '';
      const parts = expr.split("'");
      for (let i = 0; i < parts.length; i += 2) {
        parts[i] = parts[i].replace(/"/g, '').toLowerCase();
      }
      return parts.join("'");
    };

    let ddl = `-- =============================================================================\n`;
    ddl += `-- SCRIPT DE CONSTRUCCIÓN DDL (Generado Automáticamente)\n`;
    ddl += `-- Tablas seleccionadas: ${selectedTablesSubset.map(t => t.toLowerCase().replace(/"/g, '')).join(', ')}\n`;
    ddl += `-- =============================================================================\n\n`;

    // 0. CREATE SEQUENCE statements (Detect sequences in trigger DDLs)
    const allSequencesFound = new Set<string>();
    selectedTablesSubset.forEach(t => {
      const tableTriggers = (tableData.triggers || []).filter(tr => tr.tableName === t);
      tableTriggers.forEach(tr => {
        if (tr.triggerDdl) {
          const seqRegex = /"?([A-Za-z0-9_]+)"?\.nextval/gi;
          let match;
          while ((match = seqRegex.exec(tr.triggerDdl)) !== null) {
            allSequencesFound.add(match[1].toLowerCase());
          }
        }
      });
    });

    if (allSequencesFound.size > 0) {
      ddl += `-- =============================================================================\n`;
      ddl += `-- SECUENCIAS (Detectadas en disparadores de inserción)\n`;
      ddl += `-- =============================================================================\n\n`;
      allSequencesFound.forEach(seq => {
        ddl += `CREATE SEQUENCE ${seq} START WITH 1 INCREMENT BY 1;\n`;
      });
      ddl += `\n`;
    }

    // 1. CREATE TABLE statements
    selectedTablesSubset.forEach(t => {
      const cleanTableName = t.toLowerCase().replace(/"/g, '');
      const cols = tableData.columns.filter(c => c.tableName === t);
      const pks = tableData.primaryKeys ? tableData.primaryKeys.filter(pk => pk.tableName === t) : [];
      
      ddl += `CREATE TABLE ${cleanTableName} (\n`;
      
      const colLines = cols.map(c => {
        const isNullable = c.nullable === 'Y';
        const cleanColName = c.columnName.toLowerCase().replace(/"/g, '');
        return `  ${cleanColName.padEnd(25)} ${c.dataType.toLowerCase()} ${isNullable ? 'NULL' : 'NOT NULL'}`;
      });
      
      if (pks.length > 0) {
        const pkCols = pks.map(pk => pk.columnName.toLowerCase().replace(/"/g, '')).join(', ');
        const constraintName = (pks[0].constraintName || `PK_${t}`).toLowerCase().replace(/"/g, '');
        colLines.push(`  CONSTRAINT ${constraintName} PRIMARY KEY (${pkCols})`);
      }
      
      ddl += colLines.join(',\n');
      ddl += `\n);\n\n`;

      // 1.1 TABLE & COLUMN COMMENTS
      const comments = commentsData[t];
      if (comments) {
        let hasComments = false;
        if (comments.tableComment) {
          ddl += `COMMENT ON TABLE ${cleanTableName} IS '${escapeSqlString(comments.tableComment)}';\n`;
          hasComments = true;
        }
        Object.entries(comments.columns || {}).forEach(([colName, colComment]) => {
          if (colComment) {
            const cleanColName = colName.toLowerCase().replace(/"/g, '');
            ddl += `COMMENT ON COLUMN ${cleanTableName}.${cleanColName} IS '${escapeSqlString(colComment)}';\n`;
            hasComments = true;
          }
        });
        if (hasComments) {
          ddl += `\n`;
        }
      }
    });

    // 2. ALTER TABLE for Foreign Keys (Even if the referenced table is not in the graph)
    let hasRelations = false;
    selectedTablesSubset.forEach(t => {
      const rels = tableData.relations.filter(rel => rel.fromTable === t);
      
      if (rels.length > 0) {
        if (!hasRelations) {
          ddl += `-- =============================================================================\n`;
          ddl += `-- RELACIONES (Claves Foráneas)\n`;
          ddl += `-- =============================================================================\n\n`;
          hasRelations = true;
        }
        
        rels.forEach(rel => {
          const fromTable = rel.fromTable.toLowerCase().replace(/"/g, '');
          const constraintName = rel.constraintName.toLowerCase().replace(/"/g, '');
          const fromColumn = rel.fromColumn.toLowerCase().replace(/"/g, '');
          const toTable = rel.toTable.toLowerCase().replace(/"/g, '');
          const toColumn = rel.toColumn.toLowerCase().replace(/"/g, '');

          ddl += `ALTER TABLE ${fromTable}\n`;
          ddl += `  ADD CONSTRAINT ${constraintName}\n`;
          ddl += `  FOREIGN KEY (${fromColumn})\n`;
          ddl += `  REFERENCES ${toTable} (${toColumn});\n\n`;
        });
      }
    });

    // 3. ALTER TABLE for Unique and Check Constraints (excluding NOT NULL system constraints)
    let hasConstraintsHeader = false;
    selectedTablesSubset.forEach(t => {
      const tableConstraints = (tableData.constraints || []).filter(c => c.tableName === t);
      if (tableConstraints.length > 0) {
        const constraintGroups: Record<string, { constraintName: string; constraintType: string; columns: string[]; searchCondition: string | null }> = {};
        tableConstraints.forEach(c => {
          if (!constraintGroups[c.constraintName]) {
            constraintGroups[c.constraintName] = {
              constraintName: c.constraintName,
              constraintType: c.constraintType,
              columns: [],
              searchCondition: c.searchCondition
            };
          }
          if (c.columnName) {
            constraintGroups[c.constraintName].columns.push(c.columnName);
          }
        });

        let tableConstraintDdl = '';
        Object.values(constraintGroups).forEach(cg => {
          const cleanTableName = t.toLowerCase().replace(/"/g, '');
          const cleanConstraintName = cg.constraintName.toLowerCase().replace(/"/g, '');

          if (cg.constraintType === 'U') {
            const colsStr = cg.columns.map(c => c.toLowerCase().replace(/"/g, '')).join(', ');
            tableConstraintDdl += `ALTER TABLE ${cleanTableName} ADD CONSTRAINT ${cleanConstraintName} UNIQUE (${colsStr});\n`;
          } else if (cg.constraintType === 'C') {
            const isNotNull = cg.searchCondition && /is\s+not\s+null/i.test(cg.searchCondition);
            if (!isNotNull && cg.searchCondition) {
              const cleanCondition = cleanSqlExpression(cg.searchCondition);
              tableConstraintDdl += `ALTER TABLE ${cleanTableName} ADD CONSTRAINT ${cleanConstraintName} CHECK (${cleanCondition});\n`;
            }
          }
        });

        if (tableConstraintDdl) {
          if (!hasConstraintsHeader) {
            ddl += `-- =============================================================================\n`;
            ddl += `-- RESTRICCIONES (Constraints)\n`;
            ddl += `-- =============================================================================\n\n`;
            hasConstraintsHeader = true;
          }
          ddl += tableConstraintDdl + '\n';
        }
      }
    });

    // 4. CREATE INDEX statements (excluding PK/Unique auto-generated indexes)
    let hasIndexesHeader = false;
    selectedTablesSubset.forEach(t => {
      const tableIndexes = (tableData.indexes || []).filter(idx => idx.tableName === t);
      if (tableIndexes.length > 0) {
        const indexGroups: Record<string, { indexName: string; uniqueness: string; columns: { columnName: string; descend: string }[] }> = {};
        tableIndexes.forEach(idx => {
          if (!indexGroups[idx.indexName]) {
            indexGroups[idx.indexName] = {
              indexName: idx.indexName,
              uniqueness: idx.uniqueness,
              columns: []
            };
          }
          indexGroups[idx.indexName].columns.push({
            columnName: idx.columnName,
            descend: idx.descend || 'ASC'
          });
        });

        let tableIndexDdl = '';
        Object.values(indexGroups).forEach(idx => {
          const isPkIndex = tableData.primaryKeys?.some(pk => pk.tableName === t && pk.constraintName === idx.indexName);
          const isUniqueConstraintIndex = tableData.constraints?.some(c => c.tableName === t && c.constraintName === idx.indexName && c.constraintType === 'U');
          
          if (isPkIndex || isUniqueConstraintIndex) {
            return;
          }

          const uniqueStr = idx.uniqueness === 'UNIQUE' ? 'UNIQUE ' : '';
          const cleanIndexName = idx.indexName.toLowerCase().replace(/"/g, '');
          const cleanTableName = t.toLowerCase().replace(/"/g, '');
          const colsStr = idx.columns.map(c => `${c.columnName.toLowerCase().replace(/"/g, '')} ${c.descend === 'DESC' ? 'DESC' : 'ASC'}`).join(', ');
          tableIndexDdl += `CREATE ${uniqueStr}INDEX ${cleanIndexName} ON ${cleanTableName} (${colsStr});\n`;
        });

        if (tableIndexDdl) {
          if (!hasIndexesHeader) {
            ddl += `-- =============================================================================\n`;
            ddl += `-- ÍNDICES DE LAS TABLAS\n`;
            ddl += `-- =============================================================================\n\n`;
            hasIndexesHeader = true;
          }
          ddl += tableIndexDdl + '\n';
        }
      }
    });

    // 5. TRIGGERS
    let hasTriggers = false;
    selectedTablesSubset.forEach(t => {
      const tableTriggers = (tableData.triggers || []).filter(tr => tr.tableName === t);
      if (tableTriggers.length > 0) {
        if (!hasTriggers) {
          ddl += `-- =============================================================================\n`;
          ddl += `-- DISPARADORES (Triggers)\n`;
          ddl += `-- =============================================================================\n\n`;
          hasTriggers = true;
        }
        tableTriggers.forEach(tr => {
          if (tr.triggerDdl) {
            let cleanedTriggerDdl = tr.triggerDdl;

            // Remove EDITIONABLE / NONEDITIONABLE keywords
            cleanedTriggerDdl = cleanedTriggerDdl.replace(/\b(EDITIONABLE|NONEDITIONABLE)\b\s*/gi, '');

            // Remove connection schema prefix if available
            const targetSchema = selectedConnection?.user;
            if (targetSchema) {
              const escapedSchema = targetSchema.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              const schemaRegex = new RegExp(`(?:"${escapedSchema}"|${escapedSchema})\\s*\\.\\s*`, 'gi');
              cleanedTriggerDdl = cleanedTriggerDdl.replace(schemaRegex, '');
            }

            // General uppercase schema prefix removal: "SOME_SCHEMA"."MY_TABLE" -> "MY_TABLE"
            // excluding keywords like NEW, OLD, PARENT, ROW
            cleanedTriggerDdl = cleanedTriggerDdl.replace(/(?:"([A-Z0-9_]+)"|([A-Z0-9_]+))\s*\.\s*/g, (match, g1, g2) => {
              const name = (g1 || g2).toUpperCase();
              if (['NEW', 'OLD', 'PARENT', 'ROW'].includes(name)) {
                return match;
              }
              return '';
            });

            // Convert names to lowercase and strip double quotes (preserving single quotes literals)
            cleanedTriggerDdl = cleanSqlExpression(cleanedTriggerDdl);

            ddl += `${cleanedTriggerDdl.trim()}\n/\n\n`;
          }
        });
      }
    });

    return ddl;
  };

  const generatedDdl = useMemo(() => {
    if (ddlModalTables.length === 0) return '';
    return generateDdl(ddlModalTables);
  }, [ddlModalTables, tableData, commentsData]);

  const handleSaveDdlToFile = () => {
    const blob = new Blob([generatedDdl], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `script_construccion_${ddlModalTables.join('_')}.sql`);
    showToast('Script guardado en archivo', 'success');
  };

  const handleSwitchTab = (targetTabId: string) => {
    if (targetTabId === activeTabId) return;
    
    // Save current active tab state
    setDiagramTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            title: diagramTitle,
            selectedConnection,
            selectedTables,
            nodes,
            tableData,
            notes,
            commentsData,
            showComments,
            pan,
            zoom
          };
        }
        return t;
      });

      // Find target tab
      const targetTab = updated.find(t => t.id === targetTabId);
      if (targetTab) {
        // Load target state
        setDiagramTitle(targetTab.title);
        setSelectedConnection(targetTab.selectedConnection);
        setSelectedTables(targetTab.selectedTables);
        setNodes(targetTab.nodes);
        setTableData(targetTab.tableData);
        setNotes(targetTab.notes);
        setCommentsData(targetTab.commentsData);
        setShowComments(targetTab.showComments);
        setPan(targetTab.pan);
        setZoom(targetTab.zoom);
        setActiveSelectedNodes([]);
        
        // Repopulate fetched comments ref cache
        fetchedCommentsRef.current.clear();
        Object.keys(targetTab.commentsData).forEach(k => fetchedCommentsRef.current.add(k));
      }

      return updated;
    });

    setActiveTabId(targetTabId);
  };

  const handleAddTab = () => {
    // Save current active tab state first
    setDiagramTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            title: diagramTitle,
            selectedConnection,
            selectedTables,
            nodes,
            tableData,
            notes,
            commentsData,
            showComments,
            pan,
            zoom
          };
        }
        return t;
      });

      const newTabId = crypto.randomUUID();
      const newTab: DiagramTab = {
        id: newTabId,
        title: `Modelo ${updated.length + 1}`,
        selectedConnection: activeConnection, // use parent's active database connection by default
        selectedTables: [],
        nodes: {},
        tableData: { columns: [], relations: [], indexes: [], primaryKeys: [], triggers: [], constraints: [] },
        notes: [],
        commentsData: {},
        showComments: {},
        pan: { x: 0, y: 0 },
        zoom: 1.0
      };

      // Load new tab blank state
      setDiagramTitle(newTab.title);
      setSelectedConnection(newTab.selectedConnection);
      setSelectedTables([]);
      setNodes({});
      setTableData({ columns: [], relations: [], indexes: [], primaryKeys: [], triggers: [], constraints: [] });
      setNotes([]);
      setCommentsData({});
      setShowComments({});
      setPan({ x: 0, y: 0 });
      setZoom(1.0);
      setActiveSelectedNodes([]);
      fetchedCommentsRef.current.clear();

      setActiveTabId(newTabId);
      return [...updated, newTab];
    });
  };

  const saveTabJson = (tabToSave: DiagramTab) => {
    const model = {
      title: tabToSave.id === activeTabId ? diagramTitle : tabToSave.title,
      tables: tabToSave.id === activeTabId ? selectedTables : tabToSave.selectedTables,
      nodes: tabToSave.id === activeTabId ? nodes : tabToSave.nodes,
      notes: tabToSave.id === activeTabId ? notes : tabToSave.notes,
      pan: tabToSave.id === activeTabId ? pan : tabToSave.pan,
      zoom: tabToSave.id === activeTabId ? zoom : tabToSave.zoom,
      commentsData: tabToSave.id === activeTabId ? commentsData : tabToSave.commentsData,
      showComments: tabToSave.id === activeTabId ? showComments : tabToSave.showComments,
      tableData: tabToSave.id === activeTabId ? tableData : tabToSave.tableData,
      savedConnection: (tabToSave.id === activeTabId ? selectedConnection : tabToSave.selectedConnection)
        ? {
            name: (tabToSave.id === activeTabId ? selectedConnection : tabToSave.selectedConnection).name,
            user: (tabToSave.id === activeTabId ? selectedConnection : tabToSave.selectedConnection).user,
            host: (tabToSave.id === activeTabId ? selectedConnection : tabToSave.selectedConnection).host,
            port: (tabToSave.id === activeTabId ? selectedConnection : tabToSave.selectedConnection).port,
            serviceName: (tabToSave.id === activeTabId ? selectedConnection : tabToSave.selectedConnection).serviceName
          }
        : 'Fuera de Línea'
    };
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `modelo_relacional_${model.title.replace(/\s+/g, '_')}.json`);
    showToast(`Modelo '${model.title}' guardado`, 'success');
  };

  const performCloseTab = (tabId: string) => {
    setDiagramTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      
      // If we closed the active tab, switch to another one
      if (tabId === activeTabId) {
        const nextActiveTab = filtered[0];
        setActiveTabId(nextActiveTab.id);
        
        // Load its state
        setDiagramTitle(nextActiveTab.title);
        setSelectedConnection(nextActiveTab.selectedConnection);
        setSelectedTables(nextActiveTab.selectedTables);
        setNodes(nextActiveTab.nodes);
        setTableData(nextActiveTab.tableData);
        setNotes(nextActiveTab.notes);
        setCommentsData(nextActiveTab.commentsData);
        setShowComments(nextActiveTab.showComments);
        setPan(nextActiveTab.pan);
        setZoom(nextActiveTab.zoom);
        setActiveSelectedNodes([]);
        
        fetchedCommentsRef.current.clear();
        Object.keys(nextActiveTab.commentsData).forEach(k => fetchedCommentsRef.current.add(k));
      }
      
      return filtered;
    });
    setTabToClose(null);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (diagramTabs.length === 1) {
      showToast('Debe haber al menos un modelo activo.', 'info');
      return;
    }

    const tab = diagramTabs.find(t => t.id === tabId);
    if (!tab) return;

    const hasContent = tabId === activeTabId
      ? (selectedTables.length > 0 || notes.length > 0)
      : (tab.selectedTables.length > 0 || tab.notes.length > 0);

    if (hasContent) {
      setTabToClose(tabId);
    } else {
      performCloseTab(tabId);
    }
  };

  const handleConnectionChange = (connectionId: string) => {
    if (connectionId === 'offline') {
      setSelectedConnection(null);
      showToast('Cambiado a Modo Fuera de Línea', 'info');
    } else {
      const conn = connections.find(c => c.id === connectionId);
      if (conn) {
        setSelectedConnection(conn);
        // Clear canvas metadata when switching connection to avoid mixing database schemas
        setSelectedTables([]);
        setNodes({});
        setNotes([]);
        setTableData({ columns: [], relations: [], indexes: [], primaryKeys: [], triggers: [], constraints: [] });
        setCommentsData({});
        setShowComments({});
        fetchedCommentsRef.current.clear();
        showToast(`Cambiado a conexión: ${conn.name}`, 'success');
      }
    }
  };

  // Keyboard listeners for Ctrl+A Select All
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setActiveSelectedNodes(selectedTables);
        showToast('Todas las tablas seleccionadas en el lienzo', 'info');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, selectedTables]);

  // Save layout to JSON
  const handleSaveJson = () => {
    const model = {
      title: diagramTitle,
      tables: selectedTables,
      nodes,
      notes,
      pan,
      zoom,
      commentsData,
      showComments,
      tableData,
      savedConnection: selectedConnection 
        ? {
            name: selectedConnection.name,
            user: selectedConnection.user,
            host: selectedConnection.host,
            port: selectedConnection.port,
            serviceName: selectedConnection.serviceName
          }
        : 'Fuera de Línea'
    };
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `modelo_relacional_${selectedConnection?.name || 'db'}.json`);
    showToast('Modelo relacional guardado', 'success');
  };

  // Open layout from JSON
  const handleOpenJsonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const loadDiagramModel = (model: any) => {
    if (!model.tables || !model.nodes) {
      throw new Error('Formato JSON de modelo inválido.');
    }

    const newTabId = crypto.randomUUID();
    const loadedTitle = model.title || 'Modelo Cargado';

    let updatedNotes = model.notes ? [...model.notes] : [];
    if (model.savedConnection) {
      let connInfo = '';
      if (typeof model.savedConnection === 'object' && model.savedConnection !== null) {
        const conn = model.savedConnection;
        connInfo = `🔌 Conexión: ${conn.name}\nUsuario: ${conn.user}\nHost: ${conn.host}\nPuerto: ${conn.port}\nServicio: ${conn.serviceName}`;
      } else {
        connInfo = `🌐 Conexión: ${model.savedConnection}`;
      }
      const noteText = `ℹ️ Información de Origen:\n${connInfo}\nFecha de carga: ${new Date().toLocaleDateString()}`;

      // Remove previous origin info notes to avoid duplication
      updatedNotes = updatedNotes.filter((n: any) => !n.text.includes('Información de Origen:'));

      updatedNotes.push({
        id: `origin-note-${Date.now()}`,
        x: 50 - (model.pan?.x || 0) / (model.zoom || 1.0),
        y: 50 - (model.pan?.y || 0) / (model.zoom || 1.0),
        width: 280,
        height: 135,
        text: noteText,
        color: '#bfdbfe' // blue info sticky note
      });
    }

    let tabConnection: any = null;
    if (typeof model.savedConnection === 'object' && model.savedConnection !== null) {
      const matchedConn = connections.find(c => c.name === model.savedConnection.name || c.host === model.savedConnection.host);
      if (matchedConn) {
        tabConnection = matchedConn;
      }
    }
    
    // Fallback: If no matched connection was found from JSON, but there is an active connection, use it!
    if (!tabConnection && activeConnection) {
      tabConnection = activeConnection;
    }

    const newTab: DiagramTab = {
      id: newTabId,
      title: loadedTitle,
      selectedConnection: tabConnection,
      selectedTables: model.tables,
      nodes: model.nodes,
      tableData: model.tableData || { columns: [], relations: [], indexes: [], primaryKeys: [], triggers: [], constraints: [] },
      notes: updatedNotes,
      commentsData: model.commentsData || {},
      showComments: model.showComments || {},
      pan: model.pan || { x: 0, y: 0 },
      zoom: model.zoom || 1.0
    };

    // Save active first, then append new loaded tab
    setDiagramTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            title: diagramTitle,
            selectedConnection,
            selectedTables,
            nodes,
            tableData,
            notes,
            commentsData,
            showComments,
            pan,
            zoom
          };
        }
        return t;
      });

      // Load the new tab's state
      setDiagramTitle(newTab.title);
      setSelectedConnection(newTab.selectedConnection);
      setSelectedTables(newTab.selectedTables);
      setNodes(newTab.nodes);
      setTableData(newTab.tableData);
      setNotes(newTab.notes);
      setCommentsData(newTab.commentsData);
      setShowComments(newTab.showComments);
      setPan(newTab.pan);
      setZoom(newTab.zoom);
      setActiveSelectedNodes([]);

      fetchedCommentsRef.current.clear();
      Object.keys(newTab.commentsData).forEach(t => fetchedCommentsRef.current.add(t));

      return [...updated, newTab];
    });

    setActiveTabId(newTabId);

    // Fetch comments for tables in model if they aren't loaded and we have connection
    if (tabConnection) {
      model.tables.forEach((t: string) => {
        if (!model.commentsData || !model.commentsData[t]) {
          fetchCommentsForTable(t);
        }
      });
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const model = JSON.parse(event.target?.result as string);
        loadDiagramModel(model);
        showToast(`Modelo '${model.title || 'Modelo Cargado'}' cargado en una nueva pestaña`, 'success');
      } catch (err: any) {
        showToast(`Error al cargar JSON: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  // Color selection for a node
  const handleSetNodeColor = (tableName: string, color: string) => {
    setNodes(prev => ({
      ...prev,
      [tableName]: {
        ...prev[tableName],
        color
      }
    }));
  };

  const handleUpdateNoteColor = (id: string, color: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, color } : n));
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    showToast('Nota eliminada', 'info');
  };

  const handleUpdateNoteText = (id: string, text: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  };

  const handleAddNote = () => {
    const newNote: NoteState = {
      id: crypto.randomUUID(),
      x: 250 - pan.x / zoom,
      y: 150 - pan.y / zoom,
      width: 200,
      height: 150,
      text: 'Escribe tu nota aquí...',
      color: '#fef08a'
    };
    setNotes(prev => [...prev, newNote]);
    showToast('Nota agregada al lienzo', 'info');
  };

  const fetchCommentsForTable = async (tableName: string) => {
    if (fetchedCommentsRef.current.has(tableName)) {
      setShowComments(prev => ({
        ...prev,
        [tableName]: true
      }));
      return;
    }

    if (!activeConnection) {
      // Offline mode: just show comments if already present in state
      setShowComments(prev => ({
        ...prev,
        [tableName]: true
      }));
      return;
    }

    fetchedCommentsRef.current.add(tableName);
    setLoadingComments(prev => ({ ...prev, [tableName]: true }));
    try {
      const res = await fetch('/api/oracle/table-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          tableName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar comentarios');

      const colMap: Record<string, string> = {};
      (data.columnComments || []).forEach((c: any) => {
        colMap[c.columnName] = c.comment;
      });

      setCommentsData(prev => ({
        ...prev,
        [tableName]: {
          tableComment: data.tableComment || '',
          columns: colMap
        }
      }));

      setShowComments(prev => ({
        ...prev,
        [tableName]: true
      }));
    } catch (err: any) {
      fetchedCommentsRef.current.delete(tableName); // allow retry
      showToast(err.message, 'error');
    } finally {
      setLoadingComments(prev => ({ ...prev, [tableName]: false }));
    }
  };

  const handleToggleComments = async (tableName: string) => {
    if (commentsData[tableName]) {
      setShowComments(prev => ({
        ...prev,
        [tableName]: !prev[tableName]
      }));
    } else {
      await fetchCommentsForTable(tableName);
    }
  };

  // Filtered available tables list
  const filteredTables = useMemo(() => {
    const q = tableSearch.toLowerCase();
    return availableTables.filter(t => t.toLowerCase().includes(q));
  }, [availableTables, tableSearch]);

  const isColumnInHoveredRelation = (tableName: string, columnName: string) => {
    if (!hoveredRelation) return false;
    const [fromPart, toPart] = hoveredRelation.split('->');
    if (!fromPart || !toPart) return false;
    const [fromTab, fromCol] = fromPart.split('.');
    const [toTab, toCol] = toPart.split('.');
    return (tableName === fromTab && columnName === fromCol) || (tableName === toTab && columnName === toCol);
  };

  // Render SVG Edges (foreign key lines)
  const renderEdges = useMemo(() => {
    const drawnKeys = new Set<string>();
    
    return tableData.relations.map((rel, index) => {
      const fromNode = nodes[rel.fromTable];
      const toNode = nodes[rel.toTable];
      
      if (!fromNode || !toNode) return null;
      
      // Prevent rendering exact duplicate relations repeatedly
      const relKey = `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;
      if (drawnKeys.has(relKey)) return null;
      drawnKeys.add(relKey);

      // Node bounding box coords
      const from = {
        x1: fromNode.x,
        y1: fromNode.y,
        x2: fromNode.x + fromNode.width,
        y2: fromNode.y + fromNode.height,
        cx: fromNode.x + fromNode.width / 2,
        cy: fromNode.y + fromNode.height / 2
      };
      
      const to = {
        x1: toNode.x,
        y1: toNode.y,
        x2: toNode.x + toNode.width,
        y2: toNode.y + toNode.height,
        cx: toNode.x + toNode.width / 2,
        cy: toNode.y + toNode.height / 2
      };

      // Find the closest borders/anchors to draw the line
      let startX = from.cx;
      let startY = from.cy;
      let endX = to.cx;
      let endY = to.cy;

      // Determine left/right/top/bottom anchor positions based on relative nodes placement
      if (from.x2 < to.x1) {
        // From node is to the left of To node
        startX = from.x2;
        endX = to.x1;
      } else if (from.x1 > to.x2) {
        // From node is to the right of To node
        startX = from.x1;
        endX = to.x2;
      } else {
        // Nodes overlap horizontally, use vertical connection
        if (from.y2 < to.y1) {
          startY = from.y2;
          endY = to.y1;
        } else if (from.y1 > to.y2) {
          startY = from.y1;
          endY = to.y2;
        }
      }

      // Draw a nice smooth cubic Bezier curve
      const dx = Math.abs(endX - startX);
      const dy = Math.abs(endY - startY);
      
      let controlDist = dx * 0.5;
      if (controlDist < 50) controlDist = 50; // minimum curvature

      let cx1 = startX;
      let cy1 = startY;
      let cx2 = endX;
      let cy2 = endY;

      if (startX < endX) {
        cx1 += controlDist;
        cx2 -= controlDist;
      } else if (startX > endX) {
        cx1 -= controlDist;
        cx2 += controlDist;
      } else {
        // vertical connection curve
        const vDist = dy * 0.5;
        if (startY < endY) {
          cy1 += vDist;
          cy2 -= vDist;
        } else {
          cy1 -= vDist;
          cy2 += vDist;
        }
      }

      const pathData = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

      const isHovered = hoveredRelation === relKey;
      const isAnyHovered = hoveredRelation !== null;
      const opacity = isAnyHovered ? (isHovered ? 1.0 : 0.25) : 0.75;
      
      const strokeColor = isHovered ? '#f59e0b' : '#3b82f6';
      const strokeWidth = isHovered ? 3.5 : 2;
      const textColor = isHovered 
        ? (isDark ? '#fbbf24' : '#b45309') 
        : (isDark ? '#93c5fd' : '#1e3a8a');
      const textFontSize = isHovered ? "11" : "8";

      return (
        <g 
          key={`${rel.constraintName}-${index}`}
          style={{ opacity, transition: 'opacity 0.2s ease-in-out' }}
        >
          {/* Glowing background line for hover effect (much wider for easy hovering) */}
          <path
            d={pathData}
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredRelation(relKey)}
            onMouseLeave={() => setHoveredRelation(null)}
          >
            <title>{`${rel.constraintName}: ${rel.fromTable}(${rel.fromColumn}) -> ${rel.toTable}(${rel.toColumn})`}</title>
          </path>

          {/* Visual glow path when hovered */}
          {isHovered && (
            <path
              d={pathData}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={strokeWidth + 4}
              className="opacity-20 pointer-events-none"
            />
          )}

          {/* Main edge path */}
          <path
            d={pathData}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            markerEnd={isHovered ? "url(#arrow-hover)" : "url(#arrow)"}
            className="pointer-events-none transition-all duration-150"
          />
          {/* Label indicating constraint (small background pill) */}
          <text
            x={(startX + endX) / 2}
            y={(startY + endY) / 2 - 4}
            fill={textColor}
            fontSize={textFontSize}
            fontFamily="monospace"
            textAnchor="middle"
            className="select-none pointer-events-none font-bold transition-all duration-150"
            style={{ textShadow: isDark ? '0 1px 2px #000' : '0 1px 2px #fff' }}
          >
            {rel.fromColumn} ➜ {rel.toColumn}
          </text>
        </g>
      );
    });
  }, [tableData.relations, nodes, isDark, hoveredRelation]);

  if (!isOpen) return null;

  const bgStyle = isDark 
    ? 'bg-gray-950 text-gray-200' 
    : 'bg-gray-50 text-gray-800';

  const gridBackground = isDark
    ? 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)'
    : 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)';

  return (
    <div className={`fixed inset-0 z-[500] flex flex-col ${bgStyle} font-sans select-none overflow-hidden animate-fade-in`}>
      {/* ── Top Navigation Bar ───────────────────────────────────────────── */}
      <div className={`h-14 border-b flex items-center px-4 justify-between ${
        isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-blue-500" />
          <div className="flex flex-col">
            <h2 className="font-bold text-sm tracking-tight">Diseñador Relacional (ERD)</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <select
                value={selectedConnection?.id || 'offline'}
                onChange={(e) => handleConnectionChange(e.target.value)}
                className={`text-[10px] px-2 py-0.5 rounded border outline-none font-medium cursor-pointer ${
                  isDark 
                    ? 'bg-gray-950 border-gray-800 text-gray-300 focus:ring-1 focus:ring-blue-500' 
                    : 'bg-gray-50 border-gray-300 text-gray-700 focus:ring-1 focus:ring-blue-500'
                }`}
              >
                {connections.map(c => (
                  <option key={c.id} value={c.id}>
                    🔌 {c.name}
                  </option>
                ))}
                <option value="offline">🌐 Fuera de línea</option>
              </select>
            </div>
          </div>
        </div>

        {/* Zoom & Canvas Actions */}
        <div className="flex items-center gap-1">
          <button onClick={handleZoomIn} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-12 text-center opacity-70">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={handleZoomOut} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`} title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleZoomReset} className={`p-1.5 rounded-lg border text-xs font-medium px-2.5 ${
            isDark ? 'border-gray-800 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'
          }`} title="Reset Zoom">
            1:1
          </button>

          <div className={`w-px h-6 mx-2 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />

          <button 
            onClick={handleSaveJson} 
            disabled={selectedTables.length === 0}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold px-3 ${
              isDark 
                ? 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 disabled:opacity-30' 
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-30'
            }`}
            title="Guardar modelo en archivo JSON"
          >
            <Download className="w-3.5 h-3.5" /> Guardar JSON
          </button>
          <button 
            onClick={handleOpenJsonClick}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold px-3 ${
              isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-white border hover:bg-gray-50 text-gray-600'
            }`}
            title="Abrir modelo desde archivo JSON"
          >
            <Upload className="w-3.5 h-3.5" /> Cargar JSON
          </button>

          <button 
            onClick={handleOpenSaveDb} 
            disabled={selectedTables.length === 0 || !selectedConnection}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold px-3 ${
              !selectedConnection
                ? 'opacity-40 cursor-not-allowed text-gray-500'
                : isDark 
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 disabled:opacity-30' 
                  : 'bg-yellow-50 text-yellow-700 border border-yellow-250 hover:bg-yellow-100 disabled:opacity-30'
            }`}
            title="Guardar modelo en la base de datos conectada"
          >
            <CloudUpload className="w-3.5 h-3.5" /> Guardar en BD
          </button>
          <button 
            onClick={handleOpenLoadDb}
            disabled={!selectedConnection}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold px-3 ${
              !selectedConnection
                ? 'opacity-40 cursor-not-allowed text-gray-500'
                : isDark 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600/20' 
                  : 'bg-blue-50 text-blue-600 border border-blue-250 hover:bg-blue-100'
            }`}
            title="Cargar modelo desde la base de datos conectada"
          >
            <CloudDownload className="w-3.5 h-3.5" /> Cargar de BD
          </button>
          
          <button 
            onClick={handleAddNote}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold px-3 ${
              isDark 
                ? 'bg-amber-600/10 text-amber-400 hover:bg-amber-600/20 shadow-inner' 
                : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200/50'
            }`}
            title="Agregar una nota adhesiva al lienzo"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Nota
          </button>

          <div className={`w-px h-6 mx-2 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />

          <button 
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors text-red-500 ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}
            title="Cerrar utilitario"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Tabs Bar ────────────────────────────────────────────────────── */}
      <div className={`h-10 border-b flex items-center px-4 gap-1.5 overflow-x-auto shrink-0 scrollbar-none ${
        isDark ? 'border-gray-800 bg-gray-900/40' : 'border-gray-250 bg-gray-50/50'
      }`}>
        {diagramTabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const connName = tab.selectedConnection ? tab.selectedConnection.name : 'Fuera de Línea';
          const isOffline = !tab.selectedConnection;

          return (
            <div
              key={tab.id}
              onClick={() => handleSwitchTab(tab.id)}
              className={`h-8 px-3 rounded-lg flex items-center gap-2 text-xs font-semibold cursor-pointer border transition-all select-none ${
                isActive
                  ? (isDark 
                      ? 'bg-gray-800 border-gray-700 text-white shadow shadow-black/10' 
                      : 'bg-white border-gray-200 text-gray-900 shadow-sm shadow-gray-200/50')
                  : (isDark
                      ? 'bg-transparent border-transparent text-gray-400 hover:text-gray-250 hover:bg-gray-800/30'
                      : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50')
              }`}
            >
              {/* Connection Status Icon/Dot */}
              <span className={`w-1.5 h-1.5 rounded-full ${
                isOffline ? 'bg-gray-500' : 'bg-green-500 animate-pulse'
              }`} />
              
              {/* Tab Title */}
              <span className="truncate max-w-[120px]">{isActive ? diagramTitle : tab.title}</span>

              {/* Small connection details badge */}
              <span className={`text-[9px] font-normal px-1 py-0.5 rounded ${
                isDark ? 'bg-gray-950/40 text-gray-500' : 'bg-gray-100 text-gray-450'
              }`}>
                {connName}
              </span>

              {/* Close Button */}
              <button
                onClick={(e) => handleCloseTab(tab.id, e)}
                className={`p-0.5 rounded-full transition-colors hover:bg-black/15 dark:hover:bg-white/10 ${
                  isActive ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Cerrar modelo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* Add Tab Button */}
        <button
          onClick={handleAddTab}
          className={`p-1 rounded-lg transition-colors border ${
            isDark 
              ? 'border-gray-800 hover:bg-gray-800 text-gray-450 hover:text-gray-200' 
              : 'border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-850'
          }`}
          title="Nuevo modelo relacional"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Main Content Area (Sidebar + Canvas) ─────────────────────────── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Table Selector Sidebar */}
        <div className={`w-64 flex flex-col border-r shrink-0 ${
          isDark ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white/80'
        }`}>
          <div className="p-3 border-b border-inherit space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-60">Tablas Disponibles</h3>
            <input 
              type="text"
              placeholder="Buscar tabla..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-blue-500 ${
                isDark ? 'bg-gray-950 border-gray-800 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-850'
              }`}
            />
            <div className="grid grid-cols-2 gap-1 pt-1">
              <button 
                onClick={handleSelectAll} 
                className="py-1 px-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-all text-center"
              >
                Añadir todas
              </button>
              <button 
                onClick={handleClearAll} 
                className={`py-1 px-2 rounded text-[10px] font-bold transition-all text-center ${
                  isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Limpiar lienzo
              </button>
            </div>
          </div>

          {/* Table List Scrollable */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
            {!selectedConnection ? (
              <div className="text-center py-20 px-4 text-xs opacity-50 space-y-3">
                <div className="text-2xl">🌐</div>
                <p className="font-semibold">Modo Fuera de Línea</p>
                <p className="text-[10px] leading-relaxed">Carga un archivo JSON para visualizar un modelo guardado o cambia de conexión arriba para trabajar con la base de datos.</p>
              </div>
            ) : isLoadingTables ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 opacity-60">
                <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px]">Cargando tablas...</span>
              </div>
            ) : (
              <>
                {filteredTables.map(t => {
                  const isChecked = selectedTables.includes(t);
                  return (
                    <label 
                      key={t}
                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
                        isChecked 
                          ? (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')
                          : (isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
                      }`}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTable(t)}
                        className="rounded border-gray-300 w-3.5 h-3.5 shrink-0"
                      />
                      <span className="truncate flex-1 font-mono">{t}</span>
                    </label>
                  );
                })}
                {filteredTables.length === 0 && (
                  <div className="text-center py-10 text-xs opacity-40 italic font-mono">Ninguna tabla coincide</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── INTERACTIVE CANVAS ─────────────────────────────────────────── */}
        <div 
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleCanvasWheel}
          className="flex-1 h-full overflow-hidden relative cursor-grab active:cursor-grabbing outline-none"
          style={{
            backgroundImage: gridBackground,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Zoom/Pan helper panel bottom right */}
          <div className={`absolute bottom-4 right-4 z-20 py-1.5 px-3 rounded-lg border text-[10px] font-medium pointer-events-none select-none opacity-50 ${
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            Arrastra el fondo para paneo · Rueda para zoom · Arrastra cabecera de tabla para mover
          </div>

          {/* Diagram Title Box (top left of canvas, fixed) */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <input 
              type="text"
              value={diagramTitle}
              onChange={(e) => setDiagramTitle(e.target.value)}
              placeholder="Título del Diagrama..."
              className={`px-3 py-1.5 rounded-xl border font-bold text-sm tracking-tight outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                isDark 
                  ? 'bg-gray-900/90 border-gray-800 text-gray-100 shadow-xl shadow-black/20' 
                  : 'bg-white/95 border-gray-200 text-gray-800 shadow-lg shadow-gray-250/50'
              }`}
              style={{ width: '260px' }}
              title="Haz doble clic o escribe para cambiar el título del diagrama"
            />
          </div>

          {/* Scale Container */}
          <div 
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              width: '100%',
              height: '100%',
              pointerEvents: 'none' // allow dragging canvas background through nodes empty areas
            }}
          >
            {/* SVG Relationship lines */}
            <svg 
              className="absolute inset-0 w-[10000px] h-[10000px]"
              style={{ pointerEvents: 'auto' }}
            >
              <defs>
                <marker 
                  id="arrow" 
                  viewBox="0 0 10 10" 
                  refX="8" 
                  refY="5" 
                  markerWidth="6" 
                  markerHeight="6" 
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#3b82f6" />
                </marker>
                <marker 
                  id="arrow-hover" 
                  viewBox="0 0 10 10" 
                  refX="8" 
                  refY="5" 
                  markerWidth="7" 
                  markerHeight="7" 
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#f59e0b" />
                </marker>
              </defs>
              {renderEdges}
            </svg>

            {/* Table Nodes */}
            {selectedTables.map(t => {
              const node = nodes[t];
              if (!node) return null;

              // Filter columns and indexes for this specific table
              const cols = tableData.columns.filter(c => c.tableName === t);
              const tableIndexes = (tableData.indexes || []).filter(idx => idx.tableName === t);
              
              // Group indexes by indexName
              const indexGroups: Record<string, { name: string; uniqueness: string; columns: string[] }> = {};
              tableIndexes.forEach(idx => {
                if (!indexGroups[idx.indexName]) {
                  indexGroups[idx.indexName] = {
                    name: idx.indexName,
                    uniqueness: idx.uniqueness,
                    columns: []
                  };
                }
                indexGroups[idx.indexName].columns.push(idx.columnName);
              });
              const groupedIndexes = Object.values(indexGroups);
              
              // Define dynamic styling based on color
              const headerColor = node.color || '#3b82f6';

              return (
                <div
                  key={t}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleNodeMouseDown(e, t);
                  }}
                  onContextMenu={(e) => handleNodeContextMenu(e, t)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    height: `${node.height}px`,
                    pointerEvents: 'auto', // override parent pointerEvents
                  }}
                  className={`rounded-xl shadow-2xl border flex flex-col overflow-hidden group/node backdrop-blur-md transition-all duration-150 hover:shadow-blue-500/5 ${
                    activeSelectedNodes.includes(t)
                      ? 'ring-2 ring-blue-500 border-blue-500 shadow-blue-500/20'
                      : (isDark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/95 border-gray-200')
                  }`}
                >
                  {/* Node Header (handles dragging) */}
                  <div
                    onMouseDown={(e) => handleNodeHeaderMouseDown(e, t)}
                    style={{ backgroundColor: headerColor }}
                    className="h-10 px-3 flex items-center justify-between cursor-move text-white font-bold select-none text-xs tracking-tight shrink-0"
                  >
                    <span className="truncate pr-1 font-mono uppercase">{t}</span>
                    
                    {/* Header Color Picker & Actions */}
                    <div className="flex items-center gap-1 opacity-60 group-hover/node:opacity-100 transition-opacity">
                      {/* Simple color selector button */}
                      <div className="flex items-center gap-0.5 mr-1">
                        {PRESET_COLORS.slice(0, 4).map(c => (
                          <button 
                            key={c}
                            onClick={() => handleSetNodeColor(t, c)}
                            style={{ backgroundColor: c }}
                            className={`w-2.5 h-2.5 rounded-full border border-white/20 transition-transform hover:scale-125 ${
                              node.color === c ? 'scale-110 ring-1 ring-white' : ''
                            }`}
                          />
                        ))}
                      </div>

                      {/* Toggle comments button */}
                      <button 
                        onClick={() => handleToggleComments(t)}
                        className="p-1 hover:bg-black/10 rounded mr-0.5" 
                        title={showComments[t] ? "Ocultar Comentarios" : "Mostrar Comentarios"}
                      >
                        {loadingComments[t] ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <MessageSquare className={`w-3 h-3 ${showComments[t] ? 'text-yellow-300 fill-yellow-300 font-bold' : ''}`} />
                        )}
                      </button>

                      <button 
                        onClick={() => handleToggleTable(t)}
                        className="p-1 hover:bg-black/10 rounded" 
                        title="Quitar del lienzo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Table Comment if visible */}
                  {showComments[t] && commentsData[t]?.tableComment && (
                    <div className={`px-3 py-1.5 text-[9px] italic border-b opacity-85 leading-normal shrink-0 ${
                      isDark 
                        ? 'bg-blue-500/10 border-gray-805 text-blue-300' 
                        : 'bg-blue-50 border-gray-150 text-blue-800'
                    }`}>
                      📝 {commentsData[t].tableComment}
                    </div>
                  )}

                  {/* Columns List Scrollable */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar text-[10px]">
                    {cols.length > 0 ? (
                      cols.map(c => {
                        const isNullable = c.nullable === 'Y';
                        // Check if column is a real primary key
                        const isPk = (tableData.primaryKeys || []).some(
                          pk => pk.tableName === t && pk.columnName === c.columnName
                        );
                        const isColHighlighted = isColumnInHoveredRelation(t, c.columnName);
                        
                        const colComment = showComments[t] ? commentsData[t]?.columns[c.columnName] : null;
                        
                        return (
                          <div 
                            key={c.columnName}
                            className="flex flex-col border-b border-black/5 dark:border-white/5 py-0.5"
                          >
                            <div 
                              className={`flex items-center justify-between px-2 py-0.5 rounded transition-all duration-150 ${
                                isColHighlighted
                                  ? (isDark ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30' : 'bg-amber-100 text-amber-800 font-bold border border-amber-300')
                                  : (isDark ? 'hover:bg-gray-800/40 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
                              }`}
                            >
                              <span className={`font-mono flex items-center gap-1 truncate ${isPk ? 'font-bold text-yellow-500' : ''}`}>
                                {isPk && <span className="text-[8px]">🔑</span>}
                                {c.columnName}
                              </span>
                              <span className="font-mono text-[9px] opacity-50 shrink-0 ml-1.5">
                                {c.dataType.toLowerCase()}{!isNullable && '*'}
                              </span>
                            </div>
                            {/* Column Comment */}
                            {colComment && (
                              <div className="px-2 pt-0.5 text-[9px] text-gray-500 dark:text-gray-400 italic break-words leading-tight">
                                ↳ {colComment}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full opacity-40 py-10 gap-1.5">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                        <span>Cargando esquema...</span>
                      </div>
                    )}
                  </div>

                  {/* Resizable Indexes Divider */}
                  {groupedIndexes.length > 0 && (
                    <div
                      onMouseDown={(e) => handleIndexDividerMouseDown(e, t)}
                      className="h-1 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 dark:hover:bg-blue-500 cursor-ns-resize transition-colors shrink-0 flex items-center justify-center group/divider"
                      title="Arrastra para ajustar el alto de la sección de Índices"
                    >
                      <div className="w-8 h-0.5 rounded-full bg-gray-400/40 group-hover/divider:bg-white" />
                    </div>
                  )}

                  {/* Indexes List */}
                  {groupedIndexes.length > 0 && (
                    <div 
                      style={{ height: `${node.indexesHeight || 80}px` }}
                      className="shrink-0 flex flex-col bg-black/5 dark:bg-white/5 border-inherit"
                    >
                      <div className="px-2 pt-1 pb-0.5 text-[9px] font-bold tracking-wider uppercase opacity-55">
                        Índices
                      </div>
                      <div className="flex-1 px-1.5 pb-2 space-y-1 text-[9px] font-mono overflow-y-auto custom-scrollbar">
                        {groupedIndexes.map(idx => {
                          const isUnique = idx.uniqueness === 'UNIQUE';
                          return (
                            <div key={idx.name} className="flex flex-col px-1.5 py-1 rounded bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5">
                              <div className="flex items-center justify-between gap-1 select-text">
                                <span className="font-bold truncate opacity-80 text-blue-500 dark:text-blue-400 max-w-[70%]" title={idx.name}>
                                  {idx.name}
                                </span>
                                <span className={`text-[8px] px-1 rounded-sm ${
                                  isUnique 
                                    ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' 
                                    : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                }`}>
                                  {isUnique ? 'UNIQUE' : 'NON-UNIQUE'}
                                </span>
                              </div>
                              <div className="mt-0.5 opacity-60 truncate">
                                ({idx.columns.join(', ')})
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Resize handle (bottom right corner) */}
                  <div
                    onMouseDown={(e) => handleResizeHandleMouseDown(e, t)}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center"
                  >
                    {/* Visual indicators */}
                    <svg width="6" height="6" viewBox="0 0 6 6" className="opacity-30 group-hover/node:opacity-100">
                      <line x1="6" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="6" y1="3" x2="3" y2="6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>
              );
            })}

            {/* Notes Nodes */}
            {notes.map(note => {
              const darkenColor = (hex: string) => {
                if (hex === '#fef08a') return '#fde047'; // yellow
                if (hex === '#bbf7d0') return '#86efac'; // green
                if (hex === '#bfdbfe') return '#93c5fd'; // blue
                if (hex === '#fbcfe8') return '#f9a8d4'; // pink
                if (hex === '#e9d5ff') return '#d8b4fe'; // purple
                return hex;
              };

              return (
                <div
                  key={note.id}
                  style={{
                    position: 'absolute',
                    left: `${note.x}px`,
                    top: `${note.y}px`,
                    width: `${note.width}px`,
                    height: `${note.height}px`,
                    backgroundColor: note.color || '#fef08a',
                    pointerEvents: 'auto',
                  }}
                  className="rounded-xl shadow-lg border border-black/10 flex flex-col overflow-hidden group/note text-gray-800"
                >
                  {/* Note Header */}
                  <div
                    onMouseDown={(e) => handleNodeHeaderMouseDown(e, `note-${note.id}`)}
                    style={{ backgroundColor: darkenColor(note.color || '#fef08a') }}
                    className="h-8 px-2 flex items-center justify-between cursor-move shrink-0 border-b border-black/5"
                  >
                    {/* Small drag handle indicator */}
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-800/30" />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-800/30" />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-800/30" />
                    </div>

                    {/* Color presets & Delete */}
                    <div className="flex items-center gap-1 opacity-45 group-hover/note:opacity-100 transition-opacity">
                      {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff'].map(c => (
                        <button
                          key={c}
                          onClick={() => handleUpdateNoteColor(note.id, c)}
                          style={{ backgroundColor: c }}
                          className={`w-2.5 h-2.5 rounded-full border border-black/10 transition-transform hover:scale-125 ${
                            note.color === c ? 'ring-1 ring-black/40 scale-110' : ''
                          }`}
                        />
                      ))}
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-0.5 hover:bg-black/10 rounded ml-1 text-red-700"
                        title="Eliminar Nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Textarea */}
                  <textarea
                    value={note.text}
                    onChange={(e) => handleUpdateNoteText(note.id, e.target.value)}
                    className="w-full flex-1 bg-transparent border-0 outline-none resize-none p-2 text-xs font-sans text-gray-800 focus:ring-0 placeholder-gray-600 border-none"
                    placeholder="Escribe tu nota aquí..."
                  />

                  {/* Resize handle (bottom right corner) */}
                  <div
                    onMouseDown={(e) => handleResizeHandleMouseDown(e, `note-${note.id}`)}
                    className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize flex items-center justify-center"
                  >
                    <svg width="6" height="6" viewBox="0 0 6 6" className="opacity-30 group-hover/note:opacity-100 text-gray-800">
                      <line x1="6" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="6" y1="3" x2="3" y2="6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hidden file input for importing JSON */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleJsonFileChange}
      />

      {/* DDL Script Viewer Modal */}
      {isDdlModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in pointer-events-auto">
          <div 
            className={`w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 ${
              isDark ? 'bg-gray-900 border-gray-800 text-gray-200 shadow-black/80' : 'bg-white border-gray-200 text-gray-800 shadow-gray-400/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-bold text-base">Script de Construcción (DDL)</h3>
                  <p className="text-xs opacity-60">Tablas incluidas: {ddlModalTables.join(', ')}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDdlModalOpen(false)} 
                className={`p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 relative border rounded-xl overflow-hidden dark:border-gray-800 border-gray-200">
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme={isDark ? 'vs-dark' : 'light'}
                value={generatedDdl}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  lineHeight: 20,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                }}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveDdlToFile}
                className={`py-2 px-4 rounded-xl text-sm border font-semibold transition-colors flex items-center gap-1.5 ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-650'
                }`}
              >
                <Download className="w-4 h-4" /> Guardar en Archivo
              </button>
              <button
                onClick={() => setIsDdlModalOpen(false)}
                className={`py-2 px-4 rounded-xl text-sm border transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-650'
                }`}
              >
                Cerrar
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(generatedDdl);
                    showToast('Script copiado al portapapeles', 'success');
                  } catch {
                    showToast('No se pudo copiar el script', 'error');
                  }
                }}
                className="py-2 px-5 rounded-xl text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20"
              >
                <Check className="w-4 h-4" /> Copiar Código
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Close Confirmation Modal */}
      {tabToClose && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in pointer-events-auto">
          <div 
            className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 flex flex-col gap-4 ${
              isDark ? 'bg-gray-900 border-gray-800 text-gray-200 shadow-black/80' : 'bg-white border-gray-200 text-gray-800 shadow-gray-400/30'
            }`}
          >
            <div className="flex items-center gap-3 text-amber-500">
              <HelpCircle className="w-6 h-6" />
              <h3 className="font-bold text-base">Guardar cambios antes de cerrar</h3>
            </div>
            
            <p className="text-xs opacity-80 leading-relaxed">
              El modelo <strong>{diagramTabs.find(t => t.id === tabToClose)?.title}</strong> contiene elementos en el lienzo. ¿Deseas guardar los cambios en un archivo JSON antes de cerrar esta pestaña?
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setTabToClose(null)}
                className={`py-2 px-4 rounded-xl text-xs border font-semibold transition-colors ${
                  isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-300 hover:bg-gray-100 text-gray-650'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => performCloseTab(tabToClose)}
                className="py-2 px-4 rounded-xl text-xs bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors border border-transparent shadow-md"
              >
                Cerrar sin Guardar
              </button>
              <button
                onClick={() => {
                  const targetTab = diagramTabs.find(t => t.id === tabToClose);
                  if (targetTab) {
                    saveTabJson(targetTab);
                    performCloseTab(tabToClose);
                  }
                }}
                className="py-2 px-4 rounded-xl text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors border border-transparent shadow-md shadow-blue-500/10"
              >
                Guardar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagram database sync modals */}
      <DiagramSyncModal
        isOpen={isSyncModalOpen}
        isDark={isDark}
        mode={syncModalMode}
        dbModels={dbModels}
        currentTitle={diagramTitle}
        initialErrorMsg={syncError}
        onSave={handleSaveToDb}
        onLoad={handleLoadFromDb}
        onDelete={handleDeleteFromDb}
        onCancel={() => setIsSyncModalOpen(false)}
      />

      <DiagramInstructionsModal
        isOpen={isInstructionsModalOpen}
        isDark={isDark}
        onClose={() => setIsInstructionsModalOpen(false)}
      />
    </div>
  );
}
