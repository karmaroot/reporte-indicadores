import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useAuth } from '@/hooks/useAuth';

function useDashboardData(userId?: string, userRole?: string | null) {
  return useQuery({
    queryKey: ['admin-dashboard-full-data', userId, userRole],
    queryFn: async () => {
      let query = supabase.from('institutions').select('*').order('name');

      if (userRole === 'jefatura' && userId) {
        const { data: userInsts, error: uiErr } = await supabase
          .from('user_institutions')
          .select('institution_id')
          .eq('user_id', userId);
        if (uiErr) throw uiErr;
        const institutionIds = (userInsts ?? []).map(ui => ui.institution_id);
        
        if (institutionIds.length === 0) return [];
        query = query.in('id', institutionIds);
      }

      const { data: institutions, error: instErr } = await query;
      if (instErr) throw instErr;

      const { data: instruments, error: insErr } = await supabase.from('instruments').select('*').eq('is_active', true);
      if (insErr) throw insErr;

      const { data: indicators, error: indErr } = await supabase
        .from('indicators')
        .select(`*, indicator_reports (reported_value, status, period_id, numerator, denominator)`)
        .eq('is_active', true);
      if (indErr) throw indErr;

      const data = institutions.map(inst => {
        const instInstruments = instruments.filter(i => i.institution_id === inst.id);
        const instrumentsWithIndicators = instInstruments.map(instrument => {
          const instInds = indicators.filter(ind => ind.instrument_id === instrument.id);
          return {
            ...instrument,
            indicators: instInds
          };
        }).filter(instrument => instrument.indicators.length > 0);
        return {
          ...inst,
          instruments: instrumentsWithIndicators
        };
      });

      return data.filter(d => d.instruments.length > 0);
    }
  });
}

function getQuarterTarget(indicator: any) {
  const month = new Date().getMonth();
  if (month < 3) return indicator.q1_prog || 0;
  if (month < 6) return indicator.q2_prog || 0;
  if (month < 9) return indicator.q3_prog || 0;
  return indicator.q4_prog || 0;
}

function getRealTimeProgress(indicator: any) {
  if (!indicator.indicator_reports || indicator.indicator_reports.length === 0) return 0;
  
  const validReports = indicator.indicator_reports.filter((r: any) => 
    ['submitted', 'under_review', 'responded', 'approved'].includes(r.status)
  );

  const unitLower = indicator.unit?.toLowerCase().trim() || '';
  const isQuantity = indicator.indicator_type === 'quantity' || unitLower === 'cantidad';

  if (isQuantity) {
    return validReports.reduce((sum: number, r: any) => sum + (Number(r.reported_value) || 0), 0);
  } else {
    const totalNum = validReports.reduce((sum: number, r: any) => sum + (Number(r.numerator) || 0), 0);
    const totalDen = validReports.reduce((sum: number, r: any) => sum + (Number(r.denominator) || 0), 0);
    if (totalDen > 0) {
      if (unitLower.includes('%') || unitLower.includes('porcentaje')) {
        return (totalNum / totalDen) * 100;
      }
      return totalNum / totalDen;
    }
    return 0;
  }
}

const LiquidDrum = ({ value, label, onClick }: { value: number, label: string, onClick: () => void }) => {
  const percentage = Math.min(Math.max(value, 0), 100);
  
  return (
    <div 
      onClick={onClick}
      className="relative w-36 h-48 rounded-t-2xl rounded-b-[3rem] border-4 border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900/50 shadow-lg group hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 cursor-pointer flex-shrink-0"
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 z-0 overflow-hidden"
        initial={{ height: 0 }}
        animate={{ height: `${percentage}%` }}
        transition={{ type: 'spring', damping: 25, stiffness: 40 }}
      >
        <div className="absolute w-[250%] h-[300px] -left-[75%] bottom-0">
          <motion.div
            animate={{ x: ['0%', '33.33%'] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            className="w-full h-full opacity-90"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.6) 100%)',
              borderRadius: '40% 40% 0 0',
            }}
          />
        </div>
      </motion.div>
      
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4">
        <span className={`text-4xl font-black tracking-tighter drop-shadow-md transition-colors duration-500 ${percentage > 45 ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
          {percentage.toFixed(0)}%
        </span>
        <span className={`text-[10px] font-black uppercase tracking-widest text-center mt-2 drop-shadow-sm transition-colors duration-500 ${percentage > 30 ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
          {label}
        </span>
      </div>
      
      <div className="absolute inset-0 z-20 rounded-t-2xl rounded-b-[3rem] bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-60 pointer-events-none" />
      <div className="absolute top-2 left-3 w-1.5 h-24 rounded-full bg-white/40 blur-[1px] pointer-events-none z-20" />
    </div>
  );
};

