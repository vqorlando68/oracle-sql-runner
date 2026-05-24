import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

function getObjectExtension(type: string): string {
  const t = type.toUpperCase();
  switch (t) {
    case 'TABLE': return '.tbl';
    case 'VIEW': return '.vw';
    case 'PROCEDURE': return '.prc';
    case 'FUNCTION': return '.fnc';
    case 'PACKAGE': return '.pks';
    case 'PACKAGE BODY': return '.pkb';
    case 'TRIGGER': return '.trg';
    case 'SEQUENCE': return '.seq';
    case 'SYNONYM': return '.syn';
    case 'TYPE': return '.tps';
    case 'TYPE BODY': return '.tpb';
    case 'JOB':
    case 'SCHEDULER_JOB':
    case 'SCHEDULER JOB':
      return '.job';
    default: return '.sql';
  }
}

async function getObjectSource(connection: any, name: string, type: string, schema?: string): Promise<string> {
  const upperName = name.toUpperCase();
  const originalType = type.toUpperCase();
  
  let ddlType = originalType;
  if (ddlType === 'PACKAGE BODY') {
    ddlType = 'PACKAGE_BODY';
  } else if (ddlType === 'TYPE BODY') {
    ddlType = 'TYPE_BODY';
  } else if (ddlType === 'JOB') {
    ddlType = 'PROCOBJ';
  }

  let source = '';

  // 1. Try DBMS_METADATA.GET_DDL
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
  } catch (err: any) {
    console.warn(`Backup DDL fetch failed for ${originalType} ${upperName}, using fallback:`, err.message);
  }

  // 2. Fallbacks
  if (!source || source.trim() === '') {
    if (originalType === 'TABLE' || originalType === 'VIEW') {
      try {
        const colSql = schema
          ? `SELECT column_name, data_type, data_length, nullable FROM all_tab_columns WHERE table_name = :name AND owner = :owner ORDER BY column_id`
          : `SELECT column_name, data_type, data_length, nullable FROM user_tab_columns WHERE table_name = :name ORDER BY column_id`;
        
        const colBinds: any = { name: upperName };
        if (schema) colBinds.owner = schema.toUpperCase();

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
        }
        source = `${columnsComment}\nSELECT * FROM ${schema ? `${schema.toUpperCase()}.${upperName}` : upperName};`;
      } catch {
        source = `SELECT * FROM ${schema ? `${schema.toUpperCase()}.${upperName}` : upperName};`;
      }
    } else if (originalType === 'JOB') {
      // Fallback for DBMS_SCHEDULER Jobs
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
        }
      } catch {
        // empty
      }
    } else {
      // PL/SQL fallback
      try {
        const srcSql = schema
          ? `SELECT text FROM all_source WHERE name = :name AND type = :type AND owner = :owner ORDER BY line`
          : `SELECT text FROM user_source WHERE name = :name AND type = :type ORDER BY line`;

        const srcBinds: any = { name: upperName, type: originalType };
        if (schema) srcBinds.owner = schema.toUpperCase();

        const srcResult = await executeOracleQuery(connection, srcSql, srcBinds);
        if (srcResult.rows && srcResult.rows.length > 0) {
          source = srcResult.rows.map((row: any) => row.TEXT || row.text || '').join('');
        }
      } catch {
        // empty
      }
    }
  }

  // Clean DDL/source: trim whitespace, remove EDITIONABLE/NONEDITIONABLE and schema prefixes
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

  return source;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection, schema, mode, directory, objects, filename, content } = body;

    if (!connection || !directory) {
      return NextResponse.json(
        { error: 'Connection and target directory are required' },
        { status: 400 }
      );
    }

    // Ensure directory exists
    try {
      fs.mkdirSync(directory, { recursive: true });
    } catch (dirError: any) {
      return NextResponse.json(
        { error: `No se pudo acceder o crear el directorio de destino: ${dirError.message}` },
        { status: 400 }
      );
    }

    if (mode === 'write_file') {
      if (!filename || content === undefined) {
        return NextResponse.json({ error: 'Filename and content are required' }, { status: 400 });
      }
      const fullPath = path.join(directory, filename);
      fs.writeFileSync(fullPath, content, 'utf8');
      return NextResponse.json({ success: true, message: `Archivo ${filename} guardado con éxito.` });
    }

    const finalSchema = schema || connection.user;
    const backupLogs: string[] = [];

    if (mode === 'schema') {
      // 1. Export entire schema into a single file
      const listSql = finalSchema
        ? `
          SELECT object_name, object_type 
          FROM all_objects 
          WHERE owner = :schema AND object_type IN ('TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER', 'SEQUENCE', 'SYNONYM', 'TYPE', 'TYPE BODY', 'JOB')
          ORDER BY object_type, object_name
        `
        : `
          SELECT object_name, object_type 
          FROM user_objects 
          WHERE object_type IN ('TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER', 'SEQUENCE', 'SYNONYM', 'TYPE', 'TYPE BODY', 'JOB')
          ORDER BY object_type, object_name
        `;
      
      const binds: any = {};
      if (schema) {
        binds.schema = schema.toUpperCase();
      }

      const dbObjects = await executeOracleQuery(connection, listSql, binds);
      
      if (!dbObjects.rows || dbObjects.rows.length === 0) {
        return NextResponse.json(
          { error: 'No se encontraron objetos para exportar en el esquema seleccionado.' },
          { status: 400 }
        );
      }

      let combinedSource = `-- Backup del esquema ${finalSchema.toUpperCase()}\n`;
      combinedSource += `-- Generado desde la conexión: ${connection.name}\n`;
      combinedSource += `-- Fecha: ${new Date().toLocaleString()}\n\n`;

      let successCount = 0;
      for (const row of dbObjects.rows) {
        const name = row.OBJECT_NAME || row.object_name;
        const type = row.OBJECT_TYPE || row.object_type;
        
        try {
          const ddl = await getObjectSource(connection, name, type, schema);
          if (ddl) {
            combinedSource += `-- Start of ${type} ${name}\n`;
            combinedSource += ddl;
            if (!ddl.trim().endsWith('/')) {
              combinedSource += '\n/\n';
            } else {
              combinedSource += '\n';
            }
            combinedSource += `\n`;
            successCount++;
            backupLogs.push(`Objeto exportado: ${type} ${name}`);
          }
        } catch (err: any) {
          backupLogs.push(`ERROR al exportar ${type} ${name}: ${err.message}`);
        }
      }

      // Filename format: conexion_schema_export_fecha.sql in lowercase
      const safeConn = connection.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const safeSchema = finalSchema.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const now = new Date();
      const dateStr = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
      
      const filename = `${safeConn}_${safeSchema}_export_${dateStr}.sql`.toLowerCase();
      const fullPath = path.join(directory, filename);
      
      fs.writeFileSync(fullPath, combinedSource, 'utf8');
      
      return NextResponse.json({
        success: true,
        message: `Esquema exportado en un solo archivo: ${filename}`,
        logs: backupLogs,
        filesWritten: [filename],
        count: successCount
      });
    } else {
      // 2. Export individual objects (each into its own file)
      if (!objects || !Array.isArray(objects) || objects.length === 0) {
        return NextResponse.json(
          { error: 'Debe seleccionar al menos un objeto para exportar.' },
          { status: 400 }
        );
      }

      const filesWritten: string[] = [];
      let successCount = 0;

      for (const obj of objects) {
        const { name, type } = obj;
        try {
          const ddl = await getObjectSource(connection, name, type, schema);
          
          // Filename format: name in lowercase + custom standard extension
          const filename = `${name.toLowerCase()}${getObjectExtension(type)}`;
          const fullPath = path.join(directory, filename);
          
          fs.writeFileSync(fullPath, ddl, 'utf8');
          filesWritten.push(filename);
          successCount++;
          backupLogs.push(`Guardado: ${filename} (${type})`);
        } catch (err: any) {
          backupLogs.push(`ERROR al guardar ${type} ${name}: ${err.message}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Backup de objetos finalizado. ${successCount} de ${objects.length} archivos guardados.`,
        logs: backupLogs,
        filesWritten,
        count: successCount
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error executing backup operation' },
      { status: 500 }
    );
  }
}
