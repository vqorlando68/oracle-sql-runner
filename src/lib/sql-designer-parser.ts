/**
 * Utility for parsing and compiling visual query builder designs to/from Oracle SQL.
 */

export interface ColumnDesign {
  name: string;
  dataType: string;
  isPk?: boolean;
  isFk?: boolean;
  selected: boolean;
  alias?: string;
  customExpression?: string;
}

export interface TableDesign {
  id: string; // Used as the unique alias
  name: string;
  alias: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: ColumnDesign[];
  showComments?: boolean;
  comments?: Record<string, string>;
}

export interface JoinDesign {
  id: string;
  fromTable: string; // Table instance alias
  fromColumn: string;
  toTable: string; // Table instance alias
  toColumn: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  disabled?: boolean;
  isFk?: boolean;
}

export interface WhereRule {
  type: 'rule';
  table?: string;
  column?: string;
  operator: string;
  value: string;
  value2?: string;
  valueType: 'text' | 'number' | 'date' | 'parameter';
}

export interface WhereGroup {
  type: 'group';
  conjunction: 'AND' | 'OR';
  children: Array<WhereRule | WhereGroup>;
}

export interface OrderByItem {
  table: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryBuilderDesign {
  tables: TableDesign[];
  joins: JoinDesign[];
  where: WhereGroup;
  orderBy: OrderByItem[];
  groupBy: {
    enabled: boolean;
    columns: Array<{ table: string; column: string }>;
  };
  having: WhereGroup;
  useAnsiJoin: boolean;
}

// Default initial state
export const createInitialDesign = (): QueryBuilderDesign => ({
  tables: [],
  joins: [],
  where: {
    type: 'group',
    conjunction: 'AND',
    children: []
  },
  orderBy: [],
  groupBy: {
    enabled: false,
    columns: []
  },
  having: {
    type: 'group',
    conjunction: 'AND',
    children: []
  },
  useAnsiJoin: true
});

/**
 * Format string value for Oracle SQL
 */
function formatSqlValue(val: string, type: 'text' | 'number' | 'date' | 'parameter'): string {
  if (!val) return "NULL";
  if (type === 'parameter') {
    return val.startsWith(':') ? val : `:${val}`;
  }
  if (type === 'number') {
    return val.replace(/[^0-9.-]/g, '');
  }
  if (type === 'date') {
    // Check if it's already an Oracle TO_DATE or function
    if (/^TO_DATE/i.test(val) || /^SYSDATE/i.test(val)) return val;
    // Format YYYY-MM-DD
    const cleanDate = val.split('T')[0];
    return `TO_DATE('${cleanDate}', 'YYYY-MM-DD')`;
  }
  // Standard text value - escape single quotes
  const escaped = val.replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Compile a single rule or rule group to SQL string
 */
function compileWhereItem(
  item: WhereRule | WhereGroup,
  useTableAlias = true
): string {
  if (item.type === 'group') {
    const activeChildren = item.children
      .map(child => compileWhereItem(child, useTableAlias))
      .filter(sql => sql.length > 0);

    if (activeChildren.length === 0) return '';
    if (activeChildren.length === 1) return activeChildren[0];
    return `(${activeChildren.join(` ${item.conjunction} `)})`;
  } else {
    // It's a rule
    if (!item.column) return '';
    const tablePrefix = useTableAlias && item.table ? `${item.table}.` : '';
    const field = `${tablePrefix}${item.column}`;
    const op = item.operator.toUpperCase();

    if (op === 'IS NULL' || op === 'IS NOT NULL') {
      return `${field} ${op}`;
    }

    if (op === 'BETWEEN' || op === 'NOT BETWEEN') {
      const v1 = formatSqlValue(item.value, item.valueType);
      const v2 = formatSqlValue(item.value2 || '', item.valueType);
      return `${field} ${op} ${v1} AND ${v2}`;
    }

    if (op === 'EXISTS' || op === 'NOT EXISTS') {
      return `${op} (${item.value})`;
    }

    const v = formatSqlValue(item.value, item.valueType);
    return `${field} ${item.operator} ${v}`;
  }
}

/**
 * Compile Design State into raw Oracle SQL SELECT query
 */
export function compileDesignToSql(design: QueryBuilderDesign, includeComment = false): string {
  if (design.tables.length === 0) {
    return '-- Agrega tablas desde el explorador para comenzar a diseñar tu consulta.';
  }

  const selectItems: string[] = [];

  // 1. SELECT Columns
  design.tables.forEach(tbl => {
    tbl.columns.forEach(col => {
      if (col.selected) {
        let fieldExpr = '';
        if (col.customExpression) {
          fieldExpr = col.customExpression;
        } else {
          fieldExpr = `${tbl.alias || tbl.name}.${col.name}`;
        }
        
        if (col.alias) {
          selectItems.push(`       ${fieldExpr} AS ${col.alias}`);
        } else {
          selectItems.push(`       ${fieldExpr}`);
        }
      }
    });
  });

  const selectClause = selectItems.length > 0 
    ? `SELECT\n${selectItems.join(',\n')}`
    : `SELECT\n       *`;

  // 2. FROM and JOIN clauses
  let fromClause = '';
  const classicJoinWhereConditions: string[] = [];

  if (design.useAnsiJoin) {
    // Generate ANSI Joins
    const visited = new Set<string>();
    const pendingJoins = design.joins.filter(j => !j.disabled);
    
    // Start with the first table
    const startTable = design.tables[0];
    const startIdent = startTable.alias || startTable.name;
    const startAliasStr = startTable.alias ? ` ${startTable.alias}` : '';
    fromClause = `  FROM ${startTable.name}${startAliasStr}`;
    visited.add(startIdent);

    let progress = true;
    while (progress && pendingJoins.length > 0) {
      progress = false;
      for (let i = 0; i < pendingJoins.length; i++) {
        const join = pendingJoins[i];
        
        let targetTableAlias = '';
        let sourceTableAlias = '';
        let targetCol = '';
        let sourceCol = '';
        let isReversed = false;

        if (visited.has(join.fromTable) && !visited.has(join.toTable)) {
          sourceTableAlias = join.fromTable;
          sourceCol = join.fromColumn;
          targetTableAlias = join.toTable;
          targetCol = join.toColumn;
          progress = true;
        } else if (visited.has(join.toTable) && !visited.has(join.fromTable)) {
          sourceTableAlias = join.toTable;
          sourceCol = join.toColumn;
          targetTableAlias = join.fromTable;
          targetCol = join.fromColumn;
          isReversed = true;
          progress = true;
        }

        if (progress) {
          const targetTable = design.tables.find(t => (t.alias || t.name) === targetTableAlias);
          if (targetTable) {
            const joinKeyword = `${join.joinType} JOIN`.toUpperCase();
            const targetAliasStr = targetTable.alias ? ` ${targetTable.alias}` : '';
            
            // Adjust ON condition according to join direction
            const condition = isReversed
              ? `${sourceTableAlias}.${sourceCol} = ${targetTableAlias}.${targetCol}`
              : `${sourceTableAlias}.${sourceCol} = ${targetTableAlias}.${targetCol}`;
            
            fromClause += `\n  ${joinKeyword} ${targetTable.name}${targetAliasStr} ON ${condition}`;
            visited.add(targetTableAlias);
          }
          pendingJoins.splice(i, 1);
          break;
        }
      }
    }

    // Add any remaining unjoined tables as cross joins / separated by commas
    design.tables.forEach(tbl => {
      const tblIdent = tbl.alias || tbl.name;
      if (!visited.has(tblIdent)) {
        const tblAliasStr = tbl.alias ? ` ${tbl.alias}` : '';
        fromClause += `,\n       ${tbl.name}${tblAliasStr}`;
        visited.add(tblIdent);
      }
    });

  } else {
    // Generate Classic Oracle Joins (comma separated tables + (+) operator)
    const tablesList = design.tables.map(t => t.alias ? `${t.name} ${t.alias}` : t.name);
    fromClause = `  FROM ${tablesList.join(',\n       ')}`;

    design.joins.filter(j => !j.disabled).forEach(join => {
      const from = `${join.fromTable}.${join.fromColumn}`;
      const to = `${join.toTable}.${join.toColumn}`;
      
      if (join.joinType === 'INNER') {
        classicJoinWhereConditions.push(`${from} = ${to}`);
      } else if (join.joinType === 'LEFT') {
        classicJoinWhereConditions.push(`${from} = ${to} (+)`);
      } else if (join.joinType === 'RIGHT') {
        classicJoinWhereConditions.push(`${from} (+) = ${to}`);
      } else {
        // FULL OUTER JOIN fallback in classic (not standard, warn user/fallback to INNER)
        classicJoinWhereConditions.push(`${from} = ${to} /* WARNING: FULL OUTER fallback */`);
      }
    });
  }

  // 3. WHERE clause
  const userWhereClause = compileWhereItem(design.where);
  const whereConditions: string[] = [];

  if (classicJoinWhereConditions.length > 0) {
    whereConditions.push(...classicJoinWhereConditions);
  }
  if (userWhereClause) {
    whereConditions.push(userWhereClause);
  }

  const whereClause = whereConditions.length > 0
    ? ` WHERE ${whereConditions.join('\n   AND ')}`
    : '';

  // 4. GROUP BY clause
  let groupByClause = '';
  if (design.groupBy.enabled) {
    const groupCols = design.groupBy.columns.map(c => `${c.table}.${c.column}`);
    if (groupCols.length > 0) {
      groupByClause = ` GROUP BY ${groupCols.join(', ')}`;
    }
  }

  // 5. HAVING clause
  let havingClause = '';
  if (design.groupBy.enabled) {
    const compiledHaving = compileWhereItem(design.having);
    if (compiledHaving) {
      havingClause = `HAVING ${compiledHaving}`;
    }
  }

  // 6. ORDER BY clause
  let orderByClause = '';
  if (design.orderBy.length > 0) {
    const orderItems = design.orderBy.map(item => `${item.table}.${item.column} ${item.direction}`);
    orderByClause = ` ORDER BY ${orderItems.join(', ')}`;
  }

  // Assemble full query
  let sql = `${selectClause}\n${fromClause}`;
  if (whereClause) sql += `\n${whereClause}`;
  if (groupByClause) sql += `\n${groupByClause}`;
  if (havingClause) sql += `\n${havingClause}`;
  if (orderByClause) sql += `\n${orderByClause}`;

  if (includeComment) {
    // Serialize and append visual JSON state as comment
    const serializedDesign = JSON.stringify(design);
    sql += `\n\n-- TKR_QUERY_BUILDER_DESIGN: ${serializedDesign}`;
  }

  return sql;
}

/**
 * Extracts and parses query builder state from SQL comments.
 * Returns null if not found or invalid.
 */
export function extractDesignFromSql(sql: string): QueryBuilderDesign | null {
  if (!sql) return null;
  const match = sql.match(/-- TKR_QUERY_BUILDER_DESIGN:\s*(\{.*\})/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error('Failed to parse design JSON from SQL comment', e);
    }
  }
  return null;
}

/**
 * Lightweight, regex-based SQL Parser to convert SQL to visual state.
 * Handled if user edits the SQL text manually.
 */
export function parseSqlToState(sql: string, allAvailableTables: string[] = []): QueryBuilderDesign | null {
  // 1. Try to extract design comment first (highest accuracy)
  const design = extractDesignFromSql(sql);
  if (design) return design;

  // 2. Fallback: Parse SQL using regex
  try {
    const cleanSql = sql
      .replace(/\/\*[\s\S]*?\*\//g, '') // remove multi-line comments
      .replace(/--.*$/gm, '')           // remove single-line comments
      .trim();

    if (!cleanSql) return null;

    // Check if it is a SELECT query
    if (!/^SELECT/i.test(cleanSql)) return null;

    const selectRegex = /SELECT([\s\S]*?)FROM([\s\S]*?)(?:WHERE([\s\S]*?))?(?:GROUP\s+BY([\s\S]*?))?(?:HAVING([\s\S]*?))?(?:ORDER\s+BY([\s\S]*?))?$/i;
    const match = cleanSql.match(selectRegex);
    if (!match) return null;

    const selectPart = match[1].trim();
    const fromPart = match[2].trim();
    const wherePart = match[3] ? match[3].trim() : '';
    const groupByPart = match[4] ? match[4].trim() : '';
    const havingPart = match[5] ? match[5].trim() : '';
    const orderByPart = match[6] ? match[6].trim() : '';

    const designState = createInitialDesign();

    // -- Parse Tables and Aliases in FROM --
    // E.g., `FROM tkr_usuarios u INNER JOIN tkr_citas c ON u.id = c.id_usuario`
    // Or `FROM tkr_usuarios u, tkr_citas c`
    const isAnsi = /JOIN/i.test(fromPart);
    designState.useAnsiJoin = isAnsi;

    // Extract table definitions
    // Match commas or JOIN clauses
    const tablesFound: Array<{ name: string; alias: string }> = [];
    
    // Quick tokenization of tables
    // Remove JOIN syntax helpers to isolate tables
    const fromClean = fromPart
      .replace(/(?:INNER|LEFT|RIGHT|FULL|OUTER)?\s*JOIN/gi, ',')
      .replace(/ON[\s\S]*?(?=,|$)/gi, ''); // strip ON conditions
    
    const tableTokens = fromClean.split(',');
    tableTokens.forEach(tok => {
      const parts = tok.trim().split(/\s+/);
      if (parts.length > 0 && parts[0]) {
        const tableName = parts[0].toUpperCase();
        const alias = parts.length > 1 ? parts[1] : '';
        tablesFound.push({ name: tableName, alias });
      }
    });

    if (tablesFound.length === 0) return null;

    // Build TableDesign structures
    designState.tables = tablesFound.map((t, idx) => ({
      id: t.alias || t.name,
      name: t.name,
      alias: t.alias,
      x: 100 + idx * 260,
      y: 100,
      width: 220,
      height: 240,
      columns: []
    }));

    // -- Parse Columns in SELECT --
    // E.g. `u.id AS user_id, u.nombres`
    const colTokens = selectPart.split(/,(?![^(]*\))/); // split commas not inside parentheses
    colTokens.forEach(tok => {
      const colStr = tok.trim();
      if (!colStr) return;

      const aliasMatch = colStr.match(/([\s\S]+?)\s+AS\s+(\w+)/i) || colStr.match(/([\s\S]+?)\s+(\w+)$/i);
      let expr = '';
      let alias = '';

      if (aliasMatch) {
        expr = aliasMatch[1].trim();
        alias = aliasMatch[2].trim();
      } else {
        expr = colStr;
      }

      // Check if expression matches table.column
      const colMatch = expr.match(/^(\w+)\.(\w+)$/);
      if (colMatch) {
        const tblAlias = colMatch[1];
        const colName = colMatch[2].toUpperCase();
        
        const tbl = designState.tables.find(t => t.alias === tblAlias);
        if (tbl) {
          tbl.columns.push({
            name: colName,
            dataType: 'VARCHAR2(100)', // placeholder, will fetch dynamic
            selected: true,
            alias: alias || undefined
          });
        }
      } else {
        // Calculated column / function expression
        // Assign to first table or search for any referenced table alias in the expression
        let assigned = false;
        for (const tbl of designState.tables) {
          const refRegex = new RegExp(`\\b${tbl.alias}\\.\\w+`, 'i');
          if (refRegex.test(expr)) {
            tbl.columns.push({
              name: `EXPR_${tbl.columns.length + 1}`,
              dataType: 'EXPRESSION',
              selected: true,
              alias: alias || undefined,
              customExpression: expr
            });
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          // Fallback to first table
          designState.tables[0].columns.push({
            name: `EXPR_${designState.tables[0].columns.length + 1}`,
            dataType: 'EXPRESSION',
            selected: true,
            alias: alias || undefined,
            customExpression: expr
          });
        }
      }
    });

    // -- Parse Joins --
    if (isAnsi) {
      // ANSI JOINs ON condition parsing
      const joinRegex = /(?:INNER|LEFT|RIGHT|FULL)?\s*JOIN\s+(\w+)\s+(\w+)\s+ON\s+([\w.]+)\s*=\s*([\w.]+)/gi;
      let joinMatch;
      while ((joinMatch = joinRegex.exec(fromPart)) !== null) {
        const targetTable = joinMatch[1].toUpperCase();
        const targetAlias = joinMatch[2];
        const leftSide = joinMatch[3];
        const rightSide = joinMatch[4];

        const leftParts = leftSide.split('.');
        const rightParts = rightSide.split('.');

        if (leftParts.length === 2 && rightParts.length === 2) {
          const typeMatch = fromPart.substring(Math.max(0, joinMatch.index - 15), joinMatch.index).toUpperCase();
          let joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER';
          if (typeMatch.includes('LEFT')) joinType = 'LEFT';
          else if (typeMatch.includes('RIGHT')) joinType = 'RIGHT';
          else if (typeMatch.includes('FULL')) joinType = 'FULL';

          designState.joins.push({
            id: crypto.randomUUID(),
            fromTable: leftParts[0],
            fromColumn: leftParts[1].toUpperCase(),
            toTable: rightParts[0],
            toColumn: rightParts[1].toUpperCase(),
            joinType
          });
        }
      }
    } else {
      // Classic Joins inside WHERE clause (e.g. `u.id = c.id_usuario` or with `(+)`)
      const classicJoinRegex = /(\w+)\.(\w+)\s*(\(\+\)\s*)?=\s*(\w+)\.(\w+)\s*(\(\+\)\s*)?/gi;
      let joinMatch;
      while ((joinMatch = classicJoinRegex.exec(wherePart)) !== null) {
        const t1 = joinMatch[1];
        const c1 = joinMatch[2].toUpperCase();
        const outer1 = !!joinMatch[3];
        const t2 = joinMatch[4];
        const c2 = joinMatch[5].toUpperCase();
        const outer2 = !!joinMatch[6];

        // Verify if t1 and t2 are indeed table aliases in our query
        const hasT1 = designState.tables.some(t => t.alias === t1);
        const hasT2 = designState.tables.some(t => t.alias === t2);

        if (hasT1 && hasT2) {
          let joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER';
          if (outer1) joinType = 'RIGHT'; // (+) is on left side, making it right join
          else if (outer2) joinType = 'LEFT';  // (+) is on right side, making it left join

          designState.joins.push({
            id: crypto.randomUUID(),
            fromTable: t1,
            fromColumn: c1,
            toTable: t2,
            toColumn: c2,
            joinType
          });
        }
      }
    }

    // -- Parse ORDER BY --
    if (orderByPart) {
      const orderTokens = orderByPart.split(',');
      orderTokens.forEach(tok => {
        const token = tok.trim();
        const parts = token.split(/\s+/);
        if (parts.length > 0) {
          const colRef = parts[0];
          const dir = parts.length > 1 && parts[1].toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
          const colParts = colRef.split('.');
          if (colParts.length === 2) {
            designState.orderBy.push({
              table: colParts[0],
              column: colParts[1].toUpperCase(),
              direction: dir
            });
          }
        }
      });
    }

    // -- Parse GROUP BY --
    if (groupByPart) {
      designState.groupBy.enabled = true;
      const groupTokens = groupByPart.split(',');
      groupTokens.forEach(tok => {
        const parts = tok.trim().split('.');
        if (parts.length === 2) {
          designState.groupBy.columns.push({
            table: parts[0],
            column: parts[1].toUpperCase()
          });
        }
      });
    }

    // -- Parse WHERE Filters --
    // We add a single raw rule placeholder if wherePart contains user criteria not captured in classic joins
    if (wherePart) {
      // Clean join conditions from wherePart
      const cleanFilters: string[] = [];
      const conds = wherePart.split(/\bAND\b/i);
      conds.forEach(c => {
        const cond = c.trim();
        // Ignore classic joins (which have (=) and (+) expressions)
        if (!/(\w+)\.(\w+)\s*(\(\+\)\s*)?=\s*(\w+)\.(\w+)\s*(\(\+\)\s*)?/i.test(cond)) {
          cleanFilters.push(cond);
        }
      });

      if (cleanFilters.length > 0) {
        cleanFilters.forEach(f => {
          // Attempt basic parsing, e.g., `u.id > 100` or `c.estado = :P_ESTADO`
          const ruleMatch = f.match(/(\w+)\.(\w+)\s*([<>=!]+|LIKE|NOT LIKE|IS NULL|IS NOT NULL)\s*([\s\S]+)/i);
          if (ruleMatch) {
            const table = ruleMatch[1];
            const column = ruleMatch[2].toUpperCase();
            const operator = ruleMatch[3].toUpperCase();
            let rawVal = ruleMatch[4].trim();

            let valueType: 'text' | 'number' | 'date' | 'parameter' = 'text';
            if (rawVal.startsWith(':')) {
              valueType = 'parameter';
            } else if (/^\d+$/.test(rawVal)) {
              valueType = 'number';
            } else if (rawVal.startsWith("'") && rawVal.endsWith("'")) {
              valueType = 'text';
              rawVal = rawVal.substring(1, rawVal.length - 1);
            }

            designState.where.children.push({
              type: 'rule',
              table,
              column,
              operator,
              value: rawVal,
              valueType
            });
          } else {
            // General raw fallback condition
            designState.where.children.push({
              type: 'rule',
              operator: 'RAW',
              value: f,
              valueType: 'text'
            });
          }
        });
      }
    }

    return designState;
  } catch (e) {
    console.error('Failed to parse SQL query text to visual state', e);
  }

  return null;
}
