import { ReportStatus, ObservationStatus } from '../types/database';

export interface EvaluationOption {
  id: string;
  label: string;
  bgColor: string;
  textColor: string;
  tooltip: string;
  status: 'approved' | 'rejected';
}

export const EVALUATION_OPTIONS: Record<string, EvaluationOption> = {
  avance_normal: {
    id: 'avance_normal',
    label: 'Avance Normal',
    bgColor: '#93D63B',
    textColor: '#ffffff',
    tooltip: 'ejecución de acuerdo con la programación definida por cada centro de responsabilidad.',
    status: 'approved',
  },
  bajo_programado: {
    id: 'bajo_programado',
    label: 'Bajo lo Programado',
    bgColor: '#D6C917',
    textColor: '#1a1a00',
    tooltip: 'ejecución menor a la programación establecida por el centro de responsabilidad.',
    status: 'approved',
  },
  en_riesgo: {
    id: 'en_riesgo',
    label: 'En riesgo de cumplimiento',
    bgColor: '#FF0000',
    textColor: '#ffffff',
    tooltip: 'ejecución significativamente menor a la programación definida, poniendo en riesgo la consecución de la meta establecida para el año.',
    status: 'approved',
  },
  inconsistente: {
    id: 'inconsistente',
    label: 'Inconsistente',
    bgColor: '#E5D2C4',
    textColor: '#4a2e1b',
    tooltip: 'los datos reportados no se condicen con lo definido en el indicador.',
    status: 'rejected',
  },
  incompleto: {
    id: 'incompleto',
    label: 'Incompleto',
    bgColor: '#00FFFF',
    textColor: '#004d4d',
    tooltip: 'no se entregan todos los antecedentes para determinar el avance del indicador.',
    status: 'rejected',
  },
  sin_reporte: {
    id: 'sin_reporte',
    label: 'Sin reporte',
    bgColor: '#E5E5E5',
    textColor: '#404040',
    tooltip: 'centro de responsabilidad no informa datos a la fecha de corte.',
    status: 'rejected',
  },
};

export const REPORT_STATUS_CONFIG: Record<ReportStatus, { label: string; className: string }> = {
  draft:        { label: 'Borrador',                                    className: 'bg-slate-100 text-slate-700' },
  submitted:    { label: 'En Revisión',                                 className: 'bg-indigo-100 text-indigo-700' },
  under_review: { label: 'En Revisión',                                 className: 'bg-indigo-100 text-indigo-700' },
  responded:    { label: 'Respondido — Pendiente',                      className: 'bg-violet-100 text-violet-700' },
  observed:     { label: 'Rechazado por AGE — Revisar Observaciones',   className: 'bg-rose-100 text-rose-700' },
  approved:     { label: 'Aprobado por AGE',                            className: 'bg-emerald-100 text-emerald-700' },
  rejected:     { label: 'Rechazado',                                   className: 'bg-rose-100 text-rose-700' },
};

export const OBSERVATION_STATUS_CONFIG: Record<ObservationStatus, { label: string; className: string }> = {
  open: { label: 'Abierta', className: 'bg-amber-100 text-amber-700' },
  answered: { label: 'Respondida', className: 'bg-blue-100 text-blue-700' },
  closed: { label: 'Cerrada', className: 'bg-slate-100 text-slate-700' },
};

export const ROLE_LABELS = {
  admin: 'Administrador',
  reviewer: 'Revisor',
  informant: 'Informante',
  jefatura: 'Jefatura',
} as const;

export const INSTITUTION_TYPE_LABELS = {
  public: 'Pública',
  private: 'Privada',
  autonomous: 'Autónoma',
} as const;

export const INDICATOR_TYPE_LABELS = {
  quantitative: 'Cuantitativo',
  qualitative: 'Cualitativo',
  quantity: 'Cantidad',
} as const;

export const FREQUENCY_LABELS = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  annually: 'Anual',
} as const;
