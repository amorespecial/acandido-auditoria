import { supabase } from "./supabaseClient";

async function run() {
  console.log("Querying top10_envios...");
  try {
    const { data, error } = await supabase.from("top10_envios").select("*");
    if (error) {
      console.error("Error fetching top10_envios:", error);
    } else {
      console.log("top10_envios entries count:", data?.length);
      console.log("top10_envios data:", data);
    }
  } catch (e) {
    console.error("Catch:", e);
  }
}

run();
