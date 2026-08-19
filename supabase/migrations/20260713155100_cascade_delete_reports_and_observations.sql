-- Adjust attachments constraint to cascade delete when a report is deleted
ALTER TABLE public.attachments
DROP CONSTRAINT IF EXISTS attachments_report_id_fkey;

ALTER TABLE public.attachments
ADD CONSTRAINT attachments_report_id_fkey
FOREIGN KEY (report_id)
REFERENCES public.indicator_reports(id)
ON DELETE CASCADE;

-- Adjust observations constraint to cascade delete when a report is deleted
ALTER TABLE public.observations
DROP CONSTRAINT IF EXISTS observations_report_id_fkey;

ALTER TABLE public.observations
ADD CONSTRAINT observations_report_id_fkey
FOREIGN KEY (report_id)
REFERENCES public.indicator_reports(id)
ON DELETE CASCADE;

-- Adjust observation_responses constraint to cascade delete when an observation is deleted
ALTER TABLE public.observation_responses
DROP CONSTRAINT IF EXISTS observation_responses_observation_id_fkey;

ALTER TABLE public.observation_responses
ADD CONSTRAINT observation_responses_observation_id_fkey
FOREIGN KEY (observation_id)
REFERENCES public.observations(id)
ON DELETE CASCADE;
