import React, { useState, useEffect } from "react";
import { Branch, MaterialOccurrence, AppUser } from "../types";
import { initialOccurrences } from "../mockData";
import { dbFetchOccurrences, dbSaveOccurrences, dbFetchSupervisorFieldConfig, isSupabaseReady } from "../supabaseService";

interface SupervisorPanelProps {
  user: AppUser;
  branches: Branch[];
  onLogout: () => void;
}

export default function SupervisorPanel({ user, branches, onLogout }: SupervisorPanelProps) {
  // Load occurrences from localStorage to enable real-time coordination
  const [occurrences, setOccurrences] = useState<MaterialOccurrence[]>(() => {
    const saved = localStorage.getItem("acandido_occurrences");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return initialOccurrences;
      }
    }
    return initialOccurrences;
  });

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
      const saved = localStorage.getItem("acandido_occurrences");
      if (saved) {
        try {
          setOccurrences(JSON.parse(saved));
        } catch (e) {
          // ignore
        }
      }

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
            localStorage.setItem("acandido_occurrences", JSON.stringify(dbOccs));
            window.dispatchEvent(new Event("storage"));
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
    localStorage.setItem("acandido_occurrences", JSON.stringify(updated));
    if (isSupabaseReady()) {
      try {
        await dbSaveOccurrences(updated);
      } catch (err) {
        console.error("Failed to save occurrences in Supabase:", err);
      }
    }
    window.dispatchEvent(new Event("storage"));
  };

  const handleSendForm = (e: React.FormEvent) => {
    e.preventDefault();

    // Verify all active required fields
    const missing = fields.filter(f => f.required && f.id !== "solicitante" && !formValues[f.id]?.trim());
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
      if (f.id !== "solicitante") {
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
      filial: "JABOATÃO", // Automatic Jaboatão unit injection
      branchId: targetBranch.id, // Target physical garage selected
      branchName: targetBranch.name,
      obs: undefined, // waiting for almoxarifado resolution
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
    // Only show records originating from Fretamento Jaboatão or submitted by the user
    const isFretamentoJaboatao = occ.branchId === "fretamento-jaboatao";
    const isOwner = occ.solicitante === user.name;
    return isFretamentoJaboatao || isOwner;
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
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "MATERIAL NO ALMOXARIFADO":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "Sem Estoque Mín/Máx":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" id="supervisor-panel-root">
      
      {/* HEADER SECTION */}
      <header className="bg-[#1B2A4A] text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        {/* Background ambient detail */}
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-[#C8A84B] opacity-10 skew-x-12 pointer-events-none"></div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-[#C8A84B] text-slate-950 font-black px-2.5 py-1 rounded uppercase tracking-wider">
              Painel do Supervisor
            </span>
            <span className="text-[9px] bg-[#C8A84B]/20 text-indigo-200 font-extrabold px-2.5 py-1 rounded uppercase tracking-wider">
              Filial: JABOATÃO
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1 select-none">
            Supervisor {user.name}
          </h2>
          <p className="text-xs text-indigo-200 font-medium opacity-80 mt-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">mail</span>
            {user.email} • Cadastro Integrado de Desabastecimento
          </p>
        </div>

        <button
          onClick={onLogout}
          type="button"
          className="px-4 py-2 bg-[#C8A84B] hover:bg-[#B7973B] active:scale-95 text-[#1B2A4A] text-xs font-black rounded-lg transition-all shadow flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[15px]">logout</span>
          Sair do Portal
        </button>
      </header>

      {/* TWO COLUMN GRID WORKFLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* VIEW A: TELA DE PREENCHIMENTO (GOOGLE FORMS WEB STYLE) */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-150 p-6 audit-card-shadow space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-[#1B2A4A] flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-indigo-600">assignment</span>
                Falta de Material
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Formulário de preenchimento obrigatório para tratamento de frota</p>
            </div>

            {/* Simulated google forms purple header design accent */}
            <div className="h-2 bg-indigo-700 rounded-lg -mt-3"></div>

            <form onSubmit={handleSendForm} className="space-y-4">
              {/* GOOGLE FORMS DESIGNS: FIELD - ALMOXARIFADO */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-2">
                <label className="text-xs font-black text-slate-700 tracking-wide uppercase flex items-center gap-1.5 font-sans">
                  Almoxarifado de Destino *
                  <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded font-black font-sans">Estoque</span>
                </label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full bg-white border border-slate-350 rounded-lg px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#1B2A4A] focus:ring-1 focus:ring-[#1B2A4A]"
                >
                  <option value="fretamento-jaboatao">FRETAMENTO JABOATÃO</option>
                  <option value="rodoviario-jaboatao">RODOVIÁRIO JABOATÃO</option>
                </select>
                <p className="text-[10px] text-slate-400 italic">Selecione para qual almoxarifado sob sua gestão este chamado será enviado.</p>
              </div>

              {/* DYNAMIC FIELDS GENERATION */}
              {fields.map((f: any) => {
                if (f.id === "solicitante") return null;
                if (f.enabled === false || f.visible === false) return null;

                return (
                  <div key={f.id} className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-2">
                    <label className="text-xs font-black text-slate-700 tracking-wide uppercase flex items-center gap-1.5 font-sans">
                      {f.name} {f.required && " *"}
                      {f.builtIn && <span className="text-[8px] bg-indigo-50 text-indigo-800 px-1 rounded font-black font-sans">Obrigatório</span>}
                    </label>

                    {f.type === "select" ? (
                      <select
                        required={f.required}
                        value={formValues[f.id] || ""}
                        onChange={(e) => setFormValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-full bg-white border border-slate-350 rounded-lg px-3 py-2.5 text-xs text-slate-800 font-bold focus:border-[#1B2A4A] focus:outline-none"
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
                        className="w-full bg-white border border-slate-350 rounded-lg px-3 py-2.5 text-xs text-slate-800 font-bold focus:border-[#1B2A4A] focus:outline-none"
                      />
                    ) : f.type === "number" ? (
                      <input
                        type="number"
                        required={f.required}
                        placeholder="Digite um valor numérico"
                        value={formValues[f.id] || ""}
                        onChange={(e) => setFormValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-full bg-white border border-slate-350 rounded-lg px-3 py-2.5 text-xs text-slate-800 font-bold focus:border-[#1B2A4A] focus:outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        required={f.required}
                        placeholder={`Digite ${f.name.toLowerCase()}`}
                        value={formValues[f.id] || ""}
                        onChange={(e) => setFormValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-full bg-white border border-slate-350 rounded-lg px-3 py-2.5 text-xs text-slate-800 font-bold focus:border-[#1B2A4A] focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}

              {/* AUTOMATIC INVIOLABLE BACKGROUND DATA (INFORMATIONAL FOR REASSURANCE) */}
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 text-[11px] space-y-2 text-slate-500 font-medium">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-450 block font-sans">Propriedades Salvas Automaticamente:</span>
                
                <div className="flex justify-between border-b border-slate-200/50 pb-1">
                  <span>Solicitante Responsável:</span>
                  <strong className="text-slate-800 font-sans">{user.name}</strong>
                </div>

                <div className="flex justify-between border-b border-slate-200/50 pb-1">
                  <span>Unidade Vinculada:</span>
                  <strong className="text-indigo-700 font-sans">JABOATÃO</strong>
                </div>

                <div className="flex justify-between">
                  <span>Data / Hora Cadastro:</span>
                  <strong className="text-slate-800 font-sans">Assinatura de Servidor (Ao Enviar)</strong>
                </div>
              </div>

              {/* SUBMIT FORM ACTION BUTTON */}
              <button
                type="submit"
                className="w-full bg-[#1B2A4A] hover:bg-[#0C1527] active:scale-[0.98] text-white font-black py-3 rounded-xl tracking-wide text-xs shadow-lg transition-all uppercase flex items-center justify-center gap-2 font-sans"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Enviar Registro ao Estoque
              </button>

            </form>
          </div>
        </section>

        {/* VIEW B: TELA DE VISUALIZAÇÃO HISTÓRICA (TEMPORAL FILTERS, NO FIELDS CAN BE EDITED!) */}
        <section className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-150 p-6 audit-card-shadow flex flex-col space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-[#1B2A4A] flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="material-symbols-outlined text-indigo-600">wysiwyg</span>
                  Histórico e Acompanhamento
                </h3>
                <p className="text-[11px] text-slate-400">Total de {personalRecords.length} lançamentos efetuados</p>
              </div>

              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded border border-slate-200">
                Apenas Leitura Sincronizado
              </span>
            </div>

            {/* TEMPORAL SEARCH FILTERS */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase text-slate-400">Filtrar por Mês</span>
                <select
                  value={temporalMonth}
                  onChange={(e) => setTemporalMonth(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 font-bold"
                >
                  <option value="TODOS">Todos os Meses</option>
                  {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase text-slate-400">Filtrar por Data Específica</span>
                <input
                  type="date"
                  value={temporalSearchDate}
                  onChange={(e) => setTemporalSearchDate(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 font-bold"
                />
              </div>
            </div>

            {/* HISTORY GRID LIST (NO FORM ELEMENTS ARE EDITABLE) */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredPersonalRecords.length > 0 ? (
                filteredPersonalRecords.map((occ) => (
                  <div
                    key={occ.id}
                    className="bg-white border border-slate-150 rounded-xl p-4 hover:border-slate-300 transition-all space-y-3 relative"
                  >
                    {/* Header line */}
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">
                          {occ.filial || "JABOATÃO"}
                        </span>
                        <h4 className="text-xs font-black text-[#1B2A4A] mt-1.5 leading-tight">
                          Veículo: <span className="font-mono text-indigo-600 font-black">{occ.veiculo || "—"}</span> • {occ.material}
                        </h4>
                      </div>

                      {occ.status !== "Sem Estoque Mín/Máx" && (
                        <span
                          className={`px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider border rounded-full ${getStatusColor(
                            occ.status
                          )}`}
                        >
                          {occ.status}
                        </span>
                      )}
                    </div>

                    {/* Operational Details updated by Almoxarife */}
                    {(occ.codigoMaterial || occ.obs) ? (
                      <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 text-xs space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-none">
                          Retorno do Almoxarifado Jaboatão
                        </span>
                        
                        {occ.codigoMaterial && (
                          <p className="text-slate-700 font-medium font-sans">
                            Código Cadastrado: <strong className="font-mono text-[#1B2A4A] font-black">{occ.codigoMaterial}</strong>
                          </p>
                        )}
                        {occ.obs && (
                          <p className="text-slate-600 font-medium italic">
                            Observação técnica: "{occ.obs}"
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-500 text-sm">schedule</span>
                        <span>Aguardando tratamento pela Central de Almoxarifado Jaboatão.</span>
                      </div>
                    )}

                    {/* Timestamp & metadata info */}
                    <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-2.5">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">person</span>
                        Solicitado por: <strong className="text-slate-600">{occ.solicitante || "Manutenção"}</strong>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-xs">event</span>
                        {occ.date}
                      </span>
                    </div>

                  </div>
                ))
              ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 select-none">
                  <span className="material-symbols-outlined text-[32px] text-slate-350">receipt_long</span>
                  <p className="text-xs font-black mt-1">Nenhum registro encontrado para este filtro temporal.</p>
                  <p className="text-[10px]">As ocorrências técnicas enviadas aparecerão listadas de forma inviolável aqui.</p>
                </div>
              )}
            </div>

          </div>
        </section>

      </div>

    </div>
  );
}
