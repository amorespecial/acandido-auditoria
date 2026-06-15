import React from "react";
import { Branch, AppUser } from "../types";

interface AlmoxarifeHomeProps {
  branch: Branch;
  allBranches?: Branch[];
  user: AppUser;
  onNavigateToScreen: (screenId: string) => void;
  activeMonth: string;
  activeYear: string;
}

export default function AlmoxarifeHome({
  branch,
  allBranches,
  user,
  onNavigateToScreen,
  activeMonth,
  activeYear,
}: AlmoxarifeHomeProps) {
  // Score parameters
  const score = branch.currentScore;
  const isApproved = score >= branch.meta;

  const getSubscreenRoute = (id: string): string | null => {
    switch (id) {
      case "2":
        return "CONTAGEM_TOP10";
      case "4":
        return "LAYOUT_ARRANJO";
      case "6":
        return "UNIMOBIN_CERTIFICADOS";
      case "7":
        return "NIVEL_SERVICO";
      case "9":
        return "CONTROLE_GARANTIA";
      default:
        return null;
    }
  };

  const getCriterionActionLabel = (id: string): string | null => {
    switch (id) {
      case "2":
        return "Contar Peças";
      case "4":
        return "Enviar Fotos";
      case "6":
        return "Anexar Certificados";
      case "7":
        return "Ver Deficiências";
      case "9":
        return "Registrar Peça";
      default:
        return null;
    }
  };

  const isClosedForAlmoxarife = (() => {
    try {
      const saved = localStorage.getItem("acandido_cycle_state_manual");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.status !== "ABERTO";
      }
    } catch (e) {}
    return false;
  })();

  const isSemestralMonth = activeMonth.toLowerCase() === "janeiro" || activeMonth.toLowerCase() === "julho";
  const activeCriteria = branch.criteria;

  // Twin branches logic to show joint/cooperative rules
  const twinPairs = [
    ["unitrans-jp", "santa-maria-jp"],
    ["expresso-nacional", "acandido-cg"],
    ["fretamento-jaboatao", "rodoviario-jaboatao"],
    ["trans-cg-bayeux", "rodoviario-cabedelo"],
    ["fretamento-maracanau", "rodoviario-fortaleza"]
  ];
  const pair = twinPairs.find((p) => p.includes(branch.id));
  const twinId = pair ? (pair[0] === branch.id ? pair[1] : pair[0]) : null;
  const twinBranch = twinId ? allBranches?.find((b) => b.id === twinId) : null;

  const getBranchCalendar = () => {
    let localCalendar: any[] = [];
    try {
      const saved = localStorage.getItem("acandido_calendario_inventarios");
      localCalendar = saved ? JSON.parse(saved) : [];
    } catch (e) {}

    const MONTH_MAP: Record<string, number> = {
      "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6,
      "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
    };
    const activeMonthNum = MONTH_MAP[activeMonth.toLowerCase()] || 6;
    const activeSemestre = activeMonthNum <= 6 ? 1 : 2;
    const activeYearNum = parseInt(activeYear) || 2026;

    const matchBranch = (almoxName: string, bId: string) => {
      const name = almoxName.toLowerCase().trim();
      const branchId = bId.toLowerCase().trim();
      if (name.includes("santa maria")) return branchId === "santa-maria-jp";
      if (name.includes("a.candido") || name.includes("a.cândido")) return branchId === "acandido-cg";
      if (name === "trans cg" || name === "expresso nacional") return branchId === "expresso-nacional";
      if (name.includes("bayeux")) return branchId === "trans-cg-bayeux";
      if (name.includes("cabedelo")) return branchId === "rodoviario-cabedelo";
      if (name.includes("goiana")) return branchId === "fretamento-goiana";
      if (name.includes("fret pb") || name.includes("fretamento pb")) return branchId === "fretamento-pb";
      if (name.includes("fret pe") || name.includes("jaboatao") || name === "trans fret pe") return branchId === "fretamento-jaboatao";
      if (name.includes("rod ce") || name.includes("fortaleza")) return branchId === "rodoviario-fortaleza";
      if (name.includes("rod pe") || name.includes("jaboatão pb") || name === "trans rod pe") return branchId === "rodoviario-jaboatao";
      if (name.includes("transnacional rn") || name.includes("reunidas")) return branchId === "reunidas-nat";
      if (name.includes("unissanta") || name.includes("unissana")) return branchId === "unissana-rn";
      if (name.includes("unitrans")) return branchId === "unitrans-jp";
      return false;
    };

    return localCalendar.filter(item =>
      matchBranch(item.almoxarifado, branch.id) &&
      item.ano === activeYearNum &&
      item.semestre === activeSemestre
    );
  };

  const calItems = getBranchCalendar();

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* USER PROFILE WELCOME BANNER */}
      <section className="bg-gradient-to-r from-[#1B2A4A] to-[#253D6D] rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
        {/* Background glow overlay */}
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-15 pointer-events-none">
          <span className="material-symbols-outlined text-[130px] font-thin text-[#C8A84B]">
            warehouse
          </span>
        </div>

        <p className="text-[10px] font-bold text-[#C8A84B] uppercase tracking-widest font-mono">
          Painel do Almoxarife • Grupo {branch.group}
        </p>
        <h2 className="text-2xl font-black mt-1">Olá, {user.name}!</h2>
        <p className="text-xs text-white/75 mt-0.5 leading-tight">Unidade: {branch.name}</p>

        {/* Dashboard scoring meter */}
        <div className="mt-6 flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-xl">
          <div>
            <p className="text-[10px] font-bold text-slate-300 uppercase">Pontuação do Mês</p>
            <p className="text-3xl font-black text-[#C8A84B] mt-1 font-mono">
              {score}
              <span className="text-sm text-white/60 font-medium">/100 pts</span>
            </p>
          </div>
          <div className="text-right">
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                isApproved ? "bg-emerald-500 text-white" : "bg-amber-500 text-[#1B2A4A]"
              }`}
            >
              {isApproved ? "OK (Meta Atingida)" : "Em Alerta"}
            </span>
            <p className="text-[9px] text-slate-300 font-bold uppercase mt-2">Sua meta é 80 pts</p>
          </div>
        </div>
      </section>

      {/* QUICK INSTRUCTION ACTIONS CARD */}
      {isClosedForAlmoxarife ? (
        <section className="bg-rose-50 border border-slate-200 rounded-xl p-4 flex gap-3">
          <span className="material-symbols-outlined text-rose-600 text-[24px] shrink-0">
            lock
          </span>
          <div>
            <p className="text-xs font-black text-rose-900">Ciclo Trancado ou em Avaliação!</p>
            <p className="text-[11px] text-rose-800 leading-normal mt-0.5 font-medium">
              O ciclo de <strong className="font-bold">{activeMonth} {activeYear}</strong> está fechado ou trancado para auditoria. Novos lançamentos de fotos e evidências técnicas estão temporariamente interrompidos.
            </p>
          </div>
        </section>
      ) : (
        <section className="bg-emerald-50 border border-emerald-250 rounded-xl p-4 flex gap-3">
          <span className="material-symbols-outlined text-emerald-600 text-[24px] shrink-0">
            verified_user
          </span>
          <div>
            <p className="text-xs font-black text-emerald-950">Ciclo Aberto — Transmitir Evidências</p>
            <p className="text-[11px] text-emerald-850 leading-normal mt-0.5">
              O ciclo de <strong className="font-bold">{activeMonth} {activeYear}</strong> está ativo. Por favor, envie suas fotos e contagens físicas completas. O Auditor Geral Fernando Silva revisará suas submissões para atribuir a pontuação final.
            </p>
          </div>
        </section>
      )}

      {/* MOBILE LIST CHECKLISTS CRITERIAS */}
      <section className="space-y-4">
        <h3 className="text-sm font-black text-[#1B2A4A] tracking-tight">Status e Envios por Item</h3>

        <div className="space-y-3">
          {activeCriteria.map((crit) => {
            const isSpecialCard = crit.id === "7" || crit.id === "9" || crit.id === "1";
            if (isSpecialCard) {
              const tabName = crit.id === "9" ? "Garantias" : crit.id === "7" ? "Serviços" : "Calendário";
              const displayStatus = crit.status;
              const isAguardando = crit.id === "1" && !!crit.isAguardandoRealizacao;
              let statusBadge = "bg-stone-50 text-stone-500 border-stone-200";
              let icon = "hourglass_empty";

              if (isAguardando) {
                statusBadge = "bg-[#f1f5f9] text-[#475569] border-[#cbd5e1] font-black";
                icon = "calendar_today";
              } else if (displayStatus === "OK") {
                statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-250 font-black";
                icon = "check_circle";
              } else if (displayStatus === "NOK") {
                statusBadge = "bg-rose-50 text-rose-700 border-[#ffccd5] font-black";
                icon = "cancel";
              } else {
                statusBadge = "bg-amber-50 text-amber-700 border-amber-200 font-extrabold";
                icon = "pending";
              }

              return (
                <div
                  key={crit.id}
                  className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-3xs"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-sm font-black text-slate-300 mt-0.5 select-none">
                        {crit.number}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-[#1B2A4A] leading-snug">{crit.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium font-mono">Status da Auditoria</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider border leading-none shrink-0 flex items-center gap-1 ${statusBadge}`}>
                      <span className="material-symbols-outlined text-[11px] leading-none">{icon}</span>
                      {isAguardando ? "Aguardando Realização" : displayStatus === "OK" ? "Conforme" : displayStatus === "NOK" ? "Não Conforme" : "Pendente"}
                    </span>
                  </div>

                  {/* Informational helpful note */}
                  <div className="bg-white border border-slate-100 rounded-lg p-2.5 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-[13px] text-indigo-500 shrink-0 select-none mt-0.5">info</span>
                    <div>
                      {crit.id === "1" ? (
                        <span>
                          Este critério é semestral e obedece ao seu <strong>Calendário de Inventários</strong>. O almoxarife apenas visualiza este item — o Auditor Geral Fernando Silva lançará a nota e evidência no mês agendado.
                        </span>
                      ) : (
                        <span>
                          O lançamento deste critério é feito na aba <strong className="font-bold text-[#1B2A4A]">{tabName}</strong>. Aqui você acompanha apenas o resultado da auditoria.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Scheduled Inventories display for Criterion 1 */}
                  {crit.id === "1" && calItems.length > 0 && (
                    <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
                      <p className="text-[10px] font-black text-[#1B2A4A] uppercase tracking-wider block mb-1">
                        Detalhamento do Calendário Semestral:
                      </p>
                      {calItems.map((item, idx) => {
                        const dateFormatted = item.data_agendada 
                          ? item.data_agendada.split("-").reverse().join("/")
                          : "--/--/----";
                        const itemStatus = item.status || "PENDENTE";
                        
                        let badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                        if (itemStatus === "OK") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        if (itemStatus === "NOK") badgeColor = "bg-rose-50 text-rose-700 border-rose-200";

                        return (
                          <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-extrabold text-slate-600 block">
                                  Inventário Semestral #{idx + 1}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  Agendado: {dateFormatted}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider border font-black leading-none ${badgeColor}`}>
                                {itemStatus}
                              </span>
                            </div>

                            {itemStatus === "NOK" && item.nokEvidenceLink && (
                              <div className="bg-white border border-rose-100 rounded p-1.5 text-[9px] text-rose-800 flex flex-col gap-1 select-text">
                                <div className="flex items-center gap-1 font-extrabold text-[8px] uppercase tracking-wider text-rose-700 leading-none">
                                  <span className="material-symbols-outlined text-[11px] leading-none text-rose-600">link</span>
                                  <span>Evidência da Inconformidade:</span>
                                </div>
                                <a
                                  href={item.nokEvidenceLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-[#1B2A4A] hover:underline font-black truncate max-w-full block"
                                >
                                  {item.nokEvidenceLink} ↗
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* If OK: Visual confirmation */}
                  {!isAguardando && displayStatus === "OK" && (
                    <div className="bg-emerald-50/40 border border-emerald-100/50 p-2.5 rounded-lg flex items-center gap-2 text-[11px] text-emerald-800 leading-normal font-sans shadow-3xs">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0">verified</span>
                      <span className="font-medium">Critério conforme! Nota máxima atribuída de <strong className="font-bold font-mono">{crit.pointsPossible}/{crit.pointsPossible} pts</strong> propagada para todo o semestre.</span>
                    </div>
                  )}

                  {/* If AGUARDANDO: Friendly indicator */}
                  {isAguardando && (
                    <div className="bg-slate-100/50 border border-slate-200/50 p-2.5 rounded-lg flex items-center gap-2 text-[11px] text-slate-800 leading-normal font-sans shadow-3xs">
                      <span className="material-symbols-outlined text-[16px] text-slate-600 shrink-0">calendar_month</span>
                      <span className="font-medium shrink-0 max-w-full text-slate-700">{crit.notes || "Aguardando a data do inventário planejado."}</span>
                    </div>
                  )}

                  {/* If PENDENTE: Friendly indicator */}
                  {!isAguardando && displayStatus !== "OK" && displayStatus !== "NOK" && (
                    <div className="bg-amber-50/40 border border-amber-100/50 p-2.5 rounded-lg flex items-center gap-2 text-[11px] text-amber-800 leading-normal font-sans shadow-3xs">
                      <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0">schedule</span>
                      <span className="font-medium">Aguardando auditoria presencial ou consolidação pelo auditor.</span>
                    </div>
                  )}

                  {/* If NOK: Auditor notes, photo links and comments */}
                  {displayStatus === "NOK" && (
                    <div className="bg-rose-50 border border-rose-200/50 p-3 rounded-lg text-[11px] leading-relaxed select-text space-y-2">
                      <div className="flex items-center gap-1 text-rose-800 font-extrabold text-[10px] uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[13px]">report</span>
                        <span>Evidência de Inconformidade (Auditor)</span>
                      </div>
                      
                      {crit.notes ? (
                        <p className="text-rose-900 font-black italic bg-white/60 p-2 rounded border border-rose-100">
                          "{crit.notes}"
                        </p>
                      ) : (
                        <p className="text-rose-800 font-medium italic">
                          "Nenhuma justificativa detalhada inserida pelo auditor."
                        </p>
                      )}

                      {crit.submittedPhotos && crit.submittedPhotos.length > 0 && (
                        <div className="space-y-1.5 align-baseline">
                          <span className="text-[9px] font-bold text-rose-800 block uppercase">Imagens anexadas da desconformidade:</span>
                          <div className="grid grid-cols-4 gap-2">
                            {crit.submittedPhotos.map((photo, i) => (
                              <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-rose-200 bg-white">
                                <img
                                  src={photo}
                                  referrerPolicy="no-referrer"
                                  alt="Foto da inconformidade registrada"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {crit.nokEvidenceLinks && crit.nokEvidenceLinks.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-rose-200/50 mt-1.5">
                          <span className="text-[9px] font-bold text-rose-800 block uppercase flex items-center gap-1 leading-none">
                            <span className="material-symbols-outlined text-[13px] leading-none text-rose-700 font-bold">link</span>
                            <span>🔗 Evidências:</span>
                          </span>
                          <div className="flex flex-col gap-1 pl-1">
                            {crit.nokEvidenceLinks.map((link, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <span className="text-rose-600 font-bold leading-none">•</span>
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-800 hover:underline font-black text-[10.5px] tracking-wide"
                                >
                                  [Ver evidência {idx + 1} ↗]
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-bold text-rose-800 font-mono pt-1">
                        <span>Pontuação: {crit.pointsObtained}/{crit.pointsPossible} pts</span>
                        <span className="bg-rose-100 px-1.5 py-0.5 rounded uppercase text-[8.5px] font-black">NOK</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            const route = getSubscreenRoute(crit.id);
            const actionLabel = getCriterionActionLabel(crit.id);
            const twinCrit = twinBranch?.criteria.find((tc) => tc.id === crit.id);

            let displayStatus = crit.status;
            if (crit.auditMode === "Presencial" && (crit.status === "AGUARDANDO ENVIO" || crit.status === "PENDENTE" || crit.status === "ENVIADO")) {
              displayStatus = "PENDENTE";
            }

            let displayStatusText: string = displayStatus;
            let statusBadge = "bg-stone-100 text-stone-600 border-stone-200";

            if (["2", "4", "6"].includes(crit.id) && displayStatus === "ENVIADO") {
              displayStatusText = "AGUARDANDO AVALIAÇÃO DO AUDITOR";
              statusBadge = "bg-violet-50 text-violet-700 border-violet-150 animate-pulse font-black";
            } else {
              if (displayStatus === "OK") statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
              if (displayStatus === "NOK") statusBadge = "bg-rose-50 text-rose-700 border-rose-200";
              if (displayStatus === "PENDENTE") statusBadge = "bg-amber-50 text-amber-700 border-amber-200";
              if (displayStatus === "ENVIADO") statusBadge = "bg-violet-50 text-violet-700 border-violet-200 animate-pulse";
              if (displayStatus === "AGUARDANDO ENVIO") statusBadge = "bg-blue-50 text-blue-700 border-blue-200";
            }

            const isSingleSubmited = ["2", "4", "6"].includes(crit.id) && (crit.status === "ENVIADO" || crit.status === "OK" || crit.status === "NOK");

            return (
              <div
                key={crit.id}
                className="bg-white border border-slate-100 rounded-xl p-4 audit-card-shadow flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-sm font-black text-slate-300 mt-0.5 select-none">
                      {crit.number}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#1B2A4A] leading-snug">{crit.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Frequência: {crit.recurrence}</p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border leading-none shrink-0 ${statusBadge}`}>
                    {displayStatusText}
                  </span>
                </div>

                {/* Subtext info about the twin's status for maximum clarity */}
                {twinBranch && twinCrit && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100/70 flex items-center justify-between text-[10px] text-slate-500 font-bold select-none">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-indigo-400 leading-none">compare_arrows</span>
                      <span>Outro Almoxarifado ({twinBranch.name.replace("ALMOXARIFADO ", "").split(" ")[0]}):</span>
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black border leading-none ${
                      (twinCrit.rawStatus || twinCrit.status) === "OK" ? "bg-emerald-50 text-emerald-700 border-emerald-150" :
                      (twinCrit.rawStatus || twinCrit.status) === "NOK" ? "bg-rose-50 text-rose-700 border-rose-150" :
                      twinCrit.status === "ENVIADO" ? "bg-violet-50 text-violet-700 border-violet-150 animate-pulse" :
                      "bg-amber-50 text-[#1B2A4A] text-amber-700 border-amber-150"
                    }`}>
                      {twinCrit.rawStatus || twinCrit.status}
                    </span>
                  </div>
                )}

                {/* Notes/audit feedback if any */}
                {crit.notes && (
                  <div className="mt-2 bg-rose-55 rounded text-[10px] p-2 bg-rose-50 text-rose-800 border border-rose-100/30">
                    <span className="font-extrabold uppercase mr-1">Feedback do Auditor:</span>
                    {crit.notes}
                  </div>
                )}

                {/* Show Submitted Evidence inline for single-submission criteria (TOP 10, LayOut, Unimobin) when processed */}
                {isSingleSubmited && (
                  <div className="mt-2.5 p-3 bg-slate-50 border border-slate-100 rounded-lg text-[11px] leading-relaxed select-text space-y-2">
                    <div className="flex items-center gap-1 text-slate-500 font-extrabold text-[9px] uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[13px] text-indigo-500 font-black">visibility</span>
                      <span>Evidências Enviadas (Visualização)</span>
                    </div>

                    {crit.evidenceNotes && (
                      <p className="text-slate-600 font-medium italic bg-white p-2 rounded border border-slate-200/50">
                        "{crit.evidenceNotes}"
                      </p>
                    )}

                    {crit.submittedPhotos && crit.submittedPhotos.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {crit.submittedPhotos.map((photo, i) => (
                          <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-slate-200 bg-white shadow-3xs">
                            <img
                              src={photo}
                              referrerPolicy="no-referrer"
                              alt="Evidência fotográfica enviada"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {crit.id === "6" && (() => {
                      const storageKey = branch.id ? "acandido_certificates_" + branch.id : "acandido_certificates_default";
                      const saved = localStorage.getItem(storageKey);
                      if (saved) {
                        try {
                          const certsList = JSON.parse(saved);
                          if (Array.isArray(certsList)) {
                            const uploaded = certsList.filter(c => c.status === "Certificado enviado");
                            return (
                              <div className="text-[10px] text-indigo-700 font-bold bg-[#eff6ff] p-2 rounded border border-blue-100 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px] text-blue-600">verified</span>
                                <span>{uploaded.length} de {certsList.length} certificados enviados.</span>
                              </div>
                            );
                          }
                        } catch (e) {}
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Evidences notes if any for non-single-submission or while not yet audited */}
                {!isSingleSubmited && crit.evidenceNotes && crit.status === "ENVIADO" && !crit.auditMode && (
                  <div className="mt-2 bg-violet-50/40 p-2 rounded text-[10px] text-violet-800 border border-violet-100/30">
                    <span className="font-extrabold uppercase mr-1">Enviado em {crit.submittedAt}:</span>
                    {crit.evidenceNotes}
                  </div>
                )}

                {/* Dynamic buttons or Presencial UI block */}
                {crit.auditMode === "Presencial" ? (
                  <div className="mt-4 pt-3 border-t border-slate-50 space-y-3">
                    <div className="flex items-start gap-1.5 bg-blue-50/60 border border-blue-200/50 p-3 rounded-lg text-xs leading-normal animate-fade-in shadow-sm">
                      <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0 select-none mt-0.5">assignment</span>
                      <div className="text-[11px] font-medium text-slate-600">
                        <strong className="text-[#132247] font-black block text-xs mb-0.5">📋 Auditoria Presencial</strong>
                        Este critério será verificado pessoalmente no local pelo auditor de campo. Não há necessidade de envio de evidências pelo sistema.
                      </div>
                    </div>

                    {/* Show Auditor Results and Evidence on In-person criteria once launched */}
                    {crit.evidenceNotes && (
                      <div className="p-3 bg-slate-50 border border-slate-200/65 rounded-lg text-[11px] leading-relaxed select-text shadow-inner">
                        <strong className="text-[#1B2A4A] block font-bold mb-1">Evidência registrada pelo auditor:</strong>
                        <p className="text-slate-600 font-medium italic">"{crit.evidenceNotes}"</p>
                        
                        {crit.submittedPhotos && crit.submittedPhotos.length > 0 && (
                          <div className="grid grid-cols-4 gap-2 mt-2.5">
                            {crit.submittedPhotos.map((photo, i) => (
                              <div key={i} className="relative aspect-square rounded-md overflow-hidden border bg-white">
                                <img
                                  src={photo}
                                  referrerPolicy="no-referrer"
                                  alt="Foto da evidência presencial"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 font-mono">
                      <span>Resultado: <strong className={`uppercase font-black ${displayStatus === "OK" ? "text-emerald-600" : displayStatus === "NOK" ? "text-red-500" : "text-amber-500"}`}>{displayStatus}</strong></span>
                      <span>Nota Atual: {crit.pointsObtained}/{crit.pointsPossible} pts</span>
                    </div>
                  </div>
                ) : (
                  !isSingleSubmited && route && actionLabel && (
                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between gap-4">
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        Nota Atual: {crit.pointsObtained}/{crit.pointsPossible} pts
                      </span>

                      <button
                        type="button"
                        disabled={isClosedForAlmoxarife}
                        onClick={() => {
                          if (isClosedForAlmoxarife) return;
                          onNavigateToScreen(route);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 active:scale-95 ${
                          isClosedForAlmoxarife
                            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed select-none"
                            : crit.status === "ENVIADO"
                            ? "bg-slate-100 border-slate-300 text-slate-600 cursor-default"
                            : crit.status === "OK"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                            : "bg-[#1B2A4A] active:bg-[#0C152B] border-[#1B2A4A] text-white hover:brightness-110 shadow-sm"
                        }`}
                      >
                        <span>{isClosedForAlmoxarife ? "Trancado" : actionLabel}</span>
                        <span className="material-symbols-outlined text-[13px]">
                          {isClosedForAlmoxarife ? "lock" : crit.status === "ENVIADO" ? "hourglass_empty" : "arrow_forward"}
                        </span>
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
