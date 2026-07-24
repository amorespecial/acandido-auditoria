import React, { useState, useEffect } from "react";
import { AppUser, Branch, AuditHistoryEntry } from "../types";
import { initialHistory } from "../mockData";
import { dbFetchHistory, isSupabaseReady, MONTH_NAME_TO_NUM } from "../supabaseService";

interface AlmoxarifeHistoricoProps {
  user: AppUser;
  managedBranches: Branch[];
  activeMonth: string;
  activeYear: string;
  calendarData?: any[];
}

interface HistoricalReportDetails {
  id: string;
  monthYear: string;
  score: number;
  statusLabel: "Excelente" | "Bom" | "Atenção" | "Alerta";
  badgeClass: string;
  nokItems: string[];
  auditedDetails: string;
  criteria: Array<{
    id: string;
    name: string;
    status: "OK" | "NOK";
    pointsPossible: number;
    pointsObtained: number;
    notes: string;
  }>;
}

// Helper to sanitize name comparisons
const normalizeStr = (str: string) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
};

const getBranchCalendarForEntry = (branchId: string, monthYear: string, branchName: string | undefined, calendarData: any[] | undefined) => {
  const localCalendar = calendarData || [];

  const pts = monthYear.split(" ");
  const monthName = pts[0]?.toLowerCase() || "";
  const activeYearNum = parseInt(pts[1]) || 2026;
  const activeMonthNum = MONTH_NAME_TO_NUM[monthName] || 6;
  const activeSemestre = activeMonthNum <= 6 ? 1 : 2;

  const matchBranch = (almoxName: string, bId: string, bName?: string) => {
    const name = almoxName.toLowerCase().trim();
    const branchId = bId.toLowerCase().trim();
    
    const normAlmox = name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    const normId = branchId
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    let normName = "";
    if (bName) {
      normName = bName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .replace("almoxarifado", "")
        .trim();
    }

    // Check direct overlaps first
    if (normAlmox === normId || normId === normAlmox) return true;
    if (normAlmox.includes(normId) || normId.includes(normAlmox)) return true;
    if (normName && (normAlmox.includes(normName) || normName.includes(normAlmox))) return true;

    // Keep legacy overrides for full backward compatibility
    if (name.includes("santa maria")) return branchId === "santa-maria-jp";
    if (name.includes("a.candido") || name.includes("a.cândido")) return branchId === "acandido-cg";
    if (name.includes("bayeux")) return branchId === "trans-cg-bayeux";
    if (name === "trans cg" || name === "expresso nacional" || name.includes("trans cg") || name.includes("expresso nacional")) return branchId === "expresso-nacional";
    if (name.includes("cabedelo")) return branchId === "rodoviario-cabedelo";
    if (name.includes("goiana")) return branchId === "fretamento-goiana";
    if (name.includes("fret pb") || name.includes("fretamento pb")) return branchId === "fretamento-pb";
    if (name.includes("fret pe") || name.includes("jaboatao") || name === "trans fret pe") return branchId === "fretamento-jaboatao";
    if (name.includes("rod ce") || name.includes("fortaleza")) return branchId === "rodoviario-fortaleza";
    if (name.includes("rod pe") || name.includes("jaboatão pb") || name === "trans rod pe" || name.includes("jaboatao")) return branchId === "rodoviario-jaboatao";
    if (name.includes("transnacional rn") || name.includes("reunidas")) return branchId === "reunidas-nat";
    if (name.includes("unissanta") || name.includes("unissana")) return branchId === "unissana-rn";
    if (name.includes("unitrans")) return branchId === "unitrans-jp";
    return false;
  };

  return localCalendar.filter(item =>
    (item.branchId === branchId || (!item.branchId && matchBranch(item.almoxarifado, branchId, branchName))) &&
    item.ano === activeYearNum &&
    item.semestre === activeSemestre
  );
};

