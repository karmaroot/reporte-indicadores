-- Migración para la configuración del Servidor SMTP y Remitente de Correo

CREATE TABLE IF NOT EXISTS public.email_smtp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(20) NOT NULL DEFAULT 'smtp', -- 'smtp' o 'resend'
  sender_name VARCHAR(150) NOT NULL DEFAULT 'Comisión Nacional de Riego - Monitoreo AGE',
  sender_email VARCHAR(150) NOT NULL DEFAULT 'comision.nacional.riego@cnr.gob.cl',
  smtp_host VARCHAR(200) NOT NULL DEFAULT 'smtp.office365.com',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user VARCHAR(150) NOT NULL DEFAULT 'comision.nacional.riego@cnr.gob.cl',
  smtp_password TEXT DEFAULT '',
  smtp_secure VARCHAR(10) NOT NULL DEFAULT 'tls', -- 'tls', 'ssl', 'none'
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en la tabla
ALTER TABLE public.email_smtp_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$ BEGIN
  CREATE POLICY "Authenticated users can read email smtp settings" 
    ON public.email_smtp_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage email smtp settings" 
    ON public.email_smtp_settings FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'admin')) 
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insertar configuración predeterminada si no existe ninguna
INSERT INTO public.email_smtp_settings (
  provider,
  sender_name,
  sender_email,
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_password,
  smtp_secure
)
SELECT 
  'smtp',
  'Comisión Nacional de Riego - Monitoreo AGE',
  'comision.nacional.riego@cnr.gob.cl',
  'smtp.office365.com',
  587,
  'comision.nacional.riego@cnr.gob.cl',
  '',
  'tls'
WHERE NOT EXISTS (SELECT 1 FROM public.email_smtp_settings);
