import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection } = body;

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection data is required' },
        { status: 400 }
      );
    }

    // A simple query to test connection
    const result = await executeOracleQuery(connection, 'SELECT 1 AS TEST FROM DUAL', {});
    
    if (result && result.rows) {
      return NextResponse.json({ success: true, message: 'Connection successful!' });
    } else {
      throw new Error('Unknown connection error');
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Connection failed' },
      { status: 500 }
    );
  }
}
