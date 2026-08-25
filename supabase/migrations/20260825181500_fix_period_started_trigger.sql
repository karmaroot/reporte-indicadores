-- Fix operator type mismatch in handle_period_started_trigger
-- notify_roles is VARCHAR[] / TEXT[], so check with 'role' = ANY(notify_roles)
-- custom_cc is TEXT[], so check cardinality and use unnest()

CREATE OR REPLACE FUNCTION public.handle_period_started_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_config RECORD;
  v_assignment RECORD;
  v_recipients JSONB := '[]'::jsonb;
  v_recipient RECORD;
  v_subject TEXT;
  v_body TEXT;
  v_html_body TEXT;
BEGIN
  IF NEW.status = 'open' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status <> 'open') THEN

    SELECT * INTO v_config
    FROM public.email_notification_settings
    WHERE event_type = 'period_started' AND is_enabled = true;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Collect all active informants and reviewers
    FOR v_assignment IN 
      SELECT 
        p_inf.name AS informant_name, p_inf.email AS informant_email,
        p_rev.name AS reviewer_name, p_rev.email AS reviewer_email
      FROM public.instrument_indicators ii
      LEFT JOIN public.profiles p_inf ON p_inf.id = ii.informant_id
      LEFT JOIN public.profiles p_rev ON p_rev.id = ii.reviewer_id
      WHERE ii.is_active = true
    LOOP
      IF 'informant' = ANY(v_config.notify_roles) AND v_assignment.informant_email IS NOT NULL AND v_assignment.informant_email <> '' THEN
        v_recipients := v_recipients || jsonb_build_object('name', v_assignment.informant_name, 'email', v_assignment.informant_email);
      END IF;

      IF 'reviewer' = ANY(v_config.notify_roles) AND v_assignment.reviewer_email IS NOT NULL AND v_assignment.reviewer_email <> '' THEN
        v_recipients := v_recipients || jsonb_build_object('name', v_assignment.reviewer_name, 'email', v_assignment.reviewer_email);
      END IF;
    END LOOP;

    -- Custom CC
    IF v_config.custom_cc IS NOT NULL AND cardinality(v_config.custom_cc) > 0 THEN
      FOR v_recipient IN SELECT unnest(v_config.custom_cc) AS email LOOP
        IF v_recipient.email IS NOT NULL AND v_recipient.email <> '' THEN
          v_recipients := v_recipients || jsonb_build_object('name', 'Copia CC', 'email', v_recipient.email);
        END IF;
      END LOOP;
    END IF;

    -- Insert queued emails
    FOR v_recipient IN SELECT DISTINCT ON (value->>'email') value->>'name' AS name, value->>'email' AS email FROM jsonb_array_elements(v_recipients) LOOP
      v_subject := v_config.subject_template;
      v_body := v_config.body_template;

      v_subject := replace(v_subject, '{{recipient_name}}', v_recipient.name);
      v_subject := replace(v_subject, '{{period_name}}', NEW.name);

      v_body := replace(v_body, '{{recipient_name}}', v_recipient.name);
      v_body := replace(v_body, '{{period_name}}', NEW.name);
      v_body := replace(v_body, '{{indicator_name}}', 'Todos los indicadores asignados');
      v_body := replace(v_body, '{{instrument_name}}', 'Todos los instrumentos asignados');

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
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
