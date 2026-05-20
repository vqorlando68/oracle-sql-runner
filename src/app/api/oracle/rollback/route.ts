import { NextResponse } from 'next/server';
import { rollbackSession } from '@/lib/db';

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

    await rollbackSession(connection);
    return NextResponse.json({ success: true, message: 'ROLLBACK exitoso' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al ejecutar ROLLBACK' },
      { status: 500 }
    );
  }
}
