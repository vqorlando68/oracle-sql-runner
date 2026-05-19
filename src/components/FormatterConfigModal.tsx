"use client";

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { X, Save, Download, Upload, RefreshCw, ChevronRight, Type, ArrowLeftRight, AlignLeft, ListTree } from 'lucide-react';
import { format } from 'sql-formatter';
import Editor from '@monaco-editor/react';
import { FormatOptions } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_SQL = `CREATE OR REPLACE PROCEDURE get_emp (p_id IN NUMBER) IS
  v_name varchar2(100);
  v_date date := sysdate;
BEGIN
  /* Fetch employee details */
  SELECT e.employee_id, e.first_name, d.department_name
  INTO v_name, v_date
  FROM employees e
  JOIN departments d ON e.department_id = d.department_id
  WHERE e.salary > 5000 AND d.department_name = 'IT' OR e.salary < 1000;
  
  dbms_output.put_line(UPPER('Test') || ' concat');
END;`;

type Category = 'spacing' | 'case' | 'operators' | 'lists';

export default function FormatterConfigModal({ isOpen, onClose }: Props) {
  const { isDark, formatOptions, setFormatOptions } = useAppStore();
  
  const [options, setOptions] = useState<FormatOptions>(formatOptions);
  const [preview, setPreview] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('spacing');

  useEffect(() => {
    try {
      const formatted = format(SAMPLE_SQL, options as any);
      setPreview(formatted);
    } catch (e) {
      setPreview("-- Error formatting preview");
    }
  }, [options]);

  // Reset options when opened
  useEffect(() => {
    if (isOpen) setOptions(formatOptions);
  }, [isOpen, formatOptions]);

  const handleSave = () => {
    setFormatOptions(options);
    onClose();
  };

  const handleExport = () => {
    const json = JSON.stringify(options, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sql-formatter-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedOptions = JSON.parse(event.target?.result as string);
        if (importedOptions && typeof importedOptions === 'object') {
          setOptions({ ...options, ...importedOptions });
        }
      } catch (err) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[85vh] ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              Formatter Configuration
            </h2>
            <div className="w-px h-6 bg-gray-500/20"></div>
            <button onClick={handleExport} className="text-sm font-medium opacity-70 hover:opacity-100 flex items-center gap-1.5 text-blue-500">
              <Download className="w-4 h-4" /> Export
            </button>
            <label className="text-sm font-medium opacity-70 hover:opacity-100 flex items-center gap-1.5 text-green-500 cursor-pointer">
              <Upload className="w-4 h-4" /> Import
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Sidebar Navigation */}
          <div className={`w-full md:w-64 flex flex-col border-r ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50/50'}`}>
            <div className="p-3">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-2 px-3">Categories</div>
              <nav className="space-y-1">
                <button 
                  onClick={() => setActiveCategory('spacing')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeCategory === 'spacing' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600') : 'opacity-70 hover:opacity-100 hover:bg-gray-500/10'}`}
                >
                  <div className="flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> Spacing & Newlines</div>
                  {activeCategory === 'spacing' && <ChevronRight className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setActiveCategory('case')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeCategory === 'case' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600') : 'opacity-70 hover:opacity-100 hover:bg-gray-500/10'}`}
                >
                  <div className="flex items-center gap-2"><Type className="w-4 h-4" /> Case</div>
                  {activeCategory === 'case' && <ChevronRight className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setActiveCategory('operators')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeCategory === 'operators' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600') : 'opacity-70 hover:opacity-100 hover:bg-gray-500/10'}`}
                >
                  <div className="flex items-center gap-2"><AlignLeft className="w-4 h-4" /> Operators & Punctuation</div>
                  {activeCategory === 'operators' && <ChevronRight className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setActiveCategory('lists')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeCategory === 'lists' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600') : 'opacity-70 hover:opacity-100 hover:bg-gray-500/10'}`}
                >
                  <div className="flex items-center gap-2"><ListTree className="w-4 h-4" /> List Arrangements</div>
                  {activeCategory === 'lists' && <ChevronRight className="w-4 h-4" />}
                </button>
              </nav>
            </div>
          </div>

          {/* Settings Panel */}
          <div className={`w-full md:w-[350px] p-6 overflow-y-auto custom-scrollbar border-r flex flex-col gap-6 ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
            
            {activeCategory === 'spacing' && (
              <>
                <h3 className="font-bold text-lg border-b pb-2 mb-2 border-gray-500/20">Spacing & Newlines</h3>
                <div>
                  <label className="block text-sm font-medium opacity-80 mb-1">Tab Width (Indent)</label>
                  <input type="number" min={1} max={8} value={options.tabWidth} onChange={e => setOptions({...options, tabWidth: parseInt(e.target.value) || 2})} className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`} />
                  <p className="text-xs opacity-50 mt-1">Number of spaces to indent.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="useTabs" checked={options.useTabs} onChange={e => setOptions({...options, useTabs: e.target.checked})} className="rounded border-gray-300" />
                  <label htmlFor="useTabs" className="text-sm font-medium opacity-80 cursor-pointer">Use Tabs for indentation</label>
                </div>
                <div>
                  <label className="block text-sm font-medium opacity-80 mb-1">Lines Between Queries</label>
                  <input type="number" min={0} max={5} value={options.linesBetweenQueries} onChange={e => setOptions({...options, linesBetweenQueries: parseInt(e.target.value) || 0})} className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`} />
                  <p className="text-xs opacity-50 mt-1">Empty lines to insert between separate SQL statements.</p>
                </div>
              </>
            )}

            {activeCategory === 'case' && (
              <>
                <h3 className="font-bold text-lg border-b pb-2 mb-2 border-gray-500/20">Case</h3>
                <div>
                  <label className="block text-sm font-medium opacity-80 mb-1">Keywords</label>
                  <select value={options.keywordCase} onChange={e => setOptions({...options, keywordCase: e.target.value as any})} className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
                    <option value="upper">UPPERCASE</option>
                    <option value="lower">lowercase</option>
                    <option value="preserve">Preserve Original</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium opacity-80 mb-1">Identifiers (Tables/Columns)</label>
                  <select value={options.identifierCase} onChange={e => setOptions({...options, identifierCase: e.target.value as any})} className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
                    <option value="upper">UPPERCASE</option>
                    <option value="lower">lowercase</option>
                    <option value="preserve">Preserve Original</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium opacity-80 mb-1">Data Types</label>
                  <select value={options.dataTypeCase} onChange={e => setOptions({...options, dataTypeCase: e.target.value as any})} className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
                    <option value="upper">UPPERCASE</option>
                    <option value="lower">lowercase</option>
                    <option value="preserve">Preserve Original</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium opacity-80 mb-1">Functions</label>
                  <select value={options.functionCase} onChange={e => setOptions({...options, functionCase: e.target.value as any})} className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
                    <option value="upper">UPPERCASE</option>
                    <option value="lower">lowercase</option>
                    <option value="preserve">Preserve Original</option>
                  </select>
                </div>
              </>
            )}

            {activeCategory === 'operators' && (
              <>
                <h3 className="font-bold text-lg border-b pb-2 mb-2 border-gray-500/20">Operators & Punctuation</h3>
                <div>
                  <label className="block text-sm font-medium opacity-80 mb-1">AND / OR Newline</label>
                  <select value={options.logicalOperatorNewline} onChange={e => setOptions({...options, logicalOperatorNewline: e.target.value as any})} className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
                    <option value="before">Before (AND x = y)</option>
                    <option value="after">After (x = y AND)</option>
                  </select>
                  <p className="text-xs opacity-50 mt-1">Placement of logical operators on line breaks.</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="denseOperators" checked={options.denseOperators} onChange={e => setOptions({...options, denseOperators: e.target.checked})} className="rounded border-gray-300" />
                  <label htmlFor="denseOperators" className="text-sm font-medium opacity-80 cursor-pointer">Dense Operators</label>
                </div>
                <p className="text-xs opacity-50 ml-6">Remove spaces around mathematical and concatenation operators (+, -, ||).</p>

                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="newlineBeforeSemicolon" checked={options.newlineBeforeSemicolon} onChange={e => setOptions({...options, newlineBeforeSemicolon: e.target.checked})} className="rounded border-gray-300" />
                  <label htmlFor="newlineBeforeSemicolon" className="text-sm font-medium opacity-80 cursor-pointer">Newline Before Semicolon</label>
                </div>
              </>
            )}

            {activeCategory === 'lists' && (
              <>
                <h3 className="font-bold text-lg border-b pb-2 mb-2 border-gray-500/20">List Arrangements</h3>
                <div>
                  <label className="block text-sm font-medium opacity-80 mb-1">Expression Width</label>
                  <input type="number" min={10} max={200} value={options.expressionWidth} onChange={e => setOptions({...options, expressionWidth: parseInt(e.target.value) || 50})} className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`} />
                  <p className="text-xs opacity-50 mt-1">Maximum characters in a list/expression before breaking it into multiple lines (e.g., in IN(...) clauses or SELECT lists).</p>
                </div>
              </>
            )}

          </div>

          {/* Preview */}
          <div className={`flex-1 flex flex-col ${isDark ? 'bg-gray-950' : 'bg-white'}`}>
            <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider opacity-60 border-b flex justify-between items-center ${isDark ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-gray-50'}`}>
              <span>Live Preview</span>
              <span className="normal-case opacity-70">PL/SQL Dialect</span>
            </div>
            <div className="flex-1 relative">
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme={isDark ? 'vs-dark' : 'light'}
                value={preview}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  padding: { top: 16, bottom: 16 },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-between items-center ${isDark ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-gray-50'}`}>
          <button onClick={() => setOptions(formatOptions)} className="px-4 py-2 text-sm font-medium opacity-70 hover:opacity-100 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Revert Changes
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className={`px-4 py-2 rounded-md text-sm font-medium ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition-colors`}>
              Cancel
            </button>
            <button onClick={handleSave} className="px-6 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
