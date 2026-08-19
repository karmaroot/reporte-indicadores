-- Drop the existing foreign key constraint
ALTER TABLE public.indicator_reports
DROP CONSTRAINT IF EXISTS indicator_reports_period_id_fkey;

-- Add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.indicator_reports
ADD CONSTRAINT indicator_reports_period_id_fkey
FOREIGN KEY (period_id)
REFERENCES public.periods(id)
ON DELETE CASCADE;
