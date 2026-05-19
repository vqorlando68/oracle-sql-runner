export const extractSqlParams = (sql: string): string[] => {
  // Matches :PARAM_NAME, ignoring cases inside quotes if possible.
  // A basic regex for Oracle binds: :[a-zA-Z0-9_]+
  const regex = /:([a-zA-Z0-9_]+)/g;
  const matches = [...sql.matchAll(regex)];
  const paramNames = matches.map(match => match[1]);
  // Remove duplicates
  return Array.from(new Set(paramNames));
};
