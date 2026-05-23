import { NextResponse } from 'next/server';
import { executeOracleQuery } from '@/lib/db';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
    const { connection, name } = body;

    if (!connection || !name) {
      return NextResponse.json(
        { error: 'Connection and object name are required' },
        { status: 400 }
      );
    }

    const upperName = name.trim().toUpperCase();
    const currentUser = connection.user?.toUpperCase();

    // 1. Locate the object to find its type and owner
    const locateSql = `
      SELECT object_name, object_type, owner, status
      FROM all_objects
      WHERE object_name = :name
      ORDER BY CASE WHEN owner = :currentUser THEN 1 ELSE 2 END, owner
    `;
    const locateResult = await executeOracleQuery(connection, locateSql, { name: upperName, currentUser });

    if (!locateResult.rows || locateResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Objeto '${upperName}' no encontrado en la base de datos` },
        { status: 404 }
      );
    }

    // Get the first matching object
    const row0 = locateResult.rows[0];
    const objectName = row0.OBJECT_NAME || row0.object_name;
    const objectType = row0.OBJECT_TYPE || row0.object_type;
    const owner = row0.OWNER || row0.owner;
    const status = row0.STATUS || row0.status || 'VALID';

    const responseData: any = {
      objectName,
      objectType,
      owner,
      status
    };

    // 2. Fetch DDL (for all types)
    let ddl = '';
    try {
      const ddlType = objectType.replace(' ', '_');
      const ddlSql = `SELECT DBMS_METADATA.GET_DDL(:ddlType, :objectName, :owner) AS ddl FROM DUAL`;
      const ddlResult = await executeOracleQuery(connection, ddlSql, { 
        ddlType, 
        objectName, 
        owner 
      });
      ddl = ddlResult.rows?.[0]?.DDL || ddlResult.rows?.[0]?.ddl || '';
    } catch (err: any) {
      // Fallback for PL/SQL source code if DDL fails
      if (['PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY', 'TRIGGER', 'TYPE'].includes(objectType)) {
        try {
          const srcSql = `
            SELECT text 
            FROM all_source 
            WHERE owner = :owner AND name = :objectName AND type = :objectType 
            ORDER BY line
          `;
          const srcResult = await executeOracleQuery(connection, srcSql, { owner, objectName, objectType });
          if (srcResult.rows && srcResult.rows.length > 0) {
            ddl = srcResult.rows.map((r: any) => r.TEXT || r.text || '').join('');
          } else {
            ddl = `-- Código fuente no recuperable: ${err.message}`;
          }
        } catch (srcErr: any) {
          ddl = `-- Error al obtener DDL: ${err.message}\n-- Error al obtener código fuente: ${srcErr.message}`;
        }
      } else {
        ddl = `-- Error al obtener DDL de metadata: ${err.message}`;
      }
    }
    responseData.ddl = ddl;

    // 3. If object is a TABLE, fetch columns, constraints, indexes, triggers
    if (objectType === 'TABLE') {
      // 3.1. Fetch columns and column comments
      const colsSql = `
        SELECT 
            c.column_name, 
            c.data_type, 
            c.data_length, 
            c.char_length, 
            c.data_precision, 
            c.data_scale, 
            c.nullable,
            cm.comments
        FROM 
            all_tab_columns c
            LEFT JOIN all_col_comments cm ON c.owner = cm.owner AND c.table_name = cm.table_name AND c.column_name = cm.column_name
        WHERE 
            c.owner = :owner AND c.table_name = :objectName
        ORDER BY 
            c.column_id
      `;
      const colsResult = await executeOracleQuery(connection, colsSql, { owner, objectName });
      responseData.columns = (colsResult.rows || []).map((row: any) => {
        const columnName = row.COLUMN_NAME || row.column_name;
        let dataType = row.DATA_TYPE || row.data_type || '';
        const nullable = row.NULLABLE || row.nullable;
        const comments = row.COMMENTS || row.comments || '';

        const dataLength = row.DATA_LENGTH !== undefined ? row.DATA_LENGTH : row.data_length;
        const charLength = row.CHAR_LENGTH !== undefined ? row.CHAR_LENGTH : row.char_length;
        const dataPrecision = row.DATA_PRECISION !== undefined ? row.DATA_PRECISION : row.data_precision;
        const dataScale = row.DATA_SCALE !== undefined ? row.DATA_SCALE : row.data_scale;

        const dataTypeUpper = dataType.toUpperCase();
        if (['VARCHAR2', 'VARCHAR', 'NVARCHAR2', 'CHAR', 'NCHAR'].includes(dataTypeUpper)) {
          const len = charLength || dataLength;
          if (len) dataType = `${dataType}(${len})`;
        } else if (dataTypeUpper === 'NUMBER') {
          if (dataPrecision !== null && dataPrecision !== undefined) {
            if (dataScale !== null && dataScale !== undefined && dataScale > 0) {
              dataType = `${dataType}(${dataPrecision},${dataScale})`;
            } else {
              dataType = `${dataType}(${dataPrecision})`;
            }
          }
        } else if (['RAW'].includes(dataTypeUpper)) {
          if (dataLength) dataType = `${dataType}(${dataLength})`;
        }

        return {
          columnName,
          dataType,
          nullable: nullable === 'Y',
          comments
        };
      });

      // 3.2. Fetch constraints
      const constsSql = `
        SELECT 
            c.constraint_name,
            c.constraint_type,
            cc.column_name,
            c.search_condition,
            c.r_constraint_name,
            rc.table_name AS r_table_name,
            rc.column_name AS r_column_name
        FROM 
            all_constraints c
            JOIN all_cons_columns cc ON c.constraint_name = cc.constraint_name AND c.owner = cc.owner
            LEFT JOIN all_cons_columns rc ON c.r_constraint_name = rc.constraint_name AND c.owner = rc.owner AND cc.position = rc.position
        WHERE 
            c.owner = :owner AND c.table_name = :objectName
        ORDER BY 
            c.constraint_name, cc.position
      `;
      const constsResult = await executeOracleQuery(connection, constsSql, { owner, objectName });
      
      // Group columns for same constraint
      const constraintsMap: Record<string, any> = {};
      (constsResult.rows || []).forEach((row: any) => {
        const name = row.CONSTRAINT_NAME || row.constraint_name;
        const type = row.CONSTRAINT_TYPE || row.constraint_type;
        const columnName = row.COLUMN_NAME || row.column_name;
        const searchCondition = row.SEARCH_CONDITION || row.search_condition || '';
        const rTableName = row.R_TABLE_NAME || row.r_table_name || '';
        const rColumnName = row.R_COLUMN_NAME || row.r_column_name || '';

        if (!constraintsMap[name]) {
          constraintsMap[name] = {
            constraintName: name,
            constraintType: type,
            columns: [],
            searchCondition,
            rTableName,
            rColumns: []
          };
        }
        constraintsMap[name].columns.push(columnName);
        if (rColumnName) {
          constraintsMap[name].rColumns.push(rColumnName);
        }
      });
      responseData.constraints = Object.values(constraintsMap);

      // 3.3. Fetch indexes
      const indexesSql = `
        SELECT 
            i.index_name,
            i.uniqueness,
            ic.column_name,
            ic.column_position,
            ic.descend
        FROM 
            all_indexes i
            JOIN all_ind_columns ic ON i.index_name = ic.index_name AND i.owner = ic.index_owner AND i.table_name = ic.table_name
        WHERE 
            i.owner = :owner AND i.table_name = :objectName
        ORDER BY 
            i.index_name, ic.column_position
      `;
      const indexesResult = await executeOracleQuery(connection, indexesSql, { owner, objectName });
      
      const indexesMap: Record<string, any> = {};
      (indexesResult.rows || []).forEach((row: any) => {
        const idxName = row.INDEX_NAME || row.index_name;
        const uniq = row.UNIQUENESS || row.uniqueness;
        const columnName = row.COLUMN_NAME || row.column_name;
        const descend = row.DESCEND || row.descend;

        if (!indexesMap[idxName]) {
          indexesMap[idxName] = {
            indexName: idxName,
            uniqueness: uniq,
            columns: []
          };
        }
        indexesMap[idxName].columns.push(`${columnName} ${descend}`);
      });
      responseData.indexes = Object.values(indexesMap);

      // 3.4. Fetch triggers
      const triggersSql = `
        SELECT 
            trigger_name,
            trigger_type,
            triggering_event,
            status
        FROM 
            all_triggers
        WHERE 
            table_owner = :owner AND table_name = :objectName
        ORDER BY 
            trigger_name
      `;
      const triggersResult = await executeOracleQuery(connection, triggersSql, { owner, objectName });
      responseData.triggers = (triggersResult.rows || []).map((row: any) => ({
        triggerName: row.TRIGGER_NAME || row.trigger_name,
        triggerType: row.TRIGGER_TYPE || row.trigger_type,
        triggeringEvent: row.TRIGGERING_EVENT || row.triggering_event,
        status: row.STATUS || row.status
      }));
    }

    return NextResponse.json({ success: true, data: responseData });
  } catch (error: any) {
    console.error('Error describing database object:', error);
    return NextResponse.json(
      { error: error.message || 'Error describing database object' },
      { status: 500 }
    );
  }
}
