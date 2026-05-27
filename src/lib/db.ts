import oracledb from 'oracledb';

// Helper to safely serialize data and remove circular references
function safeSerialize(obj: any) {
  const cache = new Set();
  const serialized = JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular]';
      }
      cache.add(value);
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    // Optional: handles Oracle DB objects if they still pass through
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Lob') {
      return '[LOB Stream]';
    }
    return value;
  });
  return JSON.parse(serialized);
}

// ── Session Management ──────────────────────────────────────────────────────────
// Map: connectionKey → oracledb.Connection
// The key is built from connection params to uniquely identify a connection target.
const sessions = new Map<string, oracledb.Connection>();

function buildSessionKey(connectionParams: any): string {
  return `${connectionParams.user}@${connectionParams.host}:${connectionParams.port}/${connectionParams.serviceName}`;
}

async function getOrCreateSession(connectionParams: any): Promise<oracledb.Connection> {
  const key = buildSessionKey(connectionParams);
  const existing = sessions.get(key);

  if (existing) {
    // Check if the connection is still alive
    try {
      await existing.ping();
      return existing;
    } catch {
      // Connection is dead, remove it
      sessions.delete(key);
    }
  }

  // Basic config to output objects instead of arrays
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  // Automatically fetch CLOBs as strings to avoid returning complex LOB stream objects
  oracledb.fetchAsString = [oracledb.CLOB];

  const connection = await oracledb.getConnection({
    user: connectionParams.user,
    password: connectionParams.password,
    connectString: `${connectionParams.host}:${connectionParams.port}/${connectionParams.serviceName}`
  });

  sessions.set(key, connection);
  return connection;
}

export async function commitSession(connectionParams: any): Promise<void> {
  const key = buildSessionKey(connectionParams);
  const connection = sessions.get(key);
  if (!connection) {
    throw new Error('No hay una sesión activa para hacer COMMIT. Ejecute una sentencia primero.');
  }
  try {
    await connection.commit();
  } catch (err: any) {
    throw new Error(err.message || 'Error al ejecutar COMMIT');
  }
}

export async function rollbackSession(connectionParams: any): Promise<void> {
  const key = buildSessionKey(connectionParams);
  const connection = sessions.get(key);
  if (!connection) {
    throw new Error('No hay una sesión activa para hacer ROLLBACK. Ejecute una sentencia primero.');
  }
  try {
    await connection.rollback();
  } catch (err: any) {
    throw new Error(err.message || 'Error al ejecutar ROLLBACK');
  }
}

export async function closeSession(connectionParams: any): Promise<void> {
  const key = buildSessionKey(connectionParams);
  const connection = sessions.get(key);
  if (connection) {
    try {
      await connection.close();
    } catch (err) {
      console.error('Error closing session', err);
    }
    sessions.delete(key);
  }
}

function isSelectQuery(sql: string): boolean {
  const clean = sql
    .replace(/--.*$/gm, '') // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
    .trim();
  return /^(SELECT|WITH)\b/i.test(clean);
}

