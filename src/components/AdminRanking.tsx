import React, { useState, useEffect } from "react";
import { AppUser, Branch, CriterionState } from "../types";
import { dbFetchHistory, isSupabaseReady, dbFetchYearEvaluations } from "../supabaseService";
import { useRealtimeSync } from "../useRealtimeSync";

const s = (v: any): string => (v == null ? "" : String(v));

// Secure Error Boundary implementation to capture fatal javascript errors elegantly
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  props: any;
  state: { hasError: boolean; error: Error | null } = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error in AdminRanking:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 shadow-sm max-w-lg mx-auto my-8">
          <div className="flex items-center gap-2 mb-2 font-bold text-lg text-rose-700">
            <span className="material-symbols-outlined text-rose-600">error</span>
            <h3>Erro no Ranking Corporativo</h3>
          </div>
          <p className="text-sm text-slate-600">
            Ocorreu um erro no cálculo de pontuação ou ao renderizar o gráfico histórico. A nossa equipe foi notificada e o estado foi isolado com segurança.
          </p>
          {this.state.error && (
            <pre className="mt-4 p-3 bg-rose-100 text-rose-950 rounded text-xs font-mono overflow-auto max-h-40 border border-rose-200">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    const { children } = this.props as any;
    return children;
  }
}

const safeStr = (val: any): string => 
  val === null || val === undefined ? "" : String(val);

const matchBranch = (almoxName: string, bId: string, bName?: string) => {
  const name = safeStr(almoxName).toLowerCase().trim();
  const branchId = safeStr(bId).toLowerCase().trim();
  
  // 1. Direct explicit rule maps for absolute safety
  if (name.includes("santa maria")) return branchId === "santa-maria-jp";
  if (name.includes("a.candido") || name.includes("a.cândido")) return branchId === "acandido-cg";
  if (name === "trans cg" || name === "expresso nacional" || name.includes("trans cg") || name.includes("expresso nacional")) return branchId === "expresso-nacional";
  if (name.includes("bayeux")) return branchId === "trans-cg-bayeux";
  if (name.includes("cabedelo")) return branchId === "rodoviario-cabedelo";
  if (name.includes("goiana")) return branchId === "fretamento-goiana";
  if (name.includes("fret pb") || name.includes("fretamento pb")) return branchId === "fretamento-pb";
  if (name.includes("fret pe") || name.includes("jaboatao") || name === "trans fret pe") return branchId === "fretamento-jaboatao";
  if (name.includes("rod ce") || name.includes("fortaleza")) return branchId === "rodoviario-fortaleza";
  if (name.includes("rod pe") || name.includes("jaboatão pb") || name === "trans rod pe" || name.includes("jaboatao")) return branchId === "rodoviario-jaboatao";
  if (name.includes("transnacional rn") || name.includes("reunidas") || name.includes("transnacional")) return branchId === "reunidas-nat";
  if (name.includes("unissanta") || name.includes("unissana")) return branchId === "unissana-rn";
  if (name.includes("unitrans")) return branchId === "unitrans-jp";

  // 2. Exact check
  if (branchId === name) return true;

  // 3. Normalized fallback
  const normAlmox = name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

  const normId = branchId
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

  if (normAlmox === normId || normId === normAlmox) return true;
  return false;
};


