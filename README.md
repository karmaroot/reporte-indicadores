# SGI – Sistema de Gestión de Indicadores

## Resumen del Proyecto

Este sistema es una plataforma integral para la gestión, reporte y validación de indicadores de gestión. Facilita la trazabilidad total del ciclo de reportabilidad, desde la carga inicial de datos por los informantes hasta la aprobación técnica por parte del equipo revisor, pasando por la supervisión de directivos mediante cuadros de mando.

## Roles del Sistema

- **Informante**: Responsable de ingresar los datos mensuales/trimestrales y adjuntar los medios de verificación requeridos. Puede corregir reportes observados por el revisor y responder a sus comentarios.
- **Revisor**: Encargado de validar la información y los medios de verificación adjuntados. Puede aprobar reportes o devolverlos con observaciones técnicas detalladas.
- **Jefatura**: Rol directivo y de supervisión estratégica. Cuenta con acceso exclusivo al **Cuadro de Mando Estratégico** para monitorear en tiempo real el rendimiento y porcentaje de cumplimiento de los instrumentos asignados a sus respectivos Centros de Responsabilidad.
- **Administrador**: Gestión centralizada de usuarios, perfiles, periodos de reporte, instrumentos/indicadores y control del inicio automático de procesos.

## Características Principales

- **Cuadro de Mando Estratégico (Dashboard de Jefatura)**:
  - Visualización interactiva y premium de rendimiento de los instrumentos mediante indicadores de cilindro líquido (**LiquidDrum** animados con `framer-motion`).
  - Gráficos dinámicos comparativos (usando `Recharts`) que muestran en tiempo real la meta anual, la meta programada del trimestre y el avance real reportado.
- **Inicio Automático (Auto-Start)**:
  - Módulo para que administradores gatillen el inicio de reportes del nuevo periodo de manera masiva o individual según la periodicidad.
  - Arrastre automático de valores previos (numeradores, denominadores y comentarios) y duplicación de evidencias/adjuntos en el nuevo periodo en estado **Borrador**, reduciendo significativamente el tiempo de ingreso de datos repetitivos.
- **Reporte de Avance "Cero"**:
  - Opción simplificada para declarar periodos sin actividad o con valor cero sin obligar al informante a ingresar numeradores/denominadores o adjuntar medios de verificación de manera forzada.
- **Gestión de Evidencias**:
  - Sistema de carga y almacenamiento de archivos integrado con Supabase Storage (bucket `verification-documents`).
- **Trazabilidad de Observaciones**:
  - Hilo de comunicación interactivo e histórico entre informante y revisor para solventar observaciones y corregir datos sobre la misma plataforma.
- **Seguridad y Control de Acceso**:
  - Políticas de seguridad a nivel de fila (RLS) avanzadas en Supabase para asegurar que cada informante y jefatura acceda únicamente a los datos de sus Centros de Responsabilidad asignados.

## Tecnologías Utilizadas

- **Frontend**: React.js, TypeScript, Vite.
- **Animaciones e Interactividad**: Framer Motion, Recharts.
- **Estilos**: Tailwind CSS, Shadcn UI, Lucide Icons.
- **Backend & Auth**: Supabase (PostgreSQL, Auth, Database, Storage, Edge Functions).
- **Gestión de Estado**: TanStack Query (React Query).

## Reglas de Negocio

Para más detalles sobre las reglas de seguridad y políticas aplicadas al servidor, consulte el archivo: [DOCS_BUSINESS_RULES.md](./DOCS_BUSINESS_RULES.md).

## Instalación y Desarrollo

1. Clonar el repositorio.
2. Ejecutar `npm install` o `bun install` para instalar dependencias.
3. Configurar variables de entorno en `.env` (Supabase URL y Anon Key).
4. Ejecutar `npm run dev` para iniciar el servidor de desarrollo local.

## Propiedad Intelectual y Autorización de Uso

Esta aplicación es una obra original y su propiedad intelectual pertenece exclusivamente a su creador, **Marcelo Silva Magna**. Su uso por parte de cualquier institución u organización es de carácter autorizado y no implica transferencia de propiedad ni derechos sobre el código fuente o la lógica del sistema.

## Creador

**Marcelo Silva Magna**  
Ingeniero en Informática y consultor de negocios
