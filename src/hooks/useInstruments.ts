import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Queries ---
export function useInstruments(institutionId?: string) {
  return useQuery({
    queryKey: ['instruments', institutionId],
    queryFn: async () => {
      let query = supabase.from('instruments').select('*').order('name');
      if (institutionId) query = query.eq('institution_id', institutionId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useInstrumentIndicators(instrumentId?: string) {
  return useQuery({
    queryKey: ['instrument-indicators', instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instrument_indicators')
        .select('*, instruments(name, institution_id), indicators(name, description, unit, target_value, indicator_type, reporting_frequency), informant:profiles!instrument_indicators_informant_id_fkey(id, name, email), reviewer:profiles!instrument_indicators_reviewer_id_fkey(id, name, email)')
        .eq('instrument_id', instrumentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyAssignments(userId?: string) {
  return useQuery({
    queryKey: ['my-assignments', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instrument_indicators')
        .select('*, instruments(name, institution_id, institutions(name)), indicators(name, description, unit, target_value, indicator_type, reporting_frequency, q1_prog, q2_prog, q3_prog, q4_prog, notes)')
        .or(`informant_id.eq.${userId},reviewer_id.eq.${userId}`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAllInstrumentIndicators() {
  return useQuery({
    queryKey: ['all-instrument-indicators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instrument_indicators')
        .select('*, instruments(name, institution_id, institutions(name)), indicators(name, description, unit, target_value, indicator_type, reporting_frequency, q1_prog, q2_prog, q3_prog, q4_prog, notes), informant:profiles!instrument_indicators_informant_id_fkey(id, name), reviewer:profiles!instrument_indicators_reviewer_id_fkey(id, name)')
        .eq('is_active', true)
        .eq('auto_start', true)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

// --- Mutations ---
export function useCreateInstrument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; type: string; description?: string; institution_id: string; is_active?: boolean }) => {
      const { error } = await supabase.from('instruments').insert(values);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instruments'] }); toast.success('Instrumento creado'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateInstrument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; name: string; type: string; description?: string; is_active?: boolean }) => {
      const { error } = await supabase.from('instruments').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instruments'] }); toast.success('Instrumento actualizado'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteInstrument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('instruments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instruments'] }); toast.success('Instrumento eliminado'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreateInstrumentIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { instrument_id: string; indicator_id: string; informant_id: string; reviewer_id: string; periodicity: string; auto_start?: boolean; unit_area?: string }) => {
      const { error } = await supabase.from('instrument_indicators').insert(values);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instrument-indicators'] }); toast.success('Indicador asignado'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateInstrumentIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; informant_id: string; reviewer_id: string; periodicity: string; auto_start?: boolean; unit_area?: string }) => {
      const { error } = await supabase.from('instrument_indicators').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instrument-indicators'] }); qc.invalidateQueries({ queryKey: ['all-instrument-indicators'] }); toast.success('Asignación actualizada'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteInstrumentIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('instrument_indicators').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instrument-indicators'] }); toast.success('Asignación eliminada'); },
    onError: (e: any) => toast.error(e.message),
  });
}

// Auto-start: create reports for active instrument_indicators based on periodicity
export function useAutoStartReports() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignments: Array<{ id: string; instrument_id: string; indicator_id: string; informant_id: string; instruments: any; indicators: any }>) => {
      const now = new Date();
      
      // Try to find an open period first
      let { data: periodData } = await supabase.from('periods').select('*').eq('status', 'open').limit(1);
      
      // If no open period, fallback to the most recent one (for testing purposes)
      if (!periodData?.length) {
        const { data: recentPeriods, error: recentError } = await supabase
          .from('periods')
          .select('*')
          .order('end_date', { ascending: false })
          .limit(1);
        
        if (recentError) throw recentError;
        periodData = recentPeriods;
      }

      if (!periodData?.length) throw new Error('No hay periodos registrados en el sistema');

      const period = periodData[0];
      const inserts = [];
      const prevReportAttachmentMap: { [key: number]: string } = {};

      for (let i = 0; i < assignments.length; i++) {
        const a = assignments[i];
        const { data: prevReports } = await supabase
          .from('indicator_reports')
          .select('*')
          .eq('indicator_id', a.indicator_id)
          .eq('institution_id', (a.instruments as any)?.institution_id)
          .order('created_at', { ascending: false })
          .limit(1);

        const prevReport = prevReports && prevReports.length > 0 ? prevReports[0] : null;

        if (prevReport) {
          prevReportAttachmentMap[i] = prevReport.id;
        }

        inserts.push({
          indicator_id: a.indicator_id,
          institution_id: (a.instruments as any)?.institution_id,
          period_id: period.id,
          created_by: a.informant_id,
          status: 'draft' as const,
          numerator: prevReport ? prevReport.numerator : null,
          denominator: prevReport ? prevReport.denominator : null,
          reported_value: prevReport ? prevReport.reported_value : null,
          is_zero_report: prevReport ? prevReport.is_zero_report : false,
          comment: prevReport ? `Valores de arrastre de reporte anterior: ${prevReport.comment || ''}` : '',
          verification_method: prevReport ? prevReport.verification_method : null,
        });
      }

      const { data: insertedReports, error } = await supabase
        .from('indicator_reports')
        .insert(inserts)
        .select('*');

      if (error) throw error;

      if (insertedReports) {
        for (let i = 0; i < insertedReports.length; i++) {
          const prevReportId = prevReportAttachmentMap[i];
          if (prevReportId) {
            const { data: prevAttachments } = await supabase
              .from('attachments')
              .select('*')
              .eq('report_id', prevReportId);

            if (prevAttachments && prevAttachments.length > 0) {
              const newAttachments = prevAttachments.map(att => ({
                report_id: insertedReports[i].id,
                file_url: att.file_url,
                file_name: att.file_name,
                file_type: att.file_type,
                uploaded_by: att.uploaded_by,
              }));
              await supabase.from('attachments').insert(newAttachments);
            }
          }
        }
      }

      // Update last_started_at
      for (const a of assignments) {
        await supabase.from('instrument_indicators').update({ last_started_at: now.toISOString() }).eq('id', a.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['all-instrument-indicators'] });
      toast.success('Reportes iniciados automáticamente');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
