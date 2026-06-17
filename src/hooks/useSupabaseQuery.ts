import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useInstitutions() {
  return useQuery({
    queryKey: ['institutions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('institutions').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useIndicators(filter?: { userId?: string, role?: string }) {
  return useQuery({
    queryKey: ['indicators', filter],
    queryFn: async () => {
      if (filter?.userId && filter?.role !== 'admin') {
        if (filter.role === 'jefatura') {
          const { data: insts, error: instsErr } = await supabase
            .from('user_institutions')
            .select('institution_id')
            .eq('user_id', filter.userId);
          if (instsErr) throw instsErr;
          const institutionIds = (insts ?? []).map(i => i.institution_id);
          if (institutionIds.length === 0) return [];

          const { data, error } = await supabase
            .from('instrument_indicators')
            .select('indicators(*), instruments(institution_id)')
            .eq('is_active', true);
          if (error) throw error;
          return (data ?? [])
            .filter((d: any) => d.instruments && institutionIds.includes(d.instruments.institution_id))
            .map((d: any) => d.indicators as any);
        } else {
          const field = filter.role === 'reviewer' ? 'reviewer_id' : 'informant_id';
          const { data, error } = await supabase
            .from('instrument_indicators')
            .select('indicators(*)')
            .eq(field, filter.userId)
            .eq('is_active', true);
          if (error) throw error;
          return (data ?? []).map(d => d.indicators as any);
        }
      }
      const { data, error } = await supabase.from('indicators').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function usePeriods() {
  return useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const { data, error } = await supabase.from('periods').select('*').order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').order('name');
      if (pErr) throw pErr;
      const { data: roles, error: rErr } = await supabase.from('user_roles').select('user_id, role');
      if (rErr) throw rErr;
      const { data: insts, error: iErr } = await supabase.from('user_institutions').select('user_id, institution_id');
      if (iErr) throw iErr;
      return (profiles ?? []).map(p => ({
        ...p,
        user_roles: (roles ?? []).filter(r => r.user_id === p.id),
        user_institutions: (insts ?? []).filter(ui => ui.user_id === p.id),
      }));
    },
  });
}

export function useReports(filter?: { userId?: string, role?: string, status?: string | string[] }) {
  return useQuery({
    queryKey: ['reports', filter],
    queryFn: async () => {
      let query = supabase
        .from('indicator_reports')
        .select('*, indicators(name, description, notes, target_value, unit, indicator_type, q1_prog, q2_prog, q3_prog, q4_prog), institutions(name), periods(name, start_date)')
        .order('created_at', { ascending: false });

      if (filter?.status) {
        if (Array.isArray(filter.status)) {
          query = query.in('status', filter.status);
        } else {
          query = query.eq('status', filter.status);
        }
      }

      if (filter?.userId && filter?.role !== 'admin') {
        if (filter.role === 'jefatura') {
          const { data: insts, error: instsErr } = await supabase
            .from('user_institutions')
            .select('institution_id')
            .eq('user_id', filter.userId);
          if (instsErr) throw instsErr;
          const institutionIds = (insts ?? []).map(i => i.institution_id);
          if (institutionIds.length === 0) return [];
          query = query.in('institution_id', institutionIds);
        } else {
          // Get assigned indicators first to be safe, or filter by created_by if informant
          // The user wants filtering by assigned indicators.
          const field = filter.role === 'reviewer' ? 'reviewer_id' : 'informant_id';
          const { data: assignments } = await supabase
            .from('instrument_indicators')
            .select('indicator_id')
            .eq(field, filter.userId)
            .eq('is_active', true);
          
          const assignedIds = (assignments ?? []).map(a => a.indicator_id);
          if (assignedIds.length > 0) {
            query = query.in('indicator_id', assignedIds);
          } else {
            return []; // No assignments, no reports
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ['report', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('indicator_reports')
        .select(`
          *,
          indicators(name, description, target_value, unit, indicator_type, q1_prog, q2_prog, q3_prog, q4_prog),
          institutions(name),
          periods(name, start_date),
          creator:created_by(name)
        `)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useObservations(reportId?: string) {
  return useQuery({
    queryKey: ['observations', reportId],
    queryFn: async () => {
      let query = supabase
        .from('observations')
        .select(`
          *,
          reviewer:reviewer_id(name),
          observation_responses(
            *,
            informant:user_id(name)
          )
        `)
        .order('created_at', { ascending: false });
      if (reportId) query = query.eq('report_id', reportId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useAttachments(reportId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('report_id', reportId!)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useReportCounts(filter?: { userId?: string, role?: string }) {
  return useQuery({
    queryKey: ['report-counts', filter],
    queryFn: async () => {
      let query = supabase.from('indicator_reports').select('status, indicator_id');
      
      if (filter?.userId && filter?.role !== 'admin') {
        const field = filter.role === 'reviewer' ? 'reviewer_id' : 'informant_id';
        const { data: assignments } = await supabase
          .from('instrument_indicators')
          .select('indicator_id')
          .eq(field, filter.userId)
          .eq('is_active', true);
        
        const assignedIds = (assignments ?? []).map(a => a.indicator_id);
        if (assignedIds.length > 0) {
          query = query.in('indicator_id', assignedIds);
        } else {
          return { total: 0, draft: 0, pending: 0, submitted: 0, approved: 0, observed: 0, responded: 0 };
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      const counts = {
        total: data.length,
        draft: data.filter(r => r.status === 'draft').length,
        // 'pending' = all reports currently waiting for the reviewer to act
        pending: data.filter(r => ['submitted', 'under_review', 'responded'].includes(r.status)).length,
        submitted: data.filter(r => r.status === 'submitted').length,
        approved: data.filter(r => r.status === 'approved').length,
        observed: data.filter(r => r.status === 'observed').length,
        responded: data.filter(r => r.status === 'responded').length,
      };
      return counts;
    },
  });
}
