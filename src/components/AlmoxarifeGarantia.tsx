import React, { useState, useEffect } from "react";
import { supabase, realtimeFlags } from "../supabaseClient";
import { WarrantyItem, AppUser, Branch } from "../types";
import { initialWarranties } from "../mockData";
import { isSupabaseReady, dbFetchWarranties, dbSaveWarranties, dbSalvarGarantia, dbDeleteWarranty, dbFetchGarantiaFieldConfig, dbFetchPresetItems, dbFetchPresetManufacturers, syncLocalStorageGarantiasToSupabase } from "../supabaseService";
import { getOrderedFields, BUILTIN_GARANTIA_FIELDS, isFieldRequired } from "../utils/fieldOrdering";
import { gerarMesesDisponiveis, getMesesDisponiveis } from "../utils/dateUtils";

interface AlmoxarifeGarantiaProps {
  onBack: () => void;
  user: AppUser;
  branches: Branch[];
  activeBranch?: Branch;
  activeMonth: string;
  activeYear: string;
}

const getPresetItems = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = localStorage.getItem("acandido_preset_items");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
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
};

const getManufacturers = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = localStorage.getItem("acandido_preset_manufacturers");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
  }
  return [
    "ACDELCO", "AUTO NORTE", "AUTOTEC", "B1G WG ROTOR TI", "BGW", "BIAGGIO", "BITZER", "BOCK",
    "BORG-WAGNER", "BOSCH", "CARDAN NORDESTE", "CIA BRAS DIST AUTO", "DENSO", "EATON", "ECO PEÇAS",
    "ELETROGERAL", "ERBS", "FICFRIO", "GARRET MOTION", "GATES", "GR BARBOSA", "HELIAR", "IMOBRAS",
    "ISAQUE", "JR REFRIGERAÇÕES", "MERCEDES-BENZ", "MODEFER", "MOURA", "MULTIPLEX", "PACAEMBU",
    "PELEGRINO", "POLY V", "REDIESEL", "REFRUET", "ROYCE", "SCHADEX", "STA CAMINHÕES", "WWAGCO"
  ];
};

const PRESET_ITEMS = getPresetItems();
const MANUFACTURERS = getManufacturers();

// Helper to translate Portuguese month-year
const getMonthYearFromDate = (dateStr: string, fallbackMonth: string, fallbackYear: string) => {
  if (!dateStr) return `${fallbackMonth} ${fallbackYear}`;
  const parts = dateStr.split("-");
  if (parts.length < 2) return `${fallbackMonth} ${fallbackYear}`;
  const year = parts[0];
  const monthInt = parseInt(parts[1], 10);
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  if (monthInt >= 1 && monthInt <= 12) {
    return `${months[monthInt - 1]} ${year}`;
  }
  return `${fallbackMonth} ${fallbackYear}`;
};

export const getWarrantyStatus = (expiryDateStr?: string) => {
  if (!expiryDateStr) return { label: "SEM DATA", colorClass: "bg-slate-100 text-slate-600 border border-slate-200" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDateStr + 'T00:00:00');
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "VENCIDA", colorClass: "bg-red-50 text-red-700 border border-red-200" };
  } else if (diffDays <= 30) {
    return { label: "A VENCER", colorClass: "bg-amber-50 text-amber-700 border border-amber-200" };
  } else {
    return { label: "VIGENTE", colorClass: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  }
};

export const handleOpenAnexo = (base64OrUrl?: string, filename?: string) => {
  if (!base64OrUrl) return;
  if (base64OrUrl.startsWith("http://") || base64OrUrl.startsWith("https://")) {
    window.open(base64OrUrl, "_blank");
    return;
  }
  const win = window.open("");
  if (win) {
    if (base64OrUrl.startsWith("data:image") || base64OrUrl.startsWith("data:application/pdf")) {
      win.document.write(
        `<!DOCTYPE html><html><head><title>${filename || 'Anexo'}</title><style>html,body{margin:0;height:100%;overflow:hidden;}</style></head><body><iframe src="${base64OrUrl}" width="100%" height="100%" style="border:none;"></iframe></body></html>`
      );
    } else {
      win.document.write(
        `<!DOCTYPE html><html><head><title>${filename || 'Anexo'}</title></head><body style="font-family:sans-serif;padding:30px;"><a href="${base64OrUrl}" download="${filename || 'anexo'}" style="font-size:16px;font-weight:bold;color:#00194C;">Clique aqui para baixar ${filename || 'o arquivo'}</a></body></html>`
      );
    }
  }
};

