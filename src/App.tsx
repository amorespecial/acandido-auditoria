import React, { useState, useEffect } from "react";
import { Branch, AppUser, CriterionState } from "./types";
import { initialBranches } from "./mockData";
import { seedDatabaseIfEmpty, dbFetchEvaluations, dbSaveEvaluation, isSupabaseReady, dbFetchCycleState, dbSaveCycleState, dbFetchAllCycles, uploadFile, dbSubmitAlmoxarifeEvidence, dbFetchUsers, dbFetchSchedules, dbFetchHistory, dbSaveHistory, dbSalvarHistorico, dbFetchAllNonMovingSummaries } from "./supabaseService";
import { supabase, realtimeFlags } from "./supabaseClient";
import { useRealtimeSync } from "./useRealtimeSync";

// View components
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";
import AdminRanking from "./components/AdminRanking";
import AdminHistory from "./components/AdminHistory";
import AdminEvaluationDetail from "./components/AdminEvaluationDetail";
import AdminConfiguracoes from "./components/AdminConfiguracoes";
import AdminGarantiasPanel from "./components/AdminGarantiasPanel";
import AdminServicosPanel from "./components/AdminServicosPanel";

import AlmoxarifeHome from "./components/AlmoxarifeHome";
import AlmoxarifeContagem from "./components/AlmoxarifeContagem";
import AlmoxarifeLayout from "./components/AlmoxarifeLayout";
import AlmoxarifeUnimobin from "./components/AlmoxarifeUnimobin";
import AlmoxarifeNivelServico from "./components/AlmoxarifeNivelServico";
import AlmoxarifeGarantia from "./components/AlmoxarifeGarantia";
import AlmoxarifeHistorico from "./components/AlmoxarifeHistorico";
import SupervisorPanel from "./components/SupervisorPanel";

const safeStr = (val: any): string => {
  if (val === null || val === undefined) return "";
  return String(val);
};

const getInitialAuditMode = (branchId: string, ownerName: string, criterionId: string): "Presencial" | "A_Distancia" => {
  const bId = safeStr(branchId).toLowerCase();
  const owner = safeStr(ownerName).toLowerCase();
  const isRobsonOrLucas = owner === "robson" || owner === "lucas" || bId.includes("unitrans") || bId.includes("santa-maria") || bId.includes("fretamento-pb");
  if (isRobsonOrLucas && (criterionId === "2" || criterionId === "4")) {
    return "Presencial";
  }
  return "A_Distancia";
};

const getCleanDefaultBranches = () => {
  return initialBranches.map((b) => ({
    ...b,
    currentScore: 0,
    status: "PENDENTE" as const,
    scoreCategory: "Sem Nota Inicial" as const,
    criteria: b.criteria.map((c) => ({
      ...c,
      status: "AGUARDANDO ENVIO" as const,
      pointsObtained: 0,
      evidenceNotes: "",
      submittedPhotos: [],
      submittedAt: undefined,
      notes: "",
      nokEvidenceLinks: [],
      nokEvidenceLink: undefined,
      nokEvidenceDescription: undefined,
      top10AuditorQuantities: undefined,
      nokEvidenceFileName: undefined,
      nokEvidenceFileType: undefined,
      nokEvidenceFileData: undefined,
      auditMode: getInitialAuditMode(b.id, b.ownerName, c.id)
    }))
  }));
};

