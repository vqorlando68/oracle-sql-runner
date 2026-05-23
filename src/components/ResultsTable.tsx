"use client";

import { useMemo, useState } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  VisibilityState
} from '@tanstack/react-table';
import { useAppStore } from '@/store/useAppStore';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Download, Copy, FileText, FileJson, Columns, Maximize2, X, Settings, Monitor } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ExportConfigModal from './ExportConfigModal';
import GridConfigModal from './GridConfigModal';

const formatOracleDate = (dateObj: Date, formatStr: string) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const YYYY = dateObj.getUTCFullYear().toString();
  const MM = pad(dateObj.getUTCMonth() + 1);
  const DD = pad(dateObj.getUTCDate());
  const HH24 = pad(dateObj.getUTCHours());
  const MI = pad(dateObj.getUTCMinutes());
  const SS = pad(dateObj.getUTCSeconds());
  
  const h12 = dateObj.getUTCHours() % 12 || 12;
  const HH = pad(h12);
  const isPM = dateObj.getUTCHours() >= 12;
  const A_M = isPM ? 'PM' : 'AM';
  const a_m = isPM ? 'pm' : 'am';

  return formatStr
    .replace(/YYYY/g, YYYY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
    .replace(/HH24/g, HH24)
    .replace(/HH/g, HH)
    .replace(/MI/g, MI)
    .replace(/SS/g, SS)
    .replace(/AM|PM/g, A_M)
    .replace(/am|pm/g, a_m);
};

interface Props {
  data: any[];
  columns: string[];
  sql?: string;
}

