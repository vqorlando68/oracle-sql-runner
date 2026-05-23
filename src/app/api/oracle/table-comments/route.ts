import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connection, tableName } = body;

    if (!connection || !tableName) {
      return NextResponse.json(
        { error: 'Connection and Table Name are required' },
        { status: 400 }
      );
    }

    // 1. Fetch table comment
    const tableCommentSql = `
      SELECT comments 
      FROM user_tab_comments 
      WHERE table_name = :tableName
    `;
    const tableCommentResult = await executeOracleQuery(connection, tableCommentSql, { tableName });
    const tableComment = tableCommentResult.rows?.[0]?.COMMENTS || tableCommentResult.rows?.[0]?.comments || null;

    // 2. Fetch column comments
    const columnCommentsSql = `
      SELECT column_name, comments 
      FROM user_col_comments 
      WHERE table_name = :tableName AND comments IS NOT NULL
    `;
    const columnCommentsResult = await executeOracleQuery(connection, columnCommentsSql, { tableName });
    
    const columnComments = (columnCommentsResult.rows || []).map((row: any) => ({
      columnName: row.COLUMN_NAME || row.column_name,
      comment: row.COMMENTS || row.comments
    }));

    return NextResponse.json({
      success: true,
      tableComment,
      columnComments
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching comments metadata' },
      { status: 500 }
    );
  }
}