export const getWarrantyFieldValue = (
  w: WarrantyItem,
  fieldType: "dataNf" | "notaFiscal" | "referencia" | "veiculo" | "localizacao" | "observacao",
  customFields?: any[]
): string => {
  if (!w) return "—";
  const wAny = w as Record<string, any>;

  if (fieldType === "dataNf") {
    const val = w.nfEmissionDate || w.data_emissao_nf || w.data_nf || w.dataNf;
    if (val && val !== "—") {
      try {
        return new Date(val + 'T00:00:00').toLocaleDateString("pt-BR");
      } catch {
        return val;
      }
    }
    if (customFields) {
      const found = customFields.find((f: any) =>
        f.name?.toLowerCase().includes("emissão") || f.name?.toLowerCase().includes("data")
      );
      if (found && (w as Record<string, any>)[found.id]) {
        try {
          return new Date((w as Record<string, any>)[found.id] + 'T00:00:00').toLocaleDateString("pt-BR");
        } catch {
          return (w as Record<string, any>)[found.id];
        }
      }
    }
    return "—";
  }

  if (fieldType === "notaFiscal") {
    if (wAny.nota_fiscal !== undefined && wAny.nota_fiscal !== null && wAny.nota_fiscal !== "" && wAny.nota_fiscal !== "—") return String(wAny.nota_fiscal);
    if (wAny.notaFiscal !== undefined && wAny.notaFiscal !== null && wAny.notaFiscal !== "" && wAny.notaFiscal !== "—") return String(wAny.notaFiscal);
    if (wAny.nota !== undefined && wAny.nota !== null && wAny.nota !== "" && wAny.nota !== "—") return String(wAny.nota);
    if (wAny.nfNumber !== undefined && wAny.nfNumber !== null && wAny.nfNumber !== "" && wAny.nfNumber !== "—") return String(wAny.nfNumber);
    if (customFields) {
      const found = customFields.find((f: any) => f.name?.toLowerCase().includes("nota fiscal") || f.name?.toLowerCase().includes("nota"));
      if (found && wAny[found.id]) return String(wAny[found.id]);
    }
    for (const k of Object.keys(wAny)) {
      if (k.toLowerCase().includes("nota") || k.toLowerCase().includes("fiscal")) {
        if (wAny[k] !== undefined && wAny[k] !== null && wAny[k] !== "" && wAny[k] !== "—") return String(wAny[k]);
      }
    }
    return "—";
  }

  if (fieldType === "referencia") {
    if (wAny.referencia_item !== undefined && wAny.referencia_item !== null && wAny.referencia_item !== "" && wAny.referencia_item !== "—") return String(wAny.referencia_item);
    if (w.reference !== undefined && w.reference !== null && w.reference !== "" && w.reference !== "—") return String(w.reference);
    if (wAny.referencia !== undefined && wAny.referencia !== null && wAny.referencia !== "" && wAny.referencia !== "—") return String(wAny.referencia);
    if (wAny.referenciaItem !== undefined && wAny.referenciaItem !== null && wAny.referenciaItem !== "" && wAny.referenciaItem !== "—") return String(wAny.referenciaItem);
    if (customFields) {
      const found = customFields.find((f: any) => f.name?.toLowerCase().includes("referência") || f.name?.toLowerCase().includes("referencia"));
      if (found && wAny[found.id]) return String(wAny[found.id]);
    }
    for (const k of Object.keys(wAny)) {
      if (k.toLowerCase().includes("referenc") || k.toLowerCase().includes("referência")) {
        if (wAny[k] !== undefined && wAny[k] !== null && wAny[k] !== "" && wAny[k] !== "—") return String(wAny[k]);
      }
    }
    return "—";
  }

  if (fieldType === "veiculo") {
    if (wAny.veiculo !== undefined && wAny.veiculo !== null && wAny.veiculo !== "" && wAny.veiculo !== "—") return String(wAny.veiculo);
    if (wAny.vehicle !== undefined && wAny.vehicle !== null && wAny.vehicle !== "" && wAny.vehicle !== "—") return String(wAny.vehicle);
    if (customFields) {
      const found = customFields.find((f: any) => f.name?.toLowerCase().includes("veículo") || f.name?.toLowerCase().includes("veiculo"));
      if (found && wAny[found.id]) return String(wAny[found.id]);
    }
    for (const k of Object.keys(wAny)) {
      if (k.toLowerCase().includes("veiculo") || k.toLowerCase().includes("veículo")) {
        if (wAny[k] !== undefined && wAny[k] !== null && wAny[k] !== "" && wAny[k] !== "—") return String(wAny[k]);
      }
    }
    return "—";
  }

  if (fieldType === "localizacao") {
    if (wAny.localizacao !== undefined && wAny.localizacao !== null && wAny.localizacao !== "" && wAny.localizacao !== "—") return String(wAny.localizacao);
    if (wAny.location !== undefined && wAny.location !== null && wAny.location !== "" && wAny.location !== "—") return String(wAny.location);
    if (wAny.localizacao_id !== undefined && wAny.localizacao_id !== null && wAny.localizacao_id !== "" && wAny.localizacao_id !== "—") return String(wAny.localizacao_id);
    if (customFields) {
      const found = customFields.find((f: any) => f.name?.toLowerCase().includes("localiza"));
      if (found && wAny[found.id]) return String(wAny[found.id]);
    }
    for (const k of Object.keys(wAny)) {
      if (k.toLowerCase().includes("localiza")) {
        if (wAny[k] !== undefined && wAny[k] !== null && wAny[k] !== "" && wAny[k] !== "—") return String(wAny[k]);
      }
    }
    return "—";
  }

  if (fieldType === "observacao") {
    const obsPeca = wAny.observacao_peca || w.pieceObservation || wAny.observacaoPeca;
    const obsSucata = w.scrapObservation || wAny.observacao_sucata || wAny.observacaoSucata;

    if (obsPeca && obsPeca !== "—" && obsPeca !== "Nenhuma observação") {
      const parts = [obsPeca];
      if (obsSucata && obsSucata !== "—") parts.push(`Sucata: ${obsSucata}`);
      return parts.join(" | ");
    }
    if (obsPeca === "Nenhuma observação") {
      if (obsSucata && obsSucata !== "—") return `Sucata: ${obsSucata}`;
      return "Nenhuma observação";
    }
    if (obsSucata && obsSucata !== "—") {
      return `Sucata: ${obsSucata}`;
    }
    if (wAny.observacao && wAny.observacao !== "—") return String(wAny.observacao);
    if (customFields) {
      const found = customFields.find((f: any) => f.name?.toLowerCase().includes("observa"));
      if (found && wAny[found.id]) return String(wAny[found.id]);
    }
    for (const k of Object.keys(wAny)) {
      if (k.toLowerCase().includes("observa")) {
        if (wAny[k] !== undefined && wAny[k] !== null && wAny[k] !== "" && wAny[k] !== "—") return String(wAny[k]);
      }
    }
    return "—";
  }

  return "—";
};

// Flag global para evitar submit duplo
let submitEmAndamento = false;

