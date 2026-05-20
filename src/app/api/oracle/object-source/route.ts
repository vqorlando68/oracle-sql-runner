import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection, name, type } = body;

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
    }

    let source = '';

    // 1. Try DBMS_METADATA.GET_DDL first
    try {
      const ddlSql = `SELECT DBMS_METADATA.GET_DDL(:type, :name) AS ddl FROM DUAL`;
      const ddlResult = await executeOracleQuery(connection, ddlSql, {
        type: ddlType,
        name: upperName
      });
      
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
          const colSql = `
            SELECT column_name, data_type, data_length, nullable
            FROM user_tab_columns
            WHERE table_name = :name
            ORDER BY column_id
          `;
          const colResult = await executeOracleQuery(connection, colSql, { name: upperName });
          
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
          
          source = `${columnsComment}\nSELECT * FROM ${upperName};`;
        } catch (colError: any) {
          // Absolute fallback
          source = `SELECT * FROM ${upperName};`;
        }
      } else {
        // Fallback for PL/SQL code: Query USER_SOURCE
        try {
          const srcSql = `
            SELECT text 
            FROM user_source 
            WHERE name = :name AND type = :type 
            ORDER BY line
          `;
          const srcResult = await executeOracleQuery(connection, srcSql, {
            name: upperName,
            type: originalType
          });
          
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

    return NextResponse.json({ success: true, source });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error retrieving object source' },
      { status: 500 }
    );
  }
}
