import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Paperclip, X, FileText, Calendar, Tag, Info, AlertCircle, BookOpen } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { useReports } from '@/hooks/useSupabaseQuery';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface ReportIndicatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: any;
  activePeriod: any;
  onSubmit: (values: {
    indicator_id: string;
    institution_id: string;
    period_id: string;
    numerator: number;
    denominator: number;
    reported_value: number;
    reporting_month: string;
    comment: string;
    verification_method: string;
    verification_file?: File | null;
    is_zero_report?: boolean;
  }) => void;
  loading?: boolean;
  existingReport?: any;
}

export function ReportIndicatorDialog({ open, onOpenChange, assignment, activePeriod, onSubmit, loading, existingReport }: ReportIndicatorDialogProps) {
  const { data: reports } = useReports();
  const [numerator, setNumerator] = useState(existingReport?.numerator?.toString() ?? '');
  const [denominator, setDenominator] = useState(existingReport?.denominator?.toString() ?? '');
  const [comment, setComment] = useState(existingReport?.comment ?? '');
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [showZeroConfirm, setShowZeroConfirm] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isZeroReport, setIsZeroReport] = useState(existingReport?.is_zero_report ?? false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isResubmitting = !!existingReport && open;

  useEffect(() => {
    if (isResubmitting) {
      setNumerator(existingReport.numerator?.toString() ?? '');
      setDenominator(existingReport.denominator?.toString() ?? '');
      setComment(existingReport.comment ?? '');
      setIsZeroReport(existingReport.is_zero_report ?? false);
    } else if (open) {
      // Clear for new reports
      setNumerator('');
      setDenominator('');
      setComment('');
      setVerificationFile(null);
      setIsZeroReport(false);
    }
  }, [existingReport, open]);

  const indicator = assignment?.indicators;
  const instrument = assignment?.instruments;

  // Logic to determine "Mes de Reporte" (Previous Month)
  const getReportingMonthAndDate = () => {
    if (existingReport?.reporting_month) {
      const mLabel = existingReport.reporting_month;
      const lowerMLabel = mLabel.toLowerCase();
      let monthIndex = 0;
      if (lowerMLabel.includes('enero')) monthIndex = 0;
      else if (lowerMLabel.includes('febrero')) monthIndex = 1;
      else if (lowerMLabel.includes('marzo')) monthIndex = 2;
      else if (lowerMLabel.includes('abril')) monthIndex = 3;
      else if (lowerMLabel.includes('mayo')) monthIndex = 4;
      else if (lowerMLabel.includes('junio')) monthIndex = 5;
      else if (lowerMLabel.includes('julio')) monthIndex = 6;
      else if (lowerMLabel.includes('agosto')) monthIndex = 7;
      else if (lowerMLabel.includes('septiembre')) monthIndex = 8;
      else if (lowerMLabel.includes('octubre')) monthIndex = 9;
      else if (lowerMLabel.includes('noviembre')) monthIndex = 10;
      else if (lowerMLabel.includes('diciembre')) monthIndex = 11;
      
      const yearMatch = mLabel.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
      
      const date = new Date(year, monthIndex, 15);
      return { label: mLabel, date };
    }
    
    if (!activePeriod) return { label: '—', date: new Date() };
    
    // Parse "YYYY-MM-DD" timezone-safely
    const parts = activePeriod.start_date.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    
    // Create local date
    const date = new Date(year, month, day);
    
    // Subtract 1 month timezone-safely
    date.setMonth(date.getMonth() - 1);
    
    return {
      label: date.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
      date
    };
  };

  const { label: reportingMonth, date: reportDate } = getReportingMonthAndDate();

  const numVal = parseFloat(numerator);
  const denVal = parseFloat(denominator);

  const unitLower = indicator?.unit?.toLowerCase().trim() ?? '';
  const isQuantity = indicator?.indicator_type === 'quantity' || unitLower === 'cantidad';

  // Logic to determine current quarterly target based on active period start date or report month
  const getQuarterKey = (date: Date) => {
    const month = date.getMonth();
    if (month < 3) return { key: 'q1_prog', label: '1er Trimestre' };
    if (month < 6) return { key: 'q2_prog', label: '2do Trimestre' };
    if (month < 9) return { key: 'q3_prog', label: '3er Trimestre' };
    return { key: 'q4_prog', label: '4to Trimestre' };
  };

  const getQuarterDate = () => {
    if (existingReport?.reporting_month) {
      return reportDate;
    }
    if (activePeriod) {
      const parts = activePeriod.start_date.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date();
  };

  const quarterInfo = getQuarterKey(getQuarterDate());
  const quarterlyTarget = indicator?.[quarterInfo.key] ?? indicator?.target_value ?? 0;

  function computeValue(): number | null {
    if (isZeroReport) return 0;
    if (isQuantity) return isNaN(numVal) ? null : Number(Number(numVal).toFixed(2));
    if (isNaN(numVal) || isNaN(denVal) || denVal === 0) return null;
    let val = 0;
    if (unitLower.includes('%') || unitLower.includes('porcentaje')) {
      val = (numVal / denVal) * 100;
    } else {
      val = numVal / denVal;
    }
    return Number(val.toFixed(2));
  }

  const computedValue = computeValue();

  function formatValue(val: number): string {
    if (isQuantity) return `${Number.isInteger(val) ? val : val.toFixed(2)}`;
    if (unitLower.includes('%') || unitLower.includes('porcentaje')) {
      return `${val.toFixed(2)}%`;
    }
    return val.toFixed(2);
  }

  const canSubmit =
    (isZeroReport || (numerator !== '' && (isQuantity || (denominator !== '' && denVal > 0)) && verificationFile !== null)) &&
    comment.trim() !== '' &&
    !loading;

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_FILE_SIZE) {
      toast.error('El archivo excede el límite de 20 MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setVerificationFile(file);
  }

  function handleRemoveFile() {
    setVerificationFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function executeSubmit() {
    const finalPeriodId = existingReport?.period_id || activePeriod?.id;
    if (!finalPeriodId) {
      toast.error('No se pudo determinar el periodo del reporte');
      return;
    }
    
    onSubmit({
      indicator_id: assignment.indicator_id,
      institution_id: instrument?.institution_id,
      period_id: finalPeriodId,
      numerator: isZeroReport ? 0 : numVal,
      denominator: isZeroReport ? (isQuantity ? 1 : 0) : (isQuantity ? 1 : denVal),
      reported_value: isZeroReport ? 0 : computedValue!,
      reporting_month: reportingMonth,
      comment,
      verification_method: isZeroReport ? '' : (verificationFile?.name ?? ''),
      verification_file: isZeroReport ? null : verificationFile,
      is_zero_report: isZeroReport,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    
    // Check for ZERO advance warning
    if (numVal === 0 && !isZeroReport) {
      setShowZeroConfirm(true);
      return;
    }

    executeSubmit();
  }

  const previousReports = (reports ?? []).filter((r: any) => 
    r.indicator_id === indicator?.id && 
    r.id !== existingReport?.id && 
    ['submitted', 'under_review', 'responded', 'approved'].includes(r.status)
  );

  let accumulatedValue = 0;
  
  if (isQuantity) {
    const previousSum = previousReports.reduce((sum: number, r: any) => sum + (Number(r.reported_value) || 0), 0);
    accumulatedValue = previousSum + (computedValue !== null ? computedValue : 0);
  } else {
    // For percentages or fractions, we sum numerators and denominators to get the accumulated total
    const prevNumSum = previousReports.reduce((sum: number, r: any) => sum + (Number(r.numerator) || 0), 0);
    const prevDenSum = previousReports.reduce((sum: number, r: any) => sum + (Number(r.denominator) || 0), 0);
    
    const totalNum = prevNumSum + (isNaN(numVal) ? 0 : numVal);
    const totalDen = prevDenSum + (isNaN(denVal) ? 0 : denVal);

    if (totalDen > 0) {
      if (unitLower.includes('%') || unitLower.includes('porcentaje')) {
        accumulatedValue = (totalNum / totalDen) * 100;
      } else {
        accumulatedValue = totalNum / totalDen;
      }
    }
  }

  const advanceColor = accumulatedValue === 0 ? '#ef4444' : (accumulatedValue < quarterlyTarget ? '#fbbf24' : '#10b981');

  const chartData = [
    { name: 'Meta', value: Number(indicator?.target_value) || 0, color: 'hsl(var(--muted-foreground))' },
    { name: 'Prog.', value: Number(quarterlyTarget) || 0, color: 'hsl(var(--primary))' },
    { name: 'Avance', value: Number(accumulatedValue.toFixed(2)), color: advanceColor }
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-y-auto max-h-[95vh] border-none shadow-2xl">
          <div className="px-6 pt-6 pb-4 border-b bg-background">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {existingReport ? 'Corregir y Reenviar Reporte' : 'Reportar Indicador'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-muted-foreground">
              {existingReport ? 'Corrige los datos según las observaciones del revisor.' : 'Completa los datos para enviar tu reporte al revisor.'}
            </DialogDescription>
          </div>

          <form onSubmit={handleSubmit} className="bg-background">
            <div className="relative grid grid-cols-1 md:grid-cols-[1fr_400px] divide-x border-b">
              {/* LEFT COLUMN: Metadata */}
              {/* Floating Notes Panel Overlay */}
              <div
                className="absolute inset-y-0 left-0 z-50 flex flex-col"
                style={{
                  width: '100%',
                  maxWidth: 'calc(100% - 400px)',
                  pointerEvents: showNotes ? 'auto' : 'none',
                }}
              >
                <div
                  className="absolute inset-0 rounded-l-2xl overflow-hidden flex flex-col"
                  style={{
                    transform: showNotes ? 'translateX(0)' : 'translateX(-105%)',
                    transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                    background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)/0.4) 100%)',
                    boxShadow: showNotes ? '8px 0 40px -8px hsl(var(--primary)/0.15)' : 'none',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid hsl(var(--border))',
                    borderRight: '1px solid hsl(var(--primary)/0.12)',
                  }}
                >
                  {/* Panel Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10 bg-primary/5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-primary">Notas Técnicas</p>
                        <p className="text-[10px] text-muted-foreground font-medium">Información del indicador</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={() => setShowNotes(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Panel Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {indicator?.notes ? (
                      <div className="space-y-3">
                        <div className="h-0.5 w-8 rounded-full bg-primary/30" />
                        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-medium">
                          {indicator.notes}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center pt-8">
                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                          <Info className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">Sin notas técnicas</p>
                        <p className="text-[11px] text-muted-foreground/60 max-w-[180px] leading-relaxed">
                          No se han registrado notas técnicas para este indicador.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Panel Footer */}
                  <div className="px-6 py-3 border-t border-muted/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                      onClick={() => setShowNotes(false)}
                    >
                      Cerrar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 bg-muted/10 relative flex flex-col justify-between h-full gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Información del Indicador</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNotes(prev => !prev)}
                      className={`h-7 gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 rounded-full transition-all border-primary/30 ${
                        showNotes
                          ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                          : 'hover:bg-primary/10 hover:text-primary hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      <BookOpen className="h-3 w-3" />
                      Ver Notas Técnicas
                      {indicator?.notes && (
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          showNotes ? 'bg-primary-foreground' : 'bg-primary'
                        }`} />
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase">Nombre</p>
                    <p className="text-sm font-bold text-foreground leading-snug">{indicator?.name ?? '—'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase">Formula de Cálculo</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{indicator?.description ?? 'Sin fórmula registrada'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-2">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Mes de Reporte
                      </p>
                      <p className="text-sm font-bold text-foreground capitalize">{reportingMonth}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1.5">
                        <Tag className="h-3 w-3" /> Unidad
                      </p>
                      <p className="text-sm font-bold text-foreground">{indicator?.unit ?? '—'}</p>
                    </div>
                  </div>
                </div>

                {/* KPI Visualization Card */}
                <div className="rounded-xl border bg-card p-5 shadow-sm border-muted/50 flex flex-col flex-1 min-h-[240px] justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tighter">Comparativa de Avances</p>
                    <span className="text-[10px] text-muted-foreground font-medium italic opacity-60">
                      * Incluye todos los periodos
                    </span>
                  </div>

                  <div className="flex-1 w-full min-h-[180px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', fontWeight: 'bold' }}
                          formatter={(value: number) => [`${value} ${unitLower.includes('%') ? '%' : ''}`, '']}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={50} 
                          isAnimationActive={true}
                          label={{ position: 'top', fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 'bold' }}
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t border-muted/50">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: chartData[0].color }}></div>
                        <span className="text-[10px] font-bold text-muted-foreground">{chartData[0].value} {unitLower.includes('%') ? '%' : ''} Meta</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: chartData[1].color }}></div>
                        <span className="text-[10px] font-bold text-muted-foreground">{chartData[1].value} {unitLower.includes('%') ? '%' : ''} Prog.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: chartData[2].color }}></div>
                        <span className="text-[10px] font-bold text-foreground">{chartData[2].value} {unitLower.includes('%') ? '%' : ''} Avance</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Form */}
              <div className="px-8 py-6 space-y-6">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Datos del Reporte</p>

                <div className="space-y-5">
                  {/* Checkbox "Reportar avance 'Cero'" */}
                  <div className="flex items-center space-x-2.5 p-3.5 rounded-xl border border-amber-200/50 bg-amber-50/40 hover:bg-amber-50/70 transition-colors shadow-sm">
                    <input
                      type="checkbox"
                      id="is-zero-report"
                      checked={isZeroReport}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsZeroReport(checked);
                        if (checked) {
                          setNumerator('0');
                          setDenominator('0');
                          setVerificationFile(null);
                        } else {
                          setNumerator('');
                          setDenominator('');
                        }
                      }}
                      className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <Label htmlFor="is-zero-report" className="text-xs font-bold text-foreground cursor-pointer select-none leading-none">
                      Reportar avance "Cero"
                    </Label>
                  </div>

                  {/* Advance / Formula Inputs */}
                  {!isQuantity ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="numerator" className="text-xs font-bold text-foreground">
                            Numerador <span className="text-destructive font-black">*</span>
                          </Label>
                          <Input
                            id="numerator"
                            type="number"
                            step="any"
                            placeholder="Ej. 10.5"
                            className="h-11 font-medium px-4 focus-visible:ring-primary/20 transition-all border-muted-foreground/20 disabled:bg-muted/50 disabled:cursor-not-allowed"
                            value={numerator}
                            onChange={e => setNumerator(e.target.value)}
                            required={!isZeroReport}
                            disabled={isZeroReport}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="denominator" className="text-xs font-bold text-foreground">
                            Denominador <span className="text-destructive font-black">*</span>
                          </Label>
                          <Input
                            id="denominator"
                            type="number"
                            step="any"
                            placeholder="Ej. 2.0"
                            className="h-11 font-medium px-4 focus-visible:ring-primary/20 transition-all border-muted-foreground/20 disabled:bg-muted/50 disabled:cursor-not-allowed"
                            value={denominator}
                            onChange={e => setDenominator(e.target.value)}
                            required={!isZeroReport}
                            disabled={isZeroReport}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-foreground">
                          Avance Calculado
                        </Label>
                        <div className="h-11 flex items-center px-4 bg-muted/30 rounded-xl border border-muted-foreground/20 font-bold text-primary">
                          {computedValue !== null ? formatValue(computedValue) : 'Esperando datos...'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="numerator" className="text-xs font-bold text-foreground">
                        Avance <span className="text-destructive font-black">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="numerator"
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Ingresa valor de avance"
                          className="h-11 font-medium pl-4 focus-visible:ring-primary/20 transition-all border-muted-foreground/20 disabled:bg-muted/50 disabled:cursor-not-allowed"
                          value={numerator}
                          onChange={e => setNumerator(e.target.value)}
                          required={!isZeroReport}
                          disabled={isZeroReport}
                        />
                      </div>
                    </div>
                  )}

                  {/* File Upload Component */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground">
                      Medio de Verificación {!isZeroReport && <span className="text-destructive font-black">*</span>}
                    </Label>
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-5 transition-all group ${
                        isZeroReport
                          ? 'border-muted bg-muted/20 cursor-not-allowed opacity-60'
                          : verificationFile 
                            ? 'border-primary/50 bg-primary/5 shadow-inner cursor-pointer' 
                            : 'border-muted-foreground/15 hover:border-primary/40 hover:bg-muted/30 cursor-pointer'
                      }`}
                      onClick={() => !isZeroReport && !verificationFile && fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={handleFileChange}
                        disabled={isZeroReport}
                      />
                      {verificationFile ? (
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate uppercase">{verificationFile.name}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">{(verificationFile.size / 1024).toFixed(1)} KB — Preparado</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={e => { e.stopPropagation(); handleRemoveFile(); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 py-1">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <Paperclip className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                              {isZeroReport ? 'No requerido para avance "Cero"' : 'Haz clic para adjuntar archivo'}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">PDF, Word, Excel, imágenes</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Observations Textarea */}
                  <div className="space-y-2">
                    <Label htmlFor="comment" className="text-xs font-bold text-foreground">
                      Observaciones <span className="text-destructive font-black">*</span>
                    </Label>
                    <Textarea
                      id="comment"
                      placeholder="Describe los detalles relevantes de este reporte..."
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      rows={4}
                      required
                      className="resize-none h-28 focus-visible:ring-primary/20 border-muted-foreground/20 font-medium text-sm p-4"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Footer */}
            <DialogFooter className="px-8 py-5 flex items-center justify-end gap-3 bg-muted/5">
              <Button type="button" variant="ghost" className="font-bold text-xs uppercase tracking-tight hover:bg-muted" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="px-8 font-bold text-xs uppercase tracking-tight shadow-md hover:shadow-lg transition-all"
                disabled={!canSubmit || loading}
              >
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin shadow-none" />Enviando...</>
                ) : (
                  existingReport ? 'Reenviar Reporte' : 'Enviar Reporte'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showZeroConfirm} onOpenChange={setShowZeroConfirm}>
        <AlertDialogContent className="shadow-2xl border-primary/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5 text-red-600">
              <AlertCircle className="h-5 w-5" />
              ¿Confirmar reporte en cero?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/80 leading-relaxed font-medium">
              Usted está reportando el indicador en <span className="font-bold text-foreground underline underline-offset-4">cero</span>. 
              ¿Está segura/o que desea continuar con el envío del reporte?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel asChild>
              <Button variant="outline" className="font-bold text-xs tracking-wider uppercase bg-muted/10">
                Editar Avance
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button 
                onClick={() => { setShowZeroConfirm(false); executeSubmit(); }}
                className="font-bold text-xs tracking-wider uppercase shadow-md bg-red-600 hover:bg-red-700"
              >
                Continuar
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
