// Script de creación de tablas para almacenar modelos relacionales en Oracle Database
export const DIAGRAM_SQL_CONTENT = `-- Script de creación de tablas para almacenar modelos relacionales en Oracle Database

-- Eliminar tablas y secuencias existentes si es necesario para evitar errores de duplicación
BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE TKR_MODELOS_RELACIONALES CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP SEQUENCE TKR_MODELOS_RELACIONALES_SEQ';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- 1. Crear secuencia para la tabla de modelos relacionales
CREATE SEQUENCE TKR_MODELOS_RELACIONALES_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

-- 2. Crear tabla para almacenar los modelos relacionales (diagramas)
CREATE TABLE TKR_MODELOS_RELACIONALES (
    id NUMBER PRIMARY KEY,
    nombre_modelo VARCHAR2(200) NOT NULL UNIQUE,
    modelo_json CLOB NOT NULL
);

COMMENT ON TABLE TKR_MODELOS_RELACIONALES IS 'Tabla que almacena los modelos o diagramas relacionales estructurados en JSON.';
COMMENT ON COLUMN TKR_MODELOS_RELACIONALES.id IS 'Identificador único del modelo (llave primaria autoincrementable).';
COMMENT ON COLUMN TKR_MODELOS_RELACIONALES.nombre_modelo IS 'Nombre descriptivo o título del modelo relacional.';
COMMENT ON COLUMN TKR_MODELOS_RELACIONALES.modelo_json IS 'Estructura en formato JSON que representa las tablas, notas, posiciones, zoom, etc.';

-- 3. Trigger para auto-incrementar la llave primaria id usando la secuencia
CREATE OR REPLACE TRIGGER TRG_BI_TKR_MODELOS_RELACIONALES
BEFORE INSERT ON TKR_MODELOS_RELACIONALES
FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT TKR_MODELOS_RELACIONALES_SEQ.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/
`;
