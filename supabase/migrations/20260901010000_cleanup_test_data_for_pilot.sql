-- SQL Migration script to purge test transactional data for pilot launch

-- 1. Remove test report observations responses
DELETE FROM public.observation_responses;

-- 2. Remove test report observations
DELETE FROM public.observations;

-- 3. Remove test report attachments
DELETE FROM public.attachments;

-- 4. Remove test indicator reports
DELETE FROM public.indicator_reports;

-- 5. Purge test email queue items
DELETE FROM public.email_queue;

-- 6. Reset auto-start timestamps on assignments
UPDATE public.instrument_indicators SET last_started_at = NULL;
