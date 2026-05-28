"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Play, Loader2, AlertTriangle, Plus, Trash2, HelpCircle, 
  ZoomIn, ZoomOut, Check, Settings, Database, Columns, RefreshCw,
  Sliders, Filter, ArrowDownUp, Combine, Undo, Redo, Code, Image,
  FileText, CloudDownload, CloudUpload, Maximize2, Minimize2,
  ChevronDown, ChevronRight, Edit3, ArrowLeftRight, Trash, Grid,
  MessageSquare, Copy, XCircle, AlertCircle
} from 'lucide-react';
import { saveAs } from 'file-saver';
import Editor from '@monaco-editor/react';
import { useAppStore } from '@/store/useAppStore';
import { 
  QueryBuilderDesign, TableDesign, JoinDesign, ColumnDesign, WhereGroup, WhereRule, OrderByItem,
  createInitialDesign, compileDesignToSql, parseSqlToState 
} from '@/lib/sql-designer-parser';

interface VisualQueryBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  activeConnection: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const PRESET_COLORS = [
  'bg-blue-600 border-blue-500',
  'bg-emerald-600 border-emerald-500',
  'bg-amber-600 border-amber-500',
  'bg-pink-600 border-pink-500',
  'bg-violet-600 border-violet-500',
  'bg-cyan-600 border-cyan-500',
  'bg-rose-600 border-rose-500'
];

