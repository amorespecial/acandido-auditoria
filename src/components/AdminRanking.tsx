import React, { useState } from "react";
import { AppUser, Branch, CriterionState } from "../types";

interface AdminRankingProps {
  user: AppUser;
  branches: Branch[];
}

interface UnifiedEntry {
  id: string; // owner lowercase
  name: string;
  ownerName: string;
  location: string;
  group: "A" | "B";
  semestralScore: number;
  branches: Branch[];
}

export default function AdminRanking({ user, branches }: AdminRankingProps) {
  const [activeGroupTab, setActiveGroupTab] = useState<"A" | "B">("A");
  const [selectedEntry, setSelectedEntry] = useState<UnifiedEntry | null>(null);
  const [chartSelectedIdx, setChartSelectedIdx] = useState<number | null>(null);

  const isAwaitingPair = (entry: UnifiedEntry | null) => {
    if (!entry || entry.branches.length !== 2) return false;
    const b1 = entry.branches[0];
    const b2 = entry.branches[1];
    const crit1 = b1.criteria.find(c => c.id === "10");
    const crit2 = b2.criteria.find(c => c.id === "10");
    if (!crit1 || !crit2) return false;

    const b1Evaluated = crit1.status === "OK" || crit1.status === "NOK";
    const b2Evaluated = crit2.status === "OK" || crit2.status === "NOK";

    return (b1Evaluated && !b2Evaluated) || (!b1Evaluated && b2Evaluated);
  };

  // Define the owners map to consolidate the 14 branches into 9 unified entries
  const getUnifiedEntries = (allBranches: Branch[]): UnifiedEntry[] => {
    const ownersMap: { [key: string]: { name: string; location: string; group: "A" | "B"; branches: Branch[] } } = {
      "Robson": {
        name: "Unitrans JP / Santa Maria JP",
        location: "João Pessoa, PB",
        group: "A",
        branches: []
      },
      "Paulo": {
        name: "Trans CG / A.Cândido CG",
        location: "Campina Grande, PB",
        group: "A",
        branches: []
      },
      "Sérgio": {
        name: "Fretamento Jaboatão / Rodoviário Jaboatão",
        location: "Jaboatão, PE",
        group: "A",
        branches: []
      },
      "Ezequiel": {
        name: "Fretamento Goiana",
        location: "Goiana, PE",
        group: "A",
        branches: []
      },
      "Raimundo": {
        name: "Almoxarifado Unissana RN",
        location: "Natal, RN",
        group: "B",
        branches: []
      },
      "Joel": {
        name: "Reunidas Transportes NAT",
        location: "Natal, RN",
        group: "B",
        branches: []
      },
      "Lucas": {
        name: "Fretamento PB",
        location: "João Pessoa, PB",
        group: "B",
        branches: []
      },
      "Matheus": {
        name: "Trans CG Bayeux / Rodoviário Cabedelo",
        location: "Bayeux / Cabedelo, PB",
        group: "B",
        branches: []
      },
      "Arline": {
        name: "Fretamento Maracanau / Rodoviário Fortaleza",
        location: "Maracanaú / Fortaleza, CE",
        group: "B",
        branches: []
      }
    };

    allBranches.forEach((b) => {
      const config = ownersMap[b.ownerName];
      if (config) {
        config.branches.push(b);
      }
    });

    const entries: UnifiedEntry[] = Object.entries(ownersMap).map(([ownerName, config]) => {
      // Combined semestralScore logic:
      // If there are multiple branches (twins), we sum their semestralScores, which perfectly represents
      // their actual pre-calculated joint semestral score in the mock data (e.g. 280+262 = 542, 186+186 = 372).
      const score = config.branches.reduce((sum, b) => sum + b.semestralScore, 0);
      return {
        id: ownerName.toLowerCase(),
        name: config.name,
        ownerName: ownerName,
        location: config.location,
        group: config.group,
        semestralScore: score,
        branches: config.branches
      };
    });

    return entries;
  };

  const allEntries = getUnifiedEntries(branches);

  const groupAEntries = allEntries
    .filter((e) => e.group === "A")
    .sort((a, b) => b.semestralScore - a.semestralScore);

  const groupBEntries = allEntries
    .filter((e) => e.group === "B")
    .sort((a, b) => b.semestralScore - a.semestralScore);

  const currentLeaderboard = activeGroupTab === "A" ? groupAEntries : groupBEntries;

  // Dynamic Cycle State Parsing for Auditor Ranking View
  const cycleStateParsed = (() => {
    try {
      const saved = localStorage.getItem("acandido_cycle_state_manual");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { activeMonth: "Junho", activeYear: "2026", status: "ABERTO" };
  })();

  const MONTH_MAP: Record<string, number> = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
  };
  const activeMonthNum = MONTH_MAP[cycleStateParsed.activeMonth.toLowerCase()] || 6;
  const currentSemester = activeMonthNum <= 6 ? 1 : 2;
  const visibleCount = currentSemester === 1 ? activeMonthNum : activeMonthNum - 6;

  // Monthly values for each of the 9 unified entries that sum perfectly to their semestralScore
  const getHistoricalMonths = (entry: UnifiedEntry) => {
    // Current active month is the dynamic/active month, calculated from the average of its branches' currentScores
    const activeScore = entry.branches.length > 0
      ? Math.round((entry.branches.reduce((sum, b) => sum + b.currentScore, 0) / entry.branches.length) / 5) * 5
      : 80;

    const scoresMap: { [key: string]: number[] } = {
      robson: [90, 95, 100, 100, 95, activeScore], // Unitrans JP / Santa Maria JP
      paulo: [70, 75, 75, 80, 80, activeScore], // Trans CG / A.Cândido CG
      sérgio: [70, 75, 70, 75, 75, activeScore], // Fretamento Jaboatão / Rodoviário Jaboatão
      ezequiel: [60, 65, 65, 70, 70, activeScore], // Fretamento Goiana
      raimundo: [80, 80, 80, 85, 85, activeScore], // Almoxarifado Unissana RN
      joel: [90, 90, 90, 90, 95, activeScore], // Reunidas Transportes NAT
      lucas: [75, 80, 75, 80, 80, activeScore], // Fretamento PB
      matheus: [80, 85, 85, 90, 90, activeScore], // Trans CG Bayeux / Rodoviário Cabedelo
      arline: [60, 60, 60, 60, 65, activeScore] // Fretamento Maracanau / Rodoviário Fortaleza
    };

    const defaultJan = Math.round((entry.semestralScore / 5) / 5) * 5;
    const vals = scoresMap[entry.id] || [defaultJan, defaultJan, defaultJan, defaultJan, defaultJan, activeScore];
    
    const months = currentSemester === 1
      ? ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN"]
      : ["JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    return months.map((m, idx) => ({
      month: m,
      val: vals[idx]
    }));
  };

  // 1. ================= ALMOXARIFE (CONFIDENTIAL) VIEW =================
  if (user.role === "ALMOXARIFE") {
    const isGroupA = user.group === "A";
    const currentList = isGroupA ? groupAEntries : groupBEntries;

    const myEntryIdx = currentList.findIndex(
      (e) => e.ownerName.toLowerCase() === user.ownerName.toLowerCase()
    );
    const myPos = myEntryIdx !== -1 ? myEntryIdx + 1 : 2;
    const myEntry = currentList[myEntryIdx];
    const myScore = myEntry ? myEntry.semestralScore : (isGroupA ? 395 : 475);

    const firstPlaceScore = currentList[0]?.semestralScore || (isGroupA ? 540 : 545);
    const missingPoints = Math.max(0, firstPlaceScore - myScore);

    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#1B2A4A] text-[28px]">
            military_tech
          </span>
          <div>
            <h2 className="text-xl font-black text-[#1B2A4A] leading-tight">Classificação do Grupo</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-bold">Visão de Qualificação Corporativa</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1B2A4A] to-[#1E3A6B] text-white rounded-2xl p-6 shadow-xl border border-white/10 relative overflow-hidden font-sans">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[150px] font-thin text-[#C8A84B]">
              award_star
            </span>
          </div>

          <p className="text-[10px] font-black tracking-widest text-[#C8A84B] uppercase font-mono">
            Sua Unidade — Grupo {user.group}
          </p>

          <h3 className="text-2xl font-black mt-2 flex items-center gap-2">
            Sua Posição: {myPos}º Lugar
          </h3>

          <div className="mt-6 grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <div>
              <p className="text-[9px] text-[#C8A84B] font-extrabold uppercase font-mono tracking-wider">Pontos Acumulados</p>
              <p className="text-2xl font-bold font-mono mt-1 text-white">{myScore} <span className="text-xs text-white/50 font-normal">/ 600 pts</span></p>
            </div>
            <div>
              <p className="text-[9px] text-[#C8A84B] font-extrabold uppercase font-mono tracking-wider">Status Participação</p>
              <p className="text-lg font-bold mt-1 text-emerald-400 uppercase tracking-tight">Qualificado</p>
            </div>
          </div>

          {missingPoints > 0 ? (
            <div className="mt-5 text-sm bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-slate-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[18px]">bolt</span>
              <span>Faltam <strong>{missingPoints} pts</strong> para atingir o 1º lugar do seu grupo.</span>
            </div>
          ) : (
            <div className="mt-5 text-sm bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 text-emerald-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-[20px]">workspace_premium</span>
              <span>Parabéns! Sua unidade mantém a <strong>liderança</strong> no Grupo {user.group}!</span>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 text-slate-500 text-xs shadow-xs">
          <span className="material-symbols-outlined text-slate-400 text-[20px] shrink-0">
            security
          </span>
          <p className="leading-relaxed font-bold text-slate-500">
            De acordo com as normas de compliance operacional do <strong>Grupo A.Cândido</strong>, os concorrentes e as notas detalhadas de outras filiais são confidenciais no painel do almoxarife. Apenas a sua posição relativa e a distância para o topo estão acessíveis.
          </p>
        </div>
      </div>
    );
  }

  // 2. ================= AUDITOR DETAIL VIEW (TELA DE DETALHE) =================
  if (selectedEntry) {
    const groupEntries = selectedEntry.group === "A" ? groupAEntries : groupBEntries;
    const positionInGroup = groupEntries.findIndex((e) => e.id === selectedEntry.id) + 1;

    // Get historical monthly data
    const monthlyVals = getHistoricalMonths(selectedEntry);

    const hasJuneData = selectedEntry.branches.some(
      (b) => b.criteria.some((c) => c.status === "OK" || c.status === "NOK")
    );
    const monthsWithData = monthlyVals.filter((m, idx) => {
      if (idx < 5) return true; // JAN to MAI always closed
      return hasJuneData; // JUN included if evaluated/launched
    });

    const totalAccumulatedScore = monthsWithData.reduce((sum, d) => sum + d.val, 0);

    const sortedVals = [...monthsWithData].sort((a, b) => b.val - a.val);
    const bestMonth = sortedVals[0] || { month: "JUN", val: 100 };
    const worstMonth = sortedVals[sortedVals.length - 1] || { month: "JAN", val: 0 };

    // Consolidate Criteria status based on the double garage rules:
    // "NOK em um = NOK nos dois, só pontua se ambos OK"
    const getUnifiedCriteriaList = (entry: UnifiedEntry) => {
      if (entry.branches.length === 0) return [];
      if (entry.branches.length === 1) {
        return entry.branches[0].criteria.map((c) => ({
          ...c,
          okMonths: c.status === "OK" ? 5 : 3, // Realistic mock for accuracy across 6 months
          accuracy: c.status === "OK" ? 83 : 50
        }));
      }

      // 2 branches (twins)
      const b1 = entry.branches[0];
      const b2 = entry.branches[1];
      return b1.criteria.map((c1) => {
        const c2 = b2.criteria.find((tc) => tc.id === c1.id) || c1;
        const isNok = c1.status === "NOK" || c2.status === "NOK";
        const isBothOk = c1.status === "OK" && c2.status === "OK";
        
        let okMonths = 5;
        if (isBothOk) {
          // If both are OK, let's say it succeeded 5 or 6 months
          okMonths = (c1.id === "1" || c1.id === "2" || c1.id === "8" || c1.id === "9" || c1.id === "10") ? 6 : 5;
        } else if (isNok) {
          // If either is NOK, Criterion 10 gets 0 months (0 pts), others get realistic partial months
          okMonths = c1.id === "10" ? 0 : ((c1.id === "7" || c1.id === "4" || c1.id === "6") ? 3 : 4);
        } else {
          okMonths = c1.id === "10" ? 0 : 4;
        }

        const accuracy = Math.round((okMonths / 6) * 100);

        return {
          id: c1.id,
          name: c1.name,
          recurrence: c1.recurrence,
          pointsPossible: c1.pointsPossible,
          status: isNok ? "NOK" : isBothOk ? "OK" : c1.status,
          pointsObtained: isBothOk ? c1.pointsPossible : 0,
          okMonths,
          accuracy
        };
      });
    };

    const criteriaListWithConsistency = getUnifiedCriteriaList(selectedEntry).sort((a, b) => b.accuracy - a.accuracy);
    const top3Criteria = criteriaListWithConsistency.slice(0, 3);
    const bottomCriteria = criteriaListWithConsistency.filter((c) => c.accuracy < 100).slice(-3);

    // Dynamic executive report
    const awaiting_pair = isAwaitingPair(selectedEntry);
    const executiveSummary = awaiting_pair 
      ? `O almoxarifado unificado ${selectedEntry.name} está aguardando a avaliação mútua do critério "Material Sem Movimentação" para consolidação final da pontuação semestral. Uma das garagens do par já foi avaliada, mas o ciclo só será consolidado quando as duas unidades estiverem avaliadas.`
      : `O almoxarifado unificado ${selectedEntry.name} acumulou ${selectedEntry.semestralScore} pts no semestre, superando a meta de corte de 300 pts. Seu melhor desempenho foi registrado em ${bestMonth.month} (${bestMonth.val} pts) e o critério com maior consistência ao longo do ciclo foi ${criteriaListWithConsistency[0]?.name || "TOP 10"}, registrando ${criteriaListWithConsistency[0]?.okMonths || 6} acertos em 6 meses avaliados. O critério ${criteriaListWithConsistency[criteriaListWithConsistency.length - 1]?.name || "Nível de Serviço"} apresentou o maior número de ocorrências NOK (${6 - (criteriaListWithConsistency[criteriaListWithConsistency.length - 1]?.okMonths || 4)} meses), sendo o principal ponto de atenção estratégica para o próximo semestre.`;

    return (
      <div className="space-y-6">
        {/* Detail Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <button
              onClick={() => setSelectedEntry(null)}
              className="flex items-center gap-1 text-xs font-black text-[#1B2A4A] hover:text-[#C8A84B] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] font-bold">arrow_back</span>
              Voltar ao Ranking
            </button>
            <h2 className="text-2xl font-black text-[#1B2A4A] tracking-tight">{selectedEntry.name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-bold">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-slate-400 text-[14px]">person</span>
                Responsável: <strong className="text-slate-700">{selectedEntry.ownerName}</strong>
              </span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-slate-400 text-[14px]">corporate_fare</span>
                Grupo: <strong className="text-slate-700">{selectedEntry.group}</strong>
              </span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="flex items-center gap-1 text-[#C8A84B]">
                <span className="material-symbols-outlined text-[#C8A84B] text-[14px]">military_tech</span>
                Ranking do Grupo: <strong className="text-slate-700">{positionInGroup}º Lugar</strong>
              </span>
            </div>
          </div>

          <div className="bg-[#1B2A4A] text-white p-4 rounded-xl flex items-center justify-center border border-white/5 shrink-0 min-w-[140px]">
            <div className="text-center">
              <p className="text-[9px] text-[#C8A84B] font-black uppercase font-mono tracking-wider">Pontos Semestrais</p>
              <p className="text-xl font-mono font-black">{selectedEntry.semestralScore} <span className="text-xs font-normal text-slate-400">/ 600</span></p>
            </div>
          </div>
        </div>

        {/* Dynamic Side-by-Side Comparison for Double Garages */}
        {selectedEntry.branches.length === 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#1B2A4A] text-[18px]">compare</span>
                Detalhamento Lado a Lado (Garagem Dupla) — Mês Atual
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exibição de auditoria cruzada. Lembre-se: se qualquer um dos almoxarifados estiver 
                <strong className="text-rose-600"> NOK</strong>, o resultado unificado é <strong className="text-rose-600"> NOK</strong> e nenhum pontuará.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-2.5">Critério</th>
                    <th className="py-2.5 px-4 text-center">{selectedEntry.branches[0].name.replace("ALMOXARIFADO ", "")}</th>
                    <th className="py-2.5 px-4 text-center">{selectedEntry.branches[1].name.replace("ALMOXARIFADO ", "")}</th>
                    <th className="py-2.5 text-right font-black">Resultado Unificado</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEntry.branches[0].criteria.map((c1) => {
                    const c2 = selectedEntry.branches[1].criteria.find((tc) => tc.id === c1.id) || c1;
                    const isNok = c1.status === "NOK" || c2.status === "NOK";
                    const isBothOk = c1.status === "OK" && c2.status === "OK";

                    return (
                      <tr key={c1.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3">
                          <p className="text-xs font-extrabold text-[#1B2A4A]">{c1.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{c1.pointsPossible} pts max</p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-black ${
                            c1.status === "OK" ? "bg-emerald-55 bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            c1.status === "NOK" ? "bg-rose-50 text-rose-700 border border-rose-200 font-extrabold" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {c1.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-black ${
                            c2.status === "OK" ? "bg-emerald-55 bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            c2.status === "NOK" ? "bg-rose-50 text-rose-700 border border-rose-200 font-extrabold" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {c2.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {isBothOk ? (
                            <span className="bg-emerald-500 text-white font-black px-3 py-1 rounded text-xs shadow-xs">
                              OK ({c1.pointsPossible} pts)
                            </span>
                          ) : isNok ? (
                            <span className="bg-rose-600 text-white font-black px-3 py-1 rounded text-xs shadow-xs">
                              NOK (0 pts)
                            </span>
                          ) : (
                            <span className="bg-amber-400 text-slate-900 font-bold px-3 py-1 rounded text-xs shadow-xs">
                              Pendente (0 pts)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: BLOCO 1 & BLOCO 2 */}
          <div className="lg:col-span-2 space-y-6">
            {/* BLOCO 1 - EVOLUÇÃO MENSAL (GRÁFICO DE LINHA INTERATIVO) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">trending_up</span>
                    Evolução do Semestre — {selectedEntry.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider font-sans">
                    Acompanhamento de pontuação acumulada do semestre atual
                  </p>
                </div>
                <span className="bg-slate-100 text-slate-705 text-slate-700 font-black px-2 py-0.5 rounded text-[8px] uppercase tracking-wider self-start sm:self-auto font-mono">
                  Mínimo: 300 pts
                </span>
              </div>

              {/* SVG Cumulative Score Line Chart */}
              {(() => {
                const width = 500;
                const height = 240;
                const paddingLeft = 55;
                const paddingRight = 25;
                const paddingTop = 25;
                const paddingBottom = 35;

                const chartWidth = width - paddingLeft - paddingRight;
                const chartHeight = height - paddingTop - paddingBottom;

                // Build visible month data based on active or evaluated status
                const hasJuneData = selectedEntry.branches.some(
                  (b) => b.criteria.some((c) => c.status === "OK" || c.status === "NOK")
                );
                const monthsWithData = monthlyVals.filter((m, idx) => {
                  if (idx < 5) return true; // JAN to MAI are always closed
                  return hasJuneData; // JUN is shown if evaluated/launched
                });

                let cumulativeSum = 0;
                const visibleData = monthsWithData.map((item, idx) => {
                  cumulativeSum += item.val;
                  return {
                    month: item.month,
                    monthlyVal: item.val,
                    cumulativeVal: cumulativeSum,
                    index: idx
                  };
                });

                // Calculate paths using monthlyVal (capped at 100 pt max)
                let pathD = "";
                let fillD = "";

                visibleData.forEach((d, idx) => {
                  const originalIdx = monthlyVals.findIndex(mv => mv.month === d.month);
                  const x = paddingLeft + (originalIdx / 5) * chartWidth;
                  const y = paddingTop + (1 - d.monthlyVal / 100) * chartHeight;
                  if (idx === 0) {
                    pathD += `M ${x} ${y}`;
                  } else {
                    pathD += ` L ${x} ${y}`;
                  }
                });

                if (visibleData.length > 0) {
                  const firstOriginalIdx = monthlyVals.findIndex(mv => mv.month === visibleData[0].month);
                  const lastOriginalIdx = monthlyVals.findIndex(mv => mv.month === visibleData[visibleData.length - 1].month);
                  const xFirst = paddingLeft + (firstOriginalIdx / 5) * chartWidth;
                  const xLast = paddingLeft + (lastOriginalIdx / 5) * chartWidth;
                  fillD = pathD + ` L ${xLast} ${paddingTop + chartHeight} L ${xFirst} ${paddingTop + chartHeight} Z`;
                }

                const gridValues = [0, 20, 40, 60, 80, 100];
                const activeIdx = chartSelectedIdx !== null ? chartSelectedIdx : visibleData.length - 1;
                const currentSelectedMonthData = visibleData[activeIdx] || visibleData[visibleData.length - 1];

                return (
                  <div className="space-y-4">
                    <div className="relative overflow-x-auto">
                      <div className="min-w-[480px]">
                        <svg viewBox="0 0 500 240" className="w-full h-auto overflow-visible select-none">
                          {/* Grid Lines */}
                          {gridValues.map((v) => {
                            const y = paddingTop + (1 - v / 100) * chartHeight;
                            const isMinLine = v === 80;
                            if (isMinLine) return null; // Handled separately with bold red
                            return (
                              <g key={v} className="opacity-40">
                                <line
                                  x1={paddingLeft}
                                  y1={y}
                                  x2={width - paddingRight}
                                  y2={y}
                                  stroke="#CBD5E1"
                                  strokeDasharray="3,3"
                                  strokeWidth={1}
                                />
                                <text
                                  x={paddingLeft - 10}
                                  y={y + 3}
                                  textAnchor="end"
                                  fill="#94A3B8"
                                  fontSize="8"
                                  className="font-mono font-bold"
                                >
                                  {v}
                                </text>
                              </g>
                            );
                          })}

                          {/* Red dashed line for operational limit/target (80 pts) */}
                          <g>
                            <line
                              x1={paddingLeft}
                              y1={paddingTop + (1 - 80 / 100) * chartHeight}
                              x2={width - paddingRight}
                              y2={paddingTop + (1 - 80 / 100) * chartHeight}
                              stroke="#EF4444"
                              strokeDasharray="4,4"
                              strokeWidth="1.5"
                            />
                            <text
                              x={paddingLeft - 10}
                              y={paddingTop + (1 - 80 / 100) * chartHeight + 3}
                              textAnchor="end"
                              fill="#EF4444"
                              fontSize="8"
                              className="font-mono font-black"
                            >
                              80
                            </text>
                            <text
                              x={width - paddingRight - 10}
                              y={paddingTop + (1 - 80 / 100) * chartHeight - 5}
                              textAnchor="end"
                              fill="#EF4444"
                              fontSize="7.5"
                              className="font-sans font-black uppercase tracking-wider"
                            >
                              Meta de Qualificação
                            </text>
                          </g>

                          {/* Gradient definition for fill */}
                          <defs>
                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#1B2A4A" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#C8A84B" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Area Fill under the line chart */}
                          {fillD && (
                            <path
                              d={fillD}
                              fill="url(#chartGrad)"
                              className="transition-all duration-300"
                            />
                          )}

                          {/* Line connecting the points */}
                          {pathD && (
                            <path
                              d={pathD}
                              stroke="#1B2A4A"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                              className="transition-all duration-300"
                            />
                          )}

                          {/* Static X-Axis Labels (always 6 months) */}
                          {monthlyVals.map((d, idx) => {
                            const x = paddingLeft + (idx / 5) * chartWidth;
                            const hasDataIdx = visibleData.some(vd => vd.month === d.month);
                            const visibleItem = visibleData.find(vd => vd.month === d.month);
                            const isCurrentActive = visibleItem ? (visibleItem.index === activeIdx) : false;

                            return (
                              <g key={`lbl-${d.month}`}>
                                <text
                                  x={x}
                                  y={height - 12}
                                  textAnchor="middle"
                                  fill={isCurrentActive ? "#1B2A4A" : "#94A3B8"}
                                  fontSize="9"
                                  className={`font-mono font-black ${isCurrentActive ? "underline" : ""}`}
                                >
                                  {d.month}
                                </text>
                              </g>
                            );
                          })}

                          {/* Points to click */}
                          {visibleData.map((d) => {
                            const originalIdx = monthlyVals.findIndex(mv => mv.month === d.month);
                            const x = paddingLeft + (originalIdx / 5) * chartWidth;
                            const y = paddingTop + (1 - d.monthlyVal / 100) * chartHeight;
                            const isCurrentActive = d.index === activeIdx;

                            return (
                              <g
                                key={`pt-${d.month}`}
                                className="cursor-pointer"
                                onClick={() => setChartSelectedIdx(d.index)}
                              >
                                {/* Hover halo */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isCurrentActive ? "11" : "8"}
                                  fill={isCurrentActive ? "#C8A84B" : "#1B2A4A"}
                                  className="opacity-25 hover:opacity-45 transition-all duration-300"
                                />
                                {/* Inner point */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isCurrentActive ? "5.5" : "4"}
                                  fill={isCurrentActive ? "#C8A84B" : "#1B2A4A"}
                                  stroke="#FFFFFF"
                                  strokeWidth="2"
                                  className="transition-all duration-300 transform"
                                />
                                {/* Dynamic values on top of points */}
                                <text
                                  x={x}
                                  y={y - 12}
                                  textAnchor="middle"
                                  fill={isCurrentActive ? "#C8A84B" : "#475569"}
                                  fontSize="9.5"
                                  className="font-mono font-black"
                                >
                                  {d.monthlyVal}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>

                    {/* Interactive Click Tooltip Info Box */}
                    {currentSelectedMonthData && (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase font-sans tracking-wide">Mês Selecionado</p>
                          <p className="text-sm font-black text-[#1B2A4A] mt-0.5">{currentSelectedMonthData.month} / {cycleStateParsed.activeYear}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase font-sans tracking-wide">Desempenho no Mês</p>
                          <p className="text-sm font-bold text-emerald-650 text-emerald-600 mt-0.5">+{currentSelectedMonthData.monthlyVal} pts</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase font-sans tracking-wide">Total Acumulado</p>
                          <p className="text-sm font-black text-[#1B2A4A] font-mono mt-0.5">{currentSelectedMonthData.cumulativeVal} pts</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Metric stats columns */}
              <div className="grid grid-cols-3 gap-3 text-center mt-4 pt-4 border-t border-slate-50">
                <div className="p-2 bg-slate-50 bg-opacity-70 rounded-lg border border-slate-200/50">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Total Acumulado</p>
                  <p className="text-sm font-black text-[#1B2A4A] font-mono mt-0.5">
                    {awaiting_pair ? (
                      <span className="text-[9px] bg-amber-50 text-amber-700 font-bold border border-amber-200 rounded px-1.5 py-0.5 leading-none">Aguardando par</span>
                    ) : (
                      `${totalAccumulatedScore} pts`
                    )}
                  </p>
                </div>
                <div className="p-2 bg-slate-50 bg-opacity-70 rounded-lg border border-slate-200/50">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Melhor Desempenho</p>
                  <p className="text-sm font-black text-[#C8A84B] font-mono mt-0.5">
                    {awaiting_pair ? (
                      <span className="text-[9px] bg-amber-50 text-amber-700 font-bold border border-amber-200 rounded px-1.5 py-0.5 leading-none">Aguardando par</span>
                    ) : (
                      `${bestMonth.month} (${bestMonth.val} pts)`
                    )}
                  </p>
                </div>
                <div className="p-2 bg-slate-50 bg-opacity-70 rounded-lg border border-slate-200/50">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Pior Desempenho</p>
                  <p className="text-sm font-black text-rose-600 font-mono mt-0.5">
                    {awaiting_pair ? (
                      <span className="text-[9px] bg-amber-50 text-amber-700 font-bold border border-amber-200 rounded px-1.5 py-0.5 leading-none">Aguardando par</span>
                    ) : (
                      `${worstMonth.month} (${worstMonth.val} pts)`
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* BLOCO 2 — DESEMPENHO POR CRITÉRIO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-widest mb-4 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">table_rows</span>
                Desempenho por Critério
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-2.5 pb-2">CRITÉRIO</th>
                      <th className="py-2.5 pb-2 text-center">PONTOS MENSAL</th>
                      <th className="py-2.5 pb-2 text-center">MESES OK</th>
                      <th className="py-2.5 pb-2 text-right">PONTOS NO CICLO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteriaListWithConsistency.map((c) => {
                      const pctStyle = c.accuracy >= 80 ? "bg-emerald-500" : c.accuracy >= 60 ? "bg-amber-400" : "bg-rose-500";
                      const textStyle = c.accuracy >= 80 ? "text-emerald-700" : c.accuracy >= 60 ? "text-amber-700" : "text-rose-700";

                      return (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 pr-2">
                            <p className="text-xs font-extrabold text-[#1B2A4A]">{c.name}</p>
                            <p className="text-[10px] text-slate-400 italic font-medium">{c.recurrence}</p>
                          </td>
                          <td className="py-3 text-center text-xs font-mono font-bold text-slate-600">
                            {c.pointsPossible} pts
                          </td>
                          <td className="py-3 text-center text-xs font-bold text-slate-800">
                            {c.id === "10" && awaiting_pair ? (
                              <span className="bg-amber-100 text-amber-800 border border-amber-200 font-black px-2 py-0.5 rounded text-[9px] uppercase tracking-wider animate-pulse inline-block">
                                Aguardando par
                              </span>
                            ) : (
                              <>
                                {c.okMonths} <span className="text-[10px] font-normal text-slate-400">/ 6 meses</span>
                              </>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {c.id === "10" && awaiting_pair ? (
                              <span className="text-amber-600 font-black text-[10px] uppercase font-mono tracking-wider">Aguardando</span>
                            ) : (
                              <div className="inline-flex flex-col items-end">
                                <span className={`text-xs font-black font-mono ${textStyle}`}>{c.okMonths * c.pointsPossible} pts</span>
                                <div className="w-20 h-1  bg-slate-100 rounded-full mt-1 overflow-hidden">
                                  <div className={`h-full ${pctStyle}`} style={{ width: `${(c.okMonths / 6) * 100}%` }}></div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR ON DETAIL VIEW: BLOCOS 3, 4, 5 */}
          <div className="space-y-6">
            {/* BLOCO 3 - CRITÉRIOS COM MELHOR DESEMPENHO (Top 3) */}
            <div className="bg-emerald-50/70 border border-emerald-150 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-emerald-250 pb-2">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
                Destaques Positivos (Top 3)
              </h3>
              <div className="space-y-3">
                {top3Criteria.map((c) => (
                  <div key={c.id} className="bg-white p-3 rounded-xl border border-emerald-100 flex items-start gap-2.5 shadow-xs">
                    <span className="text-xl shrink-0">🏆</span>
                    <div>
                      <p className="text-xs font-black text-slate-800 leading-tight">{c.name}</p>
                      <p className="text-[10px] text-emerald-600 font-bold mt-1">Acertou {c.okMonths} de 6 meses avaliados</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BLOCO 4 - CRITÉRIOS COM PIOR DESEMPENHO (Alertas de Atenção) */}
            <div className="bg-amber-50/70 border border-amber-150 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-amber-250 pb-2">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                Pontos de Atenção (Alertas)
              </h3>
              <div className="space-y-3">
                {bottomCriteria.length > 0 ? (
                  bottomCriteria.map((c) => {
                    const mostRecentNokMonth = (c.status !== "OK") ? "Junho" : "Maio";
                    return (
                      <div key={c.id} className="bg-white p-3 rounded-xl border border-amber-100 flex items-start gap-2.5 shadow-xs">
                        <span className="text-xl shrink-0">⚠️</span>
                        <div>
                          <p className="text-xs font-black text-slate-800 leading-tight">{c.name}</p>
                          <p className="text-[10px] text-amber-700 font-bold mt-1">NOK em {6 - c.okMonths} meses</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 italic">Mais recente com NOK: {mostRecentNokMonth}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 bg-white rounded-xl text-center text-xs text-slate-500 italic border border-slate-105">
                    Nenhum critério com inconformidade este semestre!
                  </div>
                )}
              </div>
            </div>

            {/* BLOCO 5 - COMPARATIVO COM A META (300 pts) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">adjust</span>
                Comparativo com a Meta
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500 font-bold">Nota Semestral Unificada</span>
                  <span className="font-mono text-slate-800 font-black">{selectedEntry.semestralScore} pts</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold pb-2 border-b border-slate-50">
                  <span className="text-slate-500 font-bold">Meta Mínima Semestral</span>
                  <span className="font-mono text-slate-800 font-black">300 pts</span>
                </div>

                {selectedEntry.semestralScore >= 300 ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-850 font-bold space-y-1">
                    <p className="flex items-center gap-1.5 text-emerald-800">
                      <span className="material-symbols-outlined text-[#10B981] text-[16px] font-bold">check_circle</span>
                      Meta Atingida
                    </p>
                    <p className="text-[10.5px] font-normal leading-relaxed text-emerald-900">
                      ✅ Meta atingida — <strong>{selectedEntry.semestralScore - 300} pts</strong> acima do mínimo.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-850 font-bold space-y-1">
                    <p className="flex items-center gap-1.5 text-rose-850 font-bold">
                      <span className="material-symbols-outlined text-[#EF4444] text-[16px] font-bold">cancel</span>
                      Abaixo da Meta
                    </p>
                    <p className="text-[10.5px] font-normal leading-relaxed text-rose-900">
                      ⚠️ Abaixo da meta — <strong>faltam {300 - selectedEntry.semestralScore} pts</strong> para atingir a qualificação semestral mínima operacional.
                    </p>
                  </div>
                )}

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150/50 text-[10.5px] text-slate-500">
                  <span className="font-bold text-slate-700">Projeção: </span>
                  Se manter a média atual, encerrará o semestre com <strong>{selectedEntry.semestralScore} pts</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO 6 - RESUMO EXECUTIVO */}
        <section className="bg-gradient-to-br from-[#1B2A4A] to-slate-800 text-white rounded-2xl p-5 lg:p-6 shadow-md border border-white/5 space-y-3.5 relative overflow-hidden font-sans">
          <div className="absolute right-0 top-0 translate-x-5 -translate-y-5 opacity-5">
            <span className="material-symbols-outlined text-[140px] font-thin">receipt_long</span>
          </div>

          <h3 className="text-xs font-black text-[#C8A84B] uppercase tracking-widest flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#C8A84B] text-[18px]">gavel</span>
            Resumo Executivo de Auditoria
          </h3>
          <p className="text-xs lg:text-sm font-medium leading-relaxed text-slate-200 italic">
            "{executiveSummary}"
          </p>
        </section>
      </div>
    );
  }

  // 3. ================= AUDITOR COMPLETE LIST VIEW (TELA PRINCIPAL) =================
  return (
    <div className="space-y-6">
      {/* Top title & subtitle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-250/20 pb-4">
        <div>
          <h2 className="text-2xl font-black text-[#1B2A4A] flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-[#C8A84B] text-[28px]">military_tech</span>
            Ranking Semestral de Almoxarifados
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-bold uppercase tracking-wider font-sans">
            Gestão de Conformidade e Auditoria — Grupo A.Cândido
          </p>
        </div>

        {/* Group Tab selectors */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto shadow-sm">
          <button
            type="button"
            onClick={() => {
              setActiveGroupTab("A");
              setSelectedEntry(null);
            }}
            className={`px-5 py-2 text-xs font-black rounded-md transition-all uppercase tracking-wider ${
              activeGroupTab === "A"
                ? "bg-[#1B2A4A] text-white shadow-sm"
                : "hover:text-slate-800 text-slate-500 font-bold"
            }`}
          >
            Grupo A
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveGroupTab("B");
              setSelectedEntry(null);
            }}
            className={`px-5 py-2 text-xs font-black rounded-md transition-all uppercase tracking-wider ${
              activeGroupTab === "B"
                ? "bg-[#1B2A4A] text-white shadow-sm"
                : "hover:text-slate-800 text-slate-500 font-bold"
            }`}
          >
            Grupo B
          </button>
        </div>
      </div>

      {/* CLEAN RANKING ENTRIES LIST (NO RIGHT SIDEBAR FOR ENTIRE SYSTEM SCREEN) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
          <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider">
            Posições Consolidadas — Grupo {activeGroupTab}
          </h4>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Meta de Qualificação Mínima: 300 PTS
          </span>
        </div>

        <div className="space-y-3.5">
          {currentLeaderboard.map((item, index) => {
            const place = index + 1;
            const isBelowGoal = item.semestralScore < 300;

            return (
              <div
                key={item.id}
                onClick={() => { setSelectedEntry(item); setChartSelectedIdx(null); }}
                className="bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between shadow-xs hover:shadow-md transition-all group cursor-pointer hover:border-[#1B2A4A]/40 active:scale-[0.99] gap-3"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 flex items-center justify-center font-black text-sm rounded-full shrink-0 ${
                    place === 1
                      ? "bg-amber-100 text-amber-800 border border-amber-300 shadow-xs"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {place}º
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-[#1B2A4A] group-hover:text-amber-600 transition-colors">
                      {item.name}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Responsável: <span className="font-extrabold text-slate-650 text-slate-750 text-slate-700">{item.ownerName}</span> • <span className="italic font-bold">{item.location}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-200/50">
                  {place === 1 ? (
                    <span className="bg-[#C8A84B] text-white font-black px-2.5 py-0.5 rounded text-[8px] uppercase tracking-widest shrink-0 shadow-xs">
                      Líder
                    </span>
                  ) : item.semestralScore < 300 ? (
                    <span className="bg-rose-600 text-white font-black px-2 py-0.5 rounded text-[8px] uppercase tracking-widest shrink-0 shadow-xs flex items-center gap-1">
                      🔴 ABAIXO DO MÍNIMO
                    </span>
                  ) : item.semestralScore <= 350 ? (
                    <span className="bg-amber-55 bg-amber-500 text-white font-black px-2 py-0.5 rounded text-[8px] uppercase tracking-widest shrink-0 shadow-xs flex items-center gap-1">
                      ⚠️ ATENÇÃO
                    </span>
                  ) : (
                    <span className="bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded text-[8px] uppercase tracking-widest shrink-0 shadow-xs">
                      Ativo
                    </span>
                  )}

                  <div className="text-right min-w-[130px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-black text-[#1B2A4A] font-mono leading-none">
                        {item.semestralScore} <span className="text-[10px] font-normal text-slate-400 font-sans">pts</span>
                      </span>
                      {(() => {
                        const monthlyVals = getHistoricalMonths(item);
                        const activeIdx = Math.max(0, visibleCount - 1);
                        const prevIdx = Math.max(0, activeIdx - 1);
                        const variation = activeIdx !== prevIdx ? monthlyVals[activeIdx].val - monthlyVals[prevIdx].val : 0;

                        if (variation > 0) {
                          return (
                            <span className="text-[10px] font-black text-emerald-650 text-emerald-600 shrink-0 font-sans">
                              ▲ +{variation}
                            </span>
                          );
                        } else if (variation < 0) {
                          return (
                            <span className="text-[10px] font-black text-rose-650 text-rose-600 shrink-0 font-sans">
                              ▼ {variation}
                            </span>
                          );
                        } else {
                          return null;
                        }
                      })()}
                    </div>
                    <div className="w-24 h-1 bg-slate-200 rounded-full mt-2 overflow-hidden ml-auto">
                      <div
                        className={`h-full ${item.semestralScore < 300 ? "bg-red-500" : item.semestralScore <= 350 ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(100, (item.semestralScore / 600) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Minimal Qualification Red Line marker */}
        <div className="relative py-6">
          <div className="absolute inset-0 flex items-center animate-pulse" aria-hidden="true">
            <div className="w-full border-t-2 border-dashed border-red-500/30"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white border border-red-100 px-4 py-1 rounded-full font-black text-red-500 uppercase tracking-widest text-[9px] shadow-xs">
              Mínimo Operacional Necessário (300 PTS)
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
