-- Migration: Add dynamic {{boton_acceso}} placeholder button to notification triggers and templates

CREATE OR REPLACE FUNCTION public.handle_indicator_report_batch_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_config RECORD;
  v_period_name TEXT;
  v_recipients JSONB := '[]'::jsonb;
  v_recipient RECORD;
  v_subrogate RECORD;
  v_subject TEXT;
  v_body TEXT;
  v_html_body TEXT;
  v_already_exists BOOLEAN;
  v_sample_indicator TEXT;
  v_sample_instrument TEXT;
  v_access_button TEXT;
BEGIN
  SELECT * INTO v_config
  FROM public.email_notification_settings
  WHERE event_type = 'period_started' AND is_enabled = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT p.name INTO v_period_name
  FROM new_reports nr
  JOIN public.periods p ON p.id = nr.period_id
  WHERE p.name IS NOT NULL
  LIMIT 1;

  IF v_period_name IS NULL THEN
    v_period_name := 'Información Histórica';
  END IF;

  -- 1. Informants assigned to ANY of the newly initiated indicators (and their active subrogates)
  IF 'informant' = ANY(v_config.notify_roles) THEN
    FOR v_recipient IN
      SELECT DISTINCT p.id, p.name, p.email, p.subrogate_id, p.is_subrogating
      FROM new_reports nr
      JOIN public.instrument_indicators ii ON ii.indicator_id = nr.indicator_id AND ii.is_active = true
      JOIN public.profiles p ON p.id = ii.informant_id
      WHERE p.email IS NOT NULL AND p.email <> ''
    LOOP
      v_recipients := v_recipients || jsonb_build_object('name', v_recipient.name, 'email', v_recipient.email);
      
      IF v_recipient.is_subrogating AND v_recipient.subrogate_id IS NOT NULL THEN
        SELECT name, email INTO v_subrogate FROM public.profiles WHERE id = v_recipient.subrogate_id;
        IF v_subrogate.email IS NOT NULL AND v_subrogate.email <> '' THEN
          v_recipients := v_recipients || jsonb_build_object('name', v_subrogate.name || ' (Subrogante de ' || v_recipient.name || ')', 'email', v_subrogate.email);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 2. Reviewers assigned to ANY of the newly initiated indicators (and their active subrogates)
  IF 'reviewer' = ANY(v_config.notify_roles) THEN
    FOR v_recipient IN
      SELECT DISTINCT p.id, p.name, p.email, p.subrogate_id, p.is_subrogating
      FROM new_reports nr
      JOIN public.instrument_indicators ii ON ii.indicator_id = nr.indicator_id AND ii.is_active = true
      JOIN public.profiles p ON p.id = ii.reviewer_id
      WHERE p.email IS NOT NULL AND p.email <> ''
    LOOP
      v_recipients := v_recipients || jsonb_build_object('name', v_recipient.name, 'email', v_recipient.email);
      
      IF v_recipient.is_subrogating AND v_recipient.subrogate_id IS NOT NULL THEN
        SELECT name, email INTO v_subrogate FROM public.profiles WHERE id = v_recipient.subrogate_id;
        IF v_subrogate.email IS NOT NULL AND v_subrogate.email <> '' THEN
          v_recipients := v_recipients || jsonb_build_object('name', v_subrogate.name || ' (Subrogante de ' || v_recipient.name || ')', 'email', v_subrogate.email);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 3. Jefaturas associated with the institutions of the newly initiated indicators (and their active subrogates)
  IF 'jefatura' = ANY(v_config.notify_roles) THEN
    FOR v_recipient IN
      SELECT DISTINCT p.id, p.name, p.email, p.subrogate_id, p.is_subrogating
      FROM new_reports nr
      JOIN public.instrument_indicators ii ON ii.indicator_id = nr.indicator_id AND ii.is_active = true
      JOIN public.instruments inst ON inst.id = ii.instrument_id
      JOIN public.profiles p ON p.role = 'jefatura'
      LEFT JOIN public.user_institutions ui ON ui.user_id = p.id
      WHERE (p.institution_id = inst.institution_id OR ui.institution_id = inst.institution_id)
        AND p.email IS NOT NULL AND p.email <> ''
    LOOP
      v_recipients := v_recipients || jsonb_build_object('name', v_recipient.name, 'email', v_recipient.email);

      IF v_recipient.is_subrogating AND v_recipient.subrogate_id IS NOT NULL THEN
        SELECT name, email INTO v_subrogate FROM public.profiles WHERE id = v_recipient.subrogate_id;
        IF v_subrogate.email IS NOT NULL AND v_subrogate.email <> '' THEN
          v_recipients := v_recipients || jsonb_build_object('name', v_subrogate.name || ' (Subrogante de ' || v_recipient.name || ')', 'email', v_subrogate.email);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 4. Custom CC
  IF v_config.custom_cc IS NOT NULL AND cardinality(v_config.custom_cc) > 0 THEN
    FOR v_recipient IN SELECT unnest(v_config.custom_cc) AS email LOOP
      IF v_recipient.email IS NOT NULL AND v_recipient.email <> '' THEN
        v_recipients := v_recipients || jsonb_build_object('name', 'Copia CC', 'email', v_recipient.email);
      END IF;
    END LOOP;
  END IF;

  SELECT ind.name, inst.name INTO v_sample_indicator, v_sample_instrument
  FROM new_reports nr
  JOIN public.indicators ind ON ind.id = nr.indicator_id
  JOIN public.instrument_indicators ii ON ii.indicator_id = nr.indicator_id
  JOIN public.instruments inst ON inst.id = ii.instrument_id
  LIMIT 1;

  IF v_sample_indicator IS NULL THEN v_sample_indicator := 'Indicadores del periodo'; END IF;
  IF v_sample_instrument IS NULL THEN v_sample_instrument := 'Instrumentos asignados'; END IF;

  v_access_button := '<div style="text-align: center; margin: 25px 0;"><a href="http://NTBK-Msilva.cnr.gob.cl:8080" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; font-family: Segoe UI, sans-serif; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">🚀 Acceder al Sistema de Indicadores AGE</a></div>';

  -- Insert EXACTLY 1 email per distinct recipient
  FOR v_recipient IN SELECT DISTINCT ON (value->>'email') value->>'name' AS name, value->>'email' AS email FROM jsonb_array_elements(v_recipients) LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.email_queue
      WHERE recipient_email = v_recipient.email
        AND event_type = 'period_started'
        AND created_at > (NOW() - INTERVAL '5 minutes')
    ) INTO v_already_exists;

    IF NOT v_already_exists THEN
      v_subject := v_config.subject_template;
      v_body := v_config.body_template;

      v_subject := replace(v_subject, '{{recipient_name}}', v_recipient.name);
      v_subject := replace(v_subject, '{{period_name}}', v_period_name);
      v_subject := replace(v_subject, '{{indicator_name}}', v_sample_indicator);
      v_subject := replace(v_subject, '{{instrument_name}}', v_sample_instrument);

      v_body := replace(v_body, '{{recipient_name}}', v_recipient.name);
      v_body := replace(v_body, '{{period_name}}', v_period_name);
      v_body := replace(v_body, '{{indicator_name}}', v_sample_indicator);
      v_body := replace(v_body, '{{instrument_name}}', v_sample_instrument);
      v_body := replace(v_body, '{{boton_acceso}}', v_access_button);
      v_body := replace(v_body, '{{access_button}}', v_access_button);
      v_body := replace(v_body, '{{url_plataforma}}', 'http://NTBK-Msilva.cnr.gob.cl:8080');

      v_html_body := '
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>
          body { font-family: Segoe UI, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 24px; text-align: center; color: #ffffff; }
          .content { padding: 24px; }
          .text-content { line-height: 1.6; margin-bottom: 24px; white-space: pre-line; }
          .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
        </head>
        <body>
          <div class="card">
            <div class="header"><h2 style="margin:0;">Comisión Nacional de Riego</h2></div>
            <div class="content"><div class="text-content">' || v_body || '</div></div>
            <div class="footer">Sistema de Monitoreo de Indicadores AGE - CNR</div>
          </div>
        </body>
        </html>';

      INSERT INTO public.email_queue (event_type, recipient_email, subject, body_html, status)
      VALUES ('period_started', v_recipient.email, v_subject, v_html_body, 'pending');
    END IF;
  END LOOP;

  RETURN NULL;
END;
$function$;

UPDATE public.email_notification_settings 
SET body_template = 'Estimado/a {{recipient_name}},

Le informamos que ha iniciado el proceso de reportabilidad para el periodo {{period_name}}.

Por favor, ingrese al sistema para completar o revisar la información correspondiente a los indicadores de su centro de responsabilidad.

{{boton_acceso}}

Atentamente,
Sistema de Gestión de Indicadores AGE - CNR'
WHERE event_type = 'period_started';