export default function App() {
  // Absolute General Reset of demonstration data to prepare for real cycles
  if (typeof window !== "undefined") {
    const resetKey = "acandido_general_clean_reset_v10_real";
    if (localStorage.getItem(resetKey) !== "true") {
      const savedUser = localStorage.getItem("acandido_app_user");
      const savedUsersList = localStorage.getItem("acandido_users");
      
      // Clear all mock data keys
      localStorage.removeItem("acandido_cycle_configs3");
      localStorage.removeItem("acandido_warranties");
      localStorage.removeItem("acandido_cycle_state_manual");
      localStorage.removeItem("acandido_all_cycles_list");
      localStorage.removeItem("acandido_calendario_inventarios");
      localStorage.removeItem("acandido_all_collab_profiles");
      
      // Remove any branch specific materials parados list
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("acandido_materials_parados_")) {
          localStorage.removeItem(k);
        }
      }

      // Delete all evaluations from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("acandido_evaluations_")) {
          localStorage.removeItem(k);
          i--;
        }
      }

      if (savedUser) localStorage.setItem("acandido_app_user", savedUser);
      if (savedUsersList) localStorage.setItem("acandido_users", savedUsersList);
      
      // Seed Janeiro 2026 as unique active open cycle
      const initialCycle = {
        activeMonth: "Janeiro",
        activeYear: "2026",
        status: "ABERTO",
        openedAt: "01/01/2026",
        openedBy: "Fernando Silva"
      };
      localStorage.setItem("acandido_cycle_state_manual", JSON.stringify(initialCycle));
      localStorage.setItem("acandido_all_cycles_list", JSON.stringify([initialCycle]));
      
      localStorage.setItem("acandido_localstorage_cleared", "true");
      localStorage.setItem(resetKey, "true");
      
      window.location.reload();
    }
  }

  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem("acandido_app_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [branches, setBranches] = useState<Branch[]>(() => {
    return getCleanDefaultBranches();
  });

  const [calendarData, setCalendarData] = useState<any[]>([]);

  const [allCycles, setAllCycles] = useState<Record<string, {
    activeMonth: string;
    activeYear: string;
    status: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM";
    openedAt?: string;
    openedBy?: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem("acandido_all_cycles_list");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const map: Record<string, any> = {};
          parsed.forEach((c) => {
            if (c.activeMonth && c.activeYear) {
              map[`${c.activeMonth}_${c.activeYear}`] = c;
            }
          });
          return map;
        }
      }
    } catch (e) {}
    return {
      "Janeiro_2026": {
        activeMonth: "Janeiro",
        activeYear: "2026",
        status: "ABERTO",
        openedAt: "01/01/2026",
        openedBy: "Fernando Silva"
      }
    };
  });

  // Admin routing states
  const [adminTab, setAdminTab] = useState<"PAINEL" | "RANKING" | "HISTORICO" | "CONFIGURI" | "GARANTIAS" | "SERVICOS">("PAINEL");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Centralized cycle state for Fernando Silva (default to ABERTO for Janeiro 2026 on first load)
  const [cycleState, setCycleState] = useState<{
    activeMonth: string;
    activeYear: string;
    status: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM";
    openedAt?: string;
    openedBy?: string;
  }>(() => {
    const saved = localStorage.getItem("acandido_cycle_state_manual");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      activeMonth: "Janeiro",
      activeYear: "2026",
      status: "ABERTO",
      openedAt: "01/01/2026",
      openedBy: "Fernando Silva"
    };
  });

  const [activeMonth, setActiveMonth] = useState<string>(() => {
    const saved = localStorage.getItem("acandido_cycle_state_manual");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.activeMonth) return parsed.activeMonth;
      } catch (e) {}
    }
    return "Janeiro";
  });

  const [activeYear, setActiveYear] = useState<string>(() => {
    const saved = localStorage.getItem("acandido_cycle_state_manual");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.activeYear) return parsed.activeYear;
      } catch (e) {}
    }
    return "2026";
  });

  const [loadedPeriod, setLoadedPeriod] = useState<{ month: string; year: string } | null>(null);

  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<"1" | "2">(() => {
    try {
      const saved = localStorage.getItem("acandido_cycle_state_manual");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeMonth) {
          const MONTH_MAP: Record<string, number> = {
            "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
            "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
          };
          const activeMonthNum = MONTH_MAP[safeStr(parsed.activeMonth).toLowerCase()] || 6;
          return activeMonthNum <= 6 ? "1" : "2";
        }
      }
    } catch {}
    return "1";
  });

  const handleUpdateCycleState = async (newStateOrFn: any) => {
    let next: any;
    if (typeof newStateOrFn === "function") {
      next = newStateOrFn(cycleState);
    } else {
      next = newStateOrFn;
    }

    setCycleState(next);
    localStorage.setItem("acandido_cycle_state_manual", JSON.stringify(next));

    // 1. Sync activeMonth/activeYear to match updated cycle if it is currently selected
    if (next.activeMonth) setActiveMonth(next.activeMonth);
    if (next.activeYear) setActiveYear(next.activeYear);

    // 2. Also update allCycles map!
    const key = `${next.activeMonth}_${next.activeYear}`;
    setAllCycles((prev) => {
      const updatedAll = { ...prev, [key]: next };
      const list = Object.values(updatedAll);
      localStorage.setItem("acandido_all_cycles_list", JSON.stringify(list));
      return updatedAll;
    });

    // 3. Save to database
    if (isSupabaseReady()) {
      try {
        await dbSaveCycleState(next);
      } catch (err) {
        console.error("Failed to sync cycle state to Supabase on explicit update:", err);
        setDbConnectionError(true);
      }
    }
  };

  // Lock Almoxarife view strictly to the currently open cycle (cycleState) loaded from database
  useEffect(() => {
    if (user && user.role === "ALMOXARIFE" && cycleState) {
      if (cycleState.activeMonth && activeMonth !== cycleState.activeMonth) {
        setActiveMonth(cycleState.activeMonth);
      }
      if (cycleState.activeYear && activeYear !== cycleState.activeYear) {
        setActiveYear(cycleState.activeYear);
      }
    }
  }, [user, cycleState, activeMonth, activeYear]);

  // Cycle configuration state map: key is "Mês_Ano" e.g. "Junho_2026"
  const [cycleConfigs, setCycleConfigs] = useState<Record<string, {
    configured: boolean;
    top10: Array<{ code: string; name: string }>;
    layoutLocation: string;
    materialParadoUploaded: boolean;
  }>>(() => {
    const saved = localStorage.getItem("acandido_cycle_configs3");
    return saved ? JSON.parse(saved) : {
      "Maio_2026": {
        configured: true,
        top10: [
          { code: "1080571", name: "BATERIA 180 AMP" },
          { code: "1050177", name: "KIT EMBREAGEM 1722" },
          { code: "1081086", name: "ALTERNADOR BOSCH 24V 150AMP" },
          { code: "1080901", name: "ALTERNADOR 24V 80 AMP" },
          { code: "1140356", name: "COMPRESSOR AR CONDICIONADO TM" },
          { code: "1091094", name: "TENSOR CORREIA ALTERNADOR MB O500" },
          { code: "1090604", name: "TURBINA 1721 EURO 5 NOVA" },
          { code: "1090667", name: "BOMBA DO ARLA EURO 5" },
          { code: "1091730", name: "BOMBA DO ARLA EURO 6" }
        ],
        layoutLocation: "Área de Peças Hidráulicas e Conectores de Ar (Prateleira C-H)",
        materialParadoUploaded: true
      }
    };
  });

  // Almoxarife routing states
  const [almoxarifeTab, setAlmoxarifeTab] = useState<"HOME" | "NIVEL_SERVICO" | "GARANTIA" | "HISTORICO">("HOME");
  const [activeSubscreen, setActiveSubscreen] = useState<string | null>(null);

  // Active branch context for the logged-in Almoxarife
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  // Database and LocalStorage Migration States
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [dbConnectionError, setDbConnectionError] = useState(false);
  const [showLiveUpdateToast, setShowLiveUpdateToast] = useState(false);

  const [allNonMovingSummaries, setAllNonMovingSummaries] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("acandido_material_sem_movimentacao");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    // Database seeding
    seedDatabaseIfEmpty();

    // Check for existing local storage data
    const hasLegacyData = localStorage.getItem("acandido_cycle_state_manual");
    const wasCleared = localStorage.getItem("acandido_localstorage_cleared") === "true";
    
    if (user && user.role === "ADMIN" && hasLegacyData && !wasCleared) {
      setShowMigrationModal(true);
    }
  }, [user]);

  // 1. Initial connection check and cycle load
  useEffect(() => {
    const checkConnectionAndLoadCycle = async () => {
      if (!isSupabaseReady()) {
        setDbConnectionError(true);
        return;
      }
      try {
        const { error } = await supabase.from('usuarios').select('id').limit(1);
        if (error) {
          console.error("Supabase initial connection error:", error);
          setDbConnectionError(true);
        } else {
          setDbConnectionError(false);
          try {
            const dbCycles = await dbFetchAllCycles();
            if (dbCycles && dbCycles.length > 0) {
              const map: Record<string, any> = {};
              dbCycles.forEach((c) => {
                map[`${c.activeMonth}_${c.activeYear}`] = c;
              });
              setAllCycles(map);
            }
          } catch (listErr) {
            console.error("Failed to load initial cycle list:", listErr);
          }
          try {
            const dbCycle = await dbFetchCycleState();
            if (dbCycle && dbCycle.status) {
              setCycleState(dbCycle);
              localStorage.setItem("acandido_cycle_state_manual", JSON.stringify(dbCycle));
              if (dbCycle.activeMonth) setActiveMonth(dbCycle.activeMonth);
              if (dbCycle.activeYear) setActiveYear(dbCycle.activeYear);
            }
          } catch (cycleErr) {
            console.error("Failed to load initial cycle state:", cycleErr);
          }
          try {
            const dbUsers = await dbFetchUsers();
            if (dbUsers) {
              localStorage.setItem("acandido_users", JSON.stringify(dbUsers));
              window.dispatchEvent(new Event("storage"));
            }
          } catch (usersErr) {
            console.error("Failed to load initial users in App.tsx:", usersErr);
          }
          try {
            const dbSchedules = await dbFetchSchedules();
            if (dbSchedules) {
              setCalendarData(dbSchedules);
            }
          } catch (calErr) {
            console.error("Failed to load initial schedules in App.tsx:", calErr);
          }
          try {
            const dbHistory = await dbFetchHistory();
            if (dbHistory) {
              localStorage.setItem("acandido_history", JSON.stringify(dbHistory));
              window.dispatchEvent(new Event("realtime-historico-update"));
            }
          } catch (histErr) {
            console.error("Failed to load initial history in App.tsx:", histErr);
          }
          try {
            const MONTH_MAP_INITIAL: Record<string, number> = {
              "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
              "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
            };
            const actMonthLower = activeMonth.toLowerCase();
            const activeMonthNum = MONTH_MAP_INITIAL[actMonthLower] || 6;
            const activeSemestre = activeMonthNum <= 6 ? 1 : 2;
            const activeYearNum = parseInt(activeYear) || 2026;

            const dbData = await dbFetchAllNonMovingSummaries(activeYearNum, activeSemestre);
            if (dbData && dbData.length > 0) {
              setAllNonMovingSummaries(dbData);
              localStorage.setItem("acandido_material_sem_movimentacao", JSON.stringify(dbData));
            }
          } catch (matsErr) {
            console.error("Failed to fetch initial materials parados summaries in App.tsx:", matsErr);
          }
        }
      } catch (err) {
        console.error("Supabase exception checking connection:", err);
        setDbConnectionError(true);
      }
    };
    checkConnectionAndLoadCycle();
  }, []);

  // 2. Centralized Realtime Sync hook for live state updates with anti-looping and instant feedback
  useRealtimeSync(async (payload) => {
    if (realtimeFlags.isLocalUpdate) return;

    // Show live update notification toast
    setShowLiveUpdateToast(true);
    const toastTimer = setTimeout(() => {
      setShowLiveUpdateToast(false);
    }, 2000);

    const { table } = payload;
    console.log(`[Realtime Global Sync App.tsx] Table changed: ${table}`);

    if (table === "ciclos") {
      try {
        const dbCycles = await dbFetchAllCycles();
        if (dbCycles) {
          const map: Record<string, any> = {};
          dbCycles.forEach((c) => {
            map[`${c.activeMonth}_${c.activeYear}`] = c;
          });
          setAllCycles(map);
        }
        const dbCycle = await dbFetchCycleState();
        if (dbCycle && dbCycle.status) {
          setCycleState(dbCycle);
          localStorage.setItem("acandido_cycle_state_manual", JSON.stringify(dbCycle));
          if (dbCycle.activeMonth) setActiveMonth(dbCycle.activeMonth);
          if (dbCycle.activeYear) setActiveYear(dbCycle.activeYear);
        }
      } catch (err) {
        console.error("Error reloading cycle state on realtime payload:", err);
      }
    } else if (
      table === "avaliacoes" ||
      table === "pontuacoes" ||
      table === "calendario_inventarios" ||
      table === "envios_almoxarife" ||
      table === "top10_config" ||
      table === "top10_envios" ||
      table === "nivel_servico" ||
      table === "garantias"
    ) {
      setRefetchTrigger((prev) => prev + 1);
    } else if (table === "usuarios") {
      try {
        const dbUsers = await dbFetchUsers();
        if (dbUsers) {
          localStorage.setItem("acandido_users", JSON.stringify(dbUsers));
          window.dispatchEvent(new Event("storage"));
        }
      } catch (err) {
        console.error("Error reloading users on database change:", err);
      }
    }
  }, [activeMonth, activeYear]);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const dbSchedules = await dbFetchSchedules();
        if (dbSchedules) {
          setCalendarData(dbSchedules);
        }
      } catch (e) {
        console.error("Failed to fetch schedules on refetchTrigger:", e);
      }
    };
    fetchSchedules();
  }, [refetchTrigger]);

  useEffect(() => {
    const fetchNonMovingSummaries = async () => {
      try {
        const MONTH_MAP_RELOAD: Record<string, number> = {
          "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
          "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
        };
        const actMonthLower = activeMonth.toLowerCase();
        const activeMonthNum = MONTH_MAP_RELOAD[actMonthLower] || 6;
        const activeSemestre = activeMonthNum <= 6 ? 1 : 2;
        const activeYearNum = parseInt(activeYear) || 2026;

        const dbData = await dbFetchAllNonMovingSummaries(activeYearNum, activeSemestre);
        if (dbData) {
          setAllNonMovingSummaries(dbData);
          localStorage.setItem("acandido_material_sem_movimentacao", JSON.stringify(dbData));
        }
      } catch (e) {
        console.error("Failed to fetch non moving summaries active period trigger:", e);
      }
    };
    fetchNonMovingSummaries();

    window.addEventListener("realtime-material-sem-mov-update", fetchNonMovingSummaries);
    return () => {
      window.removeEventListener("realtime-material-sem-mov-update", fetchNonMovingSummaries);
    };
  }, [refetchTrigger, activeMonth, activeYear]);

  useEffect(() => {
    const updateHistoryFromDb = async () => {
      try {
        const dbHistory = await dbFetchHistory();
        if (dbHistory) {
          localStorage.setItem("acandido_history", JSON.stringify(dbHistory));
          window.dispatchEvent(new Event("storage"));
        }
      } catch (e) {
        console.error("Failed to fetch history on realtime trigger:", e);
      }
    };
    window.addEventListener("realtime-historico-update", updateHistoryFromDb);
    return () => {
      window.removeEventListener("realtime-historico-update", updateHistoryFromDb);
    };
  }, []);

  const handleClearLegacyLocalStorage = () => {
    const savedUser = localStorage.getItem("acandido_app_user");
    localStorage.clear();
    if (savedUser) {
      localStorage.setItem("acandido_app_user", savedUser);
    }
    localStorage.setItem("acandido_localstorage_cleared", "true");
    setShowMigrationModal(false);
    alert("Dados locais removidos com sucesso! Todo novo dado agora é salvo diretamente no Supabase.");
    window.location.reload();
  };

  // Dynamic Supabase ratings loader for current month & year
  useEffect(() => {
    const fetchEvaluationsFromSupabase = async () => {
      const defaultBranches = getCleanDefaultBranches();
      
      let evaluationsMap: Record<string, any> = {};
      let loadedFromSupabase = false;

      if (isSupabaseReady()) {
        try {
          console.log('[DEBUG] Iniciando carregamento de avaliações para:', activeMonth, activeYear);
          
          // Test direct fetch exact count of total avaliacoes rows to verify RLS
          const { data: testCount, error: testErr } = await supabase
            .from('avaliacoes')
            .select('count', { count: 'exact', head: true });
          console.log('[DEBUG] Conectividade da tabela avaliacoes:', { testCount, testErr });

          const results = await Promise.all(
            defaultBranches.map(async (branch) => {
              const dbVals = await dbFetchEvaluations(branch.name, activeMonth, activeYear);
              console.log(`[DEBUG] Filial ${branch.name} (${branch.id}): ${Object.keys(dbVals).length} avaliações encontradas`);
              return { branchName: branch.name, evals: dbVals };
            })
          );
          results.forEach(({ branchName, evals }) => {
            if (Object.keys(evals).length > 0) {
              evaluationsMap[branchName] = evals;
              loadedFromSupabase = true;
            }
          });
        } catch (err) {
          console.error("[DEBUG] Falha catastrófica ao buscar avaliações do Supabase:", err);
        }
      } else {
        console.warn('[DEBUG] Supabase não configurado ou URL/Key ausentes.');
      }

      // No localStorage loading / fallback - evaluations must be fetched from Supabase strictly to ensure same data across sessions

      const updatedBranches = defaultBranches.map((branch) => {
        const dbEvaluations = evaluationsMap[branch.name];
        if (!dbEvaluations || Object.keys(dbEvaluations).length === 0) {
          console.log(`[DEBUG] Branch ${branch.name}: Sem avaliações registradas no Supabase para ${activeMonth}/${activeYear}`);
          return branch;
        }

        const mergedCriteria = branch.criteria.map((crt) => {
          const matchedDb = dbEvaluations[crt.id];
          if (matchedDb) {
            return {
              ...crt,
              status: matchedDb.status || crt.status,
              pointsObtained: matchedDb.pointsObtained !== undefined ? matchedDb.pointsObtained : crt.pointsObtained,
              notes: matchedDb.notes || crt.notes,
              evidenceNotes: matchedDb.evidenceNotes || crt.evidenceNotes,
              nokEvidenceLinks: matchedDb.nokEvidenceLinks || crt.nokEvidenceLinks,
              nokEvidenceLink: matchedDb.nokEvidenceLink || crt.nokEvidenceLink,
              nokEvidenceDescription: matchedDb.nokEvidenceDescription || crt.nokEvidenceDescription,
              top10AuditorQuantities: matchedDb.top10AuditorQuantities || crt.top10AuditorQuantities,
              nokEvidenceFileName: matchedDb.nokEvidenceFileName || crt.nokEvidenceFileName,
              nokEvidenceFileType: matchedDb.nokEvidenceFileType || crt.nokEvidenceFileType,
              nokEvidenceFileData: matchedDb.nokEvidenceFileData || crt.nokEvidenceFileData,
              isAguardandoRealizacao: matchedDb.isAguardandoRealizacao !== undefined ? matchedDb.isAguardandoRealizacao : crt.isAguardandoRealizacao,
              auditMode: matchedDb.auditMode !== undefined ? matchedDb.auditMode : crt.auditMode
            };
          }
          return crt;
        });

        // CRÍTICO: somar os pontos AQUI
        const scoreTotal = mergedCriteria.reduce(
          (acc, c) => acc + (c.status === "OK" ? Number(c.pointsPossible) : (Number(c.pointsObtained) || 0)), 0
        );

        console.log(`[DEBUG] Branch ${branch.name} score final calculado: ${scoreTotal}`);

        const { score, status, scoreCategory } = calculateDerivedMetrics(mergedCriteria);

        return {
          ...branch,
          criteria: mergedCriteria,
          currentScore: scoreTotal,           // ← atualiza o card
          pointsObtainedSum: scoreTotal,       // ← atualiza o card (ambas as propriedades)
          status,
          scoreCategory
        };
      });

      setBranches(updatedBranches);
      setLoadedPeriod({ month: activeMonth, year: activeYear });
    };

    fetchEvaluationsFromSupabase();
  }, [activeMonth, activeYear, refetchTrigger, user]);

  // Real-time listener for evaluations updates & debug channel
  useEffect(() => {
    // 1. Listen to global realtime dispatch event
    const handleRealtimeUpdate = () => {
      console.log("[REALTIME] Event 'realtime-avaliacoes-update' detected! Refreshing scores...");
      setRefetchTrigger((prev) => prev + 1);
    };

    window.addEventListener("realtime-avaliacoes-update", handleRealtimeUpdate);
    window.addEventListener("realtime-ciclos-update", handleRealtimeUpdate);

    // 2. Direct debug subscription as requested
    let debugChannel: any = null;
    if (isSupabaseReady()) {
      debugChannel = supabase.channel('debug-avaliacoes')
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'avaliacoes'
        }, (payload) => {
          console.log('[REALTIME] Avaliação atualizada:', payload);
          setRefetchTrigger((prev) => prev + 1);
        })
        .subscribe((status) => {
          console.log('[REALTIME] Status da conexão:', status);
        });
    }

    return () => {
      window.removeEventListener("realtime-avaliacoes-update", handleRealtimeUpdate);
      window.removeEventListener("realtime-ciclos-update", handleRealtimeUpdate);
      if (debugChannel) {
        try {
          supabase.removeChannel(debugChannel);
        } catch (err) {
          console.error("Error removing debug channel:", err);
        }
      }
    };
  }, []);

  // Diagnostic useEffect to verify live Supabase data connectivity in Production
  useEffect(() => {
    const testarSupabase = async () => {
      if (!isSupabaseReady()) {
        console.log('[PROD DEBUG] Supabase is NOT ready. Missing or placeholder credentials.');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('avaliacoes')
          .select('count', { count: 'exact', head: true })
          .limit(1);
        console.log('[PROD DEBUG] Supabase avaliacoes count:', { data, error });
        
        const { data: data2, error: error2 } = await supabase
          .from('ciclos')
          .select('*')
          .eq('status', 'ABERTO')
          .limit(1);
        console.log('[PROD DEBUG] Ciclo ativo:', { data2, error2 });
      } catch (err) {
        console.error('[PROD DEBUG] Error running diagnostics:', err);
      }
    };
    testarSupabase();
  }, [user]);

  // Real-time synchronization of configurations (Users, Almoxarifados, Cycles)
  useEffect(() => {
    const handleSync = () => {
      // 2. Sync cycleState
      const storedCycle = localStorage.getItem("acandido_cycle_state_manual");
      if (storedCycle) {
        try {
          const parsed = JSON.parse(storedCycle);
          if (JSON.stringify(parsed) !== JSON.stringify(cycleState)) {
            setCycleState(parsed);
          }
        } catch (e) {}
      }

      // 3. Sync cycleConfigs
      const storedConfigs = localStorage.getItem("acandido_cycle_configs3");
      if (storedConfigs) {
        try {
          const parsed = JSON.parse(storedConfigs);
          if (JSON.stringify(parsed) !== JSON.stringify(cycleConfigs)) {
            setCycleConfigs(parsed);
          }
        } catch (e) {}
      }

      // 4. Sync current user if changed/suspended/deleted
      const storedUser = localStorage.getItem("acandido_app_user");
      const storedUsersList = localStorage.getItem("acandido_users");
      if (storedUser && storedUsersList) {
        try {
          const currentUser = JSON.parse(storedUser);
          const usersList = JSON.parse(storedUsersList);
          const matched = usersList.find((u: any) => u.email.toLowerCase() === currentUser.email.toLowerCase());
          if (matched) {
            if (matched.status === "SUSPENSO") {
              setUser(null);
              localStorage.removeItem("acandido_app_user");
              alert("Sua conta foi suspensa temporariamente pelo Auditor Geral Fernando Silva.");
            } else if (JSON.stringify(matched) !== JSON.stringify(currentUser)) {
              setUser(matched);
              localStorage.setItem("acandido_app_user", JSON.stringify(matched));
            }
          } else {
            // Deleted
            if (currentUser.email !== "estoque01jp@gmail.com") {
              setUser(null);
              localStorage.removeItem("acandido_app_user");
              alert("Sua conta foi desativada ou removida pelo Auditor Geral.");
            }
          }
        } catch (e) {}
      }
    };

    window.addEventListener("storage", handleSync);
    window.addEventListener("focus", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, [cycleState, cycleConfigs]);

  // Keep localStorage manual state in sync with current cycleState without triggering state updates or saving to the database
  useEffect(() => {
    localStorage.setItem("acandido_cycle_state_manual", JSON.stringify(cycleState));
  }, [cycleState]);

  useEffect(() => {
    localStorage.setItem("acandido_cycle_configs3", JSON.stringify(cycleConfigs));
  }, [cycleConfigs]);

  // Sync user state to local storage and active branch defaults
  useEffect(() => {
    if (user === null) {
      localStorage.removeItem("acandido_app_user");
      setActiveBranchId(null);
    } else {
      localStorage.setItem("acandido_app_user", JSON.stringify(user));
      
      // Compute default active branch for Almoxarife
      if (user.role === "ALMOXARIFE") {
        const uBranches = branches.filter(
          (b) => {
            if (user.email === "robson.almoxarife@acandidogrupo.com.br") {
              return b.id.includes("jaboatao") || b.ownerName === "Sérgio";
            }
            return safeStr(b.ownerName).toLowerCase() === safeStr(user.ownerName).toLowerCase();
          }
        );
        if (uBranches.length > 0) {
          // Default to the first managed branch if none is active or is out of bounds
          if (!activeBranchId || !uBranches.some((b) => b.id === activeBranchId)) {
            setActiveBranchId(uBranches[0].id);
          }
        }
      } else {
        setActiveBranchId(null);
      }
    }
  }, [user, branches]);

  // Helper score categorization logic
  const calculateDerivedMetrics = (criteria: CriterionState[]) => {
    const active = criteria.map(c => {
      const isOk = c.status === "OK";
      return {
        ...c,
        pointsObtained: isOk ? c.pointsPossible : 0
      };
    });

    const obtained = active.reduce((sum, c) => sum + c.pointsObtained, 0);
    const ratio = obtained; // out of always 100 max potential points

    let scoreCategory: Branch["scoreCategory"] = "Excelente";
    let status: Branch["status"] = "OK";

    if (ratio >= 85) {
      scoreCategory = "Excelente";
      status = "OK";
    } else if (ratio >= 70) {
      scoreCategory = "Bom";
      status = "PENDENTE";
    } else if (ratio >= 60) {
      scoreCategory = "Médio";
      status = "PENDENTE";
    } else {
      scoreCategory = "Abaixo da Meta";
      status = "NOK";
    }

    return { score: ratio, status, scoreCategory };
  };

  // Automatic Reopen and Restore of Janeiro 2026 if closed/archived (Disabled to allow persistent closed cycle states)
  useEffect(() => {
    const revertKey = "acandido_revert_janeiro_2026_v4";
    // Disabled to prevent overwriting closed/archived cycles when re-entering or logging in
    if (false && localStorage.getItem(revertKey) !== "true") {
      const restoreJaneiroFlow = async () => {
        let historyList: any[] = [];
        if (isSupabaseReady()) {
          try {
            historyList = await dbFetchHistory();
          } catch (e) {
            console.error("Failed to fetch history during restore auto-check:", e);
          }
        }
        if (!historyList || historyList.length === 0) {
          const savedHistory = localStorage.getItem("acandido_history");
          if (savedHistory) {
            try {
              historyList = JSON.parse(savedHistory);
              if (!Array.isArray(historyList)) historyList = [];
            } catch (e) {
              historyList = [];
            }
          }
        }

        const defaultBranches = getCleanDefaultBranches();
        setBranches(defaultBranches);

        // Now set the cycle state back to Janeiro 2026 ABERTO
        const restoredCycle = {
          activeMonth: "Janeiro",
          activeYear: "2026",
          status: "ABERTO" as const,
          openedAt: "01/01/2026",
          openedBy: "Fernando Silva"
        };
        localStorage.setItem("acandido_cycle_state_manual", JSON.stringify(restoredCycle));
        setCycleState(restoredCycle);
        setActiveMonth("Janeiro");
        setActiveYear("2026");

        // Update cycles list to make Janeiro 2026 active and Fevereiro 2026 inactive
        let allCyclesList: any[] = [];
        const savedCycles = localStorage.getItem("acandido_all_cycles_list");
        if (savedCycles) {
          try {
            allCyclesList = JSON.parse(savedCycles);
            if (!Array.isArray(allCyclesList)) allCyclesList = [];
          } catch (e) {
            allCyclesList = [];
          }
        }

        let janeiroFound = false;
        let fevereiroFound = false;
        allCyclesList = allCyclesList.map((c) => {
          if (c.activeMonth === "Janeiro" && c.activeYear === "2026") {
            janeiroFound = true;
            return { ...c, status: "ABERTO" as const };
          }
          if (c.activeMonth === "Fevereiro" && c.activeYear === "2026") {
            fevereiroFound = true;
            return { ...c, status: "NENHUM" as const };
          }
          return c;
        });

        if (!janeiroFound) {
          allCyclesList.push(restoredCycle);
        }
        if (!fevereiroFound) {
          allCyclesList.push({
            activeMonth: "Fevereiro",
            activeYear: "2026",
            status: "NENHUM" as const,
            openedAt: new Date().toLocaleDateString("pt-BR"),
            openedBy: "Fernando Silva"
          });
        }

        localStorage.setItem("acandido_all_cycles_list", JSON.stringify(allCyclesList));
        
        const newCyclesMap: Record<string, any> = {};
        allCyclesList.forEach((c) => {
          if (c.activeMonth && c.activeYear) {
            newCyclesMap[`${c.activeMonth}_${c.activeYear}`] = c;
          }
        });
        setAllCycles(newCyclesMap);

        // Filter January 2026 out of the historical logs so they are active and not represented as closed in consolidation
        const filteredHistoryList = historyList.filter(
          (entry) => entry.monthYear !== "Janeiro 2026"
        );
        localStorage.setItem("acandido_history", JSON.stringify(filteredHistoryList));
        if (isSupabaseReady()) {
          try {
            await dbSaveHistory(filteredHistoryList);
          } catch (e) {
            console.error("Failed to save filtered history list to Supabase:", e);
          }
        }

        // Reset any calendar scheduled events inside Janeira 2026 to PENDENTE
        let calendarData: any[] = [];
        const savedCal = localStorage.getItem("acandido_calendario_inventarios");
        if (savedCal) {
          try {
            calendarData = JSON.parse(savedCal);
            if (Array.isArray(calendarData)) {
              calendarData = calendarData.map((item: any) => {
                let isJan = false;
                if (item.data_agendada) {
                  const parts = item.data_agendada.split("-");
                  if (parts.length >= 2 && parseInt(parts[1]) === 1) {
                    isJan = true;
                  }
                }
                if (isJan && item.status !== "PENDENTE") {
                  return {
                    ...item,
                    status: "PENDENTE",
                    nokEvidenceLink: ""
                  };
                }
                return item;
              });
              localStorage.setItem("acandido_calendario_inventarios", JSON.stringify(calendarData));
            }
          } catch (e) {
            console.error("Failed to restore calendar items:", e);
          }
        }

        // Mark the revert as done
        localStorage.setItem(revertKey, "true");
        
        // Force a single clean reload to ensure state is completely rebuilt
        window.location.reload();
      };

      restoreJaneiroFlow();
    }
  }, []);

  // 1. Process branches dynamically on the fly to support automatic simulated cycles, deadlines & automation
  const currentConfigKey = `${activeMonth}_${activeYear}`;
  const isMonthOpen = (() => {
    const key = `${activeMonth}_${activeYear}`;
    const match = allCycles[key];
    return match ? match.status === "ABERTO" : false;
  })();
  const currentConfig = cycleConfigs[currentConfigKey] || {
    configured: isMonthOpen,
    top10: [
      { code: "1080571", name: "BATERIA 180 AMP" },
      { code: "1050177", name: "KIT EMBREAGEM 1722" },
      { code: "1081086", name: "ALTERNADOR BOSCH 24V 150AMP" },
      { code: "1080901", name: "ALTERNADOR 24V 80 AMP" },
      { code: "1140356", name: "COMPRESSOR AR CONDICIONADO TM" },
      { code: "1091094", name: "TENSOR CORREIA ALTERNADOR MB O500" },
      { code: "1090604", name: "TURBINA 1721 EURO 5 NOVA" },
      { code: "1090667", name: "BOMBA DO ARLA EURO 5" },
      { code: "1091730", name: "BOMBA DO ARLA EURO 6" }
    ],
    layoutLocation: "Área de Peças Hidráulicas e Conectores de Ar (Prateleira C-H)",
    materialParadoUploaded: true
  };

  const processedBranches = (() => {
    const MONTH_MAP: Record<string, number> = {
      "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
      "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
    };

    const actMonthLower = activeMonth.toLowerCase();
    const activeMonthNum = MONTH_MAP[actMonthLower] || 6;
    const activeSemestre = activeMonthNum <= 6 ? 1 : 2;
    const activeYearNum = parseInt(activeYear) || 2026;

    // Load calendar data
    const localCalendar = calendarData;

    // Load material sem movimentacao data
    let localMatSemMov: any[] = allNonMovingSummaries;
    if (!localMatSemMov || localMatSemMov.length === 0) {
      try {
        const saved = localStorage.getItem("acandido_material_sem_movimentacao");
        localMatSemMov = saved ? JSON.parse(saved) : [];
      } catch (e) {}
    }

    const matchBranch = (almoxName: string, bId: string, bName?: string) => {
      const name = almoxName.toLowerCase().trim();
      const branchId = bId.toLowerCase().trim();
      
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

    // Stage 1: Build base metrics for each individual branch
    const tempBranches = branches.map((b) => {
      let currentCriteria = b.criteria;

      // Calculate Inventário Criterion ("1") Values
      const branchCalendar = localCalendar.filter(item => 
        (item.branchId === b.id || (!item.branchId && matchBranch(item.almoxarifado, b.id, b.name))) &&
        item.ano === activeYearNum &&
        item.semestre === activeSemestre
      );

      const isInventarioScheduledThisMonth = branchCalendar.some(item => {
        if (!item.data_agendada) return false;
        const pts = item.data_agendada.split("-");
        if (pts.length < 2) return false;
        return parseInt(pts[1]) === activeMonthNum;
      });

      const evaluatedInventories = branchCalendar.filter(item => item.status === "OK" || item.status === "NOK");
      const isAnyInventarioEvaluated = evaluatedInventories.length > 0;

      let invPointsPossible = 20;
      let invPointsObtained = 0;
      let invStatus: any = "PENDENTE";
      let invNotes = "";
      let isAguardandoRealizacao = false;

      // Extract scheduled months to determine if active month is prior to scheduled
      const scheduledMonths = branchCalendar
        .map(item => {
          if (!item.data_agendada) return null;
          const pts = item.data_agendada.split("-");
          return pts.length >= 2 ? parseInt(pts[1]) : null;
        })
        .filter((m): m is number => m !== null);
      const minScheduledMonth = scheduledMonths.length > 0 ? Math.min(...scheduledMonths) : null;

      // Formatting helper for scheduled dates
      const datesText = branchCalendar
        .map(item => {
          if (!item.data_agendada) return "";
          const pts = item.data_agendada.split("-");
          return pts.length >= 3 ? `${pts[2]}/${pts[1]}` : "";
        })
        .filter(Boolean)
        .join(", ");

      if (isAnyInventarioEvaluated) {
        // Semestral Rule: If any is NOK, whole semester is NOK (0 pts). Else if evaluated OK, whole semester is OK (20 pts).
        const hasNok = evaluatedInventories.some(it => it.status === "NOK");
        const allOk = evaluatedInventories.length > 0 && evaluatedInventories.every(it => it.status === "OK");

        if (hasNok) {
          invPointsPossible = 20;
          invPointsObtained = 0;
          invStatus = "NOK";
          invNotes = "Inventário realizado: não conforme (NOK).";
        } else if (allOk) {
          invPointsPossible = 20;
          invPointsObtained = 20;
          invStatus = "OK";
          invNotes = "Inventário realizado conforme!";
        } else {
          invPointsPossible = 20;
          invPointsObtained = 10;
          invStatus = "PENDENTE";
          invNotes = "Inventário parcial de semestre.";
        }
      } else {
        // Not evaluated yet
        invStatus = "PENDENTE";
        isAguardandoRealizacao = true;
        invPointsPossible = 20;
        invPointsObtained = 0;
        invNotes = "Aguardando realização do inventário";
      }

      // Calculate Material Sem Movimentação Criterion ("10") Values
      const branchMatSem = localMatSemMov.find(item => 
        matchBranch(item.almoxarifado || "", b.id, b.name) &&
        item.ano === activeYearNum &&
        item.semestre === activeSemestre
      );

      let matPointsPossible = 5;
      let matPointsObtained = 0;
      let matStatus: any = "PENDENTE";
      let isAguardandoFechamento = false;

      if (branchMatSem) {
        if (branchMatSem.status === "OK") {
          matStatus = "OK";
          matPointsObtained = 5;
        } else if (branchMatSem.status === "NOK") {
          matStatus = "NOK";
          matPointsObtained = 0;
        } else {
          matStatus = "PENDENTE";
          matPointsObtained = 0;
          isAguardandoFechamento = true;
        }
      } else {
        matStatus = "PENDENTE";
        matPointsObtained = 0;
        isAguardandoFechamento = true;
      }

      // Overwrite dynamic criteria inside currentCriteria
      currentCriteria = currentCriteria.map((c) => {
        if (c.id === "1") {
          return {
            ...c,
            pointsPossible: invPointsPossible,
            pointsObtained: invPointsObtained,
            status: invStatus,
            notes: invNotes,
            isAguardandoRealizacao
          };
        }
        if (c.id === "10") {
          return {
            ...c,
            pointsPossible: matPointsPossible,
            pointsObtained: matPointsObtained,
            status: matStatus,
            isAguardandoFechamento
          };
        }
        return c;
      });

      // B. Automate "05 - Recebimento de Material" following "03 - Nota Fiscal"
      const realNf = currentCriteria.find((c) => c.id === "3");
      if (realNf) {
        currentCriteria = currentCriteria.map((c) => {
          if (c.id === "5") {
            return {
              ...c,
              status: realNf.status,
              pointsObtained: realNf.status === "OK" ? c.pointsPossible : 0,
              notes: realNf.notes ? `Automático: Seguindo Nota Fiscal. Obs: ${realNf.notes}` : "Cálculo automatizado."
            };
          }
          return c;
        });
      }

      return {
        ...b,
        criteria: currentCriteria,
        isInventarioScheduledThisMonth
      };
    });

    // Stage 2: Link dual-branch garaged twins collaborating criteria
    const twinPairs = [
      ["unitrans-jp", "santa-maria-jp"],
      ["expresso-nacional", "acandido-cg"],
      ["fretamento-jaboatao", "rodoviario-jaboatao"],
      ["trans-cg-bayeux", "rodoviario-cabedelo"],
      ["fretamento-maracanau", "rodoviario-fortaleza"]
    ];

    return tempBranches.map((b) => {
      const pair = twinPairs.find((p) => p.includes(b.id));
      let dynamicSemScore = 0;

      if (typeof window !== "undefined") {
        const savedHistVal = localStorage.getItem("acandido_history");
        if (savedHistVal) {
          try {
            const parsed = JSON.parse(savedHistVal);
            if (Array.isArray(parsed)) {
              const hList = parsed.filter((h: any) => h.monthYear);
              const semesterMonths = activeSemestre === 1 
                ? ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"]
                : ["Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
              const activeSemMonths = activeSemestre === 1 
                ? [1, 2, 3, 4, 5, 6] 
                : [7, 8, 9, 10, 11, 12];
              const monthIndices: Record<string, number> = {
                "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
                "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
              };

              const branchIdsToSub = pair ? pair : [b.id];

              semesterMonths.forEach((mName, mIdx) => {
                const monthNum = activeSemMonths[mIdx];
                const matchingHList = hList.filter((h: any) => {
                  const pts = h.monthYear.split(" ");
                  const hYear = parseInt(pts[1]) || 2026;
                  const hMonthIndex = monthIndices[pts[0].toLowerCase()] || 1;
                  return branchIdsToSub.includes(h.branchId) && hYear === activeYearNum && hMonthIndex === monthNum;
                });

                if (matchingHList.length > 0) {
                  if (branchIdsToSub.length === 2 && matchingHList.length === 2) {
                    // Twin branches: both must be evaluated to score, apply AND logic to each criterion
                    let monthConsolidatedScore = 0;
                    b.criteria.forEach((cRef) => {
                      const allOk = matchingHList.every((hRecord) => {
                        const crit = hRecord.criteriaState?.find((cs: any) => cs.id === cRef.id);
                        return crit && crit.status === "OK";
                      });
                      if (allOk) {
                        monthConsolidatedScore += cRef.pointsPossible;
                      }
                    });
                    dynamicSemScore += monthConsolidatedScore;
                  } else {
                    // Single branch (or incomplete twin record)
                    dynamicSemScore += matchingHList.reduce((sum, h) => sum + (h.score || 0), 0);
                  }
                }
              });
            }
          } catch (e) {
            console.error("Error parsing history for dynamicSemScore:", e);
          }
        }
      }

      let activeCriteria = b.criteria;

      if (pair) {
        const twinId = pair[0] === b.id ? pair[1] : pair[0];
        const twinBranch = tempBranches.find((t) => t.id === twinId);

        if (twinBranch) {
          activeCriteria = b.criteria.map((c) => {
            const twinC = twinBranch.criteria.find((tc) => tc.id === c.id);
            if (!twinC) return c;

            const baseResult = {
              ...c,
              rawStatus: c.status,
              rawPointsObtained: c.pointsObtained
            };

            const isOursNok = c.status === "NOK";
            const isTwinNok = twinC.status === "NOK";

            if (isOursNok || isTwinNok) {
              // Se Unidade A = NOK ou Unidade B = NOK -> Resultado consolidado = NOK (não pontua para nenhuma das duas)
              return {
                ...baseResult,
                status: "NOK" as const,
                pointsObtained: 0,
                notes: c.notes || `[Garagem Dupla] Penalizado: Para pontuar neste critério, ambos os almoxarifados devem estar em conformidade (OK). Atualmente, uma ou ambas as unidades estão NOK.`
              };
            }

            const isOursOk = c.status === "OK";
            const isTwinOk = twinC.status === "OK";

            if (isOursOk && isTwinOk) {
              // Se Unidade A = OK e Unidade B = OK -> Resultado consolidado = OK (pontua)
              return {
                ...baseResult,
                status: "OK" as const,
                pointsObtained: c.pointsPossible
              };
            }

            // If one is OK and the other is pending (not NOK, not OK, e.g. PENDENTE, ENVIADO, AGUARDANDO ENVIO, etc.)
            // Then they do NOT pontuate yet.
            return {
              ...baseResult,
              pointsObtained: 0,
              notes: c.notes || `[Garagem Dupla] Aguardando aprovação mútua: Esta unidade está ${c.status} e a outra está ${twinC.status}. Só pontuam quando ambas estiverem OK.`
            };
          });
        }
      } else {
        // Individual branch: completely independent
        activeCriteria = b.criteria.map((c) => {
          return {
            ...c,
            pointsObtained: c.status === "OK" ? c.pointsPossible : 0
          };
        });
      }

      const monthlyCriteria = activeCriteria.filter((c) => c.id !== "1" && c.id !== "10");
      const monthlyObtained = monthlyCriteria.reduce((sum, c) => sum + (c.pointsObtained || 0), 0);
      const monthlyPossible = 75; // 8 fixed monthly criteria is always 75

      const invCrit = activeCriteria.find((c) => c.id === "1");
      const invObtained = invCrit?.pointsObtained || 0;
      const invPossible = 20;

      const matCrit = activeCriteria.find((c) => c.id === "10");
      let hasMaterials = false;
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`acandido_materials_parados_${b.id}`);
        if (saved) {
          try {
            const list = JSON.parse(saved);
            if (Array.isArray(list) && list.length > 0) {
              hasMaterials = true;
            }
          } catch {}
        } else {
          const defaultMap: Record<string, boolean> = {
            "unitrans-jp": true, "santa-maria-jp": true, "expresso-nacional": true, "acandido-cg": true,
            "fretamento-jaboatao": true, "rodoviario-jaboatao": true, "fretamento-maracanau": true,
            "rodoviario-fortaleza": true, "fretamento-pb": true, "fretamento-goiana": true,
            "trans-cg-bayeux": true, "rodoviario-cabedelo": true, "unissana-rn": true, "reunidas-nat": true
          };
          hasMaterials = !!defaultMap[b.id];
        }
      }
      const matObtained = matCrit?.pointsObtained || 0;
      const matPossible = 5;

      const obtained = monthlyObtained + invObtained + matObtained;
      const maxAuditable = monthlyPossible + invPossible + matPossible;

      const pendingMonthly = monthlyCriteria.filter((c) => c.status !== "OK" && c.status !== "NOK");
      const hasPendingMonthly = pendingMonthly.length > 0;

      const ratio = maxAuditable > 0 ? (obtained / maxAuditable) * 100 : 100;

      let scoreCategory: Branch["scoreCategory"] = "Excelente";
      let status: Branch["status"] = "OK";

      if (hasPendingMonthly) {
        scoreCategory = "Parcial";
        status = "PENDENTE";
      } else {
        if (ratio >= 85) {
          scoreCategory = "Excelente";
          status = "OK";
        } else if (ratio >= 70) {
          scoreCategory = "Bom";
          status = "PENDENTE";
        } else if (ratio >= 60) {
          scoreCategory = "Regular";
          status = "PENDENTE";
        } else {
          scoreCategory = "Abaixo da Meta";
          status = "NOK";
        }
      }

      const finalScore = obtained;
      const key_query = `${activeMonth}_${activeYear}`;
      const query_match = allCycles[key_query];
      
      const isCurrentPeriod = cycleState && cycleState.activeMonth === activeMonth && cycleState.activeYear === activeYear;
      const currentPeriodStatus = isCurrentPeriod ? cycleState.status : "NENHUM";
      const cycleStatusToUse = query_match ? query_match.status : (isCurrentPeriod ? currentPeriodStatus : "NENHUM");
      
      // A cycle is active (evaluations are loadable/visible) if its status is defined and is NOT NENHUM, or if there are already evaluations saved.
      const hasSavedEvaluations = b.criteria && b.criteria.some(c => c.status === "OK" || c.status === "NOK");
      const isCycleActive = (cycleStatusToUse !== "NENHUM") || hasSavedEvaluations;
      const liveActiveScore = isCycleActive ? finalScore : 0;

      return {
        ...b,
        criteria: isCycleActive ? activeCriteria : activeCriteria.map(c => ({
          ...c,
          status: "AGUARDANDO ENVIO" as const,
          pointsObtained: 0,
          evidenceNotes: "",
          submittedPhotos: [],
          submittedAt: undefined,
          notes: "",
          nokEvidenceLinks: [],
          nokEvidenceLink: undefined,
          nokEvidenceDescription: undefined,
          top10AuditorQuantities: undefined,
          nokEvidenceFileName: undefined,
          nokEvidenceFileType: undefined,
          nokEvidenceFileData: undefined
        })),
        currentScore: isCycleActive ? finalScore : 0,
        semestralScore: isCycleActive ? (dynamicSemScore + liveActiveScore) : 0,
        scoreCategory: isCycleActive ? scoreCategory : "Sem avaliação",
        status: isCycleActive ? status : "PENDENTE",
        maxAuditablePoints: isCycleActive ? maxAuditable : 100,
        pointsObtainedSum: isCycleActive ? obtained : 0
      };
    });
  })();

  // Callback to update criteria (saves into raw state, triggering processedBranches update)
  const handleUpdateCriteria = (branchId: string, updatedCriteria: CriterionState[]) => {
    // Mandated validation function to prevent saving invalid non-binary scores
    const validarPontuacao = (criterio: string, valor: number) => {
      const maxValido: { [key: string]: number } = {
        "Inventário": 20,
        "TOP 10": 20,
        "Nota Fiscal": 10,
        "Recebimento de Material": 10,
        "LayOut": 10,
        "Curso Unimobin": 10,
        "Registro de Requisições": 5,
        "Nível de Serviço": 5,
        "Controle de Garantia": 5,
        "Material Sem Movimentação": 5
      };
      // Valor SÓ PODE SER 0 ou o máximo do critério (or multiple of 5 for semestral/others if needed)
      if (valor !== 0 && valor !== maxValido[criterio] && valor % 5 !== 0) {
        throw new Error(`Pontuação inválida: ${valor} para ${criterio}`);
      }
    };

    setBranches((prev) =>
      prev.map((b) => {
        if (b.id === branchId) {
          // Merge NF follower updates to stay synchronized in raw state
          let finalCriteria = [...updatedCriteria];
          const nfInput = finalCriteria.find(c => c.id === "3");
          if (nfInput) {
            finalCriteria = finalCriteria.map(c => {
              if (c.id === "5") {
                return {
                  ...c,
                  status: nfInput.status,
                  pointsObtained: nfInput.status === "OK" ? c.pointsPossible : 0,
                  notes: nfInput.notes ? `Automático: Seguindo Nota Fiscal. Obs: ${nfInput.notes}` : "Cálculo automatizado."
                };
              }
              return c;
            });
          }

          // Validation and strict check with validarPontuacao
          finalCriteria = finalCriteria.map(c => {
            try {
              // Ensure the points obtained adheres strictly to the binary scoring rule
              validarPontuacao(c.name, c.pointsObtained);
            } catch (err: any) {
              console.error(`PONTOS MENSAIS INVÁLIDOS REJEITADOS: ${err.message}. Corrigindo automaticamente.`);
              return {
                ...c,
                pointsObtained: c.status === "OK" ? c.pointsPossible : 0
              };
            }
            return c;
          });

          const { score, status, scoreCategory } = calculateDerivedMetrics(finalCriteria);

          // Save evaluations to Supabase in the background
          if (isSupabaseReady()) {
            (async () => {
              try {
                realtimeFlags.activeLocalUpdatesCount += finalCriteria.length;
                await Promise.all(
                  finalCriteria.map((crit) =>
                    dbSaveEvaluation(b.name, activeMonth, activeYear, crit.id, crit.name, crit, user?.name || "Auditor")
                  )
                );
              } catch (err) {
                console.error("Error batch saving evaluations:", err);
              } finally {
                realtimeFlags.activeLocalUpdatesCount = Math.max(0, realtimeFlags.activeLocalUpdatesCount - finalCriteria.length);
                // Force a single, clean database fetch once all writes have completed on Supabase
                setRefetchTrigger((prev) => prev + 1);
              }
            })();
          }

          return {
            ...b,
            criteria: finalCriteria,
            currentScore: score,
            status: status,
            scoreCategory: scoreCategory,
          };
        }
        return b;
      })
    );
  };

  // Almoxarife submit files/evidence to dynamic state
  const handleAlmoxarifeSubmitEvidence = async (criterionId: string, comments: string, photos: string[], top10Quantities?: number[]) => {
    if (cycleState.status !== "ABERTO") {
      alert("Operação Bloqueada: Não é possível transmitir evidências com o ciclo de envios fechado.");
      return;
    }

    if (!activeBranchId) return;

    const currentBranch = branches.find((b) => b.id === activeBranchId);
    if (!currentBranch) return;

    let processedPhotos = [...photos];
    if (isSupabaseReady()) {
      processedPhotos = await Promise.all(
        photos.map(async (photo, index) => {
          if (photo.startsWith("data:image")) {
            try {
              const ext = photo.split(';')[0].split('/')[1] || 'jpg';
              const cleanExt = ext.split('+')[0]; // Safe extension
              const fileName = `submissions/${activeBranchId}/${criterionId}_${Date.now()}_${index}.${cleanExt}`;
              const signedUrl = await uploadFile('evidencias-almoxarife', fileName, photo);
              return signedUrl;
            } catch (err) {
              console.error("Failed to upload submission photo:", err);
              return photo;
            }
          }
          return photo;
        })
      );
    }

    const updatedCriteria = currentBranch.criteria.map((c) => {
      if (c.id === criterionId) {
        const now = new Date();
        const formattedDate = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
        return {
          ...c,
          status: "ENVIADO" as const, // Sent to auditor for evaluation review
          evidenceNotes: comments,
          submittedPhotos: processedPhotos,
          top10AlmoxarifeQuantities: top10Quantities,
          submittedAt: formattedDate,
        };
      }
      return c;
    });

    handleUpdateCriteria(activeBranchId, updatedCriteria);

    const twinPairs = [
      ["unitrans-jp", "santa-maria-jp"],
      ["expresso-nacional", "acandido-cg"],
      ["fretamento-jaboatao", "rodoviario-jaboatao"],
      ["trans-cg-bayeux", "rodoviario-cabedelo"],
      ["fretamento-maracanau", "rodoviario-fortaleza"]
    ];

    const pair = twinPairs.find((p) => p.includes(activeBranchId));
    const twinId = pair ? (pair[0] === activeBranchId ? pair[1] : pair[0]) : null;
    const isShared = criterionId === "10" || criterionId === "6";

    if (isShared && twinId) {
      const twinBranch = branches.find((b) => b.id === twinId);
      if (twinBranch) {
        const twinUpdatedCriteria = twinBranch.criteria.map((c) => {
          if (c.id === criterionId) {
            const now = new Date();
            const formattedDate = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
            return {
              ...c,
              status: "ENVIADO" as const,
              evidenceNotes: comments + ` (Compartilhado via ${currentBranch.name.replace("ALMOXARIFADO ", "")})`,
              submittedPhotos: processedPhotos,
              top10AlmoxarifeQuantities: top10Quantities,
              submittedAt: formattedDate,
            };
          }
          return c;
        });

        handleUpdateCriteria(twinId, twinUpdatedCriteria);

        // Copiar os certificados do Curso Unimobin para o almoxarifado vinculado dentro do mesmo ciclo ativo
        if (criterionId === "6") {
          try {
            const mainKey = `acandido_certificates_${activeBranchId}_${activeMonth}_${activeYear}`;
            const twinKey = `acandido_certificates_${twinId}_${activeMonth}_${activeYear}`;
            const certDataOfMain = localStorage.getItem(mainKey);
            if (certDataOfMain) {
              const parsedCertificates = JSON.parse(certDataOfMain);
              if (Array.isArray(parsedCertificates)) {
                // Forçar "Certificado enviado" para todos os colaboradores do vinculado também
                const updatedCertificates = parsedCertificates.map(c => ({
                  ...c,
                  status: "Certificado enviado" as const
                }));
                localStorage.setItem(twinKey, JSON.stringify(updatedCertificates));
              }
            }
          } catch (e) {
            console.error("Falha ao copiar certificados para a filial gêmea:", e);
          }
        }

        if (isSupabaseReady()) {
          try {
            await dbSubmitAlmoxarifeEvidence(
              twinBranch.name,
              activeMonth,
              activeYear,
              criterionId,
              user?.name || "Almoxarife",
              comments + ` (Compartilhado via ${currentBranch.name.replace("ALMOXARIFADO ", "")})`,
              processedPhotos
            );
          } catch (err) {
            console.error("Failed to insert twin into envios_almoxarife:", err);
          }
        }
      }
    }

    if (isSupabaseReady()) {
      try {
        await dbSubmitAlmoxarifeEvidence(
          currentBranch.name,
          activeMonth,
          activeYear,
          criterionId,
          user?.name || "Almoxarife",
          comments,
          processedPhotos
        );
      } catch (err) {
        console.error("Failed to insert into envios_almoxarife:", err);
      }
    }

    alert("Evidência transmitida com sucesso! Fernando Silva receberá uma notificação para auditar seu envio.");
  };

  const handleArchiveCycle = async (month: string, year: string, finalScore: number) => {
    let previousSaved: any[] = [];
    if (isSupabaseReady()) {
      try {
        previousSaved = await dbFetchHistory();
      } catch (e) {
        console.error("Failed to fetch evaluation history from Supabase on archive:", e);
      }
    }
    if (!previousSaved || previousSaved.length === 0) {
      const saved = localStorage.getItem("acandido_history");
      if (saved) {
        try {
          previousSaved = JSON.parse(saved);
          if (!Array.isArray(previousSaved)) previousSaved = [];
        } catch (e) {
          previousSaved = [];
        }
      }
    }

    const newHistoryEntries = processedBranches.map((b) => ({
      id: "hist-" + Date.now() + "-" + b.id,
      branchId: b.id,
      branchName: b.name,
      monthYear: `${month} ${year}`,
      score: b.currentScore,
      scoreCategory: b.scoreCategory,
      status: b.status,
      dateEvaluated: new Date().toLocaleDateString("pt-BR"),
      auditorName: "Fernando Silva",
      nokItems: b.criteria.filter((c) => c.status === "NOK").map((c) => c.name),
      criteriaState: b.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        score: c.pointsObtained !== undefined ? c.pointsObtained : (c.status === "OK" ? c.pointsPossible : 0),
        pointsObtained: c.pointsObtained !== undefined ? c.pointsObtained : (c.status === "OK" ? c.pointsPossible : 0),
        pointsPossible: c.pointsPossible,
        status: c.status,
        notes: c.notes || c.evidenceNotes || "Avaliado pelo auditor.",
        evidenceNotes: c.evidenceNotes,
        submittedPhotos: c.submittedPhotos || [],
        submittedAt: c.submittedAt,
        nokEvidenceLinks: c.nokEvidenceLinks || [],
        nokEvidenceLink: c.nokEvidenceLink,
        nokEvidenceDescription: c.nokEvidenceDescription,
        top10AuditorQuantities: c.top10AuditorQuantities,
        nokEvidenceFileName: c.nokEvidenceFileName,
        nokEvidenceFileType: c.nokEvidenceFileType,
        nokEvidenceFileData: c.nokEvidenceFileData
      }))
    }));

    if (isSupabaseReady()) {
      try {
        await dbSaveHistory(newHistoryEntries);
      } catch (err) {
        console.error("Failed to post archive logs to database:", err);
      }
    }

    const finalHistoryToSave = [...newHistoryEntries, ...previousSaved];
    localStorage.setItem("acandido_history", JSON.stringify(finalHistoryToSave));

    // Reset branches raw criteria states to prep for next cycle starting
    setBranches((prev) =>
      prev.map((b) => ({
        ...b,
        status: "PENDENTE" as const,
        currentScore: 0,
        criteria: b.criteria.map((c) => ({
          ...c,
          status: "AGUARDANDO ENVIO" as const,
          pointsObtained: 0,
          evidenceNotes: "",
          submittedPhotos: [],
          submittedAt: undefined,
          notes: ""
        }))
      }))
    );

    // Save cycle with state ARQUIVADO in allCycles map
    const key = `${month}_${year}`;
    setAllCycles((prev) => {
      const updatedAll = {
        ...prev,
        [key]: {
          activeMonth: month,
          activeYear: year,
          status: "ARQUIVADO" as const,
          openedAt: prev[key]?.openedAt || new Date().toLocaleDateString("pt-BR"),
          openedBy: prev[key]?.openedBy || "Fernando Silva"
        }
      };
      const list = Object.values(updatedAll);
      localStorage.setItem("acandido_all_cycles_list", JSON.stringify(list));
      return updatedAll;
    });

    // Reset current active cycleState to NENHUM
    setCycleState({
      activeMonth: month,
      activeYear: year,
      status: "NENHUM" as const
    });
  };

  const handleReopenCycle = async (month: string, year: string) => {
    const key = `${month}_${year}`;
    
    // Set the cycle to status "ABERTO" in allCycles map
    setAllCycles((prev) => {
      const existing = prev[key] || {
        activeMonth: month,
        activeYear: year,
        status: "ABERTO" as const,
        openedAt: new Date().toLocaleDateString("pt-BR"),
        openedBy: "Fernando Silva"
      };
      
      const updatedCycle = {
        ...existing,
        status: "ABERTO" as const
      };
      
      const updatedAll = {
        ...prev,
        [key]: updatedCycle
      };
      
      const list = Object.values(updatedAll);
      localStorage.setItem("acandido_all_cycles_list", JSON.stringify(list));
      return updatedAll;
    });

    // Update active cycleState
    const openedAtStamp = allCycles[key]?.openedAt || new Date().toLocaleDateString("pt-BR");
    const nextState = {
      activeMonth: month,
      activeYear: year,
      status: "ABERTO" as const,
      openedAt: openedAtStamp,
      openedBy: allCycles[key]?.openedBy || "Fernando Silva"
    };
    
    localStorage.setItem("acandido_cycle_state_manual", JSON.stringify(nextState));
    setCycleState(nextState);

    // Update selected session month & year
    setActiveMonth(month);
    setActiveYear(year);

    // Baseline branches in memory to empty pristine state to wait for live Supabase fetch
    const cleanB = getCleanDefaultBranches();
    setBranches(cleanB);

    // Filter out of consolidation history in localStorage (if any local cache remains)
    let historyList = [];
    const savedHistory = localStorage.getItem("acandido_history");
    if (savedHistory) {
      try {
        historyList = JSON.parse(savedHistory);
        if (Array.isArray(historyList)) {
          const filtered = historyList.filter((entry) => entry.monthYear !== `${month} ${year}`);
          localStorage.setItem("acandido_history", JSON.stringify(filtered));
        }
      } catch (e) {}
    }

    // Sync state on Supabase if ready
    if (isSupabaseReady()) {
      try {
        dbSaveCycleState(nextState);
        await supabase.from('historico_avaliacoes').delete().eq('month_year', `${month} ${year}`);
      } catch (e) {
        console.error("Failed to delete history on reopen cycle in Supabase:", e);
      }
    }

    alert(`O ciclo de ${month}/${year} foi reaberto com sucesso! Todas as avaliações, pontuações e histórico de evidências anteriores foram restaurados.`);
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedBranchId(null);
    setActiveSubscreen(null);
  };

  // Login check
  if (user === null) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  // Managed branches list if Almoxarife
  const managedBranches = user.role === "ALMOXARIFE"
    ? processedBranches.filter((b) => {
        if (user.email === "robson.almoxarife@acandidogrupo.com.br") {
          return b.id.includes("jaboatao") || b.ownerName === "Sérgio";
        }
        return safeStr(b.ownerName).toLowerCase() === safeStr(user.ownerName).toLowerCase();
      })
    : [];

  // Resolves active & selected branches from PROCESSED set
  const activeBranch = (processedBranches.find((b) => b.id === activeBranchId) || managedBranches[0] || processedBranches[0]) || initialBranches[0];
  const selectedBranch = (processedBranches.find((b) => b.id === selectedBranchId) || processedBranches[0]) || initialBranches[0];
  const rawSelectedBranch = (branches.find((b) => b.id === selectedBranchId) || branches[0]) || initialBranches[0];

  return (
    <div className="min-h-screen bg-[#FBF8FC] flex flex-col font-sans select-none pb-12">
      {showLiveUpdateToast && (
        <div className="fixed top-20 right-4 bg-emerald-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 z-50 border border-emerald-500/30 transition-all duration-300 animate-slide-in">
          <span className="text-sm">🔄</span>
          <span>Dados atualizados em tempo real!</span>
        </div>
      )}
      {dbConnectionError && (
        <div className="w-full bg-red-600 text-white font-medium text-center py-3 px-4 text-sm flex items-center justify-center gap-2 shadow-inner z-50">
          <span>⚠ Erro de conexão com o banco de dados. Tente recarregar a página.</span>
        </div>
      )}
      {/* BRAND HEADER & DEMO SWITCHER */}
      <header className="w-full bg-[#1B2A4A] border-b-4 border-[#C8A84B] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Main Logo Text */}
          <div className="flex items-center gap-3 select-none">
            <div className="flex items-center">
              <span className="text-lg sm:text-lg font-black text-white tracking-[0.15em] font-sans">
                GRUPO A.CÂNDIDO
              </span>
              <span className="w-2 h-2 bg-[#EF4444] rounded-full self-baseline mb-1 sm:mb-1.5 ml-1 animate-pulse"></span>
            </div>
            <div className="h-5 w-px bg-white/20"></div>
            <div>
              <p className="text-[10px] text-[#C8A85B] font-extrabold tracking-widest uppercase leading-none">
                SISTEMA DE AUDITORIA
              </p>
            </div>

            {/* Global Manual status badge visible to all */}
            <div className="ml-2">
              {cycleState.status === "ABERTO" && (
                <span className="inline-flex bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[8px] sm:text-[10px] uppercase tracking-wider items-center gap-1 shadow-inner select-none">
                  ● CICLO ABERTO — {cycleState.activeMonth} {cycleState.activeYear}
                </span>
              )}
              {cycleState.status === "AGUARDANDO_FECHAMENTO" && (
                <span className="inline-flex bg-amber-500/15 border border-amber-500/30 text-amber-500 font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[8px] sm:text-[10px] uppercase tracking-wider items-center gap-1 shadow-inner select-none">
                  ● AGUARDANDO FECHAMENTO — {cycleState.activeMonth} {cycleState.activeYear}
                </span>
              )}
              {cycleState.status === "FECHADO" && (
                <span className="inline-flex bg-[#374151]/45 border border-slate-600 text-slate-400 font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[8px] sm:text-[10px] uppercase tracking-wider items-center gap-1 shadow-inner select-none">
                  ● FECHADO — {cycleState.activeMonth} {cycleState.activeYear}
                </span>
              )}
              {cycleState.status === "NENHUM" && (
                <span className="inline-flex bg-[#374151] border border-slate-600 text-slate-300 font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[8px] sm:text-[10px] uppercase tracking-wider shadow-inner select-none">
                  🔘 NENHUM CICLO ATIVO — Aguardando abertura pelo auditor
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* If not Admin, show clear Sign Out action in the header */}
            {user && user.role !== "ADMIN" && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-white text-xs font-black">{user.name}</span>
                  <span className="text-[#C8A85B] text-[9px] font-bold uppercase">{user.role}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-red-500/15 hover:bg-red-500/25 text-red-200 sm:text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[15px]">logout</span>
                  Sair
                </button>
              </div>
            )}

            {/* QUICK DEMO USER SWITCHER FOR TESTING - ONLY FOR ADMIN */}
            {user && user.role === "ADMIN" && (
              <div className="flex items-center gap-2 bg-white/10 px-2 py-1 rounded-lg border border-white/10 text-xs text-white">
                <span className="hidden md:inline text-[9px] font-black uppercase text-slate-300 tracking-wider">Troca Rápida:</span>
                <select
                  value={user ? (
                    user.email.toLowerCase().trim() === "estoquejp@acandidotransportes.com.br" ? "NATALICE" : (
                      user.email.toLowerCase().trim() === "estoque01jp@gmail.com" ? "ADMIN" : user.ownerName
                    )
                  ) : "NONE"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "NONE") {
                      handleLogout();
                    } else if (val === "ADMIN") {
                      setUser({
                        name: "Fernando Silva",
                        role: "ADMIN",
                        email: "estoque01jp@gmail.com",
                        ownerName: "Fernando Silva",
                        group: "A"
                      });
                      setSelectedBranchId(null);
                      setActiveSubscreen(null);
                    } else if (val === "NATALICE") {
                      setUser({
                        name: "Natalice Oliveira",
                        role: "ADMIN",
                        email: "estoquejp@acandidotransportes.com.br",
                        ownerName: "Natalice Oliveira",
                        group: "A"
                      });
                      setSelectedBranchId(null);
                      setActiveSubscreen(null);
                    } else {
                      const list = [
                        { name: "Robson", email: "almoxarifadojp@acandidotransportes.com.br", ownerName: "Robson", group: "A" as const, role: "ALMOXARIFE" as const },
                        { name: "Paulo", email: "comprascg@acandidotransportes.com.br", ownerName: "Paulo", group: "A" as const, role: "ALMOXARIFE" as const },
                        { name: "Ezequiel", email: "almoxarifadogo@transnacionalfretamento.com.br", ownerName: "Ezequiel", group: "A" as const, role: "ALMOXARIFE" as const },
                        { name: "Sérgio", email: "almoxarifadope01@transnacionalfretamento.com.br", ownerName: "Sérgio", group: "A" as const, role: "ALMOXARIFE" as const },
                        { name: "Raimundo", email: "almoxarifadorn@acandidotransportes.com.br", ownerName: "Raimundo", group: "B" as const, role: "ALMOXARIFE" as const },
                        { name: "Joel", email: "ti02rn@acandidotransportes.com.br", ownerName: "Joel", group: "B" as const, role: "ALMOXARIFE" as const },
                        { name: "Lucas", email: "fretamentojoaopessoa@gmail.com", ownerName: "Lucas", group: "B" as const, role: "ALMOXARIFE" as const },
                        { name: "Matheus", email: "almoxarifadobayeux@rodoviarionordestino.com.br", ownerName: "Matheus", group: "B" as const, role: "ALMOXARIFE" as const },
                        { name: "Arline", email: "almoxarifadoce@transnacionalfretamento.com.br", ownerName: "Arline", group: "B" as const, role: "ALMOXARIFE" as const },
                        { name: "Muniz", email: "muniz.jabo@acandidotransportes.com.br", ownerName: "Muniz", group: "A" as const, role: "SUPERVISOR" as const },
                        { name: "Glebson", email: "glebson.jabo@acandidotransportes.com.br", ownerName: "Glebson", group: "A" as const, role: "SUPERVISOR" as const },
                      ];
                      const found = list.find((item) => item.ownerName === val);
                      if (found) {
                        setUser({
                          name: found.name,
                          role: found.role,
                          email: found.email,
                          ownerName: found.ownerName,
                          group: found.group
                        });
                        setActiveSubscreen(null);
                      }
                    }
                  }}
                  className="bg-[#1C2C4E] border border-white/20 px-2 py-1 rounded text-[11px] font-bold text-[#C8A85B] focus:outline-none cursor-pointer outline-none"
                >
                  <option value="NONE" disabled>-- Escolha um Perfil --</option>
                  <option value="ADMIN">Fernando Silva (Auditor)</option>
                  <option value="NATALICE">Natalice Oliveira (Auditora)</option>
                  <option value="Robson">Robson (Almoxarife JP/SM)</option>
                  <option value="Paulo">Paulo (Almoxarife CG/EN)</option>
                  <option value="Matheus">Matheus (Almoxarife CG/RC)</option>
                  <option value="Lucas">Lucas (Almoxarife PB)</option>
                  <option value="Sérgio">Sérgio (Almoxarife JB)</option>
                  <option value="Ezequiel">Ezequiel (Almoxarife GO)</option>
                  <option value="Raimundo">Raimundo (Almoxarife RN)</option>
                  <option value="Joel">Joel (Almoxarife NAT)</option>
                  <option value="Arline">Arline (Almoxarife CE)</option>
                  <option value="Muniz">Muniz (Supervisor Jaboatão)</option>
                  <option value="Glebson">Glebson (Supervisor Jaboatão)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* PASSIVE SUBTLE CYCLE STATUS BAR FOR ALMOXARIFE */}
      {user && user.role === "ALMOXARIFE" && (
        <div className="bg-[#1C2C4E] border-b border-[#C8A84B] py-2.5 px-4 text-white shadow-inner select-none pointer-events-none">
          <div className="max-w-md mx-auto flex justify-between items-center text-xs font-bold font-sans">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[#C8A85B] text-[9px] font-extrabold">
              <span className={`w-2 h-2 rounded-full ${cycleState.status === "ABERTO" ? "bg-emerald-400 animate-pulse" : cycleState.status === "FECHADO" ? "bg-slate-400" : "bg-amber-400"}`}></span>
              Status do Ciclo: <strong className={cycleState.status === "ABERTO" ? "text-emerald-300" : "text-amber-350"}>
                {cycleState.status === "ABERTO" ? "Aberto para Envios" : cycleState.status === "FECHADO" ? "Fechado" : cycleState.status === "AGUARDANDO_FECHAMENTO" ? "Trancado (Avaliação)" : "Nenhum Ativo"}
              </strong>
            </span>
            <span className="text-slate-300 text-[10px]">
              Mês Base: <strong className="text-white bg-white/10 px-2.5 py-0.5 rounded font-mono font-black">{cycleState.activeMonth} {cycleState.activeYear}</strong>
            </span>
          </div>
        </div>
      )}

      {/* ADMIN NAVIGATION BAR */}
      {user.role === "ADMIN" && (
        <nav className="w-full bg-white border-b border-slate-200 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 flex gap-4 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => {
                setAdminTab("PAINEL");
                setSelectedBranchId(null);
              }}
              className={`py-4 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                adminTab === "PAINEL"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Almoxarifados ({branches.length})
            </button>
            <button
              onClick={() => {
                setAdminTab("RANKING");
                setSelectedBranchId(null);
              }}
              className={`py-4 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                adminTab === "RANKING"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Ranking Corporativo
            </button>
            <button
              onClick={() => {
                setAdminTab("HISTORICO");
                setSelectedBranchId(null);
              }}
              className={`py-4 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                adminTab === "HISTORICO"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Histórico Consolidado
            </button>
            <button
              onClick={() => {
                setAdminTab("GARANTIAS");
                setSelectedBranchId(null);
              }}
              className={`py-4 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                adminTab === "GARANTIAS"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Garantias
            </button>
            <button
              onClick={() => {
                setAdminTab("SERVICOS");
                setSelectedBranchId(null);
              }}
              className={`py-4 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                adminTab === "SERVICOS"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Serviços
            </button>
            <button
              onClick={() => {
                setAdminTab("CONFIGURI");
                setSelectedBranchId(null);
              }}
              className={`py-4 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                adminTab === "CONFIGURI"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Configurações
            </button>
            <button
              onClick={handleLogout}
              className="py-4 px-1 text-xs font-bold text-red-500 hover:text-red-700 ml-auto transition shrink-0"
            >
              Sair do Sistema
            </button>
          </div>
        </nav>
      )}

      {/* ALMOXARIFE NAVIGATION BAR (MOBILE TOP TABS) */}
      {user.role === "ALMOXARIFE" && !activeSubscreen && (
        <nav className="w-full bg-white border-b border-slate-200 shadow-sm sticky top-[60px] z-20">
          <div className="max-w-md mx-auto px-4 flex justify-between">
            <button
              onClick={() => setAlmoxarifeTab("HOME")}
              className={`flex-1 py-4 flex flex-col items-center gap-1 border-b-2 text-center transition-all ${
                almoxarifeTab === "HOME"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">checklist</span>
              <span className="text-[10px] font-black uppercase tracking-wider">Metas</span>
            </button>

            <button
              onClick={() => setAlmoxarifeTab("NIVEL_SERVICO")}
              className={`flex-1 py-4 flex flex-col items-center gap-1 border-b-2 text-center transition-all ${
                almoxarifeTab === "NIVEL_SERVICO"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">engineering</span>
              <span className="text-[10px] font-black uppercase tracking-wider">Serviços</span>
            </button>

            <button
              onClick={() => setAlmoxarifeTab("GARANTIA")}
              className={`flex-1 py-4 flex flex-col items-center gap-1 border-b-2 text-center transition-all ${
                almoxarifeTab === "GARANTIA"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
              <span className="text-[10px] font-black uppercase tracking-wider">Garantias</span>
            </button>

            <button
              onClick={() => setAlmoxarifeTab("HISTORICO")}
              className={`flex-1 py-4 flex flex-col items-center gap-1 border-b-2 text-center transition-all ${
                almoxarifeTab === "HISTORICO"
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">history</span>
              <span className="text-[10px] font-black uppercase tracking-wider">Histórico</span>
            </button>
          </div>
        </nav>
      )}

      {/* MAIN LAYOUT CANVAS CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 mt-6 flex-1 w-full relative">
        {/* ================= ALMOXARIFE BRANCH SWITCHER TABS ================= */}
        {user.role === "ALMOXARIFE" && !activeSubscreen && managedBranches.length > 1 && (
          <div className="max-w-md mx-auto mb-4 bg-white p-1 rounded-xl shadow-sm border border-slate-100 flex gap-2">
            {managedBranches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setActiveBranchId(b.id);
                }}
                className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all ${
                  activeBranchId === b.id
                    ? "bg-[#1B2A4A] text-white shadow-sm"
                    : "text-[#1B2A4A]/60 bg-slate-50/50 hover:bg-slate-100"
                }`}
              >
                {b.name
                  .replace("ALMOXARIFADO ", "")
                  .replace("ALMOXARIFADO", "")
                  .replace("JP / SANTA MARIA JP", "SM")
                  .trim()}
              </button>
            ))}
          </div>
        )}

        {/* ================= ADMIN VIEW CONTENT ================= */}
        {user.role === "ADMIN" && (
          <div className="space-y-6">
            {selectedBranchId ? (
              <AdminEvaluationDetail
                branch={rawSelectedBranch}
                allBranches={branches}
                onBack={() => setSelectedBranchId(null)}
                onUpdateCriteria={handleUpdateCriteria}
                isSemestralMonth={activeMonth.toLowerCase() === "janeiro" || activeMonth.toLowerCase() === "julho"}
                activeMonth={activeMonth}
                activeYear={activeYear}
                calendarData={calendarData}
              />
            ) : (
              <>
                {adminTab === "PAINEL" && (
                  <AdminPanel
                    branches={processedBranches}
                    onSelectBranch={(id) => {
                      setSelectedBranchId(id);
                    }}
                    onLogout={handleLogout}
                    selectedMonth={activeMonth}
                    setSelectedMonth={setActiveMonth}
                    selectedYear={activeYear}
                    setSelectedYear={setActiveYear}
                    cycleState={cycleState}
                    onUpdateCycleState={handleUpdateCycleState}
                    onArchiveCycle={handleArchiveCycle}
                    user={user}
                    allCycles={allCycles}
                  />
                )}
                {adminTab === "CONFIGURI" && (
                  <AdminConfiguracoes
                    branches={branches}
                    onUpdateBranchNames={(updatedBranches) => setBranches(updatedBranches)}
                    onLogout={handleLogout}
                    cycleState={cycleState}
                    onUpdateCycleState={handleUpdateCycleState}
                    onArchiveCycle={handleArchiveCycle}
                    user={user}
                    allCycles={allCycles}
                    onReopenCycle={handleReopenCycle}
                    calendarData={calendarData}
                  />
                )}
                {adminTab === "RANKING" && (
                  <AdminRanking
                    user={user}
                    branches={processedBranches}
                    activeMonth={activeMonth}
                    setActiveMonth={setActiveMonth}
                    activeYear={activeYear}
                    setActiveYear={setActiveYear}
                    selectedSemesterFilter={selectedSemesterFilter}
                    setSelectedSemesterFilter={setSelectedSemesterFilter}
                    cycleState={cycleState}
                    calendarData={calendarData}
                  />
                )}
                {adminTab === "HISTORICO" && <AdminHistory user={user} branches={processedBranches} calendarData={calendarData} />}
                {adminTab === "GARANTIAS" && <AdminGarantiasPanel allBranches={processedBranches} />}
                {adminTab === "SERVICOS" && <AdminServicosPanel allBranches={processedBranches} />}
              </>
            )}
          </div>
        )}

        {/* ================= ALMOXARIFE VIEW CONTENT ================= */}
        {user.role === "ALMOXARIFE" && (
          <div className="max-w-md mx-auto relative">
            {activeSubscreen ? (
              <>
                {activeSubscreen === "CONTAGEM_TOP10" && (
                  !currentConfig.configured ? (
                    <div className="bg-white rounded-2xl border border-slate-150 p-8 text-center shadow-sm space-y-4 my-6">
                      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto select-none animate-bounce">
                        <span className="material-symbols-outlined text-[36px]">lock_clock</span>
                      </div>
                      <h3 className="text-sm font-black text-[#1B2A4A]">Aguardando abertura do ciclo</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        O ciclo de <strong className="text-slate-800">{activeMonth} {activeYear}</strong> ainda não foi aberto de forma oficial pelo Auditor Geral Fernando Silva.
                      </p>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-2 bg-slate-100 font-bold hover:bg-slate-200 text-slate-600 text-[11px] rounded-lg transition-all"
                      >
                        Sair / Voltar para Login
                      </button>
                    </div>
                  ) : (
                    <AlmoxarifeContagem
                      onBack={() => setActiveSubscreen(null)}
                      onSubmitEvidence={handleAlmoxarifeSubmitEvidence}
                      criterionState={activeBranch.criteria.find((c) => c.id === "2")}
                      top10={currentConfig.top10}
                      branchId={activeBranch.id}
                      activeMonth={activeMonth}
                      activeYear={activeYear}
                    />
                  )
                )}
                {activeSubscreen === "LAYOUT_ARRANJO" && (
                  !currentConfig.configured ? (
                    <div className="bg-white rounded-2xl border border-slate-150 p-8 text-center shadow-sm space-y-4 my-6">
                      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto select-none animate-bounce">
                        <span className="material-symbols-outlined text-[36px]">lock_clock</span>
                      </div>
                      <h3 className="text-sm font-black text-[#1B2A4A]">Aguardando abertura do ciclo</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        O ciclo de <strong className="text-slate-800">{activeMonth} {activeYear}</strong> ainda não foi aberto de forma oficial pelo Auditor Geral Fernando Silva.
                      </p>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-2 bg-slate-100 font-bold hover:bg-slate-200 text-slate-600 text-[11px] rounded-lg transition-all"
                      >
                        Sair / Voltar para Login
                      </button>
                    </div>
                  ) : (
                    <AlmoxarifeLayout
                      onBack={() => setActiveSubscreen(null)}
                      onSubmitEvidence={handleAlmoxarifeSubmitEvidence}
                      criterionState={activeBranch.criteria.find((c) => c.id === "4")}
                      branchId={activeBranch.id}
                      activeMonth={activeMonth}
                      activeYear={activeYear}
                    />
                  )
                )}
                {activeSubscreen === "UNIMOBIN_CERTIFICADOS" && (
                  !currentConfig.configured ? (
                    <div className="bg-white rounded-2xl border border-slate-150 p-8 text-center shadow-sm space-y-4 my-6">
                      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto select-none animate-bounce">
                        <span className="material-symbols-outlined text-[36px]">lock_clock</span>
                      </div>
                      <h3 className="text-sm font-black text-[#1B2A4A]">Aguardando abertura do ciclo</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        O ciclo de <strong className="text-slate-800">{activeMonth} {activeYear}</strong> ainda não foi aberto de forma oficial pelo Auditor Geral Fernando Silva.
                      </p>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-2 bg-slate-100 font-bold hover:bg-slate-200 text-slate-600 text-[11px] rounded-lg transition-all"
                      >
                        Sair / Voltar para Login
                      </button>
                    </div>
                  ) : (
                    <AlmoxarifeUnimobin
                      onBack={() => setActiveSubscreen(null)}
                      onSubmitEvidence={handleAlmoxarifeSubmitEvidence}
                      criterionState={activeBranch.criteria.find((c) => c.id === "6")}
                      branchId={activeBranch.id}
                      branchName={activeBranch.name}
                      activeMonth={activeMonth}
                      activeYear={activeYear}
                    />
                  )
                )}
                {activeSubscreen === "NIVEL_SERVICO" && (
                  <AlmoxarifeNivelServico
                    onBack={() => setActiveSubscreen(null)}
                    branchId={activeBranch.id}
                    branchName={activeBranch.name}
                    user={user}
                    branches={processedBranches}
                  />
                )}
                {activeSubscreen === "CONTROLE_GARANTIA" && (
                  <AlmoxarifeGarantia
                    onBack={() => setActiveSubscreen(null)}
                    user={user}
                    branches={processedBranches}
                    activeBranch={activeBranch}
                    activeMonth={activeMonth}
                    activeYear={activeYear}
                  />
                )}
              </>
            ) : (
              <>
                {almoxarifeTab === "HOME" && (
                  !currentConfig.configured ? (
                    <div className="bg-white rounded-2xl border border-slate-150 p-8 text-center shadow-sm space-y-4 my-6 col-span-full">
                      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto select-none animate-bounce">
                        <span className="material-symbols-outlined text-[36px]">lock_clock</span>
                      </div>
                      <h3 className="text-sm font-black text-[#1B2A4A]">Aguardando abertura do ciclo</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        O ciclo de <strong className="text-slate-800">{activeMonth} {activeYear}</strong> ainda não foi aberto de forma oficial pelo Auditor Geral Fernando Silva.
                      </p>
                      <div className="p-3 bg-rose-50/50 border border-rose-100/50 rounded-xl text-left text-[10px] text-rose-800 leading-normal space-y-1">
                        <span className="font-bold block mb-1">Passos pendentes:</span>
                        <p>• Parametrização dos 9 itens críticos do relatório TOP 10.</p>
                        <p>• Especificação da prateleira/layout físico a ser auditado.</p>
                        <p>• Transmissão do relatório de saldos da TransNet.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-2 bg-slate-100 font-bold hover:bg-slate-200 text-slate-600 text-[11px] rounded-lg transition-all"
                      >
                        Sair / Voltar para Login
                      </button>
                    </div>
                  ) : (
                    <AlmoxarifeHome
                      branch={activeBranch}
                      allBranches={processedBranches}
                      user={user}
                      onNavigateToScreen={(scr) => setActiveSubscreen(scr)}
                      activeMonth={activeMonth}
                      activeYear={activeYear}
                      calendarData={calendarData}
                      cycleState={cycleState}
                    />
                  )
                )}
                {almoxarifeTab === "NIVEL_SERVICO" && (
                  <AlmoxarifeNivelServico
                    onBack={() => setAlmoxarifeTab("HOME")}
                    branchId={activeBranch.id}
                    branchName={activeBranch.name}
                    user={user}
                    branches={processedBranches}
                  />
                )}
                {almoxarifeTab === "GARANTIA" && (
                  <AlmoxarifeGarantia
                    onBack={() => setAlmoxarifeTab("HOME")}
                    user={user}
                    branches={processedBranches}
                    activeBranch={activeBranch}
                    activeMonth={activeMonth}
                    activeYear={activeYear}
                  />
                )}
                {almoxarifeTab === "HISTORICO" && (
                  <AlmoxarifeHistorico
                    user={user}
                    managedBranches={managedBranches}
                    activeMonth={activeMonth}
                    activeYear={activeYear}
                    calendarData={calendarData}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ================= SUPERVISOR VIEW CONTENT ================= */}
        {user.role === "SUPERVISOR" && (
          <SupervisorPanel user={user} branches={processedBranches} onLogout={handleLogout} />
        )}
      </main>

      {showMigrationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-slate-800">
          <div className="bg-white rounded-2xl border-2 border-amber-300 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <span className="material-symbols-outlined text-[32px]">warning</span>
              <h3 className="text-base font-black tracking-tight text-slate-900">Dados locais encontrados</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              O sistema detectou dados salvos localmente (ambiente de testes).
              Esses dados eram fictícios e não serão migrados.
              A partir de agora todos os dados serão salvos no banco de dados.
            </p>
            <button
              type="button"
              onClick={handleClearLegacyLocalStorage}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              Entendido — Limpar dados locais
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
