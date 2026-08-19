import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const SUPABASE_URL = 'https://ewwzmcsxfugqfujvbyxo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3d3ptY3N4ZnVncWZ1anZieXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzk4MzgsImV4cCI6MjA4OTM1NTgzOH0.zB8QLe2j6M7__6i0ArS-NvVct4p3vIGFQKMg4YX7kNw';

console.log('================================================================');
console.log('  SERVICIO PUENTE DE CORREOS INSTITUCIONALES CNR (INDICADORES AGE)');
console.log('  Equipo: NTBK-Msilva.cnr.gob.cl');
console.log('================================================================\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let isProcessing = false;

// 1. Fetch active SMTP Configuration
async function getSmtpTransporter() {
  const { data: smtp, error } = await supabase
    .from('email_smtp_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !smtp) {
    console.error('[WORKER ERROR] No se pudo cargar la configuración SMTP:', error?.message);
    return null;
  }

  const isSecure = smtp.smtp_secure === 'ssl' || Number(smtp.smtp_port) === 465;

  const transporter = nodemailer.createTransport({
    host: smtp.smtp_host || 'smtp.gmail.com',
    port: Number(smtp.smtp_port) || 587,
    secure: isSecure,
    auth: {
      user: smtp.smtp_user || 'comision.nacional.riego@cnr.gob.cl',
      pass: smtp.smtp_password || 'qzynjloyorpmsacq'
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  return {
    transporter,
    senderName: smtp.sender_name || 'Comisión Nacional de Riego - Monitoreo AGE',
    senderEmail: smtp.sender_email || 'comision.nacional.riego@cnr.gob.cl'
  };
}

// 2. Process Pending Email Queue
async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const { data: pendingItems, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('[WORKER ERROR] Error al consultar la cola email_queue:', error.message);
      isProcessing = false;
      return;
    }

    if (!pendingItems || pendingItems.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`\n[WORKER] Procesando ${pendingItems.length} correo(s) pendiente(s)...`);

    const smtpConfig = await getSmtpTransporter();
    if (!smtpConfig) {
      isProcessing = false;
      return;
    }

    for (const item of pendingItems) {
      console.log(` -> Enviando correo ID ${item.id} a ${item.recipient_email} (${item.event_type})...`);

      // Mark as processing
      await supabase
        .from('email_queue')
        .update({ status: 'processing', attempts: item.attempts + 1 })
        .eq('id', item.id);

      try {
        const mailOptions = {
          from: `"${smtpConfig.senderName}" <${smtpConfig.senderEmail}>`,
          to: item.recipient_email,
          subject: item.subject,
          html: item.body_html
        };

        const info = await smtpConfig.transporter.sendMail(mailOptions);

        console.log(`    ✅ ÉXITO: Correo enviado a ${item.recipient_email}. Response: ${info.response}`);

        // Update queue to sent
        await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', item.id);

      } catch (sendErr) {
        console.error(`    ❌ ERROR al enviar a ${item.recipient_email}:`, sendErr.message);

        const newStatus = item.attempts >= 3 ? 'failed' : 'pending';

        await supabase
          .from('email_queue')
          .update({
            status: newStatus,
            error_message: sendErr.message
          })
          .eq('id', item.id);
      }
    }

  } catch (err) {
    console.error('[WORKER CRITICAL ERROR]:', err.message);
  } finally {
    isProcessing = false;
  }
}

// 3. Start Polling & Realtime Subscription
console.log('[WORKER] Servicio Puente Iniciado. Escuchando cola de correos...');
console.log('[WORKER] Equipo autorizado: NTBK-Msilva.cnr.gob.cl');
console.log('[WORKER] Intervalo de verificación: cada 5 segundos.\n');

// Poll every 5 seconds
setInterval(processQueue, 5000);

// Initial check
processQueue();

// Realtime subscription
supabase
  .channel('email_queue_channel')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_queue' }, (payload) => {
    console.log('[REALTIME] Nuevo correo detectado en cola:', payload.new.recipient_email);
    processQueue();
  })
  .subscribe();
