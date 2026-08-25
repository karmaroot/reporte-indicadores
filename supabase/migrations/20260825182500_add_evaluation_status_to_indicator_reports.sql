-- Add evaluation_status column to indicator_reports table if it doesn't exist
ALTER TABLE public.indicator_reports 
  ADD COLUMN IF NOT EXISTS evaluation_status TEXT NULL;
