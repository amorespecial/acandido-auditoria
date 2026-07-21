import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || "", process.env.VITE_SUPABASE_ANON_KEY || "");

async function run() {
  const { data: evals } = await supabase.from("avaliacoes").select("almoxarifado, mes, criterio_codigo, resultado").eq("ano", 2026);
  
  const uniqueAlmoxs = Array.from(new Set((evals || []).map(e => e.almoxarifado)));
  console.log("Unique almoxarifado values in database:", uniqueAlmoxs);

  console.log("\n=== PAULO CO-EVALUATION DETAILS (JANEIRO) ===");
  const pauloEvals = (evals || []).filter(e => {
    const alm = String(e.almoxarifado || "").toLowerCase();
    return Number(e.mes) === 1 && (alm.includes("trans cg") || alm.includes("nacional") || alm.includes("a.candido") || alm.includes("a.cândido"));
  });
  for (const e of pauloEvals) {
    console.log(`  Almox: "${e.almoxarifado}", Crit: ${e.criterio_codigo}, Resultado: ${e.resultado}`);
  }
}

run().catch(console.error);
