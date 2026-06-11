import React, { useState } from "react";
import { Branch } from "../types";

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
    status: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "NENHUM";
    openedAt?: string;
    openedBy?: string;
  };
  onUpdateCycleState: (newState: any) => void;
  onArchiveCycle: (month: string, year: string, finalScore: number) => void;
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
}: AdminPanelProps) {
  const [selectedGroup, setSelectedGroup] = useState<"TODOS" | "A" | "B">("TODOS");
  const [filterType, setFilterType] = useState<"TODOS" | "OK" | "PENDENTE" | "NOK">("TODOS");

  // Modals state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openForm, setOpenForm] = useState({ month: "Junho", year: "2026" });

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [challengeNameInput, setChallengeNameInput] = useState("");

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = ["2026", "2025", "2024"];

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
      openedBy: "Fernando Silva",
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
    if (challengeNameInput.trim() !== "Fernando Silva") {
      alert("Para prosseguir, por favor digite corretamente o seu nome: Fernando Silva");
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
                  <span className="text-[10px] text-slate-300">
                    Iniciado em <strong className="text-white">{cycleState.openedAt}</strong> por <strong className="text-white text-bold">{cycleState.openedBy}</strong>.
                  </span>
                </>
              )}
              {cycleState.status === "AGUARDANDO_FECHAMENTO" && (
                <>
                  <span className="bg-amber-500/20 border border-amber-500/40 text-amber-500 font-extrabold px-3 py-1 rounded text-xs select-none">
                    ● AGUARDANDO FECHAMENTO — {cycleState.activeMonth} {cycleState.activeYear}
                  </span>
                  <span className="text-[10px] text-slate-350">
                    Modo avaliação. Envios bloqueados para os almoxarifes. Aguardando revisão de notas de Fernando Silva.
                  </span>
                </>
              )}
              {cycleState.status === "NENHUM" && (
                <span className="bg-slate-700/45 border border-slate-600 text-slate-400 font-extrabold px-3 py-1 rounded text-xs select-none">
                  ● NENHUM CICLO ATIVO NO MOMENTO
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

            {cycleState.status === "ABERTO" && (
              <>
                <button
                  onClick={() => {
                    onUpdateCycleState({ ...cycleState, status: "AGUARDANDO_FECHAMENTO" });
                    alert(`O ciclo de ${cycleState.activeMonth} foi alterado para 'Aguardando Fechamento'! Almoxarifes agora estão trancados.`);
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-[#1B2A4A] rounded-xl text-xs font-black uppercase tracking-wider shadow transition"
                >
                  Bloquear Envios (Avaliar)
                </button>
                <button
                  onClick={() => {
                    setChallengeNameInput("");
                    setShowCloseModal(true);
                  }}
                  className="px-3.5 py-2 bg-red-650 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow flex items-center gap-1.5 transition"
                >
                  <span className="material-symbols-outlined text-[15px]">lock</span>
                  Fechar e Arquivar
                </button>
              </>
            )}

            {cycleState.status === "AGUARDANDO_FECHAMENTO" && (
              <>
                <button
                  onClick={() => {
                    onUpdateCycleState({ ...cycleState, status: "ABERTO" });
                    alert(`O ciclo de ${cycleState.activeMonth} foi reaberto. Almoxarifes já podem reenviar evidências.`);
                  }}
                  className="px-3.5 py-2 bg-[#C8A84B] hover:bg-[#B3931C] text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider shadow transition"
                >
                  Reabrir para Ajustes
                </button>
                <button
                  onClick={() => {
                    setChallengeNameInput("");
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total de Unidades</p>
          <p className="text-2xl font-black text-[#1B2A4A] mt-1">{filteredBranches.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Aprovadas (OK)</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {filteredBranches.filter((b) => b.currentScore >= b.meta).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Abaixo da Meta</p>
          <p className="text-2xl font-black text-red-500 mt-1">
            {filteredBranches.filter((b) => b.currentScore < b.meta).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Média de Desempenho</p>
          <p className="text-2xl font-black text-[#C8A84B] mt-1 pr-1 font-mono">
            {filteredBranches.length > 0
              ? Math.round((filteredBranches.reduce((acc, b) => acc + b.currentScore, 0) / filteredBranches.length))
              : 0} pts
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-[#1B2A4A] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C8A84B] text-[20px]">dashboard</span>
            Painel Central de Avaliação — Fernando Silva
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
          let badgeColor = "bg-stone-100 text-stone-700";
          if (branch.status === "OK") badgeColor = "bg-emerald-500 text-white";
          if (branch.status === "PENDENTE") badgeColor = "bg-amber-500 text-white";
          if (branch.status === "NOK") badgeColor = "bg-red-500 text-white";

          let scoreTextClass = "text-[#1B2A4A]";
          let progressBgClass = "bg-[#1B2A4A]";

          if (branch.currentScore >= 85) {
            scoreTextClass = "text-emerald-600 font-extrabold";
            progressBgClass = "bg-emerald-500";
          } else if (branch.currentScore >= 70) {
            scoreTextClass = "text-amber-500 font-extrabold";
            progressBgClass = "bg-amber-500";
          } else {
            scoreTextClass = "text-red-500 font-extrabold";
            progressBgClass = "bg-red-500";
          }

          const pendingCount = branch.criteria.filter((c) => c.status === "ENVIADO" || c.status === "PENDENTE").length;

          return (
            <div
              key={branch.id}
              className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-[#C8A84B]/60 transition-all duration-200 group flex flex-col justify-between shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1B2A4A] leading-tight group-hover:text-blue-900 transition-colors">
                      {branch.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-[#C8A84B]">location_on</span>
                      {branch.location} • <span className="font-extrabold text-slate-600">Grupo {branch.group}</span>
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeColor} shrink-0`}>
                    {branch.status}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-4 bg-slate-50/50 rounded-xl mb-4">
                  <div className="text-3xl font-black text-[#1B2A4A] mb-0.5">
                    {branch.pointsObtainedSum ?? branch.currentScore}
                    <span className="text-sm text-slate-400 font-medium">/{branch.maxAuditablePoints ?? 100}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Nota Mensal
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-[11px] font-medium text-slate-500">
                    <span>{(branch.maxAuditablePoints ?? 100)} pts auditáveis este mês</span>
                    <span className={scoreTextClass}>{branch.scoreCategory}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`${progressBgClass} h-full transition-all duration-550`}
                      style={{ width: `${Math.min(((branch.pointsObtainedSum ?? branch.currentScore) / (branch.maxAuditablePoints ?? 100)) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 flex justify-between items-center bg-slate-50/10 mt-1">
                <span className="text-[10px] text-slate-400 font-bold tracking-wide">
                  {pendingCount > 0 ? (
                    <span className="text-amber-500 font-extrabold">🔔 {pendingCount} envios pendentes</span>
                  ) : (
                    <span className="text-emerald-600">✓ Tudo avaliado</span>
                  )}
                </span>
                <button
                  onClick={() => onSelectBranch(branch.id)}
                  className="px-3 py-1.5 bg-[#1B2A4A] hover:bg-[#121C34] active:scale-95 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm"
                >
                  Auditar
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
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200">
            <header className="border-b border-red-100 pb-3 mb-4 flex items-center gap-2 text-red-600">
              <span className="material-symbols-outlined text-[24px]">lock_person</span>
              <h3 className="text-sm font-black uppercase tracking-wider">🔒 Fechar e Arquivar Ciclo Corporativo</h3>
            </header>

            <div className="space-y-4 text-xs">
              <p className="leading-relaxed font-semibold text-slate-800">
                Você trancará de forma irrecuperável o ciclo de <span className="font-black text-bold underline">{cycleState.activeMonth} {cycleState.activeYear}</span>.
              </p>

              {/* Pending checks */}
              <div className="bg-slate-50 p-3 rounded-lg border text-slate-600 space-y-1.5">
                <span className="font-bold block text-slate-700 uppercase text-[10px]">Resumo de Lançamentos Pendentes:</span>
                <p>• {branches.filter(b => b.status !== "OK").length} de 14 filiais estão abaixo da nota de meta mínima recomendada.</p>
                <p>• Os scores finais das filiais e as vistorias submetidas serão consolidados e travados como somente-leitura permanentemente.</p>
              </div>

              <div className="bg-red-50 text-red-900 rounded-xl p-3 px-3.5 space-y-1.5 leading-normal">
                <strong className="font-bold">Aviso Crítico:</strong> Esta operação arquiva definitivamente as avaliações no Histórico Consolidado. Nenhuma alteração retroativa poderá ser inserida por qualquer usuário a partir de agora!
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase block">Digite o seu nome para confirmar o lacre: Fernando Silva</label>
                <input
                  type="text"
                  value={challengeNameInput}
                  onChange={(e) => setChallengeNameInput(e.target.value)}
                  placeholder="Fernando Silva"
                  className="w-full border border-slate-300 p-2.5 text-xs font-bold rounded-lg focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleCloseAndArchiveCycle}
                  disabled={challengeNameInput.trim() !== "Fernando Silva"}
                  className={`px-4 py-2 text-white text-xs font-black uppercase rounded-lg shadow ${
                    challengeNameInput.trim() === "Fernando Silva"
                      ? "bg-red-650 bg-red-600 hover:bg-red-700 cursor-pointer active:scale-95"
                      : "bg-slate-150 text-slate-400 cursor-not-allowed border"
                  }`}
                >
                  Confirmar e Arquivar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
