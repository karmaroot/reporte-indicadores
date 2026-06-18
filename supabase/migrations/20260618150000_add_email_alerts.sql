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
('report_approved', 'Reporte Aprobado / Cumplido', 'Se envía al informante cuando el revisor valida el avance.', '[Aprobado] Reporte validado: {{indicator_name}}', 'Excelente. El avance para el indicador {{indicator_name}} ha sido aprobado.', ARRAY['informant'])
ON CONFLICT (event_type) DO NOTHING;

-- 3. Trigger para notificaciones al cambiar el estado del reporte
CREATE OR REPLACE FUNCTION public.handle_indicator_report_notification()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'event_type', 'report_' || NEW.status, -- 'report_submitted', 'report_returned', 'report_approved'
    'report_id', NEW.id,
    'status', NEW.status,
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
