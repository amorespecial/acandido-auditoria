import { supabase } from "./supabaseClient";

async function run() {
  const supabaseUrl = (supabase as any).supabaseUrl;
  const supabaseKey = (supabase as any).supabaseKey;
  
  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  const url = `${supabaseUrl}/rest/v1/`;
  try {
    const response = await fetch(url, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const spec = await response.json();
    console.log("Returned response from OpenAPI root:", spec);
  } catch (e) {
    console.error("Failed:", e);
  }
}

run();
