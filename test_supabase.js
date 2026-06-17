
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ewwzmcsxfugqfujvbyxo.supabase.co";
// Using the anon key from the .env seen earlier
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3d3ptY3N4ZnVncWZ1anZieXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzk4MzgsImV4cCI6MjA4OTM1NTgzOH0.zB8QLe2j6M7__6i0ArS-NvVct4p3vIGFQKMg4YX7kNw";

async function testConnection() {
  console.log("Testing connection to:", SUPABASE_URL);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { data, error } = await supabase.from('profiles').select('count');
    
    if (error) {
      console.error("❌ Connection error:", error.message);
      console.error("Full error object:", JSON.stringify(error, null, 2));
    } else {
      console.log("✅ Connection successful!");
      console.log("Data sample:", data);
    }
  } catch (err) {
    console.error("💥 Unexpected error:", err);
  }
}

testConnection();