const IndicatorBar = ({ indicator }: { indicator: any }) => {
  const target = Number(indicator.target_value) || 0;
  const quarterTarget = getQuarterTarget(indicator);
  const realTime = getRealTimeProgress(indicator);
  const weight = Number(indicator.weight) || 0;
  const isFulfilled = realTime >= quarterTarget || realTime >= target;
  
  const unitLower = indicator.unit?.toLowerCase().trim() || '';
  const advanceColor = realTime === 0 ? '#ef4444' : (realTime < quarterTarget ? '#fbbf24' : '#10b981');

  const chartData = [
    { name: 'Meta', value: target, color: 'hsl(var(--muted-foreground))' },
    { name: 'Prog.', value: quarterTarget, color: 'hsl(var(--primary))' },
    { name: 'Avance', value: Number(realTime.toFixed(2)), color: advanceColor }
  ];

  return (
    <div className="bg-card p-5 rounded-xl border shadow-sm space-y-4 flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <p className="text-sm font-bold text-foreground leading-tight">{indicator.name}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-md">
            Ponderación: {weight}%
          </span>
          {isFulfilled && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        </div>
      </div>

      <div className="h-[200px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
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
            <span className="text-[10px] font-bold text-muted-foreground">{chartData[0].value} {unitLower.includes('%') ? '%' : ''} Meta Anual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: chartData[1].color }}></div>
            <span className="text-[10px] font-bold text-muted-foreground">{chartData[1].value} {unitLower.includes('%') ? '%' : ''} Prog. Trimestre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: chartData[2].color }}></div>
            <span className="text-[10px] font-bold text-foreground">{chartData[2].value} {unitLower.includes('%') ? '%' : ''} Avance Real</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const { user, userRole } = useAuth();
  const { data: dashboardData, isLoading } = useDashboardData(user?.id, userRole);
  const [selectedInstrument, setSelectedInstrument] = useState<any | null>(null);

  return (
    <AppLayout>
      <PageHeader 
        title="Cuadro de Mando Estratégico" 
        description="Vista centralizada del cumplimiento de instrumentos por Centro de Responsabilidad"
      />

      <div className="space-y-8 pb-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
            <Loader2 className="animate-spin h-12 w-12 mb-4 text-primary" />
            <p className="font-medium tracking-widest uppercase text-xs">Construyendo visualizaciones...</p>
          </div>
        ) : dashboardData?.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
            <p className="text-muted-foreground font-medium">No hay centros de responsabilidad con instrumentos configurados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 space-y-8">
            {dashboardData?.map((institution) => (
              <Card key={institution.id} className="overflow-hidden border-none shadow-card bg-background/50">
                <CardHeader className="border-b bg-muted/20 px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-extrabold text-foreground">{institution.name}</CardTitle>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Centro de Responsabilidad</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="flex gap-8 overflow-x-auto pb-4 custom-scrollbar items-center">
                    {institution.instruments.map((instrument: any) => {
                      let totalWeight = 0;
                      let achievedWeight = 0;

                      instrument.indicators.forEach((ind: any) => {
                        const weight = Number(ind.weight) || 0;
                        totalWeight += weight;
                        const target = Number(ind.target_value) || 0;
                        const quarterTarget = getQuarterTarget(ind);
                        const realTimeProgress = getRealTimeProgress(ind);
                        if (realTimeProgress >= quarterTarget || realTimeProgress >= target) {
                          achievedWeight += weight;
                        }
                      });

                      const drumPercentage = totalWeight > 0 ? (achievedWeight / totalWeight) * 100 : 0;

                      return (
                        <div key={instrument.id} className="flex flex-col items-center gap-4">
                          <LiquidDrum 
                            value={drumPercentage} 
                            label={instrument.name} 
                            onClick={() => setSelectedInstrument(instrument)} 
                          />
                          <div className="text-center">
                            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Peso Logrado</p>
                            <p className="text-sm font-black text-foreground">{achievedWeight.toFixed(1)} / {totalWeight.toFixed(1)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!selectedInstrument} onOpenChange={(open) => !open && setSelectedInstrument(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto sm:border-l border-muted/50 p-0">
          {selectedInstrument && (
            <div className="flex flex-col h-full bg-muted/10">
              <SheetHeader className="p-8 bg-background border-b sticky top-0 z-10">
                <SheetTitle className="text-2xl font-extrabold">{selectedInstrument.name}</SheetTitle>
                <SheetDescription className="text-xs font-bold uppercase tracking-widest mt-1">
                  {selectedInstrument.type} • Rendimiento de Indicadores
                </SheetDescription>
              </SheetHeader>
              
              <div className="p-8 space-y-6">
                {selectedInstrument.indicators.length === 0 ? (
                  <div className="text-center py-10 bg-background rounded-xl border border-dashed">
                    <p className="text-muted-foreground font-medium text-sm">Este instrumento no tiene indicadores registrados.</p>
                  </div>
                ) : (
                  selectedInstrument.indicators.map((ind: any) => (
                    <IndicatorBar key={ind.id} indicator={ind} />
                  ))
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
