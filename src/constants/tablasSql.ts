export const TABLAS_SQL_CONTENT = `-- Script de creación de tablas para almacenar favoritos en Oracle Database

-- Eliminar tablas y secuencias existentes si es necesario para evitar errores de duplicación
BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE TKR_FAVORITOS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE TKR_FAVORITOS_SECCIONES CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP SEQUENCE TKR_FAVORITOS_SEQ';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP SEQUENCE TKR_FAVORITOS_SECCIONES_SEQ';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- 1. Crear secuencia y tabla para las secciones de favoritos
CREATE SEQUENCE TKR_FAVORITOS_SECCIONES_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE TKR_FAVORITOS_SECCIONES (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(100) NOT NULL UNIQUE
);

COMMENT ON TABLE TKR_FAVORITOS_SECCIONES IS 'Tabla que almacena las categorías o carpetas para organizar las consultas SQL favoritas.';
COMMENT ON COLUMN TKR_FAVORITOS_SECCIONES.id IS 'Identificador único de la sección (llave primaria autoincrementable).';
COMMENT ON COLUMN TKR_FAVORITOS_SECCIONES.name IS 'Nombre único de la carpeta o sección.';

-- Trigger para auto-incrementar la llave primaria id usando la secuencia
CREATE OR REPLACE TRIGGER TRG_BI_TKR_FAVORITOS_SECCIONES
BEFORE INSERT ON TKR_FAVORITOS_SECCIONES
FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT TKR_FAVORITOS_SECCIONES_SEQ.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/

-- 2. Crear secuencia y tabla para los favoritos
CREATE SEQUENCE TKR_FAVORITOS_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE TKR_FAVORITOS (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    sql_query CLOB NOT NULL,
    seccion_id NUMBER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_run_at TIMESTAMP,
    CONSTRAINT fk_fav_seccion FOREIGN KEY (seccion_id) 
        REFERENCES TKR_FAVORITOS_SECCIONES(id) ON DELETE CASCADE
);

COMMENT ON TABLE TKR_FAVORITOS IS 'Tabla que almacena las consultas SQL favoritas de los usuarios.';
COMMENT ON COLUMN TKR_FAVORITOS.id IS 'Identificador único del favorito (llave primaria autoincrementable).';
COMMENT ON COLUMN TKR_FAVORITOS.name IS 'Nombre descriptivo asignado a la consulta favorita.';
COMMENT ON COLUMN TKR_FAVORITOS.sql_query IS 'Instrucción o script SQL guardado.';
COMMENT ON COLUMN TKR_FAVORITOS.seccion_id IS 'Identificador de la sección a la que pertenece (relación con TKR_FAVORITOS_SECCIONES).';
COMMENT ON COLUMN TKR_FAVORITOS.created_at IS 'Fecha y hora de creación del favorito.';
COMMENT ON COLUMN TKR_FAVORITOS.last_run_at IS 'Fecha y hora de la última ejecución registrada de la consulta.';

-- Trigger para auto-incrementar la llave primaria id usando la secuencia
CREATE OR REPLACE TRIGGER TRG_BI_TKR_FAVORITOS
BEFORE INSERT ON TKR_FAVORITOS
FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT TKR_FAVORITOS_SEQ.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/

-- Insertar sección por defecto "Varios" para consistencia con la aplicación
INSERT INTO TKR_FAVORITOS_SECCIONES (name) VALUES ('Varios');
COMMIT;`;