export default function ResultsTable({ data, columns, sql }: Props) {
  const { isDark, exportOptions, gridOptions, showToast } = useAppStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [isColsDropdownOpen, setIsColsDropdownOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [gridModalOpen, setGridModalOpen] = useState(false);
  
  // Modal state for viewing cell details
  const [cellModal, setCellModal] = useState<{ isOpen: boolean; content: string; colName: string }>({ isOpen: false, content: '', colName: '' });

  const tableColumns = useMemo<ColumnDef<any>[]>(() => {
    return columns.map(col => ({
      accessorKey: col,
      header: col,
      cell: info => {
        const val = info.getValue();
        let displayVal = '';
        if (val === null || val === undefined) {
          return <span className="text-gray-400 italic">null</span>;
        } else if (typeof val === 'object') {
          displayVal = JSON.stringify(val);
        } else {
          displayVal = String(val);
        }
        
        // Date formatting based on Grid Options
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
        if (typeof val === 'string' && isoDateRegex.test(val)) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            const fmt = gridOptions?.dateFormat || 'YYYY-MM-DD HH24:MI:SS';
            displayVal = formatOracleDate(d, fmt);
          }
        } else {
          // Number formatting
          let isNum = !isNaN(Number(displayVal)) && displayVal.trim() !== '';
          if (isNum && gridOptions?.numberFormat === 'locale') {
            displayVal = Number(displayVal).toLocaleString();
          }
        }
        
        const truncateLimit = gridOptions?.truncateLength || 50;
        const isLong = displayVal.length > truncateLimit;
        const truncatedVal = isLong ? displayVal.substring(0, truncateLimit) + '...' : displayVal;

        return (
          <div className="flex justify-between items-center group gap-2">
            <span className={`truncate inline-block`} style={{ maxWidth: truncateLimit * 8 + 'px' }}>{truncatedVal}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(displayVal);
                  showToast('Copiado al portapapeles', 'success');
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-all"
                title="Copiar al portapapeles"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {isLong && (
                <button 
                  onClick={() => setCellModal({ isOpen: true, content: displayVal, colName: col })}
                  className="opacity-0 group-hover:opacity-100 p-1 bg-blue-500/10 text-blue-500 rounded hover:bg-blue-500/20 transition-opacity"
                  title="Ver contenido completo"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      }
    }));
  }, [columns, gridOptions]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), 'results.xlsx');
  };

  const exportCSV = () => {
    const excludedCols = exportOptions.columnsToExclude.split(',').map(s => s.trim().toLowerCase());
    const validCols = columns.filter(col => !excludedCols.includes(col.toLowerCase()));
    const delimiterChar = String.fromCharCode(exportOptions.delimiterAscii);
    
    let textContent = "";

    // Include SQL statement at top if configured
    if (exportOptions.includeSqlStatement && sql) {
      textContent += `-- SQL Statement:\n`;
      textContent += sql.split('\n').map(line => `-- ${line}`).join('\n') + '\n\n';
    }

    if (exportOptions.exportAsInList && exportOptions.inListColumn) {
      // Export just as a single IN list: 'val1', 'val2', 'val3'
      const vals = data.map(row => {
        let v = row[exportOptions.inListColumn];
        if (v === null || v === undefined) return '';
        return `'${v}'`;
      }).filter(v => v !== '');
      textContent += vals.join(delimiterChar);
      saveAs(new Blob([textContent], { type: "text/plain;charset=utf-8" }), 'in_list.txt');
      return;
    }

    // Include Column Headers
    if (exportOptions.includeColumnHeaders) {
      const headerLine = validCols.map(col => {
        let c = exportOptions.headerLowercase ? col.toLowerCase() : col;
        return exportOptions.headerQuoted ? `"${c}"` : c;
      }).join(delimiterChar) + (exportOptions.includeDelimiterAfterLastCol ? delimiterChar : '');
      textContent += headerLine + '\n';
    }

    // Rows Data
    data.forEach(row => {
      const rowLine = validCols.map(col => {
        let val = row[col];
        if (val === null || val === undefined) {
          return exportOptions.includeNullText ? 'null' : '';
        }
        if (typeof val === 'object') val = JSON.stringify(val);
        
        let strVal = String(val);
        
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
        if (typeof val === 'string' && isoDateRegex.test(val)) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            strVal = formatOracleDate(d, exportOptions.dateFormat || 'YYYY-MM-DD HH24:MI:SS');
          }
        }
        
        let isNum = !isNaN(Number(strVal)) && strVal.trim() !== '';
        
        if (isNum) {
          if (exportOptions.numberQuoting === 'quote') {
            strVal = `"${strVal}"`;
          }
        } else {
          if (exportOptions.stringQuoting === 'quote' || strVal.includes(delimiterChar) || strVal.includes('"') || strVal.includes('\n')) {
            strVal = `"${strVal.replace(/"/g, '""')}"`;
          }
        }
        return strVal;
      }).join(delimiterChar) + (exportOptions.includeDelimiterAfterLastCol ? delimiterChar : '');
      textContent += rowLine + '\n';
    });

    saveAs(new Blob([textContent], { type: "text/csv;charset=utf-8" }), 'results.csv');
  };

  const exportJSON = () => {
    const json = JSON.stringify(data, null, 2);
    saveAs(new Blob([json], { type: "application/json;charset=utf-8" }), 'results.json');
  };

  const copyToClipboard = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const txt = XLSX.utils.sheet_to_txt(ws);
    navigator.clipboard.writeText(txt);
    showToast('Grid data copied to clipboard!');
  };

  if (!data || data.length === 0) return (
    <div className="flex-1 flex items-center justify-center text-sm opacity-50">
      No data to display
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className={`p-2 border-b flex justify-between items-center ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-2">
          <input
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className={`px-3 py-1.5 text-sm rounded-md border ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} outline-none focus:ring-1 focus:ring-blue-500`}
            placeholder="Search all columns..."
          />
          <span className="text-xs opacity-60">
            {table.getFilteredRowModel().rows.length} rows
          </span>
        </div>
        
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={() => setIsColsDropdownOpen(!isColsDropdownOpen)} 
            className={`p-1.5 rounded flex items-center gap-1 text-sm ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`} 
            title="Columns"
          >
            <Columns className="w-4 h-4" /> Columns
          </button>
          
          {isColsDropdownOpen && (
            <div className={`absolute top-full right-10 mt-1 w-48 max-h-64 overflow-auto rounded-md shadow-lg border z-20 p-2 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="text-xs font-semibold mb-2 px-1 opacity-60 uppercase">Toggle Columns</div>
              <label className="flex items-center gap-2 px-2 py-1 hover:bg-black/10 rounded cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={table.getIsAllColumnsVisible()}
                  onChange={table.getToggleAllColumnsVisibilityHandler()}
                  className="rounded border-gray-300"
                />
                Select All
              </label>
              <div className="h-px bg-gray-500/20 my-1"></div>
              {table.getAllLeafColumns().map(column => (
                <label key={column.id} className="flex items-center gap-2 px-2 py-1 hover:bg-black/10 rounded cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                    className="rounded border-gray-300"
                  />
                  <span className="truncate">{column.id}</span>
                </label>
              ))}
            </div>
          )}

          <div className="w-px h-5 bg-gray-500/20 mx-1"></div>

          <button onClick={exportExcel} className="p-1.5 rounded hover:bg-blue-500/10 text-blue-500" title="Export Excel"><Download className="w-4 h-4" /></button>
          <button onClick={exportCSV} className="p-1.5 rounded hover:bg-green-500/10 text-green-500" title="Export CSV / Text"><FileText className="w-4 h-4" /></button>
          <button onClick={exportJSON} className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-600" title="Export JSON"><FileJson className="w-4 h-4" /></button>
          <button onClick={copyToClipboard} className="p-1.5 rounded hover:bg-gray-500/10" title="Copy"><Copy className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-gray-500/20 mx-1"></div>
          <button onClick={() => setGridModalOpen(true)} className="p-1.5 rounded hover:bg-gray-500/10 opacity-70 hover:opacity-100" title="Grid Settings"><Monitor className="w-4 h-4" /></button>
          <button onClick={() => setExportModalOpen(true)} className="p-1.5 rounded hover:bg-gray-500/10 opacity-70 hover:opacity-100" title="Export Settings"><Settings className="w-4 h-4" /></button>
        </div>
      </div>

      {isColsDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsColsDropdownOpen(false)}></div>
      )}

      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className={`sticky top-0 z-10 ${isDark ? 'bg-gray-800/95 text-gray-300' : 'bg-gray-100/95 text-gray-700'} backdrop-blur-sm shadow-sm`}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-4 py-3 font-semibold border-b border-r border-inherit last:border-r-0 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ChevronUp className="w-3 h-3 opacity-70" />,
                        desc: <ChevronDown className="w-3 h-3 opacity-70" />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className={`border-b border-inherit ${isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={`px-4 py-2 border-r border-inherit last:border-r-0 max-w-[300px]`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`p-2 border-t flex items-center justify-between text-xs ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-2">
          <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="p-1 rounded hover:bg-black/10 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1 rounded hover:bg-black/10 disabled:opacity-30">Prev</button>
          <span className="opacity-70">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1 rounded hover:bg-black/10 disabled:opacity-30">Next</button>
          <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="p-1 rounded hover:bg-black/10 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
        
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e.target.value))}
          className={`px-2 py-1 border rounded ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
        >
          {[10, 20, 50, 100].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>

      {/* Cell Content Modal */}
      {cellModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border`}>
            <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <h3 className="font-bold">Column: {cellModal.colName}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(cellModal.content);
                    showToast('Copiado al portapapeles', 'success');
                  }}
                  className={`p-1.5 rounded-md border flex items-center gap-1.5 text-xs font-semibold transition-all ${
                    isDark 
                      ? 'border-gray-700 hover:bg-gray-800 text-gray-300 hover:text-white' 
                      : 'border-gray-300 hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  title="Copiar contenido completo"
                >
                  <Copy className="w-4 h-4" /> Copiar contenido
                </button>
                <button onClick={() => setCellModal({ isOpen: false, content: '', colName: '' })} className="p-1.5 rounded-md hover:bg-black/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-auto custom-scrollbar">
              <pre className="text-sm whitespace-pre-wrap font-mono break-all">
                {cellModal.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Export Settings Modal */}
      <ExportConfigModal 
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        availableColumns={columns}
      />

      {/* Grid Settings Modal */}
      <GridConfigModal 
        isOpen={gridModalOpen}
        onClose={() => setGridModalOpen(false)}
      />
    </div>
  );
}
