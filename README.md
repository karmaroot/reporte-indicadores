# SGI – Sistema de Gestión de Indicadores (AGE / CNR)

**Plataforma Integral de Gestión, Reportabilidad, Validación y Monitoreo Estratégico de Indicadores de Gestión Institucional.**

---

## 📋 Índice
1. [Resumen del Proyecto](#-resumen-del-proyecto)
2. [Roles y Permisos del Sistema](#-roles-y-permisos-del-sistema)
3. [Características Principales](#-características-principales)
4. [Arquitectura y Tecnologías](#-arquitectura-y-tecnologías)
5. [Estructura del Proyecto](#-estructura-del-proyecto)
6. [Sistema de Alertas y Servicio Puente (Bridge Worker)](#-sistema-de-alertas-y-servicio-puente-bridge-worker)
7. [Instalación, Configuración y Despliegue](#-instalación-configuración-y-despliegue)
8. [Pruebas y Verificación](#-pruebas-y-verificación)
9. [Reglas de Negocio y Seguridad (RLS)](#-reglas-de-negocio-y-seguridad-rls)
10. [Propiedad Intelectual y Autorización de Uso](#-propiedad-intelectual-y-autorización-de-uso)
11. [Autor](#-autor)

---

## 🚀 Resumen del Proyecto

El **Sistema de Gestión de Indicadores (SGI)** es una solución web integral diseñada para controlar, validar y visualizar el cumplimiento de los indicadores institucionales de gestión.

Facilita la trazabilidad total del ciclo de reportabilidad:
- **Carga de Datos:** Ingreso de valores por periodo, fórmulas (numerador/denominador), observaciones y adjuntos de evidencia.
- **Revisión y Control:** Aprobación o devolución técnica con observaciones en un hilo de comunicación interactivo.
- **Monitoreo Directivo:** Cuadro de mando estratégico ejecutivo con indicadores animados y gráficos comparativos en tiempo real.
- **Automatización y Notificaciones:** Inicio automático de periodos (*Auto-Start*) con arrastre de datos previos y motor asíncrono de alertas por correo electrónico.

---

## 👥 Roles y Permisos del Sistema

- **Informante**: 
  - Ingreso de datos mensuales, trimestrales y anuales.
  - Carga de medios de verificación (documentos de respaldo).
  - Declaración simplificada mediante **Reporte de Avance Cero** para periodos sin actividad.
  - Corrección de reportes observados y respuesta directa al revisor.
- **Revisor**: 
  - Validación técnica de la información cargada y los documentos adjuntos.
  - Aprobación de reportes o devolución con observaciones fundamentadas.
  - Hilo de comunicación y trazabilidad con el informante sobre el mismo reporte.
- **Jefatura**: 
  - Rol estratégico y directivo con acceso exclusivo al **Cuadro de Mando Estratégico**.
  - Monitoreo en tiempo real del cumplimiento por Centros de Responsabilidad.
  - Visualización interactiva con indicadores de cilindro líquido (**LiquidDrum**) y gráficos comparativos.
- **Administrador**: 
  - Gestión centralizada de usuarios, perfiles, instituciones, indicadores y periodos.
  - Control e inicio automático masivo o individual de procesos de reporte (*Auto-Start*).
  - Configuración de servidores SMTP, plantillas de correo y supervisión de la cola de notificaciones.
  - Carga masiva de indicadores mediante plantilla CSV.

---

## ✨ Características Principales

1. **Cuadro de Mando Estratégico (Executive Dashboard)**:
   - Visualización con cilindros líquidos animados (**LiquidDrum** impulsado por `Framer Motion`) para representar porcentajes de avance de manera intuitiva y atractiva.
   - Gráficos comparativos dinámicos (`Recharts`) que contrastan en tiempo real la Meta Anual, la Meta Programada del periodo y el Avance Real logrado.
   - Filtros avanzados por Centro de Responsabilidad, periodo y estado del indicador.

2. **Inicio Automático de Periodos (Auto-Start)**:
   - Gatillado masivo o individual para iniciar nuevos periodos de reporte.
   - Arrastre automático de numeradores, denominadores y comentarios previos.
   - Duplicación de evidencias y adjuntos en estado **Borrador**, agilizando significativamente la carga recurrente de datos.

3. **Reporte de Avance "Cero"**:
   - Opción simplificada para declarar periodos sin actividad o con avance cero de forma ágil, omitiendo la carga forzada de numeradores, denominadores o archivos adicionales.

4. **Gestión Integral de Evidencias**:
   - Almacenamiento y gestión de archivos integrados con Supabase Storage (`verification-documents`).
   - Descarga y visualización directa por parte de los revisores.

5. **Motor de Alertas y Notificaciones por Correo**:
   - Módulo de administración de parámetros SMTP (Servidor, Puerto, Seguridad TLS/SSL, Credenciales).
   - Cola de correos en base de datos (`email_queue`) con eventos para envio de reportes, observaciones, aprobaciones y reseteo de claves.
   - **Servicio Puente (Bridge Worker)**: Microservicio desacoplado en Node.js que procesa asíncronamente la cola y despacha los correos a través del servidor SMTP institucional.

6. **Exportación de Informes**:
   - Exportación de tableros e informes a PDF y Excel/CSV mediante `jsPDF`, `html2pdf.js` y `html2canvas`.

7. **Seguridad y Control RLS (Row Level Security)**:
   - Políticas avanzadas en PostgreSQL/Supabase que aseguran que cada informante y jefatura acceda estrictamente a la información de los Centros de Responsabilidad autorizados.

---

## 🛠️ Arquitectura y Tecnologías

### Frontend
- **Core:** React 18, TypeScript, Vite.
- **Enrutamiento y Estado:** React Router v6, TanStack Query (React Query v5).
- **Estilos e Interfaz:** Tailwind CSS, Radix UI, Shadcn UI patterns, Lucide Icons, Sonner (notificaciones toast).
- **Visualización y Animaciones:** Framer Motion, Recharts.
- **Exportación:** jsPDF, html2pdf.js, html2canvas.

### Backend & Servicios
- **Base de Datos & Auth:** Supabase (PostgreSQL, Auth, Storage, Edge Functions Deno/TypeScript).
- **Edge Functions:** `send-notification`, `create-user`.
- **Servicio Puente (Bridge Worker):** Node.js + `Nodemailer` (`bridge-worker/`) para procesamiento en segundo plano de la cola de notificaciones SMTP.

### Testing y Calidad
- **Pruebas Unitarias y Componentes:** Vitest, React Testing Library.
- **Pruebas E2E:** Playwright.
- **Linter:** ESLint 9.

---

## 📂 Estructura del Proyecto

```text
gauge-wise-flows/
├── bridge-worker/             # Servicio Puente (Node.js) para envío de correos SMTP
│   ├── worker.js              # Procesador asíncrono de la cola email_queue
│   └── start-worker.bat       # Script de inicio en Windows para el servicio puente
├── public/                    # Recursos estáticos y activos públicos
├── src/                       # Código fuente Frontend (React + TypeScript)
│   ├── components/            # Componentes UI, modales, gráficos y cuadros de mando
│   ├── config/                # Configuraciones globales y constantes
│   ├── hooks/                 # Custom Hooks de React (React Query, Auth, etc.)
│   ├── integrations/          # Cliente y tipos autogenerados de Supabase
│   ├── lib/                   # Utilidades generales y generadores de documentos
│   ├── pages/                 # Páginas principales (Dashboard, Admin, Reports, Inbox, etc.)
│   └── types/                 # Definición de interfaces y tipos TypeScript
├── supabase/                  # Artefactos backend de Supabase
│   ├── functions/             # Edge Functions (send-notification, create-user)
│   └── migrations/            # Migraciones SQL y políticas de seguridad RLS
├── DOCS_BUSINESS_RULES.md     # Especificación de Reglas de Negocio y RLS
├── DOCS_REGISTRO_PI/          # Documentación legal y técnica de Propiedad Intelectual
├── README.md                  # Documentación principal del proyecto
└── package.json               # Scripts y dependencias del proyecto
```

---

## 📧 Sistema de Alertas y Servicio Puente (Bridge Worker)

El envío de notificaciones opera de forma asíncrona y desacoplada del cliente para garantizar la confiabilidad y el rendimiento de la interfaz:

1. **Tabla `email_queue`:** Almacena las notificaciones pendientes generadas por eventos del sistema.
2. **Servicio Puente (`bridge-worker`):**
   - Monitorea periódicamente los registros pendientes en `email_queue`.
   - Obtiene la configuración SMTP vigente desde la base de datos (`smtp_settings`).
   - Envía los correos institucionales a través de `Nodemailer`.
   - Registra el resultado del envío (`sent` / `failed`) y almacena los mensajes de error en caso de fallo.

### Ejecución del Servicio Puente
```bash
cd bridge-worker
npm install
node worker.js
```
*En entornos Windows, también se puede ejecutar haciendo doble clic o corriendo `bridge-worker/start-worker.bat`.*

---

## ⚙️ Instalación y Configuración Local

### Requisitos Previos
- **Node.js**: v18.x o superior
- **npm** o **bun**
- Proyecto configurado en **Supabase**

### Pasos de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd gauge-wise-flows
   ```

2. **Instalar dependencias del proyecto:**
   ```bash
   npm install
   ```

3. **Configurar las variables de entorno:**
   Cree un archivo `.env` en la raíz del proyecto con la configuración de Supabase:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu-anon-key
   ```

4. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

5. **Construir para producción:**
   ```bash
   npm run build
   ```

---

## 🧪 Pruebas y Verificación

- **Ejecutar suite de pruebas unitarias:**
  ```bash
  npm run test
  ```
- **Ejecutar pruebas en modo watch:**
  ```bash
  npm run test:watch
  ```
- **Verificar linter de código:**
  ```bash
  npm run lint
  ```

---

## 🔒 Reglas de Negocio y Políticas RLS

Para información detallada sobre las políticas de seguridad en la base de datos (RLS) y la gestión del flujo de revisión y evidencias, consulte:
[DOCS_BUSINESS_RULES.md](./DOCS_BUSINESS_RULES.md).

---

## ⚖️ Propiedad Intelectual y Autorización de Uso

Esta aplicación es una obra original y su propiedad intelectual pertenece exclusivamente a su creador, **Marcelo Silva Magna**. Su uso por parte de cualquier institución u organización es de carácter autorizado y no implica transferencia de propiedad ni derechos sobre el código fuente, la arquitectura o la lógica de negocio del sistema.

---

## 👤 Autor

**Marcelo Silva Magna**  
*Ingeniero en Informática y Consultor de Negocios*

