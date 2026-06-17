import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import { Plus, Search, FileBarChart, Eye, Calendar } from 'lucide-react';
import { useReports, usePeriods } from '@/hooks/useSupabaseQuery';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Reports() {
  const { user, userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  
  const { data: reports, isLoading } = useReports({ 
    userId: user?.id, 
    role: userRole
  });
  const { data: periods } = usePeriods();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all');
  const [search, setSearch] = useState('');

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

  const filtered = (reports ?? []).filter(r => {
    const matchesSearch = !search || (r.indicators as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
                          (r.institutions as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesPeriod = selectedPeriodId === 'all' || r.period_id === selectedPeriodId;
    return matchesSearch && matchesStatus && matchesPeriod;
  });

  // Group filtered reports by period
  const grouped = (periods ?? [])
    .map(p => {
      const periodReports = filtered.filter(r => r.period_id === p.id);
      return {
        period: p,
        reports: periodReports
      };
    })
    .filter(g => g.reports.length > 0);

  // Fallback for reports that don't match any period in our list (if any)
  const unknownPeriodReports = filtered.filter(
    r => !r.period_id || !(periods ?? []).some(p => p.id === r.period_id)
  );
  if (unknownPeriodReports.length > 0) {
    grouped.push({
      period: { id: 'unknown', name: 'Otros Reportes / Periodo Desconocido', start_date: '', end_date: '', status: '' } as any,
      reports: unknownPeriodReports
    });
  }

  return (
    <AppLayout>
      <PageHeader title="Reportes de Indicadores" description="Gestión y seguimiento de reportes por periodo" />

      <div className="space-y-6 pb-10">
        <div className="bg-card rounded-2xl shadow-card border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar reportes..." 
              className="pl-9 rounded-xl border-muted/50 bg-background/50 focus:ring-primary/20" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filtrar Periodo:</label>
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <SelectTrigger className="w-48 rounded-xl border-muted/50 bg-background/50 focus:ring-primary/20">
                <SelectValue placeholder="Todos los Periodos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todos los Periodos</SelectItem>
                {(periods ?? []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border rounded-2xl p-6">
            <EmptyState icon={FileBarChart} title="Sin reportes" description="No se encontraron reportes para el filtro seleccionado." />
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ period, reports: periodReports }) => (
              <div key={period.id} className="border rounded-2xl overflow-hidden bg-card shadow-card">
                <div className="bg-muted/30 px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" /> {period.name}
                    </h3>
                    {period.start_date && period.end_date && (
                      <p className="text-xs text-muted-foreground font-semibold">
                        Rango del periodo: {new Date(period.start_date).toLocaleDateString('es')} al {new Date(period.end_date).toLocaleDateString('es')}
                      </p>
                    )}
                  </div>
                  {period.status && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      period.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {period.status === 'open' ? 'Abierto' : 'Cerrado'}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left text-xs font-semibold text-muted-foreground px-6 py-3.5 uppercase tracking-wider">Indicador</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-6 py-3.5 uppercase tracking-wider">Centro de Responsabilidad</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground px-6 py-3.5 uppercase tracking-wider">Valor Reportado</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground px-6 py-3.5 uppercase tracking-wider">Meta Anual</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground px-6 py-3.5 uppercase tracking-wider">Estado</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground px-6 py-3.5 uppercase tracking-wider">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {periodReports.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-foreground">{(r.indicators as any)?.name}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground font-medium">{(r.institutions as any)?.name}</td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-foreground">
                            {formatReportedValue(r.reported_value, r.indicators)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-muted-foreground font-semibold">
                            {formatReportedValue((r.indicators as any)?.target_value, r.indicators)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <StatusBadge status={r.status as any} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link to={`/reports/${r.id}`}>
                              <Button variant="ghost" size="sm" className="rounded-lg hover:bg-muted">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
