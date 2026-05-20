/**
 * Given the full editor text and a 1-based line number,
 * returns the single SQL statement surrounding that line.
 *
 * Statements are delimited by `;` or standalone `/` on a line.
 * PL/SQL blocks (BEGIN…END, DECLARE…BEGIN…END, CREATE … AS/IS … END)
 * are treated as a single statement terminated by `/` on its own line.
 */
export function getStatementAtCursor(text: string, cursorLine: number): string {
  if (!text.trim()) return '';

  const lines = text.split(/\r?\n/);
  // Build an array of { startLine, endLine, text } for each statement
  const statements: { startLine: number; endLine: number; text: string }[] = [];

  let currentLines: string[] = [];
  let startLine = 1;
  let inPlSqlBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // Detect PL/SQL block start
    if (!inPlSqlBlock) {
      const upperTrimmed = trimmed.toUpperCase();
      if (
        upperTrimmed.startsWith('BEGIN') ||
        upperTrimmed.startsWith('DECLARE') ||
        /^CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE|PACKAGE|TRIGGER|TYPE)/i.test(trimmed)
      ) {
        inPlSqlBlock = true;
      }
    }

    // Check for standalone `/` (PL/SQL block terminator)
    if (trimmed === '/') {
      if (currentLines.length > 0) {
        statements.push({
          startLine,
          endLine: lineNum - 1,
          text: currentLines.join('\n').trim()
        });
        currentLines = [];
      }
      startLine = lineNum + 1;
      inPlSqlBlock = false;
      continue;
    }

    // For non-PL/SQL, split on semicolons
    if (!inPlSqlBlock && trimmed.endsWith(';')) {
      currentLines.push(line);
      const stmtText = currentLines.join('\n').trim();
      // Remove trailing semicolon for execution
      const cleaned = stmtText.replace(/;\s*$/, '').trim();
      if (cleaned) {
        statements.push({
          startLine,
          endLine: lineNum,
          text: cleaned
        });
      }
      currentLines = [];
      startLine = lineNum + 1;
      inPlSqlBlock = false;
      continue;
    }

    // For PL/SQL blocks, a line ending with `;` after END means block end
    if (inPlSqlBlock && /^END\s*;?\s*$/i.test(trimmed)) {
      currentLines.push(line);
      const stmtText = currentLines.join('\n').trim();
      if (stmtText) {
        statements.push({
          startLine,
          endLine: lineNum,
          text: stmtText
        });
      }
      currentLines = [];
      startLine = lineNum + 1;
      inPlSqlBlock = false;
      continue;
    }

    if (currentLines.length === 0 && trimmed === '') {
      startLine = lineNum + 1;
      continue;
    }

    currentLines.push(line);
  }

  // Remaining text
  if (currentLines.length > 0) {
    const stmtText = currentLines.join('\n').trim();
    if (stmtText) {
      // Remove trailing semicolon if present
      const cleaned = stmtText.replace(/;\s*$/, '').trim();
      statements.push({
        startLine,
        endLine: lines.length,
        text: cleaned
      });
    }
  }

  // Find the statement that contains cursorLine
  for (const stmt of statements) {
    if (cursorLine >= stmt.startLine && cursorLine <= stmt.endLine) {
      return stmt.text;
    }
  }

  // Fallback: if cursor is between statements (empty lines), find the nearest previous
  let nearest = '';
  for (const stmt of statements) {
    if (stmt.endLine <= cursorLine) {
      nearest = stmt.text;
    }
  }

  // If nothing before, try the first statement after
  if (!nearest) {
    for (const stmt of statements) {
      if (stmt.startLine >= cursorLine) {
        nearest = stmt.text;
        break;
      }
    }
  }

  return nearest;
}

/**
 * Splits a SQL script into individual statements.
 * Handles PL/SQL blocks terminated by `/` and regular statements terminated by `;`.
 */
export function splitStatements(text: string): string[] {
  if (!text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const statements: string[] = [];

  let currentLines: string[] = [];
  let inPlSqlBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect PL/SQL block start
    if (!inPlSqlBlock) {
      const upperTrimmed = trimmed.toUpperCase();
      if (
        upperTrimmed.startsWith('BEGIN') ||
        upperTrimmed.startsWith('DECLARE') ||
        /^CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE|PACKAGE|TRIGGER|TYPE)/i.test(trimmed)
      ) {
        inPlSqlBlock = true;
      }
    }

    // Standalone `/`
    if (trimmed === '/') {
      if (currentLines.length > 0) {
        const stmtText = currentLines.join('\n').trim();
        if (stmtText) statements.push(stmtText);
        currentLines = [];
      }
      inPlSqlBlock = false;
      continue;
    }

    // Non-PL/SQL semicolon terminator
    if (!inPlSqlBlock && trimmed.endsWith(';')) {
      currentLines.push(line);
      const stmtText = currentLines.join('\n').trim().replace(/;\s*$/, '').trim();
      if (stmtText) statements.push(stmtText);
      currentLines = [];
      continue;
    }

    // PL/SQL END detection
    if (inPlSqlBlock && /^END\s*;?\s*$/i.test(trimmed)) {
      currentLines.push(line);
      const stmtText = currentLines.join('\n').trim();
      if (stmtText) statements.push(stmtText);
      currentLines = [];
      inPlSqlBlock = false;
      continue;
    }

    if (currentLines.length === 0 && trimmed === '') continue;

    currentLines.push(line);
  }

  // Remaining
  if (currentLines.length > 0) {
    const stmtText = currentLines.join('\n').trim().replace(/;\s*$/, '').trim();
    if (stmtText) statements.push(stmtText);
  }

  return statements;
}
