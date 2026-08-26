import { useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, Printer, FileText, CheckCircle2, AlertTriangle, AlertCircle, FileSpreadsheet, Building2, Filter, Layers, BarChart3, PieChart as PieIcon, RefreshCw, ChevronRight, Tv, Maximize2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, CartesianGrid, PieChart, Pie, Legend } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { BRANDING } from '@/config/branding';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { CNR_OFFICIAL_LOGO_BASE64 } from '@/assets/cnr-official-logo-base64';
import { calculateIndicatorProgress, isIndicatorTargetFulfilled } from '@/lib/utils';
import { ReportPresentationModal } from '@/components/reports/ReportPresentationModal';

// Custom hook to fetch report data
function useManagementReportData(institutionIdFilter?: string) {
  return useQuery({
    queryKey: ['management-report-data', institutionIdFilter],
    queryFn: async () => {
      // 1. Fetch ALL institutions so the dropdown selector always displays all available Centros de Responsabilidad
      const { data: institutions, error: instErr } = await supabase
        .from('institutions')
        .select('*')
        .order('name');
      if (instErr) throw instErr;

      // 2. Fetch active instruments, filtered by institution_id if a specific Centro de Responsabilidad is selected
      let insQuery = supabase
        .from('instruments')
        .select('*')
        .eq('is_active', true);
      if (institutionIdFilter && institutionIdFilter !== 'all') {
        insQuery = insQuery.eq('institution_id', institutionIdFilter);
      }
      const { data: instruments, error: insErr } = await insQuery;
      if (insErr) throw insErr;

      // 3. Fetch active indicators with their report history
      const { data: indicators, error: indErr } = await (supabase as any)
        .from('indicators')
        .select(`
          *,
          indicator_reports (
            id,
            reported_value,
            status,
            evaluation_status,
            period_id,
            institution_id,
            numerator,
            denominator,
            comment,
            created_at,
            periods (
              name
            )
          )
        `)
        .eq('is_active', true);
      if (indErr) throw indErr;

      // 4. Fetch assignments linking instruments and indicators
      const { data: assignments, error: assErr } = await (supabase as any)
        .from('instrument_indicators')
        .select(`
          *,
          informant:profiles!instrument_indicators_informant_id_fkey(id, name, email),
          reviewer:profiles!instrument_indicators_reviewer_id_fkey(id, name, email)
        `)
        .eq('is_active', true);
      if (assErr) throw assErr;

      // Map instruments with details
      const formattedInstruments = (instruments || []).map(inst => {
        const instAssignments = (assignments || []).filter((a: any) => a.instrument_id === inst.id);

        let totalWeight = 0;
        let achievedWeight = 0;

        const indDetails = instAssignments.map((ass: any) => {
          const ind = (indicators || []).find((i: any) => i.id === ass.indicator_id);
          if (!ind) return null;

          const weight = Number(ind.weight) || 0;
          totalWeight += weight;

          const validReports = (ind.indicator_reports || []).filter((r: any) => {
            const matchesStatus = ['submitted', 'under_review', 'responded', 'approved'].includes(r.status);
            const matchesInst = !institutionIdFilter || 
                                institutionIdFilter === 'all' || 
                                r.institution_id === institutionIdFilter || 
                                inst.institution_id === institutionIdFilter || 
                                !r.institution_id;
            return matchesStatus && matchesInst;
          });

          // Calculate real-time progress
          let progress = 0;
          let latestReport: any = null;
          if (validReports.length > 0) {
            validReports.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            latestReport = validReports[0];
            const target = Number(ind.target_value) || 100;
            const repVal = Number(latestReport.reported_value) || 0;
            progress = calculateIndicatorProgress(repVal, target, ind.unit);

            if (isIndicatorTargetFulfilled(repVal, target, ind.unit)) {
              achievedWeight += weight;
            }
          }

          // Evaluate risk status
          let statusCategory: 'normal' | 'prog' | 'risk' | 'no_report' = 'normal';
          if (!latestReport) {
            statusCategory = 'no_report';
          } else if (progress < 60) {
            statusCategory = 'risk';
          } else if (progress < 85) {
            statusCategory = 'prog';
          }

          return {
            ...ind,
            instrumentName: inst.name,
            informant: ass?.informant?.name || 'No asignado',
            reviewer: ass?.reviewer?.name || 'No asignado',
            latestReport,
            progress,
            statusCategory
          };
        }).filter(Boolean);

        const reportedDetails = indDetails.filter((item: any) => item.latestReport !== null);

        const totalProgress = totalWeight > 0
          ? Math.min(100, Math.max(0, Math.round((achievedWeight / totalWeight) * 100)))
          : (reportedDetails.length > 0
              ? Math.round(reportedDetails.reduce((acc: number, item: any) => acc + item.progress, 0) / reportedDetails.length)
              : 0);

        return {
          ...inst,
          institution_name: (institutions || []).find(i => i.id === inst.institution_id)?.name || 'Institución',
          indicators: indDetails,
          totalWeight,
          achievedWeight,
          totalProgress
        };
      }).filter(inst => inst.indicators.length > 0);

      return {
        institutions,
        instruments: formattedInstruments
      };
    }
  });
}

