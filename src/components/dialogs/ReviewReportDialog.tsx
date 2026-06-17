import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  CheckCircle2, XCircle, Loader2, Calendar, Tag, BookOpen, User,
  Paperclip, MessageSquare, Clock, Info, X, FileText, Download, AlertCircle
} from 'lucide-react';
import { useApproveReport, useRejectReport } from '@/hooks/useSupabaseMutations';
import { useObservations, useAttachments } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReviewReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: any | null;
}

export function ReviewReportDialog({ open, onOpenChange, report }: ReviewReportDialogProps) {
  const { user } = useAuth();
  const approveReport = useApproveReport();
  const rejectReport = useRejectReport();
  const { data: observations } = useObservations(report?.id);
  const { data: attachments } = useAttachments(report?.id);

  const [mode, setMode] = useState<'actions' | 'reject'>('actions');
  const [rejectComment, setRejectComment] = useState('');
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  if (!report) return null;

  const ind = report.indicators as any;
  const inst = report.institutions as any;
  const informant = report.informant as any;

  const getQuarterKey = (date: Date) => {
    const month = date.getMonth();
    if (month < 3) return { key: 'q1_prog', label: '1er Trimestre' };
    if (month < 6) return { key: 'q2_prog', label: '2do Trimestre' };
    if (month < 9) return { key: 'q3_prog', label: '3er Trimestre' };
    return { key: 'q4_prog', label: '4to Trimestre' };
  };

  const getQuarterDate = () => {
    const per = report?.periods as any;
    if (per?.start_date) {
      const parts = per.start_date.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    // Fallback to month parsing if no start_date
    const m = (report.reporting_month || '').toLowerCase();
    if (m.includes('enero') || m.includes('febrero') || m.includes('marzo')) return new Date(2026, 0, 1);
    if (m.includes('abril') || m.includes('mayo') || m.includes('junio')) return new Date(2026, 3, 1);
    if (m.includes('julio') || m.includes('agosto') || m.includes('septiembre')) return new Date(2026, 6, 1);
    if (m.includes('octubre') || m.includes('noviembre') || m.includes('diciembre')) return new Date(2026, 9, 1);
    return new Date();
  };

  const quarterInfo = getQuarterKey(getQuarterDate());
  const quarterLabel = quarterInfo.label;
  const quarterTarget = Number(ind?.[quarterInfo.key] ?? ind?.target_value ?? 0);
  const reportedVal = Number(report.reported_value ?? 0);
  
  const progressPct = quarterTarget > 0 ? Math.min((reportedVal / quarterTarget) * 100, 100) : 0;

  const unitLower = ind?.unit?.toLowerCase().trim() ?? '';
  const isQuantity = ind?.indicator_type === 'quantity' || unitLower === 'cantidad';

  const formatReportedValue = (val: number) => {
    return isQuantity
      ? (Number.isInteger(val) ? `${val}` : `${val.toFixed(2)}`)
      : `${val.toFixed(2)}`;
  };

  const canReview = ['submitted', 'responded'].includes(report.status);

  function getProgressColor() {
    if (reportedVal === 0) return 'bg-rose-500';
    if (reportedVal < quarterTarget) return 'bg-amber-400';
    return 'bg-emerald-500';
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

  function handleApprove() {
    approveReport.mutate(report.id, {
      onSuccess: () => {
        onOpenChange(false);
        setMode('actions');
      },
    });
  }

  function handleReject() {
    if (!rejectComment.trim() || !user) return;
    rejectReport.mutate(
      { reportId: report.id, comment: rejectComment, userId: user.id },
      {
        onSuccess: () => {
          onOpenChange(false);
          setMode('actions');
          setRejectComment('');
        },
      },
    );
  }

  function handleClose() {
    onOpenChange(false);
    setMode('actions');
    setRejectComment('');
    setShowNotesPanel(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl w-full p-0 gap-0 overflow-y-auto max-h-[95vh] lg:overflow-hidden lg:max-h-none border-none shadow-2xl">
        {/* Header mirroring Informant Style */}
        <div className="px-8 py-5 border-b bg-background flex items-center justify-between">
          <div className="space-y-0.5">
            <DialogTitle className="text-xl font-black tracking-tight text-foreground uppercase">
              Revisión del Indicador <span className="text-primary/40 text-sm font-medium ml-2">AGE</span>
            </DialogTitle>
            <p className="text-xs font-medium text-muted-foreground italic">
              Valida la información reportada frente a los compromisos de gestión.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={report.status as any} />
          </div>
        </div>

        {/* Main Content Split: INFO | DATA | RESOLUTION */}
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] divide-x h-auto lg:h-[80vh] overflow-y-visible lg:overflow-hidden">
          
          {/* Notes Panel (Shared Logic) */}
          {ind?.notes && (
            <div
              className="absolute inset-y-0 left-0 z-50 flex flex-col"
              style={{
                width: '100%',
                maxWidth: 'calc(100% - 320px)',
                pointerEvents: showNotesPanel ? 'auto' : 'none',
              }}
            >
              <div
                className="absolute inset-0 rounded-none overflow-hidden flex flex-col bg-background/98 backdrop-blur-xl border-r border-primary/20 shadow-2xl"
                style={{
                  transform: showNotesPanel ? 'translateX(0)' : 'translateX(-105%)',
                  transition: 'transform 0.4s cubic-bezier(0.2, 1, 0.3, 1)',
                }}
              >
                <div className="flex items-center justify-between px-8 py-5 border-b bg-primary/5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-primary">Notas Técnicas</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Información detallada del indicador</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowNotesPanel(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-8 py-8 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-medium">
                  {ind.notes}
                </div>
              </div>
            </div>
          )}

          {/* COLUMN 1: INFORMATION */}
          <div className="overflow-y-auto bg-muted/5 flex flex-col p-8 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Info className="h-3.5 w-3.5" /> Información del Indicador
              </p>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setShowNotesPanel(p => !p)}
                className={`h-7 gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 rounded-full transition-all ${
                  showNotesPanel 
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' 
                    : 'hover:bg-primary/10 hover:text-primary hover:border-primary/50'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Ver Notas Técnicas
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Nombre del Indicador</p>
                <p className="text-sm font-black text-foreground leading-snug">{ind?.name ?? '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Fórmula de Cálculo</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{ind?.description || 'Sin fórmula registrada'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Mes de Reporte</p>
                  <p className="text-sm font-black text-foreground capitalize">{report.reporting_month ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1.5"><Tag className="h-3 w-3" /> Unidad</p>
                  <p className="text-sm font-black text-foreground">{ind?.unit ?? '—'}</p>
                </div>
              </div>
            </div>

            {/* KPI Card */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6 border-muted/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 text-center space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Programación</p>
                  <div className="flex flex-col">
                    <span className="text-4xl font-black text-foreground tracking-tighter">{quarterTarget}</span>
                    <span className="text-[10px] text-muted-foreground font-bold">{ind?.unit ?? ''}</span>
                  </div>
                </div>
                <div className="text-muted-foreground/20 text-2xl font-black italic select-none">VS</div>
                <div className="flex-1 text-center space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Avance Reportado</p>
                  <div className="flex flex-col">
                    <span className="text-4xl font-black text-primary tracking-tighter">{formatReportedValue(reportedVal)}</span>
                    <span className="text-[10px] text-muted-foreground font-bold">{ind?.unit ?? ''}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 pt-2">
                <div className="h-3 rounded-full bg-muted overflow-hidden border border-muted/20">
                  <div className={`h-full rounded-full transition-all duration-1000 ease-out ${getProgressColor()}`} style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted-foreground font-medium italic">* Calculado sobre {quarterLabel}</span>
                  <p className="font-black tracking-tight text-foreground">
                    {progressPct.toFixed(1)}% de la programación trimestral
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata Footer */}
            <div className="pt-6 border-t mt-auto grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1.5"><Tag className="h-3 w-3" /> Centro de Responsabilidad</p>
                <p className="text-xs font-black text-primary truncate">{inst?.name ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1.5"><Clock className="h-3 w-3" /> Fecha Envío</p>
                <p className="text-xs font-black text-foreground">{new Date(report.created_at).toLocaleDateString('es')}</p>
              </div>
            </div>
          </div>

          {/* COLUMN 2: DATA REPORTED */}
          <div className="overflow-y-auto bg-background flex flex-col p-8 space-y-8 divide-y divide-muted/30">
            <div className="space-y-6">
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Paperclip className="h-3.5 w-3.5" /> Datos del Reporte
              </p>

              {/* Zero Report Alert Indicator */}
              {report.is_zero_report && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">Reporte de Avance "Cero"</p>
                    <p className="text-xs font-medium leading-relaxed mt-1">
                      El informante ha seleccionado la opción de <span className="font-bold underline">Reportar avance "Cero"</span> para este periodo. Por lo tanto, el numerador y denominador han sido deshabilitados y establecidos en cero.
                    </p>
                  </div>
                </div>
              )}

              {/* Formula View if applicable */}
              {!isQuantity ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/10 rounded-2xl p-4 border border-muted/30 space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Numerador</p>
                      <p className="text-2xl font-black text-foreground">{report.numerator}</p>
                    </div>
                    <div className="bg-muted/10 rounded-2xl p-4 border border-muted/30 space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Denominador</p>
                      <p className="text-2xl font-black text-foreground">{report.denominator}</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20 space-y-1">
                    <p className="text-[10px] font-black text-primary uppercase">Avance Calculado (Resultado)</p>
                    <p className="text-3xl font-black text-primary">{formatReportedValue(reportedVal)} <span className="text-sm font-bold opacity-60 ml-1">{ind?.unit}</span></p>
                  </div>
                </div>
              ) : (
                <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20 space-y-1 text-center">
                  <p className="text-[10px] font-black text-primary uppercase">Valor de Avance Reportado</p>
                  <p className="text-5xl font-black text-primary tracking-tighter">{formatReportedValue(reportedVal)}</p>
                  <p className="text-xs font-bold text-primary/60">{ind?.unit}</p>
                </div>
              )}

              {/* Attachment */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 text-primary">Medio de Verificación</p>
                {attachments && attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map((att: any) => (
                      <div key={att.id} className="flex items-center justify-between p-4 rounded-2xl border bg-muted/5 group hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div className="max-w-[140px] md:max-w-[200px]">
                            <p className="text-sm font-black text-foreground truncate uppercase">{att.file_name}</p>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-10 w-10 text-primary hover:bg-primary/10" onClick={() => handleDownload(att.file_url, att.file_name)}>
                          <Download className="h-5 w-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : report.verification_method ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-2xl border bg-amber-50/30 border-amber-100 group">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-amber-900 truncate uppercase">{report.verification_method}</p>
                          <p className="text-[10px] text-amber-700/60 font-bold uppercase italic">Archivo de Respaldo (Migración)</p>
                        </div>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-10 w-10 text-amber-700 hover:bg-amber-100/50" 
                        onClick={() => handleDownload(report.verification_method, report.verification_method)}
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-amber-600 font-medium px-2 leading-tight">
                      * Este archivo proviene de una versión anterior y puede no mostrar su tamaño exacto.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-[11px] text-amber-700 font-bold uppercase tracking-tight italic">
                    <Info className="h-4 w-4" /> No se ha adjuntado ningún documento físico
                  </div>
                )}
              </div>

              {/* Informant Comment */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Observaciones del Informante</p>
                <div className="p-5 bg-muted/20 rounded-2xl border text-sm italic font-medium leading-relaxed min-h-[120px]">
                  {report.comment || "Sin observaciones adicionales por parte del informante."}
                </div>
              </div>
            </div>

            {/* Revision History */}
            {(observations ?? []).length > 0 && (
              <div className="pt-8 space-y-4">
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 italic">
                  <Clock className="h-3.5 w-3.5 text-rose-500" /> Historial de Ciclos
                </p>
                <div className="space-y-4">
                  {(observations as any[]).map((obs) => (
                    <div key={obs.id} className="bg-rose-50/50 rounded-2xl border border-rose-100 p-5 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 h-1 w-24 bg-rose-200/50 -mr-4 mt-2 rotate-45" />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-rose-600 uppercase">Observación Técnica</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{new Date(obs.created_at).toLocaleDateString('es')}</span>
                      </div>
                      <p className="text-xs font-bold text-rose-900 border-l-2 border-rose-200 pl-3 leading-loose italic">"{obs.comment}"</p>
                      {obs.observation_responses?.map((resp: any) => (
                        <div key={resp.id} className="ml-6 mt-4 pl-4 border-l-2 border-primary/20 space-y-1">
                          <p className="text-[10px] font-black text-primary uppercase">Respuesta Informante</p>
                          <p className="text-xs text-foreground font-medium">{resp.comment}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* COLUMN 3: RESOLUTION SIDEBAR */}
          <div className="bg-muted/10 flex flex-col p-8 space-y-8 overflow-y-auto pt-10">
            {canReview ? (
              <div className="flex-1 flex flex-col gap-8">
                {mode === 'actions' && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-emerald-600">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-black uppercase tracking-tight">Aprobación</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                        Confirma que los datos reportados son válidos y consistentes con el respaldo técnico adjunto.
                      </p>
                      <Button
                        className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 active:scale-95 rounded-2xl"
                        onClick={handleApprove}
                        disabled={approveReport.isPending}
                      >
                        {approveReport.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "APROBAR REPORTE"}
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 opacity-20">
                      <div className="h-px bg-muted-foreground flex-1" />
                      <span className="text-[10px] font-black">OPCIÓN</span>
                      <div className="h-px bg-muted-foreground flex-1" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-rose-600">
                        <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                          <XCircle className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-black uppercase tracking-tight">Rechazo Técnico</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                        Emite una observación si detectas errores o inconsistencias en los datos o en el verificador.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full h-14 border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-xs uppercase tracking-widest transition-all rounded-2xl active:scale-95"
                        onClick={() => setMode('reject')}
                      >
                        RECHAZAR CON OBSERVACIONES
                      </Button>
                    </div>
                  </>
                )}

                {mode === 'reject' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 text-rose-600">
                      <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                        <XCircle className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-black uppercase tracking-tight italic">Emitir Observación</p>
                    </div>
                    
                    <div className="space-y-2">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Detalle del Hallazgo</p>
                       <Textarea
                        placeholder="Describe el motivo del rechazo y qué debe corregir el informante..."
                        value={rejectComment}
                        onChange={e => setRejectComment(e.target.value)}
                        className="min-h-[220px] text-sm font-medium resize-none border-rose-200 focus-visible:ring-rose-500/20 rounded-2xl p-4 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <Button
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest h-14 rounded-2xl shadow-xl shadow-rose-600/20 active:scale-95"
                        onClick={handleReject}
                        disabled={!rejectComment.trim() || rejectReport.isPending}
                      >
                        {rejectReport.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "CONFIRMAR RECHAZO"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/50 h-11"
                        onClick={() => { setMode('actions'); setRejectComment(''); }}
                      >
                        CANCELAR Y VOLVER
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center py-10">
                <div className={`h-24 w-24 rounded-[2.5rem] flex items-center justify-center shadow-inner transition-all transform hover:rotate-6 ${
                  report.status === 'approved' ? 'bg-emerald-50 ring-4 ring-emerald-500/10' : 'bg-muted ring-4 ring-muted/10'
                }`}>
                  {report.status === 'approved' ? <CheckCircle2 className="h-12 w-12 text-emerald-600" /> : <Info className="h-12 w-12 text-muted-foreground" />}
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-black text-foreground uppercase tracking-tighter">
                    {report.status === 'approved' ? "Reporte Aprobado" : "Fuera de revisión"}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium px-4 leading-relaxed italic border-t pt-4">
                    {report.status === 'approved' 
                      ? "Esta resolución ya ha sido procesada por AGE y el dato se considera oficial." 
                      : "Este reporte ya tiene una resolución emitida o el ciclo de reporte ha finalizado."}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-8 border-t border-muted-foreground/10">
              <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/50" onClick={handleClose}>
                CERRAR VENTANA
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
