"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  params: string[];
  onExecute: (bindValues: Record<string, any>) => void;
}

export default function ParamModal({ isOpen, onClose, params, onExecute }: Props) {
  const { isDark } = useAppStore();
  const [binds, setBinds] = useState<Record<string, { type: string, value: string }>>({});

  useEffect(() => {
    const initialBinds: any = {};
    params.forEach(p => {
      initialBinds[p] = { type: 'string', value: '' };
    });
    setBinds(initialBinds);
  }, [params]);

  if (!isOpen) return null;

  const handleTypeChange = (param: string, type: string) => {
    setBinds(prev => ({ ...prev, [param]: { ...prev[param], type } }));
  };

  const handleValueChange = (param: string, value: string) => {
    setBinds(prev => ({ ...prev, [param]: { ...prev[param], value } }));
  };

  const handleExecute = () => {
    // Format values based on type
    const finalBinds: Record<string, any> = {};
    Object.keys(binds).forEach(key => {
      const { type, value } = binds[key];
      if (value === '' || value === null) {
        finalBinds[key] = null;
      } else if (type === 'number') {
        finalBinds[key] = Number(value);
      } else if (type === 'date' || type === 'timestamp') {
        finalBinds[key] = new Date(value);
      } else if (type === 'boolean') {
        finalBinds[key] = value.toLowerCase() === 'true';
      } else {
        finalBinds[key] = value;
      }
    });
    
    onExecute(finalBinds);
    onClose();
  };

  const bg = isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800';
  const inputBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-xl shadow-2xl p-6 ${bg} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Provide Parameter Values</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
          {params.map(param => (
            <div key={param} className={`p-4 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50/50'}`}>
              <div className="font-mono font-bold text-blue-500 mb-2">:{param}</div>
              <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="block text-xs font-medium mb-1 opacity-70">Type</label>
                  <select 
                    className={`w-full p-2 text-sm rounded-md border ${inputBg} outline-none focus:ring-2 focus:ring-blue-500`}
                    value={binds[param]?.type || 'string'}
                    onChange={(e) => handleTypeChange(param, e.target.value)}
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="timestamp">Timestamp</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </div>
                <div className="w-2/3">
                  <label className="block text-xs font-medium mb-1 opacity-70">Value</label>
                  <input 
                    type={binds[param]?.type === 'number' ? 'number' : (binds[param]?.type === 'date' ? 'date' : 'text')}
                    className={`w-full p-2 text-sm rounded-md border ${inputBg} outline-none focus:ring-2 focus:ring-blue-500`}
                    value={binds[param]?.value || ''}
                    onChange={(e) => handleValueChange(param, e.target.value)}
                    placeholder="Enter value or leave empty for NULL"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-inherit">
          <button onClick={onClose} className={`px-4 py-2 rounded-md text-sm font-medium ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>Cancel</button>
          <button onClick={handleExecute} className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">Execute Query</button>
        </div>
      </div>
    </div>
  );
}
