import { NextResponse } from 'next/server';
import { commitSession } from '@/lib/db';

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

    await commitSession(connection);
    return NextResponse.json({ success: true, message: 'COMMIT exitoso' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al ejecutar COMMIT' },
      { status: 500 }
    );
  }
}
