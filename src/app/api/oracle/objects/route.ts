import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection } = body;

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection is required' },
        { status: 400 }
      );
    }

    const sql = `
      SELECT object_name, object_type, status 
      FROM user_objects 
      WHERE object_type IN ('TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER')
      ORDER BY object_type, object_name
    `;

    const result = await executeOracleQuery(connection, sql);
    
    // Group objects by type
    const grouped: Record<string, { name: string; status: string }[]> = {
      TABLE: [],
      VIEW: [],
      PROCEDURE: [],
      FUNCTION: [],
      PACKAGE: [],
      'PACKAGE BODY': [],
      TRIGGER: []
    };

    if (result.rows && Array.isArray(result.rows)) {
      result.rows.forEach((row: any) => {
        // Oracle returns rows as objects (due to OUT_FORMAT_OBJECT)
        const name = row.OBJECT_NAME || row.object_name;
        const type = row.OBJECT_TYPE || row.object_type;
        const status = row.STATUS || row.status || 'VALID';
        
        if (name && type && grouped[type] !== undefined) {
          grouped[type].push({ name, status });
        }
      });
    }

    return NextResponse.json({ success: true, objects: grouped });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error listing database objects' },
      { status: 500 }
    );
  }
}
