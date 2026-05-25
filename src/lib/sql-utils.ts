export interface StatementInfo {
  text: string;
  startLine: number;
  endLine: number;
}

/**
 * Scans forward to find the next alphanumeric word or symbol, skipping comments,
 * strings, and whitespace.
 */
function getNextWord(text: string, startIndex: number): string {
  let i = startIndex;
  let inComment: 'single-line' | 'multi-line' | null = null;
  let inString: string | null = null;
  
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inComment === 'single-line') {
      if (char === '\n') inComment = null;
      i++;
      continue;
    }
    if (inComment === 'multi-line') {
      if (char === '*' && nextChar === '/') {
        inComment = null;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (inString) {
      if (char === inString) {
        if (nextChar === inString) {
          i += 2;
        } else {
          inString = null;
          i++;
        }
      } else {
        i++;
      }
      continue;
    }
    
    // Check for comment start
    if (char === '-' && nextChar === '-') {
      inComment = 'single-line';
      i += 2;
      continue;
    }
    if (char === '/' && nextChar === '*') {
      inComment = 'multi-line';
      i += 2;
      continue;
    }
    
    // Check for string start
    if (char === "'" || char === '"') {
      inString = char;
      i++;
      continue;
    }
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    // Check for word characters
    if (/[a-zA-Z0-9_]/.test(char)) {
      let word = '';
      while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
        word += text[i];
        i++;
      }
      return word.toUpperCase();
    }
    
    // If it's a symbol like ;, /, etc.
    return char;
  }
  return '';
}

/**
 * Splits a SQL/PLSQL script into individual statements with start/end lines.
 * Supports nesting level checking for BEGIN/END PL/SQL blocks and standalone '/'.
 */
