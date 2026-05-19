export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  serviceName: string;
  user: string;
  password?: string; // stored encrypted locally ideally, but for MVP local storage
}

export type ParamType = 'string' | 'number' | 'date' | 'timestamp' | 'boolean';

export interface SqlParam {
  name: string;
  type: ParamType;
  value: any;
}

export interface SqlTab {
  id: string;
  title: string;
  query: string;
}

export interface HistoryRecord {
  id: string;
  sql: string;
  timestamp: string;
  connectionId: string;
  duration: number;
  isFavorite: boolean;
  status: 'success' | 'error';
  rowCount?: number;
  error?: string;
}

export interface ExecResult {
  rows: any[];
  columns: string[];
  duration: number;
  rowCount: number;
  error?: string;
}
