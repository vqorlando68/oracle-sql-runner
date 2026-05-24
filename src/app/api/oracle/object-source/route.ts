import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection, name, type, schema } = body;

    if (!connection || !name || !type) {
      return NextResponse.json(
        { error: 'Connection, name, and type are required' },
        { status: 400 }
      );
    }

    const upperName = name.toUpperCase();
    const originalType = type.toUpperCase();
    
    // Map object type for DBMS_METADATA.GET_DDL
    // PACKAGE BODY -> PACKAGE_BODY
    let ddlType = originalType;
    if (ddlType === 'PACKAGE BODY') {
      ddlType = 'PACKAGE_BODY';
    } else if (ddlType === 'TYPE BODY') {
      ddlType = 'TYPE_BODY';
    } else if (ddlType === 'JOB') {
      ddlType = 'PROCOBJ';
    }

    let source = '';

    // 1. Try DBMS_METADATA.GET_DDL first
    try {
      const ddlSql = schema
        ? `SELECT DBMS_METADATA.GET_DDL(:type, :name, :schema) AS ddl FROM DUAL`
        : `SELECT DBMS_METADATA.GET_DDL(:type, :name) AS ddl FROM DUAL`;
      
      const binds: any = {
        type: ddlType,
        name: upperName
      };
      if (schema) {
        binds.schema = schema.toUpperCase();
      }

      const ddlResult = await executeOracleQuery(connection, ddlSql, binds);
      
      if (ddlResult.rows && ddlResult.rows.length > 0) {
        const row = ddlResult.rows[0];
        source = row.DDL || row.ddl || '';
      }
    } catch (metadataError: any) {
      console.warn(`DBMS_METADATA.GET_DDL failed for ${originalType} ${upperName}, using fallback.`, metadataError.message);
    }

    // 2. Fallbacks if DBMS_METADATA failed or returned empty
    if (!source || source.trim() === '') {
      if (originalType === 'TABLE' || originalType === 'VIEW') {
        // Fallback for tables/views: Get column info and construct a helper query
        try {
          const colSql = schema
            ? `
              SELECT column_name, data_type, data_length, nullable
              FROM all_tab_columns
              WHERE table_name = :name AND owner = :owner
              ORDER BY column_id
            `
            : `
              SELECT column_name, data_type, data_length, nullable
              FROM user_tab_columns
              WHERE table_name = :name
              ORDER BY column_id
            `;
          
          const colBinds: any = { name: upperName };
          if (schema) {
            colBinds.owner = schema.toUpperCase();
          }

          const colResult = await executeOracleQuery(connection, colSql, colBinds);
          
          let columnsComment = `-- Columnas de ${upperName}:\n`;
          if (colResult.rows && colResult.rows.length > 0) {
            colResult.rows.forEach((row: any) => {
              const colName = row.COLUMN_NAME || row.column_name;
              const colType = row.DATA_TYPE || row.data_type;
              const colLen = row.DATA_LENGTH || row.data_length;
              const isNullable = (row.NULLABLE || row.nullable) === 'Y';
              
              columnsComment += `--   ${colName.padEnd(20)} ${colType}(${colLen})${isNullable ? '' : ' NOT NULL'}\n`;
            });
          } else {
            columnsComment += `-- (No se pudo obtener información de columnas)\n`;
          }
          
          source = `${columnsComment}\nSELECT * FROM ${schema ? `${schema.toUpperCase()}.${upperName}` : upperName};`;
        } catch (colError: any) {
          // Absolute fallback
          source = `SELECT * FROM ${schema ? `${schema.toUpperCase()}.${upperName}` : upperName};`;
        }
      } else if (originalType === 'JOB') {
        // Fallback for DBMS_SCHEDULER Jobs: construct standard creation blocks
        try {
          const jobSql = schema
            ? `SELECT job_type, job_action, repeat_interval, enabled FROM all_scheduler_jobs WHERE job_name = :name AND owner = :owner`
            : `SELECT job_type, job_action, repeat_interval, enabled FROM user_scheduler_jobs WHERE job_name = :name`;
          
          const jobBinds: any = { name: upperName };
          if (schema) jobBinds.owner = schema.toUpperCase();

          const jobResult = await executeOracleQuery(connection, jobSql, jobBinds);
          if (jobResult.rows && jobResult.rows.length > 0) {
            const row = jobResult.rows[0];
            const jType = row.JOB_TYPE || row.job_type || 'PLSQL_BLOCK';
            const jAction = row.JOB_ACTION || row.job_action || 'NULL;';
            const jInterval = row.REPEAT_INTERVAL || row.repeat_interval || '';
            const jEnabled = (row.ENABLED || row.enabled) === 'TRUE' || (row.ENABLED || row.enabled) === true;
            
            source = `BEGIN\n  DBMS_SCHEDULER.CREATE_JOB (\n    job_name => '${upperName}',\n    job_type => '${jType}',\n    job_action => '${jAction.replace(/'/g, "''")}',\n    repeat_interval => '${jInterval}',\n    enabled => ${jEnabled ? 'TRUE' : 'FALSE'}\n  );\nEND;\n/`;
          } else {
            source = `-- No se encontró configuración del Scheduler Job ${upperName}`;
          }
        } catch (jobError: any) {
          source = `-- Error al consultar configuración del Scheduler Job ${upperName}: ${jobError.message}`;
        }
      } else {
        // Fallback for PL/SQL code: Query USER_SOURCE / ALL_SOURCE
        try {
          const srcSql = schema
            ? `
              SELECT text 
              FROM all_source 
              WHERE name = :name AND type = :type AND owner = :owner
              ORDER BY line
            `
            : `
              SELECT text 
              FROM user_source 
              WHERE name = :name AND type = :type 
              ORDER BY line
            `;

          const srcBinds: any = {
            name: upperName,
            type: originalType
          };
          if (schema) {
            srcBinds.owner = schema.toUpperCase();
          }

          const srcResult = await executeOracleQuery(connection, srcSql, srcBinds);
          
          if (srcResult.rows && srcResult.rows.length > 0) {
            const lines = srcResult.rows.map((row: any) => row.TEXT || row.text || '');
            source = lines.join('');
          } else {
            source = `-- No se encontró código fuente para ${originalType} ${upperName}`;
          }
        } catch (srcError: any) {
          source = `-- Error al obtener código fuente para ${originalType} ${upperName}: ${srcError.message}`;
        }
      }
    }

    // Clean source code: trim whitespace, remove EDITIONABLE/NONEDITIONABLE and schema prefixes
    if (source) {
      source = source.trim();
      // Remove EDITIONABLE / NONEDITIONABLE keywords (case insensitive, whole word)
      source = source.replace(/\bEDITIONABLE\b\s*/gi, '');
      source = source.replace(/\bNONEDITIONABLE\b\s*/gi, '');

      // Remove schema prefixes (e.g. "SCHEMA". or SCHEMA.)
      const targetSchema = schema || connection.user;
      if (targetSchema) {
        const escapedSchema = targetSchema.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const schemaRegex = new RegExp(`(?:"${escapedSchema}"|${escapedSchema})\\s*\\.\\s*`, 'gi');
        source = source.replace(schemaRegex, '');
      }

      // Truncate PACKAGE BODY if compiling PACKAGE spec
      if (originalType === 'PACKAGE') {
        const bodyRegex = /\bCREATE\s+(?:OR\s+REPLACE\s+)?PACKAGE\s+BODY\b/i;
        const match = source.match(bodyRegex);
        if (match && match.index !== undefined) {
          source = source.substring(0, match.index).trim();
        }
      }

      // Unquote and lowercase the object name
      const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const quotedRegex = new RegExp(`"${escapedName}"`, 'gi');
      source = source.replace(quotedRegex, name.toLowerCase());

      const wordRegex = new RegExp(`\\b${escapedName}\\b`, 'gi');
      source = source.replace(wordRegex, name.toLowerCase());
    }

    return NextResponse.json({ success: true, source });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error retrieving object source' },
      { status: 500 }
    );
  }
}