export function parseStatements(text: string): StatementInfo[] {
  const statements: StatementInfo[] = [];
  if (!text.trim()) return statements;

  let currentLines: string[] = [];
  let currentStartLine = 1;
  let currentLine = 1;
  
  let inString: string | null = null;
  let inComment: 'single-line' | 'multi-line' | null = null;
  
  let inPlSqlBlock = false;
  let hasBeginBeenSeen = false;
  let nestingLevel = 0;
  
  const lines = text.split('\n');
  
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();
    currentLine = lineIdx + 1;
    
    // Check if the line is a standalone slash `/`
    if (!inString && !inComment && trimmed === '/') {
      if (currentLines.length > 0) {
        const stmtText = currentLines.join('\n').trim();
        if (stmtText) {
          statements.push({
            text: stmtText,
            startLine: currentStartLine,
            endLine: currentLine - 1
          });
        }
        currentLines = [];
      }
      inPlSqlBlock = false;
      hasBeginBeenSeen = false;
      nestingLevel = 0;
      currentStartLine = currentLine + 1;
      continue;
    }
    
    let lineStartIdx = 0;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (inComment === 'single-line') {
        break; 
      }
      
      if (inComment === 'multi-line') {
        if (char === '*' && nextChar === '/') {
          inComment = null;
          i += 2;
        } else {
          i++;
        }
        continue;
      }
      
      if (inString) {
        if (char === inString) {
          if (nextChar === inString) {
            i += 2;
          } else {
            inString = null;
            i++;
          }
        } else {
          i++;
        }
        continue;
      }
      
      if (char === '-' && nextChar === '-') {
        inComment = 'single-line';
        i += 2;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inComment = 'multi-line';
        i += 2;
        continue;
      }
      
      if (char === "'" || char === '"') {
        inString = char;
        i++;
        continue;
      }
      
      // We check at word boundaries
      if (i === 0 || !/[a-zA-Z0-9_]/.test(line[i - 1])) {
        const remainingInLine = line.slice(i);
        
        if (!inPlSqlBlock) {
          if (/^(DECLARE|BEGIN)\b/i.test(remainingInLine)) {
            inPlSqlBlock = true;
            if (/^BEGIN\b/i.test(remainingInLine)) {
              hasBeginBeenSeen = true;
              nestingLevel = 1;
            } else {
              hasBeginBeenSeen = false;
              nestingLevel = 0;
            }
          } else if (/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:EDITIONABLE|NONEDITIONABLE|FORCE|NO\s+FORCE)\s+)*(PROCEDURE|FUNCTION|PACKAGE|TRIGGER|TYPE)\b/i.test(remainingInLine)) {
            inPlSqlBlock = true;
            hasBeginBeenSeen = false;
            nestingLevel = 0;
          }
        } else {
          if (/^BEGIN\b/i.test(remainingInLine)) {
            hasBeginBeenSeen = true;
            nestingLevel++;
          } else if (/^END\b/i.test(remainingInLine)) {
            // Check next word in the entire remaining text
            let absoluteIndex = 0;
            for (let l = 0; l < lineIdx; l++) {
              absoluteIndex += lines[l].length + 1;
            }
            absoluteIndex += i + 3; // position after 'END'
            
            const nextWord = getNextWord(text, absoluteIndex);
            const ignoreList = ['IF', 'LOOP', 'CASE', 'RECORD'];
            if (!ignoreList.includes(nextWord)) {
              nestingLevel = Math.max(0, nestingLevel - 1);
            }
          }
        }
      }
      
      // Semicolon splitting for non-PL/SQL
      if (char === ';' && !inPlSqlBlock) {
        const currentLineText = line.slice(lineStartIdx, i);
        if (currentLineText.trim() || currentLines.length > 0) {
          currentLines.push(currentLineText);
        }
        
        const stmtText = currentLines.join('\n').trim();
        const cleaned = stmtText.replace(/;\s*$/, '').trim();
        if (cleaned) {
          statements.push({
            text: cleaned,
            startLine: currentStartLine,
            endLine: currentLine
          });
        }
        currentLines = [];
        currentStartLine = currentLine;
        lineStartIdx = i + 1;
        i++;
        continue;
      }
      
      // PL/SQL block ending at semicolon when nestingLevel is 0
      if (char === ';' && inPlSqlBlock && hasBeginBeenSeen && nestingLevel === 0) {
        const currentLineText = line.slice(lineStartIdx, i + 1); // Include semicolon
        currentLines.push(currentLineText);
        
        const stmtText = currentLines.join('\n').trim();
        if (stmtText) {
          statements.push({
            text: stmtText,
            startLine: currentStartLine,
            endLine: currentLine
          });
        }
        currentLines = [];
        inPlSqlBlock = false;
        hasBeginBeenSeen = false;
        currentStartLine = currentLine + 1;
        lineStartIdx = i + 1;
        i++;
        continue;
      }
      
      i++;
    }
    
    // Add the remaining part of the line if any
    if (inComment === 'single-line') {
      inComment = null;
    }
    const remainingLineText = line.slice(lineStartIdx);
    if (remainingLineText.trim() !== '' || currentLines.length > 0) {
      currentLines.push(remainingLineText);
    }
  }
  
  // Push any remaining text
  if (currentLines.length > 0) {
    const stmtText = currentLines.join('\n').trim();
    if (stmtText) {
      const cleaned = inPlSqlBlock ? stmtText : stmtText.replace(/;\s*$/, '').trim();
      if (cleaned) {
        statements.push({
          text: cleaned,
          startLine: currentStartLine,
          endLine: lines.length
        });
      }
    }
  }
  
  return statements;
}

/**
 * Given the full editor text and a 1-based line number,
 * returns the single SQL statement surrounding that line.
 */
export function getStatementAtCursor(text: string, cursorLine: number): string {
  const statements = parseStatements(text);
  if (statements.length === 0) return '';
  
  // Find the statement that contains cursorLine
  for (const stmt of statements) {
    if (cursorLine >= stmt.startLine && cursorLine <= stmt.endLine) {
      return stmt.text;
    }
  }

  // Fallback: if cursor is between statements, find the nearest previous
  let nearest = '';
  for (const stmt of statements) {
    if (stmt.endLine <= cursorLine) {
      nearest = stmt.text;
    }
  }

  // If nothing before, try the first statement after
  if (!nearest && statements.length > 0) {
    for (const stmt of statements) {
      if (stmt.startLine >= cursorLine) {
        nearest = stmt.text;
        break;
      }
    }
  }

  return nearest || statements[0].text;
}

/**
 * Splits a SQL script into individual statements.
 */
export function splitStatements(text: string): string[] {
  return parseStatements(text).map(s => s.text);
}
