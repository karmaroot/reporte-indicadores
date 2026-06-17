import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Activity, FileBarChart, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useReports, useReportCounts, useIndicators, usePeriods } from '@/hooks/useSupabaseQuery';
import { useMyAssignments } from '@/hooks/useInstruments';
import { useSubmitReport, useResubmitReport } from '@/hooks/useSupabaseMutations';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ReportIndicatorDialog } from '@/components/dialogs/ReportIndicatorDialog';
import { ReviewReportDialog } from '@/components/dialogs/ReviewReportDialog';
import AdminDashboard from './AdminDashboard';

export default function Dashboard() {
  const { user, userRole } = useAuth();

  if (userRole === 'jefatura') {
    return <AdminDashboard />;
  }

  const filter = { userId: user?.id, role: userRole };

  const { data: reports, isLoading: reportsLoading } = useReports(filter);
  const { data: counts, isLoading: countsLoading } = useReportCounts(filter);
  const { data: indicators } = useIndicators(filter);
  const { data: assignments } = useMyAssignments(user?.id);
  const { data: periods } = usePeriods();

  const formatReportedValue = (val: any, indicator: any) => {
    if (val === null || val === undefined) return '0';
    const num = Number(val);
    const unitLower = indicator?.unit?.toLowerCase().trim() ?? '';
    const isQuantity = indicator?.indicator_type === 'quantity' || unitLower === 'cantidad';
    if (isQuantity) {
      return Number.isInteger(num) ? `${num}` : `${num.toFixed(2)}`;
    }
    return `${num.toFixed(2)}`;
  };
  
  const submitReport = useSubmitReport();
  const resubmitReport = useResubmitReport();

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [resubmitTarget, setResubmitTarget] = useState<any>(null);

  // Reviewer dialog
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const activePeriod = (periods ?? []).find(p => p.status === 'open');

  const approvedReports = reports?.filter(r => r.status === 'approved') ?? [];
  const barData = approvedReports.slice(0, 5).map(r => ({
    name: (r.indicators as any)?.name?.substring(0, 12) ?? '',
    target: (r.indicators as any)?.target_value ?? 0,
    reported: Number(r.reported_value) || 0,
  }));

  // Deduplicate: keep only the latest report per indicator+period
  const deduplicatedReports = Object.values(
    (reports ?? []).reduce((acc: Record<string, any>, r: any) => {
      const key = `${r.indicator_id}__${r.period_id}`;
      if (!acc[key] || new Date(r.created_at) > new Date(acc[key].created_at)) {
        acc[key] = r;
      }
      return acc;
    }, {})
  ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const recentReports = deduplicatedReports.slice(0, 5);

  const handleOpenReport = (report: any) => {
    const assignment = (assignments ?? []).find((a: any) => a.indicator_id === report.indicator_id);
    if (!assignment) return;
    
    setSelectedAssignment(assignment);
    if (report.status === 'observed') {
      setResubmitTarget(report);
    } else {
      setResubmitTarget(null);
    }
    setReportDialogOpen(true);
  };

  const handleSubmitReport = (values: any) => {
    if (!user) return;
    if (resubmitTarget) {
      resubmitReport.mutate(
        { reportId: resubmitTarget.id, ...values, userId: user.id },
        { onSuccess: () => setReportDialogOpen(false) },
      );
    } else {
      submitReport.mutate(
        { ...values, created_by: user.id },
        { onSuccess: () => setReportDialogOpen(false) },
      );
    }
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Dashboard" 
        description={userRole === 'admin' ? "Resumen general del sistema de indicadores" : `Mi resumen — ${userRole?.charAt(0).toUpperCase()}${userRole?.slice(1)}`} 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {countsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <Link to="/indicators" className="transition-transform hover:scale-[1.02] active:scale-[0.98]">
              <KpiCard title="Total Indicadores" value={indicators?.length ?? 0} icon={Activity} subtitle={userRole === 'admin' ? "Indicadores registrados" : "Mis indicadores asignados"} />
            </Link>
            <Link to="/inbox" className="transition-transform hover:scale-[1.02] active:scale-[0.98]">
              <KpiCard
                title="Reportes Pendientes"
                value={counts?.pending ?? 0}
                icon={FileBarChart}
                subtitle="En espera de revisión"
              />
            </Link>
            <Link to="/reports?status=approved" className="transition-transform hover:scale-[1.02] active:scale-[0.98]">
              <KpiCard
                title="Reportes Aprobados"
                value={counts?.approved ?? 0}
                icon={CheckCircle2}
                subtitle={(() => {
                  const totalIndicators = indicators?.length ?? 0;
                  const pct = totalIndicators > 0 ? Math.round(((counts?.approved ?? 0) / totalIndicators) * 100) : 0;
                  return `${pct}% tasa de aprobación`;
                })()}
              />
            </Link>
            <Link to="/inbox?tab=returned" className="transition-transform hover:scale-[1.02] active:scale-[0.98]">
              <KpiCard title="Observaciones" value={counts?.observed ?? 0} icon={AlertTriangle} subtitle="Requieren corrección" />
            </Link>
          </>
        )}
      </div>

      <div className="bg-card rounded-lg shadow-card mb-8">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Reportes Recientes</h3>
          {userRole === 'informant' && (
            <Link to="/inbox" className="text-xs text-primary font-medium hover:underline">Ver todas mis asignaciones</Link>
          )}
        </div>
        <div className="divide-y">
          {reportsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 mx-6 my-2 rounded" />)
          ) : recentReports.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">No hay reportes aún.</p>
          ) : (
            recentReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{(report.indicators as any)?.name}</p>
                  <p className="text-xs text-muted-foreground">{(report.institutions as any)?.name} — {(report.periods as any)?.name}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-foreground">{formatReportedValue(report.reported_value, report.indicators)}</p>
                    <p className="text-[10px] text-muted-foreground">Valor reportado</p>
                  </div>
                  <StatusBadge status={report.status as any} />
                  
                  {userRole === 'informant' && ['draft', 'observed'].includes(report.status) && (
                    <Button size="sm" onClick={() => handleOpenReport(report)} className="h-8 shadow-sm">
                      {report.status === 'draft' ? (
                        <><FileBarChart className="h-3.5 w-3.5 mr-1.5" /> Reportar</>
                      ) : (
                        <><FileText className="h-3.5 w-3.5 mr-1.5" /> Corregir</>
                      )}
                    </Button>
                  )}

                  {(userRole === 'reviewer' || userRole === 'admin') && ['submitted', 'responded'].includes(report.status) && (
                    <Button
                      size="sm"
                      className="h-8 shadow-sm"
                      onClick={() => { setSelectedReport(report); setReviewDialogOpen(true); }}
                    >
                      Revisar
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ReportIndicatorDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        assignment={selectedAssignment}
        activePeriod={activePeriod}
        onSubmit={handleSubmitReport}
        loading={submitReport.isPending || resubmitReport.isPending}
        existingReport={resubmitTarget}
      />

      <ReviewReportDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        report={selectedReport}
      />
    </AppLayout>
  );
}