interface AdminRankingProps {
  user: AppUser;
  branches: Branch[];
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  activeYear: string;
  setActiveYear: (year: string) => void;
  selectedSemesterFilter: "1" | "2";
  setSelectedSemesterFilter: (sem: "1" | "2") => void;
  cycleState?: any;
  calendarData?: any;
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

export default function AdminRanking(props: AdminRankingProps) {
  return (
    <ErrorBoundary>
      <AdminRankingContent {...props} />
    </ErrorBoundary>
  );
}

function AdminRankingContent({
  user,
  branches,
  activeMonth,
  setActiveMonth,
  activeYear,
  setActiveYear,
  selectedSemesterFilter,
  setSelectedSemesterFilter,
  cycleState,
  calendarData
}: AdminRankingProps) {
  useRealtimeSync();
  const [activeGroupTab, setActiveGroupTab] = useState<"A" | "B">("A");
  const [selectedEntry, setSelectedEntry] = useState<UnifiedEntry | null>(null);
  const [chartSelectedIdx, setChartSelectedIdx] = useState<number | null>(null);
  const [rankingMode, setRankingMode] = useState<"MES" | "ACUMULADO">("MES");
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [allEvaluationsOfYear, setAllEvaluationsOfYear] = useState<any[]>([]);
  const [loadingAllEvals, setLoadingAllEvals] = useState(false);

  useEffect(() => {
    const loadRankingHist = async () => {
      if (isSupabaseReady()) {
        try {
          const dbHistory = await dbFetchHistory();
          if (dbHistory && Array.isArray(dbHistory)) {
            setHistoryList(dbHistory);
            return;
          }
        } catch (e) {
          console.error("Failed to load history list in AdminRanking:", e);
        }
      }
      // Fallback
      try {
        const saved = localStorage.getItem("acandido_history");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setHistoryList(parsed);
            return;
          }
        }
      } catch (e) {
        setHistoryList([]);
      }
    };
    loadRankingHist();
    window.addEventListener("realtime-historico-update", loadRankingHist);
    window.addEventListener("storage", loadRankingHist);
    return () => {
      window.removeEventListener("realtime-historico-update", loadRankingHist);
      window.removeEventListener("storage", loadRankingHist);
    };
  }, []);

  useEffect(() => {
    const fetchAllEvals = async () => {
      if (isSupabaseReady()) {
        try {
          setLoadingAllEvals(true);
          const data = await dbFetchYearEvaluations(activeYear);
          setAllEvaluationsOfYear(data);
        } catch (e) {
          console.error("Failed to load all evaluations of year in AdminRanking:", e);
        } finally {
          setLoadingAllEvals(false);
        }
      }
    };
    fetchAllEvals();
    
    // Refresh ranking state on external change too
    window.addEventListener("realtime-avaliacoes-update", fetchAllEvals);
    return () => {
      window.removeEventListener("realtime-avaliacoes-update", fetchAllEvals);
    };
  }, [activeYear, branches]);


  // Independent local state for filters in the Ranking screen
  const [localRankingMonth, setLocalRankingMonth] = useState<string>(activeMonth || "Janeiro");
  const [localAccumulatedFilter, setLocalAccumulatedFilter] = useState<"1_SEMESTRE" | "2_SEMESTRE" | "ANO_TODO">("1_SEMESTRE");

  const localCalendar = calendarData || (() => {
    try {
      const saved = localStorage.getItem("acandido_calendario_inventarios");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  })();

  const isAwaitingPair = (entry: UnifiedEntry | null) => {
    if (!entry || !entry.branches || entry.branches.length !== 2) return false;
    const b1 = entry.branches[0];
    const b2 = entry.branches[1];
    if (!b1 || !b2) return false;
    const crit1 = b1.criteria?.find(c => c.id === "10");
    const crit2 = b2.criteria?.find(c => c.id === "10");
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

    (allBranches || []).forEach((b) => {
      if (b && b.ownerName) {
        const config = ownersMap[b.ownerName];
        if (config) {
          config.branches.push(b);
        }
      }
    });

    const entries: UnifiedEntry[] = Object.entries(ownersMap).map(([ownerName, config]) => {
      // Combined semestralScore logic:
      // If there are multiple branches (twins), they already share identical pre-calculated consolidated semestral score.
      const score = (config.branches && config.branches.length > 0) ? (config.branches[0]?.semestralScore ?? 0) : 0;
      return {
        id: s(ownerName).toLowerCase(),
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
  const cycleStateParsed = cycleState || { activeMonth: activeMonth || "Janeiro", activeYear: activeYear || "2026", status: "ABERTO" };

  const MONTH_MAP: Record<string, number> = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
  };
  const activeMonthNum = MONTH_MAP[s(cycleStateParsed.activeMonth).toLowerCase()] || 6;
  const currentSemester = activeMonthNum <= 6 ? 1 : 2;
  const visibleCount = currentSemester === 1 ? activeMonthNum : activeMonthNum - 6;
  
  // Custom: Showing all 12 months in the dropdown as requested
  const monthsOfThisSemester = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const normalizeMonthName = (name: string): string => {
    return s(name).toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  // Bulletproof core solver: Score for specified entry in a specific month
  const getUnifiedScoreForMonth = (entry: UnifiedEntry, monthName: string): number => {
    if (!entry || !entry.branches || entry.branches.length === 0) return 0;

    const monthNum = MONTH_MAP[normalizeMonthName(monthName)];
    if (!monthNum) return 0;

    // Helper to calculate score for a single branch directly from the database rows in allEvaluationsOfYear
    const getSingleBranchScore = (branch: any): number => {
      if (!branch) return 0;
      const branchEvals = (allEvaluationsOfYear || []).filter((row) => {
        return Number(row.mes) === monthNum && matchBranch(row.almoxarifado || "", branch.id, branch.name);
      });

      return branchEvals.reduce((sum, row) => {
        return sum + (Number(row.pontuacao) || Number(row.pontos_obtidos) || 0);
      }, 0);
    };

    const score1 = getSingleBranchScore(entry.branches[0]);
    const score2 = entry.branches.length > 1 ? getSingleBranchScore(entry.branches[1]) : 0;

    // For twin/dupla garages, we use the score of one of them (or the max of them to be robust).
    // This strictly avoids summing them, dividing by 2, or making an average.
    return entry.branches.length >= 2 ? Math.max(score1, score2) : score1;
  };

  const getCriterionScoreForMonth = (
    entry: UnifiedEntry,
    monthName: string,
    criterionId: string
  ): { status: string; points: number } => {
    if (!entry || !entry.branches) return { status: "PENDENTE", points: 0 };
    
    // 1. If it's the currently active/selected month, we can use entry.branches directly!
    if (normalizeMonthName(monthName) === normalizeMonthName(activeMonth)) {
      if (entry.branches && entry.branches.length > 0) {
        const crit = entry.branches[0]?.criteria?.find((cs: any) => cs && cs.id === criterionId);
        if (crit) {
          return {
            status: crit.status || "PENDENTE",
            points: crit.pointsObtained ?? 0
          };
        }
      }
    }

    const branchIds = (entry.branches || []).map((b) => b?.id).filter(Boolean);
    const histEntries = Array.isArray(historyList) ? historyList : [];

    // Check history
    const matchingHist = histEntries.filter((h) => {
      if (!h || !h.branchId || !h.monthYear) return false;
      const isOurBranch = branchIds.includes(h.branchId);
      const isSameYear = h.monthYear.includes(activeYear);
      const isSameMonth = normalizeMonthName(h.monthYear).startsWith(normalizeMonthName(monthName));
      return isOurBranch && isSameYear && isSameMonth;
    });

    if (matchingHist.length > 0) {
      const refCriterion = entry.branches[0]?.criteria?.find((c) => c && c.id === criterionId);
      const pointsMax = refCriterion ? (refCriterion.pointsPossible ?? 0) : 0;

      if (entry.branches.length === 2) {
        // Find latest/first matching entry for each of the two branchIds
        const b1Id = entry.branches[0].id;
        const b2Id = entry.branches[1].id;
        const h1 = matchingHist.find((h) => h.branchId === b1Id);
        const h2 = matchingHist.find((h) => h.branchId === b2Id);

        if (h1 && h2) {
          const crit1 = h1.criteriaState?.find((cs: any) => cs && cs.id === criterionId);
          const crit2 = h2.criteriaState?.find((cs: any) => cs && cs.id === criterionId);
          const allOk = (crit1 && crit1.status === "OK") && (crit2 && crit2.status === "OK");
          const isAnyNok = (crit1 && crit1.status === "NOK") || (crit2 && crit2.status === "NOK");
          const statusText = isAnyNok ? "NOK" : (allOk ? "OK" : "PENDENTE");
          return { status: statusText, points: allOk ? pointsMax : 0 };
        }
        // Fallback if one of them is missing from history
        const singleH = h1 || h2;
        if (singleH) {
          const crit = singleH.criteriaState?.find((cs: any) => cs && cs.id === criterionId);
          const isOk = crit && crit.status === "OK";
          return { status: crit ? crit.status : "PENDENTE", points: isOk ? pointsMax : 0 };
        }
      } else {
        const singleH = matchingHist[0];
        if (singleH) {
          const crit = singleH.criteriaState?.find((cs: any) => cs && cs.id === criterionId);
          const isOk = crit && crit.status === "OK";
          return { status: crit ? crit.status : "PENDENTE", points: isOk ? pointsMax : 0 };
        }
      }
    }

    // 3. Dynamic evaluations from the database
    if (allEvaluationsOfYear && allEvaluationsOfYear.length > 0) {
      const monthNum = MONTH_MAP[normalizeMonthName(monthName)];
      if (monthNum) {
        const calculatedBranches = entry.branches.map((b) => {
          const dbRows = allEvaluationsOfYear.filter((row) => {
            return Number(row.mes) === monthNum && matchBranch(row.almoxarifado || "", b.id, b.name);
          });
          const dbMapped: Record<string, any> = {};
          dbRows.forEach((row) => {
            dbMapped[String(row.criterio_codigo)] = row;
          });

          const semester = monthNum <= 6 ? 1 : 2;

          // Compute dynamic calendar
          const branchCalendar = (localCalendar || []).filter(item => 
            (item.branchId === b.id || (!item.branchId && matchBranch(item.almoxarifado || "", b.id, b.name))) &&
            Number(item.ano) === Number(activeYear) &&
            Number(item.semestre) === semester
          );
          const evaluatedInventories = branchCalendar.filter(item => item.status === "OK" || item.status === "NOK");
          let invStatus = "PENDENTE";
          if (evaluatedInventories.length > 0) {
            const hasNok = evaluatedInventories.some(it => it.status === "NOK");
            const allOk = evaluatedInventories.every(it => it.status === "OK");
            invStatus = hasNok ? "NOK" : (allOk ? "OK" : "PENDENTE");
          }

          // Compute dynamic material sem mov
          let matStatus = "PENDENTE";
          let localMatSemMov: any[] = [];
          try {
            const saved = localStorage.getItem("acandido_material_sem_movimentacao");
            localMatSemMov = saved ? JSON.parse(saved) : [];
          } catch (e) {}
          const branchMatSem = (localMatSemMov || []).find(item => 
            matchBranch(item.almoxarifado || "", b.id, b.name) &&
            Number(item.ano) === Number(activeYear) &&
            Number(item.semestre) === semester
          );
          if (branchMatSem) {
            matStatus = branchMatSem.status || "PENDENTE";
          }

          // Build criteria status map
          const criteriaState = (b.criteria || []).map((c: any) => {
            let status = "PENDENTE";
            let pts = 0;
            if (c.id === "1") {
              status = invStatus;
              pts = status === "OK" ? 20 : (status === "PENDENTE" && evaluatedInventories.length > 0 ? 10 : 0);
            } else if (c.id === "10") {
              status = matStatus;
              pts = status === "OK" ? 5 : 0;
            } else {
              const row = dbMapped[c.id];
              status = row ? (row.resultado || "PENDENTE") : "PENDENTE";
              pts = status === "OK" ? (c.pointsPossible || 0) : 0;
            }
            return { id: c.id, status, pointsPossible: c.pointsPossible, pointsObtained: pts };
          });

          // Automate NF -> Recebimento
          const nfC = criteriaState.find(c => c.id === "3");
          if (nfC) {
            const recC = criteriaState.find(c => c.id === "5");
            if (recC) {
              recC.status = nfC.status;
              recC.pointsObtained = nfC.status === "OK" ? (recC.pointsPossible || 0) : 0;
            }
          }

          return { ...b, criteriaState };
        });

        const refC = entry.branches[0]?.criteria?.find((c) => c && c.id === criterionId);
        const pointsMax = refC ? (refC.pointsPossible ?? 0) : 0;

        if (calculatedBranches.length === 2) {
          const b1 = calculatedBranches[0];
          const b2 = calculatedBranches[1];
          const c1 = b1.criteriaState.find((c: any) => c.id === criterionId);
          const c2 = b2.criteriaState.find((c: any) => c.id === criterionId);
          if (c1 && c2) {
            const isNok = c1.status === "NOK" || c2.status === "NOK";
            const isBothOk = c1.status === "OK" && c2.status === "OK";
            const statusText = isNok ? "NOK" : (isBothOk ? "OK" : "PENDENTE");
            return { status: statusText, points: isBothOk ? pointsMax : 0 };
          }
        } else if (calculatedBranches.length === 1) {
          const b1 = calculatedBranches[0];
          const c1 = b1.criteriaState.find((c: any) => c.id === criterionId);
          if (c1) {
            return { status: c1.status, points: c1.status === "OK" ? pointsMax : 0 };
          }
        }
      }
    }

    return { status: "PENDENTE", points: 0 };
  };

  /**
   * CORREÇÃO 3: Helper function to fetch the exact status and points of a criterion for a specific branch in any given month.
   * This is used in the Side-by-Side comparison table of the detailed view to avoid mixing months or showing only current month.
   */
  const getBranchCriterionForMonth = (
    b: any,
    monthName: string,
    criterionId: string
  ): { status: string; points: number } => {
    if (!b) return { status: "PENDENTE", points: 0 };

    // 1. If it's the currently active/selected month, we use the branch's in-memory criteria state
    if (normalizeMonthName(monthName) === normalizeMonthName(activeMonth)) {
      const crit = b.criteria?.find((cs: any) => cs && cs.id === criterionId);
      if (crit) {
        const status = crit.rawStatus || crit.status || "PENDENTE";
        const points = crit.rawPointsObtained !== undefined ? crit.rawPointsObtained : (status === "OK" ? (crit.pointsPossible ?? 0) : 0);
        return { status, points };
      }
      return { status: "PENDENTE", points: 0 };
    }

    // 2. Check history list first
    const histEntries = Array.isArray(historyList) ? historyList : [];
    const matchingHist = histEntries.find((h) => {
      if (!h || !h.branchId || !h.monthYear) return false;
      const isOurBranch = h.branchId === b.id;
      const isSameYear = h.monthYear.includes(activeYear);
      const isSameMonth = normalizeMonthName(h.monthYear).startsWith(normalizeMonthName(monthName));
      return isOurBranch && isSameYear && isSameMonth;
    });

    if (matchingHist) {
      const crit = matchingHist.criteriaState?.find((cs: any) => cs && cs.id === criterionId);
      if (crit) {
        const status = crit.status || "PENDENTE";
        const points = crit.pointsObtained !== undefined ? crit.pointsObtained : (status === "OK" ? (crit.pointsPossible ?? 0) : 0);
        return { status, points };
      }
    }

    // 3. Dynamic evaluations from the database
    if (allEvaluationsOfYear && allEvaluationsOfYear.length > 0) {
      const monthNum = MONTH_MAP[normalizeMonthName(monthName)];
      if (monthNum) {
        const dbRows = allEvaluationsOfYear.filter((row) => {
          return Number(row.mes) === monthNum && matchBranch(row.almoxarifado || "", b.id, b.name);
        });

        if (criterionId === "1") {
          const semester = monthNum <= 6 ? 1 : 2;
          const branchCalendar = (calendarData || []).filter(item => 
            (item.branchId === b.id || (!item.branchId && matchBranch(item.almoxarifado || "", b.id, b.name))) &&
            Number(item.ano) === Number(activeYear) &&
            Number(item.semestre) === semester
          );
          const evaluatedInventories = branchCalendar.filter(item => item.status === "OK" || item.status === "NOK");
          let invStatus = "PENDENTE";
          if (evaluatedInventories.length > 0) {
            const hasNok = evaluatedInventories.some(it => it.status === "NOK");
            const allOk = evaluatedInventories.every(it => it.status === "OK");
            invStatus = hasNok ? "NOK" : (allOk ? "OK" : "PENDENTE");
          }
          const pts = invStatus === "OK" ? 20 : (invStatus === "PENDENTE" && evaluatedInventories.length > 0 ? 10 : 0);
          return { status: invStatus, points: pts };
        } else if (criterionId === "10") {
          const semester = monthNum <= 6 ? 1 : 2;
          let localMatSemMov: any[] = [];
          try {
            const saved = localStorage.getItem("acandido_material_sem_movimentacao");
            localMatSemMov = saved ? JSON.parse(saved) : [];
          } catch (e) {}
          const branchMatSem = (localMatSemMov || []).find(item => 
            matchBranch(item.almoxarifado || "", b.id, b.name) &&
            Number(item.ano) === Number(activeYear) &&
            Number(item.semestre) === semester
          );
          let matStatus = "PENDENTE";
          if (branchMatSem) {
            matStatus = branchMatSem.status || "PENDENTE";
          }
          return { status: matStatus, points: matStatus === "OK" ? 5 : 0 };
        } else {
          const row = dbRows.find(r => String(r.criterio_codigo) === criterionId);
          if (row) {
            const status = row.resultado || "PENDENTE";
            const refC = b.criteria?.find((c: any) => c.id === criterionId);
            const pointsPossible = refC ? (refC.pointsPossible || 0) : 0;
            return { status, points: status === "OK" ? pointsPossible : 0 };
          }
        }
      }
    }

    return { status: "PENDENTE", points: 0 };
  };

  const getHistoricalMonths = (entry: UnifiedEntry, filterToUse?: "1_SEMESTRE" | "2_SEMESTRE" | "ANO_TODO") => {
    const filter = filterToUse || localAccumulatedFilter;
    const months = filter === "1_SEMESTRE"
      ? ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN"]
      : filter === "2_SEMESTRE"
      ? ["JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
      : ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    const semMonthsMap: { [key: string]: string } = {
      "JAN": "Janeiro", "FEV": "Fevereiro", "MAR": "Março", "ABR": "Abril", "MAI": "Maio", "JUN": "Junho",
      "JUL": "Julho", "AGO": "Agosto", "SET": "Setembro", "OUT": "Outubro", "NOV": "Novembro", "DEZ": "Dezembro"
    };

    return months.map((m) => {
      const fullMonthName = semMonthsMap[m];
      return {
        month: m,
        val: getUnifiedScoreForMonth(entry, fullMonthName)
      };
    });
  };

  const getEntryScoreForMonth = (entry: UnifiedEntry, monthName: string) => {
    return getUnifiedScoreForMonth(entry, monthName);
  };

  const getFilteredAccumulatedMonths = () => {
    const allPeriodMonths = localAccumulatedFilter === "1_SEMESTRE"
      ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"]
      : localAccumulatedFilter === "2_SEMESTRE"
      ? ["Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
      : ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const activeYrNum = parseInt(activeYear) || 2026;
    const cycleYrNum = parseInt(cycleStateParsed.activeYear) || 2026;

    if (activeYrNum < cycleYrNum) {
      return allPeriodMonths;
    } else if (activeYrNum > cycleYrNum) {
      return allPeriodMonths;
    } else {
      return allPeriodMonths.filter((mName) => {
        const mNum = MONTH_MAP[normalizeMonthName(mName)];
        return mNum <= activeMonthNum;
      });
    }
  };

  const getEntryDisplayScore = (entry: UnifiedEntry) => {
    if (rankingMode === "MES") {
      return getEntryScoreForMonth(entry, localRankingMonth);
    } else {
      const months = localAccumulatedFilter === "1_SEMESTRE"
        ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"]
        : localAccumulatedFilter === "2_SEMESTRE"
        ? ["Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
        : ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      return months.reduce((sum, mName) => sum + getUnifiedScoreForMonth(entry, mName), 0);
    }
  };

  const calcularMetaMensal = (entry: UnifiedEntry, mes: string) => {
    // Base is 75 points (100 - 20 [inventario] - 5 [material sem movimentacao] = 75)
    let meta = 75;
    
    // We check if ANY of the branches of this entry has an inventory scheduled in this month
    const branchIds = (entry.branches || []).map(b => b?.id).filter(Boolean);
    const temInventario = localCalendar.some((c: any) => {
      if (!c || !c.data_agendada) return false;
      const cleanAlmox = s(c.almoxarifado).toLowerCase().trim();
      const isSameBranch = branchIds.includes(cleanAlmox) || branchIds.includes(s(c.branchId).toLowerCase());
      if (!isSameBranch) return false;

      const parts = c.data_agendada.split("-");
      if (parts.length !== 3) return false;
      const itemMonthNum = parseInt(parts[1], 10);

      const targetMonthNum = MONTH_MAP[normalizeMonthName(mes)];
      return targetMonthNum === itemMonthNum;
    });

    if (temInventario) {
      meta += 20;
    }

    const mesNum = MONTH_MAP[normalizeMonthName(mes)];
    if (mesNum === 6 || mesNum === 12) {
      meta += 5;
    }

    return meta;
  };

  const getEntryDisplayMaxForEntry = (entry: UnifiedEntry) => {
    if (rankingMode === "MES") {
      return 100;
    } else {
      return 600;
    }
  };

  const getEntryDisplayMax = (entry?: UnifiedEntry) => {
    if (rankingMode === "MES") {
      return 100;
    } else {
      return 600;
    }
  };

  const entriesWithDisplayScore = allEntries.map((e) => {
    const scoreVal = getEntryDisplayScore(e);
    return {
      ...e,
      semestralScore: scoreVal,
      displayScore: scoreVal
    };
  });

  const groupAEntries = entriesWithDisplayScore
    .filter((e) => e.group === "A")
    .sort((a, b) => b.displayScore - a.displayScore);

  const groupBEntries = entriesWithDisplayScore
    .filter((e) => e.group === "B")
    .sort((a, b) => b.displayScore - a.displayScore);

  const currentLeaderboard = activeGroupTab === "A" ? groupAEntries : groupBEntries;

  const hasRealHistory = (() => {
    // 1. Check if we have archived records in acandido_history
    if (historyList && historyList.filter((h: any) => h.monthYear).length > 0) {
      return true;
    }

    // 2. Check if there are active / closed / blocked cycle structures initialized
    try {
      const savedCycles = localStorage.getItem("acandido_all_cycles_list");
      if (savedCycles) {
        const parsed = JSON.parse(savedCycles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasActiveOrClosedCycle = parsed.some((c: any) => 
            c.status === "FECHADO" || c.status === "AGUARDANDO_FECHAMENTO" || c.status === "ABERTO"
          );
          if (hasActiveOrClosedCycle) return true;
        }
      }
    } catch (e) {}

    // 3. Check if there is any evaluated score currently greater than zero
    const anyScore = currentLeaderboard.some((item) => item.displayScore > 0);
    if (anyScore) return true;

    return false;
  })();

  // 1. ================= ALMOXARIFE (CONFIDENTIAL) VIEW =================
  if (user.role === "ALMOXARIFE") {
    const isGroupA = user.group === "A";
    const currentList = isGroupA ? groupAEntries : groupBEntries;

    const myEntryIdx = currentList.findIndex(
      (e) => s(e.ownerName).toLowerCase() === s(user.ownerName).toLowerCase()
    );
    const myPos = hasRealHistory && myEntryIdx !== -1 ? myEntryIdx + 1 : "—";
    const myEntry = currentList[myEntryIdx];
    const myScore = hasRealHistory && myEntry ? myEntry.semestralScore : 0;

    const firstPlaceScore = hasRealHistory ? (currentList[0]?.semestralScore || 0) : 0;
    const missingPoints = hasRealHistory ? Math.max(0, firstPlaceScore - myScore) : 0;

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

    // Get historical monthly data based on currently selected period filter
    const searchFilter = rankingMode === "MES"
      ? (["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"].includes(localRankingMonth) ? "1_SEMESTRE" : "2_SEMESTRE" as const)
      : localAccumulatedFilter;

    const monthlyVals = getHistoricalMonths(selectedEntry, searchFilter);

    // Filter to represent the months within the active selected range
    const monthsWithData = monthlyVals;

    const totalAccumulatedScore = monthsWithData.reduce((sum, d) => sum + d.val, 0);

    const sortedVals = [...monthsWithData].sort((a, b) => b.val - a.val);
    const bestMonth = sortedVals[0] || { month: "JUN", val: 100 };
    const worstMonth = sortedVals[sortedVals.length - 1] || { month: "JAN", val: 0 };

    // Compile dynamic performance scores per criterion based on selected period as requested
    const selectedMonths = rankingMode === "MES"
      ? [localRankingMonth]
      : localAccumulatedFilter === "1_SEMESTRE"
      ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"]
      : localAccumulatedFilter === "2_SEMESTRE"
      ? ["Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
      : ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const getUnifiedCriteriaList = (entry: UnifiedEntry) => {
      if (entry.branches.length === 0) return [];
      const referenceCriteria = entry.branches[0].criteria;
      
      return referenceCriteria.map((cRef) => {
        let totalPointsObtained = 0;
        let okMonthsCount = 0;

        selectedMonths.forEach((mName) => {
          const res = getCriterionScoreForMonth(entry, mName, cRef.id);
          totalPointsObtained += res.points;
          if (res.status === "OK") {
            okMonthsCount++;
          }
        });

        const maxPossibleInPeriod = cRef.pointsPossible * selectedMonths.length;
        const accuracy = maxPossibleInPeriod > 0 ? Math.round((totalPointsObtained / maxPossibleInPeriod) * 100) : 0;

        return {
          id: cRef.id,
          name: cRef.name,
          recurrence: cRef.recurrence,
          pointsPossible: cRef.pointsPossible,
          statusInPeriod: rankingMode === "MES" 
            ? getCriterionScoreForMonth(entry, localRankingMonth, cRef.id).status 
            : `${okMonthsCount} / ${selectedMonths.length} Meses OK`,
          pointsObtained: totalPointsObtained,
          okMonths: okMonthsCount,
          accuracy
        };
      });
    };

    const criteriaListWithConsistency = getUnifiedCriteriaList(selectedEntry).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));

    // Get total closed cycles in current semester to filter actual alerts/highlights
    const totalClosedCyclesInSemester = (() => {
      const histList = Array.isArray(historyList) ? historyList.filter((h: any) => h && h.monthYear) : [];
      const semMonthsList = currentSemester === 1
        ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"]
        : ["Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      
      const branchIds = (selectedEntry?.branches || []).map(b => b?.id).filter(Boolean);
      
      const uniqueMonthsWithArchive = new Set<string>();
      histList.forEach((h) => {
        if (h && h.branchId && branchIds.includes(h.branchId)) {
          const matchMonth = semMonthsList.find(mName => h.monthYear && s(h.monthYear).toLowerCase().startsWith(s(mName).toLowerCase()));
          if (matchMonth) {
            uniqueMonthsWithArchive.add(matchMonth);
          }
        }
      });
      return uniqueMonthsWithArchive.size;
    })();

    const top3Criteria = criteriaListWithConsistency.filter((c) => c && c.okMonths > 0).slice(0, 3);
    const bottomCriteria = criteriaListWithConsistency.filter((c) => c && c.okMonths < totalClosedCyclesInSemester).slice(-3);

    // Dynamic executive report
    const awaiting_pair = isAwaitingPair(selectedEntry);
    const executiveSummary = (() => {
      if (awaiting_pair) {
        return `O almoxarifado unificado ${selectedEntry.name} está aguardando a avaliação mútua do critério "Material Sem Movimentação" para consolidação final da pontuação semestral. Uma das garagens do par já foi avaliada, mas o ciclo só será consolidado quando as duas unidades estiverem avaliadas.`;
      }
      if (!hasRealHistory) {
        return `O almoxarifado unificado ${selectedEntry.name} ainda não possui ciclos consolidados neste semestre. Aguardando a finalização da primeira auditoria mensal pelo Auditor Geral Fernando Silva para compor o diagnóstico estratégico.`;
      }
      return `O almoxarifado unificado ${selectedEntry.name} acumulou ${selectedEntry.semestralScore} pts no semestre, superando a meta de corte de 300 pts. Seu melhor desempenho foi registrado em ${bestMonth.month} (${bestMonth.val} pts) e o critério com maior consistência ao longo do ciclo foi ${criteriaListWithConsistency[0]?.name || "TOP 10"}, registrando ${criteriaListWithConsistency[0]?.okMonths || 0} acertos em ${totalClosedCyclesInSemester} meses avaliados. O critério ${criteriaListWithConsistency[criteriaListWithConsistency.length - 1]?.name || "Nível de Serviço"} apresentou o maior número de ocorrências NOK (${totalClosedCyclesInSemester - (criteriaListWithConsistency[criteriaListWithConsistency.length - 1]?.okMonths || 0)} meses), sendo o principal ponto de atenção estratégica para o próximo semestre.`;
    })();

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
              {/* CORREÇÃO 3: Mostrar dados do mês filtrado ou acumulado conforme seleção */}
              {rankingMode === "MES" ? (
                <>
                  <p className="text-[9px] text-[#C8A84B] font-black uppercase font-mono tracking-wider">Pontuação de {localRankingMonth}</p>
                  <p className="text-xl font-mono font-black">{getUnifiedScoreForMonth(selectedEntry, localRankingMonth)} <span className="text-xs font-normal text-slate-400">/ 100</span></p>
                </>
              ) : (
                <>
                  <p className="text-[9px] text-[#C8A84B] font-black uppercase font-mono tracking-wider">Pontos Semestrais</p>
                  <p className="text-xl font-mono font-black">{selectedEntry.semestralScore} <span className="text-xs font-normal text-slate-400">/ 600</span></p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Side-by-Side Comparison for Double Garages */}
        {selectedEntry.branches.length === 2 && (() => {
          const targetMonth = rankingMode === "MES" ? localRankingMonth : activeMonth;
          return (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#1B2A4A] text-[18px]">compare</span>
                  Detalhamento Lado a Lado (Garagem Dupla) — {rankingMode === "MES" ? localRankingMonth : "Mês Selecionado"}
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
                      <th className="py-2.5 px-4 text-center">{s(selectedEntry.branches[0]?.name).replace("ALMOXARIFADO ", "")}</th>
                      <th className="py-2.5 px-4 text-center">{s(selectedEntry.branches[1]?.name).replace("ALMOXARIFADO ", "")}</th>
                      <th className="py-2.5 text-right font-black">Resultado Unificado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEntry.branches[0].criteria.map((c1) => {
                      const isShared = c1.id === "10";
                      let unifiedStatusText = "";
                      let unifiedStatusColor = "";

                      const b1 = selectedEntry.branches[0];
                      const b2 = selectedEntry.branches[1];
                      const res1 = getBranchCriterionForMonth(b1, targetMonth, c1.id);
                      const res2 = getBranchCriterionForMonth(b2, targetMonth, c1.id);

                      const status1 = res1.status;
                      const status2 = res2.status;
                      const pts1 = res1.points;
                      const pts2 = res2.points;
                      
                      if (isShared) {
                        const isNok = status1 === "NOK" || status2 === "NOK";
                        const isBothOk = status1 === "OK" && status2 === "OK";
                        if (isBothOk) {
                          unifiedStatusText = `OK (${c1.pointsPossible * 2} pts)`;
                          unifiedStatusColor = "bg-emerald-500 text-white";
                        } else if (isNok) {
                          unifiedStatusText = "NOK (0 pts)";
                          unifiedStatusColor = "bg-rose-600 text-white";
                        } else {
                          unifiedStatusText = "Pendente (0 pts)";
                          unifiedStatusColor = "bg-amber-400 text-slate-900";
                        }
                      } else {
                        const totalPtsObtained = pts1 + pts2;
                        const maxPts = c1.pointsPossible * 2;
                        
                        if (status1 === "OK" && status2 === "OK") {
                          unifiedStatusText = `OK (${totalPtsObtained} pts)`;
                          unifiedStatusColor = "bg-emerald-500 text-white";
                        } else if (status1 === "NOK" && status2 === "NOK") {
                          unifiedStatusText = "NOK (0 pts)";
                          unifiedStatusColor = "bg-rose-600 text-white";
                        } else if (status1 === "PENDENTE" && status2 === "PENDENTE") {
                          unifiedStatusText = "Pendente (0 pts)";
                          unifiedStatusColor = "bg-amber-400 text-[#1B2A4A] font-bold";
                        } else {
                          unifiedStatusText = `Parcial (${totalPtsObtained} / ${maxPts} pts)`;
                          unifiedStatusColor = "bg-indigo-500 text-white";
                        }
                      }

                      return (
                        <tr key={c1.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3">
                            <p className="text-xs font-extrabold text-[#1B2A4A]">{c1.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{c1.pointsPossible * 2} pts max</p>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-black ${
                              status1 === "OK" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              status1 === "NOK" ? "bg-rose-50 text-rose-700 border border-rose-200 font-extrabold" :
                              "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {status1}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-black ${
                              status2 === "OK" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              status2 === "NOK" ? "bg-rose-50 text-rose-700 border border-rose-200 font-extrabold" :
                              "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {status2}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className={`inline-block px-3 py-1 rounded text-xs font-black shadow-xs ${unifiedStatusColor}`}>
                              {unifiedStatusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {hasRealHistory ? (
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

                // CORREÇÃO 4: O gráfico exibe todos os 6 meses do período sem filtrar dados fictícios ou ocultar meses vazios.
                // Se não houver dados, exibe 0 para aquele mês.
                const monthsWithData = monthlyVals;

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
                      <th className="py-2.5 pb-2 text-center">STATUS NO PERÍODO</th>
                      <th className="py-2.5 pb-2 text-right">PONTOS OBTIDOS</th>
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
                              <span>{c.statusInPeriod}</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {c.id === "10" && awaiting_pair ? (
                              <span className="text-amber-600 font-black text-[10px] uppercase font-mono tracking-wider">Aguardando</span>
                            ) : (
                              <div className="inline-flex flex-col items-end">
                                <span className={`text-xs font-black font-mono ${textStyle}`}>{c.pointsObtained} pts</span>
                                <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                  <div className={`h-full ${pctStyle}`} style={{ width: `${c.accuracy}%` }}></div>
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
                      <p className="text-[10px] text-emerald-600 font-bold mt-1">Conquistou {c.okMonths} de {selectedMonths.length} no período</p>
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
                    const mostRecentNokMonth = (c.pointsObtained < c.pointsPossible * selectedMonths.length) ? "Inconformidade detectada" : "Ok";
                    return (
                      <div key={c.id} className="bg-white p-3 rounded-xl border border-amber-100 flex items-start gap-2.5 shadow-xs">
                        <span className="text-xl shrink-0">⚠️</span>
                        <div>
                          <p className="text-xs font-black text-slate-800 leading-tight">{c.name}</p>
                          <p className="text-[10px] text-amber-700 font-bold mt-1">NOK em {selectedMonths.length - c.okMonths} meses</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 italic">Status: {mostRecentNokMonth}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 bg-white rounded-xl text-center text-xs text-slate-500 italic border border-slate-105">
                    Nenhum critério com inconformidade este período!
                  </div>
                )}
              </div>
            </div>

            {/* BLOCO 5 - COMPARATIVO COM A META */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">adjust</span>
                Comparativo com a Meta
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500 font-bold">Nota do Período Unificada</span>
                  <span className="font-mono text-slate-800 font-black">{totalAccumulatedScore} pts</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold pb-2 border-b border-slate-50">
                  <span className="text-slate-500 font-bold">Meta Mínima no Período</span>
                  <span className="font-mono text-slate-800 font-black">{selectedMonths.length * 50} pts</span>
                </div>

                {totalAccumulatedScore >= selectedMonths.length * 50 ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs inline-block w-full font-bold space-y-1">
                    <p className="flex items-center gap-1.5 text-emerald-800">
                      <span className="material-symbols-outlined text-[#10B981] text-[16px] font-bold">check_circle</span>
                      Meta Atingida
                    </p>
                    <p className="text-[10.5px] font-normal leading-relaxed text-emerald-950">
                      ✅ Meta atingida — <strong>{totalAccumulatedScore - (selectedMonths.length * 50)} pts</strong> acima do mínimo.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-xs inline-block w-full font-bold space-y-1">
                    <p className="flex items-center gap-1.5 text-rose-850 font-bold">
                      <span className="material-symbols-outlined text-[#EF4444] text-[16px] font-bold">cancel</span>
                      Abaixo da Meta
                    </p>
                    <p className="text-[10.5px] font-normal leading-relaxed text-rose-955">
                      ⚠️ Abaixo da meta — <strong>faltam {(selectedMonths.length * 50) - totalAccumulatedScore} pts</strong> para atingir a qualificação do período mínima operacional.
                    </p>
                  </div>
                )}

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150/50 text-[10.5px] text-slate-500">
                  <span className="font-bold text-slate-700">Projeção: </span>
                  Se manter a média atual, encerrará o período com <strong>{totalAccumulatedScore} pts</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-6 text-center shadow-xs space-y-2">
            <span className="material-symbols-outlined text-amber-500 text-[28px]">info</span>
            <p className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider">Histórico de Fechamento Inexistente</p>
            <p className="text-[11px] text-slate-500 font-bold max-w-xl mx-auto leading-normal">
              Este almoxarifado não possui nenhum ciclo fechado neste semestre. Os blocos de 
              <strong> Evolução do Semestre, Desempenho por Critério, Destaques Positivos, Pontos de Atenção </strong> 
              e <strong> Comparativo com a Meta </strong> só serão exibidos a partir do momento em que existir pelo menos 1 ciclo fechado real.
            </p>
          </div>
        )}

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

      {/* Control panel for ranking selection and toggle mode */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Tipo de Ranking</label>
          <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-300 self-start">
            <button
              type="button"
              onClick={() => {
                setRankingMode("MES");
                setSelectedEntry(null);
              }}
              className={`px-4 py-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                rankingMode === "MES"
                  ? "bg-[#1B2A4A] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              Mês Selecionado
            </button>
            <button
              type="button"
              onClick={() => {
                setRankingMode("ACUMULADO");
                setSelectedEntry(null);
              }}
              className={`px-4 py-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                rankingMode === "ACUMULADO"
                  ? "bg-[#1B2A4A] text-white shadow-sm"
                  : "text-[#1B2A4A] hover:text-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">query_stats</span>
              Acumulado Anual
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[220px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Referência Temporária</label>
          {rankingMode === "MES" ? (
            <select
              value={localRankingMonth}
              onChange={(e) => {
                const newMonth = e.target.value;
                setLocalRankingMonth(newMonth);
                if (typeof setActiveMonth === "function") {
                  setActiveMonth(newMonth);
                }
                setSelectedEntry(null);
              }}
              className="bg-white border border-slate-250 p-2.5 text-xs font-black rounded-xl w-full text-slate-800 focus:outline-[#1B2A4A]"
            >
              {monthsOfThisSemester.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={localAccumulatedFilter}
              onChange={(e) => {
                setLocalAccumulatedFilter(e.target.value as any);
                setSelectedEntry(null);
              }}
              className="bg-white border border-slate-250 p-2.5 text-xs font-black rounded-xl w-full text-slate-800 focus:outline-[#1B2A4A]"
            >
              <option value="1_SEMESTRE">1º Semestre (Janeiro - Junho)</option>
              <option value="2_SEMESTRE">2º Semestre (Julho - Dezembro)</option>
              <option value="ANO_TODO">Ano Todo (Janeiro - Dezembro)</option>
            </select>
          )}
        </div>
      </div>

      {/* CLEAN RANKING ENTRIES LIST (NO RIGHT SIDEBAR FOR ENTIRE SYSTEM SCREEN) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
          <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider">
            Posições Consolidadas — Grupo {activeGroupTab}
          </h4>
          {rankingMode === "MES" && (
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Meta do Mês: 100 PTS
            </span>
          )}
        </div>

        <div className="space-y-3.5">
          {!hasRealHistory && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-xs font-semibold text-slate-500 animate-pulse">
               O ranking será calculated a partir do primeiro ciclo encerrado pelo auditor
             </div>
          )}

          {currentLeaderboard.map((item, index) => {
            const place = index + 1;
            const displayScore = item.displayScore;
            const maxPoints = getEntryDisplayMax(item);
            const isBelowGoal = displayScore < maxPoints;

            return (
              <div
                key={item.id}
                onClick={() => { setSelectedEntry(item); setChartSelectedIdx(null); }}
                className="bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between shadow-xs hover:shadow-md transition-all group cursor-pointer hover:border-[#1B2A4A]/40 active:scale-[0.99] gap-3"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 flex items-center justify-center font-black text-sm rounded-full shrink-0 ${
                    hasRealHistory && place === 1
                      ? "bg-amber-100 text-amber-800 border border-amber-300 shadow-xs"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {hasRealHistory ? `${place}º` : "—"}
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-[#1B2A4A] group-hover:text-amber-600 transition-colors">
                      {item.name}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Responsável: <span className="font-extrabold text-slate-700">{item.ownerName}</span> • <span className="italic font-bold">{item.location}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-200/50">
                  {hasRealHistory && (
                    <>
                      {/* CORREÇÃO 1 & CORREÇÃO 2: Regras de badges para Mês Selecionado vs Acumulado Anual */}
                      {rankingMode === "ACUMULADO" ? (
                        place === 1 ? (
                          <span className="bg-[#C8A84B] text-white font-black px-2.5 py-0.5 rounded text-[8px] uppercase tracking-widest shrink-0 shadow-xs">
                            👑 LÍDER
                          </span>
                        ) : (
                          displayScore < 300 ? (
                            <span className="bg-rose-600 text-white font-black px-2 py-0.5 rounded text-[8px] uppercase tracking-widest shrink-0 shadow-xs flex items-center gap-1">
                              🔴 ABAIXO DA META
                            </span>
                          ) : null
                        )
                      ) : (
                        // No Mês Selecionado (MES), mantemos apenas o 1º colocado como LÍDER dourado, sem badges de meta de 100 pontos.
                        place === 1 ? (
                          <span className="bg-[#C8A84B] text-white font-black px-2.5 py-0.5 rounded text-[8px] uppercase tracking-widest shrink-0 shadow-xs">
                            Líder
                          </span>
                        ) : null
                      )}
                    </>
                  )}

                  <div className="text-right min-w-[130px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-black text-[#1B2A4A] font-mono leading-none">
                        {displayScore}
                        <span className="text-[10px] font-normal text-slate-400 font-sans">/{maxPoints} pts</span>
                      </span>
                      {(() => {
                        if (!hasRealHistory) return null;
                        const targetMonthAbbrMap: { [key: string]: string } = {
                          "Janeiro": "JAN", "Fevereiro": "FEV", "Março": "MAR", "Abril": "ABR", "Maio": "MAI", "Junho": "JUN",
                          "Julho": "JUL", "Agosto": "AGO", "Setembro": "SET", "Outubro": "OUT", "novembro": "NOV", "dezembro": "DEZ"
                        };
                        const searchSem = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"].includes(localRankingMonth) ? "1_SEMESTRE" : "2_SEMESTRE";
                        const monthlyVals = getHistoricalMonths(item, searchSem);
                        const targetAbbr = targetMonthAbbrMap[localRankingMonth];
                        const activeIdx = monthlyVals.findIndex(mv => mv.month === targetAbbr);
                        const prevIdx = activeIdx > 0 ? activeIdx - 1 : -1;
                        const variation = (activeIdx >= 0 && prevIdx >= 0) ? (monthlyVals[activeIdx].val - monthlyVals[prevIdx].val) : 0;

                        if (variation > 0) {
                          return (
                            <span className="text-[10px] font-black text-emerald-600 shrink-0 font-sans">
                              ▲ +{variation}
                            </span>
                          );
                        } else if (variation < 0) {
                          return (
                            <span className="text-[10px] font-black text-rose-600 shrink-0 font-sans">
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
                        className={`h-full ${displayScore === 0 ? "bg-transparent" : ((rankingMode === "ACUMULADO" ? displayScore < 300 : false) ? "bg-rose-600" : "bg-emerald-500")}`}
                        style={{ width: `${displayScore === 0 ? 0 : Math.min(100, (displayScore / maxPoints) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Separator removed for Correction 1 */}
      </section>
    </div>
  );
}