export default function AlmoxarifeGarantia({
  onBack,
  user,
  branches,
  activeBranch: propActiveBranch,
  activeMonth,
  activeYear
}: AlmoxarifeGarantiaProps) {
  // Resolve user owned branches
  const ownedBranches = branches.filter(
    (b) => b.ownerName.toLowerCase() === user.ownerName.toLowerCase()
  );

  // Use activeBranch from App-level switcher if provided, otherwise default to first owned branch
  const activeBranch = propActiveBranch || (ownedBranches.length > 0 ? ownedBranches[0] : null);

  const [presetItems, setPresetItems] = useState<Array<{ code: string; description: string }>>(() => getPresetItems());
  const [presetManufacturers, setPresetManufacturers] = useState<string[]>(() => getManufacturers());
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadWarrantiesData = async () => {
      // Limpa o estado para evitar dados de consultas anteriores em memória ao trocar de usuário ou almoxarifado
      setWarranties([]);
      if (isSupabaseReady()) {
        try {
          const targetBranchName = activeBranch ? activeBranch.name : undefined;
          const dbData = await dbFetchWarranties(targetBranchName);
          if (active && Array.isArray(dbData)) {
            setWarranties(dbData);
          }
        } catch (e) {
          console.error("Error fetching warranties from Supabase in AlmoxarifeGarantia:", e);
        }
      }
    };
    loadWarrantiesData();

    const handleGlobalRealtime = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.table === "garantias") {
        if (customEvent.detail.eventType === "DELETE" && customEvent.detail.old?.id) {
          const deletedId = customEvent.detail.old.id;
          setWarranties((prev) => prev.filter((g) => g.id !== deletedId));
        }
        loadWarrantiesData();
      }
    };

    window.addEventListener("realtime-garantias-update", loadWarrantiesData);
    window.addEventListener("realtime-global-update", handleGlobalRealtime);
    return () => {
      active = false;
      window.removeEventListener("realtime-garantias-update", loadWarrantiesData);
      window.removeEventListener("realtime-global-update", handleGlobalRealtime);
    };
  }, [activeBranch?.id, activeBranch?.name, user?.id, user?.name]);

  const [garantiaConfig, setGarantiaConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("acandido_garantia_fields_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.auditorEditHistory === undefined) {
          parsed.auditorEditHistory = true;
        }
        return parsed;
      }
    } catch {}
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

  const isFernandoSilva = user && (user.role === "ADMIN" || user.name === "Fernando Silva" || user.email === "estoque01jp@gmail.com");
  const isPermissionActive = garantiaConfig && (garantiaConfig as any).auditorEditHistory !== false;
  const canFernandoSilvaEditHistory = isFernandoSilva && isPermissionActive;

  const [customFormValues, setCustomFormValues] = useState<Record<string, string>>({});

  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    const loadRemoteConfig = async () => {
      try {
        const remoteCfg = await dbFetchGarantiaFieldConfig();
        if (remoteCfg && typeof remoteCfg === "object" && active) {
          setGarantiaConfig(remoteCfg);
        }
      } catch (e) {
        console.warn("Error fetching remote garantia config:", e);
      }
    };

    const loadRemotePresets = async () => {
      try {
        const [pItems, pMfrs] = await Promise.all([
          dbFetchPresetItems(),
          dbFetchPresetManufacturers()
        ]);
        if (pItems && Array.isArray(pItems) && pItems.length > 0 && active) {
          const normItems = pItems.map((item: any, idx: number) => {
            if (typeof item === "string") return { code: `108${idx + 1}`, description: item };
            if (item && typeof item === "object") {
              return {
                code: item.code || item.codigo || `108${idx + 1}`,
                description: item.description || item.descricao || item.name || ""
              };
            }
            return null;
          }).filter((i): i is { code: string; description: string } => i !== null && Boolean(i.description.trim()));
          if (normItems.length > 0) setPresetItems(normItems);
        }
        if (pMfrs && Array.isArray(pMfrs) && pMfrs.length > 0 && active) {
          const normMfrs = pMfrs.map((m: any) => typeof m === "string" ? m : (m.name || m.description || String(m))).filter(Boolean);
          if (normMfrs.length > 0) setPresetManufacturers(normMfrs);
        }
      } catch (e) {
        console.warn("Error fetching remote presets:", e);
      }
    };

    loadRemoteConfig();
    loadRemotePresets();

    const handleStorage = () => {
      loadRemoteConfig();
      loadRemotePresets();
      try {
        const savedCfg = localStorage.getItem("acandido_garantia_fields_config");
        if (savedCfg) setGarantiaConfig(JSON.parse(savedCfg));
        const savedItems = localStorage.getItem("acandido_preset_items");
        if (savedItems) setPresetItems(JSON.parse(savedItems));
        const savedMfrs = localStorage.getItem("acandido_preset_manufacturers");
        if (savedMfrs) setPresetManufacturers(JSON.parse(savedMfrs));
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("field-configs-updated", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("field-configs-updated", handleStorage);
    };
  }, []);

  const isPresencial = activeBranch?.criteria?.find((c) => c.id === "9")?.auditMode === "Presencial";

  const [branchMonthFilters, setBranchMonthFilters] = useState<Record<string, string>>({});
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WarrantyItem | null>(null);

  // Form Fields
  const [selectedItemCode, setSelectedItemCode] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedAlmoxarifado, setSelectedAlmoxarifado] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [nfEmissionDate, setNfEmissionDate] = useState("");
  const [reference, setReference] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [lastUpdateDate, setLastUpdateDate] = useState(() => {
    // Dynamic default is simulating todays date/month
    const mStr = activeMonth.toLowerCase() === "junho" ? "06" : "01";
    return `2026-${mStr}-10`;
  });
  const [pieceObservation, setPieceObservation] = useState("");
  const [scrapObservation, setScrapObservation] = useState("");

  // Validation and Attachment State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [attachmentFile, setAttachmentFile] = useState<{
    name: string;
    base64: string;
    size: number;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState("");

  const handleFileSelect = (file: File) => {
    setAttachmentError("");
    const allowedExtensions = ["jpg", "jpeg", "png", "pdf"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    if (!allowedExtensions.includes(ext)) {
      setAttachmentError("Formato de arquivo inválido. Permitidos: JPG, PNG ou PDF.");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      setAttachmentError("O arquivo excede o tamanho máximo de 10 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Str = reader.result as string;
      setAttachmentFile({
        name: file.name,
        base64: base64Str,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setAttachmentFile(null);
    setAttachmentError("");
  };

  const isCycleOpen = (() => {
    try {
      const saved = localStorage.getItem("acandido_cycle_state_manual");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.status === "ABERTO";
      }
    } catch (e) {}
    return true;
  })();

  const mesesDisponiveis = gerarMesesDisponiveis();
  const defaultMonthFilter = mesesDisponiveis[0]?.value || `${activeMonth} ${activeYear}`;

  const getMonthFilterForBranch = (branchId: string) => {
    return branchMonthFilters[branchId] || defaultMonthFilter;
  };

  const setMonthFilterForBranch = (branchId: string, month: string) => {
    setBranchMonthFilters((prev) => ({
      ...prev,
      [branchId]: month
    }));
  };

  const activeBranchMonthFilter = activeBranch
    ? getMonthFilterForBranch(activeBranch.id)
    : defaultMonthFilter;

  const persistChange = async (updated: WarrantyItem[]) => {
    if (isSupabaseReady()) {
      try {
        await dbSaveWarranties(updated);
        const freshData = await dbFetchWarranties(activeBranch ? activeBranch.name : undefined);
        if (Array.isArray(freshData) && freshData.length > 0) {
          setWarranties(freshData);
        } else {
          setWarranties(updated);
        }
        window.dispatchEvent(new Event("realtime-garantias-update"));
      } catch (err: any) {
        console.error("Erro ao salvar garantia no Supabase:", err);
        alert("Erro ao salvar garantia no Supabase: " + (err?.message || "Erro de conexão ao banco de dados"));
        return;
      }
    } else {
      setWarranties(updated);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setSelectedItemCode("");
    setSelectedManufacturer("");
    setExpiryDate("");
    setNotaFiscal("");
    setNfEmissionDate("");
    setReference("");
    setVeiculo("");
    setLocalizacao("");
    setCustomFormValues({});
    setFieldErrors({});
    setAttachmentFile(null);
    setAttachmentError("");
    
    const mStr = activeMonth.toLowerCase() === "junho" ? "06" : "01";
    setLastUpdateDate(`2026-${mStr}-10`);
    setPieceObservation("");
    setScrapObservation("");

    // Set auto almoxarifado automatically from activeBranch
    if (activeBranch) {
      setSelectedAlmoxarifado(activeBranch.name);
    } else if (ownedBranches.length > 0) {
      setSelectedAlmoxarifado(ownedBranches[0].name);
    } else {
      setSelectedAlmoxarifado("");
    }

    setShowFormModal(true);
  };

  const handleOpenEdit = (item: WarrantyItem, isAuditOverride = false) => {
    const isOverride = isAuditOverride && canFernandoSilvaEditHistory;
    const isPastMonth = item.monthYear !== activeBranchMonthFilter;
    if (isPastMonth && !isOverride) {
      alert("Apenas leitura: Registros de meses anteriores no histórico não podem ser editados.");
      return;
    }
    setEditingItem(item);
    setSelectedItemCode(item.itemCode);
    setSelectedManufacturer(item.manufacturer);
    setExpiryDate(item.expiryDate);
    setSelectedAlmoxarifado(item.almoxarifado);
    setNotaFiscal(item.notaFiscal || item.nota_fiscal || "");
    setNfEmissionDate(item.nfEmissionDate || item.data_emissao_nf || "");
    setReference(item.reference || item.referencia_item || "");
    setVeiculo(item.veiculo || "");
    setLocalizacao(item.localizacao || "");
    setLastUpdateDate(item.lastUpdateDate);
    setPieceObservation(item.pieceObservation === "Nenhuma observação" ? "" : (item.pieceObservation || item.observacao || ""));
    setScrapObservation(item.scrapObservation || item.observacao_sucata || "");

    setFieldErrors({});
    setAttachmentError("");
    if (item.anexo_base64 || item.arquivo_base64 || item.anexo_url) {
      setAttachmentFile({
        name: item.anexo_nome || "Arquivo Anexado",
        base64: item.anexo_base64 || item.arquivo_base64 || item.anexo_url || "",
        size: 0
      });
    } else {
      setAttachmentFile(null);
    }

    const cValues: Record<string, string> = {};
    if (garantiaConfig.customFields) {
      garantiaConfig.customFields.forEach((f: any) => {
        cValues[f.id] = (item as any)[f.id] || "";
      });
    }
    setCustomFormValues(cValues);

    setShowFormModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitEmAndamento || isSaving) return;
    submitEmAndamento = true;
    setIsSaving(true);

    try {
      const newErrors: Record<string, string> = {};
      let hasError = false;

      if (!selectedItemCode) {
        alert("O campo Item / Descrição da Peça é obrigatório.");
        return;
      }
      if (!expiryDate) {
        alert("O campo Garantia até é obrigatório.");
        return;
      }
      if (!selectedAlmoxarifado) {
        alert("O campo Almoxarifado é obrigatório.");
        return;
      }

      // Validate configured active fields based on isFieldRequired
      const orderedFields = getOrderedFields(garantiaConfig, BUILTIN_GARANTIA_FIELDS);
      orderedFields.forEach((f) => {
        // Skip disabled fields
        if (garantiaConfig && f.id in garantiaConfig && garantiaConfig[f.id] === false) {
          return;
        }

        const isReq = isFieldRequired(f, garantiaConfig);
        if (!isReq) return;

        let val = "";
        if (f.id === "fabricante") {
          val = selectedManufacturer;
        } else if (f.id === "notaFiscal") {
          val = notaFiscal;
        } else if (f.id === "nfEmissionDate") {
          val = nfEmissionDate;
        } else if (f.id === "reference") {
          val = reference;
        } else if (f.id === "veiculo") {
          val = veiculo;
        } else if (f.id === "localizacao") {
          val = localizacao;
        } else if (f.id === "pieceObservation") {
          val = pieceObservation;
        } else if (f.id === "scrapObservation") {
          val = scrapObservation;
        } else {
          val = customFormValues[f.id] || "";
        }

        if (!val || !val.trim() || val === "— Selecione uma opção —") {
          newErrors[f.id] = "Este campo é obrigatório";
          hasError = true;
        }
      });

      if (hasError) {
        setFieldErrors(newErrors);
        const firstError = Object.values(newErrors)[0];
        if (firstError) {
          alert(firstError);
        }
        return;
      }

      const matchedPreset = presetItems.find((pi) => pi.code === selectedItemCode);
      const desc = matchedPreset ? matchedPreset.description : "Desconhecido";
      const finalPieceObs = pieceObservation.trim() === "" ? "Nenhuma observação" : pieceObservation.trim();
      
      // Derive dynamic monthYear filter group from Data de NF
      const finalNfEmissionDate = nfEmissionDate || new Date().toISOString().split('T')[0];
      const derivedMonthYear = getMonthYearFromDate(finalNfEmissionDate, activeMonth, activeYear);

      const autoLastUpdateDate = new Date().toISOString().split('T')[0];

      const base64Anexo = attachmentFile ? attachmentFile.base64 : "";
      const nomeAnexo = attachmentFile ? attachmentFile.name : "";

      if (editingItem) {
        // Edit mode - update database first via UPDATE if connected to Supabase
        const finalAnexo = attachmentFile ? attachmentFile.base64 : (editingItem.anexo_url || editingItem.anexo_base64 || editingItem.arquivo_base64 || null);
        const finalAnexoNome = attachmentFile ? attachmentFile.name : (editingItem.anexo_nome || "");

        const updatePayload = {
          fabricante: selectedManufacturer || null,
          garantia_ate: expiryDate || null,
          data_emissao_nf: finalNfEmissionDate || null,
          referencia_item: reference.trim() || null,
          nota_fiscal: notaFiscal.trim() || null,
          veiculo: veiculo.trim() || null,
          localizacao: localizacao.trim() || null,
          observacao: finalPieceObs || null,
          observacao_sucata: scrapObservation.trim() || null,
          anexo_url: finalAnexo || null,
          item: desc ? `${selectedItemCode} - ${desc}` : selectedItemCode,
          almoxarifado: selectedAlmoxarifado
        };

        if (isSupabaseReady() && editingItem.id && !editingItem.id.startsWith("war-") && !editingItem.id.startsWith("tmp")) {
          realtimeFlags.isLocalUpdate = true;
          let { error } = await supabase
            .from('garantias')
            .update(updatePayload)
            .eq('id', editingItem.id);

          if (error && updatePayload.anexo_url) {
            console.warn("Retrying UPDATE without anexo_url payload:", error.message);
            const safePayload = { ...updatePayload };
            delete safePayload.anexo_url;
            const retry = await supabase
              .from('garantias')
              .update(safePayload)
              .eq('id', editingItem.id);
            error = retry.error;
          }

          if (error) {
            console.error("Erro ao editar garantia no Supabase:", error);
            alert("Erro ao salvar edição no Supabase: " + error.message);
            return;
          }

          setWarranties((prev) =>
            prev.map((g) =>
              g.id === editingItem.id
                ? {
                    ...g,
                    itemCode: selectedItemCode,
                    itemDescription: desc,
                    manufacturer: selectedManufacturer,
                    expiryDate,
                    almoxarifado: selectedAlmoxarifado,
                    notaFiscal: notaFiscal.trim(),
                    nota_fiscal: notaFiscal.trim(),
                    nfEmissionDate: finalNfEmissionDate,
                    data_emissao_nf: finalNfEmissionDate,
                    reference: reference.trim(),
                    referencia_item: reference.trim(),
                    veiculo: veiculo.trim(),
                    localizacao: localizacao.trim(),
                    lastUpdateDate: autoLastUpdateDate,
                    pieceObservation: finalPieceObs,
                    observacao_peca: finalPieceObs,
                    observacao: finalPieceObs,
                    scrapObservation: scrapObservation.trim(),
                    observacao_sucata: scrapObservation.trim(),
                    monthYear: derivedMonthYear,
                    anexo_url: finalAnexo || "",
                    anexo_base64: finalAnexo || "",
                    anexo_nome: finalAnexoNome,
                    ...customFormValues
                  }
                : g
            )
          );
          window.dispatchEvent(new Event("realtime-garantias-update"));
          setTimeout(() => { realtimeFlags.isLocalUpdate = false; }, 2000);
        } else {
          setWarranties((prev) =>
            prev.map((w) => {
              if (w.id === editingItem.id) {
                return {
                  ...w,
                  itemCode: selectedItemCode,
                  itemDescription: desc,
                  manufacturer: selectedManufacturer,
                  expiryDate,
                  almoxarifado: selectedAlmoxarifado,
                  notaFiscal: notaFiscal.trim(),
                  nota_fiscal: notaFiscal.trim(),
                  nfEmissionDate: finalNfEmissionDate,
                  data_emissao_nf: finalNfEmissionDate,
                  reference: reference.trim(),
                  referencia_item: reference.trim(),
                  veiculo: veiculo.trim(),
                  localizacao: localizacao.trim(),
                  lastUpdateDate: autoLastUpdateDate,
                  pieceObservation: finalPieceObs,
                  observacao_peca: finalPieceObs,
                  observacao: finalPieceObs,
                  scrapObservation: scrapObservation.trim(),
                  observacao_sucata: scrapObservation.trim(),
                  monthYear: derivedMonthYear,
                  createdAt: w.createdAt || new Date().toLocaleString("pt-BR"),
                  registeredBy: w.registeredBy || user.name || user.ownerName || "Almoxarife",
                  anexo_url: finalAnexo || "",
                  anexo_base64: finalAnexo || "",
                  arquivo_base64: finalAnexo || "",
                  anexo_nome: finalAnexoNome,
                  ...customFormValues
                };
              }
              return w;
            })
          );
        }
        alert("Item de garantia atualizado com sucesso!");
      } else {
        // Add mode - Single direct DB call without looping or extra SELECTs
        const newItem: WarrantyItem = {
          id: "war-" + Date.now(),
          itemCode: selectedItemCode,
          itemDescription: desc,
          manufacturer: selectedManufacturer,
          expiryDate,
          almoxarifado: selectedAlmoxarifado,
          notaFiscal: notaFiscal.trim(),
          nota_fiscal: notaFiscal.trim(),
          nfEmissionDate: finalNfEmissionDate,
          data_emissao_nf: finalNfEmissionDate,
          reference: reference.trim(),
          referencia_item: reference.trim(),
          veiculo: veiculo.trim(),
          localizacao: localizacao.trim(),
          lastUpdateDate: autoLastUpdateDate,
          pieceObservation: finalPieceObs,
          observacao_peca: finalPieceObs,
          observacao: finalPieceObs,
          scrapObservation: scrapObservation.trim(),
          observacao_sucata: scrapObservation.trim(),
          monthYear: derivedMonthYear,
          createdAt: new Date().toLocaleString("pt-BR"),
          registeredBy: user.name || user.ownerName || "Almoxarife",
          anexo_url: base64Anexo,
          anexo_base64: base64Anexo,
          arquivo_base64: base64Anexo,
          anexo_nome: nomeAnexo,
          ...customFormValues
        };

        if (isSupabaseReady()) {
          realtimeFlags.isLocalUpdate = true;
          const savedRow = await dbSalvarGarantia({
            ...newItem,
            fabricante: selectedManufacturer,
            garantia_ate: expiryDate,
            registeredBy: user.name || user.ownerName || "Almoxarife",
            data_emissao_nf: finalNfEmissionDate,
            referencia_item: reference.trim(),
            nota_fiscal: notaFiscal.trim(),
            veiculo: veiculo.trim(),
            localizacao: localizacao.trim(),
            observacao: finalPieceObs,
            observacao_sucata: scrapObservation.trim(),
            anexo_url: base64Anexo
          });

          const finalSavedItem: WarrantyItem = {
            ...newItem,
            id: savedRow?.id ? String(savedRow.id) : newItem.id
          };

          setWarranties((prev) => [finalSavedItem, ...prev]);
          window.dispatchEvent(new Event("realtime-garantias-update"));
          setTimeout(() => { realtimeFlags.isLocalUpdate = false; }, 2000);
        } else {
          setWarranties((prev) => [newItem, ...prev]);
        }
        alert("✅ Item de garantia registrado com sucesso!");
      }

      setEditingItem(null);
      setShowFormModal(false);
    } catch (err: any) {
      console.error("Erro ao salvar garantia:", err);
      alert("❌ Erro ao salvar garantia: " + (err?.message || "Erro de conexão com o banco de dados"));
    } finally {
      setIsSaving(false);
      submitEmAndamento = false;
    }
  };

  const handleDeleteItem = (id: string) => {
    setCustomConfirm({
      isOpen: true,
      title: "Remover Item de Garantia",
      message: "Deseja realmente remover este item de garantia?",
      onConfirm: async () => {
        const updated = warranties.filter((w) => w.id !== id);
        setWarranties(updated);
        if (isSupabaseReady()) {
          try {
            await dbDeleteWarranty(id);
            const freshData = await dbFetchWarranties(activeBranch ? activeBranch.name : undefined);
            setWarranties(freshData);
            window.dispatchEvent(new Event("realtime-garantias-update"));
          } catch (e) {
            console.error("Error deleting warranty:", e);
          }
        }
        setCustomConfirm(null);
      }
    });
  };

  // Filter local warranties list for the active branch and the active branch's selected monthly filter
  const filteredWarranties = warranties.filter((w) => {
    if (!activeBranch) return false;
    const normW = (w.almoxarifado || "").toLowerCase().replace(/^almoxarifado\s+/i, "").trim();
    const normB = (activeBranch.name || "").toLowerCase().replace(/^almoxarifado\s+/i, "").trim();
    const isCurrentBranch = normW === normB || w.almoxarifado === activeBranch.id || w.almoxarifado === activeBranch.name;
    const isFilteredMonth = w.monthYear === activeBranchMonthFilter;
    return isCurrentBranch && isFilteredMonth;
  });

  // Calculate dynamic monthly summaries for the lateral card
  const totalRegisteredItems = filteredWarranties.length;
  const itemCounts = filteredWarranties.reduce((acc, curr) => {
    const key = curr.itemDescription || curr.itemCode;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="w-full max-w-full space-y-6" id="almoxarife-garantia-view">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-600 active:scale-95 transition-all shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl font-black text-[#1B2A4A] leading-tight">Histórico de Garantias por Mês</h2>
            <p className="text-xs text-slate-400 mt-0.5">Substituição e Coletas de Peças com Vício Técnico</p>
          </div>
        </div>

        {!isPresencial && (
          <button
            onClick={handleOpenAdd}
            className="bg-[#1B2A4A] hover:bg-[#0E172B] active:scale-95 text-white font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0 sm:self-center"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            + Novo Item de Garantia
          </button>
        )}
      </div>

      {isPresencial && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 animate-fade-in shadow-sm">
          <span className="material-symbols-outlined text-blue-650 text-[24px] shrink-0 mt-0.5">info</span>
          <div className="text-xs">
            <p className="font-bold text-blue-900 text-sm">📋 Auditoria Presencial Ativa</p>
            <p className="text-slate-655 mt-1 leading-relaxed text-slate-600 font-medium">
              O critério <strong>09 - Controle de Garantia</strong> para esta unidade foi configurado como <strong>Presencial</strong> pelo auditor Fernando Silva. Os lançamentos, tratativas e status serão verificados pessoalmente no local. Os botões de cadastro ou edição foram desativados.
            </p>
          </div>
        </div>
      )}

      {/* MONTHLY FILTER AND EXPLANATORY LEGEND */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 audit-card-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2.5">
          <label className="text-xs font-semibold text-slate-500">Selecione o Mês:</label>
          <select
            value={activeBranchMonthFilter}
            onChange={(e) => {
              if (activeBranch) {
                setMonthFilterForBranch(activeBranch.id, e.target.value);
              }
            }}
            className="border border-slate-250 bg-white rounded-lg px-3 py-2 text-xs font-bold text-[#1B2A4A] focus:outline-none focus:border-[#1B2A4A]"
          >
            {mesesDisponiveis.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* TABLE VISUALIZATION CONTAINER (DESKTOP & TABLET) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-fit w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 select-none">
                <th className="p-4 py-3.5 font-black text-left min-w-[180px]">ITEM</th>
                <th className="p-4 py-3.5 font-black text-left min-w-[120px]">FABRICANTE</th>
                <th className="p-4 py-3.5 font-black text-left min-w-[110px]">GARANTIA ATÉ</th>
                <th className="p-4 py-3.5 font-black text-left min-w-[100px]">DATA NF</th>
                <th className="p-4 py-3.5 font-black text-left min-w-[110px]">NOTA FISCAL</th>
                <th className="p-4 py-3.5 font-black text-left min-w-[110px]">REFERÊNCIA</th>
                <th className="p-4 py-3.5 font-black text-left min-w-[100px]">VEÍCULO</th>
                <th className="p-4 py-3.5 font-black text-left min-w-[120px]">LOCALIZAÇÃO</th>
                <th className="p-4 py-3.5 font-black text-left min-w-[160px]">OBSERVAÇÃO</th>
                <th className="p-4 py-3.5 font-black text-center min-w-[80px]">ANEXO</th>
                <th className="p-4 py-3.5 font-black text-center min-w-[100px]">STATUS</th>
                <th className="p-4 py-3.5 font-black text-center min-w-[90px]">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredWarranties.length > 0 ? (
                filteredWarranties.map((w) => {
                  const status = getWarrantyStatus(w.expiryDate);
                  const dataNf = getWarrantyFieldValue(w, "dataNf", garantiaConfig?.customFields);
                  const notaFiscal = getWarrantyFieldValue(w, "notaFiscal", garantiaConfig?.customFields);
                  const referencia = getWarrantyFieldValue(w, "referencia", garantiaConfig?.customFields);
                  const veiculo = getWarrantyFieldValue(w, "veiculo", garantiaConfig?.customFields);
                  const localizacao = getWarrantyFieldValue(w, "localizacao", garantiaConfig?.customFields);
                  const observacao = getWarrantyFieldValue(w, "observacao", garantiaConfig?.customFields);
                  const hasAnexo = Boolean((w as any).anexo_base64 || (w as any).arquivo_base64);

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 py-3.5">
                        <span className="font-bold text-[#1B2A4A] text-xs block">{w.itemCode || "—"}</span>
                        <span className="text-slate-500 text-[11px] block mt-0.5 leading-snug">{w.itemDescription || "Sem descrição"}</span>
                      </td>
                      <td className="p-4 py-3.5 text-slate-700 font-bold uppercase whitespace-nowrap">{w.manufacturer || "—"}</td>
                      <td className="p-4 py-3.5 text-slate-800 font-mono font-bold whitespace-nowrap">
                        {w.expiryDate ? new Date(w.expiryDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-4 py-3.5 text-slate-600 font-mono whitespace-nowrap">{dataNf}</td>
                      <td className="p-4 py-3.5 text-slate-700 font-mono font-bold whitespace-nowrap">{notaFiscal}</td>
                      <td className="p-4 py-3.5 text-slate-600 font-mono whitespace-nowrap">{referencia}</td>
                      <td className="p-4 py-3.5 text-slate-700 font-bold uppercase whitespace-nowrap">{veiculo}</td>
                      <td className="p-4 py-3.5 text-slate-700 font-bold whitespace-nowrap">{localizacao}</td>
                      <td className="p-4 py-3.5 text-slate-600 text-xs min-w-[160px]">{observacao}</td>
                      <td className="p-4 py-3.5 text-center whitespace-nowrap">
                        {hasAnexo ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAnexo((w as any).anexo_base64 || (w as any).arquivo_base64, (w as any).anexo_nome)}
                            title="Visualizar / Baixar Anexo"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#00194C] transition inline-flex items-center justify-center cursor-pointer active:scale-95 border border-slate-200"
                          >
                            <span className="material-symbols-outlined text-[18px]">attach_file</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="p-4 py-3.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full ${status.colorClass}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-4 py-3.5 text-center whitespace-nowrap">
                        {!isPresencial ? (
                          (() => {
                            const isOwnRecord = !w.registeredBy || w.registeredBy.toLowerCase() === (user.name || "").toLowerCase() || w.registeredBy.toLowerCase() === (user.ownerName || "").toLowerCase();
                            if (!isOwnRecord) return <span className="text-[11px] text-slate-400 font-medium italic">—</span>;
                            return (
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(w)}
                                  title="Editar"
                                  className="p-1.5 px-2.5 rounded-lg bg-transparent border border-[#00194C] text-[#00194C] hover:bg-[#E8EDF5] transition flex items-center gap-1 text-xs font-bold active:scale-95 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit</span>
                                  <span>Editar</span>
                                </button>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Auditoria Local</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400 font-medium whitespace-normal">
                    <span className="material-symbols-outlined text-[42px] block mb-2 text-slate-300">shield_with_heart</span>
                    Nenhum item registrado para o mês de <strong className="text-slate-600">{activeBranchMonthFilter}</strong> neste almoxarifado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CARDS VISUALIZATION FOR MOBILE (CELLPHONE) */}
      <div className="block md:hidden space-y-3">
        {filteredWarranties.length > 0 ? (
          filteredWarranties.map((w) => {
            const status = getWarrantyStatus(w.expiryDate);
            const dataNf = getWarrantyFieldValue(w, "dataNf", garantiaConfig?.customFields);
            const notaFiscal = getWarrantyFieldValue(w, "notaFiscal", garantiaConfig?.customFields);
            const referencia = getWarrantyFieldValue(w, "referencia", garantiaConfig?.customFields);
            const veiculo = getWarrantyFieldValue(w, "veiculo", garantiaConfig?.customFields);
            const localizacao = getWarrantyFieldValue(w, "localizacao", garantiaConfig?.customFields);
            const observacao = getWarrantyFieldValue(w, "observacao", garantiaConfig?.customFields);
            const hasAnexo = Boolean((w as any).anexo_base64 || (w as any).arquivo_base64);

            return (
              <div key={w.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-sm font-black text-[#1B2A4A] block">{w.itemCode || "—"}</span>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{w.itemDescription || "Sem descrição"}</p>
                  </div>
                  <span className={`px-2 py-0.5 font-bold text-[10px] rounded uppercase shrink-0 ${status.colorClass}`}>
                    {status.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  {w.manufacturer && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Fabricante</span>
                      <span className="font-bold text-slate-700 uppercase">{w.manufacturer}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Garantia Até</span>
                    <span className="font-mono font-bold text-slate-800">
                      {w.expiryDate ? new Date(w.expiryDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Data NF</span>
                    <span className="font-mono text-slate-700">{dataNf}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Nota Fiscal</span>
                    <span className="font-mono font-bold text-slate-800">{notaFiscal}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Referência</span>
                    <span className="font-mono text-slate-700">{referencia}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Veículo</span>
                    <span className="font-bold text-slate-700 uppercase">{veiculo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Localização</span>
                    <span className="font-bold text-slate-700">{localizacao}</span>
                  </div>
                  {hasAnexo && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Anexo</span>
                      <button
                        type="button"
                        onClick={() => handleOpenAnexo((w as any).anexo_base64 || (w as any).arquivo_base64, (w as any).anexo_nome)}
                        className="mt-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[#00194C] font-bold text-xs flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">attach_file</span>
                        Ver Anexo
                      </button>
                    </div>
                  )}
                  {observacao !== "—" && (
                    <div className="col-span-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Observação</span>
                      <p className="text-xs text-slate-700">{observacao}</p>
                    </div>
                  )}
                </div>

                {!isPresencial && (() => {
                  const isOwnRecord = !w.registeredBy || w.registeredBy.toLowerCase() === (user.name || "").toLowerCase() || w.registeredBy.toLowerCase() === (user.ownerName || "").toLowerCase();
                  if (!isOwnRecord) return null;
                  return (
                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(w)}
                        className="px-3 py-1.5 rounded-lg bg-transparent border border-[#00194C] text-[#00194C] hover:bg-[#E8EDF5] text-xs font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-400 font-medium">
            <span className="material-symbols-outlined text-[36px] block mb-2 text-slate-300">shield_with_heart</span>
            Nenhum item registrado para o mês de <strong className="text-slate-600">{activeBranchMonthFilter}</strong> neste almoxarifado.
          </div>
        )}
      </div>

      {/* VISUAL SEPARATOR */}
      <div className="py-2 border-t border-slate-100 mt-4"></div>

      {/* MONTHLY SUMMARY CARD PANEL - REPOSITIONED BELOW THE TABLE */}
      <div className="bg-white border border-slate-150 rounded-xl p-6 shadow-sm w-full font-sans" id="resumo-da-garantia">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
          <span className="material-symbols-outlined text-[#1B2A4A] text-[20px] select-none">analytics</span>
          <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider">
            📊 RESUMO DO MÊS — {activeBranchMonthFilter}
          </h4>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between shadow-3xs mb-4">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider leading-none">
              Total de itens registrados no mês selecionado:
            </p>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">
              Ciclo de {activeBranchMonthFilter}
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-[#1B2A4A] font-mono leading-none">
              {totalRegisteredItems}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-bold block mt-1">itens</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex justify-between items-center">
            <span>Contagem por item (apenas itens ativos):</span>
            <span className="text-slate-450 font-mono text-[9px] lowercase font-semibold text-amber-600">({Object.keys(itemCounts).length} itens ativos)</span>
          </p>

          {Object.keys(itemCounts).length > 0 ? (
            <div className="border border-slate-150 rounded-lg overflow-hidden bg-white w-full shadow-3xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-[0.05em] text-[9px] border-b border-slate-150">
                    <th className="p-3 font-bold text-left">Item</th>
                    <th className="p-3 font-bold text-center w-24">Quantidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {Object.entries(itemCounts).map(([item, count]) => (
                    <tr key={item} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-[#1B2A4A] truncate max-w-xs" title={item}>
                        {item}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-950 font-black">
                        {count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs italic font-medium border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
              Nenhum registro para resumir neste período.
            </div>
          )}
        </div>
      </div>

      {/* DRAWER / MODAL DIALOG FORM */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden my-8">
            <div className="px-5 py-4 bg-[#1B2A4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {editingItem ? "Editar Item de Garantia" : "Lançar Novo Item de Garantia"}
                </h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Catalogação técnica de vícios técnicos de fábrica</p>
              </div>
              <button onClick={() => setShowFormModal(false)} className="text-white hover:text-[#C8A84B]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-1">
                Seção: Informações do Item
              </span>

              {/* Item selection preset */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1B2A4A]">Item *</label>
                <select
                  required
                  value={selectedItemCode}
                  onChange={(e) => setSelectedItemCode(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                >
                  <option value="">— Selecione o Item —</option>
                  {presetItems.map((pi) => (
                    <option key={pi.code} value={pi.code}>
                      {pi.code} - {pi.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Expiry warranty calendar date */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1B2A4A]">Garantia até *</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#1B2A4A]"
                  />
                </div>

                {/* Almoxarifado automatic prefilled (Informativo, não editável) */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-400">Almoxarifado</span>
                  <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black rounded-lg px-3 py-2 select-none">
                    {selectedAlmoxarifado ? selectedAlmoxarifado.replace("ALMOXARIFADO ", "") : "—"}
                  </div>
                </div>
              </div>

              {/* Dynamic Ordered Configurable Fields */}
              {getOrderedFields(garantiaConfig, BUILTIN_GARANTIA_FIELDS).map((field) => {
                const isReq = isFieldRequired(field, garantiaConfig);
                const fieldErr = fieldErrors[field.id];

                if (field.id === "fabricante") {
                  if (garantiaConfig.fabricante === false) return null;
                  return (
                    <div key="fabricante" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        Fabricante{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      <select
                        value={selectedManufacturer}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedManufacturer(val);
                          if (val) setFieldErrors((prev) => ({ ...prev, fabricante: "" }));
                        }}
                        className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
                      >
                        <option value="">— Selecione o Fabricante —</option>
                        {presetManufacturers.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      {fieldErr && <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{fieldErr}</p>}
                    </div>
                  );
                }

                if (field.id === "notaFiscal") {
                  if (garantiaConfig.notaFiscal === false) return null;
                  return (
                    <div key="notaFiscal" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        Nota Fiscal{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      <input
                        type="text"
                        placeholder="Digite a nota fiscal"
                        value={notaFiscal}
                        onChange={(e) => {
                          setNotaFiscal(e.target.value);
                          if (e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, notaFiscal: "" }));
                        }}
                        className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
                      />
                      {fieldErr && <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{fieldErr}</p>}
                    </div>
                  );
                }

                if (field.id === "nfEmissionDate") {
                  if (garantiaConfig.nfEmissionDate === false) return null;
                  return (
                    <div key="nfEmissionDate" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        Data de Emissão da NF{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      <input
                        type="date"
                        value={nfEmissionDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNfEmissionDate(val);
                          if (val.trim()) {
                            setFieldErrors((prev) => ({ ...prev, nfEmissionDate: "" }));
                          }
                        }}
                        className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#1B2A4A]`}
                      />
                      {fieldErr && (
                        <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">
                          {fieldErr}
                        </p>
                      )}
                    </div>
                  );
                }

                if (field.id === "reference") {
                  if (garantiaConfig.reference === false) return null;
                  return (
                    <div key="reference" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        Referência do Item{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      <input
                        type="text"
                        placeholder="—"
                        value={reference}
                        onChange={(e) => {
                          setReference(e.target.value);
                          if (e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, reference: "" }));
                        }}
                        className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
                      />
                      {fieldErr && <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{fieldErr}</p>}
                    </div>
                  );
                }

                if (field.id === "veiculo") {
                  if (garantiaConfig.veiculo === false) return null;
                  return (
                    <div key="veiculo" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        Veículo{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: V-102"
                        value={veiculo}
                        onChange={(e) => {
                          setVeiculo(e.target.value);
                          if (e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, veiculo: "" }));
                        }}
                        className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
                      />
                      {fieldErr && <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{fieldErr}</p>}
                    </div>
                  );
                }

                if (field.id === "localizacao") {
                  if (garantiaConfig.localizacao === false) return null;
                  return (
                    <div key="localizacao" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        Localização{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      <select
                        value={localizacao}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLocalizacao(val);
                          if (val.trim()) setFieldErrors((prev) => ({ ...prev, localizacao: "" }));
                        }}
                        style={{
                          height: "40px",
                          border: fieldErr ? "1.5px solid #F11E26" : "1.5px solid #CBD5E1",
                          borderRadius: "8px"
                        }}
                        className="w-full bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                      >
                        <option value="">— Selecione a Localização —</option>
                        <option value="Em Uso">Em Uso</option>
                        <option value="Em Garantia">Em Garantia</option>
                        <option value="Em Estoque">Em Estoque</option>
                        <option value="Sucateado">Sucateado</option>
                      </select>
                      {fieldErr && <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{fieldErr}</p>}
                    </div>
                  );
                }

                if (field.id === "pieceObservation") {
                  if (garantiaConfig.pieceObservation === false) return null;
                  return (
                    <div key="pieceObservation" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        Observação da Peça{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Se vazio, exibirá automaticamente: Nenhuma observação"
                        value={pieceObservation}
                        onChange={(e) => {
                          setPieceObservation(e.target.value);
                          if (e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, pieceObservation: "" }));
                        }}
                        className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg p-3 text-xs focus:outline-none focus:border-[#1B2A4A] text-slate-700`}
                      ></textarea>
                      {fieldErr && <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{fieldErr}</p>}
                    </div>
                  );
                }

                if (field.id === "scrapObservation") {
                  if (garantiaConfig.scrapObservation === false) return null;
                  return (
                    <div key="scrapObservation" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        Observação de Sucata{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      <input
                        type="text"
                        placeholder="Introduza o valor aqui"
                        value={scrapObservation}
                        onChange={(e) => {
                          setScrapObservation(e.target.value);
                          if (e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, scrapObservation: "" }));
                        }}
                        className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
                      />
                      {fieldErr && <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{fieldErr}</p>}
                    </div>
                  );
                }

                // Custom fields
                if (!field.builtIn) {
                  return (
                    <div key={field.id} className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        {field.name}{isReq && <span className="text-[#F11E26]"> *</span>}
                      </label>
                      {field.type === "select" ? (
                        <select
                          value={customFormValues[field.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomFormValues(prev => ({ ...prev, [field.id]: val }));
                            if (val && val !== "— Selecione uma opção —" && val.trim()) {
                              setFieldErrors(prev => ({ ...prev, [field.id]: "" }));
                            }
                          }}
                          className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
                        >
                          <option value="">— Selecione uma opção —</option>
                          {(field.options || []).map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          value={customFormValues[field.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomFormValues(prev => ({ ...prev, [field.id]: val }));
                            if (val.trim()) {
                              setFieldErrors(prev => ({ ...prev, [field.id]: "" }));
                            }
                          }}
                          className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#1B2A4A]`}
                        />
                      ) : field.type === "number" ? (
                        <input
                          type="number"
                          placeholder="Digite valor numérico"
                          value={customFormValues[field.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomFormValues(prev => ({ ...prev, [field.id]: val }));
                            if (val.trim()) {
                              setFieldErrors(prev => ({ ...prev, [field.id]: "" }));
                            }
                          }}
                          className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder={`Digite ${field.name.toLowerCase()}`}
                          value={customFormValues[field.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomFormValues(prev => ({ ...prev, [field.id]: val }));
                            if (val.trim()) {
                              setFieldErrors(prev => ({ ...prev, [field.id]: "" }));
                            }
                          }}
                          className={`w-full border ${fieldErr ? "border-[#F11E26]" : "border-slate-200"} rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
                        />
                      )}
                      {fieldErr && (
                        <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{fieldErr}</p>
                      )}
                    </div>
                  );
                }

                return null;
              })}

              {/* ALTERAÇÃO 2 — ADICIONAR CAMPO DE ANEXO NO FINAL DO FORMULÁRIO */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-[#1B2A4A]">Anexo (opcional)</label>

                {attachmentFile ? (
                  <div className="border border-slate-200 rounded-[8px] p-[16px] bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="material-symbols-outlined text-[#16A34A] text-[20px] shrink-0">
                        description
                      </span>
                      <span className="text-xs font-bold text-[#16A34A] truncate">
                        {attachmentFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="text-red-500 hover:text-red-700 p-1 transition shrink-0 flex items-center justify-center"
                      title="Remover arquivo"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ) : (
                  <label
                    className="border border-dashed border-[#CBD5E1] rounded-[8px] p-[16px] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50/80 transition text-center group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelect(e.target.files[0]);
                          e.target.value = "";
                        }
                      }}
                    />
                    <span className="material-symbols-outlined text-[#94A3B8] text-[24px] mb-1 group-hover:scale-110 transition">
                      attach_file
                    </span>
                    <span className="text-xs font-medium text-[#94A3B8]">
                      Clique para anexar ou arraste o arquivo
                    </span>
                    <span className="text-[10px] text-[#94A3B8] mt-0.5">
                      JPG, PNG ou PDF • máx. 10 MB
                    </span>
                  </label>
                )}

                {attachmentError && (
                  <p className="text-[12px] text-[#F11E26] font-medium mt-0.5">{attachmentError}</p>
                )}
              </div>



              {/* Footer action buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                  className="px-5 py-2.5 bg-[#1B2A4A] text-white rounded-lg text-xs font-extrabold shadow hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    editingItem ? "Salvar Alterações" : "Registrar Garantia"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CUSTOM iframe-safe CONFIRMATION ================= */}
      {customConfirm && customConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-left">
            <header className="border-b border-slate-100 pb-2 mb-4 flex items-center gap-2 text-[#1B2A4A]">
              <span className="material-symbols-outlined text-[24px]">help_center</span>
              <h3 className="text-sm font-black uppercase tracking-wider">{customConfirm.title}</h3>
            </header>

            <div className="space-y-4 text-xs font-sans">
              <p className="leading-relaxed font-semibold text-slate-700">
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
