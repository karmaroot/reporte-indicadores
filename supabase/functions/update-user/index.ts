// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

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

    const { userId, email, name, role, institution_id, subrogate_id, is_subrogating } = await req.json();
    if (!userId) throw new Error("userId is required");

    console.log(`Updating user: ${userId} with email: ${email}, name: ${name}`);

    // Update Auth user
    const authUpdates: any = {};
    if (email) {
      authUpdates.email = email;
      authUpdates.email_confirm = true;
    }
    if (name) {
      authUpdates.user_metadata = { name };
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, authUpdates);
      if (authError) throw authError;
    }

    // Update Profile
    const profileUpdates: any = {};
    if (name !== undefined) profileUpdates.name = name;
    if (email !== undefined) profileUpdates.email = email;
    if (role !== undefined) profileUpdates.role = role;
    profileUpdates.institution_id = role === 'jefatura' ? null : (institution_id || null);
    if (subrogate_id !== undefined) profileUpdates.subrogate_id = subrogate_id;
    if (is_subrogating !== undefined) profileUpdates.is_subrogating = is_subrogating;

    const { error: profileError } = await adminClient
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId);

    if (profileError) throw profileError;

    // Update user_roles table if role provided
    if (role) {
      const { error: roleError } = await adminClient
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' });
      if (roleError) console.error("Error updating user_roles:", roleError);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Error in update-user function:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
