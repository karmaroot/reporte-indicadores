-- Trigger to automatically populate email_queue when an indicator report is initiated/created
CREATE OR REPLACE FUNCTION public.handle_indicator_report_created_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_config RECORD;
  v_assignment RECORD;
  v_jefatura RECORD;
  v_recipients JSONB := '[]'::jsonb;
  v_recipient RECORD;
  v_subject TEXT;
  v_body TEXT;
  v_html_body TEXT;
  v_period_name TEXT;
BEGIN
  SELECT * INTO v_config
  FROM public.email_notification_settings
  WHERE event_type = 'period_started' AND is_enabled = true;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_period_name FROM public.periods WHERE id = NEW.period_id;
  IF v_period_name IS NULL THEN
    v_period_name := 'Periodo de Reportabilidad';
  END IF;

  SELECT 
    ii.id,
    inst.institution_id AS target_institution_id,
    ind.name AS indicator_name,
    inst.name AS instrument_name,
    p_inf.name AS informant_name, p_inf.email AS informant_email,
    p_rev.name AS reviewer_name, p_rev.email AS reviewer_email
  INTO v_assignment
  FROM public.instrument_indicators ii
  JOIN public.indicators ind ON ind.id = ii.indicator_id
  JOIN public.instruments inst ON inst.id = ii.instrument_id
  LEFT JOIN public.profiles p_inf ON p_inf.id = ii.informant_id
  LEFT JOIN public.profiles p_rev ON p_rev.id = ii.reviewer_id
  WHERE ii.indicator_id = NEW.indicator_id AND ii.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF 'informant' = ANY(v_config.notify_roles) AND v_assignment.informant_email IS NOT NULL AND v_assignment.informant_email <> '' THEN
    v_recipients := v_recipients || jsonb_build_object('name', v_assignment.informant_name, 'email', v_assignment.informant_email);
  END IF;

  IF 'reviewer' = ANY(v_config.notify_roles) AND v_assignment.reviewer_email IS NOT NULL AND v_assignment.reviewer_email <> '' THEN
    v_recipients := v_recipients || jsonb_build_object('name', v_assignment.reviewer_name, 'email', v_assignment.reviewer_email);
  END IF;

  IF 'jefatura' = ANY(v_config.notify_roles) AND v_assignment.target_institution_id IS NOT NULL THEN
    FOR v_jefatura IN
      SELECT DISTINCT p.name, p.email
      FROM public.profiles p
      LEFT JOIN public.user_institutions ui ON ui.user_id = p.id
      WHERE p.role = 'jefatura'
        AND (p.institution_id = v_assignment.target_institution_id OR ui.institution_id = v_assignment.target_institution_id)
        AND p.email IS NOT NULL AND p.email <> ''
    LOOP
      v_recipients := v_recipients || jsonb_build_object('name', v_jefatura.name, 'email', v_jefatura.email);
    END LOOP;
  END IF;

  IF v_config.custom_cc IS NOT NULL AND cardinality(v_config.custom_cc) > 0 THEN
    FOR v_recipient IN SELECT unnest(v_config.custom_cc) AS email LOOP
      IF v_recipient.email IS NOT NULL AND v_recipient.email <> '' THEN
        v_recipients := v_recipients || jsonb_build_object('name', 'Copia CC', 'email', v_recipient.email);
      END IF;
    END LOOP;
  END IF;

  FOR v_recipient IN SELECT DISTINCT ON (value->>'email') value->>'name' AS name, value->>'email' AS email FROM jsonb_array_elements(v_recipients) LOOP
    v_subject := v_config.subject_template;
    v_body := v_config.body_template;

    v_subject := replace(v_subject, '{{recipient_name}}', v_recipient.name);
    v_subject := replace(v_subject, '{{period_name}}', v_period_name);
    v_subject := replace(v_subject, '{{indicator_name}}', v_assignment.indicator_name);
    v_subject := replace(v_subject, '{{instrument_name}}', v_assignment.instrument_name);

    v_body := replace(v_body, '{{recipient_name}}', v_recipient.name);
    v_body := replace(v_body, '{{period_name}}', v_period_name);
    v_body := replace(v_body, '{{indicator_name}}', v_assignment.indicator_name);
    v_body := replace(v_body, '{{instrument_name}}', v_assignment.instrument_name);

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

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_indicator_report_created_queue ON public.indicator_reports;
CREATE TRIGGER trigger_indicator_report_created_queue
  AFTER INSERT ON public.indicator_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_indicator_report_created_queue();