// ── Query Execution ─────────────────────────────────────────────────────────────
export async function executeOracleQuery(
  connectionParams: any,
  sql: string,
  binds: any = {},
  enableDbmsOutput: boolean = false,
  bindTypes?: Record<string, string>,
  autoCommit: boolean = false,
  offset?: number,
  limit?: number
) {
  let connection: oracledb.Connection;
  try {
    connection = await getOrCreateSession(connectionParams);

    if (enableDbmsOutput) {
      await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(NULL); END;`);
    }

    const isSelect = isSelectQuery(sql);
    const hasRowIdInSql = /\browid\b/i.test(sql);
    const isPaginated = isSelect && offset !== undefined && limit !== undefined && !hasRowIdInSql;

    let sqlToExecute = sql;

    // Process bindTypes if provided
    const processedBinds = { ...binds };
    if (bindTypes) {
      Object.keys(bindTypes).forEach(key => {
        const type = bindTypes[key];
        const val = processedBinds[key];
        if (val !== undefined && val !== null) {
          if (type === 'clob') {
            processedBinds[key] = { val, type: oracledb.CLOB, dir: oracledb.BIND_IN };
          } else if (type === 'blob') {
            processedBinds[key] = { val, type: oracledb.BLOB, dir: oracledb.BIND_IN };
          }
        }
      });
    }

    if (isPaginated) {
      const cleanedSql = sql.trim().replace(/;+$/, '');
      sqlToExecute = `${cleanedSql} OFFSET :p_min_row ROWS FETCH NEXT :p_limit ROWS ONLY`;
      processedBinds.p_min_row = offset!;
      processedBinds.p_limit = limit!;
    }

    const options: oracledb.ExecuteOptions = {};
    if (autoCommit) {
      options.autoCommit = true;
    }

    const startTime = Date.now();
    console.log("SQL to execute in DB:", sqlToExecute);
    const result = await connection.execute(sqlToExecute, processedBinds, options);
    const duration = Date.now() - startTime;

    let dbmsOutput: string[] | undefined = undefined;

    if (enableDbmsOutput) {
      const outputResult: any = await connection.execute(
        `BEGIN
           DBMS_OUTPUT.GET_LINES(:p_lines, :p_numlines);
         END;`,
        {
          p_lines: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxArraySize: 32767 },
          p_numlines: { type: oracledb.NUMBER, dir: oracledb.BIND_INOUT, val: 32767 }
        }
      );
      if (outputResult.outBinds && outputResult.outBinds.p_lines) {
        dbmsOutput = outputResult.outBinds.p_lines;
      }
    }

    // Handle SELECT vs DML
    const rows = result.rows || [];
    const metaData = result.metaData || [];
    const columns = metaData.map((col: any) => col.name);
    
    let processedRows = rows;
    let processedColumns = columns;

    if (isPaginated) {
      processedColumns = columns.filter((col: any) => col.toUpperCase() !== 'RNUM_PAG_TEMP');
      processedRows = rows.map((row: any) => {
        const newRow = { ...row };
        delete newRow.RNUM_PAG_TEMP;
        delete newRow.rnum_pag_temp;
        return newRow;
      });
    }

    // For DML — NO auto-commit — user must COMMIT/ROLLBACK explicitly
    const rowsAffected = result.rowsAffected || 0;

    return {
      rows: safeSerialize(processedRows),
      columns: processedColumns,
      duration,
      rowCount: processedRows.length || rowsAffected,
      rowsAffected,
      dbmsOutput
    };
  } catch (err: any) {
    // If the connection is broken, clean up the session
    const key = buildSessionKey(connectionParams);
    if (sessions.has(key)) {
      try {
        const conn = sessions.get(key);
        await conn?.close();
      } catch { /* ignore */ }
      sessions.delete(key);
    }
    throw new Error(err.message || 'Error executing Oracle query');
  }
}

export async function explainOracleQuery(connectionParams: any, sql: string, binds: any = {}) {
  let connection: oracledb.Connection;
  try {
    connection = await getOrCreateSession(connectionParams);

    const cleanSql = sql.trim().replace(/;+$/, '');
    await connection.execute(`EXPLAIN PLAN FOR ${cleanSql}`, binds);

    const planResult = await connection.execute(`SELECT PLAN_TABLE_OUTPUT FROM TABLE(DBMS_XPLAN.DISPLAY())`);
    const rows = planResult.rows || [];
    const planLines = rows.map((row: any) => {
      if (typeof row === 'string') return row;
      if (Array.isArray(row)) return row[0] || '';
      return row.PLAN_TABLE_OUTPUT || Object.values(row)[0] || '';
    });

    return {
      plan: planLines.join('\n')
    };
  } catch (err: any) {
    throw new Error(err.message || 'Error executing EXPLAIN PLAN');
  }
}