// Map of names for suggestions & explanations
const defaultCriteriaInfo: Record<string, { desc: string; reasons: string[]; suggestions: string[] }> = {
  "1": {
    desc: "Inventário Rotativo",
    reasons: [
      "Divergência física identificada em contagem rotativa com o sistema ERP.",
      "Margem de erro na acuracidade de estoque superior ao limite de 2% tolerado.",
      "Atraso no preenchimento e arquivamento formal do boletim de inventário."
    ],
    suggestions: [
      "Realizar reuniões diárias de alinhamento com a equipe para revisar lançamentos de entrada e saída.",
      "Executar contagem cega dupla semanal nos materiais de maior variabilidade de estoque.",
      "Atualizar o registro do ERP imediatamente após qualquer movimentação de retirada física."
    ]
  },
  "2": {
    desc: "TOP 10",
    reasons: [
      "Prateleira de itens críticos e de alto giro com desorganização visual.",
      "Falta de etiquetas padrão identificadoras em 2 itens críticos da curva A.",
      "Inconsistência de saldo físico em filtros ou pastilhas em relação ao sistema."
    ],
    suggestions: [
      "Etiquetar de forma indelével e visível todas as peças posicionadas no armário TOP 10.",
      "Realizar checks rápidos de conferência interna de quantidade a cada troca de turno.",
      "Garantir que a placa visual explicativa de posições dos 10 itens críticos esteja atualizada."
    ]
  },
  "3": {
    desc: "Nota Fiscal",
    reasons: [
      "Atraso no lançamento sistêmico de NFs, excedendo o prazo regulamentar de 24 horas úteis.",
      "Notas fiscais físicas armazenadas sem carimbo de recebimento ou assinatura do recebedor.",
      "Divergência de valores ou quantidades no lançamento XML importado no setor fiscal."
    ],
    suggestions: [
      "Estabelecer o protocolo de registrar e processar a NF-e nas primeiras 10 horas após a entrega física.",
      "Manter pasta física sanfonada dividida por dias úteis para facilitar conferências rápidas.",
      "Padronizar a assinatura e carimbo com data de entrada em todas as vias impressas retidas."
    ]
  },
  "4": {
    desc: "LayOut",
    reasons: [
      "Presença de sucatas ou paletes vazios obstruindo corridors ou rotas de emergência tática.",
      "Itens alocados de forma provisória no piso sem demarcação adequada de endereçamento.",
      "Materiais sem identificação visual de código nas prateleiras secundárias (C-H)."
    ],
    suggestions: [
      "Limpar e desobstruir corredores principais diariamente antes do encerramento do expediente.",
      "Garantir etiquetas e demarcações táticas adesivas no chão para delimitar áreas de paletes.",
      "Fazer uma ronda semanal de 15 minutos focada exclusivamente em organização visual de layout."
    ]
  },
  "5": {
    desc: "Recebimento de Material",
    reasons: [
      "Recebimento de novos insumos sem assinatura obrigatória na ficha de conferência cega.",
      "Insumos de lubrificantes descarregados fora do horário padrão sem conferência imediata.",
      "Falta de registro de avaria visível na embalagem de amortecedores recebidos."
    ],
    suggestions: [
      "Tornar obrigatória a impressão e preenchimento à caneta do Boletim de Conferência Cega.",
      "Fotografar e repassar ao supervisor qualquer sinal de avaria em embalagens no ato da descarga.",
      "Adotar planilha de fluxo de recepção assinada por quem descarregou e quem conferiu."
    ]
  },
  "6": {
    desc: "Curso Unimobin",
    reasons: [
      "Colaborador ativo do almoxarifado com certificado do curso regulamentar pendente no sistema.",
      "Atraso na reciclagem anual de conteúdos obrigatórios de segurança do trabalho no portal.",
      "Novos funcionários contratados sem inscrição concluída na trilha operacional Unimobin."
    ],
    suggestions: [
      "Monitorar semanalmente na aba própria o status de certificados da equipe do almoxarifado.",
      "Definir 1 hora reservada por semana na rotina para os colaboradores concluírem módulos online pendentes.",
      "Coordenar com o RH para que a trilha Unimobin seja pré-requisito obrigatório na primeira semana."
    ]
  },
  "7": {
    desc: "Nível de Serviço",
    reasons: [
      "SLA de separação de peças excedeu o limite médio ideal de 30 minutos.",
      "Atraso no fornecimento de itens essenciais na oficina, gerando ociosidade em mecânicos.",
      "Demora crônica no atendimento de requisições urgentes de kit de embreagens."
    ],
    suggestions: [
      "Antecipar a separação de pedidos pré-agendados de revisões mecânicas no dia anterior.",
      "Organizar as ferramentas de movimentação rápida para evitar deslocamento disperso no estoque.",
      "Criar uma fila visual prioritária exclusiva para ordens de veículos parados em manutenção corretiva."
    ]
  },
  "8": {
    desc: "Registro de Requisições",
    reasons: [
      "Requisições de peças finalizadas digitalmente sem a correspondente assinatura física.",
      "Ficha de liberação de pneus com dados legíveis rasurados ou incompletos.",
      "Identificada ausência de rubrica de supervisor para itens de alto custo autorizados."
    ],
    suggestions: [
      "Arquivar e grampear as ordens de requisição impressas junto às assinaturas do recebedor.",
      "Validar a matrícula e nome legível de quem retirou a peça antes da saída do almoxarifado.",
      "Realizar varredura diária no balanço para cruzar requisições sistêmicas com ordens assinadas."
    ]
  },
  "9": {
    desc: "Controle de Garantia",
    reasons: [
      "Gaiola de garantia e sucatas Moura com baterias empilhadas de forma precária e sem etiqueta.",
      "Atraso no agendamento de coleta de baterias com defeito, acumulando no pátio descoberto.",
      "Falta do laudo técnico pré-preenchido para envio ao fabricante para perícia de garantia."
    ],
    suggestions: [
      "Assegurar que toda bateria ou peça sob garantia seja imediatamente limpa e rotulada com tag plástica.",
      "Manter a gaiola de sucatas trancada e restrita a pessoal autorizado, evitando misturas.",
      "Instaurar um fluxo semanal de despacho de sucatas para eximir o setor de acúmulos perigosos."
    ]
  },
  "10": {
    desc: "Material Sem Movimentação",
    reasons: [
      "Armazenamento de amortecedores e peças obsoletas de frotas antigas sem plano de descarte.",
      "Estoques considerados inativos ou 'parados' há mais de 180 dias sem categorização preventiva.",
      "Alocação física de materiais obsoletos nas prateleiras mais nobres de alto giro de forma indevida."
    ],
    suggestions: [
      "Mapear e encaminhar ao supervisor no final de cada trimestre a relação do material parado.",
      "Segregar itens sem giro para uma área de descarte limpo ou estocagem de baixa prioridade.",
      "Sugerir ações comerciais, devoluções para a matriz ou leilão de ativos inservíveis."
    ]
  }
};

