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
      SELECT table_name, column_name, data_type, nullable
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

    // Normalize property keys for compatibility (uppercase/lowercase)
    const columns = (colsResult.rows || []).map((row: any) => ({
      tableName: row.TABLE_NAME || row.table_name,
      columnName: row.COLUMN_NAME || row.column_name,
      dataType: row.DATA_TYPE || row.data_type,
      nullable: row.NULLABLE || row.nullable
    }));

    const relations = (relsResult.rows || []).map((row: any) => ({
      fromTable: row.FROM_TABLE || row.from_table,
      fromColumn: row.FROM_COLUMN || row.from_column,
      toTable: row.TO_TABLE || row.to_table,
      toColumn: row.TO_COLUMN || row.to_column,
      constraintName: row.CONSTRAINT_NAME || row.constraint_name
    }));

    return NextResponse.json({ success: true, columns, relations });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching table metadata' },
      { status: 500 }
    );
  }
}
