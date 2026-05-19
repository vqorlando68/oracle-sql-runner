"use client";

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { X, Save } from 'lucide-react';
import { ExportOptions } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  availableColumns: string[];
}

export default function ExportConfigModal({ isOpen, onClose, availableColumns }: Props) {
  const { isDark, exportOptions, setExportOptions } = useAppStore();
  const [options, setOptions] = useState<ExportOptions>(exportOptions);

  useEffect(() => {
    if (isOpen) {
      setOptions(exportOptions);
    }
  }, [isOpen, exportOptions]);

  const handleSave = () => {
    setExportOptions(options);
    onClose();
  };

  const handleDelimiterChange = (val: string) => {
    let ascii = options.delimiterAscii;
    if (val === 'comma') ascii = 44;
    if (val === 'tab') ascii = 9;
    if (val === 'space') ascii = 32;
    if (val === 'semicolon') ascii = 59;
    setOptions({ ...options, delimiter: val, delimiterAscii: ascii });
  };

  const handleAsciiChange = (val: number) => {
    let char = 'custom';
    if (val === 44) char = 'comma';
    if (val === 9) char = 'tab';
    if (val === 32) char = 'space';
    if (val === 59) char = 'semicolon';
    setOptions({ ...options, delimiterAscii: val, delimiter: char });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-gray-50'}`}>
          <h2 className="text-base font-bold flex items-center gap-2">Export Configuration</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex p-6 gap-8 overflow-y-auto max-h-[75vh]">
          
          {/* Left Column */}
          <div className="flex-1 space-y-3">
            <label className="flex items-center gap-2 text-sm cursor-not-allowed opacity-60">
              <input type="checkbox" checked disabled className="rounded border-gray-300" />
              Display all results in grid
            </label>
            <label className="flex items-center gap-2 text-sm cursor-not-allowed opacity-60">
              <input type="checkbox" disabled className="rounded border-gray-300" />
              Export only selected rows
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
              <input 
                type="checkbox" 
                checked={options.includeNullText} 
                onChange={(e) => setOptions({ ...options, includeNullText: e.target.checked })} 
                className="rounded border-gray-300" 
              />
              Include null text
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
              <input 
                type="checkbox" 
                checked={options.includeSqlStatement} 
                onChange={(e) => setOptions({ ...options, includeSqlStatement: e.target.checked })} 
                className="rounded border-gray-300" 
              />
              Include SQL statement
            </label>

            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                <input 
                  type="checkbox" 
                  checked={options.includeColumnHeaders} 
                  onChange={(e) => setOptions({ ...options, includeColumnHeaders: e.target.checked })} 
                  className="rounded border-gray-300" 
                />
                Include column headers
              </label>
              
              <div className="ml-6 space-y-1">
                <label className={`flex items-center gap-2 text-sm ${options.includeColumnHeaders ? 'cursor-pointer hover:text-blue-500' : 'opacity-50 cursor-not-allowed'}`}>
                  <input 
                    type="checkbox" 
                    disabled={!options.includeColumnHeaders}
                    checked={options.headerLowercase} 
                    onChange={(e) => setOptions({ ...options, headerLowercase: e.target.checked })} 
                    className="rounded border-gray-300" 
                  />
                  Lowercase
                </label>
                <label className={`flex items-center gap-2 text-sm ${options.includeColumnHeaders ? 'cursor-pointer hover:text-blue-500' : 'opacity-50 cursor-not-allowed'}`}>
                  <input 
                    type="checkbox" 
                    disabled={!options.includeColumnHeaders}
                    checked={options.headerQuoted} 
                    onChange={(e) => setOptions({ ...options, headerQuoted: e.target.checked })} 
                    className="rounded border-gray-300" 
                  />
                  Quoted
                </label>
              </div>
            </div>

            <div className="space-y-2 mt-4 border-t pt-4 border-gray-500/20">
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                <input 
                  type="checkbox" 
                  checked={options.exportAsInList} 
                  onChange={(e) => setOptions({ ...options, exportAsInList: e.target.checked })} 
                  className="rounded border-gray-300" 
                />
                Export as "In" list for SQL
              </label>
              <div className="ml-6 flex flex-col gap-1">
                <span className={`text-xs ${options.exportAsInList ? 'opacity-80' : 'opacity-40'}`}>In List Column:</span>
                <select 
                  disabled={!options.exportAsInList}
                  value={options.inListColumn}
                  onChange={(e) => setOptions({ ...options, inListColumn: e.target.value })}
                  className={`w-full p-1.5 text-sm rounded border ${options.exportAsInList ? (isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300') : 'bg-gray-200 dark:bg-gray-800 opacity-50'}`}
                >
                  <option value="">-- Select Column --</option>
                  {availableColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`mt-4 border rounded p-3 ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
              <div className="text-xs font-semibold mb-3 -mt-5 bg-inherit w-fit px-1 ml-1 opacity-80">Delimiter</div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-80 underline decoration-dashed">C</span>
                  <span className="text-sm opacity-80">haracter:</span>
                  <select 
                    value={options.delimiter}
                    onChange={(e) => handleDelimiterChange(e.target.value)}
                    className={`p-1.5 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                  >
                    <option value="comma">Comma</option>
                    <option value="tab">Tab</option>
                    <option value="semicolon">Semicolon</option>
                    <option value="space">Space</option>
                    <option value="custom">Custom...</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-80 underline decoration-dashed">A</span>
                  <span className="text-sm opacity-80">SCII value:</span>
                  <input 
                    type="number" 
                    min={0}
                    max={255}
                    value={options.delimiterAscii}
                    onChange={(e) => handleAsciiChange(parseInt(e.target.value) || 0)}
                    className={`w-16 p-1.5 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                <input 
                  type="checkbox" 
                  checked={options.includeDelimiterAfterLastCol} 
                  onChange={(e) => setOptions({ ...options, includeDelimiterAfterLastCol: e.target.checked })} 
                  className="rounded border-gray-300" 
                />
                Include delimiter after the last column
              </label>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex-1 space-y-6">
            <div>
              <label className="block text-sm opacity-80 mb-1">Columns to exclude (comma separated):</label>
              <input 
                type="text"
                value={options.columnsToExclude}
                onChange={(e) => setOptions({ ...options, columnsToExclude: e.target.value })}
                className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block text-sm opacity-80 mb-1">String Quoting:</label>
              <select 
                value={options.stringQuoting}
                onChange={(e) => setOptions({ ...options, stringQuoting: e.target.value as any })}
                className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
              >
                <option value="dont_quote">Don't Quote Strings</option>
                <option value="quote">Quote Strings</option>
              </select>
            </div>

            <div>
              <label className="block text-sm opacity-80 mb-1">Number Quoting:</label>
              <select 
                value={options.numberQuoting}
                onChange={(e) => setOptions({ ...options, numberQuoting: e.target.value as any })}
                className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
              >
                <option value="dont_quote">Don't Quote Numbers</option>
                <option value="quote">Quote Numbers</option>
              </select>
            </div>

            <div className="pt-4 border-t border-gray-500/20">
              <label className="block text-sm opacity-80 mb-1">Date Format:</label>
              <input 
                type="text"
                value={options.dateFormat || ''}
                onChange={(e) => setOptions({ ...options, dateFormat: e.target.value })}
                className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                placeholder="YYYY-MM-DD HH24:MI:SS"
              />
              <p className="text-[11px] opacity-50 mt-1">Tokens: YYYY, MM, DD, HH24, MI, SS</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t flex justify-end gap-3 ${isDark ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-gray-50'}`}>
          <button onClick={onClose} className={`px-4 py-1.5 rounded-md text-sm font-medium ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition-colors`}>
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>

      </div>
    </div>
  );
}
