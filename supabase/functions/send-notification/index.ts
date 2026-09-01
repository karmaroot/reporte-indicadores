// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import nodemailer from "npm:nodemailer@^6.9.13";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper function to dispatch emails via Direct SMTP (Option A) or Resend fallback
async function dispatchEmail(
  toEmail: string,
  subject: string,
  htmlBody: string,
  smtpSettings: any,
  resendApiKey: string,
  ccList?: string[]
) {
  const senderName = smtpSettings?.sender_name || "Comisión Nacional de Riego - Monitoreo AGE";
  const senderEmail = smtpSettings?.sender_email || "comision.nacional.riego@cnr.gob.cl";
  const provider = smtpSettings?.provider || "smtp";

  // Option A: Direct SMTP connection to institutional server
  if (provider === "smtp" && smtpSettings?.smtp_host) {
    const isSecurePort = smtpSettings.smtp_secure === "ssl" || smtpSettings.smtp_port === 465;

    const transporter = nodemailer.createTransport({
      host: smtpSettings.smtp_host,
      port: Number(smtpSettings.smtp_port) || 587,
      secure: isSecurePort,
      auth: smtpSettings.smtp_user ? {
        user: smtpSettings.smtp_user,
        pass: smtpSettings.smtp_password || ""
      } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions: Record<string, any> = {
      from: `"${senderName}" <${senderEmail}>`,
      to: toEmail,
      subject: subject,
      html: htmlBody
    };

    if (ccList && ccList.length > 0) {
      mailOptions.cc = ccList;
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, mode: "smtp", info };
  } 

  // Option B/Fallback: Resend API Sandbox
  const emailPayload: Record<string, any> = {
    from: "Monitoreo AGE <onboarding@resend.dev>",
    to: [toEmail],
    subject: subject,
    html: htmlBody
  };

  if (ccList && ccList.length > 0) {
    emailPayload.cc = ccList;
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendApiKey}`
    },
    body: JSON.stringify(emailPayload)
  });

  const resendData = await resendRes.json();
  if (!resendRes.ok) {
    throw new Error(resendData.message || JSON.stringify(resendData));
  }
  return { success: true, mode: "resend", info: resendData };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify authorization using the secure webhook token
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== "Bearer secret_email_alert_webhook_token_2026") {
      console.warn("Unauthorized request attempt to send-notification");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const bodyJson = await req.json();
    const { report_id, period_id, status, event_type, old_status, is_test, action, target_email, institution_id, institution_name, indicator_ids } = bodyJson;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing environment variables");
      throw new Error("Server configuration error");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the SMTP settings configuration from database
    const { data: smtpSettings } = await adminClient
      .from("email_smtp_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const senderName = smtpSettings?.sender_name || "Comisión Nacional de Riego - Monitoreo AGE";
    const senderEmail = smtpSettings?.sender_email || "comision.nacional.riego@cnr.gob.cl";

    // Fetch the Resend API Key from database secrets table
    const { data: secretData } = await adminClient
      .from("email_notification_secrets")
      .select("key_value")
      .eq("key_name", "RESEND_API_KEY")
      .maybeSingle();

    const resendApiKey = secretData?.key_value || "";

    // Common premium email wrapper
    const wrapEmailHtml = (emailBody: string, isTestBanner: boolean = false) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 24px; text-align: center; color: #ffffff; }
          .test-badge { background: #f59e0b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; display: inline-block; margin-bottom: 8px; }
          .content { padding: 24px; }
          .text-content { line-height: 1.6; margin-bottom: 24px; white-space: pre-line; }
          .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 6px; font-size: 14px; }
          .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            ${isTestBanner ? '<div class="test-badge">Prueba de Envío Directo (Opción A)</div>' : ''}
            <h2 style="margin:0;">${senderName}</h2>
          </div>
          <div class="content">
            <div class="text-content">${emailBody}</div>
            <div style="text-align: center;">
              <a href="https://gauge-wise-flows.pages.dev" class="btn">Ir al Portal</a>
            </div>
          </div>
          <div class="footer">
            Enviado desde: ${senderEmail}
          </div>
        </div>
      </body>
      </html>
    `;

    // 2. Handle TEST EMAIL Mode
    if (is_test || action === "test_email") {
      const recipientEmail = target_email || bodyJson.to || "dafne.loyola@cnr.gob.cl";
      const testEventType = event_type || "period_started";

      const { data: testConfig } = await adminClient
        .from("email_notification_settings")
        .select("*")
        .eq("event_type", testEventType)
        .maybeSingle();

      let subject = testConfig?.subject_template || "[Nuevo Periodo] Inicio de reportabilidad para: {{period_name}}";
      let body = testConfig?.body_template || "Estimado/a {{recipient_name}},\n\nLe informamos que ha iniciado el periodo de reportabilidad para {{period_name}}.\n\nPor favor, recuerde ingresar o revisar los avances correspondientes.\n\nAtentamente,\n{{sender_name}}";

      const placeholders: Record<string, string> = {
        "{{recipient_name}}": bodyJson.recipient_name || "Usuario de Prueba",
        "{{indicator_name}}": "Indicador de Prueba (Eficiencia hídrica)",
        "{{instrument_name}}": "Programa de Riego 2026",
        "{{period_name}}": bodyJson.period_name || "Primer Semestre 2026",
        "{{reported_value}}": "85%",
        "{{comments}}": "Este es un correo de prueba de conectividad y formato de alerta enviado desde el Portal de Indicadores AGE.",
        "{{reviewer_name}}": "Revisor de Prueba",
        "{{informant_name}}": "Informante de Prueba",
        "{{decision_reporte}}": bodyJson.decision_reporte || "Bajo lo Programado",
        "{{sender_name}}": senderName
      };

      for (const [key, value] of Object.entries(placeholders)) {
        subject = subject.replaceAll(key, value);
        body = body.replaceAll(key, value);
      }

      subject = `[PRUEBA SISTEMA] ${subject}`;

      try {
        const dispatchResult = await dispatchEmail(
          recipientEmail,
          subject,
          wrapEmailHtml(body, true),
          smtpSettings,
          resendApiKey
        );

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Correo de prueba enviado correctamente vía ${dispatchResult.mode.toUpperCase()} a ${recipientEmail}`,
          details: dispatchResult.info 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (dispatchErr: any) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: dispatchErr.message || "Error al conectar con el servidor SMTP",
          details: dispatchErr 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Prevent redundant triggers if status did not change
    if (event_type !== "period_started" && old_status && old_status === status) {
      return new Response(JSON.stringify({ message: "No status change" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Fetch the dynamic email configuration set by the administrator
    const { data: config, error: configError } = await adminClient
      .from("email_notification_settings")
      .select("*")
      .eq("event_type", event_type)
      .single();

    if (configError || !config) {
      console.warn(`No active notification config found for event type: ${event_type}`);
      return new Response(JSON.stringify({ message: `No active config for ${event_type}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!config.is_enabled) {
      console.info(`Notification ${event_type} is disabled by the administrator`);
      return new Response(JSON.stringify({ message: `Notification ${event_type} is disabled` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Handle Period Started Event / Indicator Activation Event
    if (event_type === "period_started") {
      let periodName = "Período Asignado";
      if (period_id && period_id !== "00000000-0000-0000-0000-000000000000") {
        const { data: period } = await adminClient
          .from("periods")
          .select("name")
          .eq("id", period_id)
          .single();
        if (period?.name) periodName = period.name;
      }

      let assignQuery = adminClient
        .from("instrument_indicators")
        .select(`
          indicator_id,
          informant:profiles!instrument_indicators_informant_id_fkey (name, email, institution_id),
          reviewer:profiles!instrument_indicators_reviewer_id_fkey (name, email, institution_id),
          instrument:instruments (id, name, institution_id, institutions (id, name))
        `)
        .eq("is_active", true);

      if (indicator_ids && Array.isArray(indicator_ids) && indicator_ids.length > 0) {
        assignQuery = assignQuery.in("indicator_id", indicator_ids);
      }

      const { data: assignments, error: assignError } = await assignQuery;

      if (assignError) {
        throw new Error(`Failed to fetch active assignments: ${assignError.message}`);
      }

      let filteredAssignments = assignments || [];
      if (institution_id && institution_id !== 'all') {
        filteredAssignments = filteredAssignments.filter((a: any) =>
          a.instrument?.institution_id === institution_id ||
          a.informant?.institution_id === institution_id ||
          a.reviewer?.institution_id === institution_id
        );
      } else if (institution_name && institution_name !== 'all') {
        filteredAssignments = filteredAssignments.filter((a: any) =>
          a.instrument?.institutions?.name?.toLowerCase().includes(institution_name.toLowerCase())
        );
      }

      const uniqueRecipients = new Map<string, { name: string; role: string }>();
      const activeInstIds = new Set<string>();

      for (const row of filteredAssignments) {
        const rowTyped = row as any;
        if (config.notify_roles.includes("informant") && rowTyped.informant?.email) {
          uniqueRecipients.set(rowTyped.informant.email, {
            name: rowTyped.informant.name,
            role: "informant"
          });
        }
        if (config.notify_roles.includes("reviewer") && rowTyped.reviewer?.email) {
          uniqueRecipients.set(rowTyped.reviewer.email, {
            name: rowTyped.reviewer.name,
            role: "reviewer"
          });
        }
        const instId = rowTyped.instrument?.institution_id || rowTyped.informant?.institution_id;
        if (instId) {
          activeInstIds.add(instId);
        }
      }

      if (config.notify_roles.includes("jefatura") && activeInstIds.size > 0) {
        const targetInstArr = Array.from(activeInstIds);

        const { data: userInsts } = await adminClient
          .from("user_institutions")
          .select("user_id")
          .in("institution_id", targetInstArr);

        const userIds = (userInsts || []).map((ui: any) => ui.user_id);

        let jefQuery = adminClient
          .from("profiles")
          .select("name, email")
          .eq("role", "jefatura");

        if (userIds.length > 0) {
          jefQuery = jefQuery.or(`id.in.(${userIds.join(",")}),institution_id.in.(${targetInstArr.join(",")})`);
        } else {
          jefQuery = jefQuery.in("institution_id", targetInstArr);
        }

        const { data: jefaturas, error: profError } = await jefQuery;

        if (!profError && jefaturas) {
          for (const jef of jefaturas) {
            if (jef.email) {
              uniqueRecipients.set(jef.email, {
                name: jef.name,
                role: "jefatura"
              });
            }
          }
        }
      }

      if (uniqueRecipients.size === 0) {
        console.info("No active recipients found to receive the period started notification");
        return new Response(JSON.stringify({ message: "No active recipients" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const placeholders: Record<string, string> = {
        "{{recipient_name}}": "",
        "{{indicator_name}}": "Todos los indicadores asignados",
        "{{instrument_name}}": "Todos los instrumentos asignados",
        "{{period_name}}": periodName,
        "{{reported_value}}": "N/A",
        "{{comments}}": "N/A",
        "{{reviewer_name}}": "N/A",
        "{{informant_name}}": "N/A"
      };

      const emailPromises = [];

      for (const [email, user] of uniqueRecipients.entries()) {
        const pDict = {
          ...placeholders,
          "{{recipient_name}}": user.name
        };

        let subject = config.subject_template;
        let body = config.body_template;

        for (const [key, value] of Object.entries(pDict)) {
          subject = subject.replaceAll(key, value);
          body = body.replaceAll(key, value);
        }

        const htmlBody = wrapEmailHtml(body);

        // Enqueue to email_queue for institutional Bridge Worker (NTBK-Msilva)
        await adminClient.from("email_queue").insert({
          event_type: event_type,
          recipient_email: email,
          subject: subject,
          body_html: htmlBody,
          status: "pending"
        });

        emailPromises.push(
          dispatchEmail(
            email,
            subject,
            htmlBody,
            smtpSettings,
            resendApiKey,
            config.custom_cc
          )
        );
      }

      const results = await Promise.all(emailPromises);
      return new Response(JSON.stringify({ message: `Emails queued and sent to ${results.length} recipients`, details: results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!report_id) {
      throw new Error("Missing report_id for report notification event");
    }

    const { data: report, error: reportError } = await adminClient
      .from("indicator_reports")
      .select(`
        id,
        reported_value,
        numerator,
        denominator,
        comment,
        status,
        evaluation_status,
        indicator_id,
        indicators (
          name,
          unit
        ),
        periods (
          name
        ),
        profiles!indicator_reports_created_by_fkey (
          name,
          email
        )
      `)
      .eq("id", report_id)
      .single();

    if (reportError || !report) {
      throw new Error(`Report not found: ${reportError?.message}`);
    }

    const { data: instInd, error: instError } = await adminClient
      .from("instrument_indicators")
      .select(`
        informant:profiles!instrument_indicators_informant_id_fkey (id, name, email, institution_id),
        reviewer:profiles!instrument_indicators_reviewer_id_fkey (id, name, email, institution_id),
        instrument:instruments (name, institution_id)
      `)
      .eq("indicator_id", (report as any).indicator_id)
      .single();

    if (instError || !instInd) {
      throw new Error(`Assignment details not found: ${instError?.message}`);
    }

    const informant = (instInd as any).informant;
    const reviewer = (instInd as any).reviewer;
    const instrumentName = (instInd as any).instrument?.name || "Instrumento";
    const targetInstId = (instInd as any).instrument?.institution_id || (report as any).institution_id || informant?.institution_id;

    let jefaturaEmails: { name: string; email: string }[] = [];
    if (config.notify_roles.includes("jefatura") && targetInstId) {
      const { data: userInsts } = await adminClient
        .from("user_institutions")
        .select("user_id")
        .eq("institution_id", targetInstId);

      const userIds = (userInsts || []).map((ui: any) => ui.user_id);

      let jefQuery = adminClient
        .from("profiles")
        .select("name, email")
        .eq("role", "jefatura");

      if (userIds.length > 0) {
        jefQuery = jefQuery.or(`id.in.(${userIds.join(",")}),institution_id.eq.${targetInstId}`);
      } else {
        jefQuery = jefQuery.eq("institution_id", targetInstId);
      }

      const { data: jefaturas, error: profError } = await jefQuery;

      if (!profError && jefaturas) {
        jefaturaEmails = jefaturas.filter((j: any) => j.email) as { name: string; email: string }[];
      }
    }

    const uniqueRecipients = new Map<string, { name: string; role: string }>();

    if (config.notify_roles.includes("informant") && informant?.email) {
      uniqueRecipients.set(informant.email, {
        name: informant.name,
        role: "informant"
      });
    }
    if (config.notify_roles.includes("reviewer") && reviewer?.email) {
      uniqueRecipients.set(reviewer.email, {
        name: reviewer.name,
        role: "reviewer"
      });
    }
    if (config.notify_roles.includes("jefatura") && jefaturaEmails.length > 0) {
      for (const jef of jefaturaEmails) {
        uniqueRecipients.set(jef.email, {
          name: jef.name,
          role: "jefatura"
        });
      }
    }

    if (uniqueRecipients.size === 0) {
      console.info("No recipients are configured or found to receive this notification");
      return new Response(JSON.stringify({ message: "No active recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const EVALUATION_LABELS: Record<string, string> = {
      avance_normal: "Avance Normal",
      bajo_programado: "Bajo lo Programado",
      en_riesgo: "En riesgo de cumplimiento",
      inconsistente: "Inconsistente",
      incompleto: "Incompleto",
      sin_reporte: "Sin reporte"
    };

    const evalStatus = (report as any).evaluation_status;
    const decisionReporteLabel = evalStatus ? (EVALUATION_LABELS[evalStatus] || evalStatus) : "N/A";

    const placeholders: Record<string, string> = {
      "{{recipient_name}}": "",
      "{{indicator_name}}": (report as any).indicators.name,
      "{{instrument_name}}": instrumentName,
      "{{period_name}}": (report as any).periods.name,
      "{{reported_value}}": `${report.reported_value} ${(report as any).indicators.unit || ""}`,
      "{{comments}}": report.comment || "Sin comentarios adicionales",
      "{{reviewer_name}}": reviewer?.name || "Revisor Asignado",
      "{{informant_name}}": informant?.name || "Informante Asignado",
      "{{decision_reporte}}": decisionReporteLabel
    };

    const emailPromises = [];

    for (const [email, user] of uniqueRecipients.entries()) {
      const pDict = {
        ...placeholders,
        "{{recipient_name}}": user.name
      };

      let subject = config.subject_template;
      let body = config.body_template;

      for (const [key, value] of Object.entries(pDict)) {
        subject = subject.replaceAll(key, value);
        body = body.replaceAll(key, value);
      }

      emailPromises.push(
        dispatchEmail(
          email,
          subject,
          wrapEmailHtml(body),
          smtpSettings,
          resendApiKey,
          config.custom_cc
        )
      );
    }

    const results = await Promise.all(emailPromises);
    return new Response(JSON.stringify({ message: `Emails sent to ${results.length} recipients`, details: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Error in send-notification edge function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
