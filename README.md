# SGI – Sistema de Gestión de Indicadores

**Plataforma Integral de Gestión, Reportabilidad, Validación, Monitoreo Estratégico y Alertas Automatizadas para Indicadores de Gestión Institucional.**

---

## 📋 Índice
1. [Resumen del Proyecto](#-resumen-del-proyecto)
2. [Roles y Permisos del Sistema](#-roles-y-permisos-del-sistema)
3. [Características Principales](#-características-principales)
4. [Arquitectura y Tecnologías](#-arquitectura-y-tecnologías)
5. [Estructura del Proyecto](#-estructura-del-proyecto)
6. [Sistema de Alertas y Servicio Puente (Bridge Worker)](#-sistema-de-alertas-y-servicio-puente-bridge-worker)
7. [Gestión de Subrogancia y Reasignación de Usuarios](#-gestión-de-subrogancia-y-reasignación-de-usuarios)
8. [Instalación, Configuración y Despliegue](#-instalación-configuración-y-despliegue)
9. [Pruebas y Verificación](#-pruebas-y-verificación)
10. [Reglas de Negocio y Seguridad (RLS)](#-reglas-de-negocio-y-seguridad-rls)
11. [Propiedad Intelectual y Autorización de Uso](#-propiedad-intelectual-y-autorización-de-uso)
12. [Autor](#-autor)

---

## 🚀 Resumen del Proyecto

El **Sistema de Gestión de Indicadores (SGI)** es una solución web integral diseñada para controlar, validar, analizar y visualizar el cumplimiento de los indicadores institucionales de gestión en la **Comisión Nacional de Riego (CNR)**.

El sistema garantiza trazabilidad total en cada etapa del ciclo de reportabilidad:
- **Carga de Datos:** Ingreso de valores por periodo, fórmulas (numerador/denominador), observaciones y adjuntos de evidencia (Storage Supabase).
- **Revisión y Control:** Aprobación o devolución técnica con observaciones fundamentadas en un hilo interactivo de comunicación.
- **Monitoreo Directivo:** Cuadro de mando estratégico ejecutivo e interfaz avanzada de **Informes de Gestión** con visualizadores líquidos animados (`LiquidDrum`) y gráficos comparativos en tiempo real.
- **Automatización y Alertas:** Inicio automático de periodos (*Auto-Start*) con arrastre de datos/evidencias previas, disparadores atómicos en PostgreSQL (`FOR EACH STATEMENT`) y motor asíncrono de notificaciones por correo vía servicio puente SMTP.
- **Subrogancia y Continuidad Operativa:** Reasignación inteligente de responsabilidades y duplicación de notificaciones para usuarios subrogantes.

---

## 👥 Roles y Permisos del Sistema

- **Informante**: 
  - Ingreso de datos mensuales, trimestrales y anuales en periodos habilitados.
  - Carga y actualización de medios de verificación (documentos de respaldo).
  - Declaración simplificada mediante **Reporte de Avance Cero** para periodos sin actividad.
  - Corrección de reportes observados y respuesta directa al revisor.
  - Recepción de alertas de vencimiento e inicio de periodos.

- **Revisor**: 
  - Validación técnica de la información cargada y los documentos adjuntos.
  - Aprobación de reportes o devolución con observaciones fundamentadas.
  - Hilo de comunicación y trazabilidad directa con el informante.

- **Jefatura**: 
  - Rol estratégico y directivo con acceso exclusivo al **Cuadro de Mando Estratégico** y al módulo de **Informes de Gestión**.
  - Monitoreo en tiempo real del cumplimiento de indicadores por Centros de Responsabilidad autorizados.
  - Visualización interactiva con indicadores de cilindro líquido (**LiquidDrum**) y gráficos de avance vs. meta programada.

- **Administrador**: 
  - Gestión centralizada de usuarios, perfiles, instituciones, indicadores, periodos y Centros de Responsabilidad.
  - Configuración de **subrogancia** por usuario y eliminación segura con reasignación de responsabilidades.
  - Control e inicio automático masivo o individual de procesos de reporte (*Auto-Start*).
  - Configuración de servidores SMTP, plantillas HTML editables con marcadores dinámicos (como `{{boton_acceso}}`) y supervisión de la cola de notificaciones (`email_queue`).
  - Carga masiva de indicadores mediante plantilla CSV.

---

## ✨ Características Principales

### 1. Cuadro de Mando Estratégico y Módulo de Informes
- **Cilindros Líquidos Animados (`LiquidDrum`)**: Visualización dinámica impulsada por `Framer Motion` para representar porcentajes de avance efectivo.
- **Gráficos Comparativos (`Recharts`)**: Contraste en tiempo real de la Meta Anual, Meta Programada del periodo y Avance Real logrado.
- **Módulo de Informes de Gestión**: Acceso exclusivo para **Jefatura** y **Administrador** con tableros ejecutivos detallados, resúmenes institucionales y exportación a PDF y Excel.
- **Filtros Avanzados de Selección Múltiple (`MultiSelectFilter`)**: Búsqueda interactiva y filtrado simultáneo por múltiples Instrumentos y Centros de Responsabilidad.

### 2. Gestión de Subrogancia y Reasignación de Usuarios
- Configuración de **Usuario Subrogante** directamente desde el panel de edición de usuarios.
- Envío automático de copias de notificación por correo a los subrogantes configurados.
- **Eliminación y Reasignación Segura**: Al eliminar un usuario, el sistema reasigna automáticamente todos sus indicadores y reportes a su usuario subrogante, garantizando la continuidad operativa sin pérdida de datos.

### 3. Motor de Alertas PostgreSQL & Servicio Puente SMTP
- **Triggers en PostgreSQL**: Generación e inserción atómica de notificaciones en la tabla `email_queue` mediante triggers por sentencia (`FOR EACH STATEMENT`) con deduplicación por destinatario, perfil e institución iniciada.
- **Plantillas Dinámicas HTML**: Soporte de variables personalizadas e integración del marcador `{{boton_acceso}}` para generar botones de enlace directo con estilo nativo a la plataforma.
- **Servicio Puente (Bridge Worker)**: Daemon en Node.js que procesa la cola de correos de forma asíncrona mediante Supabase Realtime y polling cada 5 segundos.

### 4. Inicio Automático de Periodos (Auto-Start)
- Gatillado masivo o individual para aperturar nuevos periodos de reporte.
- Arrastre automático de numeradores, denominadores y comentarios del periodo anterior.
- Duplicación de evidencias y adjuntos en estado **Borrador**, optimizando la carga recurrente de datos.

### 5. Reporte de Avance "Cero"
- Opción simplificada para declarar periodos sin actividad de forma ágil, omitiendo la carga forzada de numeradores, denominadores o archivos adicionales.

### 6. Gestión e Histórico de Evidencias
- Almacenamiento seguro en Supabase Storage (`verification-documents`).
- Trazabilidad del usuario de subida (`uploaded_by`), visualización previa y descarga por revisores.

---

## 🛠️ Arquitectura y Tecnologías

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND REACT                       │
│  React 18 + TypeScript + Vite + Tailwind CSS + Shadcn   │
│  TanStack Query v5 + Framer Motion + Recharts + Lucide  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND SUPABASE                     │
│  PostgreSQL 15 (RLS, Triggers email_queue)              │
│  Auth (JWT) + Storage (verification-documents)          │
│  Edge Functions (TypeScript / Deno)                     │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼ (Realtime / Polling 5s)
┌─────────────────────────────────────────────────────────┐
│                 BRIDGE WORKER (NODE.JS)                 │
│  Daemon asíncrono con Nodemailer + SMTP Institucional  │
└─────────────────────────────────────────────────────────┘
```

### Frontend
- **Core:** React 18, TypeScript, Vite.
- **Estado y Peticiones:** React Router v6, TanStack Query (React Query v5).
- **Diseño y Componentes:** Tailwind CSS, Radix UI, Shadcn UI patterns, Lucide Icons, Sonner.
- **Visualizaciones:** Framer Motion, Recharts.
- **Generación de Documentos:** jsPDF, html2pdf.js, html2canvas.

### Backend & Almacenamiento
- **Base de Datos & Auth:** Supabase (PostgreSQL 15+, Auth, Storage, Edge Functions).
- **Triggers SQL:** Inserción automática de notificaciones deduplicadas en `email_queue`.
- **Microservicio Puente:** Node.js + Nodemailer (`bridge-worker/`) ejecutado en segundo plano.

---

## 📂 Estructura del Proyecto

```text
gauge-wise-flows/
├── bridge-worker/             # Servicio Puente (Node.js) para envío asíncrono de correos SMTP
│   ├── worker.js              # Procesador de la cola email_queue y escuchador Realtime
│   ├── start-worker.bat       # Script de ejecución directa en Windows
│   └── package.json           # Dependencias del servicio puente (Nodemailer, @supabase/supabase-js)
├── public/                    # Recursos estáticos de la aplicación
├── src/                       # Código fuente del Frontend (React + TypeScript)
│   ├── components/            # Componentes reutilizables
│   │   ├── dialogs/           # Diálogos modales (usuarios, periodos, plantillas)
│   │   ├── layout/            # Estructura principal y navegación Sidebar
│   │   ├── reports/           # Componentes para informes y gráficos
│   │   ├── shared/            # Componentes comunes (MultiSelectFilter, KpiCard, StatusBadge)
│   │   └── ui/                # Sistema de componentes Shadcn UI / Radix
│   ├── config/                # Configuraciones globales
│   ├── hooks/                 # Custom Hooks (React Query, Auth, Subrogantes)
│   ├── integrations/          # Cliente Supabase y definición de tipos
│   ├── lib/                   # Utilidades y generadores PDF/Excel
│   ├── pages/                 # Páginas principales del sistema
│   │   ├── ManagementReportsPage.tsx  # Informes de Gestión (Admin & Jefatura)
│   │   ├── AdminDashboard.tsx         # Panel de Control Administrativo
│   │   ├── UsersPage.tsx              # Gestión de usuarios y subrogancias
│   │   ├── SettingsPage.tsx           # Configuración SMTP y plantillas de correo
│   │   ├── Dashboard.tsx              # Cuadro de mando ejecutivo (LiquidDrum)
│   │   ├── AutoStart.tsx              # Inicio automático de periodos
│   │   └── Inbox.tsx / Reports.tsx    # Bandeja de entrada y reportes de indicadores
│   └── types/                 # Tipos e interfaces TypeScript
├── supabase/                  # Artefactos backend de Supabase
│   ├── functions/             # Edge Functions
│   └── migrations/            # Scripts SQL, triggers y políticas RLS
├── DOCS_BUSINESS_RULES.md     # Especificación técnica de Reglas de Negocio y RLS
├── DOCS_REGISTRO_PI/          # Documentación legal de Propiedad Intelectual
├── README.md                  # Documentación principal del sistema
└── package.json               # Scripts y dependencias del proyecto React
```

---

## 📧 Sistema de Alertas y Servicio Puente (Bridge Worker)

El envío de notificaciones opera de forma 100% asíncrona para no bloquear las respuestas de la interfaz web:

1. **Generación de Notificaciones:** Triggers en PostgreSQL encolan correos en la tabla `email_queue` al ocurrir eventos (inicio de periodo, nuevo reporte, observaciones, aprobación).
2. **Marcador `{{boton_acceso}}`:** Se reemplaza dinámicamente por un botón HTML estilizado para ingresar directamente a la plataforma.
3. **Servicio Puente (`bridge-worker`):**
   - Escucha cambios en tiempo real vía `postgres_changes` y ejecuta polling de respaldo cada 5 segundos.
   - Lee las credenciales SMTP activas desde `email_smtp_settings`.
   - Envía el correo mediante `Nodemailer` e incluye en copia (`cc`) al usuario subrogante si está configurado.
   - Actualiza el estado del correo (`sent` / `failed`) con registro de errores.

### Ejecución del Servicio Puente
```bash
cd bridge-worker
npm install
node worker.js
```
*En Windows, se puede iniciar con doble clic en `bridge-worker/start-worker.bat`.*

---

## 🔄 Gestión de Subrogancia y Reasignación de Usuarios

Para garantizar la continuidad del flujo de reportabilidad ante ausencias o licencias:

1. **Configuración de Subrogante:**
   En la pantalla de edición de usuarios ([UsersPage.tsx](file:///c:/Users/marcelo.silva/Documents/proyecto%20indicadores%20AGE/gauge-wise-flows/src/pages/UsersPage.tsx)), un Administrador asigna un **Usuario Subrogante**.
2. **Notificaciones Duplicadas:**
   Cada notificación emitida por el sistema para un usuario que posee un subrogante activo se envía con copia al correo del subrogante.
3. **Eliminación Segura con Reasignación:**
   Al eliminar un usuario con responsabilidades activas, el sistema transfiere automáticamente todos los indicadores asignados y el historial de reportes al usuario subrogante, evitando huérfanos en la base de datos.

---

## ⚙️ Instalación, Configuración y Despliegue

### Requisitos Previos
- **Node.js**: v18.x o v20.x
- **npm** (v9+) o **bun**
- Proyecto en **Supabase** configurado con migraciones SQL del repositorio

### Pasos de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd gauge-wise-flows
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de entorno:**
   Cree un archivo `.env` en la raíz del proyecto:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu-anon-key
   ```

4. **Iniciar en modo desarrollo:**
   ```bash
   npm run dev
   ```

5. **Construir versión de producción:**
   ```bash
   npm run build
   ```

---

## 🧪 Pruebas y Verificación

- **Ejecutar pruebas unitarias (Vitest):**
  ```bash
  npm run test
  ```
- **Pruebas en modo observador (watch):**
  ```bash
  npm run test:watch
  ```
- **Verificación de calidad y linter:**
  ```bash
  npm run lint
  ```

---

## 🔒 Reglas de Negocio y Seguridad (RLS)

Las políticas RLS (Row Level Security) garantizan el aislamiento de datos por Centro de Responsabilidad e Institución:
- **Lectura de Reportes:** Permitida para usuarios autenticados según su rol y centro asignado.
- **Creación y Edición:** Restringida a Informantes asignados al indicador, Subrogantes vigentes, Revisores y Administradores.
- **Evidencias (`verification-documents`):** Subida restringida a usuarios autenticados con permiso sobre el reporte; descarga pública autenticada para la revisión.

Consulte la especificación completa en [DOCS_BUSINESS_RULES.md](./DOCS_BUSINESS_RULES.md).

---

## ⚖️ Propiedad Intelectual y Autorización de Uso

Esta aplicación es una obra original protegida bajo la **Ley N° 17.336 sobre Propiedad Intelectual en Chile**. Su propiedad intelectual pertenece exclusivamente a su autor y arquitecto de software, **Marcelo Silva Magna** (así como a cualquier estructura societaria en la cual tenga participación y hayan sido definidos como aporte de capital).

Su uso por parte de la **Comisión Nacional de Riego (CNR)** u otra entidad es de carácter **temporal, no exclusivo y revocable**, y **no implica bajo ninguna circunstancia la transferencia de propiedad ni cesión de derechos patrimoniales sobre ningún componente técnico, arquitectura o código fuente del sistema**.

Para más detalles consulte el archivo de [LICENCIA_DE_USO.md](./LICENCIA_DE_USO.md) / [LICENSE.md](./LICENSE.md).

## 👤 Autor

**Marcelo Silva Magna**  
*Ingeniero en Informática y Consultor de Negocios*  
*Desarrollador y Arquitecto de Software*


