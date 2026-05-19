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

export async function executeOracleQuery(connectionParams: any, sql: string, binds: any = {}, enableDbmsOutput: boolean = false) {
  let connection;
  try {
    // Basic config to output objects instead of arrays
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    
    // Automatically fetch CLOBs as strings to avoid returning complex LOB stream objects
    oracledb.fetchAsString = [oracledb.CLOB];
    
    // Connect to the database
    connection = await oracledb.getConnection({
      user: connectionParams.user,
      password: connectionParams.password,
      connectString: `${connectionParams.host}:${connectionParams.port}/${connectionParams.serviceName}`
    });

    if (enableDbmsOutput) {
      await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(NULL); END;`);
    }

    const startTime = Date.now();
    const result = await connection.execute(sql, binds);
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
    
    // For DML
    const rowsAffected = result.rowsAffected || 0;

    // If DML, commit
    if (rowsAffected > 0) {
      await connection.commit();
    }

    return {
      rows: safeSerialize(rows),
      columns,
      duration,
      rowCount: rows.length || rowsAffected,
      dbmsOutput
    };
  } catch (err: any) {
    throw new Error(err.message || 'Error executing Oracle query');
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection', err);
      }
    }
  }
}
