import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
    const { connection } = body;

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection is required' },
        { status: 400 }
      );
    }

    const sql = `SELECT username FROM all_users ORDER BY username`;
    const result = await executeOracleQuery(connection, sql, {});

    const schemas: string[] = [];
    if (result.rows && Array.isArray(result.rows)) {
      result.rows.forEach((row: any) => {
        const username = row.USERNAME || row.username;
        if (username) {
          schemas.push(username.toUpperCase());
        }
      });
    }

    // Fallback if list is empty, include at least the connection user
    if (schemas.length === 0 && connection.user) {
      schemas.push(connection.user.toUpperCase());
    }

    // Remove duplicates and sort
    const uniqueSchemas = Array.from(new Set(schemas)).sort();

    return NextResponse.json({ success: true, schemas: uniqueSchemas });
  } catch (error: any) {
    console.error('Error fetching database schemas:', error);
    // If query fails, fallback to the connection user
    const fallbackSchemas = body.connection?.user ? [body.connection.user.toUpperCase()] : [];
    return NextResponse.json({ success: true, schemas: fallbackSchemas });
  }
}
