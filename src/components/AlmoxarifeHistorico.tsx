import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { AppUser, Branch } from "../types";
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
    recurrence: string;
    pointsPossible: number;
    pointsObtained: number;
    notes: string;
    reasonNok?: string;
    obsNok?: string;
    nokEvidenceLink?: string;
    nokEvidenceLinks?: string[];
  }>;
}

const normalizeStr = (str: string) => {
  return (str == null ? "" : String(str))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
};

const getEvaluationDate = (monthYear: string) => {
  const dates: { [key: string]: string } = {
    "Maio 2026": "15/05/2026",
    "Abril 2026": "12/04/2026",
    "Março 2026": "18/03/2026",
    "Fevereiro 2026": "14/02/2026",
    "Janeiro 2026": "20/01/2026"
  };
  return dates[monthYear] || new Date().toLocaleDateString("pt-BR");
};

const planosDeAcao: Record<string, string> = {
  "Inventário": 
    "Realizar recontagem dos itens divergentes, identificar a causa das diferenças encontradas, corrigir as movimentações necessárias no sistema e reforçar os procedimentos de controle e acuracidade dos estoques.",

  "TOP 10": 
    "Realizar conferência física dos itens divergentes, verificar as movimentações realizadas no período, corrigir inconsistências identificadas e intensificar o acompanhamento dos materiais de maior valor e giro.",

  "Nota Fiscal": 
    "Realizar conferência dos lançamentos de notas fiscais e recebimento de materiais, corrigindo divergências relacionadas a unidade de medida, conversão de quantidades, valores unitários, valores totais e documentação de recebimento, garantindo que as entradas estejam de acordo com a nota fiscal, pedido de compra e romaneio quando aplicável.",

  "Recebimento de Material": 
    "Realizar conferência dos lançamentos de notas fiscais e recebimento de materiais, corrigindo divergências relacionadas a unidade de medida, conversão de quantidades, valores unitários, valores totais e documentação de recebimento, garantindo que as entradas estejam de acordo com a nota fiscal, pedido de compra e romaneio quando aplicável.",

  "LayOut": 
    "Reorganizar os materiais conforme o padrão estabelecido, identificar adequadamente as localizações de armazenamento e manter o ambiente limpo, seguro e padronizado para facilitar a operação e o controle dos estoques.",
  "Layout": 
    "Reorganizar os materiais conforme o padrão estabelecido, identificar adequadamente as localizações de armazenamento e manter o ambiente limpo, seguro e padronizado para facilitar a operação e o controle dos estoques.",

  "Curso Unimobin": 
    "Regularizar a conclusão dos treinamentos obrigatórios na plataforma Unimobin, garantindo que todos os colaboradores realizem os cursos, assistam aos conteúdos e concluam as avaliações dentro do prazo estabelecido.",

  "Registro de Requisições": 
    "Organizar os relatórios e requisições em ordem sequencial, garantir o preenchimento correto e completo dos documentos, eliminar rasuras e assegurar que as baixas realizadas no sistema estejam em conformidade com as informações registradas nas requisições.",

  "Nível de Serviço": 
    "Analisar as ocorrências de falta de materiais, revisar os parâmetros de estoque mínimo e máximo dos itens afetados e implementar ações para garantir o atendimento adequado das demandas de manutenção.",

  "Controle de Garantia": 
    "Realizar conferência entre os registros de garantia controlados pelo almoxarifado e os lançamentos realizados no sistema, corrigindo divergências de quantidade e assegurando que todas as peças recebidas em garantia sejam devidamente registradas e controladas.",

  "Material Sem Movimentação": 
    "Analisar os materiais sem movimentação, avaliar possibilidades de transferência, utilização, devolução ou descarte e revisar os critérios de compra e estocagem para evitar novas ocorrências."
};

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
      "Presença de sucatas ou paletes vazios obstruindo corredores ou rotas de emergência tática.",
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

const getMonthYearSortKey = (monthYearStr: string) => {
  if (!monthYearStr) return 0;
  const str = monthYearStr.toLowerCase().trim();
  const months: Record<string, number> = {
    janeiro: 1, jan: 1,
    fevereiro: 2, fev: 2,
    março: 3, marco: 3, mar: 3,
    abril: 4, abr: 4,
    maio: 5, mai: 5,
    junho: 6, jun: 6,
    julho: 7, jul: 7,
    agosto: 8, ago: 8,
    setembro: 9, set: 9,
    outubro: 10, out: 10,
    novembro: 11, nov: 11,
    dezembro: 12, dez: 12,
  };
  let mVal = 1;
  for (const [key, val] of Object.entries(months)) {
    if (str.includes(key)) {
      mVal = val;
      break;
    }
  }
  const yMatch = str.match(/\d{4}/);
  const yVal = yMatch ? parseInt(yMatch[0], 10) : 2026;
  return yVal * 100 + mVal;
};

