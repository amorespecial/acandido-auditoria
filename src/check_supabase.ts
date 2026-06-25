import { supabase } from "./supabaseClient";

async function run() {
  console.log("Checking envios_almoxarife row in detail...");
  try {
    const { data } = await supabase.from("envios_almoxarife").select("*").limit(1);
    if (data && data[0]) {
      const row = data[0];
      for (const k of Object.keys(row)) {
        console.log(`${k}:`, typeof row[k] === 'object' ? JSON.stringify(row[k]) : row[k]);
      }
    }
  } catch (e) {
    console.error("catch:", e);
  }
}

run();
