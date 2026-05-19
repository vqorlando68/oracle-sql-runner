"use client";

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Connection } from '@/types';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection | null;
}

export default function ConnectionModal({ isOpen, onClose, connection }: Props) {
  const { addConnection, updateConnection, isDark } = useAppStore();
  const [formData, setFormData] = useState<Partial<Connection>>({
    name: '', host: 'localhost', port: 1521, serviceName: 'ORCLCDB', user: '', password: ''
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, msg: string} | null>(null);

  useEffect(() => {
    if (connection) {
      setFormData(connection);
    }
  }, [connection]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'port' ? Number(value) : value }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/oracle/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection: formData })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, msg: 'Connection successful!' });
      } else {
        setTestResult({ success: false, msg: data.error || 'Failed to connect' });
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: err.message || 'Error connecting' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.host || !formData.user) return;
    
    if (connection) {
      updateConnection(formData as Connection);
    } else {
      addConnection({ ...formData, id: crypto.randomUUID() } as Connection);
    }
    onClose();
  };

  const bg = isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800';
  const inputBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-xl shadow-2xl p-6 ${bg} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{connection ? 'Edit Connection' : 'New Connection'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Connection Name</label>
            <input name="name" value={formData.name} onChange={handleChange} className={`w-full p-2 rounded-md border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`} placeholder="Production DB" />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 opacity-80">Host</label>
              <input name="host" value={formData.host} onChange={handleChange} className={`w-full p-2 rounded-md border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 opacity-80">Port</label>
              <input name="port" type="number" value={formData.port} onChange={handleChange} className={`w-full p-2 rounded-md border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Service Name (or SID)</label>
            <input name="serviceName" value={formData.serviceName} onChange={handleChange} className={`w-full p-2 rounded-md border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 opacity-80">User</label>
              <input name="user" value={formData.user} onChange={handleChange} className={`w-full p-2 rounded-md border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 opacity-80">Password</label>
              <input name="password" type="password" value={formData.password} onChange={handleChange} className={`w-full p-2 rounded-md border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`} />
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${testResult.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {testResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {testResult.msg}
            </div>
          )}

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-inherit">
            <button
              onClick={handleTest}
              disabled={testing}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} transition-colors disabled:opacity-50`}
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test Connection'}
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className={`px-4 py-2 rounded-md text-sm font-medium ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
