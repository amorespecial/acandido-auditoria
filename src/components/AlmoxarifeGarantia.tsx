import React, { useState, useEffect } from "react";
import { WarrantyItem, AppUser, Branch } from "../types";
import { initialWarranties } from "../mockData";
import { isSupabaseReady, dbFetchWarranties, dbSaveWarranties, dbFetchGarantiaFieldConfig, dbFetchPresetItems, dbFetchPresetManufacturers } from "../supabaseService";
import { getOrderedFields, BUILTIN_GARANTIA_FIELDS } from "../utils/fieldOrdering";

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

  // State
  const [warranties, setWarranties] = useState<WarrantyItem[]>(() => {
    const saved = localStorage.getItem("acandido_warranties");
    return saved ? JSON.parse(saved) : initialWarranties;
  });

  useEffect(() => {
    const loadWarrantiesData = async () => {
      if (isSupabaseReady()) {
        try {
          const dbData = await dbFetchWarranties();
          if (dbData && dbData.length > 0) {
            setWarranties(dbData);
            localStorage.setItem("acandido_warranties", JSON.stringify(dbData));
          }
        } catch (e) {
          console.error("Error fetching warranties from Supabase in AlmoxarifeGarantia:", e);
        }
      }
    };
    loadWarrantiesData();

    window.addEventListener("realtime-garantias-update", loadWarrantiesData);
    return () => {
      window.removeEventListener("realtime-garantias-update", loadWarrantiesData);
    };
  }, []);

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

    loadRemoteConfig();

    const handleStorage = () => {
      loadRemoteConfig();
      try {
        const saved = localStorage.getItem("acandido_garantia_fields_config");
        if (saved) {
          setGarantiaConfig(JSON.parse(saved));
        }
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

  // Use activeBranch from App-level switcher if provided, otherwise default to first owned branch
  const activeBranch = propActiveBranch || (ownedBranches.length > 0 ? ownedBranches[0] : null);

  const isPresencial = activeBranch?.criteria?.find((c) => c.id === "9")?.auditMode === "Presencial";

  const [branchMonthFilters, setBranchMonthFilters] = useState<Record<string, string>>({});
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WarrantyItem | null>(null);

  // Form Fields
  const [selectedItemCode, setSelectedItemCode] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedAlmoxarifado, setSelectedAlmoxarifado] = useState("");
  const [nfEmissionDate, setNfEmissionDate] = useState("");
  const [reference, setReference] = useState("");
  const [lastUpdateDate, setLastUpdateDate] = useState(() => {
    // Dynamic default is simulating todays date/month
    const mStr = activeMonth.toLowerCase() === "junho" ? "06" : "01";
    return `2026-${mStr}-10`;
  });
  const [pieceObservation, setPieceObservation] = useState("");
  const [scrapObservation, setScrapObservation] = useState("");

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

  const getMonthFilterForBranch = (branchId: string) => {
    return branchMonthFilters[branchId] || `${activeMonth} ${activeYear}`;
  };

  const setMonthFilterForBranch = (branchId: string, month: string) => {
    setBranchMonthFilters((prev) => ({
      ...prev,
      [branchId]: month
    }));
  };

  const activeBranchMonthFilter = activeBranch
    ? getMonthFilterForBranch(activeBranch.id)
    : `${activeMonth} ${activeYear}`;

  const persistChange = (updated: WarrantyItem[]) => {
    setWarranties(updated);
    localStorage.setItem("acandido_warranties", JSON.stringify(updated));
    if (isSupabaseReady()) {
      dbSaveWarranties(updated).catch((err) => {
        console.error("Error saving warranties to Supabase in AlmoxarifeGarantia:", err);
      });
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setSelectedItemCode("");
    setSelectedManufacturer("");
    setExpiryDate("");
    setNfEmissionDate("");
    setReference("");
    setCustomFormValues({});
    
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
    setNfEmissionDate(item.nfEmissionDate);
    setReference(item.reference);
    setLastUpdateDate(item.lastUpdateDate);
    setPieceObservation(item.pieceObservation === "Nenhuma observação" ? "" : item.pieceObservation);
    setScrapObservation(item.scrapObservation);

    const cValues: Record<string, string> = {};
    if (garantiaConfig.customFields) {
      garantiaConfig.customFields.forEach((f: any) => {
        cValues[f.id] = (item as any)[f.id] || "";
      });
    }
    setCustomFormValues(cValues);

    setShowFormModal(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemCode || !expiryDate || !selectedAlmoxarifado) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (garantiaConfig.fabricante && !selectedManufacturer) {
      alert("Por favor, selecione o Fabricante.");
      return;
    }

    if (garantiaConfig.nfEmissionDate && !nfEmissionDate) {
      alert("Por favor, selecione a Data de Emissão da NF.");
      return;
    }

    // Verify custom fields requirement
    if (garantiaConfig.customFields) {
      const missing = garantiaConfig.customFields.find((f: any) => f.required && !customFormValues[f.id]?.trim());
      if (missing) {
        alert(`Por favor, preencha o campo obrigatório: ${missing.name}`);
        return;
      }
    }

    const matchedPreset = PRESET_ITEMS.find((pi) => pi.code === selectedItemCode);
    const desc = matchedPreset ? matchedPreset.description : "Desconhecido";
    const finalPieceObs = pieceObservation.trim() === "" ? "Nenhuma observação" : pieceObservation.trim();
    
    // Derive dynamic monthYear filter group from Data de NF
    const finalNfEmissionDate = nfEmissionDate || new Date().toISOString().split('T')[0];
    const derivedMonthYear = getMonthYearFromDate(finalNfEmissionDate, activeMonth, activeYear);

    if (editingItem) {
      // Edit mode
      const updated = warranties.map((w) => {
        if (w.id === editingItem.id) {
          return {
            ...w,
            itemCode: selectedItemCode,
            itemDescription: desc,
            manufacturer: selectedManufacturer,
            expiryDate,
            almoxarifado: selectedAlmoxarifado,
            nfEmissionDate: finalNfEmissionDate,
            reference,
            lastUpdateDate,
            pieceObservation: finalPieceObs,
            scrapObservation: scrapObservation.trim(),
            monthYear: derivedMonthYear,
            createdAt: w.createdAt || new Date().toLocaleString("pt-BR"),
            ...customFormValues
          };
        }
        return w;
      });
      persistChange(updated);
      alert("Item de garantia atualizado com sucesso!");
    } else {
      // Add mode
      const newItem: WarrantyItem = {
        id: "war-" + Date.now(),
        itemCode: selectedItemCode,
        itemDescription: desc,
        manufacturer: selectedManufacturer,
        expiryDate,
        almoxarifado: selectedAlmoxarifado,
        nfEmissionDate: finalNfEmissionDate,
        reference,
        lastUpdateDate,
        pieceObservation: finalPieceObs,
        scrapObservation: scrapObservation.trim(),
        monthYear: derivedMonthYear,
        createdAt: new Date().toLocaleString("pt-BR"),
        ...customFormValues
      };
      persistChange([newItem, ...warranties]);
      alert("Item de garantia registrado com sucesso!");
    }

    setShowFormModal(false);
  };

  const handleDeleteItem = (id: string) => {
    setCustomConfirm({
      isOpen: true,
      title: "Remover Item de Garantia",
      message: "Deseja realmente remover este item de garantia?",
      onConfirm: () => {
        const updated = warranties.filter((w) => w.id !== id);
        persistChange(updated);
        setCustomConfirm(null);
      }
    });
  };

  // Filter local warranties list for the active branch and the active branch's selected monthly filter
  const filteredWarranties = warranties.filter((w) => {
    if (w.monthYear && (w.monthYear.startsWith("Fevereiro") || w.monthYear.startsWith("Julho") || w.monthYear.startsWith("Agosto"))) return false;
    if (!activeBranch) return false;
    const isCurrentBranch = w.almoxarifado.toLowerCase() === activeBranch.name.toLowerCase();
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
    <div className="w-full max-w-7xl mx-auto space-y-6" id="almoxarife-garantia-view">
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
            <option value="Junho 2026">Junho 2026</option>
            <option value="Maio 2026">Maio 2026</option>
            <option value="Abril 2026">Abril 2026</option>
            <option value="Março 2026">Março 2026</option>
            <option value="Fevereiro 2026">Fevereiro 2026</option>
            <option value="Janeiro 2026">Janeiro 2026</option>
          </select>
        </div>

      </div>

      {/* TABLE VISUALIZATION CONTAINER (DESKTOP & TABLET) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-fit w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 select-none">
                <th className="p-4 py-3.5 font-black text-left min-w-[220px]">ITEM / DESCRIÇÃO</th>
                {garantiaConfig.fabricante !== false && <th className="p-4 py-3.5 font-black text-left min-w-[130px]">FABRICANTE</th>}
                <th className="p-4 py-3.5 font-black text-left min-w-[120px]">GARANTIA ATÉ</th>
                {garantiaConfig.nfEmissionDate !== false && <th className="p-4 py-3.5 font-black text-left min-w-[110px]">DATA NF</th>}
                {garantiaConfig.reference !== false && <th className="p-4 py-3.5 font-black text-left min-w-[120px]">REFERÊNCIA</th>}
                <th className="p-4 py-3.5 font-black text-left min-w-[200px]">OBSERVAÇÃO</th>
                {(garantiaConfig.customFields || []).map((cf: any) => (
                  <th key={cf.id} className="p-4 py-3.5 font-black text-left text-amber-700 min-w-[130px]">{cf.name.toUpperCase()}</th>
                ))}
                <th className="p-4 py-3.5 font-black text-center min-w-[110px]">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredWarranties.length > 0 ? (
                filteredWarranties.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 py-3.5">
                      <span className="font-bold text-[#1B2A4A] text-xs block">{w.itemCode}</span>
                      <span className="text-slate-500 text-[11px] block mt-0.5 leading-snug">{w.itemDescription || "Sem descrição"}</span>
                    </td>
                    {garantiaConfig.fabricante !== false && (
                      <td className="p-4 py-3.5 text-slate-700 font-bold uppercase">{w.manufacturer || "—"}</td>
                    )}
                    <td className="p-4 py-3.5 text-slate-800 font-mono font-bold whitespace-nowrap">
                      {w.expiryDate ? new Date(w.expiryDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                    </td>
                    {garantiaConfig.nfEmissionDate !== false && (
                      <td className="p-4 py-3.5 text-slate-600 font-mono whitespace-nowrap">
                        {w.nfEmissionDate ? new Date(w.nfEmissionDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                      </td>
                    )}
                    {garantiaConfig.reference !== false && (
                      <td className="p-4 py-3.5 text-slate-600 font-mono whitespace-nowrap">{w.reference || "—"}</td>
                    )}
                    <td className="p-4 py-3.5 text-slate-600 text-xs min-w-[200px]">
                      {w.pieceObservation || w.scrapObservation ? (
                        <div className="space-y-1">
                          {w.pieceObservation && (
                            <p className="text-slate-700 font-normal leading-relaxed">
                              <strong className="font-semibold text-slate-500 text-[10px] uppercase">Peça: </strong>
                              {w.pieceObservation}
                            </p>
                          )}
                          {w.scrapObservation && (
                            <p className="text-slate-500 italic text-[11px] leading-relaxed">
                              <strong className="font-semibold text-slate-400 text-[10px] uppercase">Sucata: </strong>
                              {w.scrapObservation}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    {(garantiaConfig.customFields || []).map((cf: any) => (
                      <td key={cf.id} className="p-4 py-3.5 text-amber-900 text-xs" title={(w as any)[cf.id]}>
                        {(w as any)[cf.id] || "—"}
                      </td>
                    ))}
                    <td className="p-4 py-3.5 text-center whitespace-nowrap">
                      {!isPresencial ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(w)}
                            title="Editar"
                            className="p-1.5 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition flex items-center gap-1 text-xs font-bold active:scale-95 border border-blue-200/60"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(w.id)}
                            title="Excluir"
                            className="p-1.5 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition flex items-center gap-1 text-xs font-bold active:scale-95 border border-red-200/60"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                            <span>Excluir</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Auditoria Local</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10 + (garantiaConfig.customFields?.length || 0)} className="p-12 text-center text-slate-400 font-medium whitespace-normal">
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
          filteredWarranties.map((w) => (
            <div key={w.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-sm font-black text-[#1B2A4A] block">{w.itemCode}</span>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">{w.itemDescription || "Sem descrição"}</p>
                </div>
                {garantiaConfig.fabricante !== false && w.manufacturer && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded uppercase shrink-0">
                    {w.manufacturer}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Garantia Até</span>
                  <span className="font-mono font-bold text-slate-800">
                    {w.expiryDate ? new Date(w.expiryDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                  </span>
                </div>
                {garantiaConfig.nfEmissionDate !== false && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Data NF</span>
                    <span className="font-mono text-slate-700">
                      {w.nfEmissionDate ? new Date(w.nfEmissionDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                    </span>
                  </div>
                )}
                {garantiaConfig.reference !== false && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Referência</span>
                    <span className="font-mono text-slate-700">{w.reference || "—"}</span>
                  </div>
                )}
                {(w.pieceObservation || w.scrapObservation) && (
                  <div className="col-span-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Observação</span>
                    {w.pieceObservation && (
                      <p className="text-xs text-slate-700">
                        <strong className="text-slate-500 font-semibold">Peça: </strong>{w.pieceObservation}
                      </p>
                    )}
                    {w.scrapObservation && (
                      <p className="text-xs text-slate-500 italic">
                        <strong className="text-slate-400 font-semibold">Sucata: </strong>{w.scrapObservation}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {!isPresencial && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEdit(w)}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1 active:scale-95 border border-blue-200/60"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteItem(w.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center gap-1 active:scale-95 border border-red-200/60"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Excluir
                  </button>
                </div>
              )}
            </div>
          ))
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
      <div className="bg-white border border-slate-150 rounded-xl p-6 shadow-sm max-w-2xl font-sans" id="resumo-da-garantia">
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
            <div className="border border-slate-150 rounded-lg overflow-hidden bg-white max-w-xl shadow-3xs">
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
                  {PRESET_ITEMS.map((pi) => (
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
                if (field.id === "fabricante") {
                  if (garantiaConfig.fabricante === false) return null;
                  return (
                    <div key="fabricante" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">Fabricante *</label>
                      <select
                        required
                        value={selectedManufacturer}
                        onChange={(e) => setSelectedManufacturer(e.target.value)}
                        className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                      >
                        <option value="">— Selecione o Fabricante —</option>
                        {MANUFACTURERS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (field.id === "nfEmissionDate") {
                  if (garantiaConfig.nfEmissionDate === false) return null;
                  return (
                    <div key="nfEmissionDate" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">Data de Emissão da NF *</label>
                      <input
                        type="date"
                        required
                        value={nfEmissionDate}
                        onChange={(e) => setNfEmissionDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#1B2A4A]"
                      />
                    </div>
                  );
                }

                if (field.id === "reference") {
                  if (garantiaConfig.reference === false) return null;
                  return (
                    <div key="reference" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">Referência do Item</label>
                      <input
                        type="text"
                        placeholder="—"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                      />
                    </div>
                  );
                }

                if (field.id === "pieceObservation") {
                  if (garantiaConfig.pieceObservation === false) return null;
                  return (
                    <div key="pieceObservation" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">Observação da Peça</label>
                      <textarea
                        rows={2}
                        placeholder="Se vazio, exibirá automaticamente: Nenhuma observação"
                        value={pieceObservation}
                        onChange={(e) => setPieceObservation(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:border-[#1B2A4A] text-slate-700"
                      ></textarea>
                    </div>
                  );
                }

                if (field.id === "scrapObservation") {
                  if (garantiaConfig.scrapObservation === false) return null;
                  return (
                    <div key="scrapObservation" className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">Observação de Sucata</label>
                      <input
                        type="text"
                        placeholder="Introduza o valor aqui"
                        value={scrapObservation}
                        onChange={(e) => setScrapObservation(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                      />
                    </div>
                  );
                }

                // Custom fields
                if (!field.builtIn) {
                  return (
                    <div key={field.id} className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-[#1B2A4A]">
                        {field.name} {field.required && " *"}
                      </label>
                      {field.type === "select" ? (
                        <select
                          required={field.required}
                          value={customFormValues[field.id] || ""}
                          onChange={(e) => setCustomFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                        >
                          <option value="">— Selecione uma opção —</option>
                          {(field.options || []).map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          required={field.required}
                          value={customFormValues[field.id] || ""}
                          onChange={(e) => setCustomFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#1B2A4A]"
                        />
                      ) : field.type === "number" ? (
                        <input
                          type="number"
                          required={field.required}
                          placeholder="Digite valor numérico"
                          value={customFormValues[field.id] || ""}
                          onChange={(e) => setCustomFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                        />
                      ) : (
                        <input
                          type="text"
                          required={field.required}
                          placeholder={`Digite ${field.name.toLowerCase()}`}
                          value={customFormValues[field.id] || ""}
                          onChange={(e) => setCustomFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                        />
                      )}
                    </div>
                  );
                }

                return null;
              })}

              {/* Last update date - auto todays date editable */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#1B2A4A]">Data da Última Atualização *</label>
                <input
                  type="date"
                  required
                  value={lastUpdateDate}
                  onChange={(e) => setLastUpdateDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#1B2A4A]"
                />
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
                  className="px-5 py-2.5 bg-[#1B2A4A] text-white rounded-lg text-xs font-extrabold shadow hover:brightness-110 active:scale-95 transition"
                >
                  {editingItem ? "Salvar Alterações" : "Registrar Garantia"}
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
