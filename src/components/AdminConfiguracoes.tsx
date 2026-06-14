import React, { useState, useEffect } from "react";
import { AppUser, Branch, WarrantyItem } from "../types";
import { isSupabaseReady, dbFetchUsers, dbSaveUser, dbDeleteUser } from "../supabaseService";
import { supabase } from "../supabaseClient";

const ALMOXARIFADOS_LIST = [
  "Santa Maria JPA",
  "A.Candido (CG)",
  "Trans CG",
  "Trans CG Metrop (Bayeux)",
  "Trans Fret CE",
  "Trans Fret Goiana",
  "Trans Fret PB",
  "Trans Fret PE",
  "Trans Rod CE",
  "Trans Rod PB (Bayeux)",
  "Trans Rod PB Cabedelo",
  "Trans Rod PE",
  "Transnacional RN",
  "Unissanta RN",
  "Unitrans JPA"
];

const PRELOADED_CALENDAR_2026 = [
  { id: "cal-1", almoxarifado: "Santa Maria JPA", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-06-26" },
  { id: "cal-2", almoxarifado: "Santa Maria JPA", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-11-27" },
  { id: "cal-3", almoxarifado: "A.Candido (CG)", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-17" },
  { id: "cal-4", almoxarifado: "A.Candido (CG)", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-08-18" },
  { id: "cal-5", almoxarifado: "Trans CG", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-17" },
  { id: "cal-6", almoxarifado: "Trans CG", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-08-18" },
  { id: "cal-7", almoxarifado: "Trans CG Metrop (Bayeux)", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-10" },
  { id: "cal-8", almoxarifado: "Trans CG Metrop (Bayeux)", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-12" },
  { id: "cal-9", almoxarifado: "Trans Fret CE", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-25" },
  { id: "cal-10", almoxarifado: "Trans Fret CE", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-15" },
  { id: "cal-11", almoxarifado: "Trans Fret Goiana", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-05-16" },
  { id: "cal-12", almoxarifado: "Trans Fret Goiana", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-31" },
  { id: "cal-13", almoxarifado: "Trans Fret PB", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-08" },
  { id: "cal-14", almoxarifado: "Trans Fret PB", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-07-22" },
  { id: "cal-15", almoxarifado: "Trans Fret PE", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-15" },
  { id: "cal-16", almoxarifado: "Trans Fret PE", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-07-08" },
  { id: "cal-17", almoxarifado: "Trans Rod CE", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-06-09" },
  { id: "cal-18", almoxarifado: "Trans Rod CE", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-10" },
  { id: "cal-19", almoxarifado: "Trans Rod PB (Bayeux)", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-10" },
  { id: "cal-20", almoxarifado: "Trans Rod PB (Bayeux)", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-12" },
  { id: "cal-21", almoxarifado: "Trans Rod PB Cabedelo", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-10" },
  { id: "cal-22", almoxarifado: "Trans Rod PB Cabedelo", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-12" },
  { id: "cal-23", almoxarifado: "Trans Rod PE", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-15" },
  { id: "cal-24", almoxarifado: "Trans Rod PE", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-07-08" },
  { id: "cal-25", almoxarifado: "Transnacional RN", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-07" },
  { id: "cal-26", almoxarifado: "Transnacional RN", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-26" },
  { id: "cal-27", almoxarifado: "Unissanta RN", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-06" },
  { id: "cal-28", almoxarifado: "Unissanta RN", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-25" },
  { id: "cal-29", almoxarifado: "Unitrans JPA", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-12" },
  { id: "cal-30", almoxarifado: "Unitrans JPA", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-09" }
];

interface AdminConfiguracoesProps {
  onLogout: () => void;
  branches: Branch[];
  onUpdateBranchNames: (updatedBranches: Branch[]) => void;
  cycleState?: {
    activeMonth: string;
    activeYear: string;
    status: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "NENHUM";
    openedAt?: string;
    openedBy?: string;
  };
  onUpdateCycleState?: (newState: any) => void;
  onArchiveCycle?: (month: string, year: string, score: number) => void;
}

interface MiniCollaborator {
  id: string;
  name: string;
  branchId: string;
}

export default function AdminConfiguracoes({
  branches,
  onUpdateBranchNames,
  cycleState,
  onUpdateCycleState,
  onArchiveCycle,
}: AdminConfiguracoesProps) {
  const [activeTab, setActiveTab] = useState<"USUARIOS" | "ALMOXARIFADOS" | "COLABORADORES" | "GARANTIAS" | "CICLO" | "SUPERVISOR" | "CRITERIOS" | "INVENTARIOS">("USUARIOS");

  // Dynamic names list derived from active branches
  const activeAlmoxNames = [...new Set(branches.map((b) => b.name))].sort((a, b) => a.localeCompare(b));

  // Add Branch Form controls
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchForm, setNewBranchForm] = useState({
    name: "",
    location: "",
    group: "A" as "A" | "B",
    ownerName: "",
    meta: 80
  });

  // ================= STATE: REFRESH/MANAGE CYCLE & FORM FIELDS =================
  const [cycleMonth, setCycleMonth] = useState(cycleState?.activeMonth || "Junho");
  const [cycleYear, setCycleYear] = useState(cycleState?.activeYear || "2026");

  const [supervisorFields, setSupervisorFields] = useState(() => {
    const saved = localStorage.getItem("acandido_supervisor_form_fields");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: "veiculo", name: "Veículo", type: "text", required: true, builtIn: true },
      { id: "codigoMaterial", name: "Código do Material", type: "text", required: false, builtIn: true },
      { id: "material", name: "Material em Falta", type: "text", required: true, builtIn: true },
      { id: "date", name: "Data", type: "date", required: true, builtIn: true },
      { id: "solicitante", name: "Solicitante", type: "text", required: true, builtIn: true }
    ];
  });

  const [garantiaConfig, setGarantiaConfig] = useState(() => {
    const saved = localStorage.getItem("acandido_garantia_fields_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.auditorEditHistory === undefined) {
          parsed.auditorEditHistory = true;
        }
        return parsed;
      } catch (e) {}
    }
    return {
      fabricante: true,
      nfEmissionDate: true,
      reference: true,
      pieceObservation: true,
      scrapObservation: true,
      auditorEditHistory: true,
      customFields: [] as any[]
    };
  });

  const [top10Config, setTop10Config] = useState(() => {
    const saved = localStorage.getItem("acandido_top10_fields_config");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      quantidade: true,
      foto: true,
      customFields: [] as any[]
    };
  });

  const [layoutConfig, setLayoutConfig] = useState(() => {
    const saved = localStorage.getItem("acandido_layout_fields_config");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      localizacao: true,
      fotos: true,
      comentario: true,
      customFields: [] as any[]
    };
  });

  const [unimobinConfig, setUnimobinConfig] = useState(() => {
    const saved = localStorage.getItem("acandido_unimobin_fields_config");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      certificado: true,
      customFields: [] as any[]
    };
  });

  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarData, setCalendarData] = useState<{ id: string; almoxarifado: string; ano: number; semestre: number; indice: number; data_agendada: string }[]>(() => {
    try {
      const saved = localStorage.getItem("acandido_calendario_inventarios");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    localStorage.setItem("acandido_calendario_inventarios", JSON.stringify(PRELOADED_CALENDAR_2026));
    return PRELOADED_CALENDAR_2026;
  });

  const updateCalendarItem = (id: string, almox: string, semestre: number, indice: number, dateVal: string) => {
    setCalendarData(prev => {
      const isRegistered = prev.some(item => item.id === id);
      if (isRegistered) {
        return prev.map(item => item.id === id ? { ...item, data_agendada: dateVal } : item);
      } else {
        const newItem = {
          id,
          almoxarifado: almox,
          ano: calendarYear,
          semestre,
          indice,
          data_agendada: dateVal
        };
        return [...prev, newItem];
      }
    });
  };

  const addCalendarItem = (almox: string, semestre: number) => {
    setCalendarData(prev => {
      const semItems = prev.filter(item => item.almoxarifado === almox && item.ano === calendarYear && item.semestre === semestre);
      const nextIndice = semItems.length > 0 ? Math.max(...semItems.map(i => i.indice)) + 1 : 1;
      const newItem = {
        id: `cal-${almox.replace(/\s+/g, "_")}-${calendarYear}-${semestre}-${nextIndice}`,
        almoxarifado: almox,
        ano: calendarYear,
        semestre,
        indice: nextIndice,
        data_agendada: ""
      };
      return [...prev, newItem];
    });
  };

  const removeCalendarItem = (id: string) => {
    setCalendarData(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveCalendar = () => {
    localStorage.setItem("acandido_calendario_inventarios", JSON.stringify(calendarData));
    window.dispatchEvent(new Event("storage"));
    alert("Calendário de Inventários salvo com sucesso!");
  };

  // Synchronizers
  useEffect(() => {
    localStorage.setItem("acandido_supervisor_form_fields", JSON.stringify(supervisorFields));
    window.dispatchEvent(new Event("storage"));
  }, [supervisorFields]);

  useEffect(() => {
    localStorage.setItem("acandido_garantia_fields_config", JSON.stringify(garantiaConfig));
    window.dispatchEvent(new Event("storage"));
  }, [garantiaConfig]);

  useEffect(() => {
    localStorage.setItem("acandido_top10_fields_config", JSON.stringify(top10Config));
    window.dispatchEvent(new Event("storage"));
  }, [top10Config]);

  useEffect(() => {
    localStorage.setItem("acandido_layout_fields_config", JSON.stringify(layoutConfig));
    window.dispatchEvent(new Event("storage"));
  }, [layoutConfig]);

  useEffect(() => {
    localStorage.setItem("acandido_unimobin_fields_config", JSON.stringify(unimobinConfig));
    window.dispatchEvent(new Event("storage"));
  }, [unimobinConfig]);

  // ================= STATE: USERS =================
  const [users, setUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem("acandido_users");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        // Fallback
      }
    }
    // Prefill with OFFICIAL_CREDENTIALS
    return [
      {
        name: "Fernando Silva",
        role: "ADMIN" as const,
        email: "estoque01jp@gmail.com",
        password: "33911386Fe@",
        ownerName: "Fernando",
        group: "A" as const,
        cargo: "Auditor Geral",
        status: "ATIVO" as const,
        almoxarifados: []
      },
      {
        name: "Natalice",
        role: "ADMIN" as const,
        email: "natalice.auditora@acandidogrupo.com.br",
        password: "Natalice@Auditora2026",
        ownerName: "Natalice",
        group: "A" as const,
        cargo: "Auditora",
        status: "ATIVO" as const,
        almoxarifados: []
      },
      {
        name: "Robson",
        role: "ALMOXARIFE" as const,
        email: "almoxarifadojp@acandidotransportes.com.br",
        password: "almoxarifadojp",
        ownerName: "Robson",
        group: "A" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["unitrans-jp", "santa-maria-jp"]
      },
      {
        name: "Robson",
        role: "ALMOXARIFE" as const,
        email: "robson.almoxarife@acandidogrupo.com.br",
        password: "Robson@Almox2026",
        ownerName: "Robson Jaboatão",
        group: "A" as const,
        cargo: "Almoxarife Jaboatão",
        status: "ATIVO" as const,
        almoxarifados: ["fretamento-jaboatao", "rodoviario-jaboatao"]
      },
      {
        name: "Muniz",
        role: "SUPERVISOR" as const,
        email: "muniz.jabo@acandidotransportes.com.br",
        password: "jaboatão@2026",
        ownerName: "Muniz",
        group: "A" as const,
        cargo: "Supervisor de Manutenção",
        status: "ATIVO" as const,
        almoxarifados: ["fretamento-jaboatao", "rodoviario-jaboatao"]
      },
      {
        name: "Glebson",
        role: "SUPERVISOR" as const,
        email: "glebson.jabo@acandidotransportes.com.br",
        password: "jab#2026",
        ownerName: "Glebson",
        group: "A" as const,
        cargo: "Supervisor de Manutenção",
        status: "ATIVO" as const,
        almoxarifados: ["fretamento-jaboatao", "rodoviario-jaboatao"]
      },
      {
        name: "Paulo",
        role: "ALMOXARIFE" as const,
        email: "comprascg@acandidotransportes.com.br",
        password: "almoxarifadocg",
        ownerName: "Paulo",
        group: "A" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["expresso-nacional", "acandido-cg"]
      },
      {
        name: "Ezequiel",
        role: "ALMOXARIFE" as const,
        email: "almoxarifadogo@transnacionalfretamento.com.br",
        password: "almoxarifadogo",
        ownerName: "Ezequiel",
        group: "A" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["fretamento-goiana"]
      },
      {
        name: "Sérgio",
        role: "ALMOXARIFE" as const,
        email: "almoxarifadope01@transnacionalfretamento.com.br",
        password: "fretamentope",
        ownerName: "Sérgio",
        group: "A" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["fretamento-jaboatao", "rodoviario-jaboatao"]
      },
      {
        name: "Raimundo",
        role: "ALMOXARIFE" as const,
        email: "almoxarifadorn@acandidotransportes.com.br",
        password: "almoxarifadorn",
        ownerName: "Raimundo",
        group: "B" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["unissana-rn"]
      },
      {
        name: "Joel",
        role: "ALMOXARIFE" as const,
        email: "ti02rn@acandidotransportes.com.br",
        password: "almoxarifado02",
        ownerName: "Joel",
        group: "B" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["reunidas-nat"]
      },
      {
        name: "Lucas",
        role: "ALMOXARIFE" as const,
        email: "fretamentojoaopessoa@gmail.com",
        password: "fretamentojp@",
        ownerName: "Lucas",
        group: "B" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["fretamento-pb"]
      },
      {
        name: "Matheus",
        role: "ALMOXARIFE" as const,
        email: "almoxarifadobayeux@rodoviarionordestino.com.br",
        password: "almoxarifadorodo",
        ownerName: "Matheus",
        group: "B" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["trans-cg-bayeux", "rodoviario-cabedelo"]
      },
      {
        name: "Arline",
        role: "ALMOXARIFE" as const,
        email: "almoxarifadoce@transnacionalfretamento.com.br",
        password: "fretamentoce",
        ownerName: "Arline",
        group: "B" as const,
        cargo: "Almoxarife",
        status: "ATIVO" as const,
        almoxarifados: ["fretamento-maracanau", "rodoviario-fortaleza"]
      }
    ];
  });

  const loadRealtimeUsers = async () => {
    try {
      const dbUsers = await dbFetchUsers();
      if (dbUsers) {
        setUsers(dbUsers);
      }
    } catch (err) {
      console.error("Failed to fetch initial users in AdminConfiguracoes:", err);
    }
  };

  useEffect(() => {
    if (!isSupabaseReady()) return;

    loadRealtimeUsers();

    const channel = supabase
      .channel("live-usuarios-config")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "usuarios" },
        async () => {
          try {
            const dbUsers = await dbFetchUsers();
            if (dbUsers) {
              setUsers(dbUsers);
            }
          } catch (err) {
            console.error("Error reloading users in realtime subscription:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Check if Natalice is missing from current users, and if so, auto-add her to keep everything updated!
    const hasNatalice = users.some(u => u.email.toLowerCase().trim() === "natalice.auditora@acandidogrupo.com.br");
    if (!hasNatalice) {
      const natalice: AppUser = {
        name: "Natalice",
        role: "ADMIN" as const,
        email: "natalice.auditora@acandidogrupo.com.br",
        password: "Natalice@Auditora2026",
        ownerName: "Natalice",
        group: "A" as const,
        cargo: "Auditora",
        status: "ATIVO" as const,
        almoxarifados: []
      };
      setUsers(prev => [natalice, ...prev]);
      return;
    }

    localStorage.setItem("acandido_users", JSON.stringify(users));
    window.dispatchEvent(new Event("storage"));
  }, [users]);

  // Modals for Users
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "ALMOXARIFE" as AppUser["role"],
    almoxarifados: [] as string[],
    group: "A" as AppUser["group"]
  });
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [showConfirmPasswordText, setShowConfirmPasswordText] = useState(false);

  // Exclude user state
  const [userToExclude, setUserToExclude] = useState<AppUser | null>(null);
  const [excludeTypedName, setExcludeTypedName] = useState("");

  // Custom confirmation modal (to bypass iframe confirm limitations)
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // ================= STATE: ALMOXARIFADOS =================
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchFormName, setBranchFormName] = useState("");

  // ================= STATE: COLABORADORES =================
  const [selectedCollabBranchId, setSelectedCollabBranchId] = useState<string>(branches[0]?.id || "");
  const [collabList, setCollabList] = useState<MiniCollaborator[]>(() => {
    const saved = localStorage.getItem("acandido_all_collab_profiles");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Safe catch
      }
    }
    // Prefill with some default collaborations from mapIdToNames in mockData
    const defaultCollabProfiles: MiniCollaborator[] = [];
    const baseMapping: Record<string, string[]> = {
      "unitrans-jp": ["Robson", "Cassiano", "João", "Wesley", "Jeferson"],
      "santa-maria-jp": ["Robson", "Cassiano", "João", "Wesley", "Jeferson"],
      "fretamento-jaboatao": ["Sérgio", "Alexandro", "Cristian"],
      "rodoviario-jaboatao": ["Sérgio", "Alexandro", "Cristian"],
      "fretamento-goiana": ["Ezequiel", "Leo"],
      "expresso-nacional": ["Paulo", "Wegeles", "Vagner"],
      "acandido-cg": ["Paulo", "Wegeles", "Vagner"],
      "trans-cg-bayeux": ["Matheus"],
      "rodoviario-cabedelo": ["Matheus"],
      "unissana-rn": ["Raimundo"],
      "reunidas-nat": ["Joel"],
      "fretamento-maracanau": ["Arline"],
      "rodoviario-fortaleza": ["Arline"],
      "fretamento-pb": ["Lucas"],
    };
    Object.entries(baseMapping).forEach(([bId, names]) => {
      names.forEach((name, i) => {
        defaultCollabProfiles.push({
          id: `collab-profile-${bId}-${i}-${Date.now()}`,
          name,
          branchId: bId
        });
      });
    });
    return defaultCollabProfiles;
  });

  useEffect(() => {
    localStorage.setItem("acandido_all_collab_profiles", JSON.stringify(collabList));
    window.dispatchEvent(new Event("storage"));
  }, [collabList]);

  const [newCollabName, setNewCollabName] = useState("");

  // ================= STATE: GARANTIAS =================
  const [gItems, setGItems] = useState<Array<{ code: string; description: string }>>(() => {
    const saved = localStorage.getItem("acandido_preset_items");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { code: "1080571", description: "BATERIA 180 AMP" },
      { code: "1050177", description: "KIT EMBREAGEM 1722" },
      { code: "1081086", description: "ALTERNADOR BOSCH 24V 150AMP" },
      { code: "1080901", description: "ALTERNADOR 24V 80 AMP" },
      { code: "1140356", description: "COMPRESSOR AR CONDICIONADO TM" },
      { code: "1091094", description: "TENSOR CORREIA ALTERNADOR MB O500" },
      { code: "1090604", description: "TURBINA 1721 EURO 5 NOVA" },
      { code: "1090667", description: "BOMBA DO ARLA EURO 5" },
      { code: "1091730", description: "BOMBA DO ARLA EURO 6" },
    ];
  });

  const [gManufacturers, setGManufacturers] = useState<string[]>(() => {
    const saved = localStorage.getItem("acandido_preset_manufacturers");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      "ACDELCO", "AUTO NORTE", "AUTOTEC", "B1G WG ROTOR TI", "BGW", "BIAGGIO", "BITZER", "BOCK",
      "BORG-WAGNER", "BOSCH", "CARDAN NORDESTE", "CIA BRAS DIST AUTO", "DENSO", "EATON", "ECO PEÇAS",
      "ELETROGERAL", "ERBS", "FICFRIO", "GARRET MOTION", "GATES", "GR BARBOSA", "HELIAR", "IMOBRAS",
      "ISAQUE", "JR REFRIGERAÇÕES", "MERCEDES-BENZ", "MODEFER", "MOURA", "MULTIPLEX", "PACAEMBU",
      "PELEGRINO", "POLY V", "REDIESEL", "REFRUET", "ROYCE", "SCHADEX", "STA CAMINHÕES", "WWAGCO"
    ];
  });

  useEffect(() => {
    localStorage.setItem("acandido_preset_items", JSON.stringify(gItems));
    window.dispatchEvent(new Event("storage"));
  }, [gItems]);

  useEffect(() => {
    localStorage.setItem("acandido_preset_manufacturers", JSON.stringify(gManufacturers));
    window.dispatchEvent(new Event("storage"));
  }, [gManufacturers]);

  // Modal actions for Warranties
  const [editingGItem, setEditingGItem] = useState<{ index: number; code: string; description: string } | null>(null);
  const [newGItem, setNewGItem] = useState({ code: "", description: "" });
  const [editingGManufacturer, setEditingGManufacturer] = useState<{ index: number; name: string } | null>(null);
  const [newGManufacturer, setNewGManufacturer] = useState("");

  // ================= FUNCTIONS: USER MANAGEMENT =================
  const handleOpenNewUser = () => {
    setEditingUser(null);
    setUserForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "ALMOXARIFE",
      almoxarifados: [],
      group: "A"
    });
    setShowPasswordText(false);
    setShowConfirmPasswordText(false);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (user: AppUser) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: "", // don't show existing
      confirmPassword: "",
      role: user.role,
      almoxarifados: user.almoxarifados || [],
      group: user.group || "A"
    });
    setShowPasswordText(false);
    setShowConfirmPasswordText(false);
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim()) {
      alert("Nome e E-mail são obrigatórios.");
      return;
    }

    if (!editingUser) {
      // Create mode
      if (!userForm.password) {
        alert("Senha é obrigatória para novos usuários.");
        return;
      }
      if (userForm.password !== userForm.confirmPassword) {
        alert("As senhas digitadas não coincidem.");
        return;
      }
      // Check existing email
      const exists = users.some((u) => u.email.toLowerCase().trim() === userForm.email.toLowerCase().trim());
      if (exists) {
        alert("Este e-mail corporativo já está cadastrado.");
        return;
      }

      const newUser: AppUser = {
        name: userForm.name.trim(),
        role: userForm.role,
        email: userForm.email.toLowerCase().trim(),
        password: userForm.password,
        ownerName: userForm.name.trim().split(" ")[0],
        group: userForm.role === "ADMIN" ? "A" : userForm.group,
        almoxarifados: userForm.role === "ADMIN" ? [] : userForm.almoxarifados,
        status: "ATIVO" as const,
        cargo: userForm.role === "ALMOXARIFE" ? "Almoxarife" : (userForm.role === "SUPERVISOR" ? "Supervisor de Manutenção" : "Auditor Geral")
      };

      if (isSupabaseReady()) {
        dbSaveUser(newUser).then(() => {
          loadRealtimeUsers().then(() => {
            alert("Usuário criado com sucesso no Supabase Auth e Banco de Dados!");
          });
        }).catch(err => {
          console.error("Error creating user:", err);
          alert("⚠ Erro de conexão com o banco de dados. Tente novamente.");
        });
      } else {
        setUsers(prev => [...prev, newUser]);
        alert("Usuário criado com sucesso!");
      }
    } else {
      // Edit mode
      if (userForm.password && userForm.password !== userForm.confirmPassword) {
        alert("As senhas de alteração não coincidem.");
        return;
      }

      const updatedUser: AppUser = {
        name: userForm.name.trim(),
        role: userForm.role,
        email: editingUser.email.toLowerCase().trim(),
        password: userForm.password ? userForm.password : editingUser.password,
        ownerName: userForm.name.trim().split(" ")[0],
        group: userForm.role === "ADMIN" ? "A" : userForm.group,
        almoxarifados: userForm.role === "ADMIN" ? [] : userForm.almoxarifados,
        status: editingUser.status || "ATIVO",
        cargo: userForm.role === "ALMOXARIFE" ? "Almoxarife" : (userForm.role === "SUPERVISOR" ? "Supervisor de Manutenção" : "Auditor Geral")
      };

      if (isSupabaseReady()) {
        dbSaveUser(updatedUser).then(() => {
          loadRealtimeUsers().then(() => {
            alert("Dados do usuário atualizados com sucesso!");
          });
        }).catch(err => {
          console.error("Error updating user:", err);
          alert("⚠ Erro de conexão com o banco de dados. Tente novamente.");
        });
      } else {
        setUsers(prev =>
          prev.map((u) => u.email.toLowerCase().trim() === editingUser.email.toLowerCase().trim() ? updatedUser : u)
        );
        alert("Dados do usuário atualizados com sucesso!");
      }
    }

    setShowUserModal(false);
  };

  const handleToggleUserStatus = (selectedUser: AppUser) => {
    const isSuspended = selectedUser.status === "SUSPENSO";
    const nextStatus = isSuspended ? ("ATIVO" as const) : ("SUSPENSO" as const);
    const updatedUser: AppUser = {
      ...selectedUser,
      status: nextStatus
    };

    if (isSupabaseReady()) {
      dbSaveUser(updatedUser).then(() => {
        loadRealtimeUsers().then(() => {
          alert(isSuspended ? `Acesso do usuário ${selectedUser.name} reativado!` : `Acesso do usuário ${selectedUser.name} suspenso (login bloqueado)!`);
        });
      }).catch(err => {
        console.error("Error toggling user status:", err);
        alert("⚠ Erro de conexão com o banco de dados.");
      });
    } else {
      setUsers(prev =>
        prev.map((u) => u.email === selectedUser.email ? updatedUser : u)
      );
      alert(isSuspended ? `Acesso do usuário ${selectedUser.name} reativado!` : `Acesso do usuário ${selectedUser.name} suspenso (login bloqueado)!`);
    }
  };

  const handleRequestExcludeUser = (user: AppUser) => {
    if (user.email === "estoque01jp@gmail.com") {
      alert("Operação negada: O Auditor Geral Fernando Silva não pode excluir a própria conta.");
      return;
    }
    setUserToExclude(user);
    setExcludeTypedName("");
  };

  const handleConfirmExcludeUser = () => {
    if (!userToExclude) return;
    if (excludeTypedName.trim() !== userToExclude.name.trim()) {
      alert("Nome digitado incorretamente. Verifique maiúsculas e espaços.");
      return;
    }

    if (isSupabaseReady()) {
      dbDeleteUser(userToExclude.email).then(() => {
        loadRealtimeUsers().then(() => {
          alert(`Usuário ${userToExclude.name} excluído com sucesso do banco de dados!`);
          setUserToExclude(null);
        });
      }).catch(err => {
        console.error("Error deleting user:", err);
        alert("⚠ Erro de conexão com o banco de dados.");
      });
    } else {
      setUsers(prev => prev.filter((u) => u.email.toLowerCase().trim() !== userToExclude.email.toLowerCase().trim()));
      alert(`Usuário ${userToExclude.name} excluído com sucesso do banco de dados!`);
      setUserToExclude(null);
    }
  };

  // ================= ALMOXARIFADOS EDIT & TRANSITIONS =================
  const handleSaveNewBranch = () => {
    if (!newBranchForm.name.trim()) {
      alert("Por favor, informe o nome do almoxarifado.");
      return;
    }
    const slug = newBranchForm.name.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    // Check if branch ID already exists
    if (branches.some(b => b.id === slug)) {
      alert("Já existe um almoxarifado com o mesmo nome ou ID.");
      return;
    }

    const defaultCriteria = [
      { id: "1", number: "01", name: "Inventário", recurrence: "Semestral" as const, pointsPossible: 20, pointsObtained: 0, status: "PENDENTE" as const },
      { id: "2", number: "02", name: "TOP 10", recurrence: "Mensal" as const, pointsPossible: 20, pointsObtained: 0, status: "PENDENTE" as const },
      { id: "3", number: "03", name: "Nota Fiscal", recurrence: "Mensal" as const, pointsPossible: 10, pointsObtained: 0, status: "PENDENTE" as const },
      { id: "4", number: "04", name: "LayOut", recurrence: "Mensal" as const, pointsPossible: 10, pointsObtained: 0, status: "PENDENTE" as const },
      { id: "5", number: "05", name: "Recebimento de Material", recurrence: "Mensal" as const, pointsPossible: 10, pointsObtained: 0, status: "PENDENTE" as const },
      { id: "6", number: "06", name: "Curso Unimobin", recurrence: "Mensal" as const, pointsPossible: 10, pointsObtained: 0, status: "PENDENTE" as const, evidenceNotes: "Aguardando envio do relatório oficial de frotas pelo almoxarife." },
      { id: "7", number: "07", name: "Nível de Serviço", recurrence: "Mensal" as const, pointsPossible: 5, pointsObtained: 0, status: "PENDENTE" as const },
      { id: "8", number: "08", name: "Registro de Requisições", recurrence: "Mensal" as const, pointsPossible: 5, pointsObtained: 0, status: "PENDENTE" as const },
      { id: "9", number: "09", name: "Controle de Garantia", recurrence: "Mensal" as const, pointsPossible: 5, pointsObtained: 0, status: "PENDENTE" as const },
      { id: "10", number: "10", name: "Material Sem Movimentação", recurrence: "Semestral" as const, pointsPossible: 5, pointsObtained: 0, status: "PENDENTE" as const }
    ];

    const bId = slug.toLowerCase();
    const owner = newBranchForm.ownerName.toLowerCase();
    // Audit mode calculation
    const isRobsonOrLucas = owner === "robson" || owner === "lucas" || bId.includes("unitrans") || bId.includes("santa-maria") || bId.includes("fretamento-pb");
    const criteria = defaultCriteria.map((c) => {
      const auditMode = (isRobsonOrLucas && (c.id === "2" || c.id === "4")) ? ("Presencial" as const) : ("A_Distancia" as const);
      return { ...c, auditMode };
    });

    const newBranch: Branch = {
      id: slug,
      name: newBranchForm.name.toUpperCase().trim(),
      location: newBranchForm.location.trim() || "Campina Grande, PB",
      currentScore: 0,
      meta: Number(newBranchForm.meta) || 80,
      status: "PENDENTE",
      scoreCategory: "Abaixo da Meta",
      ownerName: newBranchForm.ownerName.trim() || "Paulo",
      group: newBranchForm.group,
      semestralScore: 0,
      criteria
    };

    onUpdateBranchNames([...branches, newBranch]);

    // Dynamic addition for calendar data
    const calS1 = {
      id: `cal-${slug}-2026-1-1`,
      almoxarifado: newBranch.name,
      ano: 2026,
      semestre: 1,
      indice: 1,
      data_agendada: ""
    };
    const calS2 = {
      id: `cal-${slug}-2026-2-1`,
      almoxarifado: newBranch.name,
      ano: 2026,
      semestre: 2,
      indice: 1,
      data_agendada: ""
    };
    const updatedCalendar = [...calendarData, calS1, calS2];
    setCalendarData(updatedCalendar);
    localStorage.setItem("acandido_calendario_inventarios", JSON.stringify(updatedCalendar));

    window.dispatchEvent(new Event("storage"));
    alert(`Almoxarifado ${newBranch.name} adicionado com sucesso!`);
    setShowAddBranchModal(false);
    setNewBranchForm({
      name: "",
      location: "",
      group: "A",
      ownerName: "",
      meta: 80
    });
  };

  const handleSaveBranchName = () => {
    if (!editingBranch || !branchFormName.trim()) return;

    const oldName = editingBranch.name;
    const newName = branchFormName.trim().toUpperCase();

    // 1. Update branches in parent state
    const updated = branches.map((b) => {
      if (b.id === editingBranch.id) {
        return {
          ...b,
          name: newName
        };
      }
      return b;
    });
    onUpdateBranchNames(updated);

    // 2. Cascade rename inside global Calendar inventories
    const updatedCal = calendarData.map((c) => {
      if (c.almoxarifado.toLowerCase() === oldName.toLowerCase()) {
        return { ...c, almoxarifado: newName };
      }
      return c;
    });
    setCalendarData(updatedCal);
    localStorage.setItem("acandido_calendario_inventarios", JSON.stringify(updatedCal));

    // 3. Cascade rename inside active registered warranties list
    const savedWarranties = localStorage.getItem("acandido_warranties");
    if (savedWarranties) {
      try {
        const warranties = JSON.parse(savedWarranties);
        const updatedW = warranties.map((w: any) => {
          if (w.almoxarifado && w.almoxarifado.toLowerCase() === oldName.toLowerCase()) {
            return { ...w, almoxarifado: newName };
          }
          return w;
        });
        localStorage.setItem("acandido_warranties", JSON.stringify(updatedW));
      } catch (e) {}
    }

    // 4. Cascade rename inside supervisor occurrences list
    const savedOccs = localStorage.getItem("acandido_occurrences");
    if (savedOccs) {
      try {
        const occs = JSON.parse(savedOccs);
        const updatedO = occs.map((o: any) => {
          let updatedItem = { ...o };
          let changed = false;
          if (o.branchName && o.branchName.toLowerCase() === oldName.toLowerCase()) {
            updatedItem.branchName = newName;
            changed = true;
          }
          if (o.filial && o.filial.toLowerCase() === oldName.toLowerCase()) {
            updatedItem.filial = newName;
            changed = true;
          }
          return updatedItem;
        });
        localStorage.setItem("acandido_occurrences", JSON.stringify(updatedO));
      } catch (e) {}
    }

    // Notify all listeners
    window.dispatchEvent(new Event("storage"));

    alert("Nome de almoxarifado alterador com sucesso em todo o sistema!");
    setEditingBranch(null);
  };

  const handleDeleteBranch = (branchId: string, branchName: string) => {
    if (branches.length <= 1) {
      alert("Não é possível remover o último almoxarifado ativo do sistema corporativo.");
      return;
    }
    const yes = confirm(`Deseja realmente REMOVER o almoxarifado "${branchName}"? Esta ação removerá a unidade da lista do painel, do ranking e de seletores, mantendo históricos passados intactos.`);
    if (!yes) return;

    // 1. Remove from active branches React state
    const updated = branches.filter((b) => b.id !== branchId);
    onUpdateBranchNames(updated);

    // 2. Clear branch assignments from any user profiles
    const updatedUsers = users.map((u) => {
      if (u.almoxarifados) {
        return {
          ...u,
          almoxarifados: u.almoxarifados.filter(bId => bId !== branchId)
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    localStorage.setItem("acandido_users", JSON.stringify(updatedUsers));

    // 3. Cleanup branch collaborators lists
    const updatedCollabs = collabList.filter((c) => c.branchId !== branchId);
    setCollabList(updatedCollabs);
    localStorage.setItem("acandido_all_collab_profiles", JSON.stringify(updatedCollabs));

    // 4. Cleanup its dynamic calendar references
    const updatedCalendar = calendarData.filter((c) => c.almoxarifado.toLowerCase() !== branchName.toLowerCase());
    setCalendarData(updatedCalendar);
    localStorage.setItem("acandido_calendario_inventarios", JSON.stringify(updatedCalendar));

    window.dispatchEvent(new Event("storage"));
    alert(`Almoxarifado "${branchName}" removido com sucesso.`);
  };

  // ================= COLABORADORES Unimobin =================
  const handleAddCollab = () => {
    if (!newCollabName.trim()) return;

    const profile: MiniCollaborator = {
      id: `collab-profile-${selectedCollabBranchId}-${Date.now()}`,
      name: newCollabName.trim(),
      branchId: selectedCollabBranchId
    };

    setCollabList(prev => [...prev, profile]);

    // Also sync the local certificates key for this branch to instantly show
    const storageKey = "acandido_certificates_" + selectedCollabBranchId;
    const existingCertsRaw = localStorage.getItem(storageKey);
    let existingCerts = [];
    if (existingCertsRaw) {
      try { existingCerts = JSON.parse(existingCertsRaw); } catch (e) {}
    }
    const newCert = {
      id: `collab-${existingCerts.length}-${profile.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")}`,
      name: profile.name,
      status: "Aguardando envio" as const
    };
    localStorage.setItem(storageKey, JSON.stringify([...existingCerts, newCert]));

    setNewCollabName("");
    alert("Colaborador cadastrado com sucesso para o curso Unimobin!");
  };

  const handleRemoveCollab = (id: string, name: string) => {
    setCustomConfirm({
      isOpen: true,
      title: "Confirmar Remoção de Colaborador",
      message: `Deseja remover permanentemente o colaborador ${name} da lista de treinamento do Unimobin?`,
      onConfirm: () => {
        setCollabList(prev => prev.filter((c) => c.id !== id));

        // Also clean up local certificados file if applicable
        const storageKey = "acandido_certificates_" + selectedCollabBranchId;
        const existingCertsRaw = localStorage.getItem(storageKey);
        if (existingCertsRaw) {
          try {
            const parsed = JSON.parse(existingCertsRaw);
            if (Array.isArray(parsed)) {
              const updated = parsed.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
              localStorage.setItem(storageKey, JSON.stringify(updated));
            }
          } catch (e) {}
        }

        setCustomConfirm(null);
        alert(`Colaborador ${name} removido com sucesso.`);
      }
    });
  };

  // ================= GARANTIAS ACTIONS =================
  const handleAddGItem = () => {
    if (!newGItem.code.trim() || !newGItem.description.trim()) {
      alert("Por favor, preencha código e descrição.");
      return;
    }
    const exists = gItems.some(item => item.code.trim() === newGItem.code.trim());
    if (exists) {
      alert("Um item com este código já está cadastrado.");
      return;
    }
    setGItems(prev => [...prev, { code: newGItem.code.trim(), description: newGItem.description.trim().toUpperCase() }]);
    setNewGItem({ code: "", description: "" });
    alert("Material adicionado com sucesso!");
  };

  const handleRemoveGItem = (code: string, description: string) => {
    setCustomConfirm({
      isOpen: true,
      title: "Confirmar Remoção de Material",
      message: `Deseja remover o material "${description}" (${code}) dos itens pré-cadastrados para Garantia?`,
      onConfirm: () => {
        setGItems(prev => prev.filter(item => item.code !== code));
        setCustomConfirm(null);
        alert("Material removido com sucesso.");
      }
    });
  };

  const handleAddGManufacturer = () => {
    if (!newGManufacturer.trim()) return;
    const cleanName = newGManufacturer.trim().toUpperCase();
    if (gManufacturers.includes(cleanName)) {
      alert("Este fabricante já está cadastrado.");
      return;
    }
    setGManufacturers(prev => [...prev, cleanName].sort());
    setNewGManufacturer("");
    alert("Fabricante adicionado.");
  };

  const handleRemoveGManufacturer = (name: string) => {
    setCustomConfirm({
      isOpen: true,
      title: "Confirmar Remoção de Fabricante",
      message: `Deseja remover o fabricante "${name}" da lista de pré-cadastro para Garantia?`,
      onConfirm: () => {
        setGManufacturers(prev => prev.filter(m => m !== name));
        setCustomConfirm(null);
        alert("Fabricante removido com sucesso.");
      }
    });
  };

  return (
    <div className="space-y-6" id="settings-tela">
      <header className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <h2 className="text-xl font-extrabold text-[#1B2A4A] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#C8A84B]">settings</span>
          Configurações do Auditor Geral — Fernando Silva
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Gerenciamento exclusivo e permanente de usuários, almoxarifados do grupo, lista de colaboradores Unimobin e itens de garantia.
        </p>
      </header>

      {/* Inner Tabs Menu */}
      <div className="flex flex-wrap border-b border-slate-200 gap-x-2 gap-y-1 py-1 mb-2" id="menus-config-gui">
        <button
          onClick={() => setActiveTab("USUARIOS")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === "USUARIOS"
              ? "border-[#1B2A4A] text-[#1B2A4A] font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">group</span>
          Gestão de Usuários
        </button>
        <button
          onClick={() => setActiveTab("ALMOXARIFADOS")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === "ALMOXARIFADOS"
              ? "border-[#1B2A4A] text-[#1B2A4A] font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">warehouse</span>
          Almoxarifados ({branches.length})
        </button>
        <button
          onClick={() => setActiveTab("COLABORADORES")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === "COLABORADORES"
              ? "border-[#1B2A4A] text-[#1B2A4A] font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">school</span>
          Colaboradores Unimobin
        </button>
        <button
          onClick={() => setActiveTab("GARANTIAS")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === "GARANTIAS"
              ? "border-[#1B2A4A] text-[#1B2A4A] font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">verified_user</span>
          Garantias — Itens e Fabricantes
        </button>
        <button
          onClick={() => setActiveTab("CICLO")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === "CICLO"
              ? "border-[#1B2A4A] text-[#1B2A4A] font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">cycle</span>
          Controle de Ciclo
        </button>
        <button
          onClick={() => setActiveTab("SUPERVISOR")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === "SUPERVISOR"
              ? "border-[#1B2A4A] text-[#1B2A4A] font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
          Nível de Serviço
        </button>
        <button
          onClick={() => setActiveTab("INVENTARIOS")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === "INVENTARIOS"
              ? "border-[#1B2A4A] text-[#1B2A4A] font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
          Calendário de Inventários
        </button>
        <button
          onClick={() => setActiveTab("CRITERIOS")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === "CRITERIOS"
              ? "border-[#1B2A4A] text-[#1B2A4A] font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">edit_note</span>
          Campos Almoxarife
        </button>
      </div>

      {/* ================= TAB 1: USERS ================= */}
      {activeTab === "USUARIOS" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b">
            <div>
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider">Usuários do Sistema</h3>
              <p className="text-[11.5px] text-slate-400">Total de {users.length} contas configuradas na base de dados.</p>
            </div>
            <button
              onClick={handleOpenNewUser}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">person_add</span>
              + Novo usuário
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-[10.5px] font-black text-slate-400 uppercase bg-slate-50/50">
                  <th className="p-3">Nome</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Perfil / Cargo</th>
                  <th className="p-3">Almoxarifados Vinculados</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => {
                  const isFernando = u.email === "estoque01jp@gmail.com";
                  return (
                    <tr key={u.email} className={`hover:bg-slate-50/65 transition-colors ${isFernando ? 'bg-amber-50/10' : ''}`}>
                      <td className="p-3 font-bold text-slate-800">
                        {u.name} {isFernando && <span className="bg-[#C8A84B] text-[#1B2A4A] text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 uppercase">Você</span>}
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{u.email}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                          u.role === "ADMIN"
                            ? "bg-slate-800 text-white"
                            : u.role === "SUPERVISOR"
                            ? "bg-violet-100 text-violet-800"
                            : "bg-blue-100 text-blue-900"
                        }`}>
                          {u.cargo || u.role}
                        </span>
                      </td>
                      <td className="p-3 max-w-[200px] truncate text-slate-600 font-medium">
                        {u.role === "ADMIN" ? (
                          <span className="italic text-slate-400">Acesso Geral</span>
                        ) : u.almoxarifados && u.almoxarifados.length > 0 ? (
                          u.almoxarifados.map((id) => {
                            const b = branches.find((br) => br.id === id);
                            return b ? b.name.replace("ALMOXARIFADO ", "") : id;
                          }).join(", ")
                        ) : (
                          <span className="text-rose-500 font-bold">Nenhum</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider ${
                          u.status === "SUSPENSO"
                            ? "bg-red-100 text-red-700 font-extrabold"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {u.status === "SUSPENSO" ? "🚫 Suspenso" : "✅ Ativo"}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          disabled={isFernando}
                          className={`px-2.5 py-1 text-[11.5px] rounded font-bold uppercase border transition ${
                            isFernando
                              ? "text-slate-350 bg-slate-50 border-slate-100 cursor-not-allowed"
                              : "text-blue-600 bg-blue-50/50 border-blue-100 hover:bg-blue-100 hover:text-blue-850"
                          }`}
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          disabled={isFernando}
                          className={`px-2 py-1 text-[11.5px] rounded font-bold uppercase border transition ${
                            isFernando
                              ? "text-slate-350 bg-slate-50 border-slate-100 cursor-not-allowed"
                              : u.status === "SUSPENSO"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100"
                              : "text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100"
                          }`}
                        >
                          {u.status === "SUSPENSO" ? "Reativar" : "Suspender"}
                        </button>

                        <button
                          onClick={() => handleRequestExcludeUser(u)}
                          disabled={isFernando}
                          className={`px-2 py-1 text-[11px] rounded font-bold uppercase border transition ${
                            isFernando
                              ? "text-slate-350 bg-slate-50 border-slate-100 cursor-not-allowed"
                              : "text-red-600 bg-red-50 border-red-150 hover:bg-red-100"
                          }`}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ALMOXARIFADOS ================= */}
      {activeTab === "ALMOXARIFADOS" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b">
            <div>
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider">Almoxarifados do Grupo</h3>
              <p className="text-xs text-slate-400 mt-1">Lista completa das unidades que participam do ranqueamento de auditoria preventiva mensal.</p>
            </div>
            <button
              onClick={() => setShowAddBranchModal(true)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">add_home_work</span>
              + Novo Almoxarifado
            </button>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-150 text-[10.5px] font-black text-slate-400 uppercase bg-slate-50/50">
                  <th className="p-3">ID</th>
                  <th className="p-3">Nome do Almoxarifado</th>
                  <th className="p-3">Localização Física</th>
                  <th className="p-3 bg-slate-50/20 text-center">Grupo</th>
                  <th className="p-3">Supervisor Nominal</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 font-mono text-[10.5px] text-slate-500">{b.id}</td>
                    <td className="p-3 font-bold text-slate-800">{b.name}</td>
                    <td className="p-3 text-slate-500">{b.location}</td>
                    <td className="p-3 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black">
                        {b.group}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-600">{b.ownerName}</td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingBranch(b);
                          setBranchFormName(b.name);
                        }}
                        className="px-2 py-1 bg-[#1B2A4A] hover:bg-slate-800 text-white rounded text-[11px] font-bold uppercase transition"
                      >
                        Editar Nome
                      </button>
                      <button
                        onClick={() => handleDeleteBranch(b.id, b.name)}
                        className="px-2 py-1 bg-red-50 text-red-650 hover:bg-red-100 border border-red-150 text-red-650 rounded text-[11px] font-bold uppercase transition"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: COLABORADORES ================= */}
      {activeTab === "COLABORADORES" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 space-y-5">
          <div>
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2">Colaboradores do Unimobin</h3>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre e gerencie a lista oficial de colaboradores que devem concluir o curso corporativo por almoxarifado. Os almoxarifes sobem os certificados exatamente com base nesta lista.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Direct selector */}
            <div className="bg-slate-50 p-4 rounded-xl border">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Filtrar por Almoxarifado</label>
              <select
                value={selectedCollabBranchId}
                onChange={(e) => setSelectedCollabBranchId(e.target.value)}
                className="w-full bg-white border border-slate-200 p-2 text-xs font-black rounded-lg focus:outline-none"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              {/* Add form */}
              <div className="mt-5 border-t pt-4 space-y-3">
                <span className="text-[10px] font-black text-[#1B2A4A] uppercase tracking-wider block">+ Novo Colaborador</span>
                <input
                  type="text"
                  placeholder="Nome completo do colaborador"
                  value={newCollabName}
                  onChange={(e) => setNewCollabName(e.target.value)}
                  className="w-full border border-slate-200 p-2 text-xs font-semibold rounded-lg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCollab}
                  disabled={!newCollabName.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-bold rounded-lg text-xs uppercase"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </div>

            {/* List */}
            <div className="md:col-span-2 border border-slate-100 rounded-xl p-4 space-y-2">
              <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider block">Colaboradores Cadastrados nesta Unidade</span>
              <div className="divide-y max-h-[300px] overflow-y-auto pr-1">
                {collabList.filter(c => c.branchId === selectedCollabBranchId).length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center italic">Nenhum colaborador registrado para esta filial.</p>
                ) : (
                  collabList
                    .filter(c => c.branchId === selectedCollabBranchId)
                    .map((collab) => (
                      <div key={collab.id} className="flex justify-between items-center py-2.5">
                        <span className="text-xs font-bold text-slate-700">{collab.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCollab(collab.id, collab.name)}
                          className="text-[10px] text-red-500 font-bold hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: GARANTIAS ================= */}
      {activeTab === "GARANTIAS" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 space-y-6">
          <div>
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2">Controle de Garantia — Matriz de Requisitos</h3>
            <p className="text-xs text-slate-400 mt-1">Altere a lista oficial de itens pré-cadastrados para o módulo de Controle de Garantias.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Box: Items */}
            <div className="border rounded-xl p-4 space-y-3 bg-slate-50/50">
              <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider block">Materiais de Garantia ({gItems.length})</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Cód. Material"
                  value={newGItem.code}
                  onChange={(e) => setNewGItem(prev => ({ ...prev, code: e.target.value }))}
                  className="w-1/3 bg-white border p-2 text-xs font-bold rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Descrição Completa"
                  value={newGItem.description}
                  onChange={(e) => setNewGItem(prev => ({ ...prev, description: e.target.value }))}
                  className="w-2/3 bg-white border p-2 text-xs font-semibold rounded-lg"
                />
                <button
                  onClick={handleAddGItem}
                  className="px-3 bg-emerald-600 text-white text-xs font-black rounded-lg uppercase"
                >
                  +
                </button>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-1.5 pt-2">
                {gItems.map((item) => (
                  <div key={item.code} className="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
                    <span className="font-bold text-slate-700 min-w-[70px] font-mono">{item.code}</span>
                    <span className="text-slate-600 truncate max-w-[250px] font-medium">{item.description}</span>
                    <button
                      onClick={() => handleRemoveGItem(item.code, item.description)}
                      className="text-[10px] text-red-500 font-extrabold hover:underline px-1"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Box: Manufacturers */}
            <div className="border rounded-xl p-4 space-y-3 bg-slate-50/50">
              <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider block">Fabricantes ({gManufacturers.length})</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome do Fabricante"
                  value={newGManufacturer}
                  onChange={(e) => setNewGManufacturer(e.target.value)}
                  className="w-full bg-white border p-2 text-xs font-medium rounded-lg"
                />
                <button
                  onClick={handleAddGManufacturer}
                  className="px-4 bg-emerald-600 text-white text-xs font-black rounded-lg uppercase"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pt-2">
                {gManufacturers.map((m) => (
                  <div key={m} className="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
                    <span className="font-bold text-slate-700 truncate">{m}</span>
                    <button
                      onClick={() => handleRemoveGManufacturer(m)}
                      className="text-[10px] text-red-500 font-bold hover:underline"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-slate-200 p-4 rounded-xl space-y-4 bg-slate-50/50 mt-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <span className="material-symbols-outlined text-amber-600 text-[20px]">security</span>
              <div>
                <span className="text-xs font-black text-[#1B2A4A] uppercase block font-sans">Permissões Especiais de Usuário (Fernando Silva)</span>
                <span className="text-[10px] text-slate-400 font-medium">Controle os direitos de alteração e reabertura de registros antigos ou finalizados.</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-500 text-[22px] shrink-0">history_toggle_off</span>
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Edição e reabertura de histórico de garantias</span>
                  <span className="text-[10px] text-slate-400 font-medium">Permite reabrir, editar e gravar modificações em itens de garantia históricos sem reabrir ciclo completo.</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!garantiaConfig.auditorEditHistory}
                  onChange={(e) => setGarantiaConfig(prev => ({ ...prev, auditorEditHistory: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-3 text-xs font-black text-emerald-700 w-16">
                  {garantiaConfig.auditorEditHistory ? "Ativado" : "Desativado"}
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: CONTROLE DE CICLO ================= */}
      {activeTab === "CICLO" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 space-y-6">
          <div>
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2">Controle do Ciclo de Auditoria</h3>
            <p className="text-xs text-slate-400 mt-1">Configure o mês ativo e manipule o status geral do ciclo de auditoria.</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <span className="text-[11px] font-black tracking-wider uppercase text-slate-400 block font-sans">Mês & Ano de Referência</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Mês</label>
                  <select
                    value={cycleMonth}
                    onChange={(e) => setCycleMonth(e.target.value)}
                    className="w-full bg-white border border-slate-250 p-2 text-xs font-black rounded-lg"
                  >
                    {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Ano</label>
                  <select
                    value={cycleYear}
                    onChange={(e) => setCycleYear(e.target.value)}
                    className="w-full bg-white border border-slate-250 p-2 text-xs font-black rounded-lg"
                  >
                    {["2026", "2027", "2028", "2029"].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateCycleState) {
                      onUpdateCycleState({
                        activeMonth: cycleMonth,
                        activeYear: cycleYear,
                        status: "ABERTO",
                        openedBy: "Fernando Silva",
                        openedAt: new Date().toLocaleDateString("pt-BR")
                      });
                      alert(`Novo ciclo aberto para ${cycleMonth}/${cycleYear}! Todos os almoxarifes passam a preencher este período.`);
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black uppercase text-xs rounded-xl tracking-wider shadow transition-all"
                >
                  Abrir Ciclo para {cycleMonth} {cycleYear}
                </button>
              </div>
            </div>

            {/* Right side: Cycle Status Info Panel */}
            <div className="border border-slate-200/65 rounded-xl bg-white p-4 space-y-4">
              <span className="text-[11px] font-black tracking-wider uppercase text-slate-400 block font-sans">Painel de Status do Ciclo Ativo</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase block font-sans">Status Atual</span>
                  <strong className="text-xs font-black text-slate-700 font-sans">
                    {cycleState?.status === "ABERTO" ? (
                      <span className="text-emerald-600">● CICLO ABERTO</span>
                    ) : cycleState?.status === "AGUARDANDO_FECHAMENTO" ? (
                      <span className="text-amber-600">● AVALIAÇÃO / PENDENTE</span>
                    ) : (
                      <span className="text-slate-400">● NENHUM CICLO ABERTO</span>
                    )}
                  </strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase block font-sans">Período Ativo</span>
                  <strong className="text-xs font-black text-indigo-700 font-sans">
                    {cycleState?.activeMonth} {cycleState?.activeYear}
                  </strong>
                </div>
              </div>

              {/* Action commands */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={cycleState?.status !== "ABERTO"}
                  onClick={() => {
                    if (onUpdateCycleState && cycleState) {
                      onUpdateCycleState({
                        ...cycleState,
                        status: "AGUARDANDO_FECHAMENTO"
                      });
                      alert("Envios dos almoxarifes bloqueados para início das avaliações do auditor.");
                    }
                  }}
                  className="w-full py-2 border rounded-lg text-xs font-black uppercase tracking-wider text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed justify-center flex items-center gap-1.5 transition-all font-sans"
                >
                  <span className="material-symbols-outlined text-[16px]">lock_clock</span>
                  BLOQUEAR ENVIOS (AVALIAR)
                </button>

                <button
                  type="button"
                  disabled={cycleState?.status === "NENHUM" || !onArchiveCycle}
                  onClick={() => {
                    if (!cycleState) return;
                    const challenge = prompt("Para arquivar e fechar o ciclo permanentemente, digite seu nome completo (Fernando Silva):");
                    if (challenge !== "Fernando Silva") {
                      alert("Entrada incorreta. Cancelado.");
                      return;
                    }
                    if (onArchiveCycle) {
                      onArchiveCycle(cycleState.activeMonth, cycleState.activeYear, 95);
                    }
                    if (onUpdateCycleState) {
                      onUpdateCycleState({
                        ...cycleState,
                        status: "NENHUM"
                      });
                    }
                    alert("Ciclo encerrado e arquivado permanentemente no Histórico!");
                  }}
                  className="w-full py-2 border rounded-lg text-xs font-black uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed justify-center flex items-center gap-1.5 transition-all font-sans"
                >
                  <span className="material-symbols-outlined text-[16px]">archive</span>
                  FECHAR E ARQUIVAR CICLO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 6: GERENCIAR FORMULÁRIO SUPERVISOR ================= */}
      {activeTab === "SUPERVISOR" && (
        <React.Fragment>
          <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 space-y-6">
            <div>
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2">Gerenciar Formulário — Nível de Serviço (Supervisor)</h3>
              <p className="text-xs text-slate-400 mt-1">Configure quais campos o supervisor preenche ao registrar furos de estoque.</p>
            </div>

            {/* List and add section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
              {/* Left Side: Fields list */}
              <div className="border border-slate-200/80 rounded-2xl bg-slate-50/50 p-4 space-y-4">
                <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider block font-sans">Campos do Formulário</span>

                <div className="space-y-2">
                  {supervisorFields.map((field: any, idx: number) => (
                    <div key={field.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
                      <div className="text-xs">
                        {field.builtIn ? (
                          <strong className="text-slate-705 font-bold">{field.name}</strong>
                        ) : (
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => {
                              const updated = [...supervisorFields];
                              updated[idx].name = e.target.value;
                              setSupervisorFields(updated);
                            }}
                            className="bg-slate-50 border border-slate-200 p-1 font-bold text-slate-750 text-xs rounded"
                          />
                        )}
                        <span className="block text-[10px] text-slate-400 mt-0.5 font-medium font-sans">
                          Tipo: <strong className="font-mono">{field.type}</strong> | {field.required ? "Obrigatório" : "Opcional"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Toggle Required (for custom ones mostly, but allow on any except solicitante) */}
                        {field.id !== "solicitante" && (
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => {
                                const updated = supervisorFields.map((f: any) =>
                                  f.id === field.id ? { ...f, required: e.target.checked } : f
                                );
                                setSupervisorFields(updated);
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider font-sans">Obrig.</span>
                          </label>
                        )}

                        {/* Delete button (except built-in ones) */}
                        {!field.builtIn && (
                          <button
                            type="button"
                            onClick={() => {
                              setSupervisorFields(supervisorFields.filter((f: any) => f.id !== field.id));
                            }}
                            className="text-[10px] font-black text-red-500 hover:underline hover:scale-105 transition-all font-sans"
                          >
                            Excluir
                          </button>
                        )}

                        {field.builtIn && (
                          <span className="text-[8.5px] px-1.5 py-0.5 bg-slate-100 text-slate-400 font-extrabold rounded uppercase font-sans">Fixo</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Add custom field form */}
              <SupervisorAddCustomFieldForm
                onAddField={(name, type, required, options) => {
                  const cleanedName = name.trim();
                  if (!cleanedName) {
                    alert("Por favor, digite um nome de campo.");
                    return;
                  }
                  const newField = {
                    id: "custom_" + Date.now(),
                    name: cleanedName,
                    type,
                    required,
                    options: type === "select" ? options : undefined,
                    builtIn: false
                  };
                  setSupervisorFields([...supervisorFields, newField]);
                  alert(`Campo "${cleanedName}" adicionado ao formulário com sucesso!`);
                }}
              />
            </div>
          </div>
        </React.Fragment>
      )}

      {/* ================= TAB 7: GERENCIAR CAMPOS DO ALMOXARIFE ================= */}
      {activeTab === "CRITERIOS" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 space-y-6">
          <div>
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2">Gerenciar Critérios e Campos do Almoxarife</h3>
            <p className="text-xs text-slate-400 mt-1 font-sans">Configure o que os almoxarifes precisam preencher ao enviar as evidências mensais.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {/* Box A: Garantia */}
            <div className="border border-slate-200 p-4 rounded-xl space-y-4 bg-white shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs font-black text-[#1B2A4A] uppercase font-sans">Controle de Garantia</span>
                <span className="text-[10px] text-slate-400 font-bold font-sans animate-pulse">Lançamento na aba própria</span>
              </div>

              <div className="space-y-2">
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Item / Descrição da Peça</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-sans">Obrigatório / Fixo</span>
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Garantia até (Vencimento)</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-sans">Obrigatório / Fixo</span>
                </div>

                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Fabricante</span>
                  <input
                    type="checkbox"
                    checked={garantiaConfig.fabricante}
                    onChange={(e) => setGarantiaConfig(prev => ({ ...prev, fabricante: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Nota Fiscal / Data de Emissão</span>
                  <input
                    type="checkbox"
                    checked={garantiaConfig.nfEmissionDate}
                    onChange={(e) => setGarantiaConfig(prev => ({ ...prev, nfEmissionDate: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Referência</span>
                  <input
                    type="checkbox"
                    checked={garantiaConfig.reference}
                    onChange={(e) => setGarantiaConfig(prev => ({ ...prev, reference: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Observação da Peça</span>
                  <input
                    type="checkbox"
                    checked={garantiaConfig.pieceObservation}
                    onChange={(e) => setGarantiaConfig(prev => ({ ...prev, pieceObservation: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Observação da Sucata</span>
                  <input
                    type="checkbox"
                    checked={garantiaConfig.scrapObservation}
                    onChange={(e) => setGarantiaConfig(prev => ({ ...prev, scrapObservation: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>

                {/* Custom fields in Garantia */}
                <AlmoxarifeCriteriaCustomFields
                  config={garantiaConfig}
                  onUpdateConfig={(next) => setGarantiaConfig(next)}
                />
              </div>
            </div>

            {/* Box B: TOP 10 */}
            <div className="border border-slate-200 p-4 rounded-xl space-y-4 bg-white shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs font-black text-[#1B2A4A] uppercase font-sans">02 - TOP 10 Peças</span>
                <span className="text-[10px] text-slate-400 font-bold font-sans">Contagem Física Rotativa</span>
              </div>

              <div className="space-y-2">
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Código & Nome do Material</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-sans">Obrigatório / Fixo</span>
                </div>

                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Quantidade Física Encontrada</span>
                  <input
                    type="checkbox"
                    checked={top10Config.quantidade}
                    onChange={(e) => setTop10Config(prev => ({ ...prev, quantidade: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-medium font-sans text-slate-705">
                  <span>Anexar Foto de Evidência</span>
                  <input
                    type="checkbox"
                    checked={top10Config.foto}
                    onChange={(e) => setTop10Config(prev => ({ ...prev, foto: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>

                {/* Custom fields in TOP 10 */}
                <AlmoxarifeCriteriaCustomFields
                  config={top10Config}
                  onUpdateConfig={(next) => setTop10Config(next)}
                />
              </div>
            </div>

            {/* Box C: LayOut */}
            <div className="border border-slate-200 p-4 rounded-xl space-y-4 bg-white shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs font-black text-[#1B2A4A] uppercase font-sans">04 - LayOut</span>
                <span className="text-[10px] text-slate-400 font-bold font-sans">Organização Estética</span>
              </div>

              <div className="space-y-2">
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-semibold font-sans text-slate-705">
                  <span>Localização Informada</span>
                  <input
                    type="checkbox"
                    checked={layoutConfig.localizacao}
                    onChange={(e) => setLayoutConfig(prev => ({ ...prev, localizacao: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-semibold font-sans text-slate-705">
                  <span>Anexar Fotos Estéticas (até 5)</span>
                  <input
                    type="checkbox"
                    checked={layoutConfig.fotos}
                    onChange={(e) => setLayoutConfig(prev => ({ ...prev, fotos: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-semibold font-sans text-slate-705">
                  <span>Comentário / Observações</span>
                  <input
                    type="checkbox"
                    checked={layoutConfig.comentario}
                    onChange={(e) => setLayoutConfig(prev => ({ ...prev, comentario: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>

                {/* Custom fields in LayOut */}
                <AlmoxarifeCriteriaCustomFields
                  config={layoutConfig}
                  onUpdateConfig={(next) => setLayoutConfig(next)}
                />
              </div>
            </div>

            {/* Box D: Unimobin */}
            <div className="border border-slate-200 p-4 rounded-xl space-y-4 bg-white shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs font-black text-[#1B2A4A] uppercase font-sans">08 - Unimobin</span>
                <span className="text-[10px] text-slate-400 font-bold font-sans">Certificações Unimobin</span>
              </div>

              <div className="space-y-2 font-medium">
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-semibold font-sans text-slate-705">
                  <span>Lista de Colaboradores</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Fixo</span>
                </div>
                <div className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded font-semibold font-sans text-slate-705">
                  <span>Anexo de PDF / Imagem de Certificado</span>
                  <input
                    type="checkbox"
                    checked={unimobinConfig.certificado}
                    onChange={(e) => setUnimobinConfig(prev => ({ ...prev, certificado: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded"
                  />
                </div>

                {/* Custom fields in Unimobin */}
                <AlmoxarifeCriteriaCustomFields
                  config={unimobinConfig}
                  onUpdateConfig={(next) => setUnimobinConfig(next)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 8: CALENDÁRIO DE INVENTÁRIOS ================= */}
      {activeTab === "INVENTARIOS" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                📅 Calendário de Inventários
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Configure as datas de realização dos inventários por almoxarifado e semestre.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-extrabold text-[#1B2A4A] uppercase">Ano:</span>
              <select
                value={calendarYear}
                onChange={(e) => setCalendarYear(Math.max(2026, parseInt(e.target.value) || 2026))}
                className="border border-slate-200 rounded-lg bg-white px-3 py-1.5 text-xs text-[#1B2A4A] font-black focus:outline-none"
              >
                {[2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCalendarYear(prev => Math.max(2026, prev - 1))}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold transition-colors flex items-center gap-1 text-[11px]"
              >
                <span>&lt; Ano anterior</span>
              </button>
              <button
                type="button"
                onClick={() => setCalendarYear(prev => prev + 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold transition-colors flex items-center gap-1 text-[11px]"
              >
                <span>Próximo ano &gt;</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-250/50 rounded-2xl">
            <table className="w-full text-left font-sans text-xs">
              <thead className="bg-[#1B2A4A] text-white uppercase tracking-wider font-extrabold text-[10px]">
                <tr>
                  <th className="p-3.5 w-1/3">Almoxarifado</th>
                  <th className="p-3.5 w-1/3 border-l border-slate-700/50">1º Semestre</th>
                  <th className="p-3.5 w-1/3 border-l border-slate-700/50">2º Semestre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {activeAlmoxNames.map((almox) => {
                  const s1Items = calendarData.filter(d => d.almoxarifado === almox && d.ano === calendarYear && d.semestre === 1).sort((a,b) => a.indice - b.indice);
                  const s2Items = calendarData.filter(d => d.almoxarifado === almox && d.ano === calendarYear && d.semestre === 2).sort((a,b) => a.indice - b.indice);

                  const s1ToRender = s1Items.length > 0 ? s1Items : [{ id: `cal-${almox.replace(/\s+/g, "_")}-${calendarYear}-1-1`, almoxarifado: almox, ano: calendarYear, semestre: 1, indice: 1, data_agendada: "" }];
                  const s2ToRender = s2Items.length > 0 ? s2Items : [{ id: `cal-${almox.replace(/\s+/g, "_")}-${calendarYear}-2-1`, almoxarifado: almox, ano: calendarYear, semestre: 2, indice: 1, data_agendada: "" }];

                  return (
                    <tr key={almox} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5 font-bold text-[#1B2A4A] text-xs">
                        {almox}
                      </td>
                      <td className="p-3.5 border-l border-slate-100">
                        <div className="space-y-2">
                          {s1ToRender.map((item) => {
                            const isReal = calendarData.some(d => d.id === item.id);
                            return (
                              <div key={item.id} className="flex items-center gap-1.5">
                                <input
                                  type="date"
                                  value={item.data_agendada}
                                  onChange={(e) => updateCalendarItem(item.id, almox, 1, item.indice, e.target.value)}
                                  className="border border-slate-250 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono tracking-wide focus:outline-none focus:border-[#1B2A4A] w-[145px]"
                                />
                                {isReal && (
                                  <button
                                    type="button"
                                    onClick={() => removeCalendarItem(item.id)}
                                    className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors flex items-center justify-center border border-red-100"
                                    title="Remover data"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">delete</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => addCalendarItem(almox, 1)}
                            className="bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-0.5 mt-1 active:scale-95 transition-all w-fit"
                          >
                            <span className="material-symbols-outlined text-[11px] font-bold">add</span>
                            + Add
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 border-l border-slate-100">
                        <div className="space-y-2">
                          {s2ToRender.map((item) => {
                            const isReal = calendarData.some(d => d.id === item.id);
                            return (
                              <div key={item.id} className="flex items-center gap-1.5">
                                <input
                                  type="date"
                                  value={item.data_agendada}
                                  onChange={(e) => updateCalendarItem(item.id, almox, 2, item.indice, e.target.value)}
                                  className="border border-slate-250 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono tracking-wide focus:outline-none focus:border-[#1B2A4A] w-[145px]"
                                />
                                {isReal && (
                                  <button
                                    type="button"
                                    onClick={() => removeCalendarItem(item.id)}
                                    className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors flex items-center justify-center border border-red-100"
                                    title="Remover data"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">delete</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => addCalendarItem(almox, 2)}
                            className="bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-0.5 mt-1 active:scale-95 transition-all w-fit"
                          >
                            <span className="material-symbols-outlined text-[11px] font-bold">add</span>
                            + Add
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <button
              type="button"
              onClick={handleSaveCalendar}
              className="px-6 py-2.5 bg-[#1B2A4A] hover:bg-slate-800 active:scale-95 text-white font-black uppercase text-xs rounded-xl shadow-md tracking-wider transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              Salvar calendário
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE / EDIT USER ================= */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <header className="border-b pb-3 mb-4">
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider">
                {editingUser ? `Editar Usuário — ${editingUser.name}` : "Criar Novo Usuário"}
              </h3>
            </header>

            <form onSubmit={handleSaveUser} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Robson da Silva"
                    className="w-full border border-slate-200 p-2.5 text-xs font-bold rounded-lg focus:outline-[#1B2A4A] mt-1"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase font-mono">E-mail Corporativo *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="robson@acandidogrupo.com.br"
                    className="w-full border border-slate-200 p-2.5 text-xs font-bold rounded-lg focus:outline-[#1B2A4A] mt-1 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {editingUser && <span className="text-[9.5px] text-slate-400 font-medium">Chave única — Inalterável</span>}
                </div>
              </div>

              {/* Password Section */}
              <div className="bg-slate-50 p-3.5 rounded-xl border space-y-3">
                <span className="text-[10px] font-black text-[#1B2A4A] uppercase block">
                  {editingUser ? "Alterar Senha ( deixe em branco para não alterar )" : "Senha de Acesso *"}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Senha</label>
                    <div className="relative flex items-center">
                      <input
                        type={showPasswordText ? "text" : "password"}
                        required={!editingUser}
                        value={userForm.password}
                        onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full border border-slate-200 p-2.5 pr-10 text-xs font-bold rounded-lg focus:outline-[#1B2A4A] mt-1 bg-white"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        <span className="material-symbols-outlined text-[16px]">{showPasswordText ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Confirmar Senha</label>
                    <div className="relative flex items-center">
                      <input
                        type={showConfirmPasswordText ? "text" : "password"}
                        required={!editingUser && !!userForm.password}
                        value={userForm.confirmPassword}
                        onChange={(e) => setUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full border border-slate-200 p-2.5 pr-10 text-xs font-bold rounded-lg focus:outline-[#1B2A4A] mt-1 bg-white"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPasswordText(!showConfirmPasswordText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        <span className="material-symbols-outlined text-[16px]">{showConfirmPasswordText ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Position and limits configs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={userForm.role === "ADMIN" ? "col-span-2" : ""}>
                  <label className="text-[11px] font-black text-slate-400 uppercase block">Perfil *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value as AppUser["role"] }))}
                    className="w-full border border-slate-200 p-2.5 text-xs font-black rounded-lg focus:outline-[#1B2A4A] mt-1 bg-white"
                  >
                    <option value="ALMOXARIFE">Almoxarife</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="ADMIN">Auditor</option>
                  </select>
                </div>

                {userForm.role !== "ADMIN" && (
                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase block">Pontuação / Grupo *</label>
                    <select
                      value={userForm.group}
                      onChange={(e) => setUserForm(prev => ({ ...prev, group: e.target.value as AppUser["group"] }))}
                      className="w-full border border-slate-200 p-2.5 text-xs font-black rounded-lg focus:outline-[#1B2A4A] mt-1 bg-white"
                    >
                      <option value="A">Grupo A - Alto Fluxo</option>
                      <option value="B">Grupo B - Apoio</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Multi Select Almoxarifados */}
              {userForm.role !== "ADMIN" && (
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase block mb-1">Almoxarifado(s) Vinculado(s) *</label>
                  <div className="border border-slate-200 rounded-lg p-3 max-h-[160px] overflow-y-auto space-y-1.5 bg-white">
                    {branches.map(b => {
                      const isChecked = userForm.almoxarifados.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2 cursor-pointer select-none py-0.5 text-xs font-medium text-slate-700 hover:text-black">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setUserForm(prev => ({
                                  ...prev,
                                  almoxarifados: prev.almoxarifados.filter(id => id !== b.id)
                                }));
                              } else {
                                setUserForm(prev => ({
                                  ...prev,
                                  almoxarifados: [...prev.almoxarifados, b.id]
                                }));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-[#1B2A4A] focus:ring-[#1B2A4A]"
                          />
                          <span>{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                    Permite o login e a visibilidade exclusiva destas filiais. Selecione 2 para habilitar tratamento de garagem dupla automaticamente.
                  </span>
                </div>
              )}

              <div className="border-t pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B2A4A] hover:bg-[#121C34] text-white rounded-lg text-xs font-black uppercase tracking-wider shadow"
                >
                  {editingUser ? "Salvar Alterações" : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT BRANCH NAME ================= */}
      {editingBranch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2 mb-4">Editar Almoxarifado</h3>
            <div className="space-y-4">
              <div className="text-xs space-y-1">
                <span className="text-slate-400">ID Identificador:</span>
                <p className="font-mono bg-slate-100 p-2 rounded text-slate-700">{editingBranch.id}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block">Nome Exibido</label>
                <input
                  type="text"
                  value={branchFormName}
                  onChange={(e) => setBranchFormName(e.target.value.toUpperCase())}
                  className="w-full border border-slate-200 p-2.5 text-xs font-bold rounded-lg focus:outline-[#1B2A4A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  onClick={() => setEditingBranch(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 border rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveBranchName}
                  className="px-3 py-1.5 bg-[#1B2A4A] text-white text-xs font-black uppercase rounded shadow"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADICIONAR ALMOXARIFADO ================= */}
      {showAddBranchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">add_home_work</span>
              Novo Almoxarifado
            </h3>
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block">Nome do Almoxarifado</label>
                <input
                  type="text"
                  placeholder="EX: TRANS CG / EXP"
                  value={newBranchForm.name}
                  onChange={(e) => setNewBranchForm(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                  className="w-full border border-slate-200 p-2.5 text-xs font-bold rounded-lg focus:outline-[#1B2A4A]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block">Localização Física</label>
                <input
                  type="text"
                  placeholder="EX: Campina Grande, PB"
                  value={newBranchForm.location}
                  onChange={(e) => setNewBranchForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full border border-slate-200 p-2.5 text-xs font-bold rounded-lg focus:outline-[#1B2A4A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Grupo de Ranqueamento</label>
                  <select
                    value={newBranchForm.group}
                    onChange={(e) => setNewBranchForm(prev => ({ ...prev, group: e.target.value as "A" | "B" }))}
                    className="w-full border border-slate-200 p-2.5 text-xs font-bold rounded-lg focus:outline-[#1B2A4A]"
                  >
                    <option value="A">Grupo A</option>
                    <option value="B">Grupo B</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Meta Preventiva (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newBranchForm.meta}
                    onChange={(e) => setNewBranchForm(prev => ({ ...prev, meta: Number(e.target.value) || 80 }))}
                    className="w-full border border-slate-200 p-2.5 text-xs font-bold rounded-lg focus:outline-[#1B2A4A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block">Supervisor Responsável</label>
                <input
                  type="text"
                  placeholder="Nome do Supervisor"
                  value={newBranchForm.ownerName}
                  onChange={(e) => setNewBranchForm(prev => ({ ...prev, ownerName: e.target.value }))}
                  className="w-full border border-slate-200 p-2.5 text-xs font-bold rounded-lg focus:outline-[#1B2A4A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 border rounded-lg transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNewBranch}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-750 text-white text-xs font-black uppercase rounded-lg shadow-sm transition-all active:scale-95"
                >
                  Criar Almoxarifado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PERMANENTLY EXCLUDE USER ================= */}
      {userToExclude && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200">
            <header className="border-b border-red-100 pb-3 mb-4 flex items-center gap-2 text-red-600">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-sm font-black uppercase tracking-wider">🚫 Excluir Usuário Permanentemente</h3>
            </header>

            <div className="space-y-4 text-xs">
              <p className="leading-relaxed font-semibold text-slate-800">
                Você está prestes a excluir o usuário <span className="font-black text-red-650 underline">{userToExclude.name}</span> ({userToExclude.email}).
                Esta ação <strong className="font-black">não pode ser desfeita</strong>.
              </p>

              <div className="bg-red-50 text-red-900 rounded-xl p-3.5 space-y-1.5 leading-normal">
                <span className="font-bold block">O que acontece ao excluir:</span>
                <p>• Login bloqueado imediatamente no sistema.</p>
                <p>• Dados históricos preservados nos relatórios consolidados.</p>
                <p>• Nome aparece como "Usuário removido" no histórico de avaliações.</p>
                <p>• Não é possível recuperar o acesso depois.</p>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase block">Digite o nome do usuário para confirmar:</label>
                <input
                  type="text"
                  value={excludeTypedName}
                  onChange={(e) => setExcludeTypedName(e.target.value)}
                  placeholder={userToExclude.name}
                  className="w-full border border-slate-300 p-2.5 text-xs font-bold rounded-lg focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setUserToExclude(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExcludeUser}
                  disabled={excludeTypedName.trim() !== userToExclude.name.trim()}
                  className={`px-4 py-2 text-white text-xs font-black uppercase rounded-lg shadow ${
                    excludeTypedName.trim() === userToExclude.name.trim()
                      ? "bg-red-600 hover:bg-red-700 cursor-pointer active:scale-95"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed border"
                  }`}
                >
                  Excluir permanentemente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CUSTOM iframe-safe CONFIRMATION ================= */}
      {customConfirm && customConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <header className="border-b border-slate-100 pb-2 mb-4 flex items-center gap-2 text-[#1B2A4A]">
              <span className="material-symbols-outlined text-[24px]">help_center</span>
              <h3 className="text-sm font-black uppercase tracking-wider">{customConfirm.title}</h3>
            </header>

            <div className="space-y-4 text-xs font-sans">
              <p className="leading-relaxed font-semibold text-slate-800">
                {customConfirm.message}
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setCustomConfirm(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={customConfirm.onConfirm}
                  className="px-4 py-2 bg-[#1B2A4A] hover:bg-slate-800 text-white text-xs font-black uppercase rounded-lg shadow transition-all active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for adding custom fields in Supervisor manager
function SupervisorAddCustomFieldForm({ onAddField }: { onAddField: (name: string, type: string, required: boolean, options?: string[]) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "number" | "date" | "select">("text");
  const [required, setRequired] = useState(false);
  const [optionsStr, setOptionsStr] = useState("");

  return (
    <div className="border border-slate-200 bg-white p-4 rounded-2xl space-y-3 shadow-xs">
      <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider block">+ Adicionar Campo Personalizado</span>

      <div className="space-y-2">
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Nome do Campo (Label)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Local de Furo, Tipo de Veículo..."
            className="w-full border border-slate-200 p-2 text-xs font-medium rounded-lg mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Tipo de Entrada</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full border border-slate-200 p-2 text-xs font-black rounded-lg mt-1 bg-white"
            >
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="date">Calendário / Data</option>
              <option value="select">Dropdown / Seleção</option>
            </select>
          </div>

          <div className="flex items-end pb-1.5 pl-1">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4 rounded text-[#1B2A4A]"
              />
              <span className="text-[10px] font-black text-slate-450 uppercase font-sans">Obrigatório</span>
            </label>
          </div>
        </div>

        {type === "select" && (
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Opções do Dropdown (Uma por linha)</label>
            <textarea
              value={optionsStr}
              onChange={(e) => setOptionsStr(e.target.value)}
              placeholder="Opção A&#10;Opção B&#10;Opção C"
              rows={3}
              className="w-full border border-slate-200 p-2 text-xs font-semibold rounded-lg mt-1"
            />
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              const options = optionsStr.split("\n").map(op => op.trim()).filter(Boolean);
              onAddField(name, type, required, options);
              setName("");
              setOptionsStr("");
              setRequired(false);
            }}
            className="w-full py-2 bg-[#1B2A4A] text-white font-black uppercase text-xs rounded-xl tracking-wider shadow"
          >
            Adicionar Campo Novo
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-component for adding custom fields to Almoxarife criteria
function AlmoxarifeCriteriaCustomFields({ config, onUpdateConfig }: { config: any; onUpdateConfig: (next: any) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "number" | "select">("text");
  const [optionsStr, setOptionsStr] = useState("");

  const handleAdd = () => {
    const label = name.trim();
    if (!label) {
      alert("Digite o nome do campo.");
      return;
    }
    const safeId = "alm_cust_" + Date.now();
    const options = type === "select" ? optionsStr.split("\n").map(op => op.trim()).filter(Boolean) : undefined;
    const newField = { id: safeId, name: label, type, options, required: false };
    onUpdateConfig({
      ...config,
      customFields: [...(config.customFields || []), newField]
    });
    setName("");
    setOptionsStr("");
  };

  const handleRemove = (id: string) => {
    onUpdateConfig({
      ...config,
      customFields: (config.customFields || []).filter((f: any) => f.id !== id)
    });
  };

  return (
    <div className="border-t pt-3 mt-3 space-y-2">
      <span className="text-[10px] font-black text-slate-450 uppercase tracking-wide block font-sans">Campos Personalizados Ativos:</span>
      <div className="space-y-1 mt-1 max-h-[110px] overflow-y-auto">
        {(config.customFields || []).map((f: any) => (
          <div key={f.id} className="flex justify-between items-center text-[11px] bg-slate-50 p-1.5 rounded">
            <strong>{f.name} <span className="text-slate-405 font-medium">({f.type})</span></strong>
            <button type="button" onClick={() => handleRemove(f.id)} className="text-[10px] text-red-500 font-bold hover:underline font-sans">
              Remover
            </button>
          </div>
        ))}
        {(config.customFields || []).length === 0 && (
          <span className="text-[10px] text-slate-400 italic font-medium block font-sans">Nenhum campo adicional configurado.</span>
        )}
      </div>

      <div className="bg-slate-50 border p-2.5 rounded-lg space-y-2 mt-2">
        <label className="text-[9.5px] font-black text-indigo-700 uppercase tracking-wide block font-sans">+ Campo Personalizado</label>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="text"
            placeholder="Nome do campo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border bg-white text-[11.5px] p-1 font-bold rounded focus:outline-none"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="border bg-white text-[11px] p-1 font-bold rounded focus:outline-none"
          >
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="select">Dropdown</option>
          </select>
        </div>

        {type === "select" && (
          <textarea
            placeholder="Opções (várias linhas)"
            rows={2}
            value={optionsStr}
            onChange={(e) => setOptionsStr(e.target.value)}
            className="border bg-white text-[11px] p-1 font-semibold rounded w-full focus:outline-none"
          />
        )}

        <button type="button" onClick={handleAdd} className="w-full py-1 text-[10px] bg-[#1B2A4A] text-white font-black uppercase rounded mt-1 shadow-xs font-sans">
          Adicionar ao Almoxarife
        </button>
      </div>
    </div>
  );
}
