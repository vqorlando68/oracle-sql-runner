import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
    const { connection, schema, tableName } = body;

    if (!connection || !tableName) {
      return NextResponse.json(
        { error: 'Connection and table name are required' },
        { status: 400 }
      );
    }

    const currentSchema = schema?.trim() || connection.user;

    const sql = `
      SELECT column_name, data_type, data_length, char_length, data_precision, data_scale, nullable
      FROM all_tab_columns
      WHERE owner = :schema AND table_name = :tableName
      ORDER BY column_id
    `;

    const binds = {
      schema: currentSchema.toUpperCase(),
      tableName: tableName.toUpperCase()
    };

    const result = await executeOracleQuery(connection, sql, binds);

    const columns = (result.rows || []).map((row: any) => {
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
        columnName,
        dataType,
        nullable: nullable === 'Y'
      };
    });

    return NextResponse.json({ success: true, columns });
  } catch (error: any) {
    console.error('Error fetching table columns:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching table columns' },
      { status: 500 }
    );
  }
}
