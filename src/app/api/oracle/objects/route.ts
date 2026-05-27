import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

const unsupportedQueries = new Set<string>();

function getQueryCacheKey(connection: any, sql: string): string {
  const user = connection?.user || '';
  const host = connection?.host || '';
  const port = connection?.port || '';
  const serviceName = connection?.serviceName || '';
  return `${user}@${host}:${port}/${serviceName}:${sql}`;
}

async function fetchAuxiliaryObjects(connection: any, sql: string, binds: any, defaultType: string): Promise<any[]> {
  const cacheKey = getQueryCacheKey(connection, sql);
  if (unsupportedQueries.has(cacheKey)) {
    return [];
  }
  try {
    const result = await executeOracleQuery(connection, sql, binds);
    if (result.rows && Array.isArray(result.rows)) {
      return result.rows.map((row: any) => {
        // Find key in row (case-insensitive)
        const nameKey = Object.keys(row).find(k => 
          k.toUpperCase().includes('NAME') || 
          k.toUpperCase().includes('USER') || 
          k.toUpperCase().includes('ROLE') || 
          k.toUpperCase().includes('TABLESPACE') ||
          k.toUpperCase().includes('FILE') ||
          k.toUpperCase().includes('MEMBER') ||
          k.toUpperCase().includes('PROFILE') ||
          k.toUpperCase().includes('LINK')
        );
        const name = nameKey ? row[nameKey] : Object.values(row)[0];
        return {
          name: String(name),
          status: 'VALID',
          type: defaultType
        };
      });
    }
  } catch (e: any) {
    const msg = String(e.message || '');
    if (msg.includes('ORA-00942') || msg.includes('ORA-00904')) {
      unsupportedQueries.add(cacheKey);
    }
    // Ignore error
    console.warn(`Failed to fetch auxiliary objects of type ${defaultType}:`, e);
  }
  return [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection, schema, skipAuxiliary, visibleTypes } = body;

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection is required' },
        { status: 400 }
      );
    }

    const binds: any = {};
    if (schema) {
      binds.schema = schema.toUpperCase();
    }

    // 1. Fetch main database objects without filtering on object_type
    const sql = schema
      ? `
        SELECT object_name, object_type, status 
        FROM all_objects 
        WHERE owner = :schema
        ORDER BY object_type, object_name
      `
      : `
        SELECT object_name, object_type, status 
        FROM user_objects 
        ORDER BY object_type, object_name
      `;

    const result = await executeOracleQuery(connection, sql, binds);

    // 2. Fetch table classification properties
    const tabSql = schema
      ? `SELECT table_name, temporary, iot_type, partitioned FROM all_tables WHERE owner = :schema`
      : `SELECT table_name, temporary, iot_type, partitioned FROM user_tables`;

    const extTabSql = schema
      ? `SELECT table_name FROM all_external_tables WHERE owner = :schema`
      : `SELECT table_name FROM user_external_tables`;

    const nestTabSql = schema
      ? `SELECT table_name FROM all_nested_tables WHERE owner = :schema`
      : `SELECT table_name FROM user_nested_tables`;

    const objTabSql = schema
      ? `SELECT table_name FROM all_object_tables WHERE owner = :schema`
      : `SELECT table_name FROM user_object_tables`;

    const tableProps: Record<string, { temporary?: string; iot_type?: string; partitioned?: string; isExternal?: boolean; isNested?: boolean; isObject?: boolean }> = {};
    
    try {
      const tabRes = await executeOracleQuery(connection, tabSql, binds);
      if (tabRes.rows) {
        tabRes.rows.forEach((r: any) => {
          const name = r.TABLE_NAME || r.table_name;
          tableProps[name] = {
            temporary: r.TEMPORARY || r.temporary,
            iot_type: r.IOT_TYPE || r.iot_type,
            partitioned: r.PARTITIONED || r.partitioned
          };
        });
      }
    } catch (e) {
      console.warn("Failed to fetch table attributes:", e);
    }

    try {
      const extRes = await executeOracleQuery(connection, extTabSql, binds);
      if (extRes.rows) {
        extRes.rows.forEach((r: any) => {
          const name = r.TABLE_NAME || r.table_name;
          if (!tableProps[name]) tableProps[name] = {};
          tableProps[name].isExternal = true;
        });
      }
    } catch (e) { /* ignore */ }

    try {
      const nestRes = await executeOracleQuery(connection, nestTabSql, binds);
      if (nestRes.rows) {
        nestRes.rows.forEach((r: any) => {
          const name = r.TABLE_NAME || r.table_name;
          if (!tableProps[name]) tableProps[name] = {};
          tableProps[name].isNested = true;
        });
      }
    } catch (e) { /* ignore */ }

    try {
      const objRes = await executeOracleQuery(connection, objTabSql, binds);
      if (objRes.rows) {
        objRes.rows.forEach((r: any) => {
          const name = r.TABLE_NAME || r.table_name;
          if (!tableProps[name]) tableProps[name] = {};
          tableProps[name].isObject = true;
        });
      }
    } catch (e) { /* ignore */ }

    // 3. Fetch index classification types
    const idxSql = schema
      ? `SELECT index_name, index_type FROM all_indexes WHERE owner = :schema`
      : `SELECT index_name, index_type FROM user_indexes`;

    let indexTypes: Record<string, string> = {};
    try {
      const idxRes = await executeOracleQuery(connection, idxSql, binds);
      if (idxRes.rows) {
        idxRes.rows.forEach((r: any) => {
          const name = r.INDEX_NAME || r.index_name;
          const type = r.INDEX_TYPE || r.index_type;
          if (name && type) {
            indexTypes[name] = type;
          }
        });
      }
    } catch (e) {
      console.warn("Failed to fetch index types:", e);
    }

    // 4. Group and classify main objects
    const allObjects: { name: string; type: string; status: string }[] = [];

    if (result.rows && Array.isArray(result.rows)) {
      result.rows.forEach((row: any) => {
        const name = row.OBJECT_NAME || row.object_name;
        let type = row.OBJECT_TYPE || row.object_type;
        const status = row.STATUS || row.status || 'VALID';

        if (!name || !type) return;

        // Categorize into specific subtypes requested by user
        if (type === 'TABLE') {
          const props = tableProps[name];
          if (props) {
            if (props.temporary === 'Y') {
              type = 'GLOBAL TEMPORARY TABLE';
            } else if (props.isExternal) {
              type = 'EXTERNAL TABLE';
            } else if (props.isNested) {
              type = 'NESTED TABLE';
            } else if (props.isObject) {
              type = 'OBJECT TABLE';
            } else if (props.iot_type === 'IOT') {
              type = 'INDEX ORGANIZED TABLE';
            } else if (props.partitioned === 'YES') {
              type = 'PARTITIONED TABLE';
            }
          }
        } else if (type === 'INDEX') {
          const idxType = indexTypes[name];
          if (idxType) {
            if (idxType === 'BITMAP') {
              type = 'BITMAP INDEX';
            } else if (idxType === 'DOMAIN') {
              type = 'DOMAIN INDEX';
            } else if (idxType.includes('FUNCTION-BASED')) {
              type = 'FUNCTION-BASED INDEX';
            }
          }
        }

        allObjects.push({ name, type, status });
      });
    }

    // 5. Fetch auxiliary objects (safely ignoring any permission errors)
    if (!skipAuxiliary) {
      const showTablespace = !visibleTypes || visibleTypes.includes('TABLESPACE');
      const showRole = !visibleTypes || visibleTypes.includes('ROLE');
      const showUser = !visibleTypes || visibleTypes.includes('USER');
      const showDirectory = !visibleTypes || visibleTypes.includes('DIRECTORY');
      const showDbLink = !visibleTypes || visibleTypes.includes('DATABASE LINK');
      const showProfile = !visibleTypes || visibleTypes.includes('PROFILE');
      const showDatafile = !visibleTypes || visibleTypes.includes('DATAFILE');
      const showControlFile = !visibleTypes || visibleTypes.includes('CONTROL FILE');
      const showRedoLog = !visibleTypes || visibleTypes.includes('REDO LOG');

      // 5.1. Fetch standard non-DBA objects in parallel (safe and fast)
      const standardPromises: Promise<any[]>[] = [];
      if (showTablespace) {
        standardPromises.push(fetchAuxiliaryObjects(connection, `SELECT tablespace_name FROM user_tablespaces`, {}, 'TABLESPACE'));
      }
      if (showRole) {
        standardPromises.push(fetchAuxiliaryObjects(connection, `SELECT role FROM user_role_privs`, {}, 'ROLE'));
      }
      if (showUser) {
        standardPromises.push(fetchAuxiliaryObjects(connection, `SELECT username FROM all_users`, {}, 'USER'));
      }
      if (showDirectory) {
        standardPromises.push(fetchAuxiliaryObjects(connection, `SELECT directory_name FROM all_directories`, {}, 'DIRECTORY'));
      }
      if (showDbLink) {
        standardPromises.push(fetchAuxiliaryObjects(connection, `SELECT db_link FROM all_db_links`, {}, 'DATABASE LINK'));
      }

      if (standardPromises.length > 0) {
        const standardResults = await Promise.all(standardPromises);
        standardResults.forEach(res => allObjects.push(...res));
      }

      // 5.2. Fetch DBA objects sequentially with fail-fast logic
      if (showProfile || showDatafile) {
        const dbaProfilesSql = `SELECT DISTINCT profile FROM dba_profiles`;
        const dbaDataFilesSql = `SELECT file_name FROM dba_data_files`;
        const dbaProfilesKey = getQueryCacheKey(connection, dbaProfilesSql);
        const dbaDataFilesKey = getQueryCacheKey(connection, dbaDataFilesSql);

        if (!unsupportedQueries.has(dbaProfilesKey)) {
          if (showProfile) {
            const profileObjects = await fetchAuxiliaryObjects(connection, dbaProfilesSql, {}, 'PROFILE');
            allObjects.push(...profileObjects);
            if (unsupportedQueries.has(dbaProfilesKey)) {
              unsupportedQueries.add(dbaDataFilesKey);
            } else if (showDatafile) {
              const dfObjects = await fetchAuxiliaryObjects(connection, dbaDataFilesSql, {}, 'DATAFILE');
              allObjects.push(...dfObjects);
            }
          } else if (showDatafile) {
            if (!unsupportedQueries.has(dbaDataFilesKey)) {
              const dfObjects = await fetchAuxiliaryObjects(connection, dbaDataFilesSql, {}, 'DATAFILE');
              allObjects.push(...dfObjects);
              if (unsupportedQueries.has(dbaDataFilesKey)) {
                unsupportedQueries.add(dbaProfilesKey);
              }
            }
          }
        }
      }

      // 5.3. Fetch V$ diagnostic objects sequentially with fail-fast logic
      if (showControlFile || showRedoLog) {
        const vControlFileSql = `SELECT name FROM v$controlfile`;
        const vLogFileSql = `SELECT member FROM v$logfile`;
        const vControlFileKey = getQueryCacheKey(connection, vControlFileSql);
        const vLogFileKey = getQueryCacheKey(connection, vLogFileSql);

        if (!unsupportedQueries.has(vControlFileKey)) {
          if (showControlFile) {
            const cfObjects = await fetchAuxiliaryObjects(connection, vControlFileSql, {}, 'CONTROL FILE');
            allObjects.push(...cfObjects);
            if (unsupportedQueries.has(vControlFileKey)) {
              unsupportedQueries.add(vLogFileKey);
            } else if (showRedoLog) {
              const logObjects = await fetchAuxiliaryObjects(connection, vLogFileSql, {}, 'REDO LOG');
              allObjects.push(...logObjects);
            }
          } else if (showRedoLog) {
            if (!unsupportedQueries.has(vLogFileKey)) {
              const logObjects = await fetchAuxiliaryObjects(connection, vLogFileSql, {}, 'REDO LOG');
              allObjects.push(...logObjects);
              if (unsupportedQueries.has(vLogFileKey)) {
                unsupportedQueries.add(vControlFileKey);
              }
            }
          }
        }
      }
    }


    // 6. Group all objects by type, ensuring uniqueness (no duplicates)
    const grouped: Record<string, { name: string; status: string }[]> = {};
    const seen = new Set<string>();

    allObjects.forEach(obj => {
      const uniqueKey = `${obj.type}:${obj.name.toUpperCase()}`;
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      if (!grouped[obj.type]) {
        grouped[obj.type] = [];
      }
      grouped[obj.type].push({ name: obj.name, status: obj.status });
    });

    return NextResponse.json({ success: true, objects: grouped });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error listing database objects' },
      { status: 500 }
    );
  }
}
