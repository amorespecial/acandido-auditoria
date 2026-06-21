import React, { useState } from "react";
import { Branch } from "../types";
import { useRealtimeSync } from "../useRealtimeSync";

interface AdminPanelProps {
  branches: Branch[];
  onSelectBranch: (branchId: string) => void;
  onLogout: () => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  selectedYear: string;
  setSelectedYear: (y: string) => void;
  cycleState: {
    activeMonth: string;
    activeYear: string;
    status: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM" | "ARQUIVADO";
    openedAt?: string;
    openedBy?: string;
  };
  onUpdateCycleState: (newState: any) => void;
  onArchiveCycle: (month: string, year: string, finalScore: number) => void;
  user?: any;
  allCycles: Record<string, any>;
}

export default function AdminPanel({
  branches,
  onSelectBranch,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  cycleState,
  onUpdateCycleState,
  onArchiveCycle,
  user,
  allCycles,
}: AdminPanelProps) {
  useRealtimeSync();
  const [selectedGroup, setSelectedGroup] = useState<"TODOS" | "A" | "B">("TODOS");
  const [filterType, setFilterType] = useState<"TODOS" | "OK" | "PENDENTE" | "NOK">("TODOS");

  // Modals state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openForm, setOpenForm] = useState({ month: "Fevereiro", year: "2026" });

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [challengeNameInput, setChallengeNameInput] = useState("");
  const [closeStage, setCloseStage] = useState<1 | 2>(1);

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = ["2026"];

  const filteredBranches = branches.filter((b) => {
    if (selectedGroup !== "TODOS" && b.group !== selectedGroup) return false;
    if (filterType !== "TODOS" && b.status !== filterType) return false;
    return true;
  });

  // Open cycle handler
  const handleOpenCycle = () => {
    onUpdateCycleState({
      activeMonth: openForm.month,
      activeYear: openForm.year,
      status: "ABERTO",
      openedBy: user?.name || "Fernando Silva",
      openedAt: new Date().toLocaleDateString("pt-BR")
    });
    // Set filters immediately to look at the initialized month
    setSelectedMonth(openForm.month);
    setSelectedYear(openForm.year);
    setShowOpenModal(false);
    alert(`Novo Ciclo de ${openForm.month} ${openForm.year} foi aberto com sucesso para todos os almoxarifes!`);
  };

  // Close cycle handler
  const handleCloseAndArchiveCycle = () => {
    const activeAudName = user?.name || "Fernando Silva";
    if (challengeNameInput.trim().toLowerCase() !== activeAudName.trim().toLowerCase()) {
      alert(`Para prosseguir, por favor digite corretamente o seu nome: ${activeAudName}`);
      return;
    }

    // Average performance calculation
    const avgScore = branches.length > 0
      ? Math.round(branches.reduce((acc, b) => acc + b.currentScore, 0) / branches.length)
      : 0;

    onArchiveCycle(cycleState.activeMonth, cycleState.activeYear, avgScore);
    setShowCloseModal(false);
    setChallengeNameInput("");
    alert(`O ciclo de ${cycleState.activeMonth} ${cycleState.activeYear} foi trancado, arquivado de forma permanente, e agora está em modo somente-leitura!`);
  };

  return (
    <div className="space-y-6" id="painel-principal">
      {/* ================= CONTROLE MANUAL DE CICLO CARD ================= */}
      <section className="bg-[#1C2C4E] text-white p-5 rounded-2xl border border-slate-700/40 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#C8A84B] text-[26px]">lock_clock</span>
              <h3 className="text-base font-black uppercase tracking-wider">Controle Manual do Ciclo de Auditoria</h3>
            </div>
            <p className="text-xs text-indigo-100 max-w-2xl leading-relaxed">
              O sistema funciona em modo 100% manual. Os prazos automáticos de data foram desativados. Os almoxarifes só podem transmitir evidências enquanto o ciclo estiver aberto.
            </p>

            {/* Status tags */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {cycleState.status === "ABERTO" && (
                <>
                  <span className="bg-emerald-600/25 border border-emerald-500/40 text-emerald-400 font-extrabold px-3 py-1 rounded text-xs select-none">
                    ● CICLO ABERTO — {cycleState.activeMonth} {cycleState.activeYear}
                  </span>
                  <span className="text-[10px] text-slate-350">
                    Iniciado em <strong className="text-white">{cycleState.openedAt}</strong> por <strong className="text-white text-bold">{cycleState.openedBy}</strong>. Almoxarifes podem enviar evidências normalmente.
                  </span>
                </>
              )}
              {cycleState.status === "AGUARDANDO_FECHAMENTO" && (
                <>
                  <span className="bg-amber-500/20 border border-amber-500/40 text-amber-500 font-extrabold px-3 py-1 rounded text-xs select-none">
                    ● AGUARDANDO FECHAMENTO — {cycleState.activeMonth} {cycleState.activeYear}
                  </span>
                  <span className="text-[10px] text-slate-350">
                    Modo avaliação. Envios bloqueados para os almoxarifes. Aguardando revisão de notas de {cycleState.openedBy || user?.name || "Fernando Silva"}.
                  </span>
                </>
              )}
              {cycleState.status === "FECHADO" && (
                <>
                  <span className="bg-[#374151]/55 border border-slate-600 text-slate-300 font-extrabold px-3 py-1 rounded text-xs select-none">
                    ● FECHADO — {cycleState.activeMonth} {cycleState.activeYear}
                  </span>
                  <span className="text-[10px] text-slate-350">
                    O mês está FECHADO para envios. Os dados estão disponíveis para consulta e avaliação final pelo Auditor Geral.
                  </span>
                </>
              )}
              {cycleState.status === "NENHUM" && (
                <span className="bg-slate-700/45 border border-slate-600 text-slate-400 font-extrabold px-3 py-1 rounded text-xs select-none">
                  🔘 NENHUM CICLO ATIVO — Aguardando abertura pelo auditor
                </span>
              )}
            </div>
          </div>

          {/* Controls buttons list */}
          <div className="flex flex-wrap gap-2.5 shrink-0 self-start lg:self-center">
            {cycleState.status === "NENHUM" && (
              <button
                onClick={() => {
                  setOpenForm({ month: "Junho", year: "2026" });
                  setShowOpenModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow flex items-center gap-1.5 transition active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px]">power_settings_new</span>
                Abrir Novo Ciclo
              </button>
            )}

            {(cycleState.status === "ABERTO" || cycleState.status === "AGUARDANDO_FECHAMENTO") && (
              <>
                {cycleState.status === "ABERTO" ? (
                  <button
                    onClick={() => {
                      onUpdateCycleState({ ...cycleState, status: "AGUARDANDO_FECHAMENTO" });
                      alert(`O ciclo de ${cycleState.activeMonth} foi alterado para 'Aguardando Fechamento'! Almoxarifes agora estão trancados em modo de avaliação.`);
                    }}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-[#1B2A4A] rounded-xl text-xs font-black uppercase tracking-wider shadow transition"
                  >
                    Bloquear Envios (Avaliar)
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onUpdateCycleState({ ...cycleState, status: "ABERTO" });
                      alert(`O ciclo de ${cycleState.activeMonth} foi reaberto. Almoxarifes já podem reenviar evidências.`);
                    }}
                    className="px-3.5 py-2 bg-[#C8A84B] hover:bg-[#B3931C] text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider shadow transition"
                  >
                    Reabrir para Ajustes
                  </button>
                )}
                <button
                  onClick={() => {
                    onUpdateCycleState({ ...cycleState, status: "FECHADO" });
                    alert(`O ciclo de ${cycleState.activeMonth} foi alterado para FECHADO! Os dados permanecem legíveis para consulta mas novos envios estão encerrados.`);
                  }}
                  className="px-3.5 py-2 bg-[#2D3748] hover:bg-[#1A202C] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow border border-slate-700/40 transition"
                >
                  Fechar Mês
                </button>
              </>
            )}

            {cycleState.status === "FECHADO" && (
              <>
                <button
                  onClick={() => {
                    onUpdateCycleState({ ...cycleState, status: "ABERTO" });
                    alert(`O ciclo de ${cycleState.activeMonth} foi reaberto para ajustes gerais.`);
                  }}
                  className="px-3.5 py-2 bg-[#C8A84B] hover:bg-[#B3931C] text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider shadow transition"
                >
                  Reabrir para Ajustes
                </button>
                <button
                  onClick={() => {
                    setChallengeNameInput("");
                    setCloseStage(1);
                    setShowCloseModal(true);
                  }}
                  className="px-3.5 py-2 bg-red-650 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow flex items-center gap-1.5 transition"
                >
                  <span className="material-symbols-outlined text-[15px]">lock</span>
                  Fechar e Arquivar
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Overview stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total de Unidades</p>
          <p className="text-2xl font-black text-[#1B2A4A] mt-1">{filteredBranches.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Aprovadas (OK)</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {filteredBranches.filter((b) => {
              const hasRegistered = b.criteria.some(c => c.status === "OK" || c.status === "NOK");
              return hasRegistered && b.currentScore >= 100;
            }).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Abaixo da Meta</p>
          <p className="text-2xl font-black text-red-500 mt-1">
            {filteredBranches.filter((b) => {
              const hasRegistered = b.criteria.some(c => c.status === "OK" || c.status === "NOK");
              return hasRegistered && b.currentScore < 100;
            }).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm border-amber-100 bg-amber-50/10">
          <p className="text-[10px] uppercase font-bold tracking-wider text-amber-600">Aguardando Avaliação</p>
          <p className="text-2xl font-black text-slate-650 text-slate-600 mt-1">
            {filteredBranches.filter((b) => {
              const hasRegistered = b.criteria.some(c => c.status === "OK" || c.status === "NOK");
              return !hasRegistered;
            }).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Média de Desempenho</p>
          <p className="text-2xl font-black text-[#C8A84B] mt-1 pr-1 font-mono">
            {(() => {
              const evaluatedBranches = filteredBranches.filter(b => b.criteria.some(c => c.status === "OK" || c.status === "NOK"));
              if (evaluatedBranches.length === 0) return "0 pts";
              const total = evaluatedBranches.reduce((acc, b) => acc + b.currentScore, 0);
              return `${Math.round(total / evaluatedBranches.length)} pts`;
            })()}
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-[#1B2A4A] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C8A84B] text-[20px]">dashboard</span>
            Painel Central de Avaliação — {user?.name || "Fernando Silva"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Filtros de visualização e busca de relatórios por filial.</p>
        </div>

        {/* Filters Group selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mês Filter */}
          <div className="flex flex-col gap-1 text-[10px]">
            <label className="font-bold text-slate-400 uppercase">Mês de Auditoria</label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 px-3 py-1.5 pr-8 rounded-lg text-xs font-bold text-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A] cursor-pointer"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none text-[14px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Ano Filter */}
          <div className="flex flex-col gap-1 text-[10px]">
            <label className="font-bold text-slate-400 uppercase">Ano</label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 px-3 py-1.5 pr-8 rounded-lg text-xs font-bold text-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A] cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none text-[14px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Grupo selector */}
          <div className="flex flex-col gap-1 text-[10px]">
            <label className="font-bold text-slate-400 uppercase">Grupo</label>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 bg-white/20">
              {(["TODOS", "A", "B"] as const).map((groupOp) => (
                <button
                  key={groupOp}
                  type="button"
                  onClick={() => setSelectedGroup(groupOp)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                    selectedGroup === groupOp
                      ? "bg-[#1B2A4A] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {groupOp === "TODOS" ? "Todos" : `Grupo ${groupOp}`}
                </button>
              ))}
            </div>
          </div>

          {/* Status buttons */}
          <div className="flex flex-col gap-1 text-[10px]">
            <label className="font-bold text-slate-400 uppercase">Status do Mês</label>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(["TODOS", "OK", "PENDENTE", "NOK"] as const).map((statusOp) => (
                <button
                  key={statusOp}
                  type="button"
                  onClick={() => setFilterType(statusOp)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                    filterType === statusOp
                      ? "bg-[#1B2A4A] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {statusOp}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bento grid list of Branches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBranches.map((branch) => {
          const monthlyCriteria = branch.criteria.filter((c) => c.id !== "1" && c.id !== "10");
          const allMonthlyEvaluated = monthlyCriteria.every((c) => c.status === "OK" || c.status === "NOK");
          const anyMonthlyEvaluated = monthlyCriteria.some((c) => c.status === "OK" || c.status === "NOK");
          const hasRegisteredEvaluation = branch.criteria.some((c) => c.status === "OK" || c.status === "NOK");
          const pendingCount = branch.criteria.filter((c) => c.status === "ENVIADO").length;

          const selectedCycleKey = `${selectedMonth}_${selectedYear}`;
          const currentFilteredCycle = (allCycles && allCycles[selectedCycleKey]) || cycleState;
          const isNotStarted = currentFilteredCycle.status === "NENHUM";
          const isArchived = currentFilteredCycle.status === "ARQUIVADO";

          let badgeColor = "bg-stone-150 text-stone-700 font-extrabold";
          let badgeText: string = branch.status;
          if (isNotStarted) {
            badgeColor = "bg-slate-100/80 text-slate-400 border border-slate-200/50 font-black tracking-wide";
            badgeText = "Ciclo não iniciado";
          } else if (isArchived) {
            badgeColor = "bg-emerald-600 text-white font-extrabold";
            badgeText = "Arquivado";
          } else {
            if (branch.status === "OK") badgeColor = "bg-emerald-500 text-white font-extrabold";
            if (branch.status === "PENDENTE") badgeColor = "bg-amber-500 text-white font-extrabold";
            if (branch.status === "NOK") badgeColor = "bg-red-500 text-white font-extrabold";
          }

          const scoreToDisplay = isNotStarted ? 0 : (branch.pointsObtainedSum ?? branch.currentScore);
          const maxPoints = 100;
          const progressWidth = Math.min((scoreToDisplay / maxPoints) * 100, 100);

          const categoryToDisplay = isNotStarted ? "Sem avaliação" : branch.scoreCategory;
          let scoreTextClass = "text-slate-400 font-medium";
          let progressBgClass = "bg-slate-200";

          if (categoryToDisplay === "Excelente") {
            scoreTextClass = "text-emerald-600 font-extrabold";
            progressBgClass = "bg-emerald-500";
          } else if (categoryToDisplay === "Bom") {
            scoreTextClass = "text-indigo-600 font-extrabold";
            progressBgClass = "bg-indigo-500";
          } else if (categoryToDisplay === "Regular" || categoryToDisplay === "Médio") {
            scoreTextClass = "text-amber-500 font-extrabold";
            progressBgClass = "bg-amber-500";
          } else if (categoryToDisplay === "Parcial") {
            scoreTextClass = "text-slate-500 font-bold uppercase tracking-wider";
            progressBgClass = "bg-slate-400";
          } else {
            scoreTextClass = "text-red-500 font-extrabold";
            progressBgClass = "bg-red-500";
          }

          return (
            <div
              key={branch.id}
              className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-[#C8A84B]/60 transition-all duration-200 group flex flex-col justify-between shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1B2A4A] leading-tight group-hover:text-blue-900 transition-colors zoom-in-5">
                      {branch.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-[#C8A84B]">location_on</span>
                      {branch.location} • <span className="font-extrabold text-slate-600 font-mono">Grupo {branch.group}</span>
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${badgeColor} shrink-0`}>
                    {badgeText}
                  </span>
                </div>
 
                <div className="flex flex-col items-center justify-center py-4 bg-slate-50/50 rounded-xl mb-4 font-mono">
                  <div className="text-3xl font-black text-[#1B2A4A] mb-0.5">
                    {scoreToDisplay}
                    <span className="text-sm text-slate-400 font-normal">/{maxPoints}</span>
                  </div>
                  <div className="text-[10px] text-slate-450 font-bold uppercase tracking-widest text-slate-400 font-sans">
                    Nota Mensal
                  </div>
                </div>
 
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-[11px] font-medium text-slate-500">
                    <span>{maxPoints} pts auditáveis este mês</span>
                    <span className={scoreTextClass}>{categoryToDisplay}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`${progressBgClass} h-full transition-all duration-550`}
                      style={{ width: `${progressWidth}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 flex justify-between items-center bg-slate-50/10 mt-1">
                <span className="text-[10px] text-slate-400 font-bold tracking-wide">
                  {isNotStarted ? (
                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                      ⏳ Ciclo não iniciado
                    </span>
                  ) : allMonthlyEvaluated ? (
                    <span className="text-[#C8A84B] font-extrabold flex items-center gap-1">
                      ✓ Avaliação Concluída
                    </span>
                  ) : pendingCount > 0 ? (
                    <span className="text-amber-500 font-extrabold">🔔 {pendingCount} envios pendentes</span>
                  ) : anyMonthlyEvaluated ? (
                    <span className="text-slate-500 font-semibold flex items-center gap-1">
                      ⚙️ Avaliação parcial
                    </span>
                  ) : (
                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                      ⏳ Aguardando avaliações
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onSelectBranch(branch.id)}
                  className={`px-3 py-1.5 active:scale-95 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm ${
                    isArchived
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                      : "bg-[#1B2A4A] hover:bg-[#121C34] text-white"
                  }`}
                >
                  {isArchived ? "Ver Detalhes" : "Auditar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= MODAL: ABRIR NOVO CICLO ================= */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-emerald-100">
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-600">power_settings_new</span>
              Parâmetros de Novo Ciclo
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase block">Selecione o Mês</label>
                <select
                  value={openForm.month}
                  onChange={(e) => setOpenForm(prev => ({ ...prev, month: e.target.value }))}
                  className="w-full border border-slate-200 p-2 text-xs font-bold bg-white rounded-lg focus:outline-none"
                >
                  {months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase block">Selecione o Ano</label>
                <select
                  value={openForm.year}
                  onChange={(e) => setOpenForm(prev => ({ ...prev, year: e.target.value }))}
                  className="w-full border border-slate-200 p-2 text-xs font-bold bg-white rounded-lg focus:outline-none"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="bg-emerald-50 text-emerald-900 rounded-xl p-3.5 text-xs inline-block leading-relaxed">
                <strong>Atenção:</strong> Ao abrir este ciclo, as metas dos 14 almoxarifados do grupo serão iniciadas com o status <strong className="font-extrabold uppercase bg-emerald-100 px-1 rounded">PENDENTE</strong> e suas evidências zeradas para recebimento de novos envios técnicos do almoxarife.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 border rounded"
                >
                  Voltar
                </button>
                <button
                  onClick={handleOpenCycle}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded shadow transition"
                >
                  Confirmar Abertura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

       {/* ================= MODAL: FECHAR CICLO E ARQUIVAR ================= */}
      {showCloseModal && (() => {
        const branchesCount = branches.length;
        const completedBranchesCount = branches.filter((b) => {
          const monthlyCriteria = b.criteria.filter((c) => c.id !== "1" && c.id !== "10");
          return monthlyCriteria.every((c) => c.status === "OK" || c.status === "NOK");
        }).length;
        const pendingBranchesCount = branchesCount - completedBranchesCount;

        const pendingBranchesDetailedList = branches.map((b) => {
          const pendingC = b.criteria
            .filter((c) => c.id !== "1" && c.id !== "10" && c.status !== "OK" && c.status !== "NOK")
            .map((c) => c.name);
          return { name: b.name, pending: pendingC };
        }).filter((item) => item.pending.length > 0);

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-150 animate-in fade-in zoom-in duration-150 font-sans">
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#1B2A4A]">lock_person</span>
                Confirmar Fechamento e Arquivamento (Mês: {cycleState?.activeMonth} {cycleState?.activeYear})
              </h3>
              
              {closeStage === 1 ? (
                <div className="space-y-4 text-xs font-sans">
                  <div className="p-3 bg-red-50 border border-red-150 rounded-lg text-red-800 font-extrabold text-xs">
                    Tem certeza? Todos os critérios foram avaliados? Esta ação não pode ser desfeita sem intervenção manual.
                  </div>
                  
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">Status das Avaliações do Ciclo</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Total de Almoxarifados</span>
                        <strong className="text-slate-700 font-black">{branchesCount}</strong>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase font-sans">Avaliações Completas</span>
                        <strong className="text-emerald-600 font-black">{completedBranchesCount} de {branchesCount}</strong>
                      </div>
                    </div>
                  </div>

                  {pendingBranchesCount > 0 ? (
                    <div className="space-y-1.5 font-sans">
                      <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 block">
                        ⚠️ Atenção: {pendingBranchesCount} almoxarifado(s) com critérios pendentes de avaliação!
                      </span>
                      <div className="max-h-36 overflow-y-auto border border-amber-250/50 bg-amber-50/20 p-2.5 rounded-lg space-y-2 text-[11px] font-sans">
                        {pendingBranchesDetailedList.map((pi, idx) => (
                          <div key={idx} className="pb-1 border-b border-amber-100 last:border-b-0">
                            <strong className="text-amber-800 block font-extrabold">{pi.name}</strong>
                            <span className="text-slate-500 font-medium leading-relaxed block mt-0.5">
                              Pendente(s): {pi.pending.join(", ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-lg font-bold text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      Todos os 14 almoxarifados estão 100% avaliados! Pronto para fechamento seguro.
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 font-semibold leading-relaxed space-y-1">
                    <p>• O fechamento mudará o status do ciclo ativo para <strong className="text-[#1B2A4A] font-black">{cycleState?.activeMonth} {cycleState?.activeYear} (ARQUIVADO)</strong>.</p>
                    <p>• Novas avaliações e envios de fotos serão impedidos de forma permanente.</p>
                  </div>

                  <div className="flex gap-2 justify-end mt-6 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowCloseModal(false)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-all font-sans"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCloseStage(2)}
                      className="px-4 py-2 bg-[#1B2A4A] hover:bg-[#121C34] active:scale-95 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm font-sans"
                    >
                      Continuar para etapa final
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-900 font-semibold leading-relaxed text-[11px] space-y-1.5">
                    <p className="font-extrabold text-red-800 uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">lock</span>
                      CHAVE DE SEGURANÇA OBRIGATÓRIA
                    </p>
                    <p>Para concluir temporariamente o período e salvar todas as pontuações do mês atual, confirme digitando a chave de segurança abaixo:</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase block font-sans">
                      Digite exatamente a chave <strong className="text-red-700 font-extrabold font-mono text-center block text-sm bg-stone-100 py-1 border rounded my-1.5 font-sans">FECHAR {cycleState?.activeMonth?.toUpperCase()}</strong> para confirmar:
                    </label>
                    <input
                      type="text"
                      value={challengeNameInput}
                      onChange={(e) => setChallengeNameInput(e.target.value)}
                      placeholder={`FECHAR ${cycleState?.activeMonth?.toUpperCase()}`}
                      className="w-full border border-slate-300 p-2.5 text-xs font-black uppercase rounded-lg focus:border-red-500 focus:ring-1 focus:ring-red-500 text-center font-mono placeholder:text-slate-350"
                    />
                  </div>

                  <div className="flex gap-2 justify-end mt-6 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setCloseStage(1)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-all font-sans"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={challengeNameInput.trim().toUpperCase() !== `FECHAR ${cycleState?.activeMonth?.toUpperCase()}`}
                      onClick={() => {
                        setShowCloseModal(false);
                        handleCloseAndArchiveCycle();
                      }}
                      className={`px-4 py-2 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm font-sans ${
                        challengeNameInput.trim().toUpperCase() === `FECHAR ${cycleState?.activeMonth?.toUpperCase()}`
                          ? "bg-red-650 bg-red-650 hover:bg-red-700 cursor-pointer active:scale-95"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed border"
                      }`}
                    >
                      Confirmar e Fechar Período
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
