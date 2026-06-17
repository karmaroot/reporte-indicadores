import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Play, Zap, Clock, Filter, Search, X } from 'lucide-react';
import { useAllInstrumentIndicators, useAutoStartReports } from '@/hooks/useInstruments';
import { FREQUENCY_LABELS } from '@/lib/constants';
import { toast } from 'sonner';

function shouldStart(periodicity: string, lastStarted: string | null): boolean {
  if (!lastStarted) return true;
  const last = new Date(lastStarted);
  const now = new Date();
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  switch (periodicity) {
    case 'monthly': return diffDays >= 28;
    case 'quarterly': return diffDays >= 85;
    case 'annually': return diffDays >= 360;
    default: return diffDays >= 85;
  }
}

export default function AutoStart() {
  const { data: assignments, isLoading } = useAllInstrumentIndicators();
  const autoStart = useAutoStartReports();

  const [selectedCdR, setSelectedCdR] = useState<string>('all');
  const [selectedInstrument, setSelectedInstrument] = useState<string>('all');
  const [searchIndicator, setSearchIndicator] = useState<string>('');

  // Extract unique institutions and instruments
  const uniqueCdRs = Array.from(
    new Set((assignments ?? []).map((a: any) => a.instruments?.institutions?.name).filter(Boolean))
  ) as string[];

  const uniqueInstruments = Array.from(
    new Set(
      (assignments ?? [])
        .filter((a: any) => selectedCdR === 'all' || a.instruments?.institutions?.name === selectedCdR)
        .map((a: any) => a.instruments?.name)
        .filter(Boolean)
    )
  ) as string[];

  const handleCdRChange = (value: string) => {
    setSelectedCdR(value);
    setSelectedInstrument('all');
  };

  const isFiltered = selectedCdR !== 'all' || selectedInstrument !== 'all' || searchIndicator !== '';

  const handleClearFilters = () => {
    setSelectedCdR('all');
    setSelectedInstrument('all');
    setSearchIndicator('');
  };

  // Filter assignments based on selections
  const filteredAssignments = (assignments ?? []).filter((a: any) => {
    const cdrName = a.instruments?.institutions?.name || '';
    const instName = a.instruments?.name || '';
    const indName = a.indicators?.name || '';

    const matchesCdR = selectedCdR === 'all' || cdrName === selectedCdR;
    const matchesInstrument = selectedInstrument === 'all' || instName === selectedInstrument;
    const matchesIndicator = indName.toLowerCase().includes(searchIndicator.toLowerCase());

    return matchesCdR && matchesInstrument && matchesIndicator;
  });

  const pendingStart = filteredAssignments.filter((a: any) =>
    a.auto_start && shouldStart(a.periodicity, a.last_started_at)
  );

  const alreadyStarted = filteredAssignments.filter((a: any) =>
    a.auto_start && !shouldStart(a.periodicity, a.last_started_at)
  );

  const handleStartAll = () => {
    if (!pendingStart.length) { toast.info('No hay asignaciones pendientes de inicio'); return; }
    autoStart.mutate(pendingStart as any);
  };

  const handleStartOne = (assignment: any) => {
    autoStart.mutate([assignment]);
  };

  return (
    <AppLayout>
      <PageHeader title="Inicio Automático" description="Gestión del inicio automático de reportes por periodicidad">
        {pendingStart.length > 0 && (
          <Button onClick={handleStartAll} disabled={autoStart.isPending}>
            <Play className="h-4 w-4 mr-2" />
            Iniciar Todos ({pendingStart.length})
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : !(assignments ?? []).filter((a: any) => a.auto_start).length ? (
        <EmptyState icon={Zap} title="Sin configuración de auto-inicio" description="No hay asignaciones con inicio automático habilitado. Activa el auto-inicio en la configuración de instrumentos." />
      ) : (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-card rounded-2xl shadow-card border p-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" /> Filtros de Asignaciones
              </h3>
              {isFiltered && (
                <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg px-2.5" onClick={handleClearFilters}>
                  <X className="h-3.5 w-3.5 mr-1" /> Limpiar Filtros
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Centro de Responsabilidad</label>
                <Select value={selectedCdR} onValueChange={handleCdRChange}>
                  <SelectTrigger className="rounded-xl border-muted/50 bg-background/50 focus:ring-primary/20">
                    <SelectValue placeholder="Todos los CdR" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todos los CdR</SelectItem>
                    {uniqueCdRs.map((name: string) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Instrumento</label>
                <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
                  <SelectTrigger className="rounded-xl border-muted/50 bg-background/50 focus:ring-primary/20">
                    <SelectValue placeholder="Todos los instrumentos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todos los instrumentos</SelectItem>
                    {uniqueInstruments.map((name: string) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Indicador</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre..."
                    className="pl-9 rounded-xl border-muted/50 bg-background/50 focus:ring-primary/20"
                    value={searchIndicator}
                    onChange={e => setSearchIndicator(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Search Result Empty State */}
          {pendingStart.length === 0 && alreadyStarted.length === 0 && (
            <div className="text-center py-12 bg-card border rounded-2xl">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-foreground">No se encontraron asignaciones</p>
              <p className="text-xs text-muted-foreground mt-1">Prueba a ajustar o limpiar tus filtros activos.</p>
              <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={handleClearFilters}>
                Limpiar Filtros
              </Button>
            </div>
          )}

          {pendingStart.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> Pendientes de Inicio ({pendingStart.length})
              </h3>
              <div className="space-y-3">
                {pendingStart.map((a: any) => (
                  <div key={a.id} className="bg-card rounded-lg shadow-card p-4 border-l-4 border-amber-400">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{(a.indicators as any)?.name}</h4>
                        <p className="text-xs text-muted-foreground">{(a.instruments as any)?.name} — {(a.instruments as any)?.institutions?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {FREQUENCY_LABELS[a.periodicity as keyof typeof FREQUENCY_LABELS] ?? a.periodicity}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => handleStartOne(a)} disabled={autoStart.isPending}>
                          <Play className="h-3 w-3 mr-1" />Iniciar
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.last_started_at ? `Último inicio: ${new Date(a.last_started_at).toLocaleDateString('es')}` : 'Nunca iniciado'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alreadyStarted.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Ya Iniciados ({alreadyStarted.length})
              </h3>
              <div className="space-y-3">
                {alreadyStarted.map((a: any) => (
                  <div key={a.id} className="bg-card rounded-lg shadow-card p-4 opacity-70">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{(a.indicators as any)?.name}</h4>
                        <p className="text-xs text-muted-foreground">{(a.instruments as any)?.name} — {(a.instruments as any)?.institutions?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                          {FREQUENCY_LABELS[a.periodicity as keyof typeof FREQUENCY_LABELS] ?? a.periodicity}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => handleStartOne(a)} disabled={autoStart.isPending}>
                          <Play className="h-3 w-3 mr-1" />Iniciar
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Último inicio: {new Date(a.last_started_at).toLocaleDateString('es')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
