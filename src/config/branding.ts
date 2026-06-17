/**
 * Configuración de marca y textos institucionales.
 * Centraliza los nombres, logotipos y metadatos para facilitar la adaptación del sistema a otras instituciones.
 */
export const BRANDING = {
  institution: {
    name: "Área de Gestión Estratégica",
    parent: "",
    shortName: "AGE",
  },
  system: {
    name: "Sistema de Gestión de Indicadores",
    acronym: "SGI",
    version: "v1.0",
  },
  assets: {
    logo: `${import.meta.env.BASE_URL || "/"}favicon.png`,
    favicon: `${import.meta.env.BASE_URL || "/"}favicon.png`,
  },
  meta: {
    title: "SGI - Sistema de Gestión de Indicadores",
    description: "Plataforma para el reporte, revisión y aprobación de indicadores de gestión.",
  },
};
