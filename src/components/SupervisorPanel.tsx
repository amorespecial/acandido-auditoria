import React, { useState, useEffect } from "react";
import { Branch, MaterialOccurrence, AppUser } from "../types";
import { initialOccurrences } from "../mockData";
import { dbFetchOccurrences, dbSaveOccurrences, dbFetchSupervisorFieldConfig, isSupabaseReady, getBranchIdByName } from "../supabaseService";

interface SupervisorPanelProps {
  user: AppUser;
  branches: Branch[];
  onLogout: () => void;
}

export default function SupervisorPanel({ user, branches, onLogout }: SupervisorPanelProps) {
  // Load occurrences from localStorage to enable real-time coordination
  const [occurrences, setOccurrences] = useState<MaterialOccurrence[]>(initialOccurrences);

  // Dynamic fields configured by Auditor
  const [fields, setFields] = useState<any[]>(() => {
    const saved = localStorage.getItem("acandido_supervisor_form_fields") || localStorage.getItem("acandido_supervisor_fields");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use default below
      }
    }
    return [
      { id: "solicitante", name: "Solicitante Responsável", type: "text", required: true, builtIn: true },
      { id: "veiculo", name: "Prefixo do Veículo", type: "text", required: true, builtIn: true },
      { id: "material", name: "Material em Falta", type: "text", required: true, builtIn: true }
    ];
  });

  // Helper to obtain current month name in Portuguese
  const getCurrentMonthName = () => {
    const monthsList = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return monthsList[new Date().getMonth()];
  };

  // Helper to get today's date in YYYY-MM-DD
  const getTodayISO = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Watch for changes across tabs or screens
  useEffect(() => {
    let active = true;
    const loadRemoteFields = async () => {
      try {
        const remoteFields = await dbFetchSupervisorFieldConfig();
        if (remoteFields && Array.isArray(remoteFields) && remoteFields.length > 0 && active) {
          setFields(remoteFields);
        }
      } catch (e) {
        console.warn("Error fetching remote supervisor fields config:", e);
      }
    };

    loadRemoteFields();

    const handleStorageChange = () => {
      loadRemoteFields();

      const savedFields = localStorage.getItem("acandido_supervisor_form_fields") || localStorage.getItem("acandido_supervisor_fields");
      if (savedFields) {
        try {
          setFields(JSON.parse(savedFields));
        } catch (e) {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("field-configs-updated", handleStorageChange);
    // Periodically poll local storage in case multiple tabs/components are working together
    const interval = setInterval(handleStorageChange, 2000);

    return () => {
      active = false;
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("field-configs-updated", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Handle Supabase Realtime and Initial Load for Supervisor
  useEffect(() => {
    const loadFromDb = async () => {
      if (isSupabaseReady()) {
        try {
          const dbOccs = await dbFetchOccurrences();
          if (dbOccs && dbOccs.length > 0) {
            setOccurrences(dbOccs);
          }
        } catch (e) {
          console.error("Failed to fetch occurrences from Supabase in SupervisorPanel:", e);
        }
      }
    };
    loadFromDb();

    window.addEventListener("realtime-nivel-servico-update", loadFromDb);
    return () => {
      window.removeEventListener("realtime-nivel-servico-update", loadFromDb);
    };
  }, []);

  // Form states
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [targetBranchId, setTargetBranchId] = useState("fretamento-jaboatao");

  // Temporal search state (B - Visual list search filter)
  const [temporalSearchDate, setTemporalSearchDate] = useState(""); // empty means no filter
  const [temporalMonth, setTemporalMonth] = useState<string>(getCurrentMonthName());

  const saveOccurrences = async (updated: MaterialOccurrence[]) => {
    setOccurrences(updated);
    if (isSupabaseReady()) {
      try {
        await dbSaveOccurrences(updated);
      } catch (err) {
        console.error("Failed to save occurrences in Supabase:", err);
      }
    }
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("realtime-nivel-servico-update"));
  };

  const handleSendForm = (e: React.FormEvent) => {
    e.preventDefault();

    // Verify all active required fields (excluding solicitante and codigoMaterial which is filled later by Almoxarife)
    const missing = fields.filter(f => 
      f.required && 
      f.id !== "solicitante" && 
      f.id !== "codigoMaterial" && 
      f.id !== "codigo" && 
      f.id !== "codigo_material" && 
      !formValues[f.id]?.trim()
    );
    if (missing.length > 0) {
      alert(`Por favor, preencha o campo obrigatório: ${missing[0].name}`);
      return;
    }

    const simulatedDateStr = getTodayISO(); // System dynamic operational date

    const targetBranch = targetBranchId === "fretamento-jaboatao"
      ? { id: "fretamento-jaboatao", name: "FRETAMENTO JABOATÃO" }
      : { id: "rodoviario-jaboatao", name: "RODOVIÁRIO JABOATÃO" };

    const dynamicData: Record<string, string> = {};
    fields.forEach(f => {
      if (f.id !== "solicitante" && f.id !== "codigoMaterial" && f.id !== "codigo" && f.id !== "codigo_material") {
        dynamicData[f.id] = formValues[f.id] || "";
      }
    });

    const newOcc: MaterialOccurrence = {
      id: "occ-" + Date.now(),
      material: String(dynamicData["material"] || "").trim(),
      veiculo: String(dynamicData["veiculo"] || "").trim().toUpperCase(),
      solicitante: user.name, // Automatic logged in user
      date: simulatedDateStr, // Operational system date
      timestamp: Date.now(),
      status: "Sem Estoque Mín/Máx", // Starting status
      filial: targetBranch.name,
      branchId: targetBranch.id, // Target physical garage selected
      branchName: targetBranch.name,
      obs: undefined, // waiting for almoxarifado resolution
      registrado_por: user.name || "Supervisor",
      ...dynamicData
    };

    const updated = [newOcc, ...occurrences];
    saveOccurrences(updated);

    // Reset form values
    setFormValues({});
    alert(`Sucesso! Ocorrência registrada para o veículo ${newOcc.veiculo} e enviada com sucesso para o Almoxarifado: ${targetBranch.name}.`);
  };

  // Filter historic records belonging to Jaboatão or logged user
  const personalRecords = occurrences.filter((occ) => {
    // Only show records originating from Jaboatão garages or submitted by the user
    const bId = getBranchIdByName(occ.branchId || occ.branchName || occ.filial || "");
    const isJaboataoBranch = bId === "fretamento-jaboatao" || bId === "rodoviario-jaboatao";
    const isOwner = occ.solicitante === user.name;
    return isJaboataoBranch || isOwner;
  });

  // Apply temporal filters
  const filteredPersonalRecords = personalRecords.filter((occ) => {
    // Date search filter
    if (temporalSearchDate && occ.date !== temporalSearchDate) {
      return false;
    }

    // Month search filter
    if (temporalMonth !== "TODOS" && occ.date) {
      const parts = occ.date.split("-");
      if (parts.length === 3) {
        const monthNum = parseInt(parts[1], 10);
        const monthsList = [
          "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        const occMonthName = monthsList[monthNum - 1];
        if (occMonthName !== temporalMonth) return false;
      }
    }

    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RESOLVIDO":
        return "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]";
      case "MATERIAL NO ALMOXARIFADO":
        return "bg-[#E8EDF5] text-[#00194C] border-[#CBD5E1]";
      case "Sem Estoque Mín/Máx":
        return "bg-[#FEE8E8] text-[#F11E26] border-[#FECDD3]";
      default:
        return "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]";
    }
  };

  const resolvedCount = personalRecords.filter(r => r.status === "RESOLVIDO" || r.status === "MATERIAL NO ALMOXARIFADO").length;
  const totalRecordsCount = personalRecords.length;
  const progressPercent = totalRecordsCount > 0 ? Math.round((resolvedCount / totalRecordsCount) * 100) : 100;

  let progressBarColor = "bg-[#16A34A]";
  if (progressPercent < 60) {
    progressBarColor = "bg-[#F11E26]";
  } else if (progressPercent < 80) {
    progressBarColor = "bg-[#D97706]";
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6 text-[#334155]" id="supervisor-panel-root">
      <div className="max-w-6xl mx-auto space-y-6">
      
      {/* 1. HEADER DO SUPERVISOR & BANNER */}
      <header className="bg-[#00194C] text-white px-[28px] py-[24px] rounded-[12px] border-b-[3px] border-[#F11E26] shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        {/* Background ambient detail */}
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/5 skew-x-12 pointer-events-none"></div>

        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#F11E26] text-white rounded-[6px] text-[11px] font-semibold px-[10px] py-[3px] uppercase tracking-wider">
              Painel do Supervisor
            </span>
            <span className="bg-[#E8EDF5] text-[#00194C] rounded-[6px] text-[11px] font-semibold px-[10px] py-[3px] uppercase tracking-wider">
              Filial: JABOATÃO
            </span>
          </div>
          <h2 className="text-[22px] font-bold text-white mt-1 select-none">
            Supervisor {user.name}
          </h2>
          <p className="text-[#94A3B8] text-[13px] font-medium mt-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px]">mail</span>
            {user.email} • Cadastro Integrado de Desabastecimento
          </p>
        </div>

        <button
          onClick={onLogout}
          type="button"
          className="border border-white text-white hover:bg-white hover:text-[#00194C] transition-all px-4 py-2 rounded-[8px] text-[13px] font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          Sair do Portal
        </button>
      </header>

      {/* TWO COLUMN GRID WORKFLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* VIEW A: TELA DE PREENCHIMENTO */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[12px] border border-[#E2E8F0] px-[24px] py-[20px] shadow-[0_2px_8px_rgba(0,25,76,0.06)] space-y-5">
            <div className="border-b border-[#E2E8F0] pb-3">
              <h3 className="text-[14px] font-semibold text-[#00194C] flex items-center gap-2 uppercase tracking-wide">
                <span className="material-symbols-outlined text-[#00194C] text-[18px]">assignment</span>
                Falta de Material
              </h3>
              <p className="text-[12px] text-[#64748B] mt-0.5">Formulário de preenchimento obrigatório para tratamento de frota</p>
            </div>

            {/* 3. BARRA DE PROGRESSO DO PAINEL */}
            <div className="space-y-1.5 bg-[#F8FAFC] p-3 rounded-[8px] border border-[#E2E8F0]">
              <div className="flex justify-between items-center text-[12px] font-semibold text-[#475569]">
                <span className="uppercase tracking-[0.05em] text-[11px]">Tratamento do Estoque</span>
                <span className="font-bold text-[#00194C]">{progressPercent}% ({resolvedCount}/{totalRecordsCount})</span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-[8px] rounded-[4px] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-[4px] ${progressBarColor}`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            <form onSubmit={handleSendForm} className="space-y-4">
              {/* 7. DROPDOWN ALMOXARIFADO DE DESTINO */}
              <div className="bg-white p-4 rounded-[12px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,25,76,0.06)] space-y-2">
                <label className="text-[12px] font-semibold text-[#475569] tracking-[0.05em] uppercase flex items-center gap-1.5 font-sans">
                  Almoxarifado de Destino *
                  <span className="bg-[#E8EDF5] text-[#00194C] text-[10px] font-semibold rounded-[4px] px-[6px] py-[2px]">ESTOQUE</span>
                </label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full h-[40px] bg-white border-[1.5px] border-[#CBD5E1] rounded-[8px] px-3 text-[14px] text-[#00194C] font-medium focus:outline-none focus:border-[#00194C] focus:ring-2 focus:ring-[#00194C]/15 transition-all"
                >
                  <option value="fretamento-jaboatao">FRETAMENTO JABOATÃO</option>
                  <option value="rodoviario-jaboatao">RODOVIÁRIO JABOATÃO</option>
                </select>
                <p className="text-[12px] text-[#64748B] italic">Selecione para qual almoxarifado sob sua gestão este chamado será enviado.</p>
              </div>

              {/* DYNAMIC FIELDS GENERATION */}
              {fields.map((f: any) => {
                if (f.id === "solicitante" || f.id === "codigoMaterial" || f.id === "codigo" || f.id === "codigo_material" || f.name?.toLowerCase().includes("código do material")) return null;
                if (f.enabled === false || f.visible === false) return null;

                return (
                  <div key={f.id} className="bg-white p-4 rounded-[12px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,25,76,0.06)] space-y-2">
                    <label className="text-[12px] font-semibold text-[#475569] tracking-[0.05em] uppercase flex items-center gap-1.5 font-sans">
                      {f.name} {f.required && " *"}
                      {f.required && <span className="bg-[#FEE8E8] text-[#F11E26] text-[10px] font-semibold rounded-[4px] px-[6px] py-[2px]">OBRIGATÓRIO</span>}
                    </label>

                    {f.type === "select" ? (
                      <select
                        required={f.required}
                        value={formValues[f.id] || ""}
                        onChange={(e) => setFormValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-full h-[40px] bg-white border-[1.5px] border-[#CBD5E1] rounded-[8px] px-3 text-[14px] text-[#334155] focus:outline-none focus:border-[#00194C] focus:ring-2 focus:ring-[#00194C]/15 transition-all"
                      >
                        <option value="">-- Selecione uma opção --</option>
                        {(f.options || []).map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : f.type === "date" ? (
                      <input
                        type="date"
                        required={f.required}
                        value={formValues[f.id] || ""}
                        onChange={(e) => setFormValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-full h-[40px] bg-white border-[1.5px] border-[#CBD5E1] rounded-[8px] px-3 text-[14px] text-[#334155] focus:outline-none focus:border-[#00194C] focus:ring-2 focus:ring-[#00194C]/15 transition-all"
                      />
                    ) : f.type === "number" ? (
                      <input
                        type="number"
                        required={f.required}
                        placeholder="Digite um valor numérico"
                        value={formValues[f.id] || ""}
                        onChange={(e) => setFormValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-full h-[40px] bg-white border-[1.5px] border-[#CBD5E1] rounded-[8px] px-3 text-[14px] text-[#334155] placeholder-[#94A3B8] focus:outline-none focus:border-[#00194C] focus:ring-2 focus:ring-[#00194C]/15 transition-all"
                      />
                    ) : (
                      <input
                        type="text"
                        required={f.required}
                        placeholder={`Digite ${f.name.toLowerCase()}`}
                        value={formValues[f.id] || ""}
                        onChange={(e) => setFormValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-full h-[40px] bg-white border-[1.5px] border-[#CBD5E1] rounded-[8px] px-3 text-[14px] text-[#334155] placeholder-[#94A3B8] focus:outline-none focus:border-[#00194C] focus:ring-2 focus:ring-[#00194C]/15 transition-all"
                      />
                    )}
                  </div>
                );
              })}

              {/* AUTOMATIC INVIOLABLE BACKGROUND DATA */}
              <div className="bg-[#F8FAFC] p-4 rounded-[12px] border border-[#E2E8F0] text-[13px] space-y-2 text-[#475569] font-medium">
                <span className="text-[11px] uppercase font-semibold tracking-[0.05em] text-[#64748B] block font-sans">Propriedades Salvas Automaticamente:</span>
                
                <div className="flex justify-between border-b border-[#E2E8F0] pb-1">
                  <span>Solicitante Responsável:</span>
                  <strong className="text-[#00194C] font-semibold font-sans">{user.name}</strong>
                </div>

                <div className="flex justify-between border-b border-[#E2E8F0] pb-1">
                  <span>Unidade Vinculada:</span>
                  <strong className="text-[#00194C] font-semibold font-sans">JABOATÃO</strong>
                </div>

                <div className="flex justify-between">
                  <span>Data / Hora Cadastro:</span>
                  <strong className="text-[#00194C] font-semibold font-sans">Assinatura de Servidor (Ao Enviar)</strong>
                </div>
              </div>

              {/* SUBMIT FORM ACTION BUTTON */}
              <button
                type="submit"
                className="w-full h-[44px] bg-[#00194C] hover:bg-[#001238] active:scale-[0.98] text-white font-semibold rounded-[8px] text-[13px] shadow-md transition-all uppercase flex items-center justify-center gap-2 font-sans cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Enviar Registro ao Estoque
              </button>

            </form>
          </div>
        </section>

        {/* 8. CARD HISTÓRICO E ACOMPANHAMENTO */}
        <section className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-[12px] border border-[#E2E8F0] px-[24px] py-[20px] shadow-[0_2px_8px_rgba(0,25,76,0.06)] flex flex-col space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#00194C] flex items-center gap-2 uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[#00194C] text-[18px]">wysiwyg</span>
                  Histórico e Acompanhamento
                </h3>
                <p className="text-[12px] text-[#64748B] mt-0.5">Total de {personalRecords.length} lançamentos efetuados</p>
              </div>

              <span className="bg-[#E8EDF5] text-[#00194C] text-[11px] font-semibold rounded-[6px] px-[10px] py-[4px]">
                Apenas Leitura Sincronizado
              </span>
            </div>

            {/* TEMPORAL SEARCH FILTERS */}
            <div className="bg-[#F8FAFC] p-3 rounded-[12px] border border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#475569]">Filtrar por Mês</span>
                <select
                  value={temporalMonth}
                  onChange={(e) => setTemporalMonth(e.target.value)}
                  className="h-[40px] text-[14px] bg-white border-[1.5px] border-[#CBD5E1] rounded-[8px] px-3 text-[#334155] font-medium focus:outline-none focus:border-[#00194C] focus:ring-2 focus:ring-[#00194C]/15"
                >
                  <option value="TODOS">Todos os Meses</option>
                  {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#475569]">Filtrar por Data Específica</span>
                <input
                  type="date"
                  value={temporalSearchDate}
                  onChange={(e) => setTemporalSearchDate(e.target.value)}
                  className="h-[40px] text-[14px] bg-white border-[1.5px] border-[#CBD5E1] rounded-[8px] px-3 text-[#334155] font-medium focus:outline-none focus:border-[#00194C] focus:ring-2 focus:ring-[#00194C]/15"
                />
              </div>
            </div>

            {/* HISTORY GRID LIST */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredPersonalRecords.length > 0 ? (
                filteredPersonalRecords.map((occ) => (
                  <div
                    key={occ.id}
                    className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 hover:border-[#CBD5E1] transition-all space-y-3 relative shadow-xs"
                  >
                    {/* Header line */}
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-[#00194C] bg-[#E8EDF5] px-2.5 py-0.5 rounded-[6px]">
                          {occ.filial || "JABOATÃO"}
                        </span>
                        <h4 className="text-[13px] font-bold text-[#00194C] mt-1.5 leading-tight">
                          Veículo: <span className="font-mono text-[#00194C] font-bold">{occ.veiculo || "—"}</span> • {occ.material}
                        </h4>
                      </div>

                      {occ.status !== "Sem Estoque Mín/Máx" && (
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider border rounded-full ${getStatusColor(
                            occ.status
                          )}`}
                        >
                          {occ.status}
                        </span>
                      )}
                    </div>

                    {/* Operational Details updated by Almoxarife */}
                    {(occ.codigoMaterial || occ.obs) ? (
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-3 text-[13px] space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] block leading-none">
                          Retorno do Almoxarifado Jaboatão
                        </span>
                        
                        {occ.codigoMaterial && (
                          <p className="text-[#334155] font-medium font-sans">
                            Código Cadastrado: <strong className="font-mono text-[#00194C] font-bold">{occ.codigoMaterial}</strong>
                          </p>
                        )}
                        {occ.obs && (
                          <p className="text-[#475569] font-medium italic">
                            Observação técnica: "{occ.obs}"
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-[12px] text-[#64748B] bg-[#FEF3C7]/40 border border-[#FDE68A] rounded-[8px] p-2.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#D97706] text-[16px]">schedule</span>
                        <span>Aguardando tratamento pela Central de Almoxarifado Jaboatão.</span>
                      </div>
                    )}

                    {/* Timestamp & metadata info */}
                    <div className="flex justify-between items-center text-[12px] text-[#64748B] border-t border-[#E2E8F0] pt-2.5">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        Solicitado por: <strong className="text-[#334155]">{occ.solicitante || "Manutenção"}</strong>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {occ.date}
                      </span>
                    </div>

                  </div>
                ))
              ) : (
                <div className="bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F0] rounded-[12px] p-8 text-center text-[#94A3B8] select-none">
                  <span className="material-symbols-outlined text-[36px] text-[#CBD5E1]">receipt_long</span>
                  <p className="text-[13px] font-semibold text-[#94A3B8] mt-1">Nenhum registro encontrado para este filtro temporal.</p>
                  <p className="text-[12px] text-[#94A3B8]">As ocorrências técnicas enviadas aparecerão listadas de forma inviolável aqui.</p>
                </div>
              )}
            </div>

          </div>
        </section>

      </div>
    </div>
    </div>
  );
}
