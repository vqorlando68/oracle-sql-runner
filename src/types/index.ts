export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  serviceName: string;
  user: string;
  password?: string;
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
  /** Set when this tab was opened from a favorite — used by the Save button */
  favoriteId?: string;
}

export interface FavoriteSection {
  id: string;
  name: string;
}

export interface Favorite {
  id: string;
  name: string;
  sql: string;
  sectionId: string;
  createdAt: string;
  lastRunAt?: string;
  dbId?: number;
}

export interface HistoryRecord {
  id: string;
  sql: string;
  timestamp: string;
  connectionId: string;
  duration: number;
  /** @deprecated use linkedFavoriteId instead */
  isFavorite?: boolean;
  /** id of the Favorite record this history item is linked to */
  linkedFavoriteId?: string;
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
  dbmsOutput?: string[];
}

export interface FormatOptions {
  language: 'plsql';
  tabWidth: number;
  useTabs: boolean;
  keywordCase: 'upper' | 'lower' | 'preserve';
  identifierCase: 'upper' | 'lower' | 'preserve';
  dataTypeCase: 'upper' | 'lower' | 'preserve';
  functionCase: 'upper' | 'lower' | 'preserve';
  logicalOperatorNewline: 'before' | 'after';
  expressionWidth: number;
  linesBetweenQueries: number;
  denseOperators: boolean;
  newlineBeforeSemicolon: boolean;
}

export interface ExportOptions {
  includeNullText: boolean;
  includeSqlStatement: boolean;
  includeColumnHeaders: boolean;
  headerLowercase: boolean;
  headerQuoted: boolean;
  exportAsInList: boolean;
  inListColumn: string;
  delimiter: string;
  delimiterAscii: number;
  includeDelimiterAfterLastCol: boolean;
  columnsToExclude: string;
  stringQuoting: 'dont_quote' | 'quote';
  numberQuoting: 'dont_quote' | 'quote';
  dateFormat: string;
}

export interface GridOptions {
  dateFormat: string;
  numberFormat: 'none' | 'locale';
  truncateLength: number;
}

export interface AppToast {
  message: string;
  type: 'success' | 'error' | 'info';
}