export default function AlmoxarifeHistorico({
  user,
  managedBranches,
  activeMonth,
  activeYear,
  calendarData
}: AlmoxarifeHistoricoProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return managedBranches.length > 0 ? managedBranches[0].id : "";
  });

  const [viewingReport, setViewingReport] = useState<HistoricalReportDetails | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("2026");

  useEffect(() => {
    const loadAlmoxarifeHist = async () => {
      if (isSupabaseReady()) {
        try {
          const dbHistory = await dbFetchHistory();
          if (dbHistory && dbHistory.length > 0) {
            setHistoryList(dbHistory);
            return;
          }
        } catch (e) {
          console.error("Failed to load history list in AlmoxarifeHistorico:", e);
        }
      }
      setHistoryList([]);
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

  const standardCriteriaDef = [
    { id: "1", name: "Inventário", recurrence: "Semestral", pointsPossible: 20 },
    { id: "2", name: "TOP 10", recurrence: "Mensal", pointsPossible: 20 },
    { id: "3", name: "Nota Fiscal", recurrence: "Mensal", pointsPossible: 10 },
    { id: "4", name: "Layout", recurrence: "Mensal", pointsPossible: 10 },
    { id: "5", name: "Recebimento de Material", recurrence: "Mensal", pointsPossible: 10 },
    { id: "6", name: "Curso Unimobin", recurrence: "Mensal", pointsPossible: 10 },
    { id: "7", name: "Nível de Serviço", recurrence: "Mensal", pointsPossible: 5 },
    { id: "8", name: "Registro de Requisições", recurrence: "Mensal", pointsPossible: 5 },
    { id: "9", name: "Controle de Garantia", recurrence: "Mensal", pointsPossible: 5 },
    { id: "10", name: "Material Sem Movimentação", recurrence: "Mensal", pointsPossible: 5 }
  ];

  const reconstructCriteria = (score: number, nokListInput: string[]) => {
    const normalizedNokList = (nokListInput || []).map((item) => normalizeStr(item));

    return standardCriteriaDef.map((c) => {
      const isNok = normalizedNokList.some((nok) => {
        const cNorm = normalizeStr(c.name);
        return cNorm.includes(nok) || nok.includes(cNorm);
      });

      const status = isNok ? ("NOK" as const) : ("OK" as const);
      const pointsObtained = status === "OK" ? c.pointsPossible : 0;
      const info = defaultCriteriaInfo[c.id];

      let notes = "Critério atendido em total conformidade operacional.";
      let reasonNok = "";
      let obsNok = "";

      if (isNok) {
        reasonNok = info ? info.reasons[0] : "Desvio aferido no checklist preventivo obrigatório.";
        obsNok = "Não conformidade técnica registrada devido ao descumprimento dos prazos ou padrões estabelecidos.";
        notes = reasonNok;
      }

      return {
        id: c.id,
        name: c.name,
        recurrence: c.recurrence,
        status,
        pointsPossible: c.pointsPossible,
        pointsObtained,
        notes,
        reasonNok,
        obsNok
      };
    });
  };

  const getHistoryEntries = (): HistoricalReportDetails[] => {
    const savedEntries = Array.isArray(historyList) ? historyList.filter((h: any) => h.monthYear || (h.mes && h.ano)) : [];
    const realBranchEntries = savedEntries.filter((e) => {
      const eBranch = e.almoxarifado_id || e.branchId || e.branch_id;
      return eBranch === activeBranch.id;
    });

    const combined: HistoricalReportDetails[] = [];

    realBranchEntries.forEach((entry) => {
      const mYear = entry.monthYear || entry.month_year || `${entry.mes || ""} ${entry.ano || ""}`.trim();
      const scoreVal = entry.pontuacao_total !== undefined ? entry.pontuacao_total : (entry.score !== undefined ? entry.score : 0);

      let statusLabel: "Excelente" | "Bom" | "Atenção" | "Alerta" = "Alerta";
      let badgeClass = "bg-rose-50 text-rose-700 border-rose-200 font-extrabold";

      if (scoreVal >= 90) {
        statusLabel = "Excelente";
        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-250 font-black";
      } else if (scoreVal >= 80) {
        statusLabel = "Bom";
        badgeClass = "bg-cyan-50 text-cyan-700 border-cyan-200 font-black";
      } else if (scoreVal >= 70) {
        statusLabel = "Atenção";
        badgeClass = "bg-amber-50 text-amber-700 border-amber-250 font-extrabold";
      }

      const rawCrits = entry.criterios || entry.criteriaState || entry.criteria || [];
      let mappedCriteria = rawCrits.length > 0 ? rawCrits.map((c: any, idx: number) => {
        const stdDef = standardCriteriaDef[idx] || standardCriteriaDef.find(s => s.name === c.name) || standardCriteriaDef[0];
        const isOk = c.status === "OK" || c.status === "CONFIRMADO";
        const pPoss = c.pointsPossible || stdDef.pointsPossible;
        const pObt = c.score !== undefined ? c.score : (isOk ? pPoss : 0);
        const nameClean = (c.name === "LayOut" ? "Layout" : c.name) || stdDef.name;

        return {
          id: c.id || stdDef.id,
          name: nameClean,
          recurrence: stdDef.recurrence,
          status: isOk ? ("OK" as const) : ("NOK" as const),
          pointsPossible: pPoss,
          pointsObtained: pObt,
          notes: c.notes || c.evidenceNotes || (isOk ? "Critério atendido com conformidade." : "Inconformidade registrada."),
          reasonNok: c.reasonNok || c.evidenceDescription || c.nokEvidenceDescription || "Desvio constatado no processo.",
          obsNok: c.obsNok || c.evidenceNotes || c.nokObs || "Registrado pela comissão de auditoria.",
          nokEvidenceLink: c.nokEvidenceLink || c.evidenceLink,
          nokEvidenceLinks: c.nokEvidenceLinks || (c.nokEvidenceLink ? [c.nokEvidenceLink] : [])
        };
      }) : [];

      if (mappedCriteria.length === 0) {
        mappedCriteria = reconstructCriteria(scoreVal, entry.nokItems || []);
      }

      combined.push({
        id: entry.id || `hist-${activeBranch.id}-${mYear}`,
        monthYear: mYear,
        score: scoreVal,
        statusLabel,
        badgeClass,
        nokItems: entry.nokItems || mappedCriteria.filter((mc: any) => mc.status === "NOK").map((mc: any) => mc.name),
        auditedDetails: entry.auditedDetails || "Ciclo finalizado e avaliado pelo encarregado de qualidade corporativo.",
        criteria: mappedCriteria
      });
    });

    return combined;
  };

  const currentHistory = getHistoryEntries();

  const availableYears = Array.from(
    new Set(
      currentHistory
        .map((r) => {
          const match = r.monthYear ? r.monthYear.match(/\d{4}/) : null;
          return match ? match[0] : null;
        })
        .filter((y): y is string => Boolean(y))
    )
  );
  if (!availableYears.includes("2026")) {
    availableYears.unshift("2026");
  }
  availableYears.sort((a, b) => b.localeCompare(a));

  const filteredHistory = currentHistory
    .filter((item) => {
      if (!selectedYear || selectedYear === "TODOS") return true;
      return item.monthYear && item.monthYear.includes(selectedYear);
    })
    .sort((a, b) => getMonthYearSortKey(a.monthYear) - getMonthYearSortKey(b.monthYear));

  // Helper to compute ranking position and semester accumulated score
  const calculateGroupRankingAndSemesterScore = (monthYear: string) => {
    const pts = monthYear.split(" ");
    const monthName = pts[0]?.toLowerCase() || "";
    const yearNum = parseInt(pts[1]) || 2026;
    const monthNum = MONTH_NAME_TO_NUM[monthName] || 6;
    const currentSemester = monthNum <= 6 ? 1 : 2;

    const monthScoresByBranch: Record<string, number> = {};
    const semesterScoresByBranch: Record<string, number> = {};

    historyList.forEach((entry) => {
      const eBranch = entry.almoxarifado_id || entry.branchId || entry.branch_id;
      if (!eBranch) return;

      const mYear = entry.monthYear || entry.month_year || `${entry.mes || ""} ${entry.ano || ""}`.trim();
      const scoreVal = entry.pontuacao_total !== undefined ? entry.pontuacao_total : (entry.score !== undefined ? entry.score : 0);

      if (mYear === monthYear) {
        monthScoresByBranch[eBranch] = scoreVal;
      }

      const entryPts = mYear.split(" ");
      const entryMName = entryPts[0]?.toLowerCase() || "";
      const entryYear = parseInt(entryPts[1]) || yearNum;
      const entryMNum = MONTH_NAME_TO_NUM[entryMName] || 0;
      const entrySem = entryMNum <= 6 ? 1 : 2;

      if (entryYear === yearNum && entrySem === currentSemester) {
        semesterScoresByBranch[eBranch] = (semesterScoresByBranch[eBranch] || 0) + scoreVal;
      }
    });

    const activeMonthScore = viewingReport ? viewingReport.score : (monthScoresByBranch[activeBranch.id] || 0);
    monthScoresByBranch[activeBranch.id] = activeMonthScore;

    const sortedBranches = Object.keys(monthScoresByBranch).sort((a, b) => monthScoresByBranch[b] - monthScoresByBranch[a]);
    const rankIndex = sortedBranches.indexOf(activeBranch.id);
    const positionInGroup = rankIndex !== -1 ? rankIndex + 1 : 3;

    const semesterAccumulatedScore = semesterScoresByBranch[activeBranch.id] || (activeMonthScore * 3);

    return {
      positionInGroup,
      totalBranchesInGroup: Math.max(13, sortedBranches.length),
      semesterAccumulatedScore
    };
  };

  const buildAutomaticResumoExecutivo = (report: HistoricalReportDetails) => {
    const okList = report.criteria.filter(c => c.status === "OK");
    const nokList = report.criteria.filter(c => c.status === "NOK");
    const okCount = okList.length;
    const nokCount = nokList.length;

    const okNames = okList.map(c => `${c.name} (${c.pointsPossible} pts)`).join(", ");
    const nokNames = nokList.map(c => `${c.name} (0 pts)`).join(", ");

    const rankInfo = calculateGroupRankingAndSemesterScore(report.monthYear);

    let baseText = `O almoxarifado ${activeBranch.name} obteve a pontuação total de ${report.score} de 100 pontos possíveis no ciclo de auditoria de ${report.monthYear}, registrando ${okCount} critérios em conformidade (OK) e ${nokCount} critérios não conformes (NOK).`;

    if (report.score >= 80) {
      baseText += ` A unidade demonstrou alto padrão de controle operacional, garantindo a integridade dos processos vistoriados.`;
    } else {
      baseText += ` A unidade apresentou pontos críticos que demandam adequação e acompanhamento prioritário nos desvios registrados.`;
    }

    if (okCount > 0) {
      baseText += `\n\nCritérios Aprovados (${okCount}): ${okNames}.`;
    }
    if (nokCount > 0) {
      baseText += `\n\nCritérios Não Conformes (${nokCount}): ${nokNames}.`;
    } else {
      baseText += `\n\nCritérios Não Conformes (0): Nenhum desvio registrado no ciclo.`;
    }

    baseText += `\n\nPosição atual no ranking do grupo: ${rankInfo.positionInGroup}º Lugar (de ${rankInfo.totalBranchesInGroup} unidades), acumulando ${rankInfo.semesterAccumulatedScore} pontos no semestre.`;

    return baseText;
  };

  const buildAutomaticConclusion = (report: HistoricalReportDetails) => {
    const nokList = report.criteria.filter(c => c.status === "NOK");
    let text = `Diante da vistoria técnica realizada no ciclo de ${report.monthYear} no almoxarifado ${activeBranch.name}, conclui-se que a unidade obteve ${report.score} de 100 pontos possíveis (Status: ${report.statusLabel.toUpperCase()}). `;

    if (report.score >= 90) {
      text += `A unidade apresenta um excelente nível de conformidade e controle operacional, alinhada com as melhores práticas e diretrizes do Grupo A. Cândido. Recomenda-se a manutenção do rigor nos processos.`;
    } else if (report.score >= 80) {
      text += `A unidade atingiu a meta regulamentar de conformidade, apresentando bom desempenho geral. Recomenda-se atenção pontual aos itens sinalizados para alcance da excelência técnica.`;
    } else if (report.score >= 70) {
      text += `A unidade encontra-se em estado de atenção. Recomenda-se a execução imediata dos planos de ação propostos para sanar os desvios identificados antes do próximo ciclo de vistoria.`;
    } else {
      text += `A unidade encontra-se em estado de alerta. Faz-se indispensável a intervenção corretiva prioritária com acompanhamento direto da supervisão nos itens com inconformidade.`;
    }

    if (nokList.length > 0) {
      text += `\n\nRecomendações Específicas por Critério:\n`;
      nokList.forEach((c) => {
        const plano = planosDeAcao[c.name] || "Realizar adequação conforme diretrizes técnicas operacionais do setor.";
        text += `• ${c.name}: ${plano}\n`;
      });
    }

    return text;
  };

  // Export PDF Handler with jsPDF + Browser Print
  const handleExportPDF = (report: HistoricalReportDetails) => {
    setIsExporting(true);
    setToastMsg("Gerando relatório oficial A. Cândido Grupo...");

    try {
      const crits = report.criteria;
      const score = report.score;
      const okList = crits.filter(c => c.status === "OK");
      const okCount = okList.length;
      const nokList = crits.filter(c => c.status === "NOK");
      const nokCount = nokList.length;

      const currentSummary = buildAutomaticResumoExecutivo(report);
      const currentConclusion = buildAutomaticConclusion(report);
      const evaluationDate = getEvaluationDate(report.monthYear);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      let y = 15;
      let pageNumber = 1;

      const checkPage = (heightNeeded: number) => {
        if (y + heightNeeded > 275) {
          doc.addPage();
          pageNumber++;
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text("A. CÂNDIDO GRUPO — Relatório de Auditoria Preventiva", 15, 10);
          doc.text(`Página ${pageNumber}`, 195, 10, { align: "right" });
          doc.setDrawColor(226, 232, 240);
          doc.line(15, 12, 195, 12);
          y = 20;
        }
      };

      // Header Banner
      doc.setFillColor(27, 42, 74);
      doc.rect(15, y, 180, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("A. CÂNDIDO GRUPO", 20, y + 7);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text("Gestão de Conformidade e Auditoria — Auditoria Preventiva", 20, y + 12);

      doc.setFontSize(10);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("RELATÓRIO DE AUDITORIA PREVENTIVA", 190, y + 10, { align: "right" });
      y += 24;

      // Metadata Block
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, y, 180, 22, "FD");

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.text("ALMOXARIFADO / FILIAL", 20, y + 6);
      doc.text("RESPONSÁVEL ALOCADO", 70, y + 6);
      doc.text("MÊS DE REFERÊNCIA", 120, y + 6);
      doc.text("DATA DE EMISSÃO", 160, y + 6);

      doc.setFontSize(9);
      doc.setTextColor(27, 42, 74);
      doc.setFont("Helvetica", "bold");
      doc.text(activeBranch.name, 20, y + 12);
      doc.text(user.name, 70, y + 12);
      doc.text(report.monthYear, 120, y + 12);
      doc.text(evaluationDate, 160, y + 12);

      const refCode = `ACD-AUD-2026-${activeBranch.id.toUpperCase().slice(0, 4)}-${report.monthYear.toUpperCase().replace(/\s/g, "")}`;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Ref ID: ${refCode}`, 20, y + 19);
      y += 28;

      // Section 1
      checkPage(20);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(27, 42, 74);
      doc.text("1. Resumo Executivo Operacional", 15, y);
      y += 2;
      doc.setDrawColor(27, 42, 74);
      doc.line(15, y, 195, y);
      y += 5;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const summarySplit = doc.splitTextToSize(currentSummary, 170);
      const boxHeight = summarySplit.length * 4.5 + 6;
      checkPage(boxHeight);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, y, 180, boxHeight, "FD");

      let iy = y + 4.5;
      summarySplit.forEach((line: string) => {
        doc.text(line, 20, iy);
        iy += 4.5;
      });
      y += boxHeight + 8;

      // Section 2
      checkPage(25);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(27, 42, 74);
      doc.text("2. Checklist Geral de Auditoria (10 Critérios)", 15, y);
      y += 2;
      doc.setDrawColor(27, 42, 74);
      doc.line(15, y, 195, y);
      y += 4;

      doc.setFillColor(27, 42, 74);
      doc.rect(15, y, 180, 7, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("#", 18, y + 5);
      doc.text("Critério Operacional", 25, y + 5);
      doc.text("Frequência", 90, y + 5);
      doc.text("P. Possíveis", 115, y + 5);
      doc.text("P. Obtidos", 140, y + 5);
      doc.text("Status", 165, y + 5);
      y += 7;

      crits.forEach((c) => {
        checkPage(7);
        doc.setDrawColor(226, 232, 240);
        doc.line(15, y, 195, y);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(c.id.padStart(2, "0"), 18, y + 5);
        doc.text(c.name, 25, y + 5);
        doc.text(c.recurrence || "Mensal", 90, y + 5);
        doc.text(`${c.pointsPossible} pts`, 115, y + 5);

        if (c.status === "OK") {
          doc.setTextColor(16, 124, 65);
          doc.setFont("Helvetica", "bold");
          doc.text(`${c.pointsObtained} pts`, 140, y + 5);
          doc.text("OK", 165, y + 5);
        } else {
          doc.setTextColor(185, 28, 28);
          doc.setFont("Helvetica", "bold");
          doc.text(`0 pts`, 140, y + 5);
          doc.text("NOK", 165, y + 5);
        }
        y += 6;
      });

      // Total Row
      checkPage(10);
      doc.setDrawColor(226, 232, 240);
      doc.line(15, y, 195, y);
      doc.setFillColor(241, 245, 249);
      doc.rect(15, y, 180, 8, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`PONTUAÇÃO ACUMULADA — ${score} pts`, 18, y + 5.5);
      y += 14;

      // Section 3
      checkPage(20);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(16, 124, 65);
      doc.text(`3. Conformidades Identificadas (${okCount})`, 15, y);
      y += 2;
      doc.setDrawColor(220, 252, 231);
      doc.line(15, y, 195, y);
      y += 4;

      if (okCount > 0) {
        const cols = 2;
        let cy = y;
        okList.forEach((c, idx) => {
          if (idx % cols === 0 && idx > 0) {
            cy += 10;
            checkPage(10);
          }
          const cx = (idx % cols === 0) ? 15 : 105;
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(220, 252, 231);
          doc.rect(cx, cy, 85, 8, "FD");
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(21, 128, 61);
          doc.text(`[OK] ${c.name} (${c.pointsPossible} pts)`, cx + 3, cy + 5);
        });
        y = cy + 14;
      } else {
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Nenhum processo em conformidade.", 15, y);
        y += 10;
      }

      // Section 4
      checkPage(20);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(185, 28, 28);
      doc.text(`4. Não Conformidades Registradas (${nokCount})`, 15, y);
      y += 2;
      doc.setDrawColor(254, 226, 226);
      doc.line(15, y, 195, y);
      y += 4;

      if (nokCount > 0) {
        nokList.forEach((c) => {
          const actionText = planosDeAcao[c.name] || "Ação corretiva recomendada pelo setor de qualidade.";
          const desvioText = c.reasonNok ? `Desvio: ${c.reasonNok}` : `Desvio: ${c.notes}`;

          checkPage(26);
          doc.setFillColor(254, 242, 242);
          doc.setDrawColor(254, 226, 226);
          doc.rect(15, y, 180, 22, "FD");

          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(153, 27, 27);
          doc.text(`${c.name} (0 / ${c.pointsPossible} pts)`, 18, y + 4.5);

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(127, 29, 29);
          doc.text(doc.splitTextToSize(desvioText, 172)[0] || "", 18, y + 9);

          const linksStr = c.nokEvidenceLinks && c.nokEvidenceLinks.length > 0
            ? `Evidências: ${c.nokEvidenceLinks.join(" | ")}`
            : (c.nokEvidenceLink ? `Evidência: ${c.nokEvidenceLink}` : `Nota: "${c.notes}"`);
          doc.text(doc.splitTextToSize(linksStr, 172)[0] || "", 18, y + 13);

          doc.setFillColor(255, 255, 255);
          doc.rect(18, y + 15, 174, 5.5, "F");
          doc.setFont("Helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(`Plano de Ação Corretiva: `, 20, y + 19);
          doc.setFont("Helvetica", "normal");
          doc.setTextColor(127, 29, 29);
          const actionSplit = doc.splitTextToSize(actionText, 125);
          doc.text(actionSplit[0] || "", 52, y + 19);

          y += 25;
        });
        y += 3;
      } else {
        checkPage(15);
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(220, 252, 231);
        doc.rect(15, y, 180, 10, "FD");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(21, 128, 61);
        doc.text("Unidade opera em conformidade técnica estrutural! Nenhuma não-conformidade detectada.", 20, y + 6);
        y += 14;
      }

      // Section 5
      checkPage(20);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(27, 42, 74);
      doc.text("5. Conclusão e Recomendações", 15, y);
      y += 2;
      doc.setDrawColor(27, 42, 74);
      doc.line(15, y, 195, y);
      y += 5;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const conclusionSplit = doc.splitTextToSize(currentConclusion, 170);
      const concBoxHeight = conclusionSplit.length * 4.5 + 6;
      checkPage(concBoxHeight);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, y, 180, concBoxHeight, "FD");

      let cy = y + 4.5;
      conclusionSplit.forEach((line: string) => {
        doc.text(line, 20, cy);
        cy += 4.5;
      });
      y += concBoxHeight + 8;

      // Section 6
      checkPage(20);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(27, 42, 74);
      doc.text("6. Histórico Consolidado dos Ciclos Anteriores", 15, y);
      y += 2;
      doc.setDrawColor(27, 42, 74);
      doc.line(15, y, 195, y);
      y += 5;

      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, 180, 7, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("Ciclo", 18, y + 5);
      doc.text("Tipo", 55, y + 5);
      doc.text("Pontuação", 95, y + 5);
      doc.text("Ocorrências / Desvios", 125, y + 5);
      y += 7;

      currentHistory.forEach((h) => {
        checkPage(7);
        doc.setDrawColor(226, 232, 240);
        doc.line(15, y, 195, y);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(h.monthYear, 18, y + 5);
        doc.text(h.statusLabel, 55, y + 5);
        doc.text(`${h.score} pts`, 95, y + 5);

        if (h.nokItems && h.nokItems.length > 0) {
          doc.setTextColor(185, 28, 28);
          doc.text(h.nokItems.join(", "), 125, y + 5);
        } else {
          doc.setTextColor(21, 128, 61);
          doc.text("Nenhum desvio registrado", 125, y + 5);
        }
        y += 6;
      });
      y += 12;

      // Footer Signatures
      checkPage(25);
      doc.setDrawColor(226, 232, 240);
      doc.line(15, y, 195, y);
      y += 6;

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("AUDITORIA DE OPERAÇÕES PREVENTIVAS", 15, y);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("A.Cândido Grupo S/A — Seção de Planejamento de Ativos", 15, y + 4);
      doc.text(`Emissão Oficial: ${new Date().toLocaleDateString("pt-BR")}`, 15, y + 8);

      doc.line(140, y + 10, 190, y + 10);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text("Fernando Silva", 140, y + 14);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Auditor de Estoque — Grupo A. Cândido", 140, y + 18);

      const sanitizeName = (name: string) => {
        return (name == null ? "" : String(name))
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      };

      const filename = `relatorio_${sanitizeName(activeBranch.name)}_${sanitizeName(report.monthYear)}.pdf`;
      doc.save(filename);

      setIsExporting(false);
      setToastMsg(`Relatório em PDF de ${report.monthYear} para o ${activeBranch.name} exportado com sucesso!`);
      setTimeout(() => setToastMsg(null), 4000);

      // Trigger browser print
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.error("Browser print fail:", e);
        }
      }, 500);

    } catch (err) {
      console.error("PDF generation failed:", err);
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 select-text" id="historico-almoxarife-view">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="no-print fixed top-24 left-1/2 -translate-x-1/2 md:right-8 md:left-auto md:translate-x-0 z-50 bg-[#16a34a] text-white py-3 px-5 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500 font-bold text-xs">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <p className="text-xs font-black tracking-wide">{toastMsg}</p>
        </div>
      )}

      {/* Branch Selector if user covers multiple */}
      {managedBranches.length > 1 && !viewingReport && (
        <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono">Almoxarife Responsável</p>
            <h3 className="text-sm font-black text-[#1B2A4A]">{user.name} ({user.cargo || "Almoxarife"})</h3>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {managedBranches.map((b) => (
              <button
                key={b.id}
                type="button"
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

      {/* List of Closed Months when no report is selected */}
      {!viewingReport ? (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#1B2A4A] text-[28px] select-none">history</span>
              <div>
                <h2 className="text-xl font-black text-[#1B2A4A] tracking-tight leading-none uppercase">Histórico e Evolução Pessoal</h2>
                <p className="text-xs text-slate-400 mt-1">Acompanhe seus resultados anteriores e as orientações para melhoria contínua</p>
              </div>
            </div>

            {/* Year Selector Dropdown */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 select-none">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Ano:</span>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 px-3.5 py-1.5 pr-8 rounded-xl text-xs font-black text-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A] cursor-pointer shadow-3xs"
                >
                  <option value="TODOS">Todos os Anos</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px]">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-3xs max-w-sm mx-auto space-y-3">
              <span className="material-symbols-outlined text-[48px] text-slate-400">assignment_late</span>
              <h3 className="text-sm font-black text-[#1B2A4A] uppercase">📋 Nenhum histórico encontrado</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {currentHistory.length === 0
                  ? "Nenhum histórico encontrado — aguardando primeiro ciclo encerrado pelo auditor."
                  : `Nenhum histórico encontrado para o ano ${selectedYear}.`}
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 pl-6 sm:pl-8 ml-3 sm:ml-4 py-2 space-y-6">
              {filteredHistory.map((report) => {
                const nokCount = report.nokItems ? report.nokItems.length : 0;
                const dotBg =
                  report.score >= 80
                    ? "bg-emerald-500"
                    : report.score >= 70
                    ? "bg-amber-400"
                    : "bg-red-500";

                return (
                  <div key={report.id} className="relative group">
                    {/* Connector Dot on Lateral Timeline */}
                    <span
                      className={`absolute -left-[31px] sm:-left-[39px] top-6 w-[12px] h-[12px] rounded-full border-2 border-white shadow-md transition-all ${dotBg}`}
                    ></span>

                    {/* Card: 1 column vertical list item */}
                    <div className="bg-white border border-slate-200 hover:border-[#1B2A4A]/40 rounded-2xl p-6 sm:p-7 shadow-3xs hover:shadow-md transition-all space-y-4">
                      {/* Top Header Row inside Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] leading-tight font-sans">
                            {report.monthYear}
                          </h3>
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                            ({activeBranch.name.replace("ALMOXARIFADO ", "")})
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${report.badgeClass}`}>
                            {report.statusLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <span className="text-2xl sm:text-3xl font-black text-[#1B2A4A] font-mono leading-none">
                            {report.score}
                          </span>
                          <div className="flex flex-col leading-none">
                            <span className="text-xs font-bold text-slate-400 font-sans">pts</span>
                            <span className="text-[8px] text-[#C8A84B] font-black uppercase tracking-wider font-mono">PONTUAÇÃO</span>
                          </div>
                        </div>
                      </div>

                      {/* Details text */}
                      <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed italic">
                        "{report.auditedDetails}"
                      </p>

                      {/* NOK or 100% OK section */}
                      {nokCount > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] sm:text-xs font-black text-rose-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none">
                            <span className="material-symbols-outlined text-[16px]">report</span>
                            Pontos de Inconformidade ({nokCount}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {report.nokItems.map((item: string, idx: number) => (
                              <span
                                key={idx}
                                className="bg-rose-50 border border-rose-100 text-rose-700 text-[10px] sm:text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow-3xs"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1 text-[10px] sm:text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 select-none">
                          <span className="material-symbols-outlined text-[16px]">verified</span>
                          Conformidade Absoluta (100% de Nota)
                        </div>
                      )}

                      {/* Bottom Footer Row inside Card */}
                      <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
                        <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                          Clique para visualizar o laudo técnico de auditoria
                        </p>
                        <button
                          type="button"
                          onClick={() => setViewingReport(report)}
                          className="w-full sm:w-auto px-5 py-2.5 bg-slate-50 hover:bg-[#1B2A4A] text-[#1B2A4A] hover:text-white border border-slate-200 hover:border-[#1B2A4A] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wider active:scale-95 shadow-2xs cursor-pointer"
                        >
                          <span>Ver Relatório Completo</span>
                          <span className="material-symbols-outlined text-[18px]">trending_up</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* FULL EXECUTIVE AUDIT DOCUMENT REPORT VIEW (IDENTICAL TO AUDITOR'S REPORT) */
        <div className="max-w-5xl mx-auto space-y-6">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              .no-print {
                display: none !important;
              }
              .print-container {
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                width: 100% !important;
                max-width: 100% !important;
              }
              @page {
                size: A4;
                margin: 1.5cm;
              }
            }
          `}} />

          {/* Action Row */}
          <div className="no-print flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setViewingReport(null)}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-250 text-[#1B2A4A] hover:text-[#C8A84B] font-extrabold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] font-bold">arrow_back</span>
              <span>Voltar ao Histórico</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExportPDF(viewingReport)}
              className={`px-4 py-2 ${
                isExporting ? "bg-slate-300 pointer-events-none" : "bg-[#1B2A4A] hover:bg-[#1E3A6B]"
              } text-white font-extrabold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer`}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Exportando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                  <span>Exportar PDF / Imprimir</span>
                </>
              )}
            </button>
          </div>

          {/* PRINTABLE REPORT CANVAS */}
          <div id="audit-report-printable" className="print-container bg-white border border-slate-200 rounded-2xl p-6 sm:p-12 shadow-sm text-[#0F172A] font-sans space-y-8">
            {/* Document Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-[#1B2A4A] pb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#1B2A4A] tracking-wider font-sans uppercase">
                  A. CÂNDIDO GRUPO
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-bold tracking-widest uppercase mt-1">
                  Gestão de Conformidade e Auditoria — Auditoria Preventiva
                </p>
              </div>
              <div className="text-left sm:text-right">
                <h2 className="text-lg sm:text-xl font-black text-[#1B2A4A] uppercase tracking-normal">
                  Relatório de Auditoria Preventiva
                </h2>
                <p className="text-xs text-slate-400 font-mono font-bold mt-1">
                  Ref ID: ACD-AUD-2026-{activeBranch.id.toUpperCase().slice(0, 4)}-{viewingReport.monthYear.toUpperCase().replace(/\s/g, "")}
                </p>
              </div>
            </div>

            {/* Metadata Table */}
            <div className="bg-slate-50/90 border border-slate-200 p-6 rounded-2xl shadow-3xs">
              <h3 className="text-xs sm:text-sm font-black text-[#1B2A4A] uppercase tracking-wider mb-4">
                Identificação do Ciclo de Auditoria
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-xs sm:text-sm">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Almoxarifado / Filial</p>
                  <p className="font-extrabold text-[#1B2A4A] text-sm sm:text-base mt-0.5">{activeBranch.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Responsável Alocado</p>
                  <p className="font-extrabold text-[#1B2A4A] text-sm sm:text-base mt-0.5">{user.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Mês Referência</p>
                  <p className="font-extrabold text-[#1B2A4A] text-sm sm:text-base mt-0.5">{viewingReport.monthYear}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Data de Emissão</p>
                  <p className="font-extrabold text-[#1B2A4A] text-sm sm:text-base mt-0.5">{getEvaluationDate(viewingReport.monthYear)}</p>
                </div>
              </div>
            </div>

            {/* Section 1: Executive Summary */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] uppercase tracking-wider border-b-2 border-[#1B2A4A]/20 pb-3 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-[#1B2A4A]">description</span>
                1. Resumo Executivo Operacional
              </h3>
              <div className="bg-slate-50/90 border border-slate-200 border-l-4 border-l-[#1B2A4A] p-6 sm:p-7 rounded-2xl text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans shadow-2xs">
                {buildAutomaticResumoExecutivo(viewingReport)}
              </div>
            </div>

            {/* Section 2: Full Checklist Table (10 Criteria) */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] uppercase tracking-wider border-b-2 border-[#1B2A4A]/20 pb-3 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-[#1B2A4A]">fact_check</span>
                2. Checklist Geral de Auditoria (10 Critérios)
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#1B2A4A] text-white text-xs font-black uppercase tracking-wider">
                      <th className="py-3.5 px-4 sm:px-5 w-12">#</th>
                      <th className="py-3.5 px-4 sm:px-5">Critério Operacional</th>
                      <th className="py-3.5 px-4 sm:px-5 text-center">Frequência</th>
                      <th className="py-3.5 px-4 sm:px-5 text-center">Pontos Possíveis</th>
                      <th className="py-3.5 px-4 sm:px-5 text-center">Pontos Obtidos</th>
                      <th className="py-3.5 px-4 sm:px-5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingReport.criteria.map((c) => (
                      <tr key={c.id} className="border-b border-slate-150 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-5 font-mono font-black text-slate-400">{c.id.padStart(2, "0")}</td>
                        <td className="py-3.5 px-4 sm:px-5 font-bold text-[#1B2A4A]">
                          {c.name}
                        </td>
                        <td className="py-3.5 px-4 sm:px-5 text-center font-semibold text-slate-500">{c.recurrence || "Mensal"}</td>
                        <td className="py-3.5 px-4 sm:px-5 text-center text-slate-500 font-mono font-semibold">{c.pointsPossible} pts</td>
                        <td className={`py-3.5 px-4 sm:px-5 text-center font-mono font-black ${c.status === "OK" ? "text-emerald-700" : "text-rose-600"}`}>
                          {c.pointsObtained} pts
                        </td>
                        <td className="py-3.5 px-4 sm:px-5 text-center">
                          <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black ${
                            c.status === "OK" 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                      <td colSpan={3} className="py-3.5 px-4 sm:px-5 text-right text-slate-600">PONTUAÇÃO ACUMULADA:</td>
                      <td className="py-3.5 px-4 sm:px-5 text-center font-mono text-slate-600">100 pts</td>
                      <td className={`py-3.5 px-4 sm:px-5 text-center font-mono text-sm ${viewingReport.score >= 80 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {viewingReport.score} pts
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-center">
                        <span className={`inline-block px-3.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider ${
                          viewingReport.score >= 80 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                        }`}>
                          {viewingReport.score >= 80 ? "QUALIFICADO" : "EM ALERTA"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Section 3: Conformidades */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-black text-emerald-800 uppercase tracking-wider border-b-2 border-emerald-200 pb-3 flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
                  3. Conformidades Identificadas ({viewingReport.criteria.filter(c => c.status === "OK").length})
                </h3>
                {viewingReport.criteria.filter(c => c.status === "OK").length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {viewingReport.criteria.filter(c => c.status === "OK").map(c => (
                      <div key={c.id} className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-3 shadow-2xs">
                        <span className="material-symbols-outlined text-emerald-600 text-lg font-bold shrink-0">check</span>
                        <div className="overflow-hidden">
                          <p className="text-xs sm:text-sm font-extrabold text-emerald-950 truncate">{c.name}</p>
                          <p className="text-[10px] sm:text-xs text-emerald-700 font-mono font-bold mt-0.5">{c.pointsPossible} pts obtidos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-400 italic">Nenhum processo em conformidade.</p>
                )}
              </div>

              {/* Section 4: Não Conformidades */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-black text-rose-800 uppercase tracking-wider border-b-2 border-rose-200 pb-3 flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-rose-600">report_problem</span>
                  4. Não Conformidades Registradas ({viewingReport.criteria.filter(c => c.status === "NOK").length})
                </h3>
                {viewingReport.criteria.filter(c => c.status === "NOK").length > 0 ? (
                  <div className="space-y-4">
                    {viewingReport.criteria.filter(c => c.status === "NOK").map(c => {
                      const actionText = planosDeAcao[c.name] || "Realizar adequação técnica conforme diretrizes operacionais do grupo.";
                      return (
                        <div key={c.id} className="p-5 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-3 shadow-2xs">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-xs sm:text-sm font-black text-rose-950 flex items-center gap-2">
                              <span className="material-symbols-outlined text-rose-600 text-lg">warning</span>
                              {c.name}
                            </p>
                            <span className="font-mono text-xs font-extrabold text-rose-800 bg-rose-100/90 px-2.5 py-1 rounded-lg border border-rose-200">
                              0 / {c.pointsPossible} pts
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm space-y-2.5 text-rose-900 leading-relaxed">
                            <p><strong className="text-rose-950 font-extrabold">Desvio: </strong>{c.reasonNok || c.notes}</p>
                            <p className="font-medium italic text-rose-850"><strong className="text-rose-950 font-extrabold">Nota de Auditoria: </strong>"{c.obsNok || c.notes}"</p>
                            
                            {(c.nokEvidenceLink || (c.nokEvidenceLinks && c.nokEvidenceLinks.length > 0)) && (
                              <div className="flex flex-wrap gap-2 items-center my-2">
                                {(c.nokEvidenceLinks && c.nokEvidenceLinks.length > 0 ? c.nokEvidenceLinks : [c.nokEvidenceLink!]).map((link, lIdx) => (
                                  <a
                                    key={lIdx}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg font-black transition-all shadow-3xs"
                                  >
                                    <span>🔗 Ver evidência {lIdx + 1}</span>
                                  </a>
                                ))}
                              </div>
                            )}

                            <div className="p-4 bg-white border border-rose-200 rounded-xl text-xs sm:text-sm text-slate-800 shadow-2xs space-y-1">
                              <strong className="text-rose-950 font-extrabold block mb-1">Plano de Ação Corretiva Oficial:</strong>
                              <span className="font-medium text-slate-700 leading-relaxed">{actionText}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs sm:text-sm text-emerald-900 leading-relaxed font-semibold">
                    ✅ Unidade opera em perfeição técnica estrutural! Nenhuma não-conformidade operacional foi detectada neste ciclo mensal de vistoria preventiva.
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: Conclusion & Recommendations */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] uppercase tracking-wider border-b-2 border-[#1B2A4A]/20 pb-3 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-[#1B2A4A]">engineering</span>
                5. Conclusão e Recomendações
              </h3>
              <div className="bg-slate-50/90 border border-slate-200 border-l-4 border-l-[#1B2A4A] p-6 sm:p-7 rounded-2xl text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans shadow-2xs">
                {buildAutomaticConclusion(viewingReport)}
              </div>
            </div>

            {/* Section 6: Historical Consolidated Cycles */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] uppercase tracking-wider border-b-2 border-[#1B2A4A]/20 pb-3 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-[#1B2A4A]">history</span>
                6. Histórico Consolidado dos Ciclos Anteriores
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-xs tracking-wider">
                      <th className="py-3.5 px-4 sm:px-5 font-mono">Ciclo</th>
                      <th className="py-3.5 px-4 sm:px-5 text-center font-mono">Resultado</th>
                      <th className="py-3.5 px-4 sm:px-5 text-center font-mono">Pontuação</th>
                      <th className="py-3.5 px-4 sm:px-5 font-mono">Ocorrências / Desvios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...currentHistory]
                      .sort((a, b) => getMonthYearSortKey(a.monthYear) - getMonthYearSortKey(b.monthYear))
                      .map((h) => (
                      <tr key={h.id} className="border-b border-slate-150 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-5 font-bold text-[#1B2A4A]">{h.monthYear}</td>
                        <td className="py-3.5 px-4 sm:px-5 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-black ${
                            h.score >= 90 ? "bg-emerald-100 text-emerald-800" :
                            h.score >= 80 ? "bg-cyan-100 text-cyan-800" :
                            h.score >= 70 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {h.statusLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-5 text-center font-mono font-black text-slate-800">
                          {h.score} pts
                        </td>
                        <td className="py-3.5 px-4 sm:px-5 text-slate-700 font-medium">
                          {h.nokItems && h.nokItems.length > 0 ? (
                            <span className="text-rose-600 font-semibold">{h.nokItems.join(", ")}</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">Nenhum desvio registrado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Document Footer */}
            <div className="pt-8 border-t-2 border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-6 text-xs text-slate-500 font-medium">
              <div>
                <p className="text-slate-700 font-black uppercase tracking-wider">Auditoria de Operações Preventivas — A.Cândido Grupo S/A</p>
                <p className="mt-1 text-slate-500">A.Cândido Grupo S/A — Seção de Planejamento de Ativos</p>
                <p className="text-slate-400 mt-0.5">Emissão Oficial: {new Date().toLocaleDateString("pt-BR")}</p>
              </div>
              
              <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
                <div className="w-56 h-px bg-slate-300"></div>
                <p className="text-slate-900 font-black font-sans text-sm">
                  Fernando Silva
                </p>
                <p className="text-xs text-slate-500 font-bold tracking-tight uppercase leading-none">
                  Auditor de Estoque — Grupo A. Cândido
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
