import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Paperclip, Send, CheckCircle, XCircle, Clock, Loader2, Download, AlertCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Textarea } from '@/components/ui/textarea';
import { useReport, useObservations, useAttachments } from '@/hooks/useSupabaseQuery';
import { useApproveReport, useRejectReport, useRespondObservation } from '@/hooks/useSupabaseMutations';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ReportDetail() {
  const { id } = useParams();
  const { user, userRole } = useAuth();
  const { data: report, isLoading } = useReport(id);
  const { data: observations } = useObservations(id);
  const { data: attachments } = useAttachments(id);

  const formatReportedValue = (val: any, indicator: any) => {
    if (val === null || val === undefined) return '—';
    const num = Number(val);
    const unitLower = indicator?.unit?.toLowerCase().trim() ?? '';
    const isQuantity = indicator?.indicator_type === 'quantity' || unitLower === 'cantidad';
    if (isQuantity) {
      return Number.isInteger(num) ? `${num}` : `${num.toFixed(2)}`;
    }
    return `${num.toFixed(2)}`;
  };

  const approveReport = useApproveReport();
  const rejectReport = useRejectReport();
  const respondObservation = useRespondObservation();

  const [rejectComment, setRejectComment] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  if (isLoading) return (
    <AppLayout>
      <div className="space-y-4 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
    </AppLayout>
  );

  if (!report) return (
    <AppLayout>
      <div className="text-center py-12">
        <p className="text-muted-foreground">Reporte no encontrado.</p>
        <Link to="/reports" className="text-primary text-sm hover:underline mt-2 inline-block">Volver a Reportes</Link>
      </div>
    </AppLayout>
  );

  const ind = report.indicators as any;
  const inst = report.institutions as any;
  const per = report.periods as any;
  const creator = report.creator as any;

  const isReviewer = userRole === 'reviewer' || userRole === 'admin';
  const isInformant = report.created_by === user?.id;
  const canReview = isReviewer && ['submitted', 'responded'].includes(report.status);
  const canRespondObs = isInformant && report.status === 'observed';

  function handleApprove() {
    approveReport.mutate(report!.id);
  }

  function handleReject() {
    if (!rejectComment.trim() || !user) return;
    rejectReport.mutate({ reportId: report!.id, comment: rejectComment, userId: user.id });
    setRejectComment('');
    setShowRejectForm(false);
  }

  function handleRespondObs(observationId: string) {
    if (!responseText.trim() || !user) return;
    respondObservation.mutate({ observationId, comment: responseText, userId: user.id });
    setResponseText('');
    setRespondingTo(null);
  }

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('verification-documents').download(filePath);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error('Error al descargar: ' + error.message);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <Link to="/reports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" />Volver a Reportes
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Report details */}
          <div className="bg-card rounded-lg shadow-card p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">{ind?.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">{ind?.description}</p>
              </div>
              <StatusBadge status={report.status as any} />
            </div>

            {/* Zero Report Alert Indicator */}
            {report.is_zero_report && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800 mb-6">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">Reporte de Avance "Cero"</p>
                  <p className="text-xs font-medium leading-relaxed mt-1">
                    El informante ha seleccionado la opción de <span className="font-bold underline">Reportar avance "Cero"</span> para este periodo. Por lo tanto, el numerador y denominador han sido deshabilitados y establecidos en cero.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground mb-1">Centro de Responsabilidad</p><p className="text-sm font-medium text-foreground">{inst?.name}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Periodo</p><p className="text-sm font-medium text-foreground">{per?.name}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Valor Reportado</p><p className="text-2xl font-semibold text-foreground">{formatReportedValue(report.reported_value, ind)}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Programado</p><p className="text-2xl font-semibold text-muted-foreground">{formatReportedValue(ind?.target_value, ind)}</p></div>
            </div>

            {/* Numerator / Denominator */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground mb-1">Numerador</p><p className="text-sm font-medium text-foreground">{report.numerator ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Denominador</p><p className="text-sm font-medium text-foreground">{report.denominator ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Mes de Reporte</p><p className="text-sm font-medium text-foreground">{report.reporting_month ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Unidad</p><p className="text-sm font-medium text-foreground">{ind?.unit ?? '—'}</p></div>
            </div>

            {(report as any).verification_method && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Medio de Verificación</p>
                <p className="text-sm text-foreground">{(report as any).verification_method}</p>
              </div>
            )}

            {report.comment && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Observaciones del Informante</p>
                <p className="text-sm text-foreground">{report.comment}</p>
              </div>
            )}

            {/* Dates */}
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Fecha de Envío</p>
                  <p className="text-xs font-mono text-foreground">{new Date(report.created_at).toLocaleString('es')}</p>
                </div>
              </div>
              {(report as any).reviewed_at && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Fecha de Revisión</p>
                    <p className="text-xs font-mono text-foreground">{new Date((report as any).reviewed_at).toLocaleString('es')}</p>
                  </div>
                </div>
              )}
              {(report as any).returned_at && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-amber-600" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Fecha de Devolución</p>
                    <p className="text-xs font-mono text-foreground">{new Date((report as any).returned_at).toLocaleString('es')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Observations thread */}
          <div className="bg-card rounded-lg shadow-card">
            <div className="p-6 border-b"><h3 className="text-sm font-medium text-foreground">Observaciones</h3></div>
            <div className="p-6 space-y-6">
              {(observations ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin observaciones.</p>
              ) : (
                observations!.map((obs: any) => (
                  <div key={obs.id} className="relative">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-amber-700">{obs.reviewer?.name?.[0] ?? 'R'}</span>
                        </div>
                        {(obs.observation_responses?.length > 0 || (canRespondObs && obs.status === 'open')) && <div className="w-px flex-1 bg-border mt-2" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{obs.reviewer?.name || 'Revisor'}</span>
                          <StatusBadge status={obs.status} type="observation" />
                        </div>
                        <p className="text-sm text-foreground">{obs.comment}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">{new Date(obs.created_at).toLocaleString('es')}</p>
                      </div>
                    </div>

                    {obs.observation_responses?.map((resp: any) => (
                      <div key={resp.id} className="flex gap-3 ml-4">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary">{resp.informant?.name?.[0] ?? '?' }</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">{resp.informant?.name || 'Anónimo'}</span>
                          <p className="text-sm text-foreground">{resp.comment}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono">{new Date(resp.created_at).toLocaleString('es')}</p>
                        </div>
                      </div>
                    ))}

                    {/* Respond to open observation (informant) */}
                    {canRespondObs && obs.status === 'open' && (
                      <div className="ml-4 mt-2">
                        {respondingTo === obs.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Escribe tu respuesta..."
                              value={responseText}
                              onChange={e => setResponseText(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => { setRespondingTo(null); setResponseText(''); }}>Cancelar</Button>
                              <Button size="sm" onClick={() => handleRespondObs(obs.id)} disabled={!responseText.trim() || respondObservation.isPending}>
                                {respondObservation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                                Responder
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setRespondingTo(obs.id)}>
                            Responder observación
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Reviewer actions */}
          {canReview && (
            <div className="bg-card rounded-lg shadow-card p-6 space-y-3">
              <h3 className="text-sm font-medium text-foreground mb-4">Acciones del Revisor</h3>

              {!showRejectForm ? (
                <>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 text-amber-700 hover:bg-amber-50 border-amber-200"
                      onClick={() => setShowRejectForm(true)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />Observar
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleApprove}
                      disabled={approveReport.isPending}
                    >
                      {approveReport.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      Aprobar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Describe las observaciones para el informante..."
                    value={rejectComment}
                    onChange={e => setRejectComment(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => { setShowRejectForm(false); setRejectComment(''); }}>Cancelar</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={handleReject}
                      disabled={!rejectComment.trim() || rejectReport.isPending}
                    >
                      {rejectReport.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Devolver con Observaciones
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status info for informant when observed */}
          {isInformant && report.status === 'observed' && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <p className="text-sm font-medium text-amber-800 mb-1">⚠️ Reporte devuelto</p>
              <p className="text-xs text-amber-700">Revisa las observaciones del revisor y corrige tu reporte desde la Bandeja de Entrada.</p>
            </div>
          )}

          {/* Attachments */}
          <div className="bg-card rounded-lg shadow-card p-6">
            <h3 className="text-sm font-medium text-foreground mb-4">Evidencia Adjunta</h3>
            {(attachments ?? []).length === 0 ? (
              report.verification_method ? (
                <div className="flex items-center justify-between p-3 rounded-md bg-amber-50/50 border border-amber-100 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-900 truncate">{report.verification_method}</p>
                      <p className="text-[10px] text-amber-700 italic">Respaldo (Sistema anterior)</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDownload(report.verification_method!, report.verification_method!)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin archivos adjuntos.</p>
              )
            ) : (
              <div className="space-y-2">
                {attachments!.map((att: any) => (
                  <div key={att.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{att.file_name}</p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDownload(att.file_url, att.file_name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-card rounded-lg shadow-card p-6">
            <h3 className="text-sm font-medium text-foreground mb-4">Información</h3>
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Creado por:</span> <span className="text-foreground">{creator?.name ?? '—'}</span></div>
              <div><span className="text-muted-foreground">Fecha:</span> <span className="text-foreground font-mono text-xs">{new Date(report.created_at).toLocaleDateString('es')}</span></div>
              {report.updated_at !== report.created_at && (
                <div><span className="text-muted-foreground">Última actualización:</span> <span className="text-foreground font-mono text-xs">{new Date(report.updated_at).toLocaleString('es')}</span></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