export default function ManagementReportsPage() {
  const { profile } = useAuth();
  const [institutionFilter, setInstitutionFilter] = useState<string>('all');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  // Modular sections selection model (6 user-chosen variables)
  const [includeIntro, setIncludeIntro] = useState(true);
  const [includeRiskList, setIncludeRiskList] = useState(true);
  const [includeRiskChart, setIncludeRiskChart] = useState(true);
  const [includeAllInstruments, setIncludeAllInstruments] = useState(true);
  const [includeComplianceChart, setIncludeComplianceChart] = useState(true);
  const [includeConclusion, setIncludeConclusion] = useState(true);

  // Editable introduction & conclusion texts
  const [introText, setIntroText] = useState(
    `El presente Informe de Gestión tiene como propósito entregar una evaluación integral del desempeño y avance cuantitativo y cualitativo de los instrumentos e indicadores asignados a la Comisión Nacional de Riego (CNR).` +
    `\n\nEste reporte consolida los datos de avance hasta la última reportabilidad registrada, identificando tanto las metas alcanzadas conforme a la programación institucional, como aquellos indicadores en estado de alerta o riesgo de incumplimiento que requieren medidas correctivas inmediatas.`
  );

  const [conclusionText, setConclusionText] = useState(
    `En conclusión, los datos analizados en el presente período reflejan un desempeño general positivo en los instrumentos prioritarios de la Comisión Nacional de Riego.` +
    `\n\nSe recomienda focalizar los esfuerzos de seguimiento y asistencia técnica en aquellos indicadores clasificados bajo programación o en riesgo crítico de incumplimiento, coordinando acciones preventivas con los informantes y centros de responsabilidad correspondientes para asegurar el cumplimiento total de los compromisos gubernamentales.`
  );

  const printRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, refetch } = useManagementReportData(institutionFilter);

  // Calculate global statistics
  const allInstruments = data?.instruments || [];
  const allIndicators = allInstruments.flatMap(i => i.indicators);

  const riskIndicators = allIndicators.filter(i => ['risk', 'prog', 'no_report'].includes(i.statusCategory));
  const countNormal = allIndicators.filter(i => i.statusCategory === 'normal').length;
  const countProg = allIndicators.filter(i => i.statusCategory === 'prog').length;
  const countRisk = allIndicators.filter(i => i.statusCategory === 'risk').length;
  const countNoReport = allIndicators.filter(i => i.statusCategory === 'no_report').length;

  const riskPieData = [
    { name: 'Cumplimiento Normal (≥85%)', value: countNormal, color: '#10b981' },
    { name: 'Bajo Programación (60-84%)', value: countProg, color: '#f59e0b' },
    { name: 'Riesgo de Incumplimiento (<60%)', value: countRisk, color: '#ef4444' },
    { name: 'Sin Reporte', value: countNoReport, color: '#6b7280' },
  ].filter(item => item.value > 0);

  const instrumentComplianceData = allInstruments.map(inst => ({
    name: inst.name.length > 20 ? inst.name.substring(0, 20) + '...' : inst.name,
    fullName: inst.name,
    cumplimiento: inst.totalProgress
  }));

  const selectedInstitution = (data?.institutions || []).find(i => i.id === institutionFilter);
  const selectedInstitutionName = institutionFilter === 'all'
    ? 'Consolidado Oficial'
    : (selectedInstitution?.name || 'Centro de Responsabilidad');

  // Function to generate and download real PDF file containing ONLY the report document
  const handleExportPDF = async () => {
    const element = printRef.current;
    if (!element) {
      toast.error('No se encontró el elemento del informe.');
      return;
    }

    setExportingPdf(true);
    toast.info('Generando archivo PDF con ajuste de ancho A4...');

    try {
      const html2pdfModule = (await import('html2pdf.js')).default;

      const instSlug = institutionFilter === 'all'
        ? 'Consolidado'
        : selectedInstitutionName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Informe_de_Gestion_CNR_${instSlug}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      const opt = {
        margin:       [10, 8, 10, 8] as [number, number, number, number], // mm (Top, Right, Bottom, Left)
        filename:     fileName,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          windowWidth: 800 // Forces 800px width capture so tables fit A4 100% without horizontal scroll/clipping
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdfModule().set(opt).from(element).save();
      toast.success(`Archivo PDF generado y guardado en tu equipo: ${fileName}`);
    } catch (err: any) {
      console.error('Error generando PDF:', err);
      toast.error('Error al generar el archivo PDF: ' + (err.message || 'Error desconocido'));
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrintView = () => {
    window.print();
  };

  return (
    <AppLayout>
      {/* Styles for print mode & A4 exact fitting */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #report-document-container, #report-document-container * {
            visibility: visible !important;
          }
          #report-document-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 15px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="print-hide">
        <PageHeader
          title="Informes de Gestión"
          description="Generador y exportador de informes ejecutivos de avance e indicadores institucionales"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configuration Controls & Section Toggles (Hidden during print) */}
        <div className="lg:col-span-4 space-y-6 print-hide">
          <Card className="shadow-card border-border/80">
            <CardHeader className="bg-muted/20 border-b pb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">Configurador del Informe</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Selecciona las secciones y variables que se incluirán en el archivo PDF exportable.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {/* Institution Filter */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Centro de Responsabilidad
                </Label>
                <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas las áreas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Centros de Responsabilidad</SelectItem>
                    {(data?.institutions || []).map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggles Model */}
              <div className="space-y-4 pt-2 border-t">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Variables e Información a Incluir
                </Label>

                {/* Section: Intro */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-muted/20 transition-all">
                  <div className="space-y-0.5">
                    <Label htmlFor="sec-intro" className="text-xs font-bold cursor-pointer">
                      Introducción al Informe
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Párrafos editables de contexto inicial.</p>
                  </div>
                  <Switch id="sec-intro" checked={includeIntro} onCheckedChange={setIncludeIntro} />
                </div>

                {/* Section: Risk / Low Prog / No Report Indicators List */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-muted/20 transition-all">
                  <div className="space-y-0.5">
                    <Label htmlFor="sec-risk-list" className="text-xs font-bold cursor-pointer">
                      Indicadores en Riesgo / Sin Reporte
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Tabla ajustada con alertas y bajo programación.</p>
                  </div>
                  <Switch id="sec-risk-list" checked={includeRiskList} onCheckedChange={setIncludeRiskList} />
                </div>

                {/* Section: Risk Projection Chart */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-muted/20 transition-all">
                  <div className="space-y-0.5">
                    <Label htmlFor="sec-risk-chart" className="text-xs font-bold cursor-pointer">
                      Gráfico Proyección de Riesgo
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Distribución porcentual del riesgo.</p>
                  </div>
                  <Switch id="sec-risk-chart" checked={includeRiskChart} onCheckedChange={setIncludeRiskChart} />
                </div>

                {/* Section: All Instruments List */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-muted/20 transition-all">
                  <div className="space-y-0.5">
                    <Label htmlFor="sec-all-inst" className="text-xs font-bold cursor-pointer">
                      Todos los Instrumentos y Avance
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Resumen completo de la última reportabilidad.</p>
                  </div>
                  <Switch id="sec-all-inst" checked={includeAllInstruments} onCheckedChange={setIncludeAllInstruments} />
                </div>

                {/* Section: Compliance Chart */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-muted/20 transition-all">
                  <div className="space-y-0.5">
                    <Label htmlFor="sec-comp-chart" className="text-xs font-bold cursor-pointer">
                      Gráfico Proyección de Cumplimiento
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Barras comparativas de avance %.</p>
                  </div>
                  <Switch id="sec-comp-chart" checked={includeComplianceChart} onCheckedChange={setIncludeComplianceChart} />
                </div>

                {/* Section: Conclusion */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-muted/20 transition-all">
                  <div className="space-y-0.5">
                    <Label htmlFor="sec-conclusion" className="text-xs font-bold cursor-pointer">
                      Conclusión y Análisis de Gestión
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Párrafos editables de análisis final.</p>
                  </div>
                  <Switch id="sec-conclusion" checked={includeConclusion} onCheckedChange={setIncludeConclusion} />
                </div>
              </div>

              {/* Editable Intro Textarea */}
              {includeIntro && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="edit-intro" className="text-xs font-bold text-foreground">
                    Texto Introductorio (Editable)
                  </Label>
                  <Textarea
                    id="edit-intro"
                    rows={4}
                    value={introText}
                    onChange={e => setIntroText(e.target.value)}
                    className="text-xs leading-relaxed"
                  />
                </div>
              )}

              {/* Editable Conclusion Textarea */}
              {includeConclusion && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="edit-conclusion" className="text-xs font-bold text-foreground">
                    Conclusión y Análisis (Editable)
                  </Label>
                  <Textarea
                    id="edit-conclusion"
                    rows={4}
                    value={conclusionText}
                    onChange={e => setConclusionText(e.target.value)}
                    className="text-xs leading-relaxed"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t space-y-2.5">
                <Button
                  onClick={handleExportPDF}
                  disabled={exportingPdf}
                  className="w-full font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  {exportingPdf ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Descargar Archivo PDF
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => setIsPresentationOpen(true)}
                  variant="secondary"
                  className="w-full text-xs font-extrabold bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 shadow-sm"
                  size="sm"
                >
                  <Tv className="h-4 w-4 mr-2 text-sky-500" />
                  Modo Presentación (Pantalla Completa)
                </Button>

                <Button
                  onClick={handlePrintView}
                  variant="outline"
                  className="w-full text-xs font-semibold"
                  size="sm"
                >
                  <Printer className="h-3.5 w-3.5 mr-2" />
                  Imprimir / Guardar por Navegador
                </Button>

                <Button
                  onClick={() => refetch()}
                  variant="ghost"
                  className="w-full text-[11px] text-muted-foreground"
                  size="sm"
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Actualizar Datos de la Base de Datos
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Printable Document Preview (Isolated Container with Fixed A4 Bounds) */}
        <div className="lg:col-span-8 overflow-x-auto space-y-3">
          <div className="flex justify-end print-hide">
            <Button
              onClick={() => setIsPresentationOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs font-bold text-sky-600 border-sky-600/30 hover:bg-sky-50 dark:hover:bg-sky-950/40 shadow-sm"
            >
              <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
              Ver a Pantalla Completa (Modo Presentación)
            </Button>
          </div>

          <div
            id="report-document-container"
            ref={printRef}
            className="bg-card border rounded-2xl shadow-card p-6 sm:p-8 print:p-0 print:border-none print:shadow-none space-y-6 text-foreground max-w-[794px] w-full mx-auto"
          >
            {/* Header / Institutional Banner */}
            <div className="border-b-2 border-primary/20 pb-5 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img
                  src={CNR_OFFICIAL_LOGO_BASE64}
                  alt="Logo Oficial CNR - Ministerio de Agricultura - Gobierno de Chile"
                  className="h-16 sm:h-20 w-auto object-contain rounded-md shadow-sm shrink-0"
                />
                <div>
                  <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground leading-tight">
                    Comisión Nacional de Riego
                  </h1>
                  <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Ministerio de Agricultura • Gobierno de Chile
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-primary font-bold mt-0.5">
                    INFORME DE GESTIÓN Y AVANCE DE INSTRUMENTOS
                  </p>
                </div>
              </div>

              <div className="text-right text-[11px] text-muted-foreground space-y-0.5">
                <p><span className="font-bold text-foreground">Fecha Emisión:</span> {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>
                <p><span className="font-bold text-foreground">Emitido por:</span> {profile?.name || 'Administrador'}</p>
                <p><span className="font-bold text-foreground">Centro de Resp.:</span> {selectedInstitutionName}</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="animate-spin h-8 w-8 mb-2 text-primary" />
                <p className="text-sm font-medium">Cargando datos del informe de gestión...</p>
              </div>
            ) : allInstruments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed rounded-xl bg-muted/10 my-6">
                <Building2 className="h-10 w-10 text-muted-foreground/60 mb-3" />
                <h3 className="text-sm font-bold text-foreground mb-1">Sin información para este Centro de Responsabilidad</h3>
                <p className="text-xs text-muted-foreground max-w-md">
                  No se encontraron instrumentos ni indicadores activos asignados a{' '}
                  <span className="font-semibold text-foreground">{selectedInstitutionName}</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. SECTION: INTRODUCTION */}
                {includeIntro && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b pb-1 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Introducción
                    </h2>
                    <div className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-line bg-muted/20 p-3.5 rounded-xl border border-border/50">
                      {introText}
                    </div>
                  </div>
                )}

                {/* 2. SECTION: RISK & LOW PROGRAMMING INDICATORS */}
                {includeRiskList && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b pb-1">
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Indicadores Bajo Programación, en Riesgo de Incumplimiento o Sin Reporte ({riskIndicators.length})
                      </h2>
                    </div>

                    {riskIndicators.length === 0 ? (
                      <div className="p-3 rounded-xl border bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Excelente: Todos los indicadores asignados se encuentran con cumplimiento normal o superior al 85%.
                      </div>
                    ) : (
                      <div className="border rounded-xl shadow-sm overflow-hidden bg-card">
                        <table className="w-full text-xs text-left table-fixed border-collapse">
                          <thead>
                            <tr className="bg-muted/60 text-muted-foreground uppercase text-[9px] font-extrabold tracking-wider border-b">
                              <th className="p-2 w-[30%] border-r">Indicador</th>
                              <th className="p-2 w-[12%] text-center border-r">Inst.</th>
                              <th className="p-2 w-[20%] border-r">Informante</th>
                              <th className="p-2 w-[13%] text-center border-r">Avance / Meta</th>
                              <th className="p-2 w-[11%] text-center border-r">% Cumpl.</th>
                              <th className="p-2 w-[14%] text-center">Estado Alerta</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {riskIndicators.map((ind, idx) => (
                              <tr key={idx} className="hover:bg-muted/20 border-b last:border-b-0 align-top">
                                <td className="p-2 font-semibold text-foreground border-r break-words">
                                  <div className="text-[11px] leading-tight text-foreground font-semibold break-words">
                                    {ind.name}
                                  </div>
                                  {ind.unit && (
                                    <div className="text-[9px] font-normal text-muted-foreground mt-1 leading-none">
                                      Unidad: {ind.unit}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 text-center font-bold text-primary border-r text-[10px] whitespace-nowrap">
                                  {ind.instrumentName}
                                </td>
                                <td className="p-2 text-muted-foreground border-r text-[10px] break-words">
                                  {ind.informant}
                                </td>
                                <td className="p-2 text-center font-mono border-r text-[10px] whitespace-nowrap">
                                  {ind.latestReport ? `${ind.latestReport.reported_value} / ${ind.target_value}` : 'Sin datos'}
                                </td>
                                <td className="p-2 text-center font-bold font-mono border-r text-[10px] whitespace-nowrap">
                                  {ind.latestReport ? `${ind.progress}%` : '0%'}
                                </td>
                                <td className="p-2 text-center text-[9px]">
                                  {ind.statusCategory === 'risk' && (
                                    <span className="inline-block w-full px-1.5 py-0.5 rounded-md font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 text-center truncate">
                                      Riesgo (&lt;60%)
                                    </span>
                                  )}
                                  {ind.statusCategory === 'prog' && (
                                    <span className="inline-block w-full px-1.5 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 text-center truncate">
                                      Bajo Prog. (60-84%)
                                    </span>
                                  )}
                                  {ind.statusCategory === 'no_report' && (
                                    <span className="inline-block w-full px-1.5 py-0.5 rounded-md font-bold bg-gray-500/10 text-gray-600 border border-gray-500/20 text-center truncate">
                                      Sin Reporte
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. SECTION: RISK PROJECTION CHART */}
                {includeRiskChart && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b pb-1 flex items-center gap-2">
                      <PieIcon className="h-3.5 w-3.5" />
                      Proyección Gráfica del Riesgo de Incumplimiento
                    </h2>
                    <div className="bg-muted/20 border rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="h-52 w-full md:w-1/2">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={riskPieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={70}
                              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            >
                              {riskPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-full md:w-1/2 space-y-1.5 text-[11px]">
                        <p className="font-bold text-foreground mb-1">Distribución de Estados de Cumplimiento:</p>
                        <div className="flex justify-between items-center p-1.5 rounded bg-background border">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Cumplimiento Normal (&ge;85%)
                          </span>
                          <span className="font-bold font-mono">{countNormal}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 rounded bg-background border">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Bajo Programación (60-84%)
                          </span>
                          <span className="font-bold font-mono">{countProg}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 rounded bg-background border">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            Riesgo Crítico (&lt;60%)
                          </span>
                          <span className="font-bold font-mono">{countRisk}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 rounded bg-background border">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="h-2 w-2 rounded-full bg-gray-500" />
                            Sin Reporte
                          </span>
                          <span className="font-bold font-mono">{countNoReport}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. SECTION: ALL INSTRUMENTS & LATEST REPORTABILITY */}
                {includeAllInstruments && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b pb-1 flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5" />
                      Resumen Consolidado de Todos los Instrumentos y Avance
                    </h2>

                    <div className="border rounded-xl shadow-sm overflow-hidden bg-card">
                      <table className="w-full text-xs text-left table-fixed border-collapse">
                        <thead>
                          <tr className="bg-muted/60 text-muted-foreground uppercase text-[9px] font-extrabold tracking-wider border-b">
                            <th className="p-2 w-[35%] border-r">Instrumento</th>
                            <th className="p-2 w-[25%] border-r">Centro de Responsabilidad</th>
                            <th className="p-2 w-[12%] text-center border-r">Indicadores</th>
                            <th className="p-2 w-[13%] text-center border-r">% Avance</th>
                            <th className="p-2 w-[15%] text-center">Estado General</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {allInstruments.map((inst, idx) => (
                            <tr key={idx} className="hover:bg-muted/20 border-b last:border-b-0 align-top">
                              <td className="p-2 font-semibold text-foreground border-r text-[11px] break-words">
                                {inst.name}
                              </td>
                              <td className="p-2 text-muted-foreground border-r text-[10px] break-words">
                                {inst.institution_name}
                              </td>
                              <td className="p-2 text-center font-mono font-semibold border-r text-[10px]">
                                {inst.indicators.length}
                              </td>
                              <td className="p-2 text-center font-bold font-mono border-r text-[10px]">
                                {inst.totalProgress}%
                              </td>
                              <td className="p-2 text-center text-[9px]">
                                {inst.totalProgress >= 85 && (
                                  <span className="inline-block w-full px-1.5 py-0.5 rounded-md font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-center truncate">
                                    Óptimo (&ge;85%)
                                  </span>
                                )}
                                {inst.totalProgress >= 60 && inst.totalProgress < 85 && (
                                  <span className="inline-block w-full px-1.5 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 text-center truncate">
                                    Regular (60-84%)
                                  </span>
                                )}
                                {inst.totalProgress < 60 && (
                                  <span className="inline-block w-full px-1.5 py-0.5 rounded-md font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 text-center truncate">
                                    Crítico (&lt;60%)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. SECTION: COMPLIANCE PROJECTION CHART */}
                {includeComplianceChart && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b pb-1 flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Proyección Gráfica del Cumplimiento de Todos los Indicadores
                    </h2>
                    <div className="bg-muted/20 border rounded-xl p-3">
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={instrumentComplianceData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
                            <RechartsTooltip formatter={(val: number) => [`${val}%`, 'Avance Global']} />
                            <Bar dataKey="cumplimiento" radius={[4, 4, 0, 0]}>
                              {instrumentComplianceData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={
                                    entry.cumplimiento >= 85
                                      ? '#10b981'
                                      : entry.cumplimiento >= 60
                                      ? '#f59e0b'
                                      : '#ef4444'
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. SECTION: CONCLUSION & MANAGEMENT ANALYSIS */}
                {includeConclusion && (
                  <div className="space-y-2 pt-1">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b pb-1 flex items-center gap-2">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Conclusión y Análisis de Gestión
                    </h2>
                    <div className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-line bg-muted/20 p-3.5 rounded-xl border border-border/50">
                      {conclusionText}
                    </div>

                    {/* Signatures block */}
                    <div className="pt-10 grid grid-cols-2 gap-8 text-center text-xs">
                      <div className="border-t border-foreground/30 pt-1.5">
                        <p className="font-bold text-foreground">{profile?.name || 'Administrador de Gestión'}</p>
                        <p className="text-[10px] text-muted-foreground">Encargado de Indicadores y Monitoreo AGE</p>
                        <p className="text-[10px] text-muted-foreground">Comisión Nacional de Riego</p>
                      </div>
                      <div className="border-t border-foreground/30 pt-1.5">
                        <p className="font-bold text-foreground">Jefatura / Dirección Institucional</p>
                        <p className="text-[10px] text-muted-foreground">Comisión Nacional de Riego</p>
                        <p className="text-[10px] text-muted-foreground">Ministerio de Agricultura</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Presentation Mode Modal */}
      <ReportPresentationModal
        open={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        data={data}
        selectedInstitutionName={selectedInstitutionName}
        profileName={profile?.name || 'Administrador'}
        introText={introText}
        conclusionText={conclusionText}
        toggles={{
          includeIntro,
          includeRiskList,
          includeRiskChart,
          includeAllInstruments,
          includeComplianceChart,
          includeConclusion,
        }}
        riskIndicators={riskIndicators}
        countNormal={countNormal}
        countProg={countProg}
        countRisk={countRisk}
        countNoReport={countNoReport}
        riskPieData={riskPieData}
        instrumentComplianceData={instrumentComplianceData}
      />
    </AppLayout>
  );
}
