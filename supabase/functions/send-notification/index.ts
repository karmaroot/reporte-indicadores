import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { report_id, period_id, status, event_type, old_status } = bodyJson;

    // Prevent redundant triggers if status did not change
    if (event_type !== "period_started" && old_status && old_status === status) {
      return new Response(JSON.stringify({ message: "No status change" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing environment variables");
      throw new Error("Server configuration error");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the Resend API Key from the database secrets table
    const { data: secretData, error: secretError } = await adminClient
      .from("email_notification_secrets")
      .select("key_value")
      .eq("key_name", "RESEND_API_KEY")
      .single();

    if (secretError || !secretData) {
      throw new Error(`Resend API Key not found in database: ${secretError?.message}`);
    }
    const resendApiKey = secretData.key_value;

    // 2. Fetch the dynamic email configuration set by the administrator
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

    // Common premium email wrapper
    const wrapEmailHtml = (emailBody: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 24px; text-align: center; color: #ffffff; }
          .content { padding: 24px; }
          .text-content { line-height: 1.6; margin-bottom: 24px; white-space: pre-line; }
          .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 6px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header"><h2>Plataforma de Indicadores AGE</h2></div>
          <div class="content">
            <div class="text-content">${emailBody}</div>
            <div style="text-align: center;">
              <a href="https://gauge-wise-flows.pages.dev" class="btn">Ir al Portal</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // 3. Handle Period Started Event
    if (event_type === "period_started") {
      if (!period_id) {
        throw new Error("Missing period_id for period_started event");
      }

      // Fetch the period name
      const { data: period, error: periodError } = await adminClient
        .from("periods")
        .select("name")
        .eq("id", period_id)
        .single();

      if (periodError || !period) {
        throw new Error(`Period not found: ${periodError?.message}`);
      }

      // Fetch active assignments
      const { data: assignments, error: assignError } = await adminClient
        .from("instrument_indicators")
        .select(`
          informant:profiles!instrument_indicators_informant_id_fkey (name, email, institution_id),
          reviewer:profiles!instrument_indicators_reviewer_id_fkey (name, email, institution_id)
        `)
        .eq("is_active", true);

      if (assignError) {
        throw new Error(`Failed to fetch active assignments: ${assignError.message}`);
      }

      // Filter and de-duplicate emails
      const uniqueRecipients = new Map<string, { name: string; role: string }>();
      const activeInformantInstIds = new Set<string>();

      for (const row of assignments || []) {
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
        // Save the informant's institution_id if we need to notify jefatura
        if (config.notify_roles.includes("jefatura") && rowTyped.informant?.institution_id) {
          activeInformantInstIds.add(rowTyped.informant.institution_id);
        }
      }

      // If jefatura is requested, fetch jefaturas for the relevant institution_ids
      if (config.notify_roles.includes("jefatura") && activeInformantInstIds.size > 0) {
        const { data: userInsts, error: jefError } = await adminClient
          .from("user_institutions")
          .select("user_id")
          .in("institution_id", Array.from(activeInformantInstIds));

        if (!jefError && userInsts && userInsts.length > 0) {
          const userIds = userInsts.map(ui => ui.user_id);
          const { data: jefaturas, error: profError } = await adminClient
            .from("profiles")
            .select("name", "email")
            .eq("role", "jefatura")
            .in("id", userIds);

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
      }

      if (uniqueRecipients.size === 0) {
        console.info("No active recipients found to receive the period started notification");
        return new Response(JSON.stringify({ message: "No active recipients" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const placeholders: Record<string, string> = {
        "{{recipient_name}}": "", // Replaced per user
        "{{indicator_name}}": "Todos los indicadores asignados",
        "{{instrument_name}}": "Todos los instrumentos asignados",
        "{{period_name}}": period.name,
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

        const emailPayload: Record<string, any> = {
          from: "Monitoreo AGE <onboarding@resend.dev>",
          to: [email],
          subject: subject,
          html: wrapEmailHtml(body)
        };

        if (config.custom_cc && config.custom_cc.length > 0) {
          emailPayload.cc = config.custom_cc;
        }

        emailPromises.push(
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify(emailPayload)
          }).then(async res => {
            const data = await res.json();
            if (!res.ok) {
              throw new Error(`Resend error for ${email}: ${JSON.stringify(data)}`);
            }
            return { email, data };
          })
        );
      }

      const results = await Promise.all(emailPromises);
      return new Response(JSON.stringify({ message: `Emails sent to ${results.length} recipients`, details: results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Handle Report Events (submitted, returned, approved)
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
        instrument:instruments (name)
      `)
      .eq("indicator_id", (report as any).indicator_id)
      .single();

    if (instError || !instInd) {
      throw new Error(`Assignment details not found: ${instError?.message}`);
    }

    const informant = (instInd as any).informant;
    const reviewer = (instInd as any).reviewer;
    const instrumentName = (instInd as any).instrument.name;

    // Fetch Jefaturas for the informant's responsibility center
    let jefaturaEmails: { name: string; email: string }[] = [];
    if (config.notify_roles.includes("jefatura") && informant?.institution_id) {
      const { data: userInsts, error: jefError } = await adminClient
        .from("user_institutions")
        .select("user_id")
        .eq("institution_id", informant.institution_id);

      if (!jefError && userInsts && userInsts.length > 0) {
        const userIds = userInsts.map(ui => ui.user_id);
        const { data: jefaturas, error: profError } = await adminClient
          .from("profiles")
          .select("name", "email")
          .eq("role", "jefatura")
          .in("id", userIds);

        if (!profError && jefaturas) {
          jefaturaEmails = jefaturas.filter(j => j.email) as { name: string; email: string }[];
        }
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

    const placeholders: Record<string, string> = {
      "{{recipient_name}}": "", // Replaced per user
      "{{indicator_name}}": (report as any).indicators.name,
      "{{instrument_name}}": instrumentName,
      "{{period_name}}": (report as any).periods.name,
      "{{reported_value}}": `${report.reported_value} ${(report as any).indicators.unit || ""}`,
      "{{comments}}": report.comment || "Sin comentarios adicionales",
      "{{reviewer_name}}": reviewer?.name || "Revisor Asignado",
      "{{informant_name}}": informant?.name || "Informante Asignado"
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

      const emailPayload: Record<string, any> = {
        from: "Monitoreo AGE <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: wrapEmailHtml(body)
      };

      if (config.custom_cc && config.custom_cc.length > 0) {
        emailPayload.cc = config.custom_cc;
      }

      emailPromises.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`
          },
          body: JSON.stringify(emailPayload)
        }).then(async res => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(`Resend error for ${email}: ${JSON.stringify(data)}`);
          }
          return { email, data };
        })
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
