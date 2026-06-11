import React, { useState, useEffect } from "react";
import { MaterialOccurrence, AppUser } from "../types";
import { initialOccurrences } from "../mockData";

interface AlmoxarifeNivelServicoProps {
  onBack: () => void;
  branchId: string;
  branchName: string;
  user: AppUser;
}

export default function AlmoxarifeNivelServico({ onBack, branchId, branchName, user }: AlmoxarifeNivelServicoProps) {
  const isCriterionPresencial = () => {
    try {
      const saved = localStorage.getItem("acandido_branches");
      if (saved) {
        const parsed = JSON.parse(saved);
        const branch = parsed.find((b: any) => b.id === branchId);
        const criterion = branch?.criteria?.find((c: any) => c.id === "7");
        return criterion?.auditMode === "Presencial";
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const isPresencial = isCriterionPresencial();

  // Load occurrences from localStorage of the shared state
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

  const [fields, setFields] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("acandido_supervisor_fields");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "solicitante", name: "Solicitante Responsável", type: "text", required: true, builtIn: true },
      { id: "veiculo", name: "Prefixo do Veículo", type: "text", required: true, builtIn: true },
      { id: "material", name: "Material em Falta", type: "text", required: true, builtIn: true }
    ];
  });

  // Helper function to get current real month name in Portuguese
  const getCurrentMonthName = () => {
    const monthsList = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return monthsList[new Date().getMonth()];
  };

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayISO = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Top Filters: active month and specific day of operation
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthName());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO());

  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Listen to other tab changes, branch switching, or supervisor panel updates
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("acandido_occurrences");
      if (saved) {
        try {
          setOccurrences(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse occurrences:", e);
        }
      }

      const savedFields = localStorage.getItem("acandido_supervisor_fields");
      if (savedFields) {
        try {
          setFields(JSON.parse(savedFields));
        } catch (e) {
          // ignore
        }
      }
    };
    
    // Also load initially when branchId changes
    handleStorageChange();

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [branchId]);

  // Tab state: "ATIVOS" or "RESOLVIDOS"
  const [activeTab, setActiveTab] = useState<"ATIVOS" | "RESOLVIDOS">("ATIVOS");

  // Editing state for Almoxarife treatment
  const [treatmentOcc, setTreatmentOcc] = useState<MaterialOccurrence | null>(null);
  
  // Highlighted Treatment Form fields (the only 3 they can modify)
  const [treatmentCodigoMaterial, setTreatmentCodigoMaterial] = useState("");
  const [treatmentStatus, setTreatmentStatus] = useState<"RESOLVIDO" | "MATERIAL NO ALMOXARIFADO">("RESOLVIDO");
  const [treatmentObs, setTreatmentObs] = useState("");

  const persistChange = (updated: MaterialOccurrence[]) => {
    setOccurrences(updated);
    localStorage.setItem("acandido_occurrences", JSON.stringify(updated));
    // Trigger storage event for other components listening (like Supervisor panel)
    window.dispatchEvent(new Event("storage"));
  };

  // Dynamic filter logic
  const filteredOccurrences = occurrences.filter((occ) => {
    // Filter specifically by active branchId
    if (occ.branchId && occ.branchId !== branchId) return false;

    // 2. Month-specific filtration
    // If occurrence has a date, verify it matches selected month (e.g. "Junho" corresponds to month 06)
    if (occ.date) {
      const parts = occ.date.split("-");
      if (parts.length === 3) {
        const monthNum = parseInt(parts[1], 10);
        const monthsList = [
          "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        const occMonthName = monthsList[monthNum - 1];
        if (occMonthName !== selectedMonth) return false;
      }
    }

    // 3. Tab filter: Ativos vs Resolvidos
    const isResolved = occ.status === "RESOLVIDO" || occ.status === "Chegou"; 
    // Wait, the prompt says "parando de contar apenas quando o status mudar para RESOLVIDO".
    // We treat RESOLVIDO and CHEGOU as resolved/closed. Let's make ATIVOS show pending ones.
    if (activeTab === "ATIVOS") {
      return !isResolved;
    } else {
      return isResolved;
    }
  });

  // Calculate dynamic days elapsed between regDate and current simulated operation date
  const computeDaysElapsed = (occ: MaterialOccurrence) => {
    if (occ.status === "RESOLVIDO") {
      // If frozen resolvedAt date exists, compute up to that date, otherwise return a fixed pre-calculated value
      if (occ.resolvedAt) {
        try {
          const d1 = new Date(occ.date + "T00:00:00");
          const d2 = new Date(occ.resolvedAt + "T00:00:00");
          const diff = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
          return diff > 0 ? diff : 0;
        } catch {
          return 3;
        }
      }
      return 0; // Frozen
    }

    // Calculate days from registration up to the selected date of operation
    try {
      const dReg = new Date(occ.date + "T00:00:00");
      const dOp = new Date(selectedDate + "T00:00:00");
      const diffTime = dOp.getTime() - dReg.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch {
      return 0;
    }
  };

  const handleSaveTreatment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatmentOcc) return;

    const updated = occurrences.map((occ) => {
      if (occ.id === treatmentOcc.id) {
        return {
          ...occ,
          status: treatmentStatus,
          codigoMaterial: treatmentCodigoMaterial.trim(),
          obs: treatmentObs.trim() ? treatmentObs.trim() : occ.obs,
          resolvedAt: treatmentStatus === "RESOLVIDO" ? selectedDate : undefined,
        };
      }
      return occ;
    });

    persistChange(updated);
    setTreatmentOcc(null);
    setTreatmentCodigoMaterial("");
    setTreatmentObs("");
    alert(`Ocorrência atualizada com sucesso para: ${treatmentStatus}`);
  };

  const handleDeleteOccurrence = (id: string) => {
    setCustomConfirm({
      isOpen: true,
      title: "Remover Ocorrência",
      message: "Deseja realmente remover esta ocorrência?",
      onConfirm: () => {
        const updated = occurrences.filter((o) => o.id !== id);
        persistChange(updated);
        setCustomConfirm(null);
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6" id="almoxarife-nivel-servico-unificado">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100 audit-card-shadow">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition-all select-none"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl font-black text-[#1B2A4A] leading-tight flex items-center gap-1.5">
              Nível de Serviço
              <span className="text-[10px] bg-[#C8A84B]/20 text-[#9C7F32] px-2 py-0.5 rounded font-black uppercase">
                Tela 3
              </span>
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">
                {branchName.replace("ALMOXARIFADO ", "")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isPresencial && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 animate-fade-in shadow-sm">
          <span className="material-symbols-outlined text-blue-650 text-[24px] shrink-0 mt-0.5">info</span>
          <div className="text-xs">
            <p className="font-bold text-blue-900 text-sm">📋 Auditoria Presencial Ativa</p>
            <p className="text-slate-655 mt-1 leading-relaxed text-slate-600 font-medium">
              O critério <strong>07 - Nível de Serviço</strong> para esta unidade foi configurado como <strong>Presencial</strong> pelo auditor Fernando Silva. Os lançamentos, tratativas e status serão verificados pessoalmente no local. Os botões de cadastro ou edição foram desativados.
            </p>
          </div>
        </div>
      )}

      {/* MANDATORY TOP FILTERS IN REAL-TIME */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 audit-card-shadow space-y-3">
        <h3 className="text-xs font-bold text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-xs text-indigo-600">calendar_month</span>
          Mês de Referência da Operação
        </h3>
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full text-sm font-black border border-slate-200 pl-3 pr-10 py-2.5 bg-slate-50 rounded-xl text-[#1B2A4A] appearance-none focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          >
            {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
            <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
          </div>
        </div>
      </div>

      {/* FILTER TABS (ATIVOS VS HISTORICO) */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
        <button
          onClick={() => setActiveTab("ATIVOS")}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wide rounded-lg transition-all ${
            activeTab === "ATIVOS"
              ? "bg-[#1B2A4A] text-white shadow-md"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          SERVIÇOS
        </button>
        <button
          onClick={() => setActiveTab("RESOLVIDOS")}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wide rounded-lg transition-all ${
            activeTab === "RESOLVIDOS"
              ? "bg-[#1B2A4A] text-white shadow-md"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          TRATATIVAS CONCLUÍDAS / HISTÓRICO
        </button>
      </div>

      {/* OCCURRENCES LISTINGS */}
      <div className="space-y-3">
        {filteredOccurrences.length > 0 ? (
          filteredOccurrences.map((occ) => {
            const daysWithoutPiece = computeDaysElapsed(occ);
            return (
              <div
                key={occ.id}
                className={`bg-white border text-left p-5 rounded-xl audit-card-shadow relative overflow-hidden transition-all ${
                  occ.status === "Sem Estoque Mín/Máx" 
                    ? "border-l-4 border-l-red-500 border-slate-100" 
                    : "border-slate-100"
                }`}
              >
                {/* Upper Badge and Branch Flag */}
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full border border-red-200">
                      {occ.status}
                    </span>
                    <h4 className="text-sm font-black text-[#1B2A4A] mt-2 leading-tight">
                      {occ.material}
                    </h4>
                  </div>
                  
                  {/* Dynamic counting timer badge */}
                  {occ.status !== "RESOLVIDO" ? (
                    <div className="bg-red-50 border border-red-200/50 px-2.5 py-1 rounded-lg text-right">
                      <span className="text-[10px] font-black text-red-600 block leading-none">
                        Duração
                      </span>
                      <strong className="text-base font-black text-red-700 font-mono">
                        {daysWithoutPiece} {daysWithoutPiece === 1 ? "Dia" : "Dias"}
                      </strong>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200/50 px-2.5 py-1 rounded-lg text-right">
                      <span className="text-[10px] font-black text-emerald-600 block leading-none">
                        Parado em
                      </span>
                      <strong className="text-sm font-black text-emerald-700">
                        {daysWithoutPiece} dias
                      </strong>
                    </div>
                  )}
                </div>

                {/* Sub-details (Locked info section) */}
                <div className="grid grid-cols-2 gap-2 mt-4 bg-slate-50 border border-slate-100 p-3 rounded-lg text-[11px] font-medium text-slate-500 leading-tight">
                  <div>
                    <span className="text-[9px] uppercase tracking-wide font-black text-slate-400 block">Veículo</span>
                    <strong className="text-slate-700">{occ.veiculo || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wide font-black text-slate-400 block">Solicitante</span>
                    <strong className="text-slate-700">{occ.solicitante || "Manutenção"}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wide font-black text-slate-400 block">Filial Org.</span>
                    <strong className="text-indigo-600">{occ.filial || occ.branchName?.replace("ALMOXARIFADO ", "") || "Estoque"}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wide font-black text-slate-400 block">Falta desde</span>
                    <strong className="text-slate-700">{occ.date}</strong>
                  </div>
                </div>

                {/* Visual rendering of custom dynamic field traits sent by supervisor */}
                {fields.filter(f => !f.builtIn && occ[f.id] !== undefined && occ[f.id] !== null && occ[f.id] !== "").length > 0 && (
                  <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200/60 rounded-lg text-[11px] grid grid-cols-2 gap-2 text-slate-500 font-medium font-sans">
                    {fields.filter(f => !f.builtIn && occ[f.id] !== undefined && occ[f.id] !== null && occ[f.id] !== "").map(f => (
                      <div key={f.id}>
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-600 block">{f.name}</span>
                        <strong className="text-slate-800">{occ[f.id]}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {/* Almoxarife code / results if resolved */}
                {(occ.codigoMaterial || occ.obs) && (
                  <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs space-y-1">
                    {occ.codigoMaterial && (
                      <p className="text-[#1B2A4A] font-extrabold flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">qr_code</span>
                        Código Cadastrado: <span className="font-mono text-indigo-700">{occ.codigoMaterial}</span>
                      </p>
                    )}
                    {occ.obs && (
                      <p className="text-slate-600 font-medium italic">
                        <strong className="text-slate-700 not-italic block text-[9px] uppercase tracking-wider font-black">Justificativa / Observação Técnica:</strong>
                        "{occ.obs}"
                      </p>
                    )}
                  </div>
                )}

                {/* Actions bottom strip */}
                {!isPresencial && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                    <button
                      onClick={() => handleDeleteOccurrence(occ.id)}
                      type="button"
                      className="text-[10px] text-slate-400 hover:text-red-600 font-bold flex items-center gap-0.5 px-2 py-1 rounded transition-colors"
                    >
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                      Remover
                    </button>

                    {occ.status !== "RESOLVIDO" && (
                      <button
                        type="button"
                        onClick={() => {
                          setTreatmentOcc(occ);
                          setTreatmentCodigoMaterial(occ.codigoMaterial || "");
                          setTreatmentStatus("RESOLVIDO");
                          setTreatmentObs(occ.obs || "");
                        }}
                        className="bg-red-600 hover:bg-red-700 font-black text-white text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit_document</span>
                        Chegou / Dar Tratativa
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-10 text-center text-slate-400 select-none">
            <span className="material-symbols-outlined text-[36px] text-slate-350">check_circle</span>
            <p className="text-xs font-black mt-2 text-slate-600">Nenhum evento neste filtro.</p>
            <p className="text-[10px] px-4 mt-1 leading-normal">
              Utilize os filtros acima ou crie novas solicitações de estoque para as garagens.
            </p>
          </div>
        )}
      </div>

      {/* TREAT OCCURRENCE DRAWER / GAVETA DE TRATAMENTO */}
      {treatmentOcc && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 animate-fade-in outline-none">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden transform scale-100 transition-all flex flex-col md:flex-row">
            
            {/* LEFT HALF / TOP HALF: LOCKED SUPERVISOR DATA */}
            <div className="bg-slate-900 text-slate-100 p-6 md:w-1/2 flex flex-col justify-between space-y-6">
              <div>
                <span className="bg-[#C8A84B] text-slate-900 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest leading-none">
                  Dados Originais do Chamado
                </span>
                <h3 className="text-lg font-black text-white mt-3 leading-snug">
                  {treatmentOcc.material}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Registrado por supervisor no estoque</p>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">directions_bus</span>
                  <div className="text-xs">
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wide">Veículo</span>
                    <strong className="text-slate-200">{treatmentOcc.veiculo || "Não informado"}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">person</span>
                  <div className="text-xs">
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wide">Solicitante</span>
                    <strong className="text-slate-200">{treatmentOcc.solicitante || "Manutenção"}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#C8A84B] text-[18px]">calendar_today</span>
                  <div className="text-xs">
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wide">Data de Entrada</span>
                    <strong className="text-slate-200">{treatmentOcc.date}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">apartment</span>
                  <div className="text-xs">
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wide">Filial Destinada</span>
                    <strong className="text-slate-200">{treatmentOcc.filial || treatmentOcc.branchName?.replace("ALMOXARIFADO ", "") || "JABOATÃO"}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800 text-[10px] text-slate-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">lock</span>
                Estes dados acima foram gravados inviolavelmente e não podem ser alterados pelo Almoxarife.
              </div>
            </div>

            {/* RIGHT HALF / BOTTOM HALF: FILL TO RESOLVE (HIGHLIGHTED IN RED!) */}
            <form onSubmit={handleSaveTreatment} className="p-6 md:w-1/2 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">verified_user</span>
                  CAMPOS DE TRATATIVA (PREENCHA)
                </h3>
                <p className="text-[10px] text-slate-400">Preencha obrigatoriamente para desativar a fila</p>
              </div>

              <div className="space-y-3">
                {/* FIELD 1: CODIGO MATERIAL (RED HIGHLIGHTED!) */}
                <div className="bg-red-50/50 p-3 rounded-xl border-2 border-red-500 flex flex-col gap-1">
                  <label className="text-[10px] font-black text-red-700 uppercase tracking-wide flex items-center gap-1">
                    CÓDIGO MATERIAL *
                    <span className="text-[8px] bg-red-600 text-white font-black px-1 rounded">MANDATÓRIO</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Digite o código numérico interno da peça"
                    value={treatmentCodigoMaterial}
                    onChange={(e) => setTreatmentCodigoMaterial(e.target.value)}
                    className="w-full bg-white border border-red-300 rounded-lg px-2.5 py-1.5 text-xs text-red-950 font-mono font-bold focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                  />
                </div>

                {/* FIELD 2: STATUS DROPDOWN (RED HIGHLIGHTED!) */}
                <div className="bg-red-50/50 p-3 rounded-xl border-2 border-red-500 flex flex-col gap-1">
                  <label className="text-[10px] font-black text-red-700 uppercase tracking-wide flex items-center gap-1">
                    STATUS DA FILA *
                    <span className="text-[8px] bg-red-600 text-white font-black px-1 rounded">EXECUÇÃO</span>
                  </label>
                  <select
                    value={treatmentStatus}
                    onChange={(e) => setTreatmentStatus(e.target.value as any)}
                    className="w-full bg-white border border-red-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-red-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                  >
                    <option value="RESOLVIDO">RESOLVIDO</option>
                    <option value="MATERIAL NO ALMOXARIFADO">MATERIAL NO ALMOXARIFADO</option>
                  </select>
                </div>

                {/* FIELD 3: OBSERVACAO (RED HIGHLIGHTED!) */}
                <div className="bg-red-50/50 p-3 rounded-xl border-2 border-red-500 flex flex-col gap-1">
                  <label className="text-[10px] font-black text-red-700 uppercase tracking-wide">
                    OBSERVAÇÃO (JUSTIFICATIVA) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Justificativa técnica. Ex: CONFECCIONAMOS..."
                    value={treatmentObs}
                    onChange={(e) => setTreatmentObs(e.target.value)}
                    className="w-full bg-white border border-red-300 rounded-lg p-2.5 text-xs text-red-950 font-bold focus:outline-none "
                  />
                </div>
              </div>

              {/* ACTION TOGGLES */}
              <div className="pt-4 flex border-t border-slate-100 gap-2">
                <button
                  type="button"
                  onClick={() => setTreatmentOcc(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-xs font-black text-slate-500 hover:bg-slate-50"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black shadow-md shadow-red-200 active:scale-95 transition-all text-center"
                >
                  Salvar e Concluir
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
              <p className="leading-relaxed font-semibold text-slate-805 text-slate-700">
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
