import type { ReportStatus, ObservationStatus } from '@/types/database';

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
