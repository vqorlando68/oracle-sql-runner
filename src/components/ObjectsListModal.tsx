"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  RefreshCw, Database, ShieldAlert, CheckCircle, HelpCircle, Eye,
  FileText, Activity, AlertTriangle, Users, ChevronDown
} from 'lucide-react';

interface ObjectsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  connection: any;
  objectType: string;
  schema: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onDocRequest?: () => void;
}

// Map types to descriptive titles
const getTitleForType = (type: string) => {
  const t = type.toUpperCase();
  if (t === 'SESSION') return 'Sesiones Activas';
  if (t === 'USER') return 'Usuarios de la Base de Datos';
  if (t === 'INVALID') return 'Objetos con Estado Inválido';
  if (t === 'TABLE') return 'Tablas del Esquema';
  if (t === 'INDEX') return 'Índices del Esquema';
  if (t === 'VIEW') return 'Vistas del Esquema';
  if (t === 'TRIGGER') return 'Disparadores (Triggers)';
  if (t === 'PACKAGE') return 'Paquetes (Packages)';
  if (t === 'PACKAGE BODY') return 'Cuerpos de Paquete (Package Bodies)';
  if (t === 'SEQUENCE') return 'Secuencias';
  if (t === 'LOB') return 'Segmentos LOB';
  if (t === 'FUNCTION') return 'Funciones';
  if (t === 'PROCEDURE') return 'Procedimientos';
  if (t === 'JOB') return 'Scheduler Jobs';
  return `Objetos de tipo ${type}`;
};

