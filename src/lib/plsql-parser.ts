export interface OutlineNode {
  id: string;
  label: string;
  type: 'package' | 'folder' | 'declaration' | 'subprogram' | 'parameter';
  line: number;
  children?: OutlineNode[];
}

export function generatePlsqlOutline(code: string): OutlineNode[] {
  if (!code) return [];
  
  const lines = code.split(/\r?\n/);
  const outline: OutlineNode[] = [];
  
  // Basic tree nodes
  let packageNode: OutlineNode | null = null;
  const declarationsFolder: OutlineNode = { id: 'pkg-decls', label: 'Declarations', type: 'folder', line: 1, children: [] };
  const subprogramsFolder: OutlineNode = { id: 'pkg-subs', label: 'Local Subprograms', type: 'folder', line: 1, children: [] };
  
  let currentSubprogram: OutlineNode | null = null;
  let currentSubprogramParamsFolder: OutlineNode | null = null;
  let currentSubprogramDeclsFolder: OutlineNode | null = null;
  
  // Parsing states
  let insidePackage = false;
  let insideSubprogram = false;
  let inParamsSection = false;
  let inDeclsSection = false;
  let inPkgDeclsSection = false;
  let waitingForIsAs = false;
  let subprogramParenthesisCount = 0;
  
  // Basic multiline comment skip
  let inMultilineComment = false;

  const cleanLine = (lineStr: string) => {
    let s = lineStr.trim();
    // remove single line comments
    s = s.replace(/--.*$/, '').trim();
    return s;
  };

  const excludedKeywords = ['CONSTANT', 'CURSOR', 'TYPE', 'EXCEPTION', 'PROCEDURE', 'FUNCTION', 'BEGIN', 'END', 'RETURN', 'PRAGMA', 'DECLARE', 'IF', 'LOOP', 'ELSE', 'ELSIF', 'WHILE', 'FOR'];

  const finalizeSubprogram = () => {
    if (currentSubprogram && currentSubprogram.children) {
      if (currentSubprogramParamsFolder && currentSubprogramParamsFolder.children && currentSubprogramParamsFolder.children.length > 0) {
        const hasParams = currentSubprogram.children.some(c => c.id.startsWith('params-'));
        if (!hasParams) {
          currentSubprogram.children.push(currentSubprogramParamsFolder);
        }
      }
      if (currentSubprogramDeclsFolder && currentSubprogramDeclsFolder.children && currentSubprogramDeclsFolder.children.length > 0) {
        const hasDecls = currentSubprogram.children.some(c => c.id.startsWith('decls-'));
        if (!hasDecls) {
          currentSubprogram.children.push(currentSubprogramDeclsFolder);
        }
      }
    }
    currentSubprogramParamsFolder = null;
    currentSubprogramDeclsFolder = null;
    insideSubprogram = false;
  };

  const parseParamsFromLine = (text: string, lineNum: number) => {
    const cleanParamLine = text.replace(/[()]/g, ' ').trim();
    const paramParts = cleanParamLine.split(',');
    paramParts.forEach(part => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return;
      
      const match = trimmedPart.match(/^(\w+)\s+((?:IN\s+OUT|IN|OUT|NOCOPY|\s+)+)?\s*([\w%.#$]+(?:\s*\(.*\))?)/i);
      if (match) {
        const pName = match[1];
        const pMode = (match[2] || 'IN').trim().replace(/\s+/g, ' ').toLowerCase();
        const pType = match[3];
        if (currentSubprogramParamsFolder && currentSubprogramParamsFolder.children) {
          const exists = currentSubprogramParamsFolder.children.some(c => c.label.startsWith(`${pName}:`));
          if (!exists) {
            currentSubprogramParamsFolder.children.push({
              id: `param-${pName}-${lineNum}`,
              label: `${pName}: ${pMode} ${pType}`,
              type: 'parameter',
              line: lineNum
            });
          }
        }
      }
    });
  };

  const parseDeclFromLine = (text: string, lineNum: number) => {
    const declMatch = text.match(/^(\w+)\s+([\w%.#$]+(?:\s*\(.*\))?)(?:\s*:=.*)?;/i);
    if (declMatch) {
      const dName = declMatch[1];
      const dType = declMatch[2];
      const upperName = dName.toUpperCase();
      
      if (!excludedKeywords.includes(upperName)) {
        if (currentSubprogramDeclsFolder && currentSubprogramDeclsFolder.children) {
          const exists = currentSubprogramDeclsFolder.children.some(c => c.label.startsWith(`${dName}:`));
          if (!exists) {
            currentSubprogramDeclsFolder.children.push({
              id: `decl-${dName}-${lineNum}`,
              label: `${dName}: ${dType}`,
              type: 'declaration',
              line: lineNum
            });
          }
        }
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    
    // Check multiline comments
    let lineForParsing = cleanLine(rawLine);
    if (inMultilineComment) {
      const endCommentIdx = lineForParsing.indexOf('*/');
      if (endCommentIdx !== -1) {
        inMultilineComment = false;
        lineForParsing = lineForParsing.substring(endCommentIdx + 2).trim();
      } else {
        continue;
      }
    }
    
    const startCommentIdx = lineForParsing.indexOf('/*');
    if (startCommentIdx !== -1) {
      const endCommentIdx = lineForParsing.indexOf('*/', startCommentIdx + 2);
      if (endCommentIdx !== -1) {
        // inline multiline comment
        lineForParsing = (lineForParsing.substring(0, startCommentIdx) + ' ' + lineForParsing.substring(endCommentIdx + 2)).trim();
      } else {
        inMultilineComment = true;
        lineForParsing = lineForParsing.substring(0, startCommentIdx).trim();
      }
    }
    
    if (!lineForParsing) continue;
    
    const upperLine = lineForParsing.toUpperCase();
    
    // 1. Detect Package / Main Object (Procedure / Function / Trigger)
    const pkgMatch = lineForParsing.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(PACKAGE\s+BODY|PACKAGE|PROCEDURE|FUNCTION|TRIGGER)\s+("?[\w$#]+"?(?:\."?[\w$#]+"?)?)/i);
    if (pkgMatch) {
      finalizeSubprogram();
      const type = pkgMatch[1].toUpperCase();
      const rawName = pkgMatch[2];
      const name = rawName.replace(/"/g, '').split('.').pop() || rawName;
      
      packageNode = {
        id: `pkg-${name}-${lineNum}`,
        label: name,
        type: 'package',
        line: lineNum,
        children: []
      };
      outline.push(packageNode);
      
      if (type.includes('PACKAGE')) {
        insidePackage = true;
        inPkgDeclsSection = true; // start collecting package-level declarations
      } else {
        // It's a single procedure/function/trigger
        currentSubprogram = packageNode; // treat the packageNode as the current subprogram
        currentSubprogramParamsFolder = { id: `params-${name}-${lineNum}`, label: 'Parameters', type: 'folder', line: lineNum, children: [] };
        currentSubprogramDeclsFolder = { id: `decls-${name}-${lineNum}`, label: 'Declarations', type: 'folder', line: lineNum, children: [] };
        insideSubprogram = true;
        inParamsSection = false;
        inDeclsSection = false;
        waitingForIsAs = false;
        
        if (lineForParsing.includes('(')) {
          const openParens = (lineForParsing.match(/\(/g) || []).length;
          const closeParens = (lineForParsing.match(/\)/g) || []).length;
          subprogramParenthesisCount = openParens - closeParens;
          
          if (subprogramParenthesisCount > 0) {
            inParamsSection = true;
          } else {
            // closed on same line
            const endIdx = lineForParsing.lastIndexOf(')');
            const afterParens = lineForParsing.substring(endIdx + 1);
            if (/\b(IS|AS)\b/i.test(afterParens)) {
              inDeclsSection = true;
            } else {
              waitingForIsAs = true;
            }
          }
        } else if (/\b(IS|AS)\b/i.test(upperLine)) {
          inDeclsSection = true;
        } else {
          waitingForIsAs = true;
        }
      }
      continue;
    }
    
    // 2. Detect Subprograms (Procedures & Functions) inside Package
    const subMatch = lineForParsing.match(/^(?:CREATE\s+(?:OR\s+REPLACE\s+)?)?(PROCEDURE|FUNCTION)\s+(\w+)/i);
    if (subMatch) {
      finalizeSubprogram();
      const subName = subMatch[2];
      
      currentSubprogram = {
        id: `sub-${subName}-${lineNum}`,
        label: subName,
        type: 'subprogram',
        line: lineNum,
        children: []
      };
      
      currentSubprogramParamsFolder = { id: `params-${subName}-${lineNum}`, label: 'Parameters', type: 'folder', line: lineNum, children: [] };
      currentSubprogramDeclsFolder = { id: `decls-${subName}-${lineNum}`, label: 'Declarations', type: 'folder', line: lineNum, children: [] };
      
      if (packageNode) {
        if (!subprogramsFolder.children) subprogramsFolder.children = [];
        subprogramsFolder.children.push(currentSubprogram);
      } else {
        outline.push(currentSubprogram);
      }
      
      insideSubprogram = true;
      inPkgDeclsSection = false;
      inParamsSection = false;
      inDeclsSection = false;
      waitingForIsAs = false;
      
      if (lineForParsing.includes('(')) {
        const openParens = (lineForParsing.match(/\(/g) || []).length;
        const closeParens = (lineForParsing.match(/\)/g) || []).length;
        subprogramParenthesisCount = openParens - closeParens;
        
        if (subprogramParenthesisCount > 0) {
          inParamsSection = true;
          // parse params on first line
          const startIdx = lineForParsing.indexOf('(');
          const firstLineParams = lineForParsing.substring(startIdx + 1);
          parseParamsFromLine(firstLineParams, lineNum);
        } else {
          inParamsSection = false;
          // parse params
          const startIdx = lineForParsing.indexOf('(');
          const endIdx = lineForParsing.lastIndexOf(')');
          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            parseParamsFromLine(lineForParsing.substring(startIdx + 1, endIdx), lineNum);
          }
          
          const afterParens = lineForParsing.substring(endIdx + 1);
          if (/\b(IS|AS)\b/i.test(afterParens)) {
            inDeclsSection = true;
          } else {
            waitingForIsAs = true;
          }
        }
      } else if (/\b(IS|AS)\b/i.test(upperLine)) {
        inDeclsSection = true;
      } else {
        waitingForIsAs = true;
      }
      continue;
    }
    
    // 3. Handle waiting for IS/AS
    if (insideSubprogram && waitingForIsAs) {
      if (/\b(IS|AS)\b/i.test(upperLine)) {
        inDeclsSection = true;
        waitingForIsAs = false;
        // Check if there are any declarations after IS/AS on the same line
        const parts = lineForParsing.split(/\b(?:IS|AS)\b/i);
        if (parts.length > 1 && parts[1].trim()) {
          parseDeclFromLine(parts[1].trim(), lineNum);
        }
        continue;
      }
    }
    
    // 4. Handle parameter section
    if (insideSubprogram && inParamsSection) {
      const openParens = (lineForParsing.match(/\(/g) || []).length;
      const closeParens = (lineForParsing.match(/\)/g) || []).length;
      subprogramParenthesisCount += openParens - closeParens;
      
      let paramTextToParse = lineForParsing;
      if (subprogramParenthesisCount <= 0) {
        inParamsSection = false;
        // Only parse up to the closing parenthesis
        const lastCloseIdx = lineForParsing.lastIndexOf(')');
        if (lastCloseIdx !== -1) {
          paramTextToParse = lineForParsing.substring(0, lastCloseIdx);
        }
        
        // Now check for IS/AS after the closing parenthesis
        const afterParens = lastCloseIdx !== -1 ? lineForParsing.substring(lastCloseIdx + 1) : '';
        if (/\b(IS|AS)\b/i.test(afterParens)) {
          inDeclsSection = true;
        } else {
          waitingForIsAs = true;
        }
      }
      
      parseParamsFromLine(paramTextToParse, lineNum);
      continue;
    }
    
    // 5. Handle declarations section inside subprogram (IS/AS ... BEGIN)
    if (insideSubprogram && inDeclsSection) {
      if (/\bBEGIN\b/i.test(upperLine)) {
        finalizeSubprogram();
        continue;
      }
      
      parseDeclFromLine(lineForParsing, lineNum);
      continue;
    }
    
    // 6. Handle package level declarations
    if (insidePackage && inPkgDeclsSection) {
      if (/\b(PROCEDURE|FUNCTION)\b/i.test(upperLine)) {
        inPkgDeclsSection = false;
      } else {
        const declMatch = lineForParsing.match(/^(\w+)\s+([\w%.#$]+(?:\s*\(.*\))?)(?:\s*:=.*)?;/i);
        if (declMatch) {
          const dName = declMatch[1];
          const dType = declMatch[2];
          const upperName = dName.toUpperCase();
          
          if (!excludedKeywords.includes(upperName)) {
            if (!declarationsFolder.children) declarationsFolder.children = [];
            declarationsFolder.children.push({
              id: `pkg-decl-${dName}-${lineNum}`,
              label: `${dName}: ${dType}`,
              type: 'declaration',
              line: lineNum
            });
          }
        }
      }
    }
  }
  
  finalizeSubprogram();
  
  // Attach package folders at end
  if (packageNode && packageNode.children) {
    if (declarationsFolder.children && declarationsFolder.children.length > 0) {
      packageNode.children.push(declarationsFolder);
    }
    if (subprogramsFolder.children && subprogramsFolder.children.length > 0) {
      packageNode.children.push(subprogramsFolder);
    }
  }
  
  return outline;
}
