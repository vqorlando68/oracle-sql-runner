import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection, sql, binds, bindTypes, enableDbmsOutput, autoCommit, offset, limit } = body;

    if (!connection || !sql) {
      return NextResponse.json(
        { error: 'Connection and SQL are required' },
        { status: 400 }
      );
    }

    // Restore Date objects from JSON strings if bindTypes specifies date or timestamp
    const processedBinds = { ...(binds || {}) };
    if (bindTypes) {
      Object.keys(bindTypes).forEach(key => {
        if ((bindTypes[key] === 'date' || bindTypes[key] === 'timestamp') && processedBinds[key]) {
          processedBinds[key] = new Date(processedBinds[key]);
        }
      });
    }

    const result = await executeOracleQuery(connection, sql, processedBinds, enableDbmsOutput, bindTypes, autoCommit, offset, limit);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
