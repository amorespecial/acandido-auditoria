import { supabase } from "./supabaseClient";

async function run() {
  console.log("Searching for TOP 10 rows in avaliacoes...");
  try {
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("*")
      .eq("criterio_codigo", "2")
      .limit(10);
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("TOP 10 rows in avaliacoes:", data);
      if (data && data[0]) {
        console.log("First row keys:", Object.keys(data[0]));
      }
    }
  } catch (e) {
    console.error("Catch:", e);
  }
}

run();
