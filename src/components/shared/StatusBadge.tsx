import { cn } from '@/lib/utils';
import { REPORT_STATUS_CONFIG, OBSERVATION_STATUS_CONFIG, EVALUATION_OPTIONS } from '@/lib/constants';
import type { ReportStatus, ObservationStatus } from '@/types/database';

interface StatusBadgeProps {
  status: ReportStatus | ObservationStatus | string;
  evaluationStatus?: string | null;
  type?: 'report' | 'observation';
}

export function StatusBadge({ status, evaluationStatus, type = 'report' }: StatusBadgeProps) {
  if (evaluationStatus && EVALUATION_OPTIONS[evaluationStatus]) {
    const evalOpt = EVALUATION_OPTIONS[evaluationStatus];
    return (
      <span 
        title={evalOpt.tooltip}
        style={{ backgroundColor: evalOpt.bgColor, color: evalOpt.textColor }}
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm cursor-help transition-transform hover:scale-105"
      >
        {evalOpt.label}
      </span>
    );
  }

  const config = type === 'report'
    ? REPORT_STATUS_CONFIG[status as ReportStatus]
    : OBSERVATION_STATUS_CONFIG[status as ObservationStatus];

  if (!config) return null;

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
