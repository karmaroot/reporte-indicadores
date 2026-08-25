-- Migración para Alertas y Notificaciones por Correo Electrónico

-- 1. Crear la tabla de configuración de alertas
CREATE TABLE IF NOT EXISTS public.email_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) UNIQUE NOT NULL, -- 'period_started', 'report_submitted', 'report_returned', 'report_approved'
  display_name VARCHAR(100) NOT NULL,    -- Nombre amigable para la interfaz
  description TEXT,                       -- Explicación del trigger
  is_enabled BOOLEAN DEFAULT true,        -- Activar/desactivar la alerta
  subject_template TEXT NOT NULL,         -- Plantilla del asunto del correo
  body_template TEXT NOT NULL,            -- Plantilla del cuerpo en HTML/Texto
  notify_roles VARCHAR(50)[] DEFAULT '{}', -- Roles predeterminados a notificar (informant, reviewer, jefatura)
  custom_cc TEXT[],                       -- Correos adicionales fijos en copia (ej. administradores)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en la tabla
ALTER TABLE public.email_notification_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$ BEGIN
  CREATE POLICY "Authenticated can read email notification settings" ON public.email_notification_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage email notification settings" ON public.email_notification_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Insertar configuraciones iniciales por defecto (evitando duplicados si ya existen)
INSERT INTO public.email_notification_settings (event_type, display_name, description, subject_template, body_template, notify_roles)
VALUES 
('period_started', 'Inicio Periodo de Reportabilidad Indicadores', 'Se envía a los informantes, revisores y jefaturas al dar inicio a un nuevo período de reportabilidad.', '[Nuevo Periodo] Inicio de reportabilidad para: {{period_name}}', 'Estimado/a {{recipient_name}},\n\nLe informamos que ha iniciado el periodo de reportabilidad para {{period_name}}.\n\nPor favor, recuerde ingresar o revisar los avances correspondientes.', ARRAY['informant', 'reviewer']),
('report_submitted', 'Reporte Enviado para Revisión', 'Se envía al revisor asignado cuando el informante sube un avance.', '[Revisión Pendiente] Nuevo reporte enviado: {{indicator_name}}', 'El informante {{informant_name}} ha reportado un avance para el indicador {{indicator_name}} del instrumento {{instrument_name}} durante el período {{period_name}}.', ARRAY['reviewer']),
('report_returned', 'Reporte Devuelto con Observaciones', 'Se envía al informante cuando el revisor solicita correcciones.', '[Observación / Devolución] Reporte devuelto: {{indicator_name}}', 'El revisor {{reviewer_name}} ha devuelto el reporte con observaciones para el indicador {{indicator_name}}.', ARRAY['informant']),
('report_approved', 'Reporte Revisado Sin Observaciones', 'Se envía al informante cuando el revisor valida el avance.', '[Aprobado] Reporte validado: {{indicator_name}}', 'Excelente. El avance para el indicador {{indicator_name}} ha sido aprobado.', ARRAY['informant']),
('report_responded', 'Informante responde observaciones', 'Se envía al revisor cuando el informante responde a las observaciones enviadas por el revisor.', '[Respuesta a Observaciones] El informante ha respondido: {{indicator_name}}', 'Estimado/a {{recipient_name}},\n\nEl informante {{informant_name}} ha respondido a las observaciones del indicador {{indicator_name}} para el período {{period_name}}.\n\nComentario del informante:\n"{{comments}}"\n\nPor favor ingrese al portal para revisar el avance.', ARRAY['reviewer']),
('report_reviewed_with_obs', 'Reporte revisado con observaciones', 'Se envía al informante y a su jefatura cuando el revisor concluye la etapa de revisión pos observaciones con un dictamen distinto a Avance Normal.', '[Dictamen de Revisión] Reporte evaluado: {{indicator_name}} - {{decision_reporte}}', 'Estimado/a {{recipient_name}},\n\nSe ha concluido la etapa de revisión para el indicador {{indicator_name}} correspondiente al período {{period_name}}.\n\nDecisión del reporte: {{decision_reporte}}\n\nComentario / Observación del revisor {{reviewer_name}}:\n"{{comments}}"\n\nPor favor ingrese al portal para consultar los detalles.', ARRAY['informant', 'jefatura'])
ON CONFLICT (event_type) DO NOTHING;

-- 3. Trigger para notificaciones al cambiar el estado del reporte
CREATE OR REPLACE FUNCTION public.handle_indicator_report_notification()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  calc_event_type text;
BEGIN
  IF NEW.status = 'responded' THEN
    calc_event_type := 'report_responded';
  ELSIF (NEW.status = 'approved' OR NEW.status = 'rejected') AND NEW.evaluation_status IS NOT NULL AND NEW.evaluation_status != 'avance_normal' THEN
    calc_event_type := 'report_reviewed_with_obs';
  ELSIF NEW.status = 'observed' THEN
    calc_event_type := 'report_returned';
  ELSE
    calc_event_type := 'report_' || NEW.status;
  END IF;

  payload := jsonb_build_object(
    'event_type', calc_event_type,
    'report_id', NEW.id,
    'status', NEW.status,
    'evaluation_status', NEW.evaluation_status,
    'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END
  );

  PERFORM net.http_post(
    url := 'https://ewwzmcsxfugqfujvbyxo.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_indicator_report_notification ON public.indicator_reports;
CREATE TRIGGER trigger_indicator_report_notification
  AFTER INSERT OR UPDATE ON public.indicator_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_indicator_report_notification();
