import React, { useState, useEffect } from "react";
import { Branch, CriterionState, EvaluationStatus } from "../types";
import { initialCertificates, getCollaboratorsForBranch } from "../mockData";
import AdminGarantiasPanel from "./AdminGarantiasPanel";
import AdminServicosPanel from "./AdminServicosPanel";
import { dbSaveTop10Config, dbFetchTop10Config, isSupabaseReady } from "../supabaseService";

interface AdminEvaluationDetailProps {
  branch: Branch;
  allBranches?: Branch[];
  onBack: () => void;
  onUpdateCriteria: (branchId: string, updatedCriteria: CriterionState[]) => void;
  isSemestralMonth: boolean;
  activeMonth?: string;
  activeYear?: string;
}

export default function AdminEvaluationDetail({
  branch,
  allBranches = [],
  onBack,
  onUpdateCriteria,
  isSemestralMonth,
  activeMonth,
  activeYear,
}: AdminEvaluationDetailProps) {
  const isCycleClosed = (() => {
    try {
      const m = activeMonth || "Janeiro";
      const y = activeYear || "2026";
      const savedCycles = localStorage.getItem("acandido_all_cycles_list");
      if (savedCycles) {
        const list = JSON.parse(savedCycles);
        if (Array.isArray(list)) {
          const match = list.find(c => c.activeMonth === m && c.activeYear === y);
          if (match) {
            return match.status === "NENHUM" || match.status === "FECHADO" || match.status === "ARQUIVADO";
          }
        }
      }
      const saved = localStorage.getItem("acandido_cycle_state_manual");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeMonth === m && parsed.activeYear === y) {
          return parsed.status === "NENHUM" || parsed.status === "FECHADO" || parsed.status === "ARQUIVADO";
        }
      }
    } catch (e) {}
    return false;
  })();

  const [showLayoutConfigModal, setShowLayoutConfigModal] = useState(false);
  const [layoutLocationInput, setLayoutLocationInput] = useState("");
  const [layoutInstructionsInput, setLayoutInstructionsInput] = useState("");
  const [layoutConfigUpdatedCount, setLayoutConfigUpdatedCount] = useState(0);

  // TOP 10 monthly configuration states and helper
  const [showTop10ConfigModal, setShowTop10ConfigModal] = useState(false);
  const [top10ItemsInput, setTop10ItemsInput] = useState<{ code: string; description: string; qty: number }[]>([]);
  const [top10ConfigUpdatedCount, setTop10ConfigUpdatedCount] = useState(0);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"AUDITORIA" | "GARANTIAS" | "SERVICOS">("AUDITORIA");

  const cycleStateParsed = (() => {
    let m = activeMonth || "Janeiro";
    let y = activeYear || "2026";
    let s: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM" = "ABERTO";

    try {
      const saved = localStorage.getItem("acandido_cycle_state_manual");
      if (saved) {
        const parsed = JSON.parse(saved);
        s = parsed.status || "ABERTO";
        if (!activeMonth && parsed.activeMonth) m = parsed.activeMonth;
        if (!activeYear && parsed.activeYear) y = parsed.activeYear;
      }
    } catch (e) {}
    return { activeMonth: m, activeYear: y, status: s };
  })();

  // Synchronically load remote configuration on branch/cycle change
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (isSupabaseReady()) {
          const remoteConfig = await dbFetchTop10Config(
            branch.id,
            cycleStateParsed.activeMonth,
            cycleStateParsed.activeYear
          );
          if (remoteConfig?.itens) {
            const key = `acandido_top10_config_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`;
            localStorage.setItem(key, JSON.stringify({ itens: remoteConfig.itens }));
            setTop10ConfigUpdatedCount((prev) => prev + 1);
          }
        }
      } catch (error) {
        console.error("Error fetching Top 10 configuration:", error);
      }
    };
    loadConfig();
  }, [branch.id, cycleStateParsed.activeMonth, cycleStateParsed.activeYear]);

  // Synchronize the currently selected criterion with reactive props changes (Supabase Realtime)
  useEffect(() => {
    if (!selectedCriterion) return;
    const latestMatched = branch.criteria.find(c => c.id === selectedCriterion.id);
    if (latestMatched) {
      setSelectedCriterion(latestMatched);
      setStatusInput(latestMatched.status);
      setPtsInput(latestMatched.pointsObtained);
      setNotesInput(latestMatched.notes || latestMatched.evidenceNotes || "");
      if (latestMatched.nokEvidenceLink) {
        setNokEvidenceLinkInput(latestMatched.nokEvidenceLink);
      }
    }
  }, [branch.criteria]);

  const layoutConfig = (() => {
    const _dummy = layoutConfigUpdatedCount;
    const key = `acandido_layout_config_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  })();

  const handleOpenLayoutConfig = () => {
    const key = `acandido_layout_config_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLayoutLocationInput(parsed.location || "");
        setLayoutInstructionsInput(parsed.instructions || "");
      } catch (e) {
        setLayoutLocationInput("");
        setLayoutInstructionsInput("");
      }
    } else {
      setLayoutLocationInput("");
      setLayoutInstructionsInput("");
    }
    setShowLayoutConfigModal(true);
  };

  const handleSaveLayoutConfig = () => {
    if (!layoutLocationInput.trim()) {
      alert("Por favor, insira a localização a ser auditada.");
      return;
    }
    const key = `acandido_layout_config_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`;
    localStorage.setItem(key, JSON.stringify({
      location: layoutLocationInput.trim(),
      instructions: layoutInstructionsInput.trim()
    }));
    setLayoutConfigUpdatedCount(prev => prev + 1);
    setShowLayoutConfigModal(false);
    alert("Configuração do LayOut para este almoxarifado salva com sucesso!");
  };

  const top10Config = (() => {
    const _dummy = top10ConfigUpdatedCount;
    const key = `acandido_top10_config_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  })();

  const handleOpenTop10Config = () => {
    const key = `acandido_top10_config_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.itens && Array.isArray(parsed.itens)) {
          setTop10ItemsInput(parsed.itens);
          setShowTop10ConfigModal(true);
          return;
        }
      } catch (e) {}
    }
    setTop10ItemsInput([{ code: "", description: "", qty: 1 }]);
    setShowTop10ConfigModal(true);
  };

  const handleSaveTop10Config = async () => {
    if (top10ItemsInput.length === 0) {
      alert("Por favor, adicione pelo menos 1 item na lista antes de salvar.");
      return;
    }
    if (top10ItemsInput.length > 10) {
      alert("O limite máximo de itens configurados no TOP 10 é de 10 itens.");
      return;
    }
    for (let i = 0; i < top10ItemsInput.length; i++) {
      const item = top10ItemsInput[i];
      if (!item.code.trim() || !item.description.trim()) {
        alert(`Por favor, preencha o código e a descrição do item Nº ${i + 1}.`);
        return;
      }
    }
    const key = `acandido_top10_config_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`;
    const mappedItems = top10ItemsInput.map(it => ({
      code: it.code.trim(),
      description: it.description.trim(),
      qty: 1
    }));

    localStorage.setItem(key, JSON.stringify({
      itens: mappedItems
    }));

    let userName = "Auditor";
    try {
      const su = localStorage.getItem("acandido_app_user");
      if (su) {
        userName = JSON.parse(su).name || "Auditor";
      }
    } catch (e) {}

    try {
      if (isSupabaseReady()) {
        await dbSaveTop10Config(
          branch.id,
          cycleStateParsed.activeMonth,
          cycleStateParsed.activeYear,
          mappedItems,
          userName
        );
      }
    } catch (error) {
      console.error("Failed to save Top 10 config to database:", error);
    }

    setTop10ConfigUpdatedCount(prev => prev + 1);
    setShowTop10ConfigModal(false);
    window.dispatchEvent(new Event("storage"));
    alert("Lista de TOP 10 deste mês salva com sucesso e enviada ao almoxarife!");
  };

  const handleAddTop10Row = () => {
    if (top10ItemsInput.length >= 10) {
      alert("O limite máximo de itens configurados no TOP 10 é de 10 itens.");
      return;
    }
    setTop10ItemsInput(prev => [...prev, { code: "", description: "", qty: 1 }]);
  };

  const handleRemoveTop10Row = (index: number) => {
    setTop10ItemsInput(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTop10Row = (index: number, field: "code" | "description" | "qty", value: any) => {
    setTop10ItemsInput(prev => prev.map((item, idx) => {
      if (idx === index) {
        let val = value;
        if (field === "code") {
          val = value.toUpperCase();
        }
        return {
          ...item,
          [field]: val
        };
      }
      return item;
    }));
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCriterion, setSelectedCriterion] = useState<CriterionState | null>(null);
  const [top10AuditorQuantitiesInput, setTop10AuditorQuantitiesInput] = useState<Record<string, string>>({});

  const [warranties] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("acandido_warranties");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [auditorMonthFilter, setAuditorMonthFilter] = useState("Junho 2026");

  // Bottom Sheet/Modal working states
  const [statusInput, setStatusInput] = useState<EvaluationStatus>("OK");
  const [ptsInput, setPtsInput] = useState<number>(0);
  const [notesInput, setNotesInput] = useState("");
  const [evidenceNotesInput, setEvidenceNotesInput] = useState("");
  const [photosInput, setPhotosInput] = useState("");
  const [nokEvidenceLinkInput, setNokEvidenceLinkInput] = useState("");
  const [nokLink1Input, setNokLink1Input] = useState("");
  const [nokLink2Input, setNokLink2Input] = useState("");
  const [nokLink3Input, setNokLink3Input] = useState("");
  const [nokEvidenceDescriptionInput, setNokEvidenceDescriptionInput] = useState("");
  const [auditorCerts, setAuditorCerts] = useState<any[]>([]);
  const [branchCalendar, setBranchCalendar] = useState<any[]>([]);
  const [nokEvidenceFileName, setNokEvidenceFileName] = useState("");
  const [nokEvidenceFileType, setNokEvidenceFileType] = useState("");
  const [nokEvidenceFileData, setNokEvidenceFileData] = useState("");

  const [showNokConfirm, setShowNokConfirm] = useState(false);
  const [selectedMaterialCode, setSelectedMaterialCode] = useState<string | null>(null);
  
  const defaultMaterialsPerBranch: { [key: string]: { code: string; name: string; status: "OK" | "NOK" }[] } = {
    "unitrans-jp": [
      { code: "M001", name: "Amortecedor Dianteiro OF1721", status: "OK" },
      { code: "M002", name: "Radiador de Água Mercedes Bus", status: "OK" }
    ],
    "santa-maria-jp": [
      { code: "M003", name: "Tambor de Freio Traseiro Bus", status: "OK" },
      { code: "M004", name: "Alternador Bosch 24V", status: "OK" }
    ],
    "expresso-nacional": [
      { code: "M005", name: "Correia Dentada Gates Neobus", status: "OK" },
      { code: "M006", name: "Sensor de Pressão Pneumática", status: "OK" }
    ],
    "acandido-cg": [
      { code: "M007", name: "Farol Dianteiro Marcopolo G7", status: "OK" },
      { code: "M008", name: "Junta de Cabeçote OF1721- Mercedes", status: "OK" }
    ],
    "fretamento-jaboatao": [
      { code: "M009", name: "Servo de Embreagem Knorr", status: "OK" },
      { code: "M010", name: "Parachoque Traseiro Marcopolo Ideale", status: "OK" }
    ],
    "rodoviario-jaboatao": [
      { code: "M011", name: "Disco de Embreagem Bus OF1724", status: "OK" },
      { code: "M012", name: "Compressor de Ar Knorr-Bremse", status: "OK" }
    ],
    "fretamento-maracanau": [
      { code: "M013", name: "Cilindro de Freio Traseiro Bosch", status: "OK" },
      { code: "M014", name: "Válvula Governadora Bosch", status: "OK" }
    ],
    "rodoviario-fortaleza": [
      { code: "M015", name: "Palheta de Limpador de Parabrisa G7", status: "OK" },
      { code: "M016", name: "Retrovisor Direito Marcopolo", status: "OK" }
    ],
    "fretamento-pb": [
      { code: "M017", name: "Bucha de Balança Traseira OF1519", status: "OK" },
      { code: "M018", name: "Cardan Auxiliar com Retentor", status: "OK" }
    ],
    "fretamento-goiana": [
      { code: "M019", name: "Intercooler Mercedes OF1721 BlueTec", status: "OK" },
      { code: "M020", name: "Bomba de Água Urba Bus", status: "OK" }
    ],
    "trans-cg-bayeux": [
      { code: "M021", name: "Rolamento Dianteiro Timken 1721", status: "OK" },
      { code: "M022", name: "Pivô de Suspensão Mercedes Bus", status: "OK" }
    ],
    "rodoviario-cabedelo": [
      { code: "M023", name: "Filtro de Ar Primário Mann-Filter", status: "OK" },
      { code: "M024", name: "Terminal de Direção Lado Esquerdo OF", status: "OK" }
    ],
    "unissana-rn": [
      { code: "M025", name: "Termostato Motor MWM Bus", status: "OK" },
      { code: "M026", name: "Retentor de Cubo Traseiro Sabó", status: "OK" }
    ],
    "reunidas-nat": [
      { code: "M027", name: "Filtro de Combustível Secundário WEG", status: "OK" },
      { code: "M028", name: "Mola Mestra Traseira Mercedes OF1721", status: "OK" }
    ]
  };

  const [branchMaterials, setBranchMaterials] = useState<any[]>(() => {
    const storageKey = `acandido_materials_parados_${branch.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return defaultMaterialsPerBranch[branch.id] || [
      { code: "M999", name: "Material Geral Sem Giro", status: "OK" }
    ];
  });

  const handleUpdateMaterialStatus = (code: string, newStatus: "OK" | "NOK") => {
    const updated = branchMaterials.map(m => m.code === code ? { ...m, status: newStatus } : m);
    setBranchMaterials(updated);
    localStorage.setItem(`acandido_materials_parados_${branch.id}`, JSON.stringify(updated));
    
    const anyNok = updated.some(m => m.status === "NOK");
    if (anyNok) {
      handleStatusChange("NOK");
    } else {
      handleStatusChange("OK");
    }
  };

  const [newMaterialCode, setNewMaterialCode] = useState("");
  const [newMaterialName, setNewMaterialName] = useState("");

  const handleAddMaterial = () => {
    if (!newMaterialCode.trim() || !newMaterialName.trim()) {
      alert("Por favor, preencha o código e a descrição do material.");
      return;
    }
    if (branchMaterials.some(m => m.code === newMaterialCode)) {
      alert("Já existe um material cadastrado com este código.");
      return;
    }
    const newMat = { code: newMaterialCode.trim(), name: newMaterialName.trim(), status: "OK" as const };
    const updated = [...branchMaterials, newMat];
    setBranchMaterials(updated);
    localStorage.setItem(`acandido_materials_parados_${branch.id}`, JSON.stringify(updated));
    setNewMaterialCode("");
    setNewMaterialName("");
    
    const anyNok = updated.some(m => m.status === "NOK");
    if (anyNok) {
      handleStatusChange("NOK");
    } else {
      handleStatusChange("OK");
    }
  };

  const handleRemoveMaterial = (code: string) => {
    if (!window.confirm("Tem certeza que deseja remover este item?")) {
      return;
    }
    const updated = branchMaterials.filter((m) => m.code !== code);
    setBranchMaterials(updated);
    localStorage.setItem(`acandido_materials_parados_${branch.id}`, JSON.stringify(updated));

    const anyNok = updated.some((m) => m.status === "NOK");
    if (anyNok) {
      handleStatusChange("NOK");
    } else {
      handleStatusChange("OK");
    }
  };

  // Determine twin branch linkage for double warehouse rules
  const twinPairs = [
    ["unitrans-jp", "santa-maria-jp"],
    ["expresso-nacional", "acandido-cg"],
    ["fretamento-jaboatao", "rodoviario-jaboatao"],
    ["trans-cg-bayeux", "rodoviario-cabedelo"],
    ["fretamento-maracanau", "rodoviario-fortaleza"]
  ];
  const pair = twinPairs.find((p) => p.includes(branch.id));
  const twinId = pair ? (pair[0] === branch.id ? pair[1] : pair[0]) : null;
  const twinBranch = twinId ? allBranches.find((b) => b.id === twinId) : null;

  const handleOpenEvaluate = (crit: CriterionState) => {
    if (isCycleClosed) {
      alert("Operação Bloqueada: Não há nenhum ciclo ativo no momento, impossibilitando novas avaliações.");
      return;
    }

    if (crit.id === "5") {
      alert("Item Automático: Este item é calculado automaticamente de acordo com o status de '03 - Nota Fiscal'.");
      return;
    }

    setShowNokConfirm(false);

    if (crit.id === "10") {
      const storageKey = `acandido_materials_parados_${branch.id}`;
      const saved = localStorage.getItem(storageKey);
      let mats = [];
      if (saved) {
        try {
          mats = JSON.parse(saved);
        } catch {}
      }
      if (!mats || !Array.isArray(mats) || mats.length === 0) {
        mats = defaultMaterialsPerBranch[branch.id] || [
          { code: "M999", name: "Material Geral Sem Giro", status: "OK" }
        ];
      }
      setBranchMaterials(mats);
      if (mats.length > 0) {
        setSelectedMaterialCode(mats[0].code);
      } else {
        setSelectedMaterialCode(null);
      }
    }

    if (crit.id === "6") {
      const storageKey = `acandido_certificates_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`;
      const saved = localStorage.getItem(storageKey);
      let parsedSaved: any[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsedSaved = parsed;
          }
        } catch {}
      }
      const isSentGlobal = crit.status === "OK" || crit.status === "ENVIADO";
      const baseCerts = getCollaboratorsForBranch(branch.id, branch.name);
      
      const loaded = baseCerts.map((baseC) => {
        const savedMatch = parsedSaved.find(
          (sc) => sc && sc.name && sc.name.trim().toLowerCase() === baseC.name.trim().toLowerCase()
        );
        if (savedMatch) {
          return {
            ...baseC,
            status: isSentGlobal ? ("Certificado enviado" as const) : savedMatch.status,
            uploadedAt: savedMatch.uploadedAt,
            fileName: savedMatch.fileName,
            fileSize: savedMatch.fileSize,
            fileType: savedMatch.fileType,
            fileData: savedMatch.fileData
          };
        }
        return {
          ...baseC,
          status: isSentGlobal ? ("Certificado enviado" as const) : baseC.status,
        };
      });
      setAuditorCerts(loaded);
    }

    if (crit.id === "1") {
      const activeYearNum = cycleStateParsed ? parseInt(cycleStateParsed.activeYear) || 2026 : 2026;
      const MONTH_MAP: Record<string, number> = {
        "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
        "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
      };
      const activeMonthNum = cycleStateParsed ? MONTH_MAP[cycleStateParsed.activeMonth.toLowerCase()] || 6 : 6;
      const activeSemestre = activeMonthNum <= 6 ? 1 : 2;

      let localCalendar: any[] = [];
      try {
        const saved = localStorage.getItem("acandido_calendario_inventarios");
        localCalendar = saved ? JSON.parse(saved) : [];
      } catch (e) {}

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

      const items = localCalendar.filter(item =>
        (item.branchId === branch.id || (!item.branchId && matchBranch(item.almoxarifado, branch.id, branch.name))) &&
        item.ano === activeYearNum &&
        item.semestre === activeSemestre
      );
      setBranchCalendar(items);
    }

    setSelectedCriterion(crit);
    setStatusInput(crit.status);
    setPtsInput(crit.pointsObtained);
    setNotesInput(crit.notes || "");
    setEvidenceNotesInput(crit.evidenceNotes || "");
    setPhotosInput(crit.submittedPhotos?.join(", ") || "");

    const initialAuditorQ: Record<string, string> = {};
    if (crit.id === "2" && top10Config?.itens) {
      top10Config.itens.forEach((row: any, idx: number) => {
        if (crit.top10AuditorQuantities?.[idx] !== undefined) {
          initialAuditorQ[row.code] = String(crit.top10AuditorQuantities[idx]);
        } else {
          initialAuditorQ[row.code] = "";
        }
      });
    }
    setTop10AuditorQuantitiesInput(initialAuditorQ);
    setNokEvidenceLinkInput(crit.nokEvidenceLink || "");
    setNokLink1Input(crit.nokEvidenceLinks?.[0] || "");
    setNokLink2Input(crit.nokEvidenceLinks?.[1] || "");
    setNokLink3Input(crit.nokEvidenceLinks?.[2] || "");
    setNokEvidenceDescriptionInput(crit.nokEvidenceDescription || "");
    setNokEvidenceFileName(crit.nokEvidenceFileName || "");
    setNokEvidenceFileType(crit.nokEvidenceFileType || "");
    setNokEvidenceFileData(crit.nokEvidenceFileData || "");
  };

  const handleStatusChange = (status: EvaluationStatus) => {
    setStatusInput(status);
    setShowNokConfirm(false);
    if (selectedCriterion) {
      if (status === "OK") {
        setPtsInput(selectedCriterion.pointsPossible);
      } else if (status === "NOK") {
        setPtsInput(0);
      }
    }
  };

  const handleUpdateCalendarItemStatus = (itemId: string, newStatus: any) => {
    setBranchCalendar(prev => prev.map(item => {
      if (item.id === itemId) {
        return { 
          ...item, 
          status: newStatus,
          nokEvidenceLink: newStatus === "NOK" ? (item.nokEvidenceLink || "") : ""
        };
      }
      return item;
    }));
  };

  const handleUpdateCalendarItemLink = (itemId: string, link: string) => {
    setBranchCalendar(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, nokEvidenceLink: link };
      }
      return item;
    }));
  };

  const handleSaveEvaluation = () => {
    if (!selectedCriterion) return;

    if (isCycleClosed) {
      alert("Operação Bloqueada: Não há nenhum ciclo ativo no momento, impossibilitando novas alterações.");
      return;
    }

    // Custom Save for TOP 10 (ID "2")
    if (selectedCriterion.id === "2" && top10Config?.itens) {
      const answers = top10Config.itens.map((item: any, idx: number) => {
        const qtyAlmoxarife = selectedCriterion.top10AlmoxarifeQuantities?.[idx] ?? 0;
        const qtyAuditorStr = top10AuditorQuantitiesInput[item.code] ?? "";
        const qtyAuditor = qtyAuditorStr === "" ? 0 : Number(qtyAuditorStr);
        return {
          code: item.code,
          qtyAlmoxarife,
          qtyAuditor,
          divergent: qtyAlmoxarife !== qtyAuditor || qtyAuditorStr === ""
        };
      });

      const hasEmpty = top10Config.itens.some((item: any) => {
        return top10AuditorQuantitiesInput[item.code] === undefined || top10AuditorQuantitiesInput[item.code] === "";
      });

      if (hasEmpty) {
        alert("Erro de Validação: Por favor, digite a 'Qtd Auditor' de todos os itens antes de salvar a avaliação.");
        return;
      }

      const anyNok = answers.some(a => a.divergent);
      const computedStatus = anyNok ? "NOK" : "OK";

      if (computedStatus === "NOK") {
        const isNokLinkValid = nokLink1Input.trim().toLowerCase().startsWith("https://");
        if (!isNokLinkValid) {
          alert("Erro de Validação: Como há itens com divergência (NOK), o LINK 1 é obrigatório e deve iniciar com 'https://'.");
          return;
        }
      }

      // Prepare quantities to persist on CriterionState
      const finalQuantitiesList = top10Config.itens.map((item: any) => {
        return Number(top10AuditorQuantitiesInput[item.code]) || 0;
      });

      const updated = branch.criteria.map((c) => {
        if (c.id === "2") {
          return {
            ...c,
            status: computedStatus as any,
            pointsObtained: computedStatus === "OK" ? c.pointsPossible : 0,
            top10AuditorQuantities: finalQuantitiesList,
            notes: notesInput,
            nokEvidenceLink: computedStatus === "NOK" ? nokLink1Input.trim() : undefined,
            nokEvidenceDescription: computedStatus === "NOK" ? nokEvidenceDescriptionInput.trim() : undefined,
            nokEvidenceFileName: computedStatus === "NOK" ? "Link" : undefined,
            nokEvidenceFileType: computedStatus === "NOK" ? "url" : undefined,
            nokEvidenceFileData: computedStatus === "NOK" ? "" : undefined,
            nokEvidenceLinks: computedStatus === "NOK" ? [nokLink1Input, nokLink2Input, nokLink3Input].map(l => l.trim()).filter(Boolean) : undefined
          };
        }
        return c;
      });

      onUpdateCriteria(branch.id, updated);
      setSelectedCriterion(null);
      alert(`Avaliação do TOP 10 concluída com sucesso! Status Geral: ${computedStatus === "OK" ? "✓ CONFORME (OK)" : "❌ DIVERGENTE (NOK)"}`);
      return;
    }

    // Custom Save for Inventário (ID "1")
    if (selectedCriterion.id === "1") {
      // Validate that every Inventário item with NOK has a Link da Evidência
      const missingLinkItem = branchCalendar.find(b => b.status === "NOK" && !b.nokEvidenceLink?.trim());
      if (missingLinkItem) {
        alert("Erro de Validação: O Link da Evidência é obrigatório para todos os inventários avaliados como NOK.");
        return;
      }

      let globalCalendar: any[] = [];
      try {
        const saved = localStorage.getItem("acandido_calendario_inventarios");
        globalCalendar = saved ? JSON.parse(saved) : [];
      } catch {}

      globalCalendar = globalCalendar.map(g => {
        const match = branchCalendar.find(b => b.id === g.id);
        if (match) {
          return { 
            ...g, 
            status: match.status,
            nokEvidenceLink: match.status === "NOK" ? (match.nokEvidenceLink || "").trim() : ""
          };
        }
        return g;
      });

      localStorage.setItem("acandido_calendario_inventarios", JSON.stringify(globalCalendar));

      const okCount = branchCalendar.filter(b => b.status === "OK").length;
      const totalCount = branchCalendar.length;
      const pointsObtained = Math.round(((okCount / totalCount) * 20) / 5) * 5;
      let finalStatus = "PENDENTE";
      if (okCount === totalCount) finalStatus = "OK";
      else if (okCount === 0) finalStatus = "NOK";

      const parentNokEvidenceLinks = branchCalendar
        .filter(b => b.status === "NOK" && b.nokEvidenceLink?.trim())
        .map(b => b.nokEvidenceLink.trim());
      const parentNokEvidenceLink = parentNokEvidenceLinks[0] || undefined;

      const updated = branch.criteria.map((c) => {
        if (c.id === "1") {
          return {
            ...c,
            status: finalStatus as any,
            pointsObtained: pointsObtained,
            notes: notesInput || `Média semestral: ${okCount} de ${totalCount} OK.`,
            isAguardandoRealizacao: totalCount > 0 && branchCalendar.every(b => !b.status || b.status === "PENDENTE"),
            nokEvidenceLink: parentNokEvidenceLink,
            nokEvidenceDescription: parentNokEvidenceLink ? "Link de Evidência de Inconformidade do Inventário" : undefined,
            nokEvidenceFileName: parentNokEvidenceLink ? "Link" : undefined,
            nokEvidenceFileType: parentNokEvidenceLink ? "url" : undefined,
            nokEvidenceFileData: parentNokEvidenceLink ? "" : undefined,
            nokEvidenceLinks: parentNokEvidenceLinks.length > 0 ? parentNokEvidenceLinks : undefined
          };
        }
        return c;
      });

      onUpdateCriteria(branch.id, updated);
      setSelectedCriterion(null);
      return;
    }

    // Automatic Unimobin NOK Rule: if any collaborator has pending status ("Aguardando envio"), entire criterion is forced to NOK
    const hasAnyNokCollab = selectedCriterion.id === "6" && auditorCerts.some(c => c.status === "Aguardando envio");
    const enforcedStatus = hasAnyNokCollab ? "NOK" : statusInput;

    if (enforcedStatus === "NOK") {
      const isNokLinkValid = nokLink1Input.trim().toLowerCase().startsWith("https://");
      if (!isNokLinkValid) {
        alert("Erro de Validação: Para salvar uma avaliação como NÃO CONFORME (NOK), o LINK 1 é obrigatório e deve iniciar com 'https://'.");
        return;
      }
    }

    const updated = branch.criteria.map((c) => {
      if (c.id === selectedCriterion.id) {
        return {
          ...c,
          status: enforcedStatus,
          pointsObtained: enforcedStatus === "OK" ? selectedCriterion.pointsPossible : 0,
          notes: notesInput,
          evidenceNotes: selectedCriterion.auditMode === "Presencial" ? evidenceNotesInput : c.evidenceNotes,
          submittedPhotos: selectedCriterion.auditMode === "Presencial" 
            ? photosInput.split(",").map(p => p.trim()).filter(Boolean)
            : c.submittedPhotos,
          submittedAt: selectedCriterion.auditMode === "Presencial" ? new Date().toLocaleDateString("pt-BR") : c.submittedAt,
          nokEvidenceLink: enforcedStatus === "NOK" ? nokLink1Input.trim() : undefined,
          nokEvidenceDescription: enforcedStatus === "NOK" ? nokEvidenceDescriptionInput.trim() : undefined,
          nokEvidenceFileName: enforcedStatus === "NOK" ? "Link" : undefined,
          nokEvidenceFileType: enforcedStatus === "NOK" ? "url" : undefined,
          nokEvidenceFileData: enforcedStatus === "NOK" ? "" : undefined,
          nokEvidenceLinks: enforcedStatus === "NOK" ? [nokLink1Input, nokLink2Input, nokLink3Input].map(l => l.trim()).filter(Boolean) : undefined
        };
      }
      return c;
    });

    onUpdateCriteria(branch.id, updated);

    const isShared = selectedCriterion.id === "10";
    if (isShared && twinBranch) {
      const twinUpdated = twinBranch.criteria.map((c) => {
        if (c.id === selectedCriterion.id) {
          return {
            ...c,
            status: enforcedStatus,
            pointsObtained: enforcedStatus === "OK" ? c.pointsPossible : 0,
            notes: notesInput ? (notesInput + ` (Avaliado na unidade par ${branch.name.replace("ALMOXARIFADO ", "")})`) : `Avaliado no almoxarifado par ${branch.name.replace("ALMOXARIFADO ", "")}.`,
            evidenceNotes: selectedCriterion.auditMode === "Presencial" ? evidenceNotesInput : c.evidenceNotes,
            submittedPhotos: selectedCriterion.auditMode === "Presencial" 
              ? photosInput.split(",").map(p => p.trim()).filter(Boolean)
              : c.submittedPhotos,
            submittedAt: selectedCriterion.auditMode === "Presencial" ? new Date().toLocaleDateString("pt-BR") : c.submittedAt,
            nokEvidenceLink: enforcedStatus === "NOK" ? nokLink1Input.trim() : undefined,
            nokEvidenceDescription: enforcedStatus === "NOK" ? nokEvidenceDescriptionInput.trim() : undefined,
            nokEvidenceFileName: enforcedStatus === "NOK" ? "Link" : undefined,
            nokEvidenceFileType: enforcedStatus === "NOK" ? "url" : undefined,
            nokEvidenceFileData: enforcedStatus === "NOK" ? "" : undefined,
            nokEvidenceLinks: enforcedStatus === "NOK" ? [nokLink1Input, nokLink2Input, nokLink3Input].map(l => l.trim()).filter(Boolean) : undefined
          };
        }
        return c;
      });
      onUpdateCriteria(twinBranch.id, twinUpdated);
    }

    setSelectedCriterion(null);
  };

  const handleAuditorQtyChange = (itemCode: string, value: string, itemsList: any[]) => {
    const nextQtys = {
      ...top10AuditorQuantitiesInput,
      [itemCode]: value
    };
    setTop10AuditorQuantitiesInput(nextQtys);

    // Dynamic Overall Status calculation
    const hasAnyDivergence = itemsList.some((item: any, idx: number) => {
      const qAlmoxarife = selectedCriterion?.top10AlmoxarifeQuantities?.[idx] ?? 0;
      const qAuditorStr = nextQtys[item.code] ?? "";
      const qAuditor = qAuditorStr === "" ? 0 : Number(qAuditorStr);
      return qAlmoxarife !== qAuditor;
    });

    const nextStatus = hasAnyDivergence ? "NOK" : "OK";
    setStatusInput(nextStatus);
    setPtsInput(nextStatus === "OK" ? (selectedCriterion?.pointsPossible ?? 0) : 0);
  };

  const handleToggleAuditMode = (criterionId: string, newMode: "Presencial" | "A_Distancia") => {
    if (isCycleClosed) {
      alert("Operação Bloqueada: Não há nenhum ciclo ativo no momento, impossibilitando novas configurações de modo de auditoria.");
      return;
    }

    const updated = branch.criteria.map((c) => {
      if (c.id === criterionId) {
        let nextStatus = c.status;
        if (newMode === "Presencial" && (c.status === "AGUARDANDO ENVIO" || c.status === "PENDENTE" || c.status === "ENVIADO")) {
          nextStatus = "PENDENTE";
        } else if (newMode === "A_Distancia" && c.status === "PENDENTE") {
          nextStatus = "AGUARDANDO ENVIO";
        }

        return {
          ...c,
          auditMode: newMode,
          status: nextStatus
        };
      }
      return c;
    });

    onUpdateCriteria(branch.id, updated);
  };

  const isInventarioScheduledThisMonth = (() => {
    try {
      const savedManual = localStorage.getItem("acandido_cycle_state_manual");
      if (!savedManual) return false;
      const cycleStateParsed = JSON.parse(savedManual);
      const activeYearNum = parseInt(cycleStateParsed.activeYear) || 2026;
      const MONTH_MAP: Record<string, number> = {
        "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
        "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
      };
      const activeMonthNum = MONTH_MAP[cycleStateParsed.activeMonth.toLowerCase()] || 6;
      const activeSemestre = activeMonthNum <= 6 ? 1 : 2;

      let localCalendar: any[] = [];
      const saved = localStorage.getItem("acandido_calendario_inventarios");
      localCalendar = saved ? JSON.parse(saved) : [];

      const matchBranch = (almoxName: string, bId: string, bName?: string) => {
        const name = (almoxName || "").toLowerCase().trim();
        const branchId = bId.toLowerCase().trim();
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
        if (branchId === name) return true;
        return false;
      };

      const branchCalendar = localCalendar.filter(item => 
        (item.branchId === branch.id || (!item.branchId && matchBranch(item.almoxarifado, branch.id, branch.name))) &&
        item.ano === activeYearNum &&
        item.semestre === activeSemestre
      );

      return branchCalendar.some(item => {
        if (!item.data_agendada) return false;
        const pts = item.data_agendada.split("-");
        if (pts.length < 2) return false;
        return parseInt(pts[1]) === activeMonthNum;
      });
    } catch (e) {
      return false;
    }
  })();

  const filteredCriteria = branch.criteria.filter((c) => {
    if (!c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleViewCollaboratorFile = (cert: any) => {
    let fileData = cert.fileData;
    if (!fileData || fileData === "placeholder-heavy-data") {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(0, 0, 800, 600);
        
        ctx.strokeStyle = "#1B2A4A";
        ctx.lineWidth = 15;
        ctx.strokeRect(20, 20, 760, 560);
        
        ctx.strokeStyle = "#C8A84B";
        ctx.lineWidth = 4;
        ctx.strokeRect(35, 35, 730, 530);
        
        ctx.fillStyle = "#1B2A4A";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CERTIFICADO DE TREINAMENTO", 400, 150);
        
        ctx.fillStyle = "#64748B";
        ctx.font = "italic 16px sans-serif";
        ctx.fillText("Este documento certifica que o colaborador", 400, 210);
        
        ctx.fillStyle = "#1B2A4A";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(cert.name, 400, 275);
        
        ctx.fillStyle = "#64748B";
        ctx.font = "16px sans-serif";
        ctx.fillText("concluiu com êxito o treinamento corporativo", 400, 335);
        
        ctx.fillStyle = "#1B2A4A";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("CURSO UNIMOBIN - OPERAÇÃO DE ALMOXARIFADO", 400, 375);
        
        ctx.fillStyle = "#94A3B8";
        ctx.font = "12px monospace";
        ctx.fillText(`ID de Registro: ${cert.id.toUpperCase()}`, 400, 440);
        ctx.fillText(`Data de Envio: ${cert.uploadedAt || new Date().toLocaleDateString("pt-BR")}`, 400, 465);
        
        ctx.fillStyle = "#1B2A4A";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Grupo A. Cândido • Validação de Frotas", 400, 520);
      }
      fileData = canvas.toDataURL("image/png");
    }

    const newTab = window.open();
    if (newTab) {
      newTab.document.write(
        `<html><head><title>Certificado - ${cert.name}</title></head>` +
        `<body style="margin: 0; display: flex; align-items: center; justify-content: center; background: #1E293B; font-family: sans-serif;">` +
        `<div style="max-width: 90%; text-align: center; color: white;">` +
        `<p style="font-size: 14px; margin-bottom: 10px; font-weight: bold;">Certificado Digital Carregado (Auditado)</p>` +
        `<img src="${fileData}" style="max-width: 100%; max-height: 85vh; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" />` +
        `<p style="font-size: 11px; margin-top: 10px; color: #94A3B8;">Arquivo Origem: ${cert.fileName || "documento.pdf"}</p>` +
        `</div></body></html>`
      );
      newTab.document.close();
    } else {
      alert("Bloqueador de pop-ups ativo. Por favor, permita pop-ups para visualizar o arquivo.");
    }
  };

  return (
    <div className="space-y-6" id="admin-evaluation-detail-view">
      {/* Back button and profile header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="self-start px-4 py-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-[#1B2A4A] inline-flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Voltar para Unidades
        </button>

        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-lg px-2.5 py-1 uppercase tracking-wider self-start sm:self-auto">
          ID da Unidade: {branch.id}
        </span>
      </div>

      {/* Branch overview heading */}
      <header className="bg-white p-6 rounded-xl border border-slate-100 audit-card-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-[10px] bg-[#C8A84B]/20 text-[#C8A85B] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Detalhamento de Auditoria
          </span>
          <h2 className="text-2xl font-black text-[#1B2A4A] mt-2 leading-tight">{branch.name}</h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">location_on</span>
            {branch.location} • Responsável: <span className="font-bold text-slate-700">{branch.ownerName}</span>
          </p>
        </div>

        <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-full sm:min-w-[280px] justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Score Calculado</p>
            <p className="text-3xl font-extrabold text-[#1B2A4A] mt-1 font-mono">
              {branch.pointsObtainedSum ?? branch.currentScore}
              <span className="text-sm text-slate-400 font-medium font-sans">/{branch.maxAuditablePoints ?? 75} pts</span>
            </p>
          </div>
          <div className="text-right">
            <span
              className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                branch.scoreCategory === "Excelente"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : branch.scoreCategory === "Bom"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : branch.scoreCategory === "Regular" || branch.scoreCategory === "Médio"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : branch.scoreCategory === "Parcial"
                  ? "bg-slate-100 text-slate-600 border border-slate-300 font-bold"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {branch.scoreCategory}
            </span>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Meta: {branch.meta} pts</p>
          </div>
        </div>
      </header>

      {/* Tabs Selector for Auditor/Local Branch Details */}
      <div className="flex border-b border-slate-200 bg-slate-100/50 p-1.5 rounded-xl gap-2 select-none">
        <button
          type="button"
          onClick={() => setSubTab("AUDITORIA")}
          className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 bg-[#1B2A4A] text-white shadow-xs`}
        >
          <span className="material-symbols-outlined text-[16px]">fact_check</span>
          Requisitos de Auditoria
        </button>
      </div>

      {subTab === "AUDITORIA" && (
        <>
          {/* Garagem Dupla info box */}
      {twinBranch && (
        <div className="bg-indigo-50 border border-indigo-150 p-4 sm:p-5 rounded-xl flex items-start gap-3.5 animate-fade-in shadow-sm">
          <span className="material-symbols-outlined text-indigo-650 text-[24px] shrink-0 mt-0.5">difference</span>
          <div className="text-xs">
            <p className="font-black text-indigo-900 text-sm">Vínculo de Garagem Dupla: {branch.name} e {twinBranch.name}</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              <strong>Regra de Pontuação:</strong> Por pertencerem à mesma garagem, se este critério for marcado como <strong className="text-rose-700">NOK</strong> em qualquer um dos almoxarifados, ele automaticamente constará como <strong className="text-rose-750 font-extrabold">NOK</strong> nos dois e nenhum pontuará. A pontuação integral só é homologada se <strong className="text-emerald-700 font-extrabold">AMBOS</strong> estiverem conforme (<strong className="text-emerald-750 font-extrabold">OK</strong>).
            </p>
            <div className="mt-3 flex gap-2 font-bold uppercase text-[9px]">
              <span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded">Score {branch.name.split(" ")[0]}: {branch.currentScore} pts</span>
              <span className="bg-indigo-200 text-indigo-700 px-2.5 py-1 rounded">Score {twinBranch.name.split(" ")[0]}: {twinBranch.currentScore} pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Configuration of Audit Modes */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#C8A84B]">settings_suggest</span>
            Configuração dos Critérios (Modos de Auditoria)
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
            Configure se a análise de evidências de cada critério será realizada <strong>à distância</strong> pelo envio do almoxarife ou verificada <strong>presencialmente</strong> no local direto pelo auditor. O auditor pode mudar o modo a qualquer momento antes de fechar o ciclo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {branch.criteria
            .filter((c) => ["2", "4", "6", "7", "9"].includes(c.id))
            .map((c) => {
              const currentMode = c.auditMode || "A_Distancia";

              return (
                <div key={c.id} className="flex flex-col justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <span className="font-mono text-[10px] font-black text-slate-400 mr-2 bg-white border px-1 rounded inline-block">{c.number}</span>
                    <strong className="text-[11px] text-[#1B2A4A] font-black leading-tight inline-block">{c.name}</strong>
                  </div>

                  <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-inner">
                    <button
                      type="button"
                      onClick={() => handleToggleAuditMode(c.id, "A_Distancia")}
                      className={`flex-1 py-1 text-[10px] font-black uppercase rounded-md transition-all flex items-center justify-center gap-1 ${
                        currentMode === "A_Distancia"
                          ? "bg-slate-200 text-slate-700 font-extrabold border border-slate-300 shadow-sm"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">cloud_upload</span>
                      À Distância
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAuditMode(c.id, "Presencial")}
                      className={`flex-1 py-1 text-[10px] font-black uppercase rounded-md transition-all flex items-center justify-center gap-0.5 ${
                        currentMode === "Presencial"
                          ? "bg-indigo-650 text-white font-extrabold border border-indigo-700 shadow-sm"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">gavel</span>
                      Presencial
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Criteria Checklist lists */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-[#1B2A4A] self-start">Critérios de Conformidade Geral</h3>

          {/* Search bar inside list */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Pesquisar critério..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-white rounded-lg text-xs placeholder-slate-400 text-slate-700 focus:outline-none focus:border-[#1B2A4A] transition-all"
            />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden audit-card-shadow">
          <div className="divide-y divide-slate-100">
            {filteredCriteria.length > 0 ? (
              filteredCriteria.map((crit) => {
                const twinCrit = twinBranch?.criteria.find((tc) => tc.id === crit.id);
                
                // Calculate the combined consolidated (resumo) status following the twin rule
                let consolidatedStatus: string = crit.status;
                let pointsToDisplay: number = crit.pointsObtained;
                let isJointlyPenalized = false;
                
                const isShared = true;
                
                if (twinBranch && twinCrit && isShared) {
                  const isThisOursNok = crit.status === "NOK";
                  const isTwinNok = (twinCrit.rawStatus || twinCrit.status) === "NOK";
                  
                  if (isThisOursNok || isTwinNok) {
                    consolidatedStatus = "NOK";
                    pointsToDisplay = 0;
                    if (crit.status === "OK" && isTwinNok) {
                      isJointlyPenalized = true;
                    }
                  } else {
                    const isOursOk = crit.status === "OK";
                    const isTwinOk = (twinCrit.rawStatus || twinCrit.status) === "OK";
                    if (isOursOk && isTwinOk) {
                      consolidatedStatus = "OK";
                      pointsToDisplay = crit.pointsPossible;
                    } else if (crit.status === "ENVIADO" || twinCrit.status === "ENVIADO") {
                      consolidatedStatus = "ENVIADO";
                      pointsToDisplay = 0;
                    } else {
                      consolidatedStatus = "PENDENTE";
                      pointsToDisplay = 0;
                    }
                  }
                }

                let badgeStyle = "bg-stone-50 text-stone-500 border-stone-200";
                let badgeText: string = crit.status;

                let consBadgeStyle = "bg-stone-50 text-stone-500 border-stone-200";
                let consolidatedText: string = consolidatedStatus;

                if (crit.isAguardandoRealizacao) {
                  badgeStyle = "bg-slate-100 text-slate-500 border-slate-300 font-bold normal-case";
                  badgeText = crit.notes || "Aguardando realização";
                  consBadgeStyle = "bg-slate-100 text-slate-500 border-slate-300 font-bold normal-case";
                  consolidatedText = "Aguardando";
                } else if (crit.isAguardandoFechamento) {
                  badgeStyle = "bg-slate-100 text-slate-500 border-slate-300 font-bold normal-case";
                  badgeText = "Aguardando fechamento semestral";
                  consBadgeStyle = "bg-slate-100 text-slate-500 border-slate-300 font-bold normal-case";
                  consolidatedText = "Aguardando";
                } else {
                  if (crit.status === "OK") badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  if (crit.status === "NOK") badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
                  if (crit.status === "PENDENTE") badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
                  if (crit.status === "AGUARDANDO ENVIO") badgeStyle = "bg-slate-50 text-slate-400 border-slate-200";
                  if (crit.status === "ENVIADO") badgeStyle = "bg-violet-50 text-violet-700 border-violet-200 animate-pulse";

                  if (consolidatedStatus === "OK") consBadgeStyle = "bg-emerald-500 text-white border-emerald-600 font-extrabold";
                  if (consolidatedStatus === "NOK") consBadgeStyle = isJointlyPenalized ? "bg-rose-600 text-white border-rose-750 font-extrabold shadow-sm" : "bg-rose-50 text-rose-700 border-rose-200";
                  if (consolidatedStatus === "PENDENTE") consBadgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
                  if (consolidatedStatus === "ENVIADO") consBadgeStyle = "bg-violet-50 text-violet-700 border-violet-150 animate-pulse";
                }

                return (
                  <div
                    key={crit.id}
                    onClick={() => handleOpenEvaluate(crit)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start gap-4">
                      <span className="font-mono text-base font-black text-slate-400 shrink-0 mt-0.5">
                        {crit.number}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#1B2A4A] group-hover:text-[#C8A84B] transition-colors leading-tight">
                            {crit.name}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded leading-none shrink-0 border border-slate-200 font-mono">
                            {crit.recurrence}
                          </span>
                          {["2", "4", "6", "7", "9"].includes(crit.id) && (
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none shrink-0 border border-current ${
                              crit.auditMode === "Presencial"
                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }`}>
                              {crit.auditMode === "Presencial" ? "📋 Presencial" : "À Distância"}
                            </span>
                          )}
                        </div>

                        {crit.id === "2" && (
                          <div className="mt-2 flex flex-col gap-1">
                            <div className="flex flex-wrap gap-2 items-center">
                              <button
                                type="button"
                                disabled={isCycleClosed}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenTop10Config();
                                }}
                                className={`inline-flex items-center gap-1 bg-[#1B2A4A] border border-[#1B2A4A]/20 text-white font-black px-2.5 py-1 rounded text-[10px] uppercase hover:opacity-90 transition-all shadow-xs select-none ${
                                  isCycleClosed ? "opacity-55 cursor-not-allowed text-white/75" : ""
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px]">settings</span>
                                Configurar TOP 10 do Mês
                              </button>
                              <span className="text-[10px] text-slate-500 font-mono font-medium">
                                {top10Config?.itens && top10Config.itens.length > 0
                                  ? `${top10Config.itens.length} itens configurados para o mês.`
                                  : "⚠️ Aguardando configuração dos itens do mês"}
                              </span>
                            </div>
                          </div>
                        )}

                        {crit.id === "4" && (
                          <div className="mt-2 flex flex-col gap-1">
                            <div className="flex flex-wrap gap-2 items-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenLayoutConfig();
                                }}
                                className="inline-flex items-center gap-1 bg-[#1B2A4A] border border-[#1B2A4A]/20 text-white font-black px-2.5 py-1 rounded text-[10px] uppercase hover:opacity-90 transition-all shadow-xs select-none"
                              >
                                <span className="material-symbols-outlined text-[12px]">settings</span>
                                Configurar LayOut do Mês
                              </button>
                              <span className="text-[10px] text-slate-500 font-mono font-medium">
                                {layoutConfig?.location 
                                  ? `Local: "${layoutConfig.location}"`
                                  : "⚠️ Aguardando definição da localização"}
                              </span>
                            </div>
                            {layoutConfig?.instructions && (
                              <p className="text-[10px] text-slate-400 italic">
                                Obs do auditor: "{layoutConfig.instructions}"
                              </p>
                            )}
                          </div>
                        )}

                        {isJointlyPenalized && (
                          <div className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100/50 px-2 py-0.5 rounded mt-1.5 inline-flex items-center gap-1 select-none">
                            <span className="material-symbols-outlined text-[12px] text-red-650">warning</span>
                            <span>Penalizado por Garagem Dupla: {twinBranch?.name.replace("ALMOXARIFADO ", "").split(" ")[0]} está NOK neste critério.</span>
                          </div>
                        )}

                        {crit.notes ? (
                          <p className="text-[11px] text-red-650 mt-1 italic line-clamp-1">
                            Obs Auditor: "{crit.notes}"
                          </p>
                        ) : crit.status === "ENVIADO" ? (
                          <p className="text-[11px] text-violet-700 font-bold mt-1 flex items-center gap-0.5 animate-pulse">
                            <span className="material-symbols-outlined text-[13px]">notification_important</span>
                            O Almoxarife enviou novas evidências para a sua avaliação!
                          </p>
                        ) : null}

                        {crit.status === "NOK" && (crit.nokEvidenceLink || crit.nokEvidenceFileData) && (
                          <div className="mt-2.5 flex flex-wrap gap-2 items-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (crit.nokEvidenceFileData) {
                                  const newTab = window.open();
                                  if (newTab) {
                                    newTab.document.write(
                                      `<html><head><title>Visualizar Evidência - NOK</title></head>` +
                                      `<body style="margin: 0; display: flex; align-items: center; justify-content: center; background: #333; font-family: sans-serif;">` +
                                      `${crit.nokEvidenceFileType?.startsWith("image/") 
                                          ? `<img src="${crit.nokEvidenceFileData}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" />`
                                          : `<iframe src="${crit.nokEvidenceFileData}" width="100%" height="100%" style="border: none;"></iframe>`
                                       }` +
                                      `</body></html>`
                                    );
                                    newTab.document.close();
                                  }
                                } else if (crit.nokEvidenceLink) {
                                  window.open(crit.nokEvidenceLink, "_blank", "noopener,noreferrer");
                                }
                              }}
                              className="inline-flex items-center gap-1.5 text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-black transition-all shadow-2xs hover:scale-102"
                            >
                              <span>📎 Ver evidência</span>
                            </button>
                            {crit.nokEvidenceDescription && (
                              <span className="text-[10px] text-slate-500 italic max-w-xs truncate" title={crit.nokEvidenceDescription}>
                                "{crit.nokEvidenceDescription}"
                              </span>
                            )}
                            {crit.nokEvidenceLinks && crit.nokEvidenceLinks.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 items-center ml-2 border-l border-rose-200/50 pl-2 font-sans">
                                {crit.nokEvidenceLinks.map((link, lIdx) => (
                                  <a
                                    key={lIdx}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-black transition-all shadow-2xs hover:scale-102"
                                  >
                                    <span>🔗 Ver evidência {lIdx + 1}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-x-6 gap-y-2 shrink-0">
                      {/* Twin Column Comparison */}
                      {twinBranch && twinCrit && (
                        <div className="flex items-center gap-2.5 bg-indigo-50/40 px-2.5 py-1.5 rounded-lg border border-indigo-100 text-[10px] font-bold text-slate-500">
                          <span className="font-mono text-indigo-400">Outra Unidade ({twinBranch.name.replace("ALMOXARIFADO ", "").split(" ")[0]}):</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black border ${
                            (twinCrit.rawStatus || twinCrit.status) === "OK" ? "bg-emerald-50 text-emerald-700 border-emerald-150" :
                            (twinCrit.rawStatus || twinCrit.status) === "NOK" ? "bg-rose-50 text-rose-700 border-rose-150" :
                            twinCrit.status === "ENVIADO" ? "bg-violet-50 text-violet-700 border-violet-150" :
                            "bg-amber-50 text-amber-700 border-amber-150"
                          }`}>
                            {twinCrit.rawStatus || twinCrit.status}
                          </span>
                        </div>
                      )}

                      {/* Score point label */}
                      <div className="text-left md:text-right min-w-[70px]">
                        <p className="text-sm font-extrabold text-[#1B2A4A] font-mono leading-none">
                          {false || 
                           false ? (
                            "—"
                          ) : (
                            <>
                              {pointsToDisplay}
                              <span className="text-[10px] text-slate-400 font-medium font-sans">/{crit.pointsPossible} pts</span>
                            </>
                          )}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block mt-1 tracking-wider leading-none">Consolidado</span>
                      </div>

                      {/* Status badges */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Avaliação</span>
                          <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border ${badgeStyle}`}>
                            {badgeText}
                          </span>
                        </div>

                        {twinBranch && (
                          <div className="flex flex-col items-center">
                            <span className="text-[7.5px] font-bold text-indigo-400 uppercase tracking-widest leading-none mb-1">Resumo</span>
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border leading-none ${consBadgeStyle}`}>
                              {consolidatedText}
                            </span>
                          </div>
                        )}

                        {(() => {
                          if (crit.id === "5") {
                            return (
                              <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-250 shrink-0 select-none">
                                Segue NF
                              </span>
                            );
                          }
                          return (
                            <button className="h-8 px-3 rounded-lg text-xs font-bold text-[#1B2A4A] hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-1 active:scale-95 transition-all" type="button">
                              Avaliar
                              <span className="material-symbols-outlined text-[14px]">edit_note</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs select-none">
                Nenhum critério correspondente encontrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EVALUATION MODAL / BOTTOM SHEET */}
      {selectedCriterion && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 transition-opacity">
          <div className={`bg-white rounded-xl shadow-2xl w-full overflow-hidden border border-slate-100 flex flex-col transition-all duration-200 ${
            selectedCriterion.id === "2" 
              ? "max-w-[900px] w-[90vw] max-h-[85vh]"
              : "max-w-lg max-h-[90vh]"
          }`}>
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1B2A4A] text-white flex justify-between items-center bg-gradient-to-r from-[#1B2A4A] to-[#21355c]">
              <div>
                <p className="text-[9px] font-bold text-[#C8A84B] uppercase tracking-widest font-mono">
                  CRITÉRIO {selectedCriterion.number} • {selectedCriterion.recurrence}
                </p>
                <h4 className="text-base font-bold leading-tight mt-0.5">{selectedCriterion.name}</h4>
              </div>
              <button
                onClick={() => setSelectedCriterion(null)}
                className="text-white hover:text-[#C8A84B] transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Garagem Dupla Side-by-Side Visual Comparison */}
              {twinBranch && (() => {
                const twinCrit = twinBranch.criteria.find((tc) => tc.id === selectedCriterion.id);
                if (!twinCrit) return null;
                return (
                  <div className="p-4 bg-slate-150 rounded-xl space-y-2 border border-slate-200 text-xs">
                    <p className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">compare_arrows</span>
                      Status da Garagem Dupla
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Esta Unidade:</span>
                        <p className="font-black text-[#1B2A4A] mt-0.5">{branch.name.replace("ALMOXARIFADO ", "")}</p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border mt-1.5 ${
                          selectedCriterion.status === "OK" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                          selectedCriterion.status === "NOK" ? "bg-rose-50 text-rose-800 border-rose-100" :
                          "bg-amber-50 text-amber-800 border-amber-100"
                        }`}>{selectedCriterion.status}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Outra Unidade no mesmo local:</span>
                        <p className="font-black text-slate-655 text-slate-700 mt-0.5">{twinBranch.name.replace("ALMOXARIFADO ", "")}</p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border mt-1.5 ${
                          twinCrit.status === "OK" ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                          twinCrit.status === "NOK" ? "bg-rose-50 text-rose-800 border-rose-100" :
                          "bg-amber-50 text-amber-800 border-amber-100"
                        }`}>{twinCrit.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SPECIAL FEATURE: LISTA DE INVENTÁRIOS AGENDADOS - CRITÉRIO 1 */}
              {selectedCriterion.id === "1" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div>
                    <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#C8A84B]">calendar_month</span>
                      Calendário de Inventários Semestrais — {branch.name.replace("ALMOXARIFADO ", "")}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Avalie individualmente cada inventário agendado para este semestre. A nota final será calculada pela média simples.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {branchCalendar.length === 0 ? (
                      <div className="p-4 bg-white rounded-lg border border-slate-100 text-center text-xs text-slate-400 font-medium">
                        Não há inventários cadastrados para este semestre no calendário de configurações.
                      </div>
                    ) : (
                      branchCalendar.map((item, idx) => {
                        const dateFormatted = (item.data_agendada && item.data_agendada.trim() !== "")
                          ? item.data_agendada.split("-").reverse().join("/")
                          : "Não agendado";
                        const isNok = item.status === "NOK";

                        return (
                          <div 
                            key={item.id} 
                            className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col gap-3 shadow-2xs hover:border-[#C8A84B]/20 transition-all"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                                  Inventário Semestral #{idx + 1}
                                </span>
                                <span className="text-xs font-black text-[#1B2A4A] mt-0.5 block">
                                  Agendado: {dateFormatted}
                                </span>
                              </div>

                              {/* Status controls */}
                              <div className="flex items-center gap-1">
                                {(["OK", "NOK", "PENDENTE"] as const).map(st => {
                                  const active = item.status === st || (!item.status && st === "PENDENTE");
                                  let btnClass = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
                                  if (active) {
                                    if (st === "OK") btnClass = "bg-emerald-500 text-white border-emerald-500 font-extrabold shadow-sm";
                                    if (st === "NOK") btnClass = "bg-rose-500 text-white border-rose-500 font-extrabold shadow-sm";
                                    if (st === "PENDENTE") btnClass = "bg-amber-500 text-white border-amber-500 font-extrabold shadow-sm";
                                  }

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCalendarItemStatus(item.id, st)}
                                      key={st}
                                      className={`px-2.5 py-1 text-[10px] rounded-md font-bold uppercase transition-all ${btnClass}`}
                                    >
                                      {st}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Link evidence input directly below if NOK */}
                            {isNok && (
                              <div className="pt-2.5 border-t border-slate-100 space-y-1">
                                <label className="block text-[10px] font-black text-rose-700 uppercase tracking-wide">
                                  Link da Evidência (obrigatório para NOK) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={item.nokEvidenceLink || ""}
                                  onChange={(e) => handleUpdateCalendarItemLink(item.id, e.target.value)}
                                  placeholder="Cole aqui o link da evidência..."
                                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* SPECIAL FEATURE: AVALIAÇÃO INDIVIDUAL DE MATERIAIS - CRITÉRIO 10 */}
              {selectedCriterion.id === "10" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div>
                    <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-indigo-600">inventory</span>
                      Materiais Sem Movimentação — {branch.name.replace("ALMOXARIFADO ", "")}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cada almoxarifado possui sua própria lista independente. Adicione novos itens abaixo e mude a conformidade diretamente na tabela.
                    </p>
                  </div>

                  {/* Lista Completa Cadastrada para a unidade */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lista de Itens Avaliados nesta Unidade ({branchMaterials.length})</p>
                    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                      {branchMaterials.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">Nenhum material cadastrado nesta unidade.</div>
                      ) : (
                        branchMaterials.map(m => (
                          <div key={m.code} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-[#1B2A4A] truncate">
                                <span className="font-mono text-slate-400 mr-1.5 text-[10px] font-normal">[{m.code}]</span>
                                {m.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* OK/NOK status toggle */}
                              <div className="flex border border-slate-200 rounded overflow-hidden shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMaterialStatus(m.code, "OK")}
                                  className={`px-2 py-0.5 text-[10px] font-black transition-colors ${
                                    m.status === "OK"
                                      ? "bg-emerald-500 text-white"
                                      : "bg-white text-slate-400 hover:bg-slate-50"
                                  }`}
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMaterialStatus(m.code, "NOK")}
                                  className={`px-2 py-0.5 text-[10px] font-black transition-colors ${
                                    m.status === "NOK"
                                      ? "bg-red-500 text-white"
                                      : "bg-white text-slate-400 hover:bg-slate-50"
                                  }`}
                                >
                                  NOK
                                </button>
                              </div>

                              {/* Remover icon */}
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial(m.code)}
                                        className="text-slate-400 hover:text-red-500 font-extrabold px-1.5 py-0.5 hover:bg-rose-50 rounded transition-colors shrink-0"
                                title="Remover item permanentemente"
                              >
                                <span className="material-symbols-outlined text-[16px] leading-none align-middle">delete</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Formulário para Adicionar Novo Material */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">Adicionar Novo Material para Avaliação</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Cód. (Ex: M029)"
                        value={newMaterialCode}
                        onChange={(e) => setNewMaterialCode(e.target.value)}
                        className="w-1/3 px-2.5 py-1.5 border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Descrição (Ex: Mangueira de Turbina OF)"
                        value={newMaterialName}
                        onChange={(e) => setNewMaterialName(e.target.value)}
                        className="w-2/3 px-2.5 py-1.5 border border-slate-200 rounded text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-black transition-all"
                    >
                      + Cadastrar e Avaliar Item
                    </button>
                  </div>
                </div>
              )}

              {/* SPECIAL DOUBLE GARAGE ALERTS FOR CRITERION 10 (Material Sem Movimentação) */}
              {selectedCriterion.id === "10" && twinBranch && (() => {
                const twinCrit = twinBranch.criteria.find((tc) => tc.id === "10");
                if (!twinCrit) return null;
                
                const isTwinEvaluated = twinCrit.status === "OK" || twinCrit.status === "NOK";
                
                // Scenario 1: One evaluated, the other not yet
                if (!isTwinEvaluated) {
                  return (
                    <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl space-y-2 animate-fade-in text-xs text-amber-900">
                      <div className="flex items-center gap-1.5 font-extrabold text-amber-805 text-amber-800">
                        <span className="material-symbols-outlined text-[18px]">warning</span>
                        <span>⚠ Garagem dupla — {branch.ownerName}</span>
                      </div>
                      <p className="font-medium leading-relaxed">
                        Este almoxarifado faz par com <strong>{twinBranch.name.replace("ALMOXARIFADO ", "")}</strong>.
                      </p>
                      <p className="font-bold text-amber-900 bg-amber-100/55 p-2 rounded border border-amber-200">
                        O outro ainda não foi avaliado. A pontuação só será calculada após os dois serem avaliados.
                      </p>
                    </div>
                  );
                }
                
                // Scenario 2: First was OK, and we select NOK
                if (twinCrit.status === "OK" && statusInput === "NOK") {
                  return (
                    <div className="p-4 border border-red-300 bg-red-50 rounded-xl space-y-2.5 animate-fade-in text-xs text-red-950">
                      <div className="flex items-center gap-1.5 font-extrabold text-[#EF4444]">
                        <span className="material-symbols-outlined text-[18px]">warning</span>
                        <span>⚠ Atenção — impacto na garagem dupla</span>
                      </div>
                      <p className="font-medium">
                        <strong>{twinBranch.name.replace("ALMOXARIFADO ", "")}</strong> foi avaliado como <strong>OK</strong>.
                      </p>
                      <p className="font-extrabold text-red-805 bg-red-100/30 p-2.5 rounded border border-red-200">
                        Ao salvar NOK aqui, os dois almoxarifados ficarão com 0 pts nos 6 meses do semestre.
                      </p>
                      
                      {showNokConfirm ? (
                        <div className="p-3 bg-white border border-[#E9A1A1] rounded-lg mt-2.5 space-y-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
                          <span className="font-extrabold text-red-700 leading-tight block">Confirmar lançamento NOK com impacto mútuo?</span>
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setShowNokConfirm(false)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEvaluation}
                              className="px-2.5 py-1 bg-red-650 hover:bg-red-750 text-white rounded text-[11px] font-black shadow-xs"
                            >
                              Confirmar NOK
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 font-bold italic">
                          * Um aviso de confirmação será solicitado antes de salvar.
                        </p>
                      )}
                    </div>
                  );
                }
                
                // Scenario 3: Both OK
                if (twinCrit.status === "OK" && statusInput === "OK") {
                  return (
                    <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-xl space-y-2 animate-fade-in text-xs text-emerald-950">
                      <div className="flex items-center gap-1.5 font-extrabold text-emerald-800">
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>✅ Garagem dupla completa</span>
                      </div>
                      <p className="font-bold">
                        {branch.name.replace("ALMOXARIFADO ", "")}: <span className="text-emerald-700 font-black">OK</span>
                      </p>
                      <p className="font-bold">
                        {twinBranch.name.replace("ALMOXARIFADO ", "")}: <span className="text-emerald-700 font-black">OK</span>
                      </p>
                      <p className="font-medium text-emerald-900 mt-1 leading-normal">
                        Ambos receberão <strong>5 pts</strong> em todos os meses do semestre.
                      </p>
                    </div>
                  );
                }
                
                return null;
              })()}

              {/* Evidence from Almoxarife */}
              {selectedCriterion.status === "ENVIADO" && (
                <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl space-y-2">
                  <div className="flex items-center gap-1 text-violet-700 text-xs font-bold">
                    <span className="material-symbols-outlined text-[16px]">cloud_done</span>
                    Evidência Enviada por {branch.ownerName}
                  </div>
                  <div className="text-[11px] text-[#1B2A4A] leading-relaxed">
                    <p className="font-bold">Comentários de {branch.ownerName}:</p>
                    <p className="italic text-slate-600 mt-1">
                      {selectedCriterion.evidenceNotes || "De conformidade com as metas do mês, incluí as fotos e logs em anexo para validação imediata."}
                    </p>
                  </div>

                  {selectedCriterion.submittedPhotos && selectedCriterion.submittedPhotos.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {selectedCriterion.submittedPhotos.map((photo, i) => (
                        <div key={i} className="relative aspect-square bg-[#1B2A4A]/5 rounded-lg overflow-hidden border border-violet-200">
                          <img
                            src={photo}
                            referrerPolicy="no-referrer"
                            alt="Evidência"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-violet-200 bg-white p-2 text-center text-[10px] text-violet-600 rounded font-semibold flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">photo_library</span>
                      Dados digitados integrados
                    </div>
                  )}
                </div>
              )}

              {/* SPECIAL FEATURE: SELEÇÃO DE EVIDÊNCIAS DE TOP 10 - CRITÉRIO 2 */}
              {selectedCriterion.id === "2" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div>
                    <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#1B2A4A]">star</span>
                      Avaliação do TOP 10 — {branch.name.replace("ALMOXARIFADO ", "")}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verifique as fotos enviadas pelo almoxarife, preencha as quantidades encontradas no sistema Transnet e valide divergências.
                    </p>
                  </div>

                  {selectedCriterion.auditMode === "Presencial" ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">info</span>
                      Modo Presencial Ativo. Avalie presencialmente o TOP 10 durante a vistoria no almoxarifado.
                    </div>
                  ) : !top10Config?.itens || top10Config.itens.length === 0 ? (
                    <div className="p-4 bg-white border border-dashed rounded-lg text-center text-xs text-slate-400 font-semibold">
                      ⚠️ Nenhum item configurado para este mês por enquanto.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="overflow-x-auto w-full rounded-lg border border-slate-205 border-slate-200 shadow-2xs" style={{ WebkitOverflowScrolling: "touch" }}>
                        <table className="min-w-[700px] w-full border-collapse text-left text-xs bg-white font-sans">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              <th className="p-2.5 text-center text-slate-400 border-r border-slate-200" style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}>Nº</th>
                              <th className="p-2.5 text-left text-slate-400 border-r border-slate-200" style={{ width: '200px', minWidth: '200px' }}>Material</th>
                              <th className="p-2.5 text-center text-slate-400 border-r border-slate-200" style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}>Foto</th>
                              <th className="p-2.5 text-center text-slate-400 border-r border-slate-200" style={{ width: '110px', minWidth: '110px', maxWidth: '110px' }}>Qtd Alm</th>
                              <th className="p-2.5 text-center text-slate-400 border-r border-slate-200" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>Qtd Aud (Transnet)</th>
                              <th className="p-2.5 text-center text-slate-400" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 font-medium">
                            {top10Config.itens.map((item: any, idx: number) => {
                              const photo = selectedCriterion.submittedPhotos?.[idx];
                              const qtyAlmoxarife = selectedCriterion.top10AlmoxarifeQuantities?.[idx] ?? 0;
                              const qtyAuditorStr = top10AuditorQuantitiesInput[item.code] ?? "";
                              const qtyAuditor = qtyAuditorStr === "" ? 0 : Number(qtyAuditorStr);
                              const diff = qtyAlmoxarife - qtyAuditor;

                              let statusBadge = (
                                <span className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 block text-center uppercase tracking-wide">
                                  Digitar Qtd
                                </span>
                              );

                              if (qtyAuditorStr !== "") {
                                if (diff === 0) {
                                  statusBadge = (
                                    <span className="px-2 py-1 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-250 block text-center uppercase tracking-wide">
                                      OK
                                    </span>
                                  );
                                } else {
                                  statusBadge = (
                                    <span className="px-2 py-1 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-250 block text-center uppercase tracking-wide">
                                      NOK ({diff})
                                    </span>
                                  );
                                }
                              }

                              return (
                                <tr key={idx} className="hover:bg-slate-55/50 hover:bg-slate-50/50 transition">
                                  <td className="p-2.5 text-center font-mono font-bold text-slate-400 border-r border-slate-200" style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}>
                                    {idx + 1}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-200" style={{ width: '200px', minWidth: '200px' }}>
                                    <span className="text-[9.5px] font-mono font-bold text-slate-400 block uppercase">CÓD. {item.code}</span>
                                    <span className="text-slate-800 font-extrabold text-[#1B2A4A] text-xs block leading-tight">{item.description}</span>
                                    {selectedCriterion.submittedAt && (
                                      <span className="text-[9px] font-mono text-slate-400 block mt-1" title="Data/Hora do envio do Almoxarife">
                                        📅 {selectedCriterion.submittedAt}
                                      </span>
                                    )}
                                  </td>
                                  
                                  {/* Foto Column */}
                                  <td className="p-2.5 text-center border-r border-slate-200 align-middle" style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}>
                                    {photo ? (
                                      <div className="flex flex-col items-center gap-1.5 justify-center">
                                        {/* Miniatura clicável */}
                                        <button
                                          type="button"
                                          onClick={() => setActiveLightboxImg(photo)}
                                          className="group relative w-12 h-12 block rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-600 shadow-3xs transition cursor-pointer"
                                          title="Clique para ver no lightbox"
                                        >
                                          <img src={photo} alt="Envio" className="w-full h-full object-cover group-hover:scale-110 transition duration-150" referrerPolicy="no-referrer" />
                                          <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[9px] font-bold uppercase">
                                            Zoom
                                          </div>
                                        </button>
                                        
                                        {/* Badge "Ver foto" verde clicável que abre em nova aba */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newTab = window.open();
                                            if (newTab) {
                                              newTab.document.write(
                                                `<html><head><title>Visualizar Material - CÓD. ${item.code}</title></head>` +
                                                `<body style="margin: 0; display: flex; align-items: center; justify-content: center; background: #111; color: white; font-family: sans-serif;">` +
                                                `<div style="text-align: center; padding: 20px;">` +
                                                `<p style="margin-bottom: 12px; font-weight: bold; font-size: 14px; color: #ccc;">Item: ${item.description} (CÓD. ${item.code})</p>` +
                                                `<img src="${photo}" style="max-width: 100%; max-height: 85vh; object-fit: contain; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-radius: 8px;" />` +
                                                `</div>` +
                                                `</body></html>`
                                              );
                                              newTab.document.close();
                                            }
                                          }}
                                          className="w-full text-[9px] font-black text-emerald-700 hover:text-emerald-805 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1 py-0.5 rounded cursor-pointer transition uppercase select-none tracking-tight block text-center"
                                        >
                                          Ver foto ↗
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 italic">
                                        Pendente
                                      </span>
                                    )}
                                  </td>

                                  {/* Qtd Almoxarife Column */}
                                  <td className="p-2.5 text-center font-mono font-extrabold text-[#1B2A4A] text-xs bg-slate-50/10 border-r border-slate-200 align-middle" style={{ width: '110px', minWidth: '110px', maxWidth: '110px' }}>
                                    {qtyAlmoxarife} un
                                  </td>

                                  {/* Qtd Auditor Column */}
                                  <td className="p-2.5 text-center border-r border-slate-200 bg-indigo-50/10 align-middle" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                                    <div className="flex justify-center flex-row">
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="Qtd Transnet"
                                        value={qtyAuditorStr}
                                        onChange={(e) => {
                                          handleAuditorQtyChange(item.code, e.target.value, top10Config.itens);
                                        }}
                                        className="w-24 border border-slate-200 bg-white rounded-md px-2 py-1 text-xs text-center font-bold font-mono text-[#1B2A4A] focus:border-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A]/20"
                                      />
                                    </div>
                                  </td>

                                  {/* Status Column */}
                                  <td className="p-2.5 text-center align-middle" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                                    {statusBadge}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Indicator of scrollable on mobile */}
                      <div className="block sm:hidden text-center mt-2 animate-fade-in animate-duration-300">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse font-mono select-none">
                          ← deslize para ver mais →
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedCriterion.id === "6" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div>
                    <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-indigo-600">badge</span>
                      Colaboradores e Certificados - {branch.name.replace("ALMOXARIFADO ", "")}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Monitore e controle os certificados do Curso Unimobin individuais para esta garagem.
                    </p>
                  </div>

                  {/* Collaborator checklist inside Auditor screen with direct upload */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                    {auditorCerts.map((c) => {
                      const hasFile = c.status === "Certificado enviado" && c.fileName;
                      return (
                        <div
                          key={c.id}
                          className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 shadow-2xs hover:border-slate-300 transition-all font-semibold"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-[#1B2A4A]">{c.name}</p>
                              <span className={`inline-flex items-center gap-1 text-[9px] mt-1 font-semibold ${
                                c.status === "Certificado enviado" ? "text-emerald-700" : "text-amber-700"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${c.status === "Certificado enviado" ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                                {c.status} {c.uploadedAt ? `(${c.uploadedAt})` : ""}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = auditorCerts.map(item => {
                                  if (item.id === c.id) {
                                    const isSent = item.status === "Certificado enviado";
                                    return {
                                      ...item,
                                      status: isSent ? "Aguardando envio" as const : "Certificado enviado" as const,
                                      uploadedAt: isSent ? undefined : new Date().toLocaleDateString("pt-BR")
                                    };
                                  }
                                  return item;
                                });
                                setAuditorCerts(updated);
                                localStorage.setItem(`acandido_certificates_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`, JSON.stringify(updated));
                              }}
                              className={`py-1 px-2 rounded text-[9px] font-black border transition-all active:scale-95 flex items-center gap-0.5 uppercase tracking-wider ${
                                c.status === "Certificado enviado"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                                  : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[11px]">
                                {c.status === "Certificado enviado" ? "check_circle" : "pending"}
                              </span>
                              {c.status === "Certificado enviado" ? "Alterar p/ Pendente" : "Marcar Concluído"}
                            </button>
                          </div>

                          {/* Direct file upload button or loaded view */}
                          {hasFile ? (
                            <div className="flex items-center justify-between bg-emerald-50/50 border border-emerald-150 p-2.5 rounded-lg text-xs font-semibold">
                              <div className="flex items-center gap-2 text-emerald-950 min-w-0">
                                <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">description</span>
                                <span className="truncate font-mono text-[10px]" title={c.fileName}>
                                  {c.fileName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleViewCollaboratorFile(c)}
                                  className="py-1 px-2.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200 rounded text-[9.5px] font-bold"
                                >
                                  Visualizar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = auditorCerts.map((item) => {
                                      if (item.id === c.id) {
                                        return {
                                          ...item,
                                          status: "Aguardando envio" as const,
                                          uploadedAt: undefined,
                                          fileName: undefined,
                                          fileSize: undefined,
                                          fileType: undefined,
                                          fileData: undefined
                                        };
                                      }
                                      return item;
                                    });
                                    setAuditorCerts(updated);
                                    localStorage.setItem(`acandido_certificates_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`, JSON.stringify(updated));
                                  }}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                >
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-10 transition-all text-center flex flex-col items-center justify-center space-y-1.5 bg-white">
                              <span className="material-symbols-outlined text-[18px] text-slate-400">attach_file</span>
                              <div className="text-[10px] text-slate-500 font-semibold leading-normal">
                                <p className="font-bold text-[#1B2A4A]">Anexar certificado do colaborador</p>
                                <p className="text-slate-400 text-[9px]">JPG, PNG ou PDF • máx. 10 MB</p>
                              </div>
                              <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#1B2A4A] py-1 px-3 rounded text-[9.5px] font-black transition-all shadow-3xs active:scale-95 inline-block">
                                Escolher arquivo
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > 10 * 1024 * 1024) {
                                        alert("Erro: O arquivo excede o limite máximo de 10 MB.");
                                        return;
                                      }
                                      const reader = new FileReader();
                                      reader.onload = (re) => {
                                        const base64 = re.target?.result as string;
                                        const updated = auditorCerts.map((item) => {
                                          if (item.id === c.id) {
                                            return {
                                              ...item,
                                              status: "Certificado enviado" as const,
                                              uploadedAt: new Date().toLocaleDateString("pt-BR"),
                                              fileName: file.name,
                                              fileSize: file.size,
                                              fileType: file.type,
                                              fileData: base64
                                            };
                                          }
                                          return item;
                                        });
                                        setAuditorCerts(updated);
                                        localStorage.setItem(`acandido_certificates_${branch.id}_${cycleStateParsed.activeMonth}_${cycleStateParsed.activeYear}`, JSON.stringify(updated));
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedCriterion.id === "9" && (() => {
                const auditorFilteredWarranties = warranties.filter((w) => {
                  return (
                    w.almoxarifado &&
                    w.almoxarifado.toLowerCase() === branch.name.toLowerCase() &&
                    w.monthYear === auditorMonthFilter
                  );
                });

                return (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-[#C8A84B]">shield</span>
                        Histórico de Garantia no Mês ({branch.name.replace("ALMOXARIFADO ", "")})
                      </span>
                      <select
                        value={auditorMonthFilter}
                        onChange={(e) => setAuditorMonthFilter(e.target.value)}
                        className="border border-slate-250 bg-white rounded-lg px-2 py-1 text-[11px] font-bold text-slate-705 text-slate-700 focus:outline-none"
                      >
                        <option value="Junho 2026">Junho 2026</option>
                        <option value="Maio 2026">Maio 2026</option>
                        <option value="Abril 2026">Abril 2026</option>
                        <option value="Março 2026">Março 2026</option>
                        <option value="Fevereiro 2026">Fevereiro 2026</option>
                        <option value="Janeiro 2026">Janeiro 2026</option>
                      </select>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-56 bg-white shrink-0 scrollbar-thin">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-200">
                            <th className="p-2 font-black">Item</th>
                            <th className="p-2 font-black">Fabricante</th>
                            <th className="p-2 font-black">Garantia até</th>
                            <th className="p-2 font-black">Data NF</th>
                            <th className="p-2 font-black">Obs. Peça</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {auditorFilteredWarranties.length > 0 ? (
                            auditorFilteredWarranties.map((w) => (
                              <tr key={w.id} className="hover:bg-slate-50/50">
                                <td className="p-2">
                                  <span className="font-bold text-[#1B2A4A] block">{w.itemCode}</span>
                                  <span className="text-slate-400 text-[9px] block leading-tight">{w.itemDescription}</span>
                                  {w.createdAt && (
                                    <span className="text-[9px] text-red-600 block leading-tight font-black font-sans mt-1 bg-red-50 border border-red-100/50 px-1 py-0.5 rounded w-max" title="Data/Hora real de gravação">
                                      Real: {w.createdAt}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 text-slate-600">{w.manufacturer}</td>
                                <td className="p-2 text-slate-600 font-mono whitespace-nowrap">
                                  {w.expiryDate ? new Date(w.expiryDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                                </td>
                                <td className="p-2 text-slate-600 font-mono whitespace-nowrap">
                                  {w.nfEmissionDate ? new Date(w.nfEmissionDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                                </td>
                                <td className="p-2 text-slate-500 italic max-w-[110px] truncate" title={w.pieceObservation}>
                                  {w.pieceObservation}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400 font-normal">
                                Nenhum item de garantia registrado para este mês nesta unidade.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Status input selection buttons */}
              {selectedCriterion.id !== "1" ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Status da Conformidade
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["OK", "PENDENTE", "NOK"] as const).map((status) => {
                      let activeClass = "";
                      if (statusInput === status) {
                        if (status === "OK") activeClass = "bg-emerald-500 text-white border-emerald-500";
                        if (status === "PENDENTE") activeClass = "bg-amber-500 text-white border-amber-500";
                        if (status === "NOK") activeClass = "bg-red-500 text-white border-red-500";
                      } else {
                        activeClass = "bg-white text-slate-650 hover:bg-slate-50 border-slate-200";
                      }

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleStatusChange(status)}
                          className={`py-3 rounded-lg border text-xs font-black transition-all ${activeClass}`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2.5 animate-fade-in text-xs text-indigo-900">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-extrabold text-xs font-sans">
                    <span className="material-symbols-outlined text-[18px] text-indigo-600 block leading-none">info</span>
                    <span>Cálculo de Pontuação e Status Automatizado</span>
                  </div>
                  <p className="text-[11px] text-indigo-750 font-semibold leading-relaxed">
                    O status global de conformidade e a nota final do critério <strong>Inventário (20 pts)</strong> são gerados automaticamente baseando-se nas avaliações salvas individualmente na lista de inventários agendados acima:
                  </p>
                  <div className="text-xs font-bold text-indigo-900 bg-white/70 p-3 rounded border border-indigo-150 space-y-1">
                    <div className="flex justify-between">
                      <span>Total de Inventários Agendados neste semestre:</span>
                      <span className="font-mono">{branchCalendar.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inventários com conformidade (OK):</span>
                      <span className="font-mono text-emerald-600">{branchCalendar.filter(b => b.status === "OK").length}</span>
                    </div>
                    <div className="flex justify-between text-[#1B2A4A] border-t border-indigo-100 pt-1.5 mt-1">
                      <span>Média Proporcional Calculada (Múltiplos de 5):</span>
                      <span className="font-mono text-indigo-650 font-black">
                        {(() => {
                          const okCount = branchCalendar.filter(b => b.status === "OK").length;
                          const totalCount = branchCalendar.length || 1;
                          return `${Math.round(((okCount / totalCount) * 20) / 5) * 5} pts de 20 pts max`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* NOK Evidence Block with Links Only */}
              {(statusInput === "NOK" || (selectedCriterion?.id === "6" && auditorCerts.some(c => c.status === "Aguardando envio"))) && (
                <div className="p-4 border border-[#F7C1C1] bg-[#FCEBEB] rounded-xl space-y-4 shadow-2xs animate-fade-in duration-300">
                  <div className="flex items-center gap-1.5 text-red-900 font-extrabold text-xs">
                    <span className="material-symbols-outlined text-[16px] text-red-700">warning</span>
                    <span>⚠ Evidência obrigatória para NOK</span>
                  </div>

                  <div className="space-y-4">
                    {/* Link 1 - OBRIGATÓRIO */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-red-800 uppercase tracking-wide block font-sans">
                        LINK 1 (OBRIGATÓRIO) *
                      </label>
                      <input
                        type="url"
                        value={nokLink1Input}
                        onChange={(e) => setNokLink1Input(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full bg-white border border-[#F7C1C1] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-400 placeholder:text-slate-400 font-mono"
                      />
                    </div>

                    {/* Link 2 - OPCIONAL */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-red-800 uppercase tracking-wide block font-sans">
                        LINK 2 (OPCIONAL)
                      </label>
                      <input
                        type="url"
                        value={nokLink2Input}
                        onChange={(e) => setNokLink2Input(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full bg-white border border-[#F7C1C1] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-400 placeholder:text-slate-400 font-mono"
                      />
                    </div>

                    {/* Link 3 - OPCIONAL */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-red-800 uppercase tracking-wide block font-sans">
                        LINK 3 (OPCIONAL)
                      </label>
                      <input
                        type="url"
                        value={nokLink3Input}
                        onChange={(e) => setNokLink3Input(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full bg-white border border-[#F7C1C1] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-400 placeholder:text-slate-400 font-mono"
                      />
                    </div>

                    {/* Descrição do problema - OPCIONAL */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-red-800 uppercase tracking-wide block font-sans">
                        DESCRIÇÃO DO PROBLEMA (OPCIONAL)
                      </label>
                      <textarea
                        rows={2}
                        value={nokEvidenceDescriptionInput}
                        onChange={(e) => setNokEvidenceDescriptionInput(e.target.value)}
                        placeholder="Descreva o problema encontrado (opcional)..."
                        className="w-full bg-white border border-[#F7C1C1] rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-400 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Points display - Binary compliance */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">
                    Pontuação Atribuída (Lógica Binária)
                  </label>
                  <span className="font-black text-[#1B2A4A] font-mono">
                    {statusInput === "OK" ? selectedCriterion.pointsPossible : 0} de {selectedCriterion.pointsPossible} pts max
                  </span>
                </div>
                <div className="text-xs mt-1">
                  {statusInput === "OK" ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>Conforme (OK): Pontuação cheia ({selectedCriterion.pointsPossible} pts) concedida.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-red-650 font-bold bg-red-50 p-2.5 rounded-lg border border-red-200">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>Não Conforme ou Pendente: Zero pontos (0/100) concedidos. Sem pontuação parcial.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Presencial direct evidence launch */}
              {selectedCriterion.auditMode === "Presencial" && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3 shrink-0">
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-indigo-600">rate_review</span>
                    Lançamento de Evidência Presencial (Auditor)
                  </span>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      Evidência Física Observada no Local
                    </label>
                    <textarea
                      rows={2}
                      value={evidenceNotesInput}
                      onChange={(e) => setEvidenceNotesInput(e.target.value)}
                      placeholder="Descreva o estado físico das prateleiras, registros, certificados ou contagens..."
                      className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 font-medium animate-fade-in"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      Fotos da Evidência Presencial (URLs separadas por vírgula, opcional)
                    </label>
                    <input
                      type="text"
                      value={photosInput}
                      onChange={(e) => setPhotosInput(e.target.value)}
                      placeholder="Ex: https://fotos.site.com/foto1.jpg, https://fotos.site.com/foto2.jpg"
                      className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 font-medium animate-fade-in animate-duration-150"
                    />
                  </div>
                </div>
              )}

              {/* Comment / notes removed */}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCriterion(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-bold transition-all hover:bg-slate-100"
              >
                Cancelar
              </button>
              {(() => {
                const hasAnyNokCollab = selectedCriterion?.id === "6" && auditorCerts.some(c => c.status === "Aguardando envio");
                const isNok = statusInput === "NOK" || hasAnyNokCollab;
                const isNokLinkValid = nokLink1Input.trim().toLowerCase().startsWith("https://");

                const handleSaveClick = () => {
                  if (!selectedCriterion) return;
                  if (selectedCriterion.id === "10" && twinBranch) {
                    const twinCrit = twinBranch.criteria.find((tc) => tc.id === "10");
                    if (twinCrit && twinCrit.status === "OK" && statusInput === "NOK" && !showNokConfirm) {
                      setShowNokConfirm(true);
                      return;
                    }
                  }
                  handleSaveEvaluation();
                };

                if (isNok) {
                  return (
                    <button
                      type="button"
                      disabled={!isNokLinkValid}
                      onClick={handleSaveClick}
                      className={`px-5 py-2 text-white rounded-md text-xs font-extrabold shadow transition-all ${
                        !isNokLinkValid
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                          : "bg-red-600 hover:bg-red-700 active:scale-95"
                      }`}
                    >
                      Salvar Avaliação (NOK)
                    </button>
                  );
                }

                return (
                  <button
                    type="button"
                    onClick={handleSaveClick}
                    className="px-5 py-2 bg-[#1B2A4A] text-white rounded-md text-xs font-extrabold shadow hover:brightness-110 active:scale-95 transition-all"
                  >
                    Salvar Avaliação
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURAR LAYOUT MODAL */}
      {showLayoutConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1B2A4A] text-white flex justify-between items-center bg-gradient-to-r from-[#1B2A4A] to-[#21355c]">
              <div>
                <p className="text-[9px] font-bold text-[#C8A84B] uppercase tracking-widest font-mono">
                  CONFIGURAÇÃO DE CRITÉRIO
                </p>
                <h4 className="text-base font-bold leading-tight mt-0.5">Configurar LayOut do Mês</h4>
              </div>
              <button
                onClick={() => setShowLayoutConfigModal(false)}
                className="text-white hover:text-[#C8A84B] transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-705 text-slate-700">Almoxarifado:</p>
                <p className="text-sm font-black text-indigo-900">{branch.name}</p>
                <p className="text-[11px] text-slate-400 font-medium">Ciclo atual: {cycleStateParsed.activeMonth}/{cycleStateParsed.activeYear}</p>
              </div>

              <div className="space-y-1 font-sans">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Localização a ser auditada <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={layoutLocationInput}
                  onChange={(e) => setLayoutLocationInput(e.target.value)}
                  placeholder="Ex: R1-A-A2, Corredor B - Prateleira 3"
                  className="w-full border border-slate-350 bg-white rounded-lg px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#1B2A4A]"
                />
              </div>

              <div className="space-y-1 font-sans">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Instruções Adicionais (opcional)
                </label>
                <textarea
                  rows={3}
                  value={layoutInstructionsInput}
                  onChange={(e) => setLayoutInstructionsInput(e.target.value)}
                  placeholder="Instruções específicas para o almoxarife como identificar códigos específicos, focar na organização das caixas de peças leves..."
                  className="w-full border border-slate-350 bg-white rounded-lg p-3 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#1B2A4A]"
                ></textarea>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowLayoutConfigModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-bold transition-all hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveLayoutConfig}
                className="px-5 py-2 bg-[#1B2A4A] hover:bg-opacity-90 text-white rounded-md text-xs font-extrabold shadow active:scale-95 transition-all"
              >
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURAR TOP 10 MODAL */}
      {showTop10ConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B2A4A] text-white flex justify-between items-center bg-gradient-to-r from-[#1B2A4A] to-[#21355c]">
              <div>
                <p className="text-[9px] font-bold text-[#C8A84B] uppercase tracking-widest font-mono">
                  PARÂMETROS EXIGIDOS DO CRITÉRIO 02
                </p>
                <h4 className="text-sm font-black uppercase tracking-wider leading-tight mt-0.5">⚙ Configurar TOP 10 — {branch.name.replace("ALMOXARIFADO ", "")}</h4>
              </div>
              <button
                onClick={() => setShowTop10ConfigModal(false)}
                className="text-white hover:text-[#C8A84B] transition-colors font-bold"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <p className="text-xs font-bold text-slate-700">Mês de referência:</p>
                <p className="text-sm font-black text-indigo-900 font-sans uppercase">{cycleStateParsed.activeMonth} {cycleStateParsed.activeYear}</p>
                <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-lg text-xs text-slate-500 leading-normal font-medium mt-2">
                  Adicione os itens que o almoxarife deve fotografar este mês. Cada item exige 1 foto. <strong>Mínimo: 1 item, Máximo: 10 itens</strong>.
                </div>
              </div>

              {/* Rows List */}
              <div className="space-y-2.5 font-sans">
                {top10ItemsInput.length === 0 ? (
                  <div className="p-8 border border-dashed text-center text-xs text-slate-400 font-bold rounded-xl bg-slate-50/50">
                    Nenhum item adicionado. Clique no botão de adicionar abaixo para iniciar a lista do mês.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-slate-400 uppercase font-mono px-2">
                      <div className="col-span-1 text-center">Nº</div>
                      <div className="col-span-4">Código do Item</div>
                      <div className="col-span-6">Descrição</div>
                      <div className="col-span-1 text-right"></div>
                    </div>

                    {top10ItemsInput.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50/40 p-2 border rounded-lg hover:border-slate-300 hover:bg-slate-50/75 transition">
                        <div className="col-span-1 text-center font-mono font-bold text-slate-400 text-xs">
                          {idx + 1}
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Código"
                            value={row.code}
                            onChange={(e) => handleUpdateTop10Row(idx, "code", e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-md px-2 py-1.5 text-xs text-slate-800 font-bold font-mono focus:outline-none focus:border-[#1B2A4A]"
                          />
                        </div>
                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="Descrição do material"
                            value={row.description}
                            onChange={(e) => handleUpdateTop10Row(idx, "description", e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-md px-2 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#1B2A4A]"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveTop10Row(idx)}
                            className="w-8 h-8 rounded-md hover:bg-red-50 text-rose-600 font-bold flex items-center justify-center transition border border-transparent hover:border-rose-100 cursor-pointer active:scale-90"
                            title="Remover linha"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add item button */}
              {top10ItemsInput.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddTop10Row}
                  className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black uppercase rounded-lg border border-dashed border-indigo-200 flex items-center justify-center gap-1.5 hover:shadow-xs transition select-none"
                >
                  <span className="material-symbols-outlined text-[15px]">add_circle</span>
                  Adicionar item (MÁX. 10 ITENS — {top10ItemsInput.length}/10)
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowTop10ConfigModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-bold transition hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTop10Config}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-black uppercase shadow transition active:scale-95"
              >
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )}

      {/* FULL SCALE IMAGE AUDIT LIGHTBOX */}
      {activeLightboxImg && (
        <div className="fixed inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 z-[99999] transition-all">
          <div className="relative max-w-xl w-full max-h-[80vh] flex items-center justify-center">
            <img src={activeLightboxImg} alt="Evidência ampliada" className="max-w-full max-h-[80vh] object-contain rounded-xl border border-slate-800 shadow-2xl" />
            <button
              onClick={() => setActiveLightboxImg(null)}
              className="absolute -top-12 right-0 bg-white text-[#1B2A4A] hover:bg-slate-100 font-extrabold w-10 h-10 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
              type="button"
            >
              ✖
            </button>
          </div>
          <p className="text-white/60 text-xs mt-3 font-mono font-bold">Clique no ✖ acima para fechar a visualização</p>
        </div>
      )}
    </div>
  );
}
