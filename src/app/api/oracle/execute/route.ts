import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection, sql, binds } = body;

    if (!connection || !sql) {
      return NextResponse.json(
        { error: 'Connection and SQL are required' },
        { status: 400 }
      );
    }

    const result = await executeOracleQuery(connection, sql, binds || {});
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
