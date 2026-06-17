export type UserRole = 'admin' | 'reviewer' | 'informant' | 'jefatura';
export type InstitutionType = 'public' | 'private' | 'autonomous';
export type IndicatorType = 'quantitative' | 'qualitative';
export type ReportingFrequency = 'monthly' | 'quarterly' | 'annually';
export type PeriodStatus = 'open' | 'closed';
export type ReportStatus = 'draft' | 'submitted' | 'under_review' | 'observed' | 'responded' | 'approved' | 'rejected';
export type ObservationStatus = 'open' | 'answered' | 'closed';

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  institution_id: string | null;
  created_at: string;
  institution?: Institution;
}

export interface Indicator {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  target_value: number;
  indicator_type: IndicatorType;
  reporting_frequency: ReportingFrequency;
  is_active: boolean;
  created_at: string;
}

export interface Period {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
}

export interface IndicatorReport {
  id: string;
  indicator_id: string;
  institution_id: string;
  period_id: string;
  reported_value: number | null;
  comment: string | null;
  status: ReportStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  indicator?: Indicator;
  institution?: Institution;
  period?: Period;
  creator?: Profile;
}

export interface Observation {
  id: string;
  report_id: string;
  user_id: string;
  comment: string;
  status: ObservationStatus;
  created_at: string;
  user?: Profile;
  responses?: ObservationResponse[];
}

export interface ObservationResponse {
  id: string;
  observation_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user?: Profile;
}

export interface Attachment {
  id: string;
  report_id: string;
  observation_id: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  uploaded_by: string;
  created_at: string;
}
