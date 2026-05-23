import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection, tables } = body;

    if (!connection || !tables || !Array.isArray(tables) || tables.length === 0) {
      return NextResponse.json({ columns: [], relations: [] });
    }

    // Build binds for dynamic IN clause
    const binds: Record<string, string> = {};
    const bindPlaceholders = tables.map((t: string, idx: number) => {
      const name = `t${idx}`;
      binds[name] = t;
      return `:${name}`;
    }).join(', ');

    // 1. Fetch columns for selected tables
    const colsSql = `
      SELECT table_name, column_name, data_type, data_length, char_length, data_precision, data_scale, nullable
      FROM user_tab_columns
      WHERE table_name IN (${bindPlaceholders})
      ORDER BY table_name, column_id
    `;
    const colsResult = await executeOracleQuery(connection, colsSql, binds);

    // 2. Fetch relationships between selected tables
    const relsSql = `
      SELECT 
          a.table_name AS from_table,
          a.column_name AS from_column,
          c.table_name AS to_table,
          c.column_name AS to_column,
          bg.constraint_name
      FROM 
          user_constraints bg
          JOIN user_cons_columns a ON bg.constraint_name = a.constraint_name
          JOIN user_cons_columns c ON bg.r_constraint_name = c.constraint_name AND a.position = c.position
      WHERE 
          bg.constraint_type = 'R'
          AND a.table_name IN (${bindPlaceholders})
          AND c.table_name IN (${bindPlaceholders})
    `;
    const relsResult = await executeOracleQuery(connection, relsSql, binds);

    // 3. Fetch indexes for selected tables
    const indexesSql = `
      SELECT 
          i.table_name,
          i.index_name,
          i.uniqueness,
          ic.column_name,
          ic.column_position,
          ic.descend
      FROM 
          user_indexes i
          JOIN user_ind_columns ic ON i.index_name = ic.index_name AND i.table_name = ic.table_name
      WHERE 
          i.table_name IN (${bindPlaceholders})
      ORDER BY 
          i.table_name, i.index_name, ic.column_position
    `;
    const indexesResult = await executeOracleQuery(connection, indexesSql, binds);

    // 4. Fetch Primary Keys for selected tables
    const pksSql = `
      SELECT 
          cc.table_name,
          cc.column_name,
          c.constraint_name
      FROM 
          user_constraints c
          JOIN user_cons_columns cc ON c.constraint_name = cc.constraint_name
      WHERE 
          c.constraint_type = 'P'
          AND c.table_name IN (${bindPlaceholders})
      ORDER BY 
          cc.table_name, cc.position
    `;
    const pksResult = await executeOracleQuery(connection, pksSql, binds);

    // Normalize property keys for compatibility (uppercase/lowercase)
    const columns = (colsResult.rows || []).map((row: any) => {
      const tableName = row.TABLE_NAME || row.table_name;
      const columnName = row.COLUMN_NAME || row.column_name;
      let dataType = row.DATA_TYPE || row.data_type || '';
      const nullable = row.NULLABLE || row.nullable;

      const dataLength = row.DATA_LENGTH !== undefined ? row.DATA_LENGTH : row.data_length;
      const charLength = row.CHAR_LENGTH !== undefined ? row.CHAR_LENGTH : row.char_length;
      const dataPrecision = row.DATA_PRECISION !== undefined ? row.DATA_PRECISION : row.data_precision;
      const dataScale = row.DATA_SCALE !== undefined ? row.DATA_SCALE : row.data_scale;

      const dataTypeUpper = dataType.toUpperCase();
      if (['VARCHAR2', 'VARCHAR', 'NVARCHAR2', 'CHAR', 'NCHAR'].includes(dataTypeUpper)) {
        const len = charLength || dataLength;
        if (len) {
          dataType = `${dataType}(${len})`;
        }
      } else if (dataTypeUpper === 'NUMBER') {
        if (dataPrecision !== null && dataPrecision !== undefined) {
          if (dataScale !== null && dataScale !== undefined && dataScale > 0) {
            dataType = `${dataType}(${dataPrecision},${dataScale})`;
          } else {
            dataType = `${dataType}(${dataPrecision})`;
          }
        }
      } else if (['RAW'].includes(dataTypeUpper)) {
        if (dataLength) {
          dataType = `${dataType}(${dataLength})`;
        }
      }

      return {
        tableName,
        columnName,
        dataType,
        nullable
      };
    });

    const relations = (relsResult.rows || []).map((row: any) => ({
      fromTable: row.FROM_TABLE || row.from_table,
      fromColumn: row.FROM_COLUMN || row.from_column,
      toTable: row.TO_TABLE || row.to_table,
      toColumn: row.TO_COLUMN || row.to_column,
      constraintName: row.CONSTRAINT_NAME || row.constraint_name
    }));

    const indexes = (indexesResult.rows || []).map((row: any) => ({
      tableName: row.TABLE_NAME || row.table_name,
      indexName: row.INDEX_NAME || row.index_name,
      uniqueness: row.UNIQUENESS || row.uniqueness,
      columnName: row.COLUMN_NAME || row.column_name,
      columnPosition: row.COLUMN_POSITION || row.column_position,
      descend: row.DESCEND || row.descend
    }));

    const primaryKeys = (pksResult.rows || []).map((row: any) => ({
      tableName: row.TABLE_NAME || row.table_name,
      columnName: row.COLUMN_NAME || row.column_name,
      constraintName: row.CONSTRAINT_NAME || row.constraint_name
    }));

    // 5. Fetch Triggers for selected tables
    let triggers: any[] = [];
    try {
      const triggersSql = `
        SELECT table_name, trigger_name
        FROM user_triggers
        WHERE table_name IN (${bindPlaceholders})
        ORDER BY table_name, trigger_name
      `;
      const triggersResult = await executeOracleQuery(connection, triggersSql, binds);
      const rows = triggersResult.rows || [];
      
      for (const r of rows) {
        const tableName = r.TABLE_NAME || r.table_name;
        const triggerName = r.TRIGGER_NAME || r.trigger_name;
        let triggerDdl = '';
        try {
          const ddlSql = `SELECT DBMS_METADATA.GET_DDL('TRIGGER', :triggerName) AS ddl FROM DUAL`;
          const ddlResult = await executeOracleQuery(connection, ddlSql, { triggerName });
          triggerDdl = ddlResult.rows?.[0]?.DDL || ddlResult.rows?.[0]?.ddl || '';
        } catch (err: any) {
          triggerDdl = `-- Trigger DDL for ${triggerName} could not be retrieved: ${err.message}`;
        }
        triggers.push({ tableName, triggerName, triggerDdl });
      }
    } catch (error: any) {
      console.warn('Failed to fetch triggers', error.message);
    }

    return NextResponse.json({ success: true, columns, relations, indexes, primaryKeys, triggers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching table metadata' },
      { status: 500 }
    );
  }
}
