"use client";

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { X, Save } from 'lucide-react';
import { GridOptions } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GridConfigModal({ isOpen, onClose }: Props) {
  const { isDark, gridOptions, setGridOptions } = useAppStore();
  const [options, setOptions] = useState<GridOptions>(gridOptions || {
    dateFormat: 'YYYY-MM-DD HH24:MI:SS',
    numberFormat: 'none',
    truncateLength: 50
  });

  useEffect(() => {
    if (isOpen && gridOptions) {
      setOptions(gridOptions);
    }
  }, [isOpen, gridOptions]);

  const handleSave = () => {
    setGridOptions(options);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-lg shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-800 bg-gray-900/80' : 'border-gray-200 bg-gray-50'}`}>
          <h2 className="text-base font-bold flex items-center gap-2">Grid Display Settings</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col p-6 gap-5">
          
          <div>
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

          <div>
            <label className="block text-sm opacity-80 mb-1">Number Formatting:</label>
            <select 
              value={options.numberFormat}
              onChange={(e) => setOptions({ ...options, numberFormat: e.target.value as any })}
              className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
            >
              <option value="none">Standard (No formatting)</option>
              <option value="locale">Locale (Thousands separators)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm opacity-80 mb-1">Cell Truncation Limit:</label>
            <input 
              type="number"
              min={10}
              max={1000}
              value={options.truncateLength}
              onChange={(e) => setOptions({ ...options, truncateLength: parseInt(e.target.value) || 50 })}
              className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
            />
            <p className="text-[11px] opacity-50 mt-1">Max characters shown before truncating with "...". Full text is always available via the expand button.</p>
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