export default function AlmoxarifeHistorico({
  user,
  managedBranches,
  activeMonth,
  activeYear,
  calendarData
}: AlmoxarifeHistoricoProps) {
  // Select active branch inside Historico
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return managedBranches.length > 0 ? managedBranches[0].id : "";
  });

  // State to handle viewing a detailed report of a particular month
  const [viewingReport, setViewingReport] = useState<HistoricalReportDetails | null>(null);

  // Loading state when triggering browser prints
  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<any[]>([]);

  useEffect(() => {
    const loadAlmoxarifeHist = async () => {
      if (isSupabaseReady()) {
        try {
          const dbHistory = await dbFetchHistory();
          if (dbHistory) {
            setHistoryList(dbHistory);
            return;
          }
        } catch (e) {
          console.error("Failed to load history list in AlmoxarifeHistorico:", e);
        }
      }
      // Fallback
      try {
        const saved = localStorage.getItem("acandido_history");
        if (saved) {
          setHistoryList(JSON.parse(saved));
        }
      } catch (e) {
        setHistoryList([]);
      }
    };
    loadAlmoxarifeHist();
    window.addEventListener("realtime-historico-update", loadAlmoxarifeHist);
    window.addEventListener("storage", loadAlmoxarifeHist);
    return () => {
      window.removeEventListener("realtime-historico-update", loadAlmoxarifeHist);
      window.removeEventListener("storage", loadAlmoxarifeHist);
    };
  }, []);

  const activeBranch = managedBranches.find((b) => b.id === selectedBranchId) || managedBranches[0];

  if (!activeBranch) {
    return (
      <div className="bg-white rounded-xl p-8 text-center border border-slate-100 shadow-3xs max-w-md mx-auto my-12">
        <span className="material-symbols-outlined text-[48px] text-slate-300">warning</span>
        <h3 className="text-sm font-black text-[#1B2A4A] uppercase mt-2">Nenhum Almoxarifado Vinculado</h3>
        <p className="text-xs text-slate-400 mt-1">Sua conta atual não possui filiais registradas para visualização de histórico.</p>
      </div>
    );
  }

  // Generate dynamic performance history and merge with saved state in localStorage/Supabase
  const getHistoryEntries = (): HistoricalReportDetails[] => {
    const savedEntries = Array.isArray(historyList) ? historyList.filter((h: any) => h.monthYear) : [];

    // Filter real closed entries that belong to this branch
    const realBranchEntries = savedEntries.filter((e) => e.branchId === activeBranch.id);

    // Combine both, avoiding duplicates (in case user re-saves/closes a simulated month)
    const combined: HistoricalReportDetails[] = [];

    // First, process real entries saved in localStorage
    realBranchEntries.forEach((entry) => {
      let statusLabel: "Excelente" | "Bom" | "Atenção" | "Alerta" = "Alerta";
      let badgeClass = "bg-rose-50 text-rose-700 border-rose-200 font-extrabold";

      if (entry.score >= 90) {
        statusLabel = "Excelente";
        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-250 font-black";
      } else if (entry.score >= 80) {
        statusLabel = "Bom";
        badgeClass = "bg-cyan-50 text-cyan-700 border-cyan-200 font-black";
      } else if (entry.score >= 70) {
        statusLabel = "Atenção";
        badgeClass = "bg-amber-50 text-amber-700 border-amber-250 font-extrabold";
      }

      // Convert stored criteria or generate standard
      let mappedCriteria = entry.criteriaState ? entry.criteriaState.map((c: any) => ({
        id: c.id,
        name: c.name,
        status: (c.status === "OK" || c.status === "CONFIRMADO") ? "OK" : "NOK",
        pointsPossible: c.pointsPossible || 10,
        pointsObtained: c.score !== undefined ? c.score : (c.status === "OK" ? c.pointsPossible : 0),
        notes: c.notes || c.evidenceNotes || "Avaliação feita pelo auditor."
      })) : [];

      if (mappedCriteria.length === 0) {
        mappedCriteria = reconstructCriteria(entry.score, entry.nokItems || []);
      }

      combined.push({
        id: entry.id,
        monthYear: entry.monthYear,
        score: entry.score,
        statusLabel,
        badgeClass,
        nokItems: entry.nokItems || mappedCriteria.filter((mc: any) => mc.status === "NOK").map((mc: any) => mc.name),
        auditedDetails: entry.auditedDetails || "Ciclo finalizado de forma positiva e avaliado pelo encarregado de qualidade.",
        criteria: mappedCriteria
      });
    });

    return combined;
  };

  // Helper to construct fully realistic 10-criteria states based on points/nok list
  const reconstructCriteria = (score: number, nokList: string[]) => {
    const list = [
      { id: "1", name: "Inventário", pointsPossible: 20 },
      { id: "2", name: "TOP 10", pointsPossible: 20 },
      { id: "3", name: "Nota Fiscal", pointsPossible: 10 },
      { id: "4", name: "LayOut", pointsPossible: 10 },
      { id: "5", name: "Recebimento de Material", pointsPossible: 10 },
      { id: "6", name: "Curso Unimobin", pointsPossible: 10 },
      { id: "7", name: "Nível de Serviço", pointsPossible: 5 },
      { id: "8", name: "Registro de Requisições", pointsPossible: 5 },
      { id: "9", name: "Controle de Garantia", pointsPossible: 5 },
      { id: "10", name: "Material Sem Movimentação", pointsPossible: 5 }
    ];

    const normalizedNokList = nokList.map((item) => normalizeStr(item));

    return list.map((c) => {
      const isNok = normalizedNokList.some((nok) => {
        const cNorm = normalizeStr(c.name);
        return cNorm.includes(nok) || nok.includes(cNorm);
      });

      const status = isNok ? ("NOK" as const) : ("OK" as const);
      const pointsObtained = status === "OK" ? c.pointsPossible : 0;

      // Select a realistic description and note
      const info = defaultCriteriaInfo[c.id];
      let notes = "Critério atendido com conformidade operacional rigorosa.";
      if (isNok && info) {
        const index = Math.abs(c.name.length - activeBranch.name.length) % info.reasons.length;
        notes = info.reasons[index];
      }

      return {
        id: c.id,
        name: c.name,
        status,
        pointsPossible: c.pointsPossible,
        pointsObtained,
        notes
      };
    });
  };

  const currentHistory = getHistoryEntries();

  // Trigger simulated PDF download / print dialog beautifully
  const handleExportPDF = (report: HistoricalReportDetails) => {
    setIsExporting(true);
    setToastMsg("Preparando documento A.Cândido... Formatando impressão.");
    setTimeout(() => {
      setIsExporting(false);
      setToastMsg(`Relatório de Desempenho (${report.monthYear}) gerado para exportação!`);
      setTimeout(() => setToastMsg(null), 4000);
      try {
        window.print();
      } catch (err) {
        console.error("Print errored: ", err);
      }
    }, 1200);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 select-text" id="historico-almoxarife-view">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1B2A4A] text-[#C8A84B] px-4 py-3 rounded-xl shadow-lg border border-[#C8A84B]/40 flex items-center gap-2 animate-bounce font-bold text-xs">
          <span className="material-symbols-outlined text-[18px]">done_all</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* BRANCH MULTI-SELECTOR (IF COVERS ROBSON OR OTHERS WITH 2 DEPARTMENTS) */}
      {managedBranches.length > 1 && !viewingReport && (
        <div className="bg-white border border-slate-105 rounded-2xl p-4 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono">Almoxarife Responsável</p>
            <h3 className="text-sm font-black text-[#1B2A4A]">{user.name} ({user.cargo || "Almoxarife"})</h3>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {managedBranches.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                  selectedBranchId === b.id
                    ? "bg-[#1B2A4A] text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {b.name.replace("ALMOXARIFADO ", "")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NO ACTIVE REPORT DETAIL -> SHOW LIST OF CLOSED MONTHS */}
      {!viewingReport ? (
        <div className="space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#1B2A4A] text-[28px] select-none">history</span>
              <div>
                <h2 className="text-xl font-black text-[#1B2A4A] tracking-tight leading-none uppercase">Histórico e Evolução Pessoal</h2>
                <p className="text-xs text-slate-400 mt-1">Acompanhe seus resultados anteriores e as orientações para melhoria contínua</p>
              </div>
            </div>
          </div>

          {/* List of cards */}
          {currentHistory.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-3xs max-w-sm mx-auto space-y-3">
              <span className="material-symbols-outlined text-[48px] text-slate-400">
                assignment_late
              </span>
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase">📋 Nenhum histórico encontrado</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nenhum histórico encontrado — aguardando primeiro ciclo encerrado
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentHistory.map((report) => {
                const nokCount = report.nokItems.length;

                return (
                  <div
                    key={report.id}
                    className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4"
                  >
                    {/* Top line of card */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-base font-black text-[#1B2A4A] leading-tight font-sans">
                          {report.monthYear}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5" title={activeBranch.name}>
                          {activeBranch.name.replace("ALMOXARIFADO ", "")}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0 select-none">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${report.badgeClass}`}>
                          {report.statusLabel}
                        </span>
                        <span className="text-2xl font-black font-mono text-[#1B2A4A] leading-none">
                          {report.score} <span className="text-xs font-bold text-slate-400 font-sans">pts</span>
                        </span>
                      </div>
                    </div>

                    {/* Summary content / NOKs */}
                    <div className="text-xs flex-1 space-y-2">
                      <p className="text-slate-500 font-medium leading-relaxed italic line-clamp-2">
                        "{report.auditedDetails}"
                      </p>

                      {nokCount > 0 ? (
                        <div className="space-y-1 pt-1">
                          <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1 shrink-0 select-none">
                            <span className="material-symbols-outlined text-[13px]">report</span>
                            Pontos de Inconformidade ({nokCount}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {report.nokItems.map((item, idx) => (
                              <span
                                key={idx}
                                className="bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1 select-none">
                          <span className="material-symbols-outlined text-[14px]">verified</span>
                          Conformidade Absoluta (100% de Nota)
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end select-none">
                      <button
                        onClick={() => setViewingReport(report)}
                        className="px-4 py-2 bg-slate-50 hover:bg-[#1B2A4A] text-slate-700 hover:text-white border border-slate-200 hover:border-[#1B2A4A] rounded-xl text-xs font-black transition-all flex items-center gap-1.5 uppercase tracking-wider"
                      >
                        <span>Ver Relatório Completo</span>
                        <span className="material-symbols-outlined text-[16px]">trending_up</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ACTIVE CONSOLIDATED DETAIL VIEW (RELATÓRIO COMPLETO) */
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between border-b border-slate-150 pb-3 gap-4 select-none print:hidden">
            <button
              onClick={() => setViewingReport(null)}
              className="px-3.5 py-1.5 bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-black transition flex items-center gap-1 uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-[15px]">arrow_back</span>
              <span>Voltar ao Histórico</span>
            </button>

            <button
              onClick={() => handleExportPDF(viewingReport)}
              disabled={isExporting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 uppercase tracking-wider shadow-3xs"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span>{isExporting ? "Gerando Impressão..." : "Exportar PDF / Imprimir"}</span>
            </button>
          </div>

          {/* PRINT ONLY EMBELLISHMENT BANNER */}
          <div className="hidden print:flex flex-col items-center justify-center border-b-4 border-[#C8A84B] pb-4 mb-6 text-center select-none">
            <h1 className="text-xl font-black text-[#1B2A4A] tracking-[0.2em] font-sans">A.CÂNDIDO GRUPO</h1>
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-1">
              Relatório de Desempenho Operacional Individual • Auditoria Preventiva
            </p>
            <div className="h-1 w-24 bg-[#1B2A4A] mt-2"></div>
          </div>

          {/* MAIN REPORT CANVAS */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-3xs p-6 sm:p-8 space-y-8 print:border-none print:shadow-none print:p-0">
            
            {/* CABEÇALHO DO RELATÓRIO CHIP */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/70 border border-slate-100 p-5 rounded-2xl">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Unidade Analisada</p>
                <h3 className="text-xl font-black text-[#1B2A4A]">{activeBranch.name}</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Ciclo Avaliado: <strong className="text-slate-800">{viewingReport.monthYear}</strong> • Responsável: <strong className="text-slate-800">{user.name}</strong>
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white border border-slate-150 p-4 rounded-xl shrink-0">
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Pontuação Obtida</p>
                  <p className="text-2xl font-black font-mono text-[#1B2A4A] leading-none mt-1">
                    {viewingReport.score} <span className="text-sm font-bold text-slate-400 font-sans">/ 100</span>
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border text-center ${viewingReport.badgeClass}`}>
                  {viewingReport.statusLabel}
                </span>
              </div>
            </div>

            {/* SEÇÃO 1 — RESUMO DO MÊS */}
            <section className="space-y-2">
              <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-150 pb-1.5 flex items-center gap-1.5 select-none">
                <span className="material-symbols-outlined text-[16px] text-indigo-500">sticky_note_2</span>
                Seção I — Resumo de Avaliação
              </h4>
              <p className="text-[12px] text-slate-700 leading-relaxed font-semibold italic bg-slate-50/40 p-4 rounded-xl border border-slate-100">
                "Em {viewingReport.monthYear}, o almoxarifado {activeBranch.name} alcançou {viewingReport.score} de 100 pontos possíveis.{" "}
                {viewingReport.score >= 80
                  ? "Um resultado sólido que demonstra organização, dedicação profissional constante e atenção excelente aos critérios avaliados pela auditoria."
                  : "Houve alguns pontos de atenção e não conformidades operacionais que, se corrigidos a tempo, podem elevar significativamente a pontuação e performance no próximo ciclo."}
                "
              </p>
            </section>

            {/* SEÇÃO 2 — TABELA DE CRITÉRIOS DO MÊS */}
            <section className="space-y-3">
              <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-150 pb-1.5 flex items-center gap-1.5 select-none">
                <span className="material-symbols-outlined text-[16px] text-indigo-500">grid_on</span>
                Seção II — Detalhamento por Critério
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[9px] border-b border-slate-200 select-none">
                      <th className="p-3 font-black">Nº</th>
                      <th className="p-3 font-black">Critério Regulamentar</th>
                      <th className="p-3 font-black text-center">Peso</th>
                      <th className="p-3 font-black text-center">Avaliação</th>
                      <th className="p-3 font-black text-right">Pontos Obtidos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                    {viewingReport.criteria.map((c, index) => (
                      <tr key={c.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{index + 1}</td>
                        <td className="p-3 text-[#1B2A4A]">
                          {c.name}
                          <span className="text-[9px] text-slate-400 font-medium block italic mt-0.5" title={c.notes}>
                            {c.notes}
                          </span>

                          {/* Dynamic Scheduled Inventories display for Criterion 1 inside Historical Report */}
                          {c.id === "1" && (() => {
                            const calItems = getBranchCalendarForEntry(activeBranch.id, viewingReport.monthYear, activeBranch.name, calendarData);
                            if (calItems.length === 0) return null;
                            return (
                              <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 font-sans select-text">
                                <p className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">
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
                                    <div key={item.id} className="p-1.5 bg-slate-50 border border-slate-100 rounded text-[9.5px] flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black text-slate-600">
                                          #{idx + 1} — {dateFormatted}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider border font-black leading-none ${badgeColor}`}>
                                          {itemStatus}
                                        </span>
                                      </div>

                                      {itemStatus === "NOK" && item.nokEvidenceLink && (
                                        <div className="bg-white border border-rose-100 p-1 text-[8px] text-rose-800 flex flex-col gap-0.5">
                                          <div className="flex items-center gap-1 font-extrabold text-[7px] uppercase text-rose-700 leading-none">
                                            <span className="material-symbols-outlined text-[9px] leading-none text-rose-600 font-bold">link</span>
                                            <span>Evidência:</span>
                                          </div>
                                          <a
                                            href={item.nokEvidenceLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-600 hover:text-indigo-850 hover:underline font-bold truncate block"
                                          >
                                            {item.nokEvidenceLink} ↗
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-center text-slate-500 font-mono">{c.pointsPossible} pts</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider select-none ${
                            c.status === "OK"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                              : "bg-rose-50 text-rose-700 border border-[#fecdd3]"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-[#1B2A4A]">
                          {c.pointsObtained} / {c.pointsPossible} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SEÇÃO 3 — PONTOS FORTES */}
            <section className="space-y-3">
              <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-150 pb-1.5 flex items-center gap-1.5 select-none">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                Seção III — Pontos Fortes Cadastrados
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {viewingReport.criteria.filter(c => c.status === "OK").map((c) => (
                  <div key={c.id} className="p-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl flex items-start gap-2 text-[11px] leading-relaxed">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600 mt-0.5 select-none">check_circle</span>
                    <div className="font-medium text-slate-700">
                      <strong className="text-[#1B2A4A] font-black font-sans">{c.name}</strong> — {c.name === "TOP 10" ? "Contagem física precisa, sem divergências com o ERP. Muito bom." : c.name === "Controle de Garantia" ? "Gaiola de sucatas organizada e baterias Moura devidamente rotuladas." : "Atendimento operacional rigoroso de todos os parâmetros."}
                    </div>
                  </div>
                ))}
                {viewingReport.criteria.filter(c => c.status === "OK").length === 0 && (
                  <p className="text-[11px] text-slate-400 italic">Nenhum critério pontuou em conformidade total neste ciclo.</p>
                )}
              </div>
            </section>

            {/* SEÇÃO 4 — PONTOS DE ATENÇÃO (ONDE ERROU) */}
            <section className="space-y-3">
              <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-150 pb-1.5 flex items-center gap-1.5 select-none font-sans">
                <span className="material-symbols-outlined text-[16px] text-rose-500">cancel</span>
                Seção IV — Pontos de Atenção (Não Conformidades)
              </h4>
              <div className="space-y-3">
                {viewingReport.criteria.filter(c => c.status === "NOK").map((c) => (
                  <div key={c.id} className="p-4 bg-rose-50/50 border border-[#fecdd3]/40 rounded-xl flex flex-col sm:flex-row sm:items-start gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      <span className="material-symbols-outlined text-[16px] text-rose-600">report</span>
                      <strong className="text-rose-900 font-extrabold uppercase font-sans">{c.name}</strong>
                    </div>
                    <div className="flex-1 font-medium text-slate-700 italic border-l-2 border-rose-200 pl-3">
                      "{c.notes}"
                    </div>
                  </div>
                ))}
                {viewingReport.criteria.filter(c => c.status === "NOK").length === 0 && (
                  <div className="p-4 bg-emerald-50/35 border border-emerald-100 rounded-xl text-center text-emerald-800 text-[11px] font-black uppercase">
                    🎉 Parabéns! Nenhuma não conformidade identificada ou registrada.
                  </div>
                )}
              </div>
            </section>

            {/* SEÇÃO 5 — PLANO DE AÇÃO SUGERIDO */}
            <section className="space-y-3">
              <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-150 pb-1.5 flex items-center gap-1.5 select-none">
                <span className="material-symbols-outlined text-[16px] text-amber-600">assignment_turned_in</span>
                Seção V — Plano de Ação Sugerido (Passos Práticos)
              </h4>
              <div className="space-y-3">
                {viewingReport.criteria.filter(c => c.status === "NOK").map((c) => {
                  const info = defaultCriteriaInfo[c.id];
                  const suggestions = info ? info.suggestions : [
                    "Rever a rotina diária de verificação física do critério avaliado.",
                    "Consultar o manual de conformidade operacional do grupo Cândido.",
                    "Certificar-se do preenchimento da rotina com o supervisor."
                  ];

                  return (
                    <div key={c.id} className="p-4 bg-amber-50/30 border border-amber-200/50 rounded-2xl space-y-2">
                      <div className="flex items-center gap-1.5 select-none">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <strong className="text-[#1B2A4A] font-black text-xs">Ações Corretivas para: {c.name}</strong>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 font-semibold pl-1">
                        {suggestions.map((sug, i) => (
                          <li key={i} className="leading-relaxed">
                            {sug}
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
                {viewingReport.criteria.filter(c => c.status === "NOK").length === 0 && (
                  <div className="text-slate-500 text-[11px] font-medium italic">
                    Não existem ações necessárias. Mantenha as boas práticas de armazenamento e auditoria.
                  </div>
                )}
              </div>
            </section>

            {/* SEÇÃO 6 — COMPARATIVO COM MÊS ANTERIOR */}
            {(() => {
              // Helper to trace comparative scores
              const currentIndex = currentHistory.findIndex(h => h.id === viewingReport.id);
              const nextMonthInHistory = currentIndex < currentHistory.length - 1 ? currentHistory[currentIndex + 1] : null;

              if (!nextMonthInHistory) return null;

              const scoreDiff = viewingReport.score - nextMonthInHistory.score;
              const hasImproved = scoreDiff > 0;
              const hasDecreased = scoreDiff < 0;

              // Generate list of criteria that were NOK in previous month and are now OK
              const recoveredCrits: string[] = [];
              const degradedCrits: string[] = [];

              viewingReport.criteria.forEach((curCrit) => {
                const prevCrit = nextMonthInHistory.criteria.find(pc => pc.name === curCrit.name || pc.id === curCrit.id);
                if (prevCrit) {
                  if (prevCrit.status === "NOK" && curCrit.status === "OK") {
                    recoveredCrits.push(curCrit.name);
                  } else if (prevCrit.status === "OK" && curCrit.status === "NOK") {
                    degradedCrits.push(curCrit.name);
                  }
                }
              });

              return (
                <section className="space-y-3">
                  <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-150 pb-1.5 flex items-center gap-1.5 select-none font-sans">
                    <span className="material-symbols-outlined text-[16px] text-[#C8A84B]">trending_flat</span>
                    Seção VI — Comparativo Evolutivo do Período
                  </h4>
                  <div className="p-4 bg-slate-50/60 border border-slate-150 rounded-2xl text-[12px] leading-relaxed space-y-3 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-600">Resultado do mês anterior ({nextMonthInHistory.monthYear}):</span>
                      <span className="font-black font-mono text-slate-800">{nextMonthInHistory.score} pts</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-600">Resultado deste mês ({viewingReport.monthYear}):</span>
                      <span className="font-black font-mono text-slate-800 shrink-0">{viewingReport.score} pts</span>
                      
                      {hasImproved && (
                        <span className="text-emerald-700 font-extrabold bg-emerald-100/75 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[10px] flex items-center gap-0.5 select-none font-black font-sans leading-none">
                          <span className="material-symbols-outlined text-[13px] leading-none">arrow_upward</span>
                          +{scoreDiff} pts (Evolução ↑)
                        </span>
                      )}
                      {hasDecreased && (
                        <span className="text-rose-700 font-extrabold bg-rose-100/75 border border-[#ffccd5] px-2.5 py-0.5 rounded-lg text-[10px] flex items-center gap-0.5 select-none font-black font-sans leading-none">
                          <span className="material-symbols-outlined text-[13px] leading-none">arrow_downward</span>
                          {scoreDiff} pts (Queda ↓)
                        </span>
                      )}
                      {scoreDiff === 0 && (
                        <span className="text-slate-550 font-semibold bg-slate-200 px-2.5 py-0.5 rounded text-[10px] select-none font-black font-sans">
                          Estável (→)
                        </span>
                      )}
                    </div>

                    {/* highlight criteria improvements / regressions */}
                    {recoveredCrits.length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-150 p-2.5 rounded-xl flex items-center gap-2 mt-2 select-text">
                        <span className="material-symbols-outlined text-[18px] text-emerald-600">party_mode</span>
                        <div className="text-[11px] text-emerald-800 font-bold leading-normal">
                          Melhoria conquistada! 🎉 Você corrigiu o critério: <strong className="font-black">{recoveredCrits.join(", ")}</strong> em relação ao mês anterior. Excelente!
                        </div>
                      </div>
                    )}
                    {degradedCrits.length > 0 && (
                      <div className="bg-rose-50 border border-rose-150 p-2.5 rounded-xl flex items-center gap-2 mt-2 select-text">
                        <span className="material-symbols-outlined text-[18px] text-rose-600">warning</span>
                        <div className="text-[11px] text-rose-800 font-bold leading-normal">
                          Atenção: o critério <strong className="font-black">{degradedCrits.join(", ")}</strong> piorou de OK para NOK neste período. Recomenda-se acompanhamento rigoroso.
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* SEÇÃO 7 — MENSAGEM FINAL */}
            <section className="space-y-2 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider select-none flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-500">favorite</span>
                Seção VII — Considerações Complementares
              </h4>
              <p className="text-[11.5px] text-slate-600 leading-relaxed font-bold italic">
                {viewingReport.score >= 90
                  ? "Excelente trabalho neste ciclo de auditoria técnica! Sua dedicação estabelece um altíssimo nível de confiabilidade e organização para todo o Grupo A.Cândido. Continue assim!"
                  : viewingReport.score >= 70
                  ? "Você está no caminho certo. Pequenos ajustes de conferência interna e organização visual nos pontos indicados podem elevar consideravelmente sua nota agregada no próximo mês."
                  : "Este mês apresentou sérios desafios de conformidade, mas cada ponto de atenção listado constitui uma oportunidade clara de correção. Concentre seus esforços operacionais no plano de ação proposto para obtermos um ótimo resultado no ciclo por vir."}
              </p>
            </section>

          </div>
        </div>
      )}
    </div>
  );
}
