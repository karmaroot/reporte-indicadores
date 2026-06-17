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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing env vars:", { hasUrl: !!supabaseUrl, hasKey: !!serviceRoleKey });
      throw new Error("Server configuration error");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller identity using the JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await adminClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) throw new Error("Not authenticated");

    const callerId = claimsData.user.id;

    // Check admin role
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");

    const { email, password, name, role, institution_id, institution_ids } = await req.json();
    if (!email || !password || !name) throw new Error("email, password, and name are required");

    console.log(`Creating user: ${email} with name: ${name}`);
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error) throw error;

    const newUserId = data.user.id;

    // Wait a brief moment to ensure trigger has run
    // Update profile (handling the default 'informant' role and NULL institution)
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ 
        name, 
        role: role || 'informant',
        institution_id: role === 'jefatura' ? null : (institution_id || null)
      })
      .eq('id', newUserId);
    
    if (profileError) console.error("Error updating profile:", profileError);

    // Update user_roles table if role is different from default informant
    const { error: roleError } = await adminClient
      .from('user_roles')
      .upsert({ user_id: newUserId, role: role || 'informant' }, { onConflict: 'user_id' });
    
    if (roleError) console.error("Error updating user_roles:", roleError);

    // Save multiple institutions for Jefatura
    if (role === 'jefatura' && Array.isArray(institution_ids) && institution_ids.length > 0) {
      const records = institution_ids.map((id: string) => ({
        user_id: newUserId,
        institution_id: id
      }));
      const { error: uiError } = await adminClient
        .from('user_institutions')
        .insert(records);
      if (uiError) console.error("Error inserting user_institutions:", uiError);
    }

    return new Response(JSON.stringify({ user: data.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Error in create-user function:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
