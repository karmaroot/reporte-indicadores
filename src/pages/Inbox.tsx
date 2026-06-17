import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Inbox as InboxIcon, FileBarChart, Eye, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMyAssignments } from '@/hooks/useInstruments';
import { useReports, usePeriods } from '@/hooks/useSupabaseQuery';
import { useSubmitReport, useResubmitReport } from '@/hooks/useSupabaseMutations';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FREQUENCY_LABELS } from '@/lib/constants';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { ReportIndicatorDialog } from '@/components/dialogs/ReportIndicatorDialog';
import { ReviewReportDialog } from '@/components/dialogs/ReviewReportDialog';

export default function InboxPage() {
  const { user, userRole } = useAuth();
  const { data: assignments, isLoading } = useMyAssignments(user?.id);
  const { data: reports } = useReports();
  const { data: periods } = usePeriods();
  const submitReport = useSubmitReport();
  const resubmitReport = useResubmitReport();

  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') ?? 'assignments';

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [resubmitTarget, setResubmitTarget] = useState<any>(null);

  // Reviewer dialog
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}/${parts[0]}`;
  };

  const now = new Date();
  const activePeriod = (periods ?? []).find(p => {
    if (p.status !== 'open') return false;
    const [sYear, sMonth, sDay] = p.start_date.split('-').map(Number);
    const startDate = new Date(sYear, sMonth - 1, sDay, 0, 0, 0);
    const [eYear, eMonth, eDay] = p.end_date.split('-').map(Number);
    const endDate = new Date(eYear, eMonth - 1, eDay, 23, 59, 59);
    return startDate <= now && endDate >= now;
  });

  const myAsInformant = (assignments ?? []).filter((a: any) => a.informant_id === user?.id);
  const myAsReviewer = (assignments ?? []).filter((a: any) => a.reviewer_id === user?.id);

  const myReportIds = new Set(myAsInformant.map((a: any) => a.indicator_id));
  const myReports = (reports ?? []).filter(r => r.created_by === user?.id || myReportIds.has(r.indicator_id));

  // Reports returned to informant (observed)
  const returnedReports = myReports.filter(r => r.status === 'observed');

  // Reports reviewer needs to review
  const reviewIndicatorIds = new Set(myAsReviewer.map((a: any) => a.indicator_id));
  const reviewReports = (reports ?? []).filter(r => reviewIndicatorIds.has(r.indicator_id) && ['submitted', 'responded'].includes(r.status));

  function hasActiveReportForPeriod(assignment: any) {
    if (!activePeriod) return false;
    return (reports ?? []).some(r =>
      r.indicator_id === assignment.indicator_id &&
      r.period_id === activePeriod.id &&
      ['submitted', 'under_review', 'responded', 'approved'].includes(r.status)
    );
  }

  function getReportForPeriod(assignment: any) {
    if (!activePeriod) return null;
    return (reports ?? []).find(r =>
      r.indicator_id === assignment.indicator_id &&
      r.period_id === activePeriod.id
    ) ?? null;
  }

  function handleOpenReport(assignment: any) {
    setSelectedAssignment(assignment);
    setResubmitTarget(null);
    setReportDialogOpen(true);
  }

  function handleOpenResubmit(report: any, assignment: any) {
    setSelectedAssignment(assignment);
    setResubmitTarget(report);
    setReportDialogOpen(true);
  }

  function handleSubmitReport(values: any) {
    if (!user) return;
    if (resubmitTarget) {
      resubmitReport.mutate(
        { reportId: resubmitTarget.id, ...values },
        { onSuccess: () => setReportDialogOpen(false) },
      );
    } else {
      submitReport.mutate(
        { ...values, created_by: user.id },
        { onSuccess: () => setReportDialogOpen(false) },
      );
    }
  }

  return (
    <AppLayout>
      <PageHeader title="Bandeja de Entrada" description="Tus asignaciones y tareas pendientes" />

      {activePeriod && (
        <div className="mb-4 rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
          Periodo activo: <span className="font-medium text-foreground">{activePeriod.name}</span>
          {' '}({formatDateSafe(activePeriod.start_date)} — {formatDateSafe(activePeriod.end_date)})
        </div>
      )}

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments">Mis Asignaciones</TabsTrigger>
          <TabsTrigger value="returned" className="relative">
            Devueltos
            {returnedReports.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-[10px] font-bold text-white">{returnedReports.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reports">Mis Reportes</TabsTrigger>
          <TabsTrigger value="review" className="relative">
            Por Revisar
            {reviewReports.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{reviewReports.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Assignments tab */}
        <TabsContent value="assignments">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : !(assignments ?? []).length ? (
            <EmptyState icon={InboxIcon} title="Sin asignaciones" description="No tienes instrumentos/indicadores asignados." />
          ) : (
            <div className="space-y-3">
              {(assignments ?? []).map((a: any) => {
                const isInformant = a.informant_id === user?.id;
                const existingReport = getReportForPeriod(a);
                const alreadySubmitted = hasActiveReportForPeriod(a);
                const canReport = isInformant && activePeriod && !alreadySubmitted;

                return (
                  <div
                    key={a.id}
                    className="bg-card rounded-lg shadow-card p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{(a.indicators as any)?.name}</h4>
                        <p className="text-xs text-muted-foreground">{(a.instruments as any)?.name} — {(a.instruments as any)?.institutions?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {FREQUENCY_LABELS[a.periodicity as keyof typeof FREQUENCY_LABELS] ?? a.periodicity}
                        </Badge>
                        {isInformant && <Badge className="text-[10px] bg-blue-100 text-blue-700">Informante</Badge>}
                        {a.reviewer_id === user?.id && <Badge className="text-[10px] bg-indigo-100 text-indigo-700">Revisor</Badge>}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Meta: {(a.indicators as any)?.target_value} {(a.indicators as any)?.unit}
                      </span>
                      <div className="flex items-center gap-2">
                        {isInformant && activePeriod && alreadySubmitted && existingReport && (
                          <StatusBadge status={existingReport.status as any} />
                        )}
                        {canReport && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleOpenReport(a); }}>
                            <FileBarChart className="h-3.5 w-3.5 mr-1" />Reportar
                          </Button>
                        )}
                        {isInformant && !activePeriod && (
                          <Badge variant="outline" className="text-[10px]">Sin periodo activo</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Returned reports tab */}
        <TabsContent value="returned">
          {!returnedReports.length ? (
            <EmptyState icon={AlertTriangle} title="Sin reportes devueltos" description="No tienes reportes con observaciones pendientes." />
          ) : (
            <div className="space-y-3">
              {returnedReports.map(r => {
                const assignment = myAsInformant.find((a: any) => a.indicator_id === r.indicator_id);
                return (
                  <div key={r.id} className="bg-card rounded-lg shadow-card p-4 border-l-4 border-amber-400">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{(r.indicators as any)?.name}</h4>
                        <p className="text-xs text-muted-foreground">{(r.institutions as any)?.name} — {(r.periods as any)?.name}</p>
                        {(r as any).returned_at && (
                          <p className="text-[10px] text-amber-600 mt-1">Devuelto: {new Date((r as any).returned_at).toLocaleString('es')}</p>
                        )}
                      </div>
                      <StatusBadge status={r.status as any} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/reports/${r.id}`}><Eye className="h-3.5 w-3.5 mr-1" />Ver Observaciones</Link>
                      </Button>
                      {assignment && (
                        <Button size="sm" onClick={() => handleOpenResubmit(r, assignment)}>
                          Corregir y Reenviar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* My reports tab */}
        <TabsContent value="reports">
          {!myReports.length ? (
            <EmptyState icon={FileBarChart} title="Sin reportes" description="No tienes reportes asignados." />
          ) : (
            <div className="bg-card rounded-lg shadow-card divide-y">
              {myReports.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{(r.indicators as any)?.name}</p>
                    <p className="text-xs text-muted-foreground">{(r.institutions as any)?.name} — {(r.periods as any)?.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status as any} />
                    <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                      <Link to={`/reports/${r.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Review tab */}
        <TabsContent value="review">
          {!reviewReports.length ? (
            <EmptyState icon={Eye} title="Nada por revisar" description="No tienes reportes pendientes de revisión." />
          ) : (
            <div className="bg-card rounded-lg shadow-card divide-y">
              {reviewReports.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{(r.indicators as any)?.name}</p>
                    <p className="text-xs text-muted-foreground">{(r.institutions as any)?.name} — {(r.periods as any)?.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{new Date(r.created_at).toLocaleString('es')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status as any} />
                    <Button 
                      size="sm"
                      onClick={() => { setSelectedReport(r); setReviewDialogOpen(true); }}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />Revisar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Report submission / resubmission dialog */}
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