// Helper to parse session info with regex fallback in case of Oracle path backslashes
const parseSessionInfo = (infoStr: string) => {
  if (!infoStr) return null;
  if (typeof infoStr === 'object') return infoStr;
  
  try {
    const sanitized = infoStr
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .trim();
    return JSON.parse(sanitized);
  } catch (e) {
    try {
      const getVal = (key: string) => {
        const stringPattern = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`);
        const numPattern = new RegExp(`"${key}"\\s*:\\s*(\\d+)`);
        
        const strMatch = infoStr.match(stringPattern);
        if (strMatch) return strMatch[1];
        
        const numMatch = infoStr.match(numPattern);
        if (numMatch) return numMatch[1];
        
        return '';
      };
      
      return {
        serial: getVal('serial'),
        machine: getVal('machine'),
        osuser: getVal('osuser'),
        logon_time: getVal('logon_time'),
        sql_id: getVal('sql_id'),
        module: getVal('module'),
        event: getVal('event'),
        wait_sec: getVal('wait_sec'),
        blocking_session: getVal('blocking_session')
      };
    } catch (err) {
      return null;
    }
  }
};

// Generates high-fidelity mock data for fallback
const getMockData = (type: string, query: string, page: number, pageSize: number, querySchema?: string) => {
  const t = type.toUpperCase();
  let allItems: any[] = [];
  const targetSchema = querySchema && querySchema.toUpperCase() !== 'ALL' ? querySchema.toUpperCase() : null;

  const filterQuery = (name: string) => {
    if (!query) return true;
    return name.toUpperCase().includes(query.toUpperCase());
  };

  if (t === 'SESSION') {
    allItems = [
      { 
        name: "SID 121", 
        type: "sqlplus.exe", 
        status: "ACTIVE", 
        owner: "TEKER_PROD", 
        created: "2026-07-08 10:15:30",
        info: JSON.stringify({
          serial: 54321,
          machine: "srv-prod-db01",
          osuser: "oracle",
          logon_time: "2026-07-08 10:15:30",
          sql_id: "7w8v9u1t2s3r4",
          module: "SQL*Plus",
          event: "db file sequential read",
          wait_sec: 0,
          blocking_session: ""
        })
      },
      { 
        name: "SID 142", 
        type: "NextJS App", 
        status: "ACTIVE", 
        owner: "TEKER_DEV", 
        created: "2026-07-08 12:00:15",
        info: JSON.stringify({
          serial: 11223,
          machine: "web-server-02",
          osuser: "ubuntu",
          logon_time: "2026-07-08 12:00:15",
          sql_id: "3g4h5j6k7l8m9",
          module: "NextJS Backend",
          event: "SQL*Net message from client",
          wait_sec: 45,
          blocking_session: ""
        })
      },
      { 
        name: "SID 99", 
        type: "JDBC Client", 
        status: "INACTIVE", 
        owner: "SYS", 
        created: "2026-07-08 08:30:00",
        info: JSON.stringify({
          serial: 99887,
          machine: "app-worker-01",
          osuser: "tomcat",
          logon_time: "2026-07-08 08:30:00",
          sql_id: "",
          module: "JDBC Thin Client",
          event: "SQL*Net message from client",
          wait_sec: 120,
          blocking_session: ""
        })
      },
      { 
        name: "SID 204", 
        type: "TOAD.exe", 
        status: "ACTIVE", 
        owner: "TEKER_PROD", 
        created: "2026-07-08 14:05:00",
        info: JSON.stringify({
          serial: 44556,
          machine: "pc-admin-orlando",
          osuser: "OrlandoArturo",
          logon_time: "2026-07-08 14:05:00",
          sql_id: "9x8y7z6w5v4u3",
          module: "TOAD",
          event: "enq: TX - row lock contention",
          wait_sec: 3,
          blocking_session: "121"
        })
      },
      { 
        name: "SID 15", 
        type: "plsqldev.exe", 
        status: "ACTIVE", 
        owner: "TEKER_STAGE", 
        created: "2026-07-08 15:10:00",
        info: JSON.stringify({
          serial: 33442,
          machine: "pc-dev-juan",
          osuser: "JuanPerez",
          logon_time: "2026-07-08 15:10:00",
          sql_id: "",
          module: "PL/SQL Developer",
          event: "SQL*Net message from client",
          wait_sec: 0,
          blocking_session: ""
        })
      }
    ];
  } else if (t === 'USER') {
    allItems = [
      { name: "SYS", type: "USER", status: "OPEN", owner: "SYS", created: "2025-08-20" },
      { name: "SYSTEM", type: "USER", status: "OPEN", owner: "SYS", created: "2025-08-20" },
      { name: "TEKER_PROD", type: "USER", status: "OPEN", owner: "SYS", created: "2025-08-20" },
      { name: "TEKER_DEV", type: "USER", status: "OPEN", owner: "SYS", created: "2025-09-01" },
      { name: "TEKER_STAGE", type: "USER", status: "OPEN", owner: "SYS", created: "2025-09-01" },
      { name: "APEX_240200", type: "USER", status: "LOCKED", owner: "SYS", created: "2025-08-20" },
      { name: "AUDSYS", type: "USER", status: "LOCKED", owner: "SYS", created: "2025-08-20" },
      { name: "DBSNMP", type: "USER", status: "EXPIRED & LOCKED", owner: "SYS", created: "2025-08-20" }
    ];
  } else if (t === 'INVALID') {
    allItems = [
      { name: "PKG_VENTAS_BODY", type: "PACKAGE BODY", status: "INVALID", owner: "TEKER_PROD", created: "2025-08-20", last_ddl: "2026-06-12" },
      { name: "VW_REPORTE_MENSUAL", type: "VIEW", status: "INVALID", owner: "TEKER_PROD", created: "2026-01-10", last_ddl: "2026-07-01" },
      { name: "TRG_AUDIT_LOGINS", type: "TRIGGER", status: "INVALID", owner: "TEKER_PROD", created: "2025-10-15", last_ddl: "2026-07-08" },
      { name: "PKG_ESTADISTICAS_COMPLETAS", type: "PACKAGE BODY", status: "INVALID", owner: "TEKER_PROD", created: "2026-04-03", last_ddl: "2026-04-03" },
      { name: "FN_CALCULA_IGV_NUEVO", type: "FUNCTION", status: "INVALID", owner: "TEKER_PROD", created: "2026-05-18", last_ddl: "2026-05-19" }
    ];
  } else if (t === 'INDEX') {
    allItems = [
      { name: "IDX_TKR_ACCESOS_ID", type: "INDEX", status: "VALID", owner: "TEKER_PROD", created: "2025-08-20", last_ddl: "2025-08-20", info: "TKR_ACCESOS (ACCESO_ID)" },
      { name: "IDX_TKR_VENTAS_FECHA", type: "INDEX", status: "VALID", owner: "TEKER_PROD", created: "2025-09-12", last_ddl: "2025-09-12", info: "TKR_VENTAS (FECHA_VENTA, CLIENTE_ID)" },
      { name: "IDX_TKR_CLI_DOCUMENTO", type: "INDEX", status: "VALID", owner: "TEKER_PROD", created: "2025-08-20", last_ddl: "2025-08-20", info: "TKR_CLIENTES (TIPO_DOC, NRO_DOC)" },
      { name: "IDX_TKR_PROD_CAT", type: "INDEX", status: "VALID", owner: "TEKER_PROD", created: "2025-10-05", last_ddl: "2026-02-14", info: "TKR_PRODUCTOS (CATEGORIA_ID, ESTADO)" },
      { name: "IDX_TKR_USUARIO_EMAIL", type: "INDEX", status: "VALID", owner: "TEKER_PROD", created: "2025-08-20", last_ddl: "2025-08-20", info: "TKR_USUARIOS (EMAIL)" },
      { name: "IDX_TKR_PAGOS_TX", type: "INDEX", status: "INVALID", owner: "TEKER_PROD", created: "2026-03-01", last_ddl: "2026-07-08", info: "TKR_PAGOS (TRANSACCION_ID, METODO)" }
    ];
  } else if (t === 'JOB') {
    const schemasList = ["SYS", "TEKER_PROD", "TEKER_DEV", "APEX_240200", "TEKER_STAGE"];
    const jobNames = [
      "CLEANUP_SESSIONS", "REFRESH_MV_SALES", "SEND_EMAILS", "PURGE_LOGS", 
      "CALCULATE_METRICS", "SYNC_CLOUD", "BACKUP_META", "UPDATE_STATS", 
      "OPTIMIZE_INDEXES", "GATHER_DICTIONARY_STATS"
    ];
    for (let i = 1; i <= 80; i++) {
      const sch = schemasList[i % schemasList.length];
      if (targetSchema && targetSchema !== 'ALL' && sch !== targetSchema) continue;
      const baseName = jobNames[i % jobNames.length];
      const isEnabled = i % 7 !== 0;
      allItems.push({
        name: `JOB_${baseName}_${i.toString().padStart(3, '0')}`,
        type: "SCHEDULER_JOB",
        status: isEnabled ? (i % 11 === 0 ? "RUNNING" : "SCHEDULED") : "DISABLED",
        owner: sch,
        created: "2025-08-20",
        info: isEnabled ? "TRUE" : "FALSE"
      });
    }
  } else {
    // Generate simulated objects for normal types
    for (let i = 1; i <= 35; i++) {
      allItems.push({
        name: `TKR_${t}_${i.toString().padStart(3, '0')}`,
        type: t,
        status: i % 12 === 0 ? "INVALID" : "VALID",
        owner: "TEKER_PROD",
        created: "2025-08-20",
        last_ddl: i % 8 === 0 ? "2026-06-15" : "2025-08-20"
      });
    }
  }

  const filteredItems = allItems.filter(item => filterQuery(item.name) || filterQuery(item.owner || '') || filterQuery(item.status || ''));
  const totalRecords = filteredItems.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const offset = (page - 1) * pageSize;
  const pageItems = filteredItems.slice(offset, offset + pageSize);

  return {
    total_records: totalRecords,
    page: page,
    page_size: pageSize,
    total_pages: totalPages,
    items: pageItems
  };
};

export default function ObjectsListModal({
  isOpen,
  onClose,
  isDark,
  connection,
  objectType,
  schema,
  showToast,
  onDocRequest,
}: ObjectsListModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  
  const [items, setItems] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  const toggleSession = (sid: string) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sid]: !prev[sid]
    }));
  };

  // Ctrl+Alt+D → trigger documentation modal in parent
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        e.stopPropagation();
        onDocRequest?.();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isOpen, onDocRequest]);

  const fetchObjects = async (page: number, query: string) => {
    if (!isOpen || !objectType) return;
    setIsLoading(true);
    setIsDemoMode(false);

    try {
      if (!connection) {
        throw new Error("No hay conexión de base de datos activa.");
      }

      const escapedQuery = query.replace(/'/g, "''");
      const inputJson = JSON.stringify({
        object_type: objectType,
        owner: schema || 'TEKER_PROD',
        search_query: escapedQuery,
        page: page,
        page_size: pageSize
      });

      // Construct SQL statement to execute the PL/SQL function
      const sql = `SELECT pkgln_estadisticas_bd.fn_get_objects_paginated_json('${inputJson.replace(/'/g, "''")}') AS JSON_DATA FROM DUAL`;

      const res = await fetch('/api/oracle/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: connection,
          sql: sql
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al ejecutar la consulta');
      }

      const row = data.rows?.[0];
      const jsonStr = row?.JSON_DATA || row?.json_data || (row && Object.values(row)[0]);

      if (!jsonStr) {
        throw new Error("No se devolvieron datos.");
      }

      const parsed = JSON.parse(jsonStr);
      setItems(parsed.items || []);
      setTotalRecords(parsed.total_records || 0);
      setTotalPages(parsed.total_pages || 0);
    } catch (err: any) {
      console.warn("Falló consulta de objetos paginados real, cargando datos mock:", err.message);
      setIsDemoMode(true);
      const parsed = getMockData(objectType, query, page, pageSize, schema);
      setItems(parsed.items);
      setTotalRecords(parsed.total_records);
      setTotalPages(parsed.total_pages);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger load when modal opens or page/object type changes
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      setSearchQuery('');
      fetchObjects(1, '');
    }
  }, [isOpen, objectType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchObjects(1, searchQuery);
  };

  const handleRefresh = () => {
    fetchObjects(currentPage, searchQuery);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchObjects(newPage, searchQuery);
    }
  };

  if (!isOpen) return null;

  const bgModal = isDark 
    ? 'bg-slate-900/95 backdrop-blur-xl border border-slate-800 text-slate-100 shadow-2xl' 
    : 'bg-white border border-slate-200 text-slate-800 shadow-xl';

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh] ${bgModal} transition-all duration-300 transform scale-100`}>
        
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">{getTitleForType(objectType)}</h3>
              <p className="text-xs opacity-60">Categoría: {objectType.toUpperCase()} | Filtro: {schema || 'Usuario Actual'}</p>
            </div>
            {isDemoMode && (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                Modo Demo
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-500/10 opacity-70 hover:opacity-100 transition-all border border-transparent hover:border-slate-500/20"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-800/20 flex flex-col sm:flex-row gap-3 shrink-0">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 opacity-40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, estado, etc..."
                className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl outline-none border transition-all ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 focus:border-amber-500 text-slate-100'
                    : 'bg-slate-50 border-slate-200 focus:border-amber-500 text-slate-800'
                }`}
              />
            </div>
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-amber-500/10"
            >
              Buscar
            </button>
          </form>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold ${
              isDark 
                ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-gray-300' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-gray-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            Recargar
          </button>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-10 h-10 animate-spin text-amber-500" />
              <span className="text-xs opacity-60 font-medium">Consultando registros...</span>
            </div>
          ) : items.length > 0 ? (
            <div className="border border-slate-800/40 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className={`border-b border-slate-800/60 font-black uppercase tracking-wider opacity-45 ${
                    isDark ? 'bg-slate-950/60' : 'bg-slate-50'
                  }`}>
                    <th className="py-2.5 px-4">Nombre / Identificador</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Propietario</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Creado</th>
                    <th className={`py-2.5 px-4 ${
                      objectType.toUpperCase() === 'INDEX' || objectType.toUpperCase() === 'JOB' 
                        ? 'text-left' 
                        : 'text-right'
                    }`}>
                      {objectType.toUpperCase() === 'INDEX' 
                        ? 'Tabla Asociada (Columnas)' 
                        : objectType.toUpperCase() === 'JOB'
                          ? '¿Habilitado?'
                          : 'Detalle / Modificación'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const statusUpper = item.status?.toUpperCase() || '';
                    const isVal = statusUpper === 'VALID' || statusUpper === 'OPEN' || statusUpper === 'ACTIVE' || statusUpper === 'RUNNING' || statusUpper === 'SCHEDULED';
                    const isInv = statusUpper === 'INVALID' || statusUpper.includes('LOCK');
                    const isDis = statusUpper === 'DISABLED';

                    let statusBadge = '';
                    if (isVal) {
                      statusBadge = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';
                    } else if (isInv) {
                      statusBadge = 'bg-red-500/10 text-red-500 border-red-500/25 font-bold animate-pulse';
                    } else if (isDis) {
                      statusBadge = 'bg-slate-500/10 text-slate-400 border-slate-500/25';
                    } else {
                      statusBadge = 'bg-slate-500/10 text-slate-400 border-slate-500/25';
                    }

                    const isSession = objectType.toUpperCase() === 'SESSION';
                    const sessionDetail = isSession ? parseSessionInfo(item.info) : null;

                    return (
                      <React.Fragment key={idx}>
                        <tr 
                          onClick={() => {
                            if (isSession) {
                              toggleSession(item.name);
                            }
                          }}
                          className={`border-b border-slate-800/10 last:border-0 hover:bg-slate-500/5 transition-colors font-medium ${
                            isSession ? 'cursor-pointer' : ''
                          } ${
                            isDark ? 'odd:bg-slate-900/30' : 'odd:bg-slate-50/40'
                          }`}
                        >
                          <td className="py-2.5 px-4 font-mono font-bold text-amber-500 max-w-[220px] truncate" title={item.name}>
                            <div className="flex items-center gap-2">
                              {isSession && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSession(item.name);
                                  }}
                                  className="p-1 rounded hover:bg-slate-500/15 text-slate-400 hover:text-amber-500 transition-colors"
                                >
                                  {expandedSessions[item.name] ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                              <span>{item.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold opacity-75">{item.type}</td>
                          <td className="py-2.5 px-3 opacity-60">{item.owner || '-'}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border inline-block ${statusBadge}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 opacity-65 font-mono">{item.created || '-'}</td>
                          <td className={`py-2.5 px-4 font-mono opacity-80 ${
                            objectType.toUpperCase() === 'INDEX' || objectType.toUpperCase() === 'JOB' 
                              ? 'text-left' 
                              : 'text-right'
                          }`}>
                            {objectType.toUpperCase() === 'INDEX' 
                              ? (item.info || '-') 
                              : objectType.toUpperCase() === 'JOB'
                                ? (
                                    <span className={`px-2 py-0.5 rounded border inline-block text-[9px] font-black uppercase tracking-wider ${
                                      item.info === 'TRUE' || item.info === 'SÍ' || item.info === 'YES'
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
                                        : 'bg-rose-500/10 text-rose-500 border-rose-500/25'
                                    }`}>
                                      {item.info === 'TRUE' || item.info === 'SÍ' || item.info === 'YES' ? 'SÍ' : 'NO'}
                                    </span>
                                  )
                                : isSession
                                  ? (
                                      (() => {
                                        const parsed = parseSessionInfo(item.info);
                                        if (parsed) {
                                          return `Espera: ${parsed.wait_sec !== undefined ? parsed.wait_sec : 0}s`;
                                        }
                                        return item.info || 'Espera: 0s';
                                      })()
                                    )
                                  : (item.last_ddl || item.info || '-')}
                          </td>
                        </tr>

                        {isSession && expandedSessions[item.name] && (
                          <tr className="bg-slate-500/5 dark:bg-slate-950/20 border-b border-slate-800/10">
                            <td colSpan={6} className="p-4">
                              {sessionDetail ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] sm:text-xs font-medium max-w-4xl animate-fadeIn pl-7">
                                  <div className="bg-slate-950/20 dark:bg-slate-900/50 border border-slate-800/30 rounded-lg p-3">
                                    <span className="text-[9px] uppercase tracking-wider opacity-45 font-bold block mb-2 text-amber-500">Identidad de Conexión</span>
                                    <div className="space-y-1.5 font-mono">
                                      <p><span className="opacity-60">Serial #:</span> <span className="text-slate-200 dark:text-slate-300 font-bold">{sessionDetail.serial || '-'}</span></p>
                                      <p><span className="opacity-60">Usuario SO:</span> <span className="text-sky-400 font-bold">{sessionDetail.osuser || '-'}</span></p>
                                      <p><span className="opacity-60">Máquina:</span> <span className="text-emerald-400 truncate block max-w-[200px]" title={sessionDetail.machine}>{sessionDetail.machine || '-'}</span></p>
                                    </div>
                                  </div>

                                  <div className="bg-slate-950/20 dark:bg-slate-900/50 border border-slate-800/30 rounded-lg p-3">
                                    <span className="text-[9px] uppercase tracking-wider opacity-45 font-bold block mb-2 text-amber-500">Actividad y Esperas</span>
                                    <div className="space-y-1.5 font-mono">
                                      <p><span className="opacity-60">SQL ID:</span> <span className={sessionDetail.sql_id ? "text-pink-500 font-bold" : "opacity-60"}>{sessionDetail.sql_id || 'Ninguno'}</span></p>
                                      <p><span className="opacity-60">Evento:</span> <span className="text-amber-500 truncate block max-w-[200px]" title={sessionDetail.event}>{sessionDetail.event || 'Ninguno'}</span></p>
                                      <p><span className="opacity-60">Tiempo Espera:</span> <span className="text-rose-500 font-bold">{sessionDetail.wait_sec}s</span></p>
                                    </div>
                                  </div>

                                  <div className="bg-slate-950/20 dark:bg-slate-900/50 border border-slate-800/30 rounded-lg p-3">
                                    <span className="text-[9px] uppercase tracking-wider opacity-45 font-bold block mb-2 text-amber-500">Origen y Control</span>
                                    <div className="space-y-1.5 font-mono">
                                      <p><span className="opacity-60">Logon Time:</span> <span className="text-slate-300 font-bold">{sessionDetail.logon_time || '-'}</span></p>
                                      <p><span className="opacity-60">Módulo:</span> <span className="text-indigo-400 truncate block max-w-[200px]" title={sessionDetail.module}>{sessionDetail.module || 'Ninguno'}</span></p>
                                      <p>
                                        <span className="opacity-60">Bloqueado por:</span>{' '}
                                        {sessionDetail.blocking_session ? (
                                          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/25 font-black uppercase text-[9px] animate-pulse">
                                            SID {sessionDetail.blocking_session}
                                          </span>
                                        ) : (
                                          <span className="text-emerald-500 font-bold">Ninguno</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="font-mono text-xs text-slate-400 pl-7">
                                  Detalle básico: <span className="text-amber-500">{item.info || '-'}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-slate-800/20 border-dashed rounded-xl bg-slate-500/5">
              <HelpCircle className="w-10 h-10 opacity-30 mb-2" />
              <p className="font-bold text-sm">No se encontraron resultados</p>
              <p className="text-xs opacity-60 mt-0.5">Prueba a buscar con otro término o limpia los filtros.</p>
            </div>
          )}
        </div>

        {/* Footer / Pagination */}
        {totalPages > 1 && (
          <footer className="px-6 py-4 border-t border-slate-800/40 shrink-0 flex items-center justify-between text-xs font-semibold">
            <span className="opacity-60">
              Registros: <span className="font-bold text-amber-500">{totalRecords}</span> | Página {currentPage} de {totalPages}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1 || isLoading}
                className={`p-1.5 rounded-lg border transition-all ${
                  isDark 
                    ? 'border-slate-800 hover:bg-slate-800 disabled:opacity-20 text-slate-300' 
                    : 'border-slate-200 hover:bg-slate-50 disabled:opacity-20 text-slate-700'
                }`}
                title="Primera Página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className={`p-1.5 rounded-lg border transition-all ${
                  isDark 
                    ? 'border-slate-800 hover:bg-slate-800 disabled:opacity-20 text-slate-300' 
                    : 'border-slate-200 hover:bg-slate-50 disabled:opacity-20 text-slate-700'
                }`}
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className={`px-3 py-1.5 rounded-lg border font-mono ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                {currentPage}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
                className={`p-1.5 rounded-lg border transition-all ${
                  isDark 
                    ? 'border-slate-800 hover:bg-slate-800 disabled:opacity-20 text-slate-300' 
                    : 'border-slate-200 hover:bg-slate-50 disabled:opacity-20 text-slate-700'
                }`}
                title="Siguiente Página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages || isLoading}
                className={`p-1.5 rounded-lg border transition-all ${
                  isDark 
                    ? 'border-slate-800 hover:bg-slate-800 disabled:opacity-20 text-slate-300' 
                    : 'border-slate-200 hover:bg-slate-50 disabled:opacity-20 text-slate-700'
                }`}
                title="Última Página"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </footer>
        )}

      </div>
    </div>
  );
}
