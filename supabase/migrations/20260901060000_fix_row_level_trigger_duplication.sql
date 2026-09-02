-- Fix: Restrict old row-level trigger trigger_report_notification to AFTER UPDATE only, 
-- preventing duplicate email generation on batch INSERT of indicator reports.
DROP TRIGGER IF EXISTS trigger_report_notification ON public.indicator_reports;

CREATE TRIGGER trigger_report_notification
  AFTER UPDATE ON public.indicator_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_indicator_report_notification();
