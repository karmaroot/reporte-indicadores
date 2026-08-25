import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Maximize2, Minimize2, ChevronLeft, ChevronRight, Play, Pause,
  Sun, Moon, X, ZoomIn, ZoomOut, RotateCcw, FileText, AlertTriangle,
  PieChart as PieIcon, Layers, BarChart3, FileSpreadsheet, CheckCircle2,
  Tv, LayoutList
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, CartesianGrid, PieChart, Pie, Legend } from 'recharts';
import { CNR_OFFICIAL_LOGO_BASE64 } from '@/assets/cnr-official-logo-base64';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PresentationSection {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
}

interface ReportPresentationModalProps {
  open: boolean;
  onClose: () => void;
  data: any;
  selectedInstitutionName: string;
  profileName?: string;
  introText: string;
  conclusionText: string;
  toggles: {
    includeIntro: boolean;
    includeRiskList: boolean;
    includeRiskChart: boolean;
    includeAllInstruments: boolean;
    includeComplianceChart: boolean;
    includeConclusion: boolean;
  };
  riskIndicators: any[];
  countNormal: number;
  countProg: number;
  countRisk: number;
  countNoReport: number;
  riskPieData: any[];
  instrumentComplianceData: any[];
}

export function ReportPresentationModal({
  open,
  onClose,
  data,
  selectedInstitutionName,
  profileName = 'Administrador',
  introText,
  conclusionText,
  toggles,
  riskIndicators,
  countNormal,
  countProg,
  countRisk,
  countNoReport,
  riskPieData,
  instrumentComplianceData,
}: ReportPresentationModalProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'slides' | 'scroll'>('slides');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const allInstruments = data?.instruments || [];
  const totalIndicatorsCount = allInstruments.reduce((acc: number, i: any) => acc + (i.indicators?.length || 0), 0);
  const globalProgressAvg = allInstruments.length > 0
    ? Math.round(allInstruments.reduce((acc: number, i: any) => acc + (i.totalProgress || 0), 0) / allInstruments.length)
    : 0;

  // Build active sections / slides list dynamically
  const slides: PresentationSection[] = useMemo(() => {
    const list: PresentationSection[] = [
      {
        id: 'cover',
        title: 'Portada y Resumen Ejecutivo',
        subtitle: 'Visión general de la reportabilidad institucional',
        icon: Tv,
      },
    ];

    if (toggles.includeIntro) {
      list.push({
        id: 'intro',
        title: 'Introducción al Informe',
        subtitle: 'Contexto e marco de evaluación de la CNR',
        icon: FileText,
      });
    }

    if (toggles.includeRiskList) {
      list.push({
        id: 'risk-list',
        title: 'Indicadores bajo Programación o en Riesgo',
        subtitle: `Desglose de los ${riskIndicators.length} indicadores prioritarios`,
        icon: AlertTriangle,
      });
    }

    if (toggles.includeRiskChart) {
      list.push({
        id: 'risk-chart',
        title: 'Proyección Gráfica del Riesgo',
        subtitle: 'Distribución porcentual de cumplimiento por niveles de alerta',
        icon: PieIcon,
      });
    }

    if (toggles.includeAllInstruments) {
      list.push({
        id: 'all-inst',
        title: 'Resumen Consolidado de Instrumentos',
        subtitle: `Avance reportado en ${allInstruments.length} instrumentos activos`,
        icon: Layers,
      });
    }

    if (toggles.includeComplianceChart) {
      list.push({
        id: 'compliance-chart',
        title: 'Proyección Gráfica de Cumplimiento',
        subtitle: 'Comparativa gráfica del avance acumulado por instrumento',
        icon: BarChart3,
      });
    }

    if (toggles.includeConclusion) {
      list.push({
        id: 'conclusion',
        title: 'Conclusión, Recomendaciones y Firmas',
        subtitle: 'Análisis de gestión institucional y acuerdos',
        icon: FileSpreadsheet,
      });
    }

    return list;
  }, [toggles, riskIndicators.length, allInstruments.length]);

  // Handle Fullscreen API
  const toggleFullscreenNative = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  };

  // Sync fullscreen state with native ESC / exit events
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Enter Fullscreen on open
  useEffect(() => {
    if (open) {
      setSlideIndex(0);
      setIsAutoplay(false);
      // Attempt auto fullscreen when opened
      setTimeout(() => {
        if (!document.fullscreenElement && containerRef.current) {
          containerRef.current.requestFullscreen?.().catch(() => {
            // Ignore browser permission restrictions if user gesture wasn't captured
          });
        }
      }, 100);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [open]);

  // Slide Autoplay logic
  useEffect(() => {
    if (isAutoplay && open && viewMode === 'slides') {
      autoplayTimerRef.current = setInterval(() => {
        setSlideIndex((prev) => (prev + 1) % slides.length);
      }, 8000);
    } else {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    }
    return () => {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    };
  }, [isAutoplay, open, viewMode, slides.length]);

  // Keyboard Shortcuts Navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onClose();
        }
      } else if (viewMode === 'slides') {
        if (['ArrowRight', 'ArrowDown', 'Space', 'PageDown'].includes(e.key)) {
          e.preventDefault();
          setSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
        } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
          e.preventDefault();
          setSlideIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Home') {
          e.preventDefault();
          setSlideIndex(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          setSlideIndex(slides.length - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, viewMode, slides.length, onClose]);

  if (!open) return null;

  const currentSlide = slides[slideIndex] || slides[0];

  const handleNext = () => setSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
  const handlePrev = () => setSlideIndex((prev) => Math.max(prev - 1, 0));

  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col select-none transition-colors duration-300 font-sans ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* TOP PRESENTATION BAR */}
      <header
        className={`h-16 shrink-0 px-6 flex items-center justify-between border-b backdrop-blur-md transition-colors ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <img
            src={CNR_OFFICIAL_LOGO_BASE64}
            alt="Logo CNR"
            className="h-10 w-auto object-contain rounded bg-white p-1 shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight">Comisión Nacional de Riego</span>
              <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${
                isDark ? 'border-sky-500/40 text-sky-400 bg-sky-500/10' : 'border-sky-600/40 text-sky-700 bg-sky-50'
              }`}>
                Modo Presentación Ejecutiva
              </Badge>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectedInstitutionName} • {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
        </div>

        {/* CENTER CONTROLS: SLIDE NAVIGATOR */}
        {viewMode === 'slides' && (
          <div className="hidden md:flex items-center gap-2 bg-muted/20 p-1.5 rounded-xl border border-border/40">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrev}
              disabled={slideIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold px-3 font-mono">
              Diapositiva <span className="text-primary font-bold">{slideIndex + 1}</span> de {slides.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNext}
              disabled={slideIndex === slides.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* RIGHT CONTROLS */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <Button
              variant={viewMode === 'slides' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5 font-medium"
              onClick={() => setViewMode('slides')}
            >
              <Tv className="h-3.5 w-3.5 mr-1.5" />
              Diapositivas
            </Button>
            <Button
              variant={viewMode === 'scroll' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5 font-medium"
              onClick={() => setViewMode('scroll')}
            >
              <LayoutList className="h-3.5 w-3.5 mr-1.5" />
              Continuo
            </Button>
          </div>

          {/* Autoplay button for slides */}
          {viewMode === 'slides' && (
            <Button
              variant={isAutoplay ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1.5 hidden sm:inline-flex"
              onClick={() => setIsAutoplay(!isAutoplay)}
            >
              {isAutoplay ? <Pause className="h-3.5 w-3.5 text-amber-300" /> : <Play className="h-3.5 w-3.5" />}
              {isAutoplay ? 'Pausar' : 'Auto'}
            </Button>
          )}

          {/* Zoom controls for scroll view */}
          {viewMode === 'scroll' && (
            <div className={`hidden sm:flex items-center gap-1 p-1 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomLevel(z => Math.max(z - 10, 60))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-mono font-bold px-1">{zoomLevel}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomLevel(z => Math.min(z + 10, 150))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomLevel(100)}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Theme Switcher */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="Cambiar tema de color"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="Pantalla Completa"
            onClick={toggleFullscreenNative}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {/* Close Button */}
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8 ml-1"
            title="Salir de la presentación (Esc)"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-auto relative p-6 sm:p-10 flex flex-col items-center justify-center">
        {viewMode === 'slides' ? (
          /* SLIDE MODE PRESENTATION */
          <div className="w-full max-w-6xl mx-auto h-full flex flex-col justify-between">
            {/* Slide Header */}
            <div className="mb-6 border-b pb-4 flex justify-between items-end border-border/40">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-sky-100 text-sky-700'}`}>
                  <currentSlide.icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">{currentSlide.title}</h2>
                  {currentSlide.subtitle && (
                    <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {currentSlide.subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="hidden sm:block text-right">
                <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
                  SECCIÓN {slideIndex + 1} DE {slides.length}
                </span>
              </div>
            </div>

            {/* Slide Body Content */}
            <div className="flex-1 overflow-auto py-2 flex flex-col justify-center">
              {currentSlide.id === 'cover' && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                  <div className={`p-8 rounded-3xl border shadow-2xl ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b pb-6 border-border/40">
                      <div className="flex items-center gap-5">
                        <img
                          src={CNR_OFFICIAL_LOGO_BASE64}
                          alt="Logo CNR"
                          className="h-24 w-auto object-contain bg-white p-2 rounded-xl shadow-md shrink-0"
                        />
                        <div>
                          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            Comisión Nacional de Riego
                          </h1>
                          <p className="text-xs font-bold uppercase tracking-widest text-primary mt-1">
                            Ministerio de Agricultura • Gobierno de Chile
                          </p>
                          <h3 className="text-lg font-semibold text-sky-500 mt-1">
                            INFORME ESTRATÉGICO DE GESTIÓN Y AVANCE DE INSTRUMENTOS
                          </h3>
                        </div>
                      </div>

                      <div className={`p-4 rounded-xl text-right text-xs font-medium space-y-1 ${
                        isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-100'
                      }`}>
                        <p><span className="font-bold text-foreground">Centro de Resp.:</span> {selectedInstitutionName}</p>
                        <p><span className="font-bold text-foreground">Fecha de Emisión:</span> {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>
                        <p><span className="font-bold text-foreground">Emitido por:</span> {profileName}</p>
                      </div>
                    </div>

                    {/* Executive Key Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Total Instrumentos
                        </span>
                        <div className="text-3xl font-black mt-1 font-mono text-primary">
                          {allInstruments.length}
                        </div>
                        <span className="text-[10px] text-muted-foreground">Vigentes y Monitoreados</span>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Total Indicadores
                        </span>
                        <div className="text-3xl font-black mt-1 font-mono text-primary">
                          {totalIndicatorsCount}
                        </div>
                        <span className="text-[10px] text-muted-foreground">Asignados Activos</span>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Avance Promedio
                        </span>
                        <div className={`text-3xl font-black mt-1 font-mono ${
                          globalProgressAvg >= 85 ? 'text-emerald-500' : globalProgressAvg >= 60 ? 'text-amber-500' : 'text-rose-500'
                        }`}>
                          {globalProgressAvg}%
                        </div>
                        <span className="text-[10px] text-muted-foreground">Cumplimiento Global</span>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Alertas de Riesgo
                        </span>
                        <div className="text-3xl font-black mt-1 font-mono text-amber-500">
                          {riskIndicators.length}
                        </div>
                        <span className="text-[10px] text-muted-foreground">Requieren Atención</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentSlide.id === 'intro' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className={`p-8 rounded-3xl border shadow-xl leading-relaxed whitespace-pre-line text-sm sm:text-base ${
                    isDark ? 'bg-slate-900/80 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <p className="font-semibold text-sky-500 text-xs uppercase tracking-widest mb-3">Contexto y Alcance Institucional</p>
                    {introText}
                  </div>
                </div>
              )}

              {currentSlide.id === 'risk-list' && (
                <div className="space-y-4 animate-in fade-in duration-300 max-h-[60vh] overflow-y-auto pr-1">
                  {riskIndicators.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center font-bold text-base">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
                      ¡Excelente! No hay indicadores en estado crítico ni bajo programación. Todos los indicadores cumplen los estándares exigidos (&ge;85%).
                    </div>
                  ) : (
                    <div className={`border rounded-2xl overflow-hidden shadow-xl ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                      <table className="w-full text-xs sm:text-sm text-left table-fixed border-collapse">
                        <thead>
                          <tr className={`uppercase text-[10px] font-black tracking-wider border-b ${
                            isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <th className="p-3 w-[36%] border-r border-border/40">Indicador</th>
                            <th className="p-3 w-[22%] border-r border-border/40">Informante</th>
                            <th className="p-3 w-[14%] text-center border-r border-border/40">Avance / Meta</th>
                            <th className="p-3 w-[12%] text-center border-r border-border/40">% Cumpl.</th>
                            <th className="p-3 w-[16%] text-center">Estado Alerta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {riskIndicators.map((ind, idx) => (
                            <tr key={idx} className={`hover:bg-muted/10 transition-colors ${
                              isDark ? 'border-slate-800' : 'border-slate-200'
                            }`}>
                              <td className="p-3 font-semibold border-r border-border/30 break-words">
                                <div className="text-xs sm:text-sm">{ind.name}</div>
                                {ind.unit && <div className="text-[10px] font-normal text-muted-foreground mt-0.5">Unidad: {ind.unit}</div>}
                              </td>
                              <td className="p-3 text-muted-foreground border-r border-border/30 text-xs break-words">
                                {ind.informant}
                              </td>
                              <td className="p-3 text-center font-mono text-xs border-r border-border/30 whitespace-nowrap">
                                {ind.latestReport ? `${ind.latestReport.reported_value} / ${ind.target_value}` : 'Sin datos'}
                              </td>
                              <td className="p-3 text-center font-bold font-mono text-xs border-r border-border/30 whitespace-nowrap">
                                {ind.latestReport ? `${ind.progress}%` : '0%'}
                              </td>
                              <td className="p-3 text-center text-xs">
                                {ind.statusCategory === 'risk' && (
                                  <span className="inline-block w-full px-2 py-1 rounded-md font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 text-center">
                                    Riesgo (&lt;60%)
                                  </span>
                                )}
                                {ind.statusCategory === 'prog' && (
                                  <span className="inline-block w-full px-2 py-1 rounded-md font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30 text-center">
                                    Bajo Prog. (60-84%)
                                  </span>
                                )}
                                {ind.statusCategory === 'no_report' && (
                                  <span className="inline-block w-full px-2 py-1 rounded-md font-extrabold bg-slate-500/20 text-slate-400 border border-slate-500/30 text-center">
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

              {currentSlide.id === 'risk-chart' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="h-72 w-full md:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={riskPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={95}
                            innerRadius={45}
                            paddingAngle={4}
                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          >
                            {riskPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#0f172a' : '#ffffff'} strokeWidth={2} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="w-full md:w-1/2 space-y-3 text-xs sm:text-sm">
                      <h4 className="font-extrabold text-sm text-foreground mb-2">Desglose de Estados de Evaluación:</h4>

                      <div className={`flex justify-between items-center p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
                          Cumplimiento Normal (&ge;85%)
                        </span>
                        <span className="font-black font-mono text-base">{countNormal}</span>
                      </div>

                      <div className={`flex justify-between items-center p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm" />
                          Bajo Programación (60-84%)
                        </span>
                        <span className="font-black font-mono text-base text-amber-400">{countProg}</span>
                      </div>

                      <div className={`flex justify-between items-center p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <span className="h-3 w-3 rounded-full bg-rose-500 shadow-sm" />
                          Riesgo Crítico (&lt;60%)
                        </span>
                        <span className="font-black font-mono text-base text-rose-400">{countRisk}</span>
                      </div>

                      <div className={`flex justify-between items-center p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <span className="h-3 w-3 rounded-full bg-slate-500 shadow-sm" />
                          Sin Reporte Registrado
                        </span>
                        <span className="font-black font-mono text-base text-slate-400">{countNoReport}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentSlide.id === 'all-inst' && (
                <div className="space-y-4 animate-in fade-in duration-300 max-h-[60vh] overflow-y-auto pr-1">
                  <div className={`border rounded-2xl overflow-hidden shadow-xl ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                    <table className="w-full text-xs sm:text-sm text-left table-fixed border-collapse">
                      <thead>
                        <tr className={`uppercase text-[10px] font-black tracking-wider border-b ${
                          isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          <th className="p-3 w-[35%] border-r border-border/40">Instrumento</th>
                          <th className="p-3 w-[25%] border-r border-border/40">Centro de Resp.</th>
                          <th className="p-3 w-[12%] text-center border-r border-border/40">Indicadores</th>
                          <th className="p-3 w-[13%] text-center border-r border-border/40">% Avance</th>
                          <th className="p-3 w-[15%] text-center">Estado General</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {allInstruments.map((inst: any, idx: number) => (
                          <tr key={idx} className={`hover:bg-muted/10 transition-colors ${
                            isDark ? 'border-slate-800' : 'border-slate-200'
                          }`}>
                            <td className="p-3 font-semibold border-r border-border/30 text-xs sm:text-sm break-words">
                              {inst.name}
                            </td>
                            <td className="p-3 text-muted-foreground border-r border-border/30 text-xs break-words">
                              {inst.institution_name}
                            </td>
                            <td className="p-3 text-center font-mono font-bold border-r border-border/30 text-xs">
                              {inst.indicators.length}
                            </td>
                            <td className="p-3 text-center font-extrabold font-mono border-r border-border/30 text-sm">
                              {inst.totalProgress}%
                            </td>
                            <td className="p-3 text-center text-xs">
                              {inst.totalProgress >= 85 && (
                                <span className="inline-block w-full px-2 py-1 rounded-md font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-center">
                                  Óptimo (&ge;85%)
                                </span>
                              )}
                              {inst.totalProgress >= 60 && inst.totalProgress < 85 && (
                                <span className="inline-block w-full px-2 py-1 rounded-md font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30 text-center">
                                  Regular (60-84%)
                                </span>
                              )}
                              {inst.totalProgress < 60 && (
                                <span className="inline-block w-full px-2 py-1 rounded-md font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 text-center">
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

              {currentSlide.id === 'compliance-chart' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className={`p-6 rounded-3xl border shadow-xl ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={instrumentComplianceData} margin={{ top: 15, right: 15, left: -10, bottom: 35 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={isDark ? 0.15 : 0.4} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }} interval={0} angle={-15} textAnchor="end" />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }} unit="%" />
                          <RechartsTooltip formatter={(val: number) => [`${val}%`, 'Avance Acumulado']} />
                          <Bar dataKey="cumplimiento" radius={[6, 6, 0, 0]}>
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

              {currentSlide.id === 'conclusion' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className={`p-8 rounded-3xl border shadow-xl leading-relaxed whitespace-pre-line text-sm sm:text-base ${
                    isDark ? 'bg-slate-900/80 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <p className="font-semibold text-sky-500 text-xs uppercase tracking-widest mb-3">Conclusiones y Recomendaciones de Gestión</p>
                    {conclusionText}
                  </div>

                  <div className="grid grid-cols-2 gap-10 pt-6 text-center text-xs">
                    <div className={`p-4 rounded-xl border-t-2 ${isDark ? 'border-sky-500/60 bg-slate-900/50' : 'border-sky-600 bg-slate-100'}`}>
                      <p className="font-black text-sm text-foreground">{profileName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Encargado de Indicadores y Monitoreo AGE</p>
                      <p className="text-xs text-muted-foreground">Comisión Nacional de Riego</p>
                    </div>
                    <div className={`p-4 rounded-xl border-t-2 ${isDark ? 'border-sky-500/60 bg-slate-900/50' : 'border-sky-600 bg-slate-100'}`}>
                      <p className="font-black text-sm text-foreground">Jefatura / Dirección Institucional</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Comisión Nacional de Riego</p>
                      <p className="text-xs text-muted-foreground">Ministerio de Agricultura</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Slide Footer Navigation Bar */}
            <div className="mt-6 border-t pt-4 flex justify-between items-center border-border/40">
              <Button
                variant="outline"
                size="lg"
                onClick={handlePrev}
                disabled={slideIndex === 0}
                className="gap-2 font-bold"
              >
                <ChevronLeft className="h-5 w-5" />
                Anterior
              </Button>

              {/* Slide dots indicator */}
              <div className="flex items-center gap-1.5">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setSlideIndex(idx)}
                    title={s.title}
                    className={`h-2.5 rounded-full transition-all ${
                      idx === slideIndex
                        ? 'w-8 bg-sky-500'
                        : `w-2.5 ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-300 hover:bg-slate-400'}`
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="default"
                size="lg"
                onClick={handleNext}
                disabled={slideIndex === slides.length - 1}
                className="gap-2 font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg"
              >
                Siguiente
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : (
          /* CONTINUOUS SCROLL MODE */
          <div
            className="w-full max-w-4xl mx-auto transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          >
            <div className={`p-8 sm:p-12 rounded-3xl border shadow-2xl space-y-8 ${
              isDark ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              {/* Header Banner */}
              <div className="border-b-2 border-primary/30 pb-6 flex justify-between items-start">
                <div className="flex items-center gap-5">
                  <img
                    src={CNR_OFFICIAL_LOGO_BASE64}
                    alt="Logo Oficial CNR"
                    className="h-20 w-auto object-contain bg-white p-2 rounded-xl shadow-sm shrink-0"
                  />
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">
                      Comisión Nacional de Riego
                    </h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Ministerio de Agricultura • Gobierno de Chile
                    </p>
                    <p className="text-xs font-extrabold text-sky-500 mt-1">
                      INFORME DE GESTIÓN Y AVANCE DE INSTRUMENTOS
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs text-muted-foreground space-y-1">
                  <p><span className="font-bold text-foreground">Fecha Emisión:</span> {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>
                  <p><span className="font-bold text-foreground">Emitido por:</span> {profileName}</p>
                  <p><span className="font-bold text-foreground">Centro de Resp.:</span> {selectedInstitutionName}</p>
                </div>
              </div>

              {/* Sections continuous flow */}
              {toggles.includeIntro && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-sky-500 border-b pb-1">1. Introducción</h3>
                  <div className={`text-xs leading-relaxed whitespace-pre-line p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    {introText}
                  </div>
                </div>
              )}

              {toggles.includeRiskList && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-500 border-b pb-1">
                    2. Indicadores bajo Programación, en Riesgo o Sin Reporte ({riskIndicators.length})
                  </h3>
                  <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className={`uppercase text-[9px] font-black border-b ${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          <th className="p-2 border-r">Indicador</th>
                          <th className="p-2 border-r">Informante</th>
                          <th className="p-2 text-center border-r">Avance / Meta</th>
                          <th className="p-2 text-center border-r">% Cumpl.</th>
                          <th className="p-2 text-center">Estado Alerta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {riskIndicators.map((ind, idx) => (
                          <tr key={idx} className="align-top">
                            <td className="p-2 font-semibold border-r">{ind.name}</td>
                            <td className="p-2 text-muted-foreground border-r">{ind.informant}</td>
                            <td className="p-2 text-center font-mono border-r">{ind.latestReport ? `${ind.reported_value} / ${ind.target_value}` : 'Sin datos'}</td>
                            <td className="p-2 text-center font-bold border-r">{ind.latestReport ? `${ind.progress}%` : '0%'}</td>
                            <td className="p-2 text-center font-bold text-[10px]">
                              {ind.statusCategory === 'risk' && <span className="text-rose-400">Riesgo (&lt;60%)</span>}
                              {ind.statusCategory === 'prog' && <span className="text-amber-400">Bajo Prog. (60-84%)</span>}
                              {ind.statusCategory === 'no_report' && <span className="text-slate-400">Sin Reporte</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {toggles.includeRiskChart && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-sky-500 border-b pb-1">3. Proyección Gráfica del Riesgo</h3>
                  <div className={`h-64 w-full p-4 rounded-xl border flex items-center justify-center ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {riskPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {toggles.includeAllInstruments && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-sky-500 border-b pb-1">4. Resumen Consolidado de Instrumentos</h3>
                  <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className={`uppercase text-[9px] font-black border-b ${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          <th className="p-2 border-r">Instrumento</th>
                          <th className="p-2 border-r">Centro Resp.</th>
                          <th className="p-2 text-center border-r">Indicadores</th>
                          <th className="p-2 text-center border-r">% Avance</th>
                          <th className="p-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {allInstruments.map((inst: any, idx: number) => (
                          <tr key={idx} className="align-top">
                            <td className="p-2 font-semibold border-r">{inst.name}</td>
                            <td className="p-2 text-muted-foreground border-r">{inst.institution_name}</td>
                            <td className="p-2 text-center font-mono border-r">{inst.indicators.length}</td>
                            <td className="p-2 text-center font-bold border-r">{inst.totalProgress}%</td>
                            <td className="p-2 text-center font-bold text-[10px]">
                              {inst.totalProgress >= 85 ? <span className="text-emerald-500">Óptimo</span> : inst.totalProgress >= 60 ? <span className="text-amber-500">Regular</span> : <span className="text-rose-500">Crítico</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {toggles.includeComplianceChart && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-sky-500 border-b pb-1">5. Proyección Gráfica de Cumplimiento</h3>
                  <div className={`h-64 w-full p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={instrumentComplianceData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
                        <RechartsTooltip formatter={(val: number) => [`${val}%`, 'Avance']} />
                        <Bar dataKey="cumplimiento" radius={[4, 4, 0, 0]}>
                          {instrumentComplianceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.cumplimiento >= 85 ? '#10b981' : entry.cumplimiento >= 60 ? '#f59e0b' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {toggles.includeConclusion && (
                <div className="space-y-6 pt-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-sky-500 border-b pb-1">6. Conclusión y Firmas</h3>
                  <div className={`text-xs leading-relaxed whitespace-pre-line p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    {conclusionText}
                  </div>
                  <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
                    <div className="border-t pt-2">
                      <p className="font-bold">{profileName}</p>
                      <p className="text-[10px] text-muted-foreground">Encargado de Indicadores y Monitoreo AGE</p>
                    </div>
                    <div className="border-t pt-2">
                      <p className="font-bold">Jefatura / Dirección Institucional</p>
                      <p className="text-[10px] text-muted-foreground">Comisión Nacional de Riego</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
