import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://placeholder-project-id.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key";

const isReady = (
  typeof supabaseUrl === 'string' &&
  supabaseUrl.length > 0 &&
  !supabaseUrl.includes("placeholder-project-id") &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 30
);

console.log("Is Supabase Ready in environment:", isReady);
console.log("Supabase URL:", supabaseUrl);

if (!isReady) {
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  try {
    const tableNames = ['usuarios', 'ciclos', 'avaliacoes', 'calendario_inventarios'];
    for (const name of tableNames) {
      const { data, error, count } = await supabase.from(name).select('*', { count: 'exact' }).limit(1);
      console.log(`Table ${name} - data:`, data, "error:", error, "count:", count);
    }
  } catch (err) {
    console.log("Failed to query:", err);
  }
}

check();