export default function VisualQueryBuilder({
  isOpen,
  onClose,
  isDark,
  activeConnection,
  showToast
}: VisualQueryBuilderProps) {
  const { connections } = useAppStore();
  
  // Design State
  const [design, setDesign] = useState<QueryBuilderDesign>(createInitialDesign());
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [activeBottomTab, setActiveBottomTab] = useState<'columns' | 'joins' | 'where' | 'orderby' | 'groupby'>('columns');
  
  // UI Panels states
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [sqlSyncWarning, setSqlSyncWarning] = useState<string | null>(null);

  // Undo/Redo History
  const [history, setHistory] = useState<QueryBuilderDesign[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Drag & Canvas States
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Dragging connection link
  const [linkingStart, setLinkingStart] = useState<{ tableAlias: string; colName: string; isLeft: boolean } | null>(null);
  const [linkingMousePos, setLinkingMousePos] = useState({ x: 0, y: 0 });

  // Selected Elements
  const [selectedJoinId, setSelectedJoinId] = useState<string | null>(null);
  const [isCalculatedColModalOpen, setIsCalculatedColModalOpen] = useState(false);
  const [calcColExpr, setCalcColExpr] = useState('');
  const [calcColAlias, setCalcColAlias] = useState('');
  const [calcColTable, setCalcColTable] = useState('');

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  // Additional States
  const [copied, setCopied] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showNewQueryConfirm, setShowNewQueryConfirm] = useState(false);

  // Resize and Hover States
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [initialResizeDims, setInitialResizeDims] = useState({ width: 0, height: 0 });
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [hoveredJoinId, setHoveredJoinId] = useState<string | null>(null);

  // Custom Modal States for Table Alias and Duplicate Warning
  const [dupTableModal, setDupTableModal] = useState<{
    tableName: string;
    x: number;
    y: number;
    suggestedAlias: string;
  } | null>(null);

  const [editAliasModal, setEditAliasModal] = useState<{
    tableId: string;
    tableName: string;
    currentAlias: string;
  } | null>(null);

  // New local state inputs for validation
  const [dupTableAliasInput, setDupTableAliasInput] = useState('');
  const [dupTableError, setDupTableError] = useState('');
  const [editAliasInput, setEditAliasInput] = useState('');
  const [editAliasError, setEditAliasError] = useState('');

  // Add Join Form States
  const [addJoinFromTable, setAddJoinFromTable] = useState('');
  const [addJoinFromColumn, setAddJoinFromColumn] = useState('');
  const [addJoinToTable, setAddJoinToTable] = useState('');
  const [addJoinToColumn, setAddJoinToColumn] = useState('');
  const [addJoinType, setAddJoinType] = useState<'INNER' | 'LEFT' | 'RIGHT' | 'FULL'>('INNER');

  // Background Metadata and Relations states
  const [dbRelations, setDbRelations] = useState<any[]>([]);
  const [lastFetchedTables, setLastFetchedTables] = useState<string[]>([]);

  // Sync inputs when modals are opened
  useEffect(() => {
    if (dupTableModal) {
      setDupTableAliasInput(dupTableModal.suggestedAlias);
      setDupTableError('');
    }
  }, [dupTableModal]);

  useEffect(() => {
    if (editAliasModal) {
      setEditAliasInput(editAliasModal.currentAlias);
      setEditAliasError('');
    }
  }, [editAliasModal]);

  // Real-time validation for duplicate table alias input
  useEffect(() => {
    if (!dupTableModal) return;
    const trimmed = dupTableAliasInput.trim().toLowerCase();
    if (!trimmed) {
      setDupTableError('El alias no puede estar vacío.');
    } else if (design.tables.some(t => t.alias === trimmed || t.id === trimmed || t.name === trimmed)) {
      setDupTableError(`El alias "${trimmed}" ya está en uso o coincide con un nombre de tabla.`);
    } else {
      setDupTableError('');
    }
  }, [dupTableAliasInput, dupTableModal, design.tables]);

  // Real-time validation for editing table alias input
  useEffect(() => {
    if (!editAliasModal) return;
    const trimmed = editAliasInput.trim().toLowerCase();
    if (!trimmed) {
      // It's allowed to clear the alias unless there are other instances of the same table
      const table = design.tables.find(t => t.id === editAliasModal.tableId);
      const otherInstancesExist = table ? design.tables.some(t => t.id !== editAliasModal.tableId && t.name === table.name) : false;
      if (otherInstancesExist) {
        setEditAliasError(`No puedes dejar el alias vacío porque hay múltiples instancias de la tabla ${editAliasModal.tableName}.`);
      } else {
        setEditAliasError('');
      }
    } else if (design.tables.some(t => t.id !== editAliasModal.tableId && (t.alias === trimmed || t.name === trimmed))) {
      setEditAliasError(`El alias "${trimmed}" ya está en uso o coincide con un nombre de tabla.`);
    } else {
      setEditAliasError('');
    }
  }, [editAliasInput, editAliasModal, design.tables]);

  // Synchronize table columns and relations in the background when tables change or load from SQL
  useEffect(() => {
    if (!isOpen || !activeConnection || design.tables.length === 0) {
      if (design.tables.length === 0 && dbRelations.length > 0) {
        setDbRelations([]);
        setLastFetchedTables([]);
      }
      return;
    }

    const currentTableNames = design.tables.map(t => t.name).sort();
    const lastNames = [...lastFetchedTables].sort();
    const hasChanged = currentTableNames.length !== lastNames.length || 
                     currentTableNames.some((name, idx) => name !== lastNames[idx]);

    if (!hasChanged) return;

    const fetchRelationsAndMetadata = async () => {
      setIsLoadingMetadata(true);
      try {
        const res = await fetch('/api/oracle/table-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: activeConnection,
            tables: currentTableNames
          })
        });
        const data = await res.json();
        if (res.ok) {
          // Update dbRelations and last fetched tables
          setDbRelations(data.relations || []);
          setLastFetchedTables(currentTableNames);

          // Update any tables that do not have their columns loaded (e.g. parsed from SQL)
          const updatedTables = design.tables.map(table => {
            if (table.columns.length > 0) return table;

            const tableColumns = (data.columns || [])
              .filter((col: any) => col.tableName === table.name)
              .map((col: any) => {
                const isPk = (data.primaryKeys || []).some(
                  (pk: any) => pk.tableName === table.name && pk.columnName === col.columnName
                );
                const isFk = (data.relations || []).some(
                  (rel: any) => (rel.fromTable === table.name && rel.fromColumn === col.columnName) ||
                                (rel.toTable === table.name && rel.toColumn === col.columnName)
                );
                return {
                  name: col.columnName,
                  dataType: col.dataType,
                  isPk,
                  isFk,
                  selected: false
                };
              });

            return {
              ...table,
              columns: tableColumns
            };
          });

          // Update state if columns were added
          const tablesUpdated = design.tables.some(t => t.columns.length === 0);
          if (tablesUpdated) {
            setDesign(prev => ({
              ...prev,
              tables: updatedTables
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching table metadata relations', err);
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    fetchRelationsAndMetadata();
  }, [design.tables, activeConnection, isOpen, lastFetchedTables, dbRelations.length]);

  // ----------------------------------------------------
  // History Undo/Redo Wrapper
  // ----------------------------------------------------
  const updateDesign = (newDesign: QueryBuilderDesign, saveToHistory = true) => {
    setDesign(newDesign);
    
    // Auto-compile SQL in real time
    const sql = compileDesignToSql(newDesign);
    setGeneratedSql(sql);
    setSqlSyncWarning(null);
    setIsDirty(true);

    if (saveToHistory) {
      const updatedHistory = history.slice(0, historyIndex + 1);
      updatedHistory.push(JSON.parse(JSON.stringify(newDesign)));
      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setDesign(JSON.parse(JSON.stringify(history[prevIdx])));
      const sql = compileDesignToSql(history[prevIdx]);
      setGeneratedSql(sql);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setDesign(JSON.parse(JSON.stringify(history[nextIdx])));
      const sql = compileDesignToSql(history[nextIdx]);
      setGeneratedSql(sql);
    }
  };

  // ----------------------------------------------------
  // Initial load
  // ----------------------------------------------------
  useEffect(() => {
    if (isOpen && activeConnection) {
      fetchAvailableTables();
      // Initialize state
      const initial = createInitialDesign();
      setDesign(initial);
      setHistory([JSON.parse(JSON.stringify(initial))]);
      setHistoryIndex(0);
      setPan({ x: 0, y: 0 });
      setZoom(1.0);
      setIsDirty(false);
      setShowNewQueryConfirm(false);
      setResizingNodeId(null);
      setHoveredJoinId(null);
    }
  }, [isOpen, activeConnection]);

  const fetchAvailableTables = async () => {
    if (!activeConnection) return;
    setIsLoadingTables(true);
    try {
      const res = await fetch('/api/oracle/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          connection: activeConnection,
          visibleTypes: ['TABLE']
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener tablas');
      
      const tables = (data.objects?.TABLE || []).map((obj: any) => obj.name || obj).sort();
      setAvailableTables(tables);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoadingTables(false);
    }
  };

  // ----------------------------------------------------
  // Table addition / removal
  // ----------------------------------------------------
  const handleAddTable = (tableName: string, x = 100, y = 100) => {
    const exists = design.tables.some(t => t.name === tableName);
    if (exists) {
      // Suggest a unique alias
      let aliasBase = tableName.toLowerCase().replace(/^tkr_/, '').substring(0, 3);
      if (aliasBase.endsWith('_')) aliasBase = aliasBase.slice(0, -1);
      let suggestedAlias = aliasBase;
      let count = 1;
      while (design.tables.some(t => t.alias === suggestedAlias || t.id === suggestedAlias || t.name === suggestedAlias)) {
        suggestedAlias = `${aliasBase}${count}`;
        count++;
      }

      setDupTableModal({
        tableName,
        x,
        y,
        suggestedAlias
      });
    } else {
      handleAddTableInstance(tableName, '', x, y);
    }
  };

  const handleAddTableInstance = async (tableName: string, finalAlias: string, x: number, y: number) => {
    setIsLoadingMetadata(true);
    try {
      // Fetch table metadata columns and relations
      const res = await fetch('/api/oracle/table-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: activeConnection,
          tables: [tableName, ...design.tables.map(t => t.name)]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener columnas');

      // Table instances without a custom alias default to their table name as ID
      const tableId = finalAlias || tableName;

      // Map columns
      const tableColumns = (data.columns || [])
        .filter((col: any) => col.tableName === tableName)
        .map((col: any) => {
          const isPk = (data.primaryKeys || []).some(
            (pk: any) => pk.tableName === tableName && pk.columnName === col.columnName
          );
          const isFk = (data.relations || []).some(
            (rel: any) => (rel.fromTable === tableName && rel.fromColumn === col.columnName) ||
                          (rel.toTable === tableName && rel.toColumn === col.columnName)
          );
          return {
            name: col.columnName,
            dataType: col.dataType,
            isPk,
            isFk,
            selected: false
          };
        });

      const newTable: TableDesign = {
        id: tableId,
        name: tableName,
        alias: finalAlias, // Empty string by default for first-time added tables
        x,
        y,
        width: 230,
        height: 250,
        columns: tableColumns
      };

      const updatedTables = [...design.tables, newTable];
      
      // Auto detect relations
      const updatedJoins = detectAutomaticJoins(updatedTables, design.joins, data.relations || []);

      const nextDesign = {
        ...design,
        tables: updatedTables,
        joins: updatedJoins
      };

      updateDesign(nextDesign);
      showToast(`Tabla ${tableName} agregada.`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const detectAutomaticJoins = (activeTables: TableDesign[], currentJoins: JoinDesign[], relations: any[]) => {
    const updatedJoins = [...currentJoins];

    for (let i = 0; i < activeTables.length; i++) {
      for (let j = i + 1; j < activeTables.length; j++) {
        const t1 = activeTables[i];
        const t2 = activeTables[j];

        const rels = (relations || []).filter(r => {
          if (!r.fromTable || !r.toTable) return false;
          const rFrom = r.fromTable.toUpperCase();
          const rTo = r.toTable.toUpperCase();
          const t1Name = t1.name.toUpperCase();
          const t2Name = t2.name.toUpperCase();
          return (rFrom === t1Name && rTo === t2Name) || (rFrom === t2Name && rTo === t1Name);
        });

        rels.forEach(rel => {
          const isT1From = rel.fromTable.toUpperCase() === t1.name.toUpperCase();
          const fromAlias = isT1From ? t1.id : t2.id;
          const toAlias = isT1From ? t2.id : t1.id;
          
          const fromCol = rel.fromColumn.toUpperCase();
          const toCol = rel.toColumn.toUpperCase();

          const exists = updatedJoins.some(jn => {
            const jnFromT = jn.fromTable;
            const jnToT = jn.toTable;
            const jnFromC = jn.fromColumn.toUpperCase();
            const jnToC = jn.toColumn.toUpperCase();

            return (
              (jnFromT === fromAlias && jnFromC === fromCol && jnToT === toAlias && jnToC === toCol) ||
              (jnFromT === toAlias && jnFromC === toCol && jnToT === fromAlias && jnToC === fromCol) ||
              (jnFromT === fromAlias && jnFromC === toCol && jnToT === toAlias && jnToC === fromCol) ||
              (jnFromT === toAlias && jnFromC === fromCol && jnToT === fromAlias && jnToC === toCol)
            );
          });

          if (!exists) {
            updatedJoins.push({
              id: crypto.randomUUID(),
              fromTable: fromAlias,
              fromColumn: fromCol,
              toTable: toAlias,
              toColumn: toCol,
              joinType: 'INNER',
              isFk: true
            });
          }
        });
      }
    }
    return updatedJoins;
  };

  const handleRemoveTable = (tableId: string) => {
    const nextDesign = {
      ...design,
      tables: design.tables.filter(t => t.id !== tableId),
      joins: design.joins.filter(j => j.fromTable !== tableId && j.toTable !== tableId),
      orderBy: design.orderBy.filter(o => o.table !== tableId),
      groupBy: {
        ...design.groupBy,
        columns: design.groupBy.columns.filter(g => g.table !== tableId)
      }
    };
    updateDesign(nextDesign);
  };

  const [loadingCommentsTable, setLoadingCommentsTable] = useState<string | null>(null);

  const handleToggleComments = async (tableId: string) => {
    const table = design.tables.find(t => t.id === tableId);
    if (!table) return;

    if (table.showComments) {
      const nextDesign = {
        ...design,
        tables: design.tables.map(t => 
          t.id === tableId ? { ...t, showComments: false } : t
        )
      };
      updateDesign(nextDesign);
    } else {
      if (table.comments) {
        const nextDesign = {
          ...design,
          tables: design.tables.map(t => 
            t.id === tableId ? { ...t, showComments: true } : t
          )
        };
        updateDesign(nextDesign);
      } else {
        setLoadingCommentsTable(tableId);
        try {
          const res = await fetch('/api/oracle/table-comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection: activeConnection,
              tableName: table.name
            })
          });
          const data = await res.json();
          if (res.ok && data.columnComments) {
            const commentsRecord: Record<string, string> = {};
            data.columnComments.forEach((c: any) => {
              commentsRecord[c.columnName] = c.comment;
            });

            const nextDesign = {
              ...design,
              tables: design.tables.map(t => 
                t.id === tableId ? { ...t, comments: commentsRecord, showComments: true } : t
              )
            };
            updateDesign(nextDesign);
            showToast(`Comentarios cargados para ${table.name}`, 'success');
          } else {
            showToast('No se encontraron comentarios.', 'info');
          }
        } catch (err: any) {
          showToast(err.message || 'Error al obtener comentarios', 'error');
        } finally {
          setLoadingCommentsTable(null);
        }
      }
    }
  };

  // ----------------------------------------------------
  // Column Selection toggles
  // ----------------------------------------------------
  const handleToggleColumn = (tableId: string, colName: string) => {
    const nextDesign = {
      ...design,
      tables: design.tables.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            columns: t.columns.map(c => 
              c.name === colName ? { ...c, selected: !c.selected } : c
            )
          };
        }
        return t;
      })
    };
    updateDesign(nextDesign);
  };

  const handleColumnAliasChange = (tableId: string, colName: string, alias: string) => {
    const nextDesign = {
      ...design,
      tables: design.tables.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            columns: t.columns.map(c => 
              c.name === colName ? { ...c, alias: alias || undefined } : c
            )
          };
        }
        return t;
      })
    };
    updateDesign(nextDesign);
  };

  const handleCalculatedColumnAdd = () => {
    if (!calcColExpr.trim()) return;
    const target = calcColTable || design.tables[0]?.id;
    if (!target) return;

    const nextDesign = {
      ...design,
      tables: design.tables.map(t => {
        if (t.id === target) {
          return {
            ...t,
            columns: [
              ...t.columns,
              {
                name: `CALC_${t.columns.length + 1}`,
                dataType: 'EXPRESSION',
                selected: true,
                alias: calcColAlias.trim() || undefined,
                customExpression: calcColExpr.trim()
              }
            ]
          };
        }
        return t;
      })
    };
    updateDesign(nextDesign);
    setCalcColExpr('');
    setCalcColAlias('');
    setIsCalculatedColModalOpen(false);
  };

  const handleRemoveCalculatedColumn = (tableId: string, colName: string) => {
    const nextDesign = {
      ...design,
      tables: design.tables.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            columns: t.columns.filter(c => c.name !== colName)
          };
        }
        return t;
      })
    };
    updateDesign(nextDesign);
  };

  // Helper to rename a table in WHERE rule groups recursively
  const renameTableInWhereGroup = (group: WhereGroup, oldId: string, newId: string): WhereGroup => {
    return {
      ...group,
      children: group.children.map(child => {
        if (child.type === 'group') {
          return renameTableInWhereGroup(child, oldId, newId);
        } else {
          return {
            ...child,
            table: child.table === oldId ? newId : child.table
          } as WhereRule;
        }
      })
    };
  };

  const handleUpdateTableAlias = (tableId: string) => {
    const table = design.tables.find(t => t.id === tableId);
    if (!table) return;
    setEditAliasModal({
      tableId,
      tableName: table.name,
      currentAlias: table.alias || ''
    });
  };

  const handlePerformUpdateTableAlias = (tableId: string, nextAlias: string) => {
    const table = design.tables.find(t => t.id === tableId);
    if (!table) return;

    const sanitizedAlias = nextAlias.trim().toLowerCase();

    // If they cleared the alias, they want to reset it (default: no alias)
    if (sanitizedAlias === '') {
      // Check if there is already another instance of this table on the canvas
      const otherInstancesExist = design.tables.some(t => t.id !== tableId && t.name === table.name);
      if (otherInstancesExist) {
        showToast(`No puedes dejar el alias vacío porque hay múltiples instancias de la tabla ${table.name}.`, 'error');
        return;
      }

      // If no other instances exist, we can reset the alias and use the table name as ID
      const nextId = table.name;
      const nextDesign = {
        ...design,
        tables: design.tables.map(t => 
          t.id === tableId ? { ...t, id: nextId, alias: '' } : t
        ),
        joins: design.joins.map(j => ({
          ...j,
          fromTable: j.fromTable === tableId ? nextId : j.fromTable,
          toTable: j.toTable === tableId ? nextId : j.toTable
        })),
        where: renameTableInWhereGroup(design.where, tableId, nextId),
        orderBy: design.orderBy.map(o => 
          o.table === tableId ? { ...o, table: nextId } : o
        ),
        groupBy: {
          ...design.groupBy,
          columns: design.groupBy.columns.map(g => 
            g.table === tableId ? { ...g, table: nextId } : g
          )
        }
      };
      updateDesign(nextDesign);
      setEditAliasModal(null);
      showToast(`Alias de la tabla ${table.name} eliminado.`, 'info');
      return;
    }

    // Ensure the new alias is unique
    const conflict = design.tables.some(t => t.id !== tableId && (t.alias === sanitizedAlias || t.name === sanitizedAlias));
    if (conflict) {
      showToast(`El alias "${sanitizedAlias}" ya está en uso o coincide con un nombre de tabla.`, 'error');
      return;
    }

    const nextId = sanitizedAlias;
    const nextDesign = {
      ...design,
      tables: design.tables.map(t => 
        t.id === tableId ? { ...t, id: nextId, alias: sanitizedAlias } : t
      ),
      joins: design.joins.map(j => ({
        ...j,
        fromTable: j.fromTable === tableId ? nextId : j.fromTable,
        toTable: j.toTable === tableId ? nextId : j.toTable
      })),
      where: renameTableInWhereGroup(design.where, tableId, nextId),
      orderBy: design.orderBy.map(o => 
        o.table === tableId ? { ...o, table: nextId } : o
      ),
      groupBy: {
        ...design.groupBy,
        columns: design.groupBy.columns.map(g => 
          g.table === tableId ? { ...g, table: nextId } : g
        )
      }
    };
    updateDesign(nextDesign);
    setEditAliasModal(null);
    showToast(`Alias de la tabla ${table.name} cambiado a "${sanitizedAlias}".`, 'success');
  };

  // ----------------------------------------------------
  // Drag & Canvas Handlers
  // ----------------------------------------------------
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (draggingNodeId || linkingStart || resizingNodeId) return;
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggingNodeId) {
      const x = Math.round((e.clientX - dragOffset.x) / zoom);
      const y = Math.round((e.clientY - dragOffset.y) / zoom);
      
      setDesign(prev => ({
        ...prev,
        tables: prev.tables.map(t => 
          t.id === draggingNodeId ? { ...t, x, y } : t
        )
      }));
    } else if (resizingNodeId) {
      const dx = (e.clientX - resizeStartPos.x) / zoom;
      const dy = (e.clientY - resizeStartPos.y) / zoom;
      
      setDesign(prev => ({
        ...prev,
        tables: prev.tables.map(t => 
          t.id === resizingNodeId ? {
            ...t,
            width: Math.max(180, initialResizeDims.width + dx),
            height: Math.max(150, initialResizeDims.height + dy)
          } : t
        )
      }));
    } else if (linkingStart) {
      const wrapperEl = wrapperRef.current;
      if (wrapperEl) {
        const rect = wrapperEl.getBoundingClientRect();
        setLinkingMousePos({
          x: (e.clientX - rect.left) / zoom,
          y: (e.clientY - rect.top) / zoom
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    if (draggingNodeId) {
      setDraggingNodeId(null);
      // Save pos in history
      updateDesign(design);
    }
    if (resizingNodeId) {
      setResizingNodeId(null);
      // Save dimensions in history
      updateDesign(design);
    }
    setLinkingStart(null);
  };

  const handleNodeHeaderMouseDown = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (resizingNodeId) return;
    const table = design.tables.find(t => t.id === tableId);
    if (table) {
      setDraggingNodeId(tableId);
      setDragOffset({
        x: e.clientX - table.x * zoom,
        y: e.clientY - table.y * zoom
      });
    }
  };

  const handleResizeHandleMouseDown = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const table = design.tables.find(t => t.id === tableId);
    if (table) {
      setResizingNodeId(tableId);
      setInitialResizeDims({ width: table.width, height: table.height });
      setResizeStartPos({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  const isColumnInHoveredJoin = (tableAlias: string, colName: string) => {
    if (!hoveredJoinId) return false;
    const join = design.joins.find(j => j.id === hoveredJoinId);
    if (!join) return false;
    
    const isFrom = join.fromTable === tableAlias && join.fromColumn.toUpperCase() === colName.toUpperCase();
    const isTo = join.toTable === tableAlias && join.toColumn.toUpperCase() === colName.toUpperCase();
    return isFrom || isTo;
  };

  const hasForeignKeyBetweenTables = (tableAlias1: string, tableAlias2: string): boolean => {
    const t1 = design.tables.find(t => t.id === tableAlias1);
    const t2 = design.tables.find(t => t.id === tableAlias2);
    if (!t1 || !t2) return false;

    // Check if there is an explicit database relation in dbRelations
    const hasDbRel = dbRelations.some(r => {
      const rFrom = (r.fromTable || '').toUpperCase();
      const rTo = (r.toTable || '').toUpperCase();
      const t1Name = (t1.name || '').toUpperCase();
      const t2Name = (t2.name || '').toUpperCase();
      return (rFrom === t1Name && rTo === t2Name) || (rFrom === t2Name && rTo === t1Name);
    });

    if (hasDbRel) return true;

    // As a backup, check if any join between these tables is marked as isFk
    return design.joins.some(j => 
      j.isFk && 
      ((j.fromTable === tableAlias1 && j.toTable === tableAlias2) ||
       (j.fromTable === tableAlias2 && j.toTable === tableAlias1))
    );
  };

  const handleZoomIn = () => setZoom(z => Math.min(2.0, z + 0.1));
  const handleZoomOut = () => setZoom(z => Math.max(0.5, z - 0.1));
  const handleZoomReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // ----------------------------------------------------
  // Drag and Drop from sidebars
  // ----------------------------------------------------
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const data = JSON.parse(rawData);
      if (data.type === 'TABLE' && data.name) {
        const wrapperEl = wrapperRef.current;
        if (wrapperEl) {
          const rect = wrapperEl.getBoundingClientRect();
          const x = Math.round((e.clientX - rect.left) / zoom);
          const y = Math.round((e.clientY - rect.top) / zoom);
          await handleAddTable(data.name, x, y);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------
  // Join / Relationship connections drawing
  // ----------------------------------------------------
  const handleJoinHandleMouseDown = (e: React.MouseEvent, tableAlias: string, colName: string, isLeft: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    const wrapperEl = wrapperRef.current;
    if (wrapperEl) {
      const rect = wrapperEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      setLinkingStart({ tableAlias, colName, isLeft });
      setLinkingMousePos({ x, y });
    }
  };

  const handleJoinHandleMouseUp = (e: React.MouseEvent, tableAlias: string, colName: string) => {
    e.stopPropagation();
    if (linkingStart && linkingStart.tableAlias !== tableAlias) {
      // Connect manual join
      const nextJoin: JoinDesign = {
        id: crypto.randomUUID(),
        fromTable: linkingStart.tableAlias,
        fromColumn: linkingStart.colName,
        toTable: tableAlias,
        toColumn: colName,
        joinType: 'INNER'
      };
      const nextDesign = {
        ...design,
        joins: [...design.joins, nextJoin]
      };
      updateDesign(nextDesign);
      showToast(`Relación manual creada entre ${linkingStart.tableAlias}.${linkingStart.colName} y ${tableAlias}.${colName}`, 'success');
    }
    setLinkingStart(null);
  };

  // Get Column coordinates for SVG join path
  const getColCoords = (tableAlias: string, colName: string) => {
    const table = design.tables.find(t => t.id === tableAlias);
    if (!table) return { xLeft: 0, xRight: 0, y: 0 };

    const handleEl = document.getElementById(`handle-${tableAlias}-${colName}`);
    const wrapperEl = wrapperRef.current;

    let y = 0;
    if (handleEl && wrapperEl) {
      const handleRect = handleEl.getBoundingClientRect();
      const wrapperRect = wrapperEl.getBoundingClientRect();
      y = (handleRect.top + handleRect.height / 2 - wrapperRect.top) / zoom;
    } else {
      // Fallback if elements are not mounted yet
      const colIdx = table.columns.findIndex(c => c.name.toUpperCase() === colName.toUpperCase());
      const headerHeight = 44;
      const searchHeight = 36;
      const colRowHeight = 28;
      y = table.y + headerHeight + searchHeight + (colIdx >= 0 ? colIdx * colRowHeight : 0) + 14; 
    }

    // Clamp vertical coordinate to the visible scrollable list viewport of the table card
    const minY = table.y + 80;
    const maxY = table.y + table.height - 12;
    const clampedY = Math.max(minY, Math.min(maxY, y));

    return {
      xLeft: table.x,
      xRight: table.x + table.width,
      y: clampedY
    };
  };

  // ----------------------------------------------------
  // Join Config Modal / Edit
  // ----------------------------------------------------
  const handleEditJoin = (joinId: string) => {
    setSelectedJoinId(joinId);
  };

  const handleChangeJoinType = (joinId: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL') => {
    const nextDesign = {
      ...design,
      joins: design.joins.map(j => j.id === joinId ? { ...j, joinType: type } : j)
    };
    updateDesign(nextDesign);
    setSelectedJoinId(null);
  };

  const handleDeleteJoin = (joinId: string) => {
    const nextDesign = {
      ...design,
      joins: design.joins.map(j => j.id === joinId ? { ...j, disabled: true } : j)
    };
    updateDesign(nextDesign);
    setSelectedJoinId(null);
    showToast('Relación desactivada (excluida del SELECT)', 'info');
  };

  const handlePermanentDeleteJoin = (joinId: string) => {
    const nextDesign = {
      ...design,
      joins: design.joins.filter(j => j.id !== joinId)
    };
    updateDesign(nextDesign);
    setSelectedJoinId(null);
    showToast('Relación eliminada permanentemente', 'info');
  };

  const handleDeleteOrDisableJoin = (joinId: string) => {
    const join = design.joins.find(j => j.id === joinId);
    if (!join) return;

    if (join.isFk) {
      // Physical foreign key, soft-delete: disable it and gray it out
      const nextDesign = {
        ...design,
        joins: design.joins.map(j => j.id === joinId ? { ...j, disabled: true } : j)
      };
      updateDesign(nextDesign);
      showToast('Relación física desactivada (excluida del SELECT)', 'info');
    } else {
      // Custom join, hard-delete: remove completely
      const nextDesign = {
        ...design,
        joins: design.joins.filter(j => j.id !== joinId)
      };
      updateDesign(nextDesign);
      showToast('Relación personalizada eliminada', 'success');
    }
    setSelectedJoinId(null);
  };

  const handleToggleJoinDisabled = (joinId: string) => {
    const nextDesign = {
      ...design,
      joins: design.joins.map(j => j.id === joinId ? { ...j, disabled: !j.disabled } : j)
    };
    updateDesign(nextDesign);
    const updated = nextDesign.joins.find(j => j.id === joinId);
    showToast(
      updated?.disabled 
        ? 'Relación desactivada (excluida del SELECT)' 
        : 'Relación activada para el SELECT', 
      'success'
    );
  };

  // ----------------------------------------------------
  // Filters (WHERE Clause)
  // ----------------------------------------------------
  const addFilterRule = (group: WhereGroup) => {
    const newRule: WhereRule = {
      type: 'rule',
      operator: '=',
      value: '',
      valueType: 'text'
    };
    
    const addRuleToGroup = (g: WhereGroup): WhereGroup => {
      if (g === group) {
        return { ...g, children: [...g.children, newRule] };
      }
      return {
        ...g,
        children: g.children.map(c => c.type === 'group' ? addRuleToGroup(c) : c)
      };
    };

    const nextDesign = {
      ...design,
      where: addRuleToGroup(design.where)
    };
    updateDesign(nextDesign);
  };

  const addFilterGroup = (group: WhereGroup) => {
    const newGroup: WhereGroup = {
      type: 'group',
      conjunction: 'AND',
      children: []
    };
    
    const addGroupToGroup = (g: WhereGroup): WhereGroup => {
      if (g === group) {
        return { ...g, children: [...g.children, newGroup] };
      }
      return {
        ...g,
        children: g.children.map(c => c.type === 'group' ? addGroupToGroup(c) : c)
      };
    };

    const nextDesign = {
      ...design,
      where: addGroupToGroup(design.where)
    };
    updateDesign(nextDesign);
  };

  const updateFilterRule = (rule: WhereRule, fields: Partial<WhereRule>) => {
    const updateInGroup = (g: WhereGroup): WhereGroup => {
      return {
        ...g,
        children: g.children.map(c => {
          if (c === rule) {
            return { ...c, ...fields } as WhereRule;
          }
          if (c.type === 'group') {
            return updateInGroup(c);
          }
          return c;
        })
      };
    };

    const nextDesign = {
      ...design,
      where: updateInGroup(design.where)
    };
    updateDesign(nextDesign);
  };

  const updateFilterGroupConjunction = (group: WhereGroup, conj: 'AND' | 'OR') => {
    const updateInGroup = (g: WhereGroup): WhereGroup => {
      if (g === group) {
        return { ...g, conjunction: conj };
      }
      return {
        ...g,
        children: g.children.map(c => c.type === 'group' ? updateInGroup(c) : c)
      };
    };

    const nextDesign = {
      ...design,
      where: updateInGroup(design.where)
    };
    updateDesign(nextDesign);
  };

  const removeFilterItem = (item: WhereRule | WhereGroup) => {
    const removeFromGroup = (g: WhereGroup): WhereGroup => {
      return {
        ...g,
        children: g.children
          .filter(c => c !== item)
          .map(c => c.type === 'group' ? removeFromGroup(c) : c)
      };
    };

    const nextDesign = {
      ...design,
      where: removeFromGroup(design.where)
    };
    updateDesign(nextDesign);
  };

  const getAllQueryColumns = () => {
    const list: Array<{ table: string; column: string; label: string }> = [];
    design.tables.forEach(t => {
      t.columns.forEach(c => {
        list.push({
          table: t.id,
          column: c.name,
          label: `${t.alias || t.name}.${c.name}`
        });
      });
    });
    return list;
  };

  // ----------------------------------------------------
  // ORDER BY
  // ----------------------------------------------------
  const handleAddOrderBy = () => {
    const cols = getAllQueryColumns();
    if (cols.length === 0) return;
    
    const newItem: OrderByItem = {
      table: cols[0].table,
      column: cols[0].column,
      direction: 'ASC'
    };
    const nextDesign = {
      ...design,
      orderBy: [...design.orderBy, newItem]
    };
    updateDesign(nextDesign);
  };

  const handleUpdateOrderBy = (idx: number, fields: Partial<OrderByItem>) => {
    const nextDesign = {
      ...design,
      orderBy: design.orderBy.map((item, i) => i === idx ? { ...item, ...fields } : item)
    };
    updateDesign(nextDesign);
  };

  const handleRemoveOrderBy = (idx: number) => {
    const nextDesign = {
      ...design,
      orderBy: design.orderBy.filter((_, i) => i !== idx)
    };
    updateDesign(nextDesign);
  };

  // ----------------------------------------------------
  // GROUP BY
  // ----------------------------------------------------
  const handleToggleGroupBy = () => {
    const nextDesign = {
      ...design,
      groupBy: {
        ...design.groupBy,
        enabled: !design.groupBy.enabled,
        columns: !design.groupBy.enabled 
          ? getAllQueryColumns()
              .filter(c => {
                // By default select all non-aggregated visual columns
                const tbl = design.tables.find(t => t.alias === c.table);
                const col = tbl?.columns.find(col => col.name === c.column);
                return col?.selected && !col.customExpression;
              })
              .map(c => ({ table: c.table, column: c.column }))
          : []
      }
    };
    updateDesign(nextDesign);
  };

  const handleToggleGroupByCol = (table: string, column: string) => {
    const exists = design.groupBy.columns.some(c => c.table === table && c.column === column);
    const updatedCols = exists
      ? design.groupBy.columns.filter(c => !(c.table === table && c.column === column))
      : [...design.groupBy.columns, { table, column }];

    const nextDesign = {
      ...design,
      groupBy: {
        ...design.groupBy,
        columns: updatedCols
      }
    };
    updateDesign(nextDesign);
  };

  // ----------------------------------------------------
  // Exports
  // ----------------------------------------------------
  const handleExportSql = () => {
    const blob = new Blob([generatedSql], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `consulta_visual_${new Date().getTime()}.sql`);
    showToast('SQL Exportado exitosamente', 'success');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `diseno_consulta_${new Date().getTime()}.json`);
    showToast('Diseño JSON Exportado exitosamente', 'success');
  };

  const handleExportXml = () => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<QueryBuilderDesign>\n`;
    
    xml += `  <Tables>\n`;
    design.tables.forEach(t => {
      xml += `    <Table name="${t.name}" alias="${t.alias}">\n`;
      t.columns.forEach(c => {
        if (c.selected) {
          xml += `      <Column name="${c.name}" alias="${c.alias || ''}" expression="${c.customExpression || ''}" />\n`;
        }
      });
      xml += `    </Table>\n`;
    });
    xml += `  </Tables>\n`;

    xml += `  <Joins>\n`;
    design.joins.forEach(j => {
      xml += `    <Join type="${j.joinType}">\n`;
      xml += `      <From table="${j.fromTable}" column="${j.fromColumn}" />\n`;
      xml += `      <To table="${j.toTable}" column="${j.toColumn}" />\n`;
      xml += `    </Join>\n`;
    });
    xml += `  </Joins>\n`;

    xml += `  <SQL><![CDATA[${generatedSql}]]></SQL>\n`;
    xml += `</QueryBuilderDesign>`;

    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
    saveAs(blob, `diseno_consulta_${new Date().getTime()}.xml`);
    showToast('Diseño XML Exportado exitosamente', 'success');
  };

  const handleExportPng = () => {
    // Generate simple schema drawing on canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = isDark ? '#0b0f19' : '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < canvas.width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw relations
    ctx.lineWidth = 2.5;
    design.joins.forEach((j, index) => {
      const fromCoords = getColCoords(j.fromTable, j.fromColumn);
      const toCoords = getColCoords(j.toTable, j.toColumn);

      // Adjust coordinate systems
      const startX = fromCoords.xRight;
      const startY = fromCoords.y;
      const endX = toCoords.xLeft;
      const endY = toCoords.y;

      const controlX1 = startX + 50;
      const controlY1 = startY;
      const controlX2 = endX - 50;
      const controlY2 = endY;

      if (j.disabled) {
        ctx.strokeStyle = isDark ? '#475569' : '#cbd5e1';
        ctx.setLineDash([5, 5]);
      } else {
        ctx.strokeStyle = PRESET_COLORS[index % PRESET_COLORS.length].includes('blue') 
          ? '#3b82f6' 
          : '#10b981';
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw table nodes
    design.tables.forEach((t, index) => {
      const headerColor = isDark ? '#1e293b' : '#3b82f6';
      const bodyColor = isDark ? '#0f172a' : '#ffffff';
      const textColor = isDark ? '#f1f5f9' : '#0f172a';

      // Table panel border
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = isDark ? '#334155' : '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(t.x, t.y, t.width, t.height, 8);
      ctx.fill();
      ctx.stroke();

      // Header panel
      ctx.fillStyle = headerColor;
      ctx.beginPath();
      ctx.roundRect(t.x, t.y, t.width, 36, [8, 8, 0, 0]);
      ctx.fill();

      // Table alias and title text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${t.name} (${t.alias})`, t.x + 10, t.y + 22);

      // Column rows
      ctx.fillStyle = textColor;
      ctx.font = '11px monospace';
      t.columns.slice(0, 7).forEach((c, cIdx) => {
        const check = c.selected ? '✓' : ' ';
        const pkFk = c.isPk ? '[PK]' : (c.isFk ? '[FK]' : '    ');
        ctx.fillText(`${check} ${pkFk} ${c.name.substring(0, 16)}`, t.x + 10, t.y + 65 + cIdx * 24);
      });
      if (t.columns.length > 7) {
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.fillText(`... y ${t.columns.length - 7} columnas más`, t.x + 10, t.y + 65 + 7 * 24);
      }
    });

    // Download canvas as PNG
    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, `diagrama_consulta_${new Date().getTime()}.png`);
        showToast('Diagrama guardado como PNG', 'success');
      }
    });
  };

  // ----------------------------------------------------
  // Save as Favorite (Append design details to favorites)
  // ----------------------------------------------------
  const handleSaveToFavorites = () => {
    // Add design to local favorites via store
    const name = prompt('Ingresa un nombre para guardar este diseño de consulta:');
    if (!name) return;

    // Use default 'Varios' section or find sections
    const sectionId = 'section-varios'; 
    const sqlWithComment = compileDesignToSql(design, true);
    useAppStore.getState().addFavoriteFromSql(sqlWithComment, name, sectionId);
    showToast(`Consulta visual "${name}" guardada en Favoritos locales.`, 'success');
    setIsDirty(false);
  };

  // ----------------------------------------------------
  // Bidirectional Synchronization Handler
  // ----------------------------------------------------
  const handleMonacoEditorChange = (value: string | undefined) => {
    if (!value) return;
    setGeneratedSql(value);
    
    // Attempt parsing
    const parsedState = parseSqlToState(value, availableTables);
    if (parsedState) {
      setDesign(parsedState);
      setSqlSyncWarning(null);
    } else {
      // Show manual edit warning
      setSqlSyncWarning('Edición manual activa. El diagrama no se actualizará hasta que la sintaxis SELECT sea completamente compatible.');
    }
  };

  const handleFormatSql = () => {
    try {
      const formatted = generatedSql.split('-- TKR_QUERY_BUILDER_DESIGN:')[0];
      const designComment = generatedSql.includes('-- TKR_QUERY_BUILDER_DESIGN:') 
        ? '\n\n-- TKR_QUERY_BUILDER_DESIGN:' + generatedSql.split('-- TKR_QUERY_BUILDER_DESIGN:')[1]
        : '';
      
      const res = formatted.trim(); // formatter can be called here if sql-formatter works well
      setGeneratedSql(res + designComment);
      showToast('Sintaxis SQL formateada', 'success');
    } catch (e) {
      showToast('Error al formatear SQL', 'error');
    }
  };

  const handleCopySql = () => {
    // Copy clean SELECT query to clipboard
    const cleanSql = compileDesignToSql(design, false);
    navigator.clipboard.writeText(cleanSql);
    setCopied(true);
    showToast('Consulta SQL copiada al portapapeles', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNewQueryClick = () => {
    if (isDirty && design.tables.length > 0) {
      setShowNewQueryConfirm(true);
    } else {
      handleClearCanvas();
    }
  };

  const handleClearCanvas = () => {
    const initial = createInitialDesign();
    setDesign(initial);
    setGeneratedSql('');
    setHistory([JSON.parse(JSON.stringify(initial))]);
    setHistoryIndex(0);
    setIsDirty(false);
    setShowNewQueryConfirm(false);
    showToast('Lienzo limpio. Iniciando nueva consulta.', 'info');
  };

  const handleSaveAndClear = () => {
    // Save current design first
    const name = prompt('Ingresa un nombre para guardar este diseño de consulta:');
    if (!name) return; // user cancelled, keep design

    const sectionId = 'section-varios'; 
    const sqlWithComment = compileDesignToSql(design, true);
    useAppStore.getState().addFavoriteFromSql(sqlWithComment, name, sectionId);
    showToast(`Consulta visual "${name}" guardada en Favoritos locales.`, 'success');
    
    // Then clear canvas
    handleClearCanvas();
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col font-sans transition-colors duration-200 ${
      isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-950'
    }`}>
      {/* 1. Header Toolbar */}
      <header className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
        isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
            <Combine className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight">Constructor Visual SELECT</h1>
              {activeConnection && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/25 animate-pulse">
                  🔌 {activeConnection.name}
                </span>
              )}
            </div>
            <p className="text-[10px] opacity-60">Diseñador drag & drop estilo PowerBuilder Query Painter</p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button 
            onClick={handleUndo} 
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
            title="Deshacer (Undo)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button 
            onClick={handleRedo} 
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
            title="Rehacer (Redo)"
          >
            <Redo className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-gray-700/30 dark:bg-gray-300/30 mx-1" />

          {/* Join style selector */}
          <div className={`flex items-center gap-1 p-0.5 rounded-lg border ${
            isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-100 border-gray-200'
          }`}>
            <button
              onClick={() => updateDesign({ ...design, useAnsiJoin: true })}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                design.useAnsiJoin
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              ANSI JOIN
            </button>
            <button
              onClick={() => updateDesign({ ...design, useAnsiJoin: false })}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                !design.useAnsiJoin
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              CLÁSICA ORACLE
            </button>
          </div>

          <div className="w-px h-5 bg-gray-700/30 dark:bg-gray-300/30 mx-1" />

          {/* Save & Exports */}
          <button
            onClick={handleNewQueryClick}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
              isDark ? 'border-gray-800' : 'border-gray-200'
            }`}
            title="Crear nueva consulta (limpiar lienzo)"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva Consulta
          </button>

          <button
            onClick={handleSaveToFavorites}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            title="Guardar diseño en favoritos"
          >
            <CloudUpload className="w-3.5 h-3.5" /> Guardar
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
              isDark ? 'border-gray-800' : 'border-gray-200'
            }`}>
              Exportar <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className={`absolute right-0 mt-1 w-48 rounded-xl shadow-2xl border p-1 hidden group-hover:block z-[200] backdrop-blur-md ${
              isDark ? 'bg-gray-900 border-gray-850' : 'bg-white border-gray-200'
            }`}>
              <button onClick={handleExportSql} className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs hover:bg-blue-500 hover:text-white transition-colors text-left">
                <Code className="w-3.5 h-3.5" /> Exportar SQL
              </button>
              <button onClick={handleExportJson} className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs hover:bg-blue-500 hover:text-white transition-colors text-left">
                <FileText className="w-3.5 h-3.5" /> Exportar JSON
              </button>
              <button onClick={handleExportXml} className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs hover:bg-blue-500 hover:text-white transition-colors text-left">
                <FileText className="w-3.5 h-3.5" /> Exportar XML (Diagrama)
              </button>
              <button onClick={handleExportPng} className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs hover:bg-blue-500 hover:text-white transition-colors text-left">
                <Image className="w-3.5 h-3.5" /> Descargar PNG Diagrama
              </button>
            </div>
          </div>

          <div className="w-px h-5 bg-gray-700/30 dark:bg-gray-300/30 mx-1" />

          {/* Close builder */}
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
            title="Cerrar Diseñador"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Main Workspace */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Left Side: Table Selector */}
        <aside className={`w-64 border-r flex flex-col shrink-0 ${
          isDark ? 'bg-gray-900 border-gray-850' : 'bg-white border-gray-200'
        }`}>
          <div className="p-3 border-b flex flex-col gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Tablas Disponibles</span>
            <input
              type="text"
              placeholder="Buscar tabla..."
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              className={`w-full px-2 py-1 rounded border text-xs outline-none bg-transparent focus:ring-1 focus:ring-blue-500 ${
                isDark ? 'border-gray-800 text-gray-200' : 'border-gray-300 text-gray-800'
              }`}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
            {isLoadingTables ? (
              <div className="text-center py-8 text-xs opacity-50 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando tablas...
              </div>
            ) : availableTables.length > 0 ? (
              availableTables
                .filter(t => t.toLowerCase().includes(sidebarSearch.toLowerCase()))
                .map(tbl => (
                  <div
                    key={tbl}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'TABLE', name: tbl }));
                    }}
                    onClick={() => handleAddTable(tbl)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-grab transition-all flex items-center justify-between group ${
                      isDark 
                        ? 'bg-gray-950/40 border-gray-850 hover:border-blue-500/30 text-gray-300 hover:text-gray-100 hover:bg-gray-800/20' 
                        : 'bg-gray-50 border-gray-200 hover:border-blue-500/30 text-gray-700 hover:text-blue-600 hover:bg-blue-50/20'
                    }`}
                    title="Arrastra al lienzo o haz clic para agregar"
                  >
                    <span className="truncate">📊 {tbl}</span>
                    <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-xs opacity-40 italic">No hay tablas</div>
            )}
          </div>
        </aside>

        {/* Central Graphic Designer Canvas */}
        <main 
          ref={canvasRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="flex-1 min-h-0 relative overflow-hidden select-none cursor-grab active:cursor-grabbing bg-opacity-95"
          style={{
            backgroundImage: isDark
              ? 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)'
              : 'radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundColor: isDark ? '#0b0f19' : '#f8fafc'
          }}
        >
          {/* Loading overlay for table metadata and columns loading */}
          {isLoadingMetadata && (
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] z-50 flex items-center justify-center animate-fade-in pointer-events-auto">
              <div className={`p-4 rounded-3xl border shadow-2xl flex items-center gap-3 ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-250 text-slate-800'
              }`}>
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-xs font-extrabold">Cargando metadatos y relaciones de la tabla...</span>
              </div>
            </div>
          )}
          {/* Zoom Indicator Toolbar inside canvas */}
          <div className="absolute top-4 left-4 z-50 flex items-center gap-1.5 p-1 rounded-xl shadow-lg border backdrop-blur-md bg-opacity-80 dark:bg-opacity-85"
            style={{
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#e5e7eb'
            }}
          >
            <button onClick={handleZoomIn} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" title="Zoom Acercar">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold px-1 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomOut} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" title="Zoom Alejar">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleZoomReset} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[9px] font-extrabold tracking-wide uppercase transition-colors cursor-pointer" title="Restaurar zoom">
              Reset
            </button>
          </div>

          {/* Draggable Table Floating Windows & SVG Connector lines */}
          <div 
            ref={wrapperRef}
            className="absolute inset-0" 
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0'
            }}
          >
            {/* SVG Connector lines */}
            <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full">
              <g>
                {design.joins.map((join, index) => {
                  const fromTable = design.tables.find(t => t.id === join.fromTable);
                  const toTable = design.tables.find(t => t.id === join.toTable);
                  if (!fromTable || !toTable) return null;

                  // If no foreign key exists between these tables, do not draw it on the graphic
                  if (!hasForeignKeyBetweenTables(join.fromTable, join.toTable)) return null;

                  const fromCoords = getColCoords(join.fromTable, join.fromColumn);
                  const toCoords = getColCoords(join.toTable, join.toColumn);

                  // Dynamically connect to the closest left/right table boundaries
                  const isLeftToRight = fromTable.x + fromTable.width < toTable.x;
                  const isRightToLeft = fromTable.x > toTable.x + toTable.width;

                  const startX = isLeftToRight
                    ? fromCoords.xRight
                    : (isRightToLeft ? fromCoords.xLeft : (fromTable.x < toTable.x ? fromCoords.xRight : fromCoords.xLeft));
                  const endX = isLeftToRight
                    ? toCoords.xLeft
                    : (isRightToLeft ? toCoords.xRight : (fromTable.x < toTable.x ? toCoords.xLeft : toCoords.xRight));
                  const startY = fromCoords.y;
                  const endY = toCoords.y;

                  // Bend Bezier curves outside table borders
                  const controlDist = Math.max(50, Math.abs(endX - startX) * 0.5);
                  const controlX1 = startX < endX ? startX + controlDist : startX - controlDist;
                  const controlY1 = startY;
                  const controlX2 = startX < endX ? endX - controlDist : endX + controlDist;
                  const controlY2 = endY;

                  const midX = (startX + endX) / 2;
                  const midY = (startY + endY) / 2;

                  const isHovered = hoveredJoinId === join.id;
                  const isSelected = selectedJoinId === join.id;
                  const isDisabled = join.disabled;

                  let strokeColor = '';
                  if (isSelected) {
                    strokeColor = '#ef4444';
                  } else if (isHovered) {
                    strokeColor = '#f59e0b';
                  } else if (isDisabled) {
                    strokeColor = isDark ? '#475569' : '#cbd5e1';
                  } else {
                    strokeColor = isDark ? '#3b82f6' : '#2563eb';
                  }

                  const strokeWidth = isSelected ? 4 : (isHovered ? 4.5 : (isDisabled ? 2.5 : 3));
                  const strokeDasharray = isDisabled ? "5,5" : undefined;

                  return (
                    <g 
                      key={join.id} 
                      className="transition-opacity duration-150"
                      style={{ opacity: hoveredJoinId && !isHovered ? 0.35 : 1 }}
                    >
                      {/* Transparent wide path for hover ease */}
                      <path
                        d={`M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={16}
                        className="cursor-pointer pointer-events-auto"
                        onMouseEnter={() => setHoveredJoinId(join.id)}
                        onMouseLeave={() => setHoveredJoinId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditJoin(join.id);
                        }}
                      />
                      {/* Main connection curve */}
                      <path
                        d={`M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                        className="cursor-pointer pointer-events-none transition-all duration-150"
                      />
                      {/* Join Indicator Circle */}
                      <circle
                        cx={midX}
                        cy={midY}
                        r={10}
                        fill={isDisabled ? (isDark ? '#334155' : '#f1f5f9') : (isDark ? '#1f2937' : '#ffffff')}
                        stroke={strokeColor}
                        strokeWidth={isHovered ? 3 : 2}
                        onMouseEnter={() => setHoveredJoinId(join.id)}
                        onMouseLeave={() => setHoveredJoinId(null)}
                        className="cursor-pointer pointer-events-auto shadow-md transition-all duration-150"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDisabled) {
                            handleToggleJoinDisabled(join.id);
                          } else {
                            handleEditJoin(join.id);
                          }
                        }}
                      >
                        <title>{isDisabled ? "Clic para activar esta relación" : "Clic para configurar/desactivar relación"}</title>
                      </circle>
                      <text
                        x={midX}
                        y={midY + 3.5}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        fill={isSelected ? '#ef4444' : (isHovered ? '#fbbf24' : (isDisabled ? (isDark ? '#64748b' : '#94a3b8') : (isDark ? '#60a5fa' : '#2563eb')))}
                        className="pointer-events-none select-none"
                      >
                        {join.joinType === 'INNER' ? '=' : (join.joinType === 'LEFT' ? 'L' : (join.joinType === 'RIGHT' ? 'R' : 'F'))}
                      </text>
                    </g>
                  );
                })}

                {/* Linking helper connection */}
                {linkingStart && (
                  <path
                    d={`M ${getColCoords(linkingStart.tableAlias, linkingStart.colName).xRight} ${getColCoords(linkingStart.tableAlias, linkingStart.colName).y} L ${linkingMousePos.x} ${linkingMousePos.y}`}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                )}
              </g>
            </svg>
            {design.tables.map(tbl => (
              <div
                key={tbl.id}
                style={{ 
                  left: tbl.x, 
                  top: tbl.y, 
                  width: tbl.width,
                  height: tbl.height
                }}
                className={`absolute rounded-2xl border shadow-2xl flex flex-col pointer-events-auto overflow-hidden transition-shadow duration-150 ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:shadow-blue-900/10' : 'bg-white border-slate-200 hover:shadow-blue-100/30'
                }`}
              >
                {/* Table Window Header */}
                <div
                  onMouseDown={(e) => handleNodeHeaderMouseDown(e, tbl.id)}
                  className={`px-3 py-2 cursor-move flex items-center justify-between text-white ${
                    PRESET_COLORS[design.tables.indexOf(tbl) % PRESET_COLORS.length]
                  }`}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">Tabla</span>
                    <h3 className="text-xs font-extrabold truncate" title={tbl.name}>
                      {tbl.name} {tbl.alias && <span className="opacity-75 font-normal">({tbl.alias})</span>}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleUpdateTableAlias(tbl.id)}
                      className="p-1 rounded-lg hover:bg-black/25 text-white/80 hover:text-white transition-colors cursor-pointer"
                      title="Establecer/Editar Alias de Tabla"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleComments(tbl.id)}
                      className="p-1 rounded-lg hover:bg-black/25 text-white/80 hover:text-white transition-colors cursor-pointer"
                      title={tbl.showComments ? "Ocultar comentarios" : "Mostrar comentarios de columnas"}
                    >
                      {loadingCommentsTable === tbl.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MessageSquare className={`w-3.5 h-3.5 ${tbl.showComments ? 'text-yellow-400' : ''}`} />
                      )}
                    </button>
                    <button
                      onClick={() => handleRemoveTable(tbl.id)}
                      className="p-1 rounded-lg hover:bg-black/25 text-white/80 hover:text-white transition-colors cursor-pointer"
                      title="Remover tabla"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Column Search Filter inside Table Node */}
                <div className={`p-2 border-b shrink-0 ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/80 border-slate-200'}`}>
                  <input
                    type="text"
                    placeholder="Filtrar columnas..."
                    id={`search-cols-${tbl.id}`}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase();
                      const items = document.querySelectorAll(`.col-row-${tbl.id}`);
                      items.forEach((item: any) => {
                        const colName = item.dataset.colname.toLowerCase();
                        if (colName.includes(val)) {
                          item.style.display = 'flex';
                        } else {
                          item.style.display = 'none';
                        }
                      });
                    }}
                    className={`w-full px-2 py-0.5 rounded border text-[10px] bg-transparent outline-none ${
                      isDark ? 'border-slate-800 text-slate-300 focus:border-blue-500' : 'border-slate-350 text-slate-700 focus:border-blue-500'
                    }`}
                  />
                </div>

                {/* Columns Scrollable list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                  {tbl.columns.map(col => {
                    const isColHighlighted = isColumnInHoveredJoin(tbl.id, col.name);
                    return (
                      <div
                        key={col.name}
                        data-colname={col.name}
                        onMouseUp={(e) => handleJoinHandleMouseUp(e, tbl.id, col.name)}
                        className={`col-row-${tbl.id} flex items-center justify-between px-2 py-1 rounded-md text-[10.5px] group transition-all duration-150 ${
                          isColHighlighted
                            ? (isDark ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30' : 'bg-amber-100 text-amber-800 font-bold border border-amber-300')
                            : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {/* Checkbox selector */}
                        <input
                          type="checkbox"
                          checked={col.selected}
                          onChange={() => handleToggleColumn(tbl.id, col.name)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        />

                        {/* PK/FK Status indicators */}
                        {col.isPk && (
                          <span className="text-[10px] text-amber-500 font-bold tracking-tight select-none shrink-0" title="Primary Key">🔑</span>
                        )}
                        {col.isFk && (
                          <span className="text-[10px] text-emerald-500 font-bold tracking-tight select-none shrink-0" title="Foreign Key">🔗</span>
                        )}

                        <span 
                          onClick={() => handleToggleColumn(tbl.id, col.name)}
                          className={`font-mono truncate cursor-pointer select-none flex flex-col items-start ${
                            col.selected ? 'font-bold text-blue-500 dark:text-blue-400' : 'opacity-80'
                          }`}
                        >
                          <span>{col.customExpression ? `[f] ${col.alias || col.name}` : col.name}</span>
                          {tbl.showComments && tbl.comments?.[col.name] && (
                            <span className="text-[9px] text-slate-500 italic block font-sans font-normal mt-0.5 max-w-[170px] truncate" title={tbl.comments[col.name]}>
                              {tbl.comments[col.name]}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Connection Handle Circle on hover / for joins */}
                      {!col.customExpression && (
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="text-[9px] opacity-40 font-mono select-none hidden group-hover:inline-block">
                            {col.dataType.toLowerCase()}
                          </span>
                          
                          <div
                            id={`handle-${tbl.id}-${col.name}`}
                            onMouseDown={(e) => handleJoinHandleMouseDown(e, tbl.id, col.name, false)}
                            onMouseUp={(e) => handleJoinHandleMouseUp(e, tbl.id, col.name)}
                            className="w-3 h-3 rounded-full border border-blue-500 hover:bg-blue-500 cursor-crosshair bg-white dark:bg-slate-900 transition-colors"
                            title="Arrastra para conectar/Join"
                          />
                        </div>
                      )}

                      {/* Action for custom aggregated columns */}
                      {col.customExpression && (
                        <button
                          onClick={() => handleRemoveCalculatedColumn(tbl.id, col.name)}
                          className="p-0.5 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* Resize handle (bottom right corner) */}
                <div
                  onMouseDown={(e) => handleResizeHandleMouseDown(e, tbl.id)}
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center z-20"
                  title="Arrastra para cambiar el tamaño de la tabla"
                >
                  <svg width="6" height="6" viewBox="0 0 6 6" className="opacity-40 hover:opacity-100 text-slate-400">
                    <line x1="6" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="6" y1="3" x2="3" y2="6" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Join Connection Editor Popover Overlay */}
          {selectedJoinId && (() => {
            const join = design.joins.find(j => j.id === selectedJoinId);
            if (!join) return null;
            
            // Calculate coordinates
            const fromCoords = getColCoords(join.fromTable, join.fromColumn);
            const toCoords = getColCoords(join.toTable, join.toColumn);
            const x = (fromCoords.xRight + toCoords.xLeft) / 2 * zoom + pan.x;
            const y = (fromCoords.y + toCoords.y) / 2 * zoom + pan.y;

            return (
              <div 
                style={{ left: x - 90, top: y - 80 }}
                className={`absolute z-[120] p-3 rounded-2xl shadow-2xl border w-48 flex flex-col gap-2 backdrop-blur-md ${
                  isDark ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="text-[10px] font-bold opacity-60 uppercase">Editar Relación</span>
                  <button onClick={() => setSelectedJoinId(null)} className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <span className="text-[9px] font-mono opacity-80 break-all bg-black/10 dark:bg-black/30 px-1 py-0.5 rounded">
                  {join.fromTable}.{join.fromColumn} = {join.toTable}.{join.toColumn}
                </span>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold opacity-60">TIPO DE JOIN</label>
                  <select
                    value={join.joinType}
                    onChange={(e) => handleChangeJoinType(join.id, e.target.value as any)}
                    className={`w-full text-xs p-1 rounded border outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-350'
                    }`}
                  >
                    <option value="INNER">INNER JOIN</option>
                    <option value="LEFT">LEFT OUTER JOIN</option>
                    <option value="RIGHT">RIGHT OUTER JOIN</option>
                    <option value="FULL">FULL OUTER JOIN</option>
                  </select>
                </div>

                {join.disabled ? (
                  <>
                    <button
                      onClick={() => handleToggleJoinDisabled(join.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold rounded-lg text-emerald-500 hover:bg-emerald-500/10 border border-emerald-500/25 transition-colors cursor-pointer mt-1"
                    >
                      Activar Join
                    </button>
                    <button
                      onClick={() => handlePermanentDeleteJoin(join.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold rounded-lg text-red-500 hover:bg-red-500/10 border border-red-500/25 transition-colors cursor-pointer mt-1"
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar permanentemente
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDeleteJoin(join.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold rounded-lg text-red-500 hover:bg-red-500/10 border border-red-500/25 transition-colors cursor-pointer mt-1"
                    title="Desactiva la relación y la excluye de la consulta"
                  >
                    <Trash2 className="w-3 h-3" /> Desactivar Join
                  </button>
                )}
              </div>
            );
          })()}
        </main>
      </div>

      {/* 3. Bottom Panels: SQL Preview & Grid Settings */}
      <div className={`h-[320px] border-t flex shrink-0 ${
        isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
      }`}>
        
        {/* Left Side Panel: REAL-TIME SQL PREVIEW (Resizable or Split) */}
        <div className="w-[45%] border-r flex flex-col relative">
          <div className={`px-3 py-1.5 border-b flex items-center justify-between text-[10px] uppercase font-bold tracking-wider ${
            isDark ? 'bg-gray-950/40 border-gray-850' : 'bg-gray-50 border-gray-250'
          }`}>
            <span className="flex items-center gap-1 text-blue-500"><Code className="w-3.5 h-3.5" /> Consulta SQL Generada</span>
            
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleFormatSql} 
                className="px-2 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] font-semibold flex items-center gap-1 cursor-pointer transition-colors border dark:border-gray-800"
                title="Alinear e indexar sintaxis SQL"
              >
                <RefreshCw className="w-3 h-3" /> Formatear
              </button>
              <button 
                onClick={handleCopySql} 
                className="px-2 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] font-semibold flex items-center gap-1 cursor-pointer transition-colors border dark:border-gray-800 text-blue-500 hover:text-blue-600"
                title="Copiar consulta SQL al portapapeles"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                Copiar
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 relative">
            <Editor
              height="100%"
              language="sql"
              theme={isDark ? 'vs-dark' : 'light'}
              value={generatedSql}
              onChange={handleMonacoEditorChange}
              onMount={(editor) => { editorRef.current = editor; }}
              options={{
                minimap: { enabled: false },
                fontSize: 11.5,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                scrollBeyondLastLine: false,
                wordWrap: 'on'
              }}
            />
          </div>

          {/* Sync status warnings */}
          {sqlSyncWarning && (
            <div className="absolute bottom-0 inset-x-0 bg-amber-500/20 border-t border-amber-500/40 px-3 py-1.5 flex items-start gap-1.5 text-[10.5px] text-amber-600 dark:text-amber-400 backdrop-blur-md">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <span>{sqlSyncWarning}</span>
            </div>
          )}
        </div>

        {/* Right Side Panel: Visual Settings Tabs */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Tab selector bar */}
          <div className={`px-2 flex items-center justify-between border-b ${
            isDark ? 'bg-gray-950/40 border-gray-850' : 'bg-gray-50 border-gray-250'
          }`}>
            <div className="flex items-center">
              <button
                onClick={() => setActiveBottomTab('columns')}
                className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1 transition-all cursor-pointer ${
                  activeBottomTab === 'columns'
                    ? 'border-blue-500 text-blue-500 bg-black/5 dark:bg-white/5'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <Columns className="w-3.5 h-3.5" /> Columnas SELECT
              </button>
              <button
                onClick={() => setActiveBottomTab('joins')}
                className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1 transition-all cursor-pointer ${
                  activeBottomTab === 'joins'
                    ? 'border-blue-500 text-blue-500 bg-black/5 dark:bg-white/5'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Relaciones JOIN
              </button>
              <button
                onClick={() => setActiveBottomTab('where')}
                className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1 transition-all cursor-pointer ${
                  activeBottomTab === 'where'
                    ? 'border-blue-500 text-blue-500 bg-black/5 dark:bg-white/5'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <Filter className="w-3.5 h-3.5" /> Filtros WHERE
              </button>
              <button
                onClick={() => setActiveBottomTab('orderby')}
                className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1 transition-all cursor-pointer ${
                  activeBottomTab === 'orderby'
                    ? 'border-blue-500 text-blue-500 bg-black/5 dark:bg-white/5'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <ArrowDownUp className="w-3.5 h-3.5" /> Ordenamiento ORDER BY
              </button>
              <button
                onClick={() => setActiveBottomTab('groupby')}
                className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1 transition-all cursor-pointer ${
                  activeBottomTab === 'groupby'
                    ? 'border-blue-500 text-blue-500 bg-black/5 dark:bg-white/5'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <Grid className="w-3.5 h-3.5" /> Agrupamiento GROUP BY
              </button>
            </div>

            <div className="pr-2 flex items-center gap-1">
              {activeBottomTab === 'columns' && (
                <button
                  onClick={() => setIsCalculatedColModalOpen(true)}
                  className="px-2.5 py-1 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Añadir Calculada
                </button>
              )}
            </div>
          </div>

          {/* Tab content panel */}
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            
            {/* TAB: Columns SELECT */}
            {activeBottomTab === 'columns' && (() => {
              const selectedCols: Array<{ tableId: string; tableName: string; tableAlias: string; col: ColumnDesign }> = [];
              design.tables.forEach(t => {
                t.columns.forEach(c => {
                  if (c.selected) {
                    selectedCols.push({ tableId: t.id, tableName: t.name, tableAlias: t.alias, col: c });
                  }
                });
              });

              return (
                <div className="w-full">
                  {selectedCols.length === 0 ? (
                    <div className="text-center py-12 text-xs opacity-50 italic">
                      Marca las casillas de verificación en las columnas de las ventanas flotantes para agregarlas al listado SELECT.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-700/20 opacity-60">
                          <th className="py-1 px-2">Tabla (Alias)</th>
                          <th className="py-1 px-2">Columna original</th>
                          <th className="py-1 px-2">Expresión / Función</th>
                          <th className="py-1 px-2">Alias de salida</th>
                          <th className="py-1 px-2 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCols.map(({ tableId, tableName, tableAlias, col }) => (
                          <tr key={`${tableId}.${col.name}`} className="border-b border-gray-700/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                            <td className="py-1.5 px-2 font-semibold text-blue-500">{tableAlias || tableName}</td>
                            <td className="py-1.5 px-2 font-mono">{col.customExpression ? '-' : col.name}</td>
                            <td className="py-1.5 px-2 font-mono">
                              {col.customExpression ? (
                                <input
                                  type="text"
                                  value={col.customExpression}
                                  onChange={(e) => {
                                    const nextDesign = {
                                      ...design,
                                      tables: design.tables.map(t => t.id === tableId ? {
                                        ...t,
                                        columns: t.columns.map(c => c.name === col.name ? { ...c, customExpression: e.target.value } : c)
                                      } : t)
                                    };
                                    updateDesign(nextDesign);
                                  }}
                                  className={`w-full px-1.5 py-0.5 rounded border text-[11px] font-mono outline-none ${
                                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-250 text-slate-900'
                                  }`}
                                />
                              ) : (
                                <span className="opacity-40">Directa</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                placeholder="alias_nombre"
                                value={col.alias || ''}
                                onChange={(e) => handleColumnAliasChange(tableId, col.name, e.target.value)}
                                className={`px-1.5 py-0.5 rounded border text-[11px] outline-none ${
                                  isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-250 text-slate-900'
                                }`}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <button
                                onClick={() => {
                                  if (col.customExpression) {
                                    handleRemoveCalculatedColumn(tableId, col.name);
                                  } else {
                                    handleToggleColumn(tableId, col.name);
                                  }
                                }}
                                className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                                title="Remover de SELECT"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })()}

            {/* TAB: Relaciones JOIN */}
            {activeBottomTab === 'joins' && (() => {
              const tables = design.tables;
              
              const getTableColumns = (tblId: string) => {
                const tbl = tables.find(t => t.id === tblId);
                return tbl ? tbl.columns.filter(c => !c.customExpression) : [];
              };

              const handleAddJoinSubmit = (e: React.FormEvent) => {
                e.preventDefault();
                if (!addJoinFromTable || !addJoinFromColumn || !addJoinToTable || !addJoinToColumn) {
                  showToast('Debes seleccionar las tablas y columnas para la relación.', 'error');
                  return;
                }
                if (addJoinFromTable === addJoinToTable) {
                  showToast('No puedes relacionar una tabla con sí misma.', 'error');
                  return;
                }

                // Check if relationship already exists
                const exists = design.joins.some(j => 
                  (j.fromTable === addJoinFromTable && j.fromColumn === addJoinFromColumn && j.toTable === addJoinToTable && j.toColumn === addJoinToColumn) ||
                  (j.fromTable === addJoinToTable && j.fromColumn === addJoinToColumn && j.toTable === addJoinFromTable && j.toColumn === addJoinFromColumn)
                );

                if (exists) {
                  showToast('Esta relación ya existe.', 'error');
                  return;
                }

                const newJoin: JoinDesign = {
                  id: crypto.randomUUID(),
                  fromTable: addJoinFromTable,
                  fromColumn: addJoinFromColumn,
                  toTable: addJoinToTable,
                  toColumn: addJoinToColumn,
                  joinType: addJoinType,
                  isFk: false
                };

                const nextDesign = {
                  ...design,
                  joins: [...design.joins, newJoin]
                };

                updateDesign(nextDesign);
                showToast(`Relación personalizada agregada entre ${addJoinFromTable}.${addJoinFromColumn} y ${addJoinToTable}.${addJoinToColumn}`, 'success');
                
                setAddJoinFromColumn('');
                setAddJoinToColumn('');
              };

              return (
                <div className="w-full flex flex-col lg:flex-row gap-6">
                  {/* Left: Add Join Form */}
                  <div className={`lg:w-1/3 p-4 rounded-2xl border flex flex-col gap-3.5 ${
                    isDark ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50/50 border-slate-200'
                  }`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">Agregar Nueva Relación</h4>
                    
                    <form onSubmit={handleAddJoinSubmit} className="flex flex-col gap-3">
                      {/* From Table & Column */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold opacity-60">TABLA ORIGEN (FROM)</label>
                        <select
                          value={addJoinFromTable}
                          onChange={(e) => {
                            setAddJoinFromTable(e.target.value);
                            setAddJoinFromColumn('');
                          }}
                          className={`p-2 text-xs rounded-xl border outline-none ${
                            isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-850'
                          }`}
                        >
                          <option value="">-- Seleccionar Tabla --</option>
                          {tables.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                          ))}
                        </select>
                        
                        {addJoinFromTable && (
                          <select
                            value={addJoinFromColumn}
                            onChange={(e) => setAddJoinFromColumn(e.target.value)}
                            className={`p-2 text-xs rounded-xl border outline-none mt-1 font-mono ${
                              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-850'
                            }`}
                          >
                            <option value="">-- Seleccionar Columna --</option>
                            {getTableColumns(addJoinFromTable).map(c => (
                              <option key={c.name} value={c.name}>{c.name} ({c.dataType.toLowerCase()})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Operator '=' */}
                      <div className="text-center font-bold text-xs opacity-40 py-0.5">
                        =
                      </div>

                      {/* To Table & Column */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold opacity-60">TABLA DESTINO (TO)</label>
                        <select
                          value={addJoinToTable}
                          onChange={(e) => {
                            setAddJoinToTable(e.target.value);
                            setAddJoinToColumn('');
                          }}
                          className={`p-2 text-xs rounded-xl border outline-none ${
                            isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-850'
                          }`}
                        >
                          <option value="">-- Seleccionar Tabla --</option>
                          {tables.filter(t => t.id !== addJoinFromTable).map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                          ))}
                        </select>
                        
                        {addJoinToTable && (
                          <select
                            value={addJoinToColumn}
                            onChange={(e) => setAddJoinToColumn(e.target.value)}
                            className={`p-2 text-xs rounded-xl border outline-none mt-1 font-mono ${
                              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-850'
                            }`}
                          >
                            <option value="">-- Seleccionar Columna --</option>
                            {getTableColumns(addJoinToTable).map(c => (
                              <option key={c.name} value={c.name}>{c.name} ({c.dataType.toLowerCase()})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Join Type */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold opacity-60">TIPO DE JOIN</label>
                        <select
                          value={addJoinType}
                          onChange={(e) => setAddJoinType(e.target.value as any)}
                          className={`p-2 text-xs rounded-xl border outline-none ${
                            isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-850'
                          }`}
                        >
                          {design.useAnsiJoin ? (
                            <>
                              <option value="INNER">INNER JOIN</option>
                              <option value="LEFT">LEFT OUTER JOIN</option>
                              <option value="RIGHT">RIGHT OUTER JOIN</option>
                              <option value="FULL">FULL OUTER JOIN</option>
                            </>
                          ) : (
                            <>
                              <option value="INNER">INNER JOIN (=)</option>
                              <option value="LEFT">LEFT OUTER JOIN (= (+))</option>
                              <option value="RIGHT">RIGHT OUTER JOIN ((+) =)</option>
                            </>
                          )}
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={!addJoinFromTable || !addJoinFromColumn || !addJoinToTable || !addJoinToColumn}
                        className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        Agregar Relación
                      </button>
                    </form>
                  </div>

                  {/* Right: Existing Joins List */}
                  <div className="flex-1 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
                        Relaciones Definidas ({design.joins.length})
                      </h4>
                      <span className="text-[10px] opacity-60 font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 border">
                        Sintaxis: {design.useAnsiJoin ? 'ANSI JOIN' : 'CLÁSICA ORACLE'}
                      </span>
                    </div>

                    {design.joins.length === 0 ? (
                      <div className="text-center py-12 text-xs opacity-50 border border-dashed rounded-2xl p-6 italic">
                        No hay relaciones definidas en el lienzo ni manuales.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar">
                        {design.joins.map((join) => {
                          const isFkRelation = join.isFk;
                          const isDisabled = join.disabled;

                          let operatorSymbol = '=';
                          if (!design.useAnsiJoin) {
                            if (join.joinType === 'LEFT') operatorSymbol = '= (+)';
                            else if (join.joinType === 'RIGHT') operatorSymbol = '(+) =';
                          }

                          return (
                            <div
                              key={join.id}
                              className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border transition-all duration-150 ${
                                isDisabled
                                  ? (isDark ? 'bg-slate-950/20 border-slate-900 opacity-55 text-slate-500' : 'bg-slate-100/50 border-slate-200 opacity-60 text-slate-400')
                                  : (isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800')
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="font-mono text-xs truncate flex items-center gap-1.5">
                                  <span className="text-blue-500 font-semibold">{join.fromTable}</span>
                                  <span className="opacity-45">.</span>
                                  <span className="opacity-90">{join.fromColumn}</span>
                                  
                                  <span className="text-amber-500 font-extrabold mx-1">{operatorSymbol}</span>
                                  
                                  <span className="text-blue-500 font-semibold">{join.toTable}</span>
                                  <span className="opacity-45">.</span>
                                  <span className="opacity-90">{join.toColumn}</span>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {isFkRelation ? (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold select-none border ${
                                      isDisabled
                                        ? 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                    }`} title="Esta relación viene definida por la llave foránea física en la BD">
                                      Llave Foránea
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-blue-500/10 border border-blue-500/20 text-blue-500 select-none" title="Relación personalizada creada por el usuario">
                                      Personalizada
                                    </span>
                                  )}
                                  {isDisabled && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-slate-500/10 border border-slate-500/20 text-slate-500 select-none">
                                      Desactivada
                                    </span>
                                  )}
                                  {!isFkRelation && !hasForeignKeyBetweenTables(join.fromTable, join.toTable) && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/10 border border-amber-500/20 text-amber-500 select-none" title="Esta relación no se dibuja en el gráfico porque las tablas no tienen llave foránea en la BD">
                                      Sin Gráfico
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <select
                                  disabled={isDisabled}
                                  value={join.joinType}
                                  onChange={(e) => handleChangeJoinType(join.id, e.target.value as any)}
                                  className={`p-1 text-xs rounded-xl border outline-none font-semibold ${
                                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                                  } disabled:opacity-40`}
                                >
                                  {design.useAnsiJoin ? (
                                    <>
                                      <option value="INNER">INNER JOIN</option>
                                      <option value="LEFT">LEFT OUTER JOIN</option>
                                      <option value="RIGHT">RIGHT OUTER JOIN</option>
                                      <option value="FULL">FULL OUTER JOIN</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="INNER">INNER (=)</option>
                                      <option value="LEFT">LEFT (= (+))</option>
                                      <option value="RIGHT">RIGHT ((+) =)</option>
                                    </>
                                  )}
                                </select>

                                {isDisabled ? (
                                  <button
                                    onClick={() => handleToggleJoinDisabled(join.id)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors cursor-pointer"
                                    title="Activar relación"
                                  >
                                    Activar
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteOrDisableJoin(join.id)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      isFkRelation
                                        ? 'border-slate-300 hover:bg-slate-100 text-slate-500 dark:border-slate-800 dark:hover:bg-slate-800'
                                        : 'border-red-500/20 hover:bg-red-500/10 text-red-500'
                                    }`}
                                    title={isFkRelation ? 'Desactivar (dejar en gris)' : 'Eliminar permanentemente'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB: WHERE Filters */}
            {activeBottomTab === 'where' && (() => {
              const renderRulesTree = (group: WhereGroup, depth = 0) => {
                return (
                  <div className={`p-3 rounded-2xl border flex flex-col gap-2.5 ${
                    isDark ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50/50 border-slate-200'
                  }`} style={{ marginLeft: depth * 12 }}>
                    <div className="flex items-center justify-between">
                      {/* AND/OR Toggler */}
                      <div className="flex items-center gap-1 border dark:border-slate-800 p-0.5 rounded-lg">
                        <button
                          onClick={() => updateFilterGroupConjunction(group, 'AND')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            group.conjunction === 'AND' ? 'bg-blue-600 text-white' : 'opacity-65'
                          }`}
                        >
                          AND
                        </button>
                        <button
                          onClick={() => updateFilterGroupConjunction(group, 'OR')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            group.conjunction === 'OR' ? 'bg-blue-600 text-white' : 'opacity-65'
                          }`}
                        >
                          OR
                        </button>
                      </div>

                      {/* Rule builders control */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => addFilterRule(group)}
                          className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                        >
                          + Regla
                        </button>
                        <button
                          onClick={() => addFilterGroup(group)}
                          className="px-2 py-0.5 rounded bg-slate-700/60 dark:bg-slate-800/80 hover:bg-slate-800 text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer text-white"
                        >
                          + Grupo
                        </button>
                        {depth > 0 && (
                          <button
                            onClick={() => removeFilterItem(group)}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter child components */}
                    <div className="flex flex-col gap-2">
                      {group.children.length === 0 && (
                        <span className="text-[10px] opacity-40 italic py-1 pl-1">Vacio - Agrega reglas o agrupadores</span>
                      )}
                      
                      {group.children.map((child, cIdx) => {
                        if (child.type === 'group') {
                          return (
                            <div key={cIdx}>
                              {renderRulesTree(child, depth + 1)}
                            </div>
                          );
                        }

                        // Render Rule editor
                        const cols = getAllQueryColumns();
                        return (
                          <div key={cIdx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap border-b border-gray-700/5 py-1 px-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all">
                            {/* Column selector */}
                            <select
                              value={child.table && child.column ? `${child.table}.${child.column}` : ''}
                              onChange={(e) => {
                                const [t, c] = e.target.value.split('.');
                                updateFilterRule(child, { table: t, column: c });
                              }}
                              className={`p-1 text-xs rounded border outline-none font-mono ${
                                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-800'
                              }`}
                            >
                              <option value="">-- Campo --</option>
                              {cols.map(c => (
                                <option key={c.label} value={c.label}>{c.label}</option>
                              ))}
                            </select>

                            {/* Operator select */}
                            <select
                              value={child.operator}
                              onChange={(e) => updateFilterRule(child, { operator: e.target.value })}
                              className={`p-1 text-xs rounded border outline-none ${
                                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-800'
                              }`}
                            >
                              <option value="=">=</option>
                              <option value="<>">&lt;&gt; (Diferente)</option>
                              <option value=">">&gt; Mayor</option>
                              <option value="<">&lt; Menor</option>
                              <option value=">=">&gt;= Mayor o igual</option>
                              <option value="<=">&lt;= Menor o igual</option>
                              <option value="LIKE">LIKE (Patrón)</option>
                              <option value="NOT LIKE">NOT LIKE</option>
                              <option value="IN">IN (Lista)</option>
                              <option value="NOT IN">NOT IN</option>
                              <option value="BETWEEN">BETWEEN</option>
                              <option value="IS NULL">IS NULL</option>
                              <option value="IS NOT NULL">IS NOT NULL</option>
                            </select>

                            {/* Value input controls */}
                            {child.operator !== 'IS NULL' && child.operator !== 'IS NOT NULL' && (
                              <>
                                {/* Value input Type select */}
                                <select
                                  value={child.valueType}
                                  onChange={(e) => updateFilterRule(child, { valueType: e.target.value as any, value: '' })}
                                  className={`p-1 text-[11px] font-bold rounded border outline-none ${
                                    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-800'
                                  }`}
                                >
                                  <option value="text">Texto</option>
                                  <option value="number">Número</option>
                                  <option value="date">Fecha</option>
                                  <option value="parameter">Parámetro Oracle (:P_)</option>
                                </select>

                                {/* Direct inputs */}
                                {child.valueType === 'date' ? (
                                  <input
                                    type="date"
                                    value={child.value}
                                    onChange={(e) => updateFilterRule(child, { value: e.target.value })}
                                    className={`p-1 text-xs rounded border outline-none ${
                                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-350'
                                    }`}
                                  />
                                ) : (
                                  <input
                                    type={child.valueType === 'number' ? 'number' : 'text'}
                                    value={child.value}
                                    placeholder={child.valueType === 'parameter' ? ':P_ID' : 'Valor'}
                                    onChange={(e) => updateFilterRule(child, { value: e.target.value })}
                                    className={`p-1 text-xs rounded border outline-none flex-1 max-w-[200px] ${
                                      isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-800'
                                    }`}
                                  />
                                )}

                                {/* BETWEEN secondary input */}
                                {(child.operator === 'BETWEEN' || child.operator === 'NOT BETWEEN') && (
                                  <>
                                    <span className="text-[10px] font-bold opacity-60">y</span>
                                    <input
                                      type={child.valueType === 'number' ? 'number' : 'text'}
                                      value={child.value2 || ''}
                                      placeholder="Hasta"
                                      onChange={(e) => updateFilterRule(child, { value2: e.target.value })}
                                      className={`p-1 text-xs rounded border outline-none flex-1 max-w-[200px] ${
                                        isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-800'
                                      }`}
                                    />
                                  </>
                                )}
                              </>
                            )}

                            {/* Delete button */}
                            <button
                              onClick={() => removeFilterItem(child)}
                              className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer ml-auto"
                              title="Remover regla"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              return (
                <div className="max-w-4xl space-y-4">
                  {renderRulesTree(design.where)}
                </div>
              );
            })()}

            {/* TAB: ORDER BY Sorting */}
            {activeBottomTab === 'orderby' && (() => {
              const cols = getAllQueryColumns();
              return (
                <div className="max-w-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase opacity-60">Criterios de Ordenamiento</span>
                    <button
                      onClick={handleAddOrderBy}
                      className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Criterio
                    </button>
                  </div>

                  {design.orderBy.length === 0 ? (
                    <div className="text-center py-12 text-xs opacity-50 italic">
                      No hay criterios de ordenamiento definidos. Las filas se retornarán en el orden por defecto.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {design.orderBy.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 border dark:border-slate-800 p-2 rounded-xl">
                          <span className="text-xs font-bold opacity-40">#{idx + 1}</span>
                          
                          {/* Column Selector */}
                          <select
                            value={`${item.table}.${item.column}`}
                            onChange={(e) => {
                              const [t, c] = e.target.value.split('.');
                              handleUpdateOrderBy(idx, { table: t, column: c });
                            }}
                            className={`p-1 text-xs rounded border outline-none font-mono ${
                              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-800'
                            }`}
                          >
                            {cols.map(c => (
                              <option key={c.label} value={c.label}>{c.label}</option>
                            ))}
                          </select>

                          {/* Sort direction toggler */}
                          <select
                            value={item.direction}
                            onChange={(e) => handleUpdateOrderBy(idx, { direction: e.target.value as any })}
                            className={`p-1 text-xs rounded border outline-none ${
                              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-800'
                            }`}
                          >
                            <option value="ASC">Ascendente (A-Z)</option>
                            <option value="DESC">Descendente (Z-A)</option>
                          </select>

                          {/* Order priorities (move up/down) */}
                          <div className="flex gap-0.5 ml-auto">
                            <button
                              disabled={idx === 0}
                              onClick={() => {
                                const reordered = [...design.orderBy];
                                const temp = reordered[idx];
                                reordered[idx] = reordered[idx - 1];
                                reordered[idx - 1] = temp;
                                updateDesign({ ...design, orderBy: reordered });
                              }}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 cursor-pointer"
                              title="Subir prioridad"
                            >
                              ▲
                            </button>
                            <button
                              disabled={idx === design.orderBy.length - 1}
                              onClick={() => {
                                const reordered = [...design.orderBy];
                                const temp = reordered[idx];
                                reordered[idx] = reordered[idx + 1];
                                reordered[idx + 1] = temp;
                                updateDesign({ ...design, orderBy: reordered });
                              }}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 cursor-pointer"
                              title="Bajar prioridad"
                            >
                              ▼
                            </button>
                            <button
                              onClick={() => handleRemoveOrderBy(idx)}
                              className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                              title="Eliminar orden"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB: GROUP BY & HAVING */}
            {activeBottomTab === 'groupby' && (() => {
              const allCols = getAllQueryColumns();
              return (
                <div className="max-w-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 font-bold text-xs select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={design.groupBy.enabled}
                        onChange={handleToggleGroupBy}
                        className="w-4 h-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      Habilitar Agrupamiento (GROUP BY)
                    </label>
                  </div>

                  {design.groupBy.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border dark:border-slate-800 p-3 rounded-2xl">
                      {/* Columns to select for group by */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase opacity-60">Columnas de Agrupación</span>
                        <div className="max-h-48 overflow-y-auto border dark:border-slate-800 p-2 rounded-xl flex flex-col gap-1 custom-scrollbar">
                          {allCols.map(c => {
                            const isGrouped = design.groupBy.columns.some(g => g.table === c.table && g.column === c.column);
                            return (
                              <label key={c.label} className="flex items-center gap-2 p-1 text-xs select-none hover:bg-black/5 dark:hover:bg-white/5 rounded font-mono cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isGrouped}
                                  onChange={() => handleToggleGroupByCol(c.table, c.column)}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                {c.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* HAVING logic builder (optional/rendered simply as text or rules) */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase opacity-60">Condición HAVING (Opcional)</span>
                        <textarea
                          placeholder="e.g. SUM(c.monto) > 500"
                          value={design.having.children[0]?.type === 'rule' ? (design.having.children[0] as WhereRule).value : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const nextDesign = {
                              ...design,
                              having: {
                                type: 'group' as const,
                                conjunction: 'AND' as const,
                                children: val.trim() ? [{
                                  type: 'rule' as const,
                                  operator: 'RAW',
                                  value: val,
                                  valueType: 'text' as const
                                }] : []
                              }
                            };
                            updateDesign(nextDesign);
                          }}
                          className={`w-full h-32 p-2.5 rounded-xl border text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-none ${
                            isDark ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                          }`}
                        />
                        <span className="text-[9px] opacity-50">Escribe una condición de grupo para filtrar los resultados agregados.</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 4. Calculated Column Dialog Overlay */}
      {isCalculatedColModalOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-5 rounded-3xl shadow-2xl border flex flex-col gap-4 animate-fade-in-up ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-sm flex items-center gap-1 text-blue-500">
                <Sliders className="w-4 h-4" /> Constructor de Expresión
              </h3>
              <button onClick={() => setIsCalculatedColModalOpen(false)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Table assignment */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">ASOCIAR A TABLA</label>
                <select
                  value={calcColTable}
                  onChange={(e) => setCalcColTable(e.target.value)}
                  className={`p-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-350'
                  }`}
                >
                  {design.tables.map(t => (
                    <option key={t.alias} value={t.alias}>{t.name} ({t.alias})</option>
                  ))}
                </select>
              </div>

              {/* Quick Function Templates */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">PLANTILLAS ORACLE / AGREGACIONES</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['NVL(col, val)', 'DECODE(col, v1, r1, def)', 'CONCAT(v1, v2)', 'SUM(col)', 'COUNT(col)', 'AVG(col)'].map(tmpl => (
                    <button
                      key={tmpl}
                      onClick={() => {
                        // Quick helper to insert or replace expression
                        setCalcColExpr(tmpl);
                      }}
                      className={`px-2 py-1 text-[9px] font-semibold border rounded-lg hover:border-blue-500/50 hover:bg-blue-600/5 transition-all cursor-pointer ${
                        isDark ? 'border-slate-800 bg-slate-950/40 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {tmpl.split('(')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expression input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">EXPRESIÓN DE LA COLUMNA</label>
                <input
                  type="text"
                  placeholder="e.g. NVL(u.nombres, 'Sin nombre')"
                  value={calcColExpr}
                  onChange={(e) => setCalcColExpr(e.target.value)}
                  className={`p-2 text-xs rounded-xl border outline-none font-mono ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-800'
                  }`}
                />
              </div>

              {/* Alias input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">ALIAS DE SALIDA</label>
                <input
                  type="text"
                  placeholder="e.g. nombres_usuario"
                  value={calcColAlias}
                  onChange={(e) => setCalcColAlias(e.target.value)}
                  className={`p-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-350 text-slate-850'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3 mt-1">
              <button
                onClick={() => setIsCalculatedColModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                Cancelar
              </button>
              <button
                disabled={!calcColExpr.trim()}
                onClick={handleCalculatedColumnAdd}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                Agregar Columna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. New Query Confirm Dialog Overlay */}
      {showNewQueryConfirm && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm p-5 rounded-3xl shadow-2xl border flex flex-col gap-4 animate-fade-in-up ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-amber-500">
                <AlertTriangle className="w-4 h-4" /> Cambios sin Guardar
              </h3>
              <button onClick={() => setShowNewQueryConfirm(false)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs opacity-80 leading-relaxed">
              Tienes cambios sin guardar en tu consulta actual. ¿Deseas guardar la consulta antes de limpiar el lienzo?
            </p>

            <div className="flex flex-col gap-2 pt-2 border-t mt-1">
              <button
                onClick={handleSaveAndClear}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
              >
                Guardar y comenzar nueva consulta
              </button>
              <button
                onClick={handleClearCanvas}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-red-600/10 hover:bg-red-600/20 text-red-500 transition-colors cursor-pointer border border-red-500/20"
              >
                Limpiar sin guardar
              </button>
              <button
                onClick={() => setShowNewQueryConfirm(false)}
                className={`w-full py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Duplicate Table Modal Overlay */}
      {dupTableModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-5 rounded-3xl shadow-2xl border flex flex-col gap-4 animate-fade-in-up ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-amber-500">
                <AlertTriangle className="w-4 h-4" /> Tabla existente
              </h3>
              <button onClick={() => setDupTableModal(null)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs opacity-80 leading-relaxed">
              La tabla <strong className="font-mono text-blue-500">{dupTableModal.tableName}</strong> ya existe en el lienzo. Para agregar otra instancia de la misma tabla, debes especificar un alias único.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">ALIAS PARA LA NUEVA INSTANCIA</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="ej. mi_alias"
                  value={dupTableAliasInput}
                  onChange={(e) => setDupTableAliasInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !dupTableError && dupTableAliasInput.trim()) {
                      e.preventDefault();
                      handleAddTableInstance(dupTableModal.tableName, dupTableAliasInput.trim(), dupTableModal.x, dupTableModal.y);
                      setDupTableModal(null);
                    }
                  }}
                  className={`p-2.5 text-xs rounded-xl border outline-none font-mono ${
                    dupTableError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-300 focus:border-blue-500'
                  } ${
                    isDark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'
                  }`}
                />
                {dupTableError && (
                  <span className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    {dupTableError}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3 mt-1">
              <button
                onClick={() => setDupTableModal(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                Cancelar
              </button>
              <button
                disabled={!!dupTableError || !dupTableAliasInput.trim()}
                onClick={() => {
                  handleAddTableInstance(dupTableModal.tableName, dupTableAliasInput.trim(), dupTableModal.x, dupTableModal.y);
                  setDupTableModal(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                Agregar con Alias
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Edit Table Alias Modal Overlay */}
      {editAliasModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-5 rounded-3xl shadow-2xl border flex flex-col gap-4 animate-fade-in-up ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-blue-500">
                <Edit3 className="w-4 h-4" /> Personalizar Alias
              </h3>
              <button onClick={() => setEditAliasModal(null)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs opacity-80 leading-relaxed">
              Define o cambia el alias para la tabla <strong className="font-mono text-blue-500">{editAliasModal.tableName}</strong>. Si lo dejas vacío, se usará el nombre original de la tabla.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold opacity-60">NUEVO ALIAS</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Sin alias (usa nombre de tabla)"
                  value={editAliasInput}
                  onChange={(e) => setEditAliasInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !editAliasError) {
                      e.preventDefault();
                      handlePerformUpdateTableAlias(editAliasModal.tableId, editAliasInput);
                    }
                  }}
                  className={`p-2.5 text-xs rounded-xl border outline-none font-mono ${
                    editAliasError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-300 focus:border-blue-500'
                  } ${
                    isDark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'
                  }`}
                />
                {editAliasError && (
                  <span className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    {editAliasError}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3 mt-1">
              <button
                onClick={() => setEditAliasModal(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                Cancelar
              </button>
              {editAliasModal.currentAlias && (
                <button
                  disabled={!!editAliasError}
                  onClick={() => handlePerformUpdateTableAlias(editAliasModal.tableId, '')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/25 transition-colors cursor-pointer"
                >
                  Quitar Alias
                </button>
              )}
              <button
                disabled={!!editAliasError}
                onClick={() => handlePerformUpdateTableAlias(editAliasModal.tableId, editAliasInput)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
