"use client";

import { useState } from 'react';
import { 
  X, Code2, Database, Star, Wand2, AlertTriangle, BookOpen, 
  Play, ChevronRight, Terminal, FileCode, Layers, ShieldCheck, 
  RefreshCw, Key, Network, GitCompare, Save
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  isDark: boolean;
  onClose: () => void;
}

type TabType = 'queries' | 'schema' | 'favorites' | 'diagram' | 'compare' | 'backup' | 'tools' | 'oracle';

export default function HelpModal({ isOpen, isDark, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('queries');

  if (!isOpen) return null;

  const tabs = [
    { id: 'queries', name: 'Editor y Consultas', icon: Code2, color: 'text-blue-500' },
    { id: 'schema', name: 'Explorador y Esquema', icon: Database, color: 'text-emerald-500' },
    { id: 'favorites', name: 'Gestión de Favoritos', icon: Star, color: 'text-amber-500' },
    { id: 'diagram', name: 'Modelo Relación (DER)', icon: Network, color: 'text-indigo-500' },
    { id: 'compare', name: 'Comparar Objetos', icon: GitCompare, color: 'text-cyan-500' },
    { id: 'backup', name: 'Copia de Seguridad', icon: Save, color: 'text-teal-500' },
    { id: 'tools', name: 'DBMS Output', icon: Terminal, color: 'text-purple-500' },
    { id: 'oracle', name: 'Cuidados con Oracle', icon: AlertTriangle, color: 'text-rose-500' },
  ] as const;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-5xl rounded-2xl shadow-2xl border flex flex-col md:flex-row h-[85vh] max-h-[700px] overflow-hidden transition-all duration-300 ${
        isDark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800'
      }`}>
        
        {/* Sidebar Nav */}
        <div className={`w-full md:w-64 p-5 flex flex-col gap-4 flex-shrink-0 border-b md:border-b-0 md:border-r ${
          isDark ? 'bg-gray-950/45 border-gray-800' : 'bg-gray-50 border-gray-150'
        }`}>
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-500/10">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight">Manual de Usuario</h2>
              <p className="text-[10px] opacity-50">Guías, flujos y buenas prácticas</p>
            </div>
          </div>

          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none custom-scrollbar">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? isDark 
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.06)]' 
                        : 'bg-blue-50 text-blue-700 border border-blue-100 shadow-[0_0_12px_rgba(59,130,246,0.04)]'
                      : isDark
                      ? 'border border-transparent hover:bg-gray-800/40 text-gray-400 hover:text-gray-200'
                      : 'border border-transparent hover:bg-gray-200/50 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? tab.color : 'opacity-60'}`} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Header */}
          <div className={`p-4 px-6 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <div>
              <span className="text-[9px] uppercase font-bold tracking-widest text-blue-500">
                Sección de Ayuda
              </span>
              <h3 className="font-bold text-base mt-0.5">
                {tabs.find(t => t.id === activeTab)?.name}
              </h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Content body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar text-xs leading-relaxed">
            
            {/* ── TABS 1: QUERIES ── */}
            {activeTab === 'queries' && (
              <div className="space-y-5">
                <p className="opacity-70">
                  El editor de código Monaco proporciona herramientas integradas para escribir, formatear y ejecutar consultas SQL de manera ágil e incremental en bases de datos Oracle.
                </p>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <Play className="w-3.5 h-3.5 text-blue-500" />
                    Modos de Ejecución
                  </h4>
                  <ul className="space-y-3 pl-2">
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Ejecutar Statement (F9):</strong> Ejecuta únicamente la sentencia SQL en la que se encuentra posicionado el cursor. No requiere seleccionar el código y es la opción recomendada para validar consultas de forma rápida.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Ejecutar Script (F5):</strong> Ejecuta de principio a fin todo el contenido del editor como un lote secuencial. Se visualizan las salidas de cada comando de forma cronológica en el panel de resultados.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Compilar PL/SQL:</strong> Reconoce y compila paquetes, procedimientos, funciones, disparadores (triggers) y vistas en el esquema de forma explícita, listando errores de compilación con fila y columna si los hubiese.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <Terminal className="w-3.5 h-3.5 text-blue-500" />
                    Parámetros Dinámicos (Bind Variables)
                  </h4>
                  <p className="opacity-70 pl-2">
                    Puedes usar variables de enlace usando el prefijo de dos puntos (ej. <code>:id_empleado</code> o <code>:fecha_inicio</code>). Al dar ejecutar, el aplicativo detectará estas variables y abrirá una ventana emergente para que captures sus valores, soportando tipos como String, Number, Date, Timestamp y Boolean.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs">Cuidado Transaccional</h5>
                    <p className="mt-1 leading-normal">
                      Las transacciones en Oracle requieren control explícito. Si ejecutas comandos DML (como <code>INSERT</code>, <code>UPDATE</code> o <code>DELETE</code>), debes confirmar los cambios pulsando el botón **COMMIT** o revertirlos con **ROLLBACK** antes de desconectarte o cerrar la pestaña.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TABS 2: SCHEMA ── */}
            {activeTab === 'schema' && (
              <div className="space-y-5">
                <p className="opacity-70">
                  La pestaña de <strong>Objetos</strong> te permite explorar la estructura del esquema conectado, consultar columnas, metadatos y abrir código fuente en un clic.
                </p>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    Exploración e Inspección
                  </h4>
                  <ul className="space-y-3 pl-2">
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Describir Objeto (Describe):</strong> Haz clic derecho sobre una tabla o vista en el árbol de objetos para desplegar una radiografía de esta, listando sus columnas, claves primarias/foráneas, comentarios de base de datos e índices.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Ver Código Fuente:</strong> Haz doble clic sobre cualquier objeto de lógica (Procedimientos, Funciones, Paquetes o Vistas) para cargar su definición de código completa directamente en el editor.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
                    Optimización del Rendimiento
                  </h4>
                  <p className="opacity-70 pl-2">
                    En bases de datos con miles de objetos, cargar el esquema completo puede ralentizar la interfaz. Haz clic derecho sobre la pestaña <strong>Objetos</strong> para filtrar qué categorías de objetos deseas consultar (por ejemplo, desmarcar indices o triggers si no los vas a ocupar), optimizando considerablemente los tiempos de carga y memoria.
                  </p>
                </div>
              </div>
            )}

            {/* ── TABS 3: FAVORITES ── */}
            {activeTab === 'favorites' && (
              <div className="space-y-5">
                <p className="opacity-70">
                  La sección de favoritos te ayuda a almacenar consultas recurrentes de manera ordenada, distinguiendo entre tus favoritos locales e independientes por base de datos.
                </p>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500/15" />
                    Organización y Sincronización
                  </h4>
                  <ul className="space-y-3 pl-2">
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Favoritos Locales:</strong> Las consultas guardadas localmente se almacenan en el navegador bajo la carpeta <em>Locales</em>, sin vincularse a ninguna base de datos específica.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Sincronización Bidireccional:</strong> Puedes subir tus favoritos locales a la base de datos de destino mediante <strong>Guardar en BD</strong> (donde se guardan en la tabla remota <code>TKR_FAVORITOS</code>) o descargarlos mediante <strong>Cargar de BD</strong>.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Asistente de Transferencia:</strong> Permite pasar de manera selectiva favoritos entre tus conexiones o locales resolviendo conflictos de duplicados en el camino (sobreescribir, omitir, omitir todos, etc.).
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Eliminación Granular:</strong> El botón <strong>Borrar</strong> en favoritos abre un modal interactivo donde puedes marcar múltiples favoritos y/o carpetas, y decidir opcionalmente si borrarlos también físicamente de la base de datos.
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* ── TABS 4: DIAGRAM (MODELO RELACION) ── */}
            {activeTab === 'diagram' && (
              <div className="space-y-5">
                <p className="opacity-70">
                  La herramienta de <strong>Modelo de Relación (DER)</strong> te permite diseñar, explorar y documentar de forma visual las entidades del esquema conectado y sus dependencias.
                </p>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <Network className="w-3.5 h-3.5 text-indigo-500" />
                    Funcionamiento y Uso
                  </h4>
                  <ul className="space-y-3 pl-2">
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Arrastrar y Soltar:</strong> Abre la herramienta desde la cinta de opciones superior. Agrega tablas al lienzo interactivo arrastrándolas directamente desde el explorador de objetos en el panel izquierdo.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Detección de Claves Foráneas:</strong> El motor consulta el diccionario de datos de Oracle para graficar las líneas y relaciones correspondientes al instante en que agregas las tablas que las contienen.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Guardar y Exportar:</strong> Puedes descargar una copia visual del lienzo en formato de imagen PNG o almacenar la persistencia del lienzo en base de datos para continuar editándolo posteriormente.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs">Cuidados y Límites de Rendimiento</h5>
                    <p className="mt-1 leading-normal">
                      Arrastrar cientos de tablas simultáneamente con un volumen masivo de dependencias puede ralentizar el renderizado del lienzo en el navegador. Se recomienda modelar diagramas segmentados por módulos de negocio para facilitar la lectura y el rendimiento.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TABS 5: COMPARE (COMPARAR OBJETOS) ── */}
            {activeTab === 'compare' && (
              <div className="space-y-5">
                <p className="opacity-70">
                  La herramienta de <strong>Comparación de Objetos</strong> te permite contrastar la estructura y el código de objetos entre diferentes esquemas o bases de datos (por ejemplo, desarrollo vs producción).
                </p>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <GitCompare className="w-3.5 h-3.5 text-cyan-500" />
                    Funcionamiento y Uso
                  </h4>
                  <ul className="space-y-3 pl-2">
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-cyan-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Comparación Side-by-Side:</strong> Selecciona una conexión origen y una conexión destino, escoge el tipo de objeto y el nombre. El sistema descargará y comparará el DDL o código fuente mostrando las diferencias.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-cyan-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Diferencias de Columnas:</strong> Para tablas, se comparan los tipos de datos, longitudes y nulabilidades de cada columna, ayudando a validar la paridad de los esquemas.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-500" />
                    Requisitos y Permisos
                  </h4>
                  <p className="opacity-70 pl-2">
                    Para comparar correctamente, el usuario de base de datos de ambas conexiones debe poseer permisos de lectura (<code>SELECT</code>) sobre el diccionario de datos (como <code>ALL_SOURCE</code>, <code>ALL_TAB_COLUMNS</code> y <code>ALL_CONSTRAINTS</code>).
                  </p>
                </div>

                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs">Cuidados con Conexiones Lentas</h5>
                    <p className="mt-1 leading-normal">
                      Si realizas comparaciones a través de VPNs o conexiones de red inestables, la obtención de los DDLs remotos puede tomar unos segundos. Evita recargar la página o realizar múltiples consultas en paralelo durante el análisis de diferencias.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TABS 6: BACKUP (COPIA DE SEGURIDAD) ── */}
            {activeTab === 'backup' && (
              <div className="space-y-5">
                <p className="opacity-70">
                  La **Copia de Seguridad** te permite exportar objetos seleccionados del esquema a archivos locales SQL listos para restaurarse en otros entornos.
                </p>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <Save className="w-3.5 h-3.5 text-teal-500" />
                    Funcionamiento y Respaldos
                  </h4>
                  <ul className="space-y-3 pl-2">
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Exportación Estructural (DDL):</strong> Genera las sentencias de creación <code>CREATE TABLE</code>, <code>CREATE VIEW</code>, índices y restricciones en un archivo limpio.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Exportación de Datos:</strong> Traduce el contenido de las tablas seleccionadas en lotes de sentencias <code>INSERT INTO</code> ejecutables en cualquier otro cliente SQL.
                      </div>
                    </li>
                  </ul>
                </div>

                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs">Cuidados Críticos con Datos Masivos</h5>
                    <p className="mt-1 leading-normal">
                      Exportar tablas transaccionales con millones de filas consumirá severamente memoria RAM y tiempo de ejecución, pudiendo saturar tu navegador o impactar negativamente la base de datos Oracle. Para respaldos masivos de producción, es mandatorio utilizar herramientas nativas de base de datos como Oracle Data Pump (<code>expdp</code>) o <code>SQL*Loader</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TABS 7: TOOLS (DBMS OUTPUT) ── */}
            {activeTab === 'tools' && (
              <div className="space-y-5">
                <p className="opacity-70">
                  Herramientas adicionales de auditoría y desarrollo para leer los logs de salida del servidor.
                </p>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-500" />
                    Salida del Servidor (DBMS_OUTPUT)
                  </h4>
                  <p className="opacity-70 pl-2">
                    Activa la casilla <strong>DBMS_OUT</strong> en la parte superior derecha de la cinta de opciones para que el servidor Oracle capture y devuelva los logs de salida impresos mediante la instrucción <code>DBMS_OUTPUT.PUT_LINE</code>. Estos logs se listarán en una pestaña especial de resultados.
                  </p>
                </div>
              </div>
            )}

            {/* ── TABS 8: ORACLE ── */}
            {activeTab === 'oracle' && (
              <div className="space-y-5">
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs">Peligros de Bloqueo de Filas (Locks)</h4>
                    <p className="mt-1 leading-normal">
                      Cuando modificas datos (mediante <code>UPDATE</code> o <code>DELETE</code>), Oracle bloquea las filas correspondientes. Si dejas la sesión abierta sin ejecutar un <strong>COMMIT</strong> o <strong>ROLLBACK</strong>, ningún otro usuario ni proceso podrá modificar esas filas, pudiendo congelar flujos del aplicativo en producción.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs flex items-center gap-2 border-b border-gray-500/10 pb-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                    Consejos y Medidas de Seguridad
                  </h4>
                  <ul className="space-y-3 pl-2">
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Sentencias DDL:</strong> Instrucciones como <code>CREATE</code>, <code>ALTER</code>, <code>DROP</code> o <code>TRUNCATE</code> realizan un **COMMIT implícito** en Oracle. Esto significa que una vez ejecutadas no se pueden revertir con un comando <code>ROLLBACK</code>.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Desconexión por Inactividad:</strong> El aplicativo tiene integrado un temporizador que destruye la sesión inactiva y la bloquea tras un periodo configurable en los ajustes (ej. 60 minutos), liberando bloqueos y recursos innecesarios en el servidor Oracle.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Uso de Alias de Columna:</strong> Al ejecutar consultas complejas, asocia alias únicos a las columnas. Esto facilita a la grilla de resultados renderizar y ordenar la información de manera precisa.
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className={`p-4 border-t flex justify-end gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <button
              onClick={onClose}
              className={`px-6 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isDark 
                  ? 'border-gray-700 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-gray-100' 
                  : 'border-gray-200 bg-gray-100 hover:bg-gray-150 text-gray-700 hover:text-gray-900'
              }`}
            >
              Cerrar Guía
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
