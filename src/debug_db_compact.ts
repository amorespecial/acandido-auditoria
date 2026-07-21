import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || "", process.env.VITE_SUPABASE_ANON_KEY || "");

const branchIds: Record<string, string[]> = {
  "Paulo": ["expresso-nacional", "acandido-cg"],
  "Ezequiel": ["fretamento-goiana"],
  "Matheus": ["trans-cg-bayeux", "rodoviario-cabedelo"]
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"];
const MONTH_NAME_TO_NUM: Record<string, number> = {
  "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5, "junho": 6
};

async function run() {
  // Fetch evaluations
  const { data: evals } = await supabase.from("avaliacoes").select("*").eq("ano", 2026);
  // Fetch history
  const { data: hist } = await supabase.from("acandido_history").select("*");

  console.log("=== MONTHLY EVALUATION SUMMARY IN DATABASE ===");
  for (const [owner, bids] of Object.entries(branchIds)) {
    console.log(`\nOwner: ${owner}`);
    for (const mName of MONTHS) {
      const mNum = MONTH_NAME_TO_NUM[mName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
      console.log(`  * Month: ${mName} (Num: ${mNum})`);
      for (const bid of bids) {
        // Find matching evals
        const matches = (evals || []).filter(e => {
          if (Number(e.mes) !== mNum) return false;
          // Match logic
          const almox = String(e.almoxarifado || "").toLowerCase();
          if (bid === "expresso-nacional" && (almox.includes("trans cg") || almox.includes("nacional"))) return true;
          if (bid === "acandido-cg" && (almox.includes("a.candido") || almox.includes("a.cândido"))) return true;
          if (bid === "fretamento-goiana" && almox.includes("goiana")) return true;
          if (bid === "trans-cg-bayeux" && almox.includes("bayeux")) return true;
          if (bid === "rodoviario-cabedelo" && almox.includes("cabedelo")) return true;
          return almox === bid;
        });

        // Let's count OKs and compute simulated score
        const oks = matches.filter(e => e.resultado === "OK");
        const noks = matches.filter(e => e.resultado === "NOK");
        const pendentes = matches.filter(e => e.resultado === "PENDENTE");
        
        console.log(`    Branch: ${bid} -> Total Evals: ${matches.length} (OK: ${oks.length}, NOK: ${noks.length}, PENDENTE: ${pendentes.length})`);
        if (matches.length > 0) {
          console.log(`      Evals found: ` + matches.map(m => `${m.criterio_codigo}:${m.resultado}`).join(", "));
        }
      }

      // Check history records for this month
      const monthHist = (hist || []).filter(h => {
        const bid = h.branchId || h.branch_id;
        if (!bids.includes(bid)) return false;
        const my = h.monthYear || h.month_year || h.mes_ano || "";
        return my.toLowerCase().includes(mName.toLowerCase()) && my.includes("2026");
      });
      console.log(`    History entries for ${mName}: ${monthHist.length}`);
      for (const mh of monthHist) {
        console.log(`      Hist: branch=${mh.branchId || mh.branch_id}, score=${mh.score}`);
      }
    }
  }
}

run().catch(console.error);
