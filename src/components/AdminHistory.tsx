import React, { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import { initialHistory } from "../mockData";
import { AuditHistoryEntry, AppUser, Branch, CriterionState } from "../types";
import { dbFetchHistory, isSupabaseReady, MONTH_NAME_TO_NUM } from "../supabaseService";
import { useRealtimeSync } from "../useRealtimeSync";

interface AdminHistoryProps {
  user: AppUser;
  branches: Branch[];
  calendarData?: any[];
}

const s = (v: any): string => (v == null ? "" : String(v));

// 1. HELPERS FOR TEXT NORMALIZATION AND STRING MATCHING
const removeAccentsAndSpaces = (str: string) => {
  return (str == null ? "" : String(str))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
};

// 2. DYNAMIC DATE GENERATOR FOR EVALUATIONS
const getEvaluationDate = (monthYear: string) => {
  const dates: { [key: string]: string } = {
    "Maio 2026": "15/05/2026",
    "Abril 2026": "12/04/2026",
    "Março 2026": "18/03/2026",
    "Fevereiro 2026": "14/02/2026",
    "Janeiro 2026": "20/01/2026"
  };
  return dates[monthYear] || "10/06/2026";
};

// 3. SECURE EVIDENCE METADATA & CONTENT LOOKUP
interface EvidenceData {
  type: "IMAGE" | "PDF";
  title: string;
  desc: string;
  obsOk: string;
  obsNok: string;
  reasonNok: string;
  iconName: string;
}

const getEvidenceForCriterion = (cId: string): EvidenceData => {
  const data: { [key: string]: EvidenceData } = {
    "1": {
      type: "PDF",
      title: "inventario_rotativo_consolidado.pdf",
      desc: "Relatório técnico que atesta o grau de acuracidade na conferência física.",
      obsOk: "Controle patrimonial realizado com êxito. A amostragem física de itens selecionados condiz perfeitamente com os registros do ERP.",
      obsNok: "Planilha de inventário aponta discrepâncias entre o estoque físico e sistêmico em componentes mecânicos.",
      reasonNok: "Acuracidade geral aferida abaixo do limite de tolerância estabelecido pela comissão de qualidade corporativa (98%).",
      iconName: "picture_as_pdf"
    },
    "2": {
      type: "IMAGE",
      title: "inspecao_pecas_de_giro.jpg",
      desc: "Evidência fotográfica das prateleiras de alto giro do armário TOP 10.",
      obsOk: "Disponibilidade física e organização exemplar de todo o escopo de peças críticas. Etiquetagem e identificação perfeitas.",
      obsNok: "Alguns racks do setor TOP 10 continham peças desorganizadas e sem o código padrão exposto.",
      reasonNok: "Constatada a falta das etiquetas obrigatórias de identificação visual em 2 itens de alto giro.",
      iconName: "image"
    },
    "3": {
      type: "PDF",
      title: "controle_notas_entrada.pdf",
      desc: "Documento com o log de notas fiscais recebidas nas últimas 24 horas no ERP.",
      obsOk: "Processamento fiscal efetuado integralmente dentro do padrão regulamentar estabelecido (24h úteis).",
      obsNok: "Divergência de datas de processamento e notas arquivadas com atraso fiscal expressivo.",
      reasonNok: "Fornecimento de lubrificantes registrado no sistema com atraso superior a 72 horas em relação à entrega física.",
      iconName: "picture_as_pdf"
    },
    "4": {
      type: "IMAGE",
      title: "layout_e_organizacao_axial.jpg",
      desc: "Foto angular dos corredores e demarcações táticas de segurança do piso.",
      obsOk: "Organização impecável das vias de circulação técnica. Facilidade de trânsito e endereçamento completo das embalagens.",
      obsNok: "Caixas e resíduos de papelão bloqueando parcialmente um dos ramais secundários de estoque.",
      reasonNok: "Carga de reposição recebida no dia anterior foi deixada provisoriamente no corredor de emergência contra incêndio.",
      iconName: "image"
    },
    "5": {
      type: "PDF",
      title: "boletim_conferencia_cega.pdf",
      desc: "Log de conferência de mercadorias versus faturas sem dados prévios do fornecedor.",
      obsOk: "Boletim de conferência preenchido de forma exemplar e sem avarias técnicas registradas no material.",
      obsNok: "Ocorrência de conferência manual realizada sem a emissão ou arquivamento do boletim padrão no drive.",
      reasonNok: "Auditores constataram entrega recebida sem o anexo obrigatório da ficha física assinada de conferência cega.",
      iconName: "picture_as_pdf"
    },
    "6": {
      type: "IMAGE",
      title: "captura_unimobin_tablet.jpg",
      desc: "Interface mobile do Unimobin demonstrando a sincronização periódica de frotas.",
      obsOk: "Checklists fotográficos integrados atualizados. Total integração do módulo almoxarife com a plataforma móvel.",
      obsNok: "Preenchimento de formulários de vistoria em atraso no ambiente digital.",
      reasonNok: "Registrado atraso de 4 dias na vistoria diária compulsória de pneus e faróis de 2 veículos de manutenção preventiva.",
      iconName: "image"
    },
    "7": {
      type: "PDF",
      title: "relatorio_sla_atendimento.pdf",
      desc: "SLA (Service Level Agreement) de separação física e expedição para ordens internas.",
      obsOk: "Nível de serviço exemplar com tempo médio de atendimento de 28 minutos por ordem de serviço aberta.",
      obsNok: "Demora crônica identificada na entrega e separação de peças técnicas críticas requeridas pela oficina.",
      reasonNok: "Atraso no abastecimento de peças essenciais (Kit de Embreagem e Tambores) ultrapassou o limiar de 48 horas.",
      iconName: "picture_as_pdf"
    },
    "8": {
      type: "IMAGE",
      title: "requisicoes_digitalizadas.jpg",
      desc: "Documento digitalizado das requisições e assinaturas do almoxarifado corporativo.",
      obsOk: "Conformidade total no arquivo de requisições. Assinaturas de recebedores e requisitantes batem 100%.",
      obsNok: "Ausência de assinatura ou identificação do funcionário requisitante nas fichas do período.",
      reasonNok: "Identificadas 4 requisições do sistema sem as devidas assinaturas de próprio punho na ficha impressa arquivada.",
      iconName: "image"
    },
    "9": {
      type: "IMAGE",
      title: "garantia_e_sucata_organizada.jpg",
      desc: "Vista da gaiola de armazenagem de garantia Moura com identificação de tags técnicas.",
      obsOk: "Setor de garantia devidamente despoluído. Sucatas limpas, segregadas e etiquetadas prontas para devolução.",
      obsNok: "Área de sucatas com acúmulo desnecessário de baterias sem cobertura plástica e sem identificador.",
      reasonNok: "Peças aguardando perícia fabricante Moura estavam alocadas de forma indevida fora do pátio coberto.",
      iconName: "image"
    },
    "10": {
      type: "PDF",
      title: "relatorio_material_sem_giro.pdf",
      desc: "Dossiê sobre itens sem movimentação física e providências de alienação comercial.",
      obsOk: "Categorização preventiva de peças de frotas antigas em andamento. Destinação ecológica cadastrada.",
      obsNok: "Existência de estoque inativo imobilizando recursos sem nenhuma providência de alienação cadastrada.",
      reasonNok: "Armazenamento indevido de amortecedores e peças obsoletas no rack principal de alto tráfego sem plano de descarte.",
      iconName: "picture_as_pdf"
    }
  };

  return data[cId] || {
    type: "PDF",
    title: "relatorio_auditoria_geral.pdf",
    desc: "Detalhamento e notas operacionais de auditoria preventiva periódica.",
    obsOk: "Critério de auditoria preventiva operando no padrão exigido pelo Sistema de Auditoria do grupo.",
    obsNok: "Não conformidade técnica registrada devido ao descumprimento de prazos.",
    reasonNok: "Desvio aferido no checklist preventivo obrigatório.",
    iconName: "picture_as_pdf"
  };
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

const isSemestralMonth = (monthYear: string) => {
  const m = s(monthYear).toLowerCase();
  return m.includes("janeiro") || m.includes("junho") || m.includes("dezembro") || m.includes("semestral");
};

const getBranchCalendarForEntry = (branchId: string, monthYear: string, branchName: string | undefined, calendarData: any[] | undefined) => {
  const localCalendar = calendarData || [];

  const pts = s(monthYear).split(" ");
  const monthName = s(pts[0]).toLowerCase();
  const activeYearNum = parseInt(pts[1]) || 2026;
  const activeMonthNum = MONTH_NAME_TO_NUM[monthName] || 6;
  const activeSemestre = activeMonthNum <= 6 ? 1 : 2;

  const matchBranch = (almoxName: string, bId: string, bName?: string) => {
    const name = s(almoxName).toLowerCase().trim();
    const branchId = s(bId).toLowerCase().trim();
    
    const normAlmox = name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    const normId = branchId
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    let normName = "";
    if (bName) {
      normName = s(bName).toLowerCase()
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

const getScheduledInventoryDate = (branchName: string, monthYear: string, branchId: string | undefined, calendarData: any[] | undefined) => {
  const localCalendar = calendarData || [];

  const m = s(monthYear).toLowerCase();
  const isSem2 = m.includes("julho") || m.includes("agosto") || m.includes("setembro") || m.includes("outubro") || m.includes("novembro") || m.includes("dezembro");
  const sem = isSem2 ? 2 : 1;

  const item = localCalendar.find((c) => {
    if (branchId && c.branchId === branchId) return c.semestre === sem;
    const name = s(c.almoxarifado).toLowerCase().trim();
    const brName = s(branchName).toLowerCase().trim();
    const cleanAlmox = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const cleanBranch = brName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").replace("almoxarifado", "");
    return (cleanAlmox.includes(cleanBranch) || cleanBranch.includes(cleanAlmox)) && c.semestre === sem;
  });

  if (item && item.data_agendada) {
    const parts = item.data_agendada.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return item.data_agendada;
  }

  return sem === 1 ? "26/06/2026" : "27/11/2026";
};

const getMonthSortKey = (monthYearStr: string): number => {
  if (!monthYearStr) return 0;
  const str = String(monthYearStr).trim().toLowerCase();
  const monthsMap: Record<string, number> = {
    "janeiro": 1,
    "fevereiro": 2,
    "março": 3,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12
  };
  let mVal = 0;
  for (const [key, val] of Object.entries(monthsMap)) {
    if (str.includes(key)) {
      mVal = val;
      break;
    }
  }
  const yearMatch = str.match(/\d{4}/);
  const yearVal = yearMatch ? parseInt(yearMatch[0], 10) : 2026;
  return yearVal * 100 + mVal;
};

const getHistoryForBranch = (bId: string, historyList: any[]): AuditHistoryEntry[] => {
  const monthlyScoresMap: Record<string, number[]> = {
    "unitrans-jp": [],
    "santa-maria-jp": [],
    "expresso-nacional": [],
    "acandido-cg": [],
    "fretamento-goiana": [],
    "fretamento-jaboatao": [],
    "rodoviario-jaboatao": [],
    "unissana-rn": [],
    "reunidas-nat": [],
    "fretamento-pb": [],
    "trans-cg-bayeux": [],
    "rodoviario-cabedelo": [],
    "fretamento-maracanau": [],
    "rodoviario-fortaleza": [],
  };

  const savedEntries = Array.isArray(historyList) ? historyList.filter((h: any) => h.monthYear) : [];

  // Filter real entries that belong to this branch
  const realBranchEntries = savedEntries.filter((e) => e.branchId === bId);

  // Default simulated months - cleared to ensure start is empty
  const simulated: AuditHistoryEntry[] = [];

  const combined: AuditHistoryEntry[] = [];
  
  realBranchEntries.forEach((entry) => {
    let type: "Excelente" | "Alerta" | "Atenção" | "Bom" | "Avaliação Semestral" | "Mensal" = "Bom";
    if (entry.score >= 90) {
      type = "Excelente";
    } else if (entry.score >= 80) {
      type = "Bom";
    } else if (entry.score >= 70) {
      type = "Atenção";
    } else {
      type = "Alerta";
    }

    combined.push({
      id: entry.id,
      monthYear: entry.monthYear,
      type,
      score: entry.score,
      nokItems: entry.nokItems || [],
      criteriaState: entry.criteriaState || [],
      branchId: entry.branchId,
      auditedDetails: entry.auditedDetails || "Ciclo encerrado e enviado à auditoria pelo usuário."
    });
  });

  simulated.forEach((sim) => {
    const isOverwritten = combined.some((e) => e.monthYear === sim.monthYear);
    if (!isOverwritten) {
      combined.push(sim);
    }
  });

  combined.sort((a, b) => getMonthSortKey(a.monthYear) - getMonthSortKey(b.monthYear));

  return combined;
};

export default function AdminHistory({ user, branches, calendarData }: AdminHistoryProps) {
  useRealtimeSync();
  // If user is Admin, they can select any of the 13 warehouses. If Almoxarife, it is locked to their active branch.
  const userBranches = branches.filter((b) => b.ownerName === user.ownerName);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (user.role === "ALMOXARIFE") {
      return userBranches[0]?.id || branches[0].id;
    }
    return branches[0].id;
  });

  const [editedSummaries, setEditedSummaries] = useState<Record<string, string>>({});
  const [editedConclusions, setEditedConclusions] = useState<Record<string, string>>({});

  const [rawHistoryList, setRawHistoryList] = useState<any[]>([]);

  useEffect(() => {
    const loadAdminHist = async () => {
      if (isSupabaseReady()) {
        try {
          const dbHistory = await dbFetchHistory();
          if (dbHistory) {
            setRawHistoryList(dbHistory);
            return;
          }
        } catch (e) {
          console.error("Failed to load history list in AdminHistory:", e);
        }
      }
      setRawHistoryList([]);
    };
    loadAdminHist();
    window.addEventListener("realtime-historico-update", loadAdminHist);
    window.addEventListener("storage", loadAdminHist);
    return () => {
      window.removeEventListener("realtime-historico-update", loadAdminHist);
      window.removeEventListener("storage", loadAdminHist);
    };
  }, []);

  const [historyList, setHistoryList] = useState<AuditHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditHistoryEntry | null>(null);

  const onAlmoxarifadoChange = useCallback(async (almoxarifadoId: string) => {
    setHistoryList([]);
    setIsHistoryLoading(true);
    setSelectedEntry(null);

    // Simulate async database/network search
    await new Promise((resolve) => setTimeout(resolve, 600));

    const data = getHistoryForBranch(almoxarifadoId, rawHistoryList);
    setHistoryList(data);
    setIsHistoryLoading(false);
  }, [rawHistoryList]);

  useEffect(() => {
    if (selectedBranchId) {
      onAlmoxarifadoChange(selectedBranchId);
    }
  }, [selectedBranchId, onAlmoxarifadoChange]);

  // Expanded criterion row inside details table
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(null);

  // Active Lightbox for evidence fullscreen mock
  const [activeLightbox, setActiveLightbox] = useState<{
    type: "IMAGE" | "PDF";
    title: string;
    desc: string;
    cId: string;
    status: "OK" | "NOK";
  } | null>(null);

  // PDF simulated generation state
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const groupAIds = [
    "unitrans-jp",
    "santa-maria-jp",
    "expresso-nacional",
    "acandido-cg",
    "fretamento-jaboatao",
    "rodoviario-jaboatao",
    "fretamento-goiana"
  ];

  const groupBIds = [
    "unissana-rn",
    "reunidas-nat",
    "fretamento-pb",
    "trans-cg-bayeux",
    "rodoviario-cabedelo",
    "fretamento-maracanau",
    "rodoviario-fortaleza"
  ];

  const getBranchDisplayName = (id: string, defaultName: string, ownerName: string) => {
    switch (id) {
      case "unitrans-jp": return `Unitrans JP (${ownerName})`;
      case "santa-maria-jp": return `Santa Maria JP (${ownerName})`;
      case "expresso-nacional": return `Trans CG (${ownerName})`;
      case "acandido-cg": return `A.Cândido CG (${ownerName})`;
      case "fretamento-jaboatao": return `Fretamento Jaboatão (${ownerName})`;
      case "rodoviario-jaboatao": return `Rodoviário Jaboatão (${ownerName})`;
      case "fretamento-goiana": return `Fretamento Goiana (${ownerName})`;
      case "unissana-rn": return `Unissanta RN (${ownerName})`;
      case "reunidas-nat": return `Reunidas Transportes NAT (${ownerName})`;
      case "fretamento-pb": return `Fretamento PB (${ownerName})`;
      case "trans-cg-bayeux": return `Trans CG Bayeux (${ownerName})`;
      case "rodoviario-cabedelo": return `Rodoviário Cabedelo (${ownerName})`;
      case "fretamento-maracanau": return `Fretamento Maracanau (${ownerName})`;
      case "rodoviario-fortaleza": return `Rodoviário Fortaleza (${ownerName})`;
      default: return `${defaultName} (${ownerName})`;
    }
  };

  const orderedGroupA = groupAIds
    .map(id => branches.find(b => b.id === id))
    .filter(Boolean) as Branch[];

  const orderedGroupB = groupBIds
    .map(id => branches.find(b => b.id === id))
    .filter(Boolean) as Branch[];

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "Excelente":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Bom":
      case "Mensal":
      case "Meta Cumprida":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "Atenção":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Alerta":
      case "Crítico":
        return "bg-red-50 text-red-700 border-red-200";
      case "Avaliação Semestral":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getCriteriaForHistory = (score: number, nokItems: string[], savedCriteriaState?: any[]) => {
    if (savedCriteriaState && Array.isArray(savedCriteriaState) && savedCriteriaState.length > 0) {
      return savedCriteriaState.map((c: any) => {
        const isNok = c.status === "NOK";
        return {
          id: c.id,
          name: c.name,
          recurrence: (c.id === "1" || c.id === "10") ? ("Semestral" as const) : ("Mensal" as const),
          pointsPossible: c.pointsPossible ?? 10,
          status: c.status === "OK" ? ("OK" as const) : ("NOK" as const),
          pointsObtained: c.pointsObtained !== undefined ? c.pointsObtained : (c.score !== undefined ? c.score : (c.status === "OK" ? (c.pointsPossible ?? 10) : 0)),
          notes: c.notes || c.evidenceNotes || "Avaliado pelo auditor.",
          nokEvidenceLink: (c.nokEvidenceLink && typeof c.nokEvidenceLink === "string" && !c.nokEvidenceLink.includes("mock-nok-folder") && c.nokEvidenceLink.trim() !== "") ? c.nokEvidenceLink : undefined,
          nokEvidenceLinks: Array.isArray(c.nokEvidenceLinks) ? c.nokEvidenceLinks.filter((l: any) => typeof l === "string" && l.trim() !== "" && !l.includes("mock-nok-folder")) : undefined,
          nokEvidenceDescription: c.nokEvidenceDescription ?? (isNok ? `Inconformidade histórica registrada e validada no escopo do critério de ${c.name}.` : undefined),
          nokEvidenceFileName: c.nokEvidenceFileName,
          nokEvidenceFileType: c.nokEvidenceFileType,
          nokEvidenceFileData: c.nokEvidenceFileData
        };
      });
    }

    const normalizedNok = nokItems.map((item) => removeAccentsAndSpaces(item));

    const baseCriteria = [
      { id: "1", name: "Inventário", recurrence: "Semestral" as const, pointsPossible: 20 },
      { id: "2", name: "TOP 10", recurrence: "Mensal" as const, pointsPossible: 20 },
      { id: "3", name: "Nota Fiscal", recurrence: "Mensal" as const, pointsPossible: 10 },
      { id: "4", name: "LayOut", recurrence: "Mensal" as const, pointsPossible: 10 },
      { id: "5", name: "Recebimento de Material", recurrence: "Mensal" as const, pointsPossible: 10 },
      { id: "6", name: "Curso Unimobin", recurrence: "Mensal" as const, pointsPossible: 10 },
      { id: "7", name: "Nível de Serviço", recurrence: "Mensal" as const, pointsPossible: 5 },
      { id: "8", name: "Registro de Requisições", recurrence: "Mensal" as const, pointsPossible: 5 },
      { id: "9", name: "Controle de Garantia", recurrence: "Mensal" as const, pointsPossible: 5 },
      { id: "10", name: "Material Sem Movimentação", recurrence: "Semestral" as const, pointsPossible: 5 }
    ];

    const criteriaWithStatus = baseCriteria.map((c) => {
      const isNok = normalizedNok.some((nok) => {
        const normalizedName = removeAccentsAndSpaces(c.name);
        return normalizedName.includes(nok) || nok.includes(normalizedName);
      });

      const status = isNok ? ("NOK" as const) : ("OK" as const);
      const pointsObtained = status === "OK" ? c.pointsPossible : 0;

      const nokEvidenceLink = undefined;
      const nokEvidenceDescription = isNok ? `Inconformidade histórica registrada e validada no escopo do critério de ${c.name}.` : undefined;

      return {
        ...c,
        status,
        pointsObtained,
        nokEvidenceLink,
        nokEvidenceDescription,
        nokEvidenceFileName: undefined as string | undefined,
        nokEvidenceFileType: undefined as string | undefined,
        nokEvidenceFileData: undefined as string | undefined
      };
    });

    return criteriaWithStatus;
  };

  const getChronologicalHistory = (list: AuditHistoryEntry[]) => {
    return [...list].sort((a, b) => getMonthSortKey(a.monthYear) - getMonthSortKey(b.monthYear));
  };

  const buildAutomaticResumoExecutivo = (entry: AuditHistoryEntry) => {
    const crits = getCriteriaForHistory(entry.score, entry.nokItems, entry.criteriaState);
    const score = crits.reduce((sum, c) => sum + c.pointsObtained, 0);
    const maxPoints = crits.reduce((sum, c) => sum + c.pointsPossible, 0);
    const listOK = crits.filter(c => c.status === "OK");
    const listNOK = crits.filter(c => c.status === "NOK");

    const okStr = listOK.map(c => `${c.name === "LayOut" ? "Layout" : c.name} (${c.pointsPossible} pts)`).join(", ");
    const nokStr = listNOK.map(c => `${c.name === "LayOut" ? "Layout" : c.name} (0 pts)`).join(", ");

    const sortedList = getChronologicalHistory(historyList);
    const currentIndex = sortedList.findIndex(e => e.id === entry.id);
    const preceding = currentIndex !== -1 ? sortedList.slice(0, currentIndex) : [];
    const lastThree = preceding.slice(-3);

    let tendencyLine = "";
    if (lastThree.length === 3) {
      const adj1 = getCriteriaForHistory(lastThree[0].score, lastThree[0].nokItems, lastThree[0].criteriaState).reduce((sum, c) => sum + c.pointsObtained, 0);
      const adj2 = getCriteriaForHistory(lastThree[1].score, lastThree[1].nokItems, lastThree[1].criteriaState).reduce((sum, c) => sum + c.pointsObtained, 0);
      const adj3 = getCriteriaForHistory(lastThree[2].score, lastThree[2].nokItems, lastThree[2].criteriaState).reduce((sum, c) => sum + c.pointsObtained, 0);

      let trend = "estabilidade";
      if (adj3 > adj1) {
        trend = "melhora";
      } else if (adj3 < adj1) {
        trend = "queda";
      }

      tendencyLine = `Nos últimos três meses o almoxarifado registrou ${adj1}, ${adj2} e ${adj3} pts respectivamente, indicando ${trend} no desempenho operacional.`;
    } else if (lastThree.length === 2) {
      const adj1 = getCriteriaForHistory(lastThree[0].score, lastThree[0].nokItems, lastThree[0].criteriaState).reduce((sum, c) => sum + c.pointsObtained, 0);
      const adj2 = getCriteriaForHistory(lastThree[1].score, lastThree[1].nokItems, lastThree[1].criteriaState).reduce((sum, c) => sum + c.pointsObtained, 0);
      const trend = adj2 > adj1 ? "melhora" : adj2 < adj1 ? "queda" : "estabilidade";
      tendencyLine = `Nos últimos dois meses o almoxarifado registrou ${adj1} e ${adj2} pts respectivamente, indicando ${trend} no desempenho operacional.`;
    } else if (lastThree.length === 1) {
      const adj1 = getCriteriaForHistory(lastThree[0].score, lastThree[0].nokItems, lastThree[0].criteriaState).reduce((sum, c) => sum + c.pointsObtained, 0);
      tendencyLine = `No mês anterior o almoxarifado registrou ${adj1} pts, indicando desempenho operacional estável.`;
    } else {
      tendencyLine = `Nos meses anteriores o almoxarifado não possuía registros suficientes, estabelecendo esta avaliação como linha de base para análises de tendência futuras.`;
    }

    // Ranking position
    const groupBranchesWithScores = branches
      .filter((b) => b.group === activeBranch.group)
      .map((b) => ({
        id: b.id,
        semestralScore: getHistoryForBranch(b.id, rawHistoryList).reduce((sum, h) => {
          return sum + getCriteriaForHistory(h.score, h.nokItems, h.criteriaState).reduce((acc, c) => acc + c.pointsObtained, 0);
        }, 0)
      }))
      .sort((a, b) => b.semestralScore - a.semestralScore);

    const rankIndex = groupBranchesWithScores.findIndex((b) => b.id === activeBranch.id);
    const posNumber = rankIndex !== -1 ? rankIndex + 1 : 1;
    const groupLabel = activeBranch.group === "A" ? "Grupo A" : "Grupo B";
    const rankPos = `${posNumber}º lugar`;
    const accumulatedPoints = groupBranchesWithScores.find(b => b.id === activeBranch.id)?.semestralScore || activeBranch.semestralScore;

    let text = `RESUMO EXECUTIVO OPERACIONAL\n`;
    text += `${activeBranch.name} — ${entry.monthYear}\n`;
    text += `Responsável: ${activeBranch.ownerName}\n\n`;
    text += `A auditoria preventiva de ${entry.monthYear} registrou ${score} pts de um máximo de ${maxPoints} pts auditáveis no período, com ${listOK.length} critérios em conformidade e ${listNOK.length} em não conformidade.\n\n`;
    text += `Critérios aprovados: ${okStr}\n\n`;
    if (listNOK.length > 0) {
      text += `Critérios não conformes: ${nokStr}\n\n`;
    }
    text += `${tendencyLine}\n\n`;
    text += `Posição atual no Ranking ${groupLabel}: ${rankPos} com ${accumulatedPoints} pts acumulados no semestre.`;

    return text;
  };

  const buildAutomaticConclusion = (entry: AuditHistoryEntry) => {
    const crits = getCriteriaForHistory(entry.score, entry.nokItems, entry.criteriaState);
    const score = crits.reduce((sum, c) => sum + c.pointsObtained, 0);
    const listNOK = crits.filter(c => c.status === "NOK");

    let conclusionText = "";
    if (score >= 90) {
      conclusionText = `A auditoria de ${entry.monthYear} do almoxarifado ${activeBranch.name} evidenciou excelente nível de conformidade operacional. O almoxarifado atingiu ${score} pts, demonstrando consistência nos processos de controle, organização e gestão de estoques. A manutenção deste padrão contribui diretamente para os resultados do Grupo A.Cândido.`;
    } else if (score >= 75) {
      conclusionText = `A auditoria de ${entry.monthYear} do almoxarifado ${activeBranch.name} resultou em ${score} pts, indicando desempenho satisfatório com oportunidades pontuais de melhoria. Os critérios aprovados demonstram solidez nos processos fundamentais, enquanto os critérios não conformes requerem atenção para recuperação da pontuação nos próximos ciclos.`;
    } else if (score >= 60) {
      conclusionText = `A auditoria de ${entry.monthYear} do almoxarifado ${activeBranch.name} registrou ${score} pts, desempenho regular que requer atenção imediata. A quantidade de não conformidades identificadas impacta diretamente a posição no ranking semestral e deve ser tratada com prioridade nas próximas semanas.`;
    } else {
      conclusionText = `A auditoria de ${entry.monthYear} do almoxarifado ${activeBranch.name} registrou ${score} pts, resultado abaixo do esperado e que exige ação corretiva imediata. O número de não conformidades identificadas compromete o desempenho semestral e a qualificação mínima de 300 pts exigida pela gestão.`;
    }

    let recsText = "";
    if (listNOK.length > 0) {
      recsText = listNOK.map(c => `- ${c.name === "LayOut" ? "Layout" : c.name}: ${planosDeAcao[c.name] || ""}`).join("\n");
    } else {
      recsText = "Não há recomendações corretivas para este período. Recomenda-se manter os controles operacionais em vigor e sustentar o padrão de conformidade alcançado.";
    }

    let template = `CONCLUSÃO\n\n`;
    template += `${conclusionText}\n\n`;
    template += `RECOMENDAÇÕES\n\n`;
    template += `${recsText}`;

    return template;
  };

  const handleExportPDF = () => {
    if (!selectedEntry) return;
    setIsExporting(true);

    try {
        const crits = getCriteriaForHistory(selectedEntry.score, selectedEntry.nokItems, selectedEntry.criteriaState);
        const score = crits.reduce((sum, c) => sum + c.pointsObtained, 0);
        const okList = crits.filter(c => c.status === "OK");
        const okCount = okList.length;
        const nokList = crits.filter(c => c.status === "NOK");
        const nokCount = nokList.length;

        const currentSummary = buildAutomaticResumoExecutivo(selectedEntry);
        const currentConclusion = buildAutomaticConclusion(selectedEntry);
        const evaluationDate = getEvaluationDate(selectedEntry.monthYear);

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

        // Institutional Header Banner
        doc.setFillColor(27, 42, 74); // #1B2A4A
        doc.rect(15, y, 180, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(12);
        doc.text("A. CÂNDIDO GRUPO", 20, y + 7);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(226, 232, 240);
        doc.text("Gestão de Conformidade e Auditoria", 20, y + 12);

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
        doc.text(activeBranch.ownerName, 70, y + 12);
        doc.text(selectedEntry.monthYear, 120, y + 12);
        doc.text(`${evaluationDate} (Vistoria)`, 160, y + 12);

        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Ref ID: ACD-AUD-2026-${selectedBranchId.toUpperCase().slice(0, 4)}-${selectedEntry.monthYear.toUpperCase().replace(/\s/g, "")}`, 20, y + 19);
        y += 28;

        // 1. Resumo Executivo Operacional
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

        // 2. Checklist Geral de Auditoria (10 Critérios)
        checkPage(25);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(27, 42, 74);
        doc.text("2. Checklist Geral de Auditoria (10 Critérios)", 15, y);
        y += 2;
        doc.setDrawColor(27, 42, 74);
        doc.line(15, y, 195, y);
        y += 4;

        // Table Header in Institutional Navy
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
          doc.text(c.name === "LayOut" ? "Layout" : c.name, 25, y + 5);
          doc.text(c.recurrence, 90, y + 5);
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

        // Total row
        checkPage(10);
        doc.setDrawColor(226, 232, 240);
        doc.line(15, y, 195, y);
        doc.setFillColor(241, 245, 249);
        doc.rect(15, y, 180, 8, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(`PONTUAÇÃO ACUMULADA — ${score} pts referente ao relatório de auditoria`, 18, y + 5.5);
        y += 14;

        // 3. Conformidades Identificadas
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
            doc.text(`[OK] ${c.name === "LayOut" ? "Layout" : c.name} (${c.pointsPossible} pts)`, cx + 3, cy + 5);
          });
          y = cy + 14;
        } else {
          doc.setFont("Helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text("Nenhum processo em conformidade.", 15, y);
          y += 10;
        }

        // 4. Não Conformidades Registradas
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
            const evidence = getEvidenceForCriterion(c.id);
            const actionText = planosDeAcao[c.name] || "";

            checkPage(26);
            doc.setFillColor(254, 242, 242);
            doc.setDrawColor(254, 226, 226);
            doc.rect(15, y, 180, 22, "FD");

            doc.setFont("Helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(153, 27, 27);
            doc.text(`${c.name === "LayOut" ? "Layout" : c.name} (0 / ${c.pointsPossible} pts)`, 18, y + 4.5);

            doc.setFont("Helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(127, 29, 29);
            
            const desvioText = c.nokEvidenceDescription ? `Desvio: ${c.nokEvidenceDescription}` : `Desvio: ${evidence.reasonNok}`;
            doc.text(doc.splitTextToSize(desvioText, 172)[0] || "", 18, y + 9);
            
            const validPdfLinks = Array.isArray((c as any).nokEvidenceLinks)
              ? (c as any).nokEvidenceLinks.filter((l: string) => typeof l === "string" && l.trim() !== "" && !l.includes("mock-nok-folder"))
              : [];
            const singlePdfLink = (c as any).nokEvidenceLink && typeof (c as any).nokEvidenceLink === "string" && !(c as any).nokEvidenceLink.includes("mock-nok-folder") && (c as any).nokEvidenceLink.trim() !== "" ? (c as any).nokEvidenceLink : null;
            const linksStr = validPdfLinks.length > 0 
              ? `Evidências: ${validPdfLinks.join(" | ")}` 
              : (singlePdfLink ? `Evidência: ${singlePdfLink}` : `Nota: "${evidence.obsNok}"`);
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

        // 5. Conclusão e Recomendações
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

        // 6. Histórico Consolidado dos Ciclos Anteriores
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

        historyList.forEach((h) => {
          const isJanOrJul = (h.monthYear == null ? "" : String(h.monthYear)).toLowerCase().includes("janeiro") || (h.monthYear == null ? "" : String(h.monthYear)).toLowerCase().includes("julho");
          const filteredNok = h.nokItems.filter(item => {
            if (item === "Inventário") {
              return isJanOrJul;
            }
            return true;
          });

          checkPage(7);
          doc.setDrawColor(226, 232, 240);
          doc.line(15, y, 195, y);

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(h.monthYear, 18, y + 5);
          let pdfType = h.type;
          if (pdfType === "Avaliação Semestral" || pdfType === "Mensal" || !pdfType) {
            if (h.score >= 90) pdfType = "Excelente";
            else if (h.score >= 80) pdfType = "Bom";
            else if (h.score >= 70) pdfType = "Atenção";
            else pdfType = "Alerta";
          }
          doc.text(pdfType, 55, y + 5);
          doc.text(`${h.score} pts`, 95, y + 5);

          if (filteredNok.length > 0) {
            doc.setTextColor(185, 28, 28);
            doc.text(filteredNok.join(", "), 125, y + 5);
          } else {
            doc.setTextColor(21, 128, 61);
            doc.text("Nenhum desvio registrado", 125, y + 5);
          }
          y += 6;
        });
        y += 12;

        // Signatures block
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

        const filename = `relatorio_${sanitizeName(activeBranch.name)}_${sanitizeName(selectedEntry.monthYear)}.pdf`;
        doc.save(filename);

        setIsExporting(false);
        setToastMessage(`Relatório em PDF de ${selectedEntry.monthYear} para o ${activeBranch.name} exportado com sucesso!`);
        setTimeout(() => {
          setToastMessage(null);
        }, 4000);

      } catch (err) {
        console.error("PDF generation failed:", err);
        setIsExporting(false);
      }
  };

  // ----------------------------------------------------
  // FULL DETAILED MONTHLY VIEW IMPLEMENTATION (REPLACES TIMELINE GRID)
  // ----------------------------------------------------
  if (selectedEntry) {
    const criteriaList = getCriteriaForHistory(selectedEntry.score, selectedEntry.nokItems, selectedEntry.criteriaState);
    const score = criteriaList.reduce((sum, c) => sum + c.pointsObtained, 0);

    const okList = criteriaList.filter(c => c.status === "OK");
    const okCount = okList.length;
    const nokList = criteriaList.filter(c => c.status === "NOK");
    const nokCount = nokList.length;

    let statusLabel = "Meta Cumprida";
    let badgeClass = "bg-teal-500 text-white";

    if (score >= 90) {
      statusLabel = "Excelente";
      badgeClass = "bg-emerald-600 text-white";
    } else if (score >= 80) {
      statusLabel = "Meta Cumprida";
      badgeClass = "bg-emerald-500 text-white";
    } else if (score >= 70) {
      statusLabel = "Atenção";
      badgeClass = "bg-amber-500 text-slate-900";
    } else {
      statusLabel = "Alerta";
      badgeClass = "bg-rose-500 text-white";
    }

    const evaluationDate = getEvaluationDate(selectedEntry.monthYear);

    const currentSummary = buildAutomaticResumoExecutivo(selectedEntry);
    const currentConclusion = buildAutomaticConclusion(selectedEntry);

    return (
      <div className="space-y-6">
        {/* Print Styles Injected Dynamically */}
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

        {/* Floating Simulated Toast Notification */}
        {toastMessage && (
          <div className="no-print fixed top-24 left-1/2 -translate-x-1/2 md:right-8 md:left-auto md:translate-x-0 z-50 bg-[#16a34a] text-white py-3 px-5 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <p className="text-xs font-black tracking-wide">{toastMessage}</p>
          </div>
        )}

        {/* Header Action Row */}
        <div className="no-print flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              setSelectedEntry(null);
              setExpandedCriterionId(null);
            }}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-250 text-[#1B2A4A] hover:text-[#C8A84B] font-extrabold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px] font-bold">arrow_back</span>
            <span>Voltar ao Histórico</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportPDF}
            className={`px-4 py-2 ${
              isExporting ? "bg-slate-300 pointer-events-none" : "bg-[#1B2A4A] hover:bg-[#1E3A6B]"
            } text-white font-extrabold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95`}
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
                <span>Exportar PDF</span>
              </>
            )}
          </button>
        </div>

        {/* COMPREHENSIVE EXECUTIVE AUDIT DOCUMENT REPORT PANEL */}
        <div id="audit-report-printable" className="print-container bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm text-[#0F172A] font-sans">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-[#1B2A4A] pb-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1B2A4A] tracking-wider font-sans uppercase">
                A. CÂNDIDO GRUPO
              </h1>
              <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1">
                Gestão de Conformidade e Auditoria
              </p>
            </div>
            <div className="text-left sm:text-right">
              <h2 className="text-lg sm:text-xl font-black text-[#1B2A4A] uppercase tracking-normal">
                Relatório de Auditoria Preventiva
              </h2>
              <p className="text-xs text-slate-400 font-mono font-bold mt-1">
                Ref ID: ACD-AUD-2026-{selectedBranchId.toUpperCase().slice(0, 4)}-{selectedEntry.monthYear.toUpperCase().replace(/\s/g, "")}
              </p>
            </div>
          </div>

          {/* Card de Identificação (Histórico Detalhado) */}
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                Histórico Detalhado — {selectedEntry.monthYear}
              </span>
              <h2 className="text-2xl font-black text-[#1B2A4A] tracking-tight">
                {activeBranch.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-bold">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-slate-400 text-[14px]">person</span>
                  Responsável: <strong className="text-slate-700">{activeBranch.ownerName}</strong>
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-slate-400 text-[14px]">map</span>
                  Local: <strong className="text-slate-700">{activeBranch.location}</strong>
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-slate-400 text-[14px]">event_available</span>
                  Avaliação: <strong className="text-slate-700">{evaluationDate}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-xl shrink-0 self-start md:self-auto shadow-3xs">
              <div className="text-right">
                <p className="text-[9px] text-[#C8A84B] font-black uppercase font-mono tracking-widest">Resultado</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-mono font-black text-[#1B2A4A]">{score}</span>
                  <span className="text-xs font-semibold text-slate-400">/100 pts</span>
                </div>
              </div>
              <div className="h-10 w-px bg-slate-300"></div>
              <div>
                <p className="text-[9px] text-[#C8A84B] font-black uppercase font-mono tracking-widest">Classificação</p>
                <span className={`inline-block px-3 py-1 mt-1 text-xs font-black uppercase tracking-wider rounded ${badgeClass}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div className="mt-8 space-y-3">
            <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] uppercase tracking-wider border-b-2 border-[#1B2A4A]/20 pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#1B2A4A]">description</span>
              1. Resumo Executivo Operacional
            </h3>
            <div className="bg-slate-50/90 border border-slate-200 border-l-4 border-l-[#1B2A4A] p-5 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans mt-3 shadow-xs">
              {currentSummary}
            </div>
          </div>

          {/* Section 2: Full Interactive Checklist Table */}
          <div className="mt-8 space-y-3">
            <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] uppercase tracking-wider border-b-2 border-[#1B2A4A]/20 pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#1B2A4A]">fact_check</span>
              2. Checklist de Auditoria Preventiva (10 Critérios Consolidados)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl mt-3 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#1B2A4A] text-white text-xs font-black uppercase tracking-wider">
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Critério Operacional</th>
                    <th className="py-3 px-4 text-center">Frequência</th>
                    <th className="py-3 px-4 text-center">Pontos Possíveis</th>
                    <th className="py-3 px-4 text-center">Pontos Obtidos</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Data Avaliação</th>
                    <th className="py-3 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {criteriaList.map((c) => {
                    const isExpanded = expandedCriterionId === c.id;
                    const evidence = getEvidenceForCriterion(c.id);

                    return (
                      <React.Fragment key={c.id}>
                        {/* Base Row */}
                        <tr
                          onClick={() => setExpandedCriterionId(isExpanded ? null : c.id)}
                          className={`border-b border-slate-150 hover:bg-slate-50/75 transition-colors cursor-pointer ${
                            isExpanded ? "bg-slate-50/50" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-black text-slate-400">
                            {c.id.padStart(2, "0")}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#1B2A4A]">
                            {c.name === "LayOut" ? "Layout" : c.name}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-500">
                            {c.recurrence}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono font-semibold">
                            {c.pointsPossible} pts
                          </td>
                          <td className={`py-3 px-4 text-center font-mono font-black ${
                            c.status === "OK" ? "text-emerald-700" : "text-rose-600"
                          }`}>
                            {c.pointsObtained} pts
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className={`inline-block px-2.5 py-1 rounded text-xs font-black ${
                                c.status === "OK"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}>
                                {c.status}
                              </span>
                              {c.status === "NOK" && (
                                <div className="flex flex-wrap gap-1.5 items-center justify-start font-sans">
                                  {c.nokEvidenceLinks && c.nokEvidenceLinks.length > 0 ? (
                                    c.nokEvidenceLinks.map((link: string, lIdx: number) => (
                                      <a
                                        key={lIdx}
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded font-black transition-all shadow-3xs"
                                      >
                                        <span>🔗 Ver evidência {lIdx + 1}</span>
                                      </a>
                                    ))
                                  ) : (c.nokEvidenceLink || c.nokEvidenceFileData) ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (c.nokEvidenceFileData) {
                                          const newTab = window.open();
                                          if (newTab) {
                                            newTab.document.write(
                                              `<html><head><title>Visualizar Evidência - NOK</title></head>` +
                                              `<body style="margin: 0; display: flex; align-items: center; justify-content: center; background: #333; font-family: sans-serif;">` +
                                              `${c.nokEvidenceFileType?.startsWith("image/") 
                                                  ? `<img src="${c.nokEvidenceFileData}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" />`
                                                  : `<iframe src="${c.nokEvidenceFileData}" width="100%" height="100%" style="border: none;"></iframe>`
                                               }` +
                                              `</body></html>`
                                            );
                                            newTab.document.close();
                                          }
                                        } else if (c.nokEvidenceLink) {
                                          window.open(c.nokEvidenceLink, "_blank", "noopener,noreferrer");
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 text-xs bg-rose-100/60 hover:bg-rose-100/90 text-rose-800 border border-[#F7C1C1] px-2.5 py-1 rounded font-black transition-all shadow-3xs"
                                    >
                                      <span>📎 Ver evidência</span>
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono font-semibold">
                            {evaluationDate}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="material-symbols-outlined text-slate-400 text-[18px] select-none">
                              {isExpanded ? "expand_less" : "expand_more"}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Section Details */}
                        {isExpanded && (
                          <tr className="bg-slate-50/30 border-b border-slate-200/60 font-sans">
                            <td colSpan={8} className="py-4 px-6">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Columns (Details/Remarks) */}
                                <div className="lg:col-span-2 space-y-3">
                                  <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      Observação do Auditor
                                    </h4>
                                    <p className="text-xs text-slate-600 leading-relaxed mt-1 italic">
                                      "{c.status === "OK" ? evidence.obsOk : evidence.obsNok}"
                                    </p>
                                  </div>

                                  {c.status === "NOK" && (
                                    <div className="p-3 bg-rose-50 border border-rose-150/40 rounded-xl">
                                      <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-rose-700 text-[14px]">announcement</span>
                                        Motivo Registrado para Inconformidade:
                                      </h5>
                                      <p className="text-xs text-rose-950 font-medium leading-normal mt-1">
                                        {evidence.reasonNok}
                                      </p>
                                    </div>
                                  )}

                                  {(() => {
                                    if (c.id !== "1" || !selectedEntry) return null;
                                    const bObj = branches.find(b => b.id === selectedEntry.branchId);
                                    const calItems = getBranchCalendarForEntry(selectedEntry.branchId, selectedEntry.monthYear, bObj?.name, calendarData);
                                    if (calItems.length === 0) return null;

                                    return (
                                      <div className="mt-4 p-3 bg-white border border-slate-200/60 rounded-xl space-y-2 select-text">
                                        <h5 className="text-[10px] font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1.5">
                                          <span className="material-symbols-outlined text-[#C8A84B] text-[14px]">calendar_month</span>
                                          Detalhamento dos Inventários Agendados
                                        </h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                          {calItems.map((item, idx) => {
                                            const itemStatus = item.status || "PENDENTE";
                                            const dateFormatted = item.data_agendada 
                                              ? item.data_agendada.split("-").reverse().join("/")
                                              : "--/--/----";
                                            
                                            let badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                                            if (itemStatus === "OK") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                            if (itemStatus === "NOK") badgeColor = "bg-rose-50 text-rose-700 border-rose-200";

                                            return (
                                              <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-100/85 rounded-lg text-xs flex flex-col gap-1.5 shadow-3xs">
                                                <div className="flex items-center justify-between">
                                                  <div>
                                                    <span className="text-[10px] font-extrabold text-slate-600 block">
                                                      Inventário Semestral #{idx + 1}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-mono">
                                                      Agendado: {dateFormatted}
                                                    </span>
                                                  </div>
                                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border leading-none ${badgeColor}`}>
                                                    {itemStatus}
                                                  </span>
                                                </div>

                                                {itemStatus === "NOK" && item.nokEvidenceLink && typeof item.nokEvidenceLink === "string" && !item.nokEvidenceLink.includes("mock-nok-folder") && item.nokEvidenceLink.trim() !== "" && (
                                                  <div className="bg-white border border-rose-100 rounded p-1.5 text-[9px] text-rose-800 flex flex-col gap-1">
                                                    <span className="font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1 leading-none">
                                                      <span className="material-symbols-outlined text-[11px] leading-none text-rose-600 font-bold">link</span>
                                                      <span>Evidência:</span>
                                                    </span>
                                                    <a
                                                      href={item.nokEvidenceLink}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-indigo-600 hover:text-indigo-850 hover:underline font-black truncate block"
                                                    >
                                                      {item.nokEvidenceLink} ↗
                                                    </a>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Right Column (Visual Evidence Thumbnail) */}
                                <div className="space-y-1.5">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Evidência Digital Anexada
                                  </h4>
                                  
                                  <div
                                    onClick={() => setActiveLightbox({
                                      type: evidence.type,
                                      title: evidence.title,
                                      desc: evidence.desc,
                                      cId: c.id,
                                      status: c.status
                                    })}
                                    className="group relative bg-white border border-slate-200 p-3 rounded-xl shadow-xs hover:border-[#1B2A4A] cursor-pointer transition-all hover:shadow-md flex items-center gap-3"
                                  >
                                    {/* Thumbnail Preview Area */}
                                    <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${
                                      evidence.type === "PDF" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                                    }`}>
                                      <span className="material-symbols-outlined text-[28px]">
                                        {evidence.iconName}
                                      </span>
                                    </div>

                                    <div className="overflow-hidden flex-1">
                                      <p className="text-xs font-black text-[#1B2A4A] truncate">
                                        {evidence.title}
                                      </p>
                                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                        {evidence.type} • Clique para ampliar
                                      </p>
                                    </div>

                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-[#1B2A4A] text-[20px]">
                                      zoom_in
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                    <td colSpan={3} className="py-3 px-4 text-right text-slate-600">PONTUAÇÃO ACUMULADA:</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">100 pts</td>
                    <td className={`py-3 px-4 text-center font-mono text-sm ${score >= 80 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {score} pts
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded text-xs uppercase font-black tracking-wider ${
                        score >= 80 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      }`}>
                        {score >= 80 ? "QUALIFICADO" : "EM ALERTA"}
                      </span>
                    </td>
                    <td colSpan={2} className="py-3 px-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 3: Conformidades */}
            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-black text-emerald-800 uppercase tracking-wider border-b-2 border-emerald-200 pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                3. Conformidades Identificadas ({okCount})
              </h3>
              {okCount > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {okList.map(c => (
                    <div key={c.id} className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
                      <span className="material-symbols-outlined text-emerald-600 text-base font-bold shrink-0">check</span>
                      <div className="overflow-hidden">
                        <p className="text-xs sm:text-sm font-extrabold text-emerald-950 truncate">{c.name === "LayOut" ? "Layout" : c.name}</p>
                        <p className="text-[10px] sm:text-xs text-emerald-700 font-mono font-bold">{c.pointsPossible} pts obtidos</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Nenhum processo em conformidade.</p>
              )}
            </div>

            {/* Section 4: Não Conformidades */}
            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-black text-rose-800 uppercase tracking-wider border-b-2 border-rose-200 pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-rose-600">report_problem</span>
                4. Não Conformidades Registradas ({nokCount})
              </h3>
              {nokCount > 0 ? (
                <div className="space-y-3 mt-3">
                  {nokList.map(c => {
                    const evidence = getEvidenceForCriterion(c.id);
                    return (
                      <div key={c.id} className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-2.5 shadow-2xs">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-xs sm:text-sm font-black text-rose-950 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-rose-600 text-base">warning</span>
                            {c.name === "LayOut" ? "Layout" : c.name}
                          </p>
                          <span className="font-mono text-xs font-extrabold text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-200">
                            0 / {c.pointsPossible} pts
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm space-y-2 text-rose-900 leading-relaxed">
                          <p><strong className="text-rose-950 font-extrabold">Desvio: </strong>{evidence.reasonNok}</p>
                          <p className="font-medium italic text-rose-850"><strong className="text-rose-950 font-extrabold">Nota de Auditoria: </strong>"{evidence.obsNok}"</p>
                          <div className="p-3 bg-white border border-rose-200 rounded-xl text-xs sm:text-sm text-slate-800 shadow-2xs space-y-1">
                            <strong className="text-rose-950 font-extrabold block mb-1">Plano de Ação Corretiva Oficial:</strong>
                            <span className="font-medium text-slate-700 leading-relaxed">{planosDeAcao[c.name]}</span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-600 font-semibold bg-white/80 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-200 mt-1 shadow-2xs">
                            <span className="material-symbols-outlined text-[14px] text-rose-600">folder_open</span>
                            <span>Arquivo de Evidência: {evidence.title}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs sm:text-sm text-emerald-900 leading-relaxed font-semibold">
                  ✅ Unidade opera em perfeição técnica estrutural! Nenhuma não-conformidade operacional foi detectada neste ciclo mensal de vistoria preventiva.
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Conclusão e Recomendações */}
          <div className="mt-8 space-y-3">
            <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] uppercase tracking-wider border-b-2 border-[#1B2A4A]/20 pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#1B2A4A]">engineering</span>
              5. Conclusão e Recomendações
            </h3>
            <div className="bg-slate-50/90 border border-slate-200 border-l-4 border-l-[#1B2A4A] p-5 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans mt-3 shadow-xs">
              {currentConclusion}
            </div>
          </div>

          {/* Section 6: Histórico Consolidado */}
          <div className="mt-8 space-y-3">
            <h3 className="text-base sm:text-lg font-black text-[#1B2A4A] uppercase tracking-wider border-b-2 border-[#1B2A4A]/20 pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#1B2A4A]">history</span>
              6. Histórico Consolidado dos Ciclos Anteriores
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl mt-3 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-xs tracking-wider">
                    <th className="py-3 px-4 font-mono">Ciclo</th>
                    <th className="py-3 px-4 text-center font-mono">Resultado</th>
                    <th className="py-3 px-4 text-center font-mono">Pontuação</th>
                    <th className="py-3 px-4 font-mono">Ocorrências / Desvios</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((h) => {
                    let displayType = h.type;
                    if (displayType === "Avaliação Semestral" || displayType === "Mensal" || !displayType) {
                      if (h.score >= 90) displayType = "Excelente";
                      else if (h.score >= 80) displayType = "Bom";
                      else if (h.score >= 70) displayType = "Atenção";
                      else displayType = "Alerta";
                    }
                    const isSemestral = isSemestralMonth(h.monthYear);

                    return (
                      <tr key={h.id} className="border-b border-slate-150 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#1B2A4A]">
                          <div>
                            <span>{h.monthYear}</span>
                            {isSemestral && (
                              <span className="block text-[10px] text-slate-400 font-semibold leading-tight mt-0.5">
                                Auditoria Semestral
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-black ${getTypeBadgeColor(displayType)}`}>
                            {displayType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-slate-800">
                          {h.score} pts
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {h.nokItems.length > 0 ? (
                            <span className="text-rose-600 font-semibold">{h.nokItems.join(", ")}</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">Nenhum desvio registrado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Footer */}
          <div className="mt-10 pt-6 border-t-2 border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-6 text-xs text-slate-500 font-medium">
            <div>
              <p className="text-slate-700 font-black uppercase tracking-wider">Auditoria de Operações Preventivas</p>
              <p className="mt-0.5 text-slate-500">A.Cândido Grupo S/A — Seção de Planejamento de Ativos</p>
              <p className="text-slate-400">Emissão Oficial: {new Date().toLocaleDateString("pt-BR")}</p>
            </div>
            
            <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
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

        {/* LIGHTBOX / FULLSCREEN VERIFIER DIALOG MODAL */}
          {activeLightbox && (
            <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs font-sans">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-150 animate-in fade-in zoom-in duration-200">
                {/* Lightbox Header Bar */}
                <div className="bg-[#1B2A4A] text-white px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#C8A84B]">
                      {activeLightbox.type === "PDF" ? "picture_as_pdf" : "image"}
                    </span>
                    <div>
                      <h4 className="text-xs font-black tracking-wide truncate max-w-[280px] sm:max-w-[400px]">
                        {activeLightbox.title}
                      </h4>
                      <p className="text-[10px] text-slate-300 font-medium">
                        Anexo de Auditoria Preventiva
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setActiveLightbox(null)}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                {/* Lightbox Body Viewport */}
                <div className="bg-slate-100 p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[280px]">
                  {activeLightbox.type === "PDF" ? (
                    // MOCK GENERAL COMPLIANCE PDF DOC VIEWER
                    <div className="bg-white w-full max-w-lg p-8 border border-slate-300 shadow-md rounded text-left space-y-6">
                      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                        <div>
                          <div className="flex items-center select-none gap-0.5">
                            <h3 className="text-sm font-black text-slate-900 tracking-[0.2em] font-sans">A.CÂNDIDO</h3>
                            <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full self-baseline mb-0.5"></span>
                          </div>
                          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider font-sans mt-0.5">
                            SISTEMA DE AUDITORIA PREVENTIVA
                          </p>
                        </div>
                        <span className="bg-red-500 text-white font-mono text-[9px] px-2 py-0.5 rounded font-bold uppercase">
                          PDF OFICIAL
                        </span>
                      </div>

                      <div className="space-y-3 font-serif">
                        <h4 className="text-xs font-semibold text-slate-800">
                          RELATÓRIO CONSOLIDADO DE COMPLIANCE ADVISORY - {selectedEntry.monthYear.toUpperCase()}
                        </h4>
                        <p className="text-[10.5px] leading-relaxed text-slate-700">
                          Através deste termo e relatório conclusivo, declara-se que os auditores técnicos da corporação vistoriaram de forma presencial e independente este critério técnico no <strong>{activeBranch.name}</strong>, localizado em <strong>{activeBranch.location}</strong>.
                        </p>
                        <p className="text-[10px] leading-normal text-slate-600">
                          <strong className="text-slate-800">Assunto:</strong> {activeLightbox.desc}
                        </p>
                        <div className="p-3 bg-slate-50 border border-slate-200 flex flex-col gap-1.5 rounded font-mono text-[9.5px]">
                          <div><strong className="text-slate-800">Identificação Patrimonial:</strong> ACD-PREV-{activeLightbox.cId.padStart(4, "0")}</div>
                          <div><strong className="text-slate-800">Data Homologação:</strong> {evaluationDate}</div>
                          <div><strong className="text-slate-800">Resultado Técnico:</strong> {activeLightbox.status === "OK" ? "DE ACORDO" : "INCONFORME"}</div>
                        </div>
                        <p className="text-[10.5px] leading-relaxed text-slate-700">
                          {activeLightbox.status === "OK" 
                            ? "As metodologias aplicadas e o nível de conservação documental encontram-se perfeitamente alinhados com o código de ética operacional da Diretoria Executiva do grupo."
                            : `Identificou-se inconformidade estrutural no ciclo. Detalhe técnico: ${getEvidenceForCriterion(activeLightbox.cId).reasonNok}`
                        }
                        </p>
                      </div>

                      <div className="pt-8 flex justify-between border-t border-slate-200 text-[9px] text-slate-400 font-mono">
                        <span>Ref ID: AD-1085002-6c</span>
                        <span>Assinatura Digitalizada Reg: 991.026</span>
                      </div>
                    </div>
                  ) : (
                    // MOCK IMAGE SENSOR PREVIEW
                    <div className="w-full max-w-md flex flex-col items-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-md w-full aspect-video flex flex-col items-center justify-center overflow-hidden relative">
                        {/* Interactive illustrative SVG representing check image */}
                        {activeLightbox.cId === "4" ? (
                          // Safety Corridor visual illustration
                          <svg viewBox="0 0 100 60" className="w-2/3 h-auto" textAnchor="middle">
                            <rect width="100" height="60" fill="#f8fafc" rx="4" />
                            <line x1="20" y1="10" x2="20" y2="50" stroke="#cbd5e1" strokeWidth="1" />
                            <line x1="80" y1="10" x2="80" y2="50" stroke="#cbd5e1" strokeWidth="1" />
                            {/* Shelves */}
                            <rect x="5" y="15" width="10" height="8" rx="1" fill="#1e293b" opacity="0.8" />
                            <rect x="5" y="27" width="10" height="8" rx="1" fill="#1e293b" opacity="0.8" />
                            <rect x="5" y="39" width="10" height="8" rx="1" fill="#1e293b" opacity="0.8" />
                            <rect x="85" y="15" width="10" height="8" rx="1" fill="#1e293b" opacity="0.8" />
                            <rect x="85" y="27" width="10" height="8" rx="1" fill="#1e293b" opacity="0.8" />
                            <rect x="85" y="39" width="10" height="8" rx="1" fill="#1e293b" opacity="0.8" />
                            {/* Corridor path */}
                            <polygon points="30,55 70,55 60,5 40,5" fill="#fef08a" opacity="0.4" />
                            <line x1="30" y1="55" x2="40" y2="5" stroke="#facc15" strokeWidth="2" strokeDasharray="3" />
                            <line x1="70" y1="55" x2="60" y2="5" stroke="#facc15" strokeWidth="2" strokeDasharray="3" />
                            {/* Obstacle box if NOK */}
                            {activeLightbox.status === "NOK" ? (
                              <g>
                                <rect x="42" y="30" width="16" height="12" fill="#ef4444" rx="2" />
                                <text x="50" y="38" fill="white" fontSize="5" fontWeight="bold">BOX NOK</text>
                              </g>
                            ) : (
                              <g>
                                <circle cx="50" cy="20" r="6" fill="#10b981" />
                                <path d="M47,20 l2,2 l4,-4" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                              </g>
                            )}
                            <text x="50" y="52" fill="#1e293b" fontSize="4.5" fontWeight="black" letterSpacing="0.1">CORREDOR OPERACIONAL</text>
                          </svg>
                        ) : activeLightbox.cId === "2" ? (
                          // Parts inventory check visual illustration
                          <svg viewBox="0 0 100 60" className="w-2/3 h-auto">
                            <rect width="100" height="60" fill="#f8fafc" rx="4" />
                            {/* Shelf tiers */}
                            <line x1="10" y1="20" x2="90" y2="20" stroke="#94a3b8" strokeWidth="2" />
                            <line x1="10" y1="42" x2="90" y2="42" stroke="#94a3b8" strokeWidth="2" />
                            {/* Boxes with labels */}
                            <rect x="15" y="10" width="14" height="9" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" rx="1" />
                            <rect x="43" y="10" width="14" height="9" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" rx="1" />
                            <rect x="71" y="10" width="14" height="9" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" rx="1" />
                            
                            <rect x="15" y="32" width="14" height="9" fill="#1e293b" stroke="#0f172a" strokeWidth="1" rx="1" />
                            <rect x="43" y="32" width="14" height="9" fill="#1e293b" stroke="#0f172a" strokeWidth="1" rx="1" />
                            <rect x="71" y="32" width="14" height="9" fill="#10b981" rx="1" />

                            {/* Detail text */}
                            <text x="50" y="55" fill="#475569" fontSize="4" fontStyle="italic" textAnchor="middle">Estocagem e Rastreio TOP 10 Peças Críticas</text>
                            {activeLightbox.status === "NOK" ? (
                              <g>
                                <circle cx="78" cy="14" r="5" fill="#ef4444" />
                                <text x="78" y="16" fill="white" fontSize="6" fontWeight="bold" textAnchor="middle">?</text>
                              </g>
                            ) : (
                              <g>
                                <circle cx="78" cy="36" r="3.5" fill="white" />
                                <path d="M76.5,36 l1,1 l2,-2" fill="none" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
                              </g>
                            )}
                          </svg>
                        ) : (
                          // Generic Image Inspection illustration
                          <svg viewBox="0 0 100 60" className="w-2/3 h-auto">
                            <rect width="100" height="60" fill="#f8fafc" rx="4" />
                            <rect x="25" y="10" width="50" height="32" rx="4" fill="#cbd5e1" opacity="0.5" />
                            <circle cx="50" cy="26" r="8" fill="#1b2a4a" opacity="0.1" />
                            <span className="material-symbols-outlined text-[#1B2A4A] absolute text-[36px] opacity-25">cloud_done</span>
                            <text x="50" y="50" fill="#64748b" fontSize="4.5" fontWeight="bold" textAnchor="middle">VERIFICAÇÃO DIGITAL OK</text>
                            {activeLightbox.status === "NOK" && (
                              <g>
                                <rect x="10" y="4" width="80" height="44" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                                <text x="50" y="28" fill="#ef4444" fontSize="6" fontWeight="black" textAnchor="middle">FALHA AUDITORIA</text>
                              </g>
                            )}
                          </svg>
                        )}
                      </div>
                      <div className="mt-3 text-center space-y-1">
                        <p className="text-xs font-black text-slate-800">{activeLightbox.title}</p>
                        <p className="text-[10px] text-slate-500 max-w-sm">{activeLightbox.desc}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lightbox Footer */}
                <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    onClick={() => setActiveLightbox(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold rounded-lg text-xs transition active:scale-95"
                  >
                    Fechar Visualização
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    );
  }

  // ----------------------------------------------------
  // CLEAN TIMELINE & MONTHS LIST VIEW (TIMELINE DESIGN WITH DETAILS REMOVED IN SIDEBAR)
  // ----------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Floating Simulated Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-55 bg-[#16a34a] text-white py-3 px-5 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce border border-emerald-500">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <p className="text-xs font-black tracking-wide">{toastMessage}</p>
        </div>
      )}

      {/* Selector dropdown for history target */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#1B2A4A] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C8A84B]">history</span>
            Histórico Operacional de Auditorias
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-bold">
            {user.role === "ADMIN"
              ? "Acesse o arquivo histórico completo de avaliações de qualquer almoxarifado do grupo."
              : "Consulte seu histórico de envios e notas de conformidade anteriores."}
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex flex-col gap-1 min-w-[260px]">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-sans">
            Almoxarifado Alocado
          </span>
          {user.role === "ADMIN" ? (
            <div className="relative mt-1">
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedEntry(null);
                }}
                className="w-full appearance-none bg-slate-50 border border-slate-200 px-4 py-2.5 pr-10 rounded-lg text-xs font-black text-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A] cursor-pointer"
              >
                <optgroup label="── GRUPO A ──────────────">
                  {orderedGroupA.map((b) => (
                    <option key={b.id} value={b.id}>
                      {getBranchDisplayName(b.id, b.name, b.ownerName)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="── GRUPO B ──────────────">
                  {orderedGroupB.map((b) => (
                    <option key={b.id} value={b.id}>
                      {getBranchDisplayName(b.id, b.name, b.ownerName)}
                    </option>
                  ))}
                </optgroup>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px]">
                expand_more
              </span>
            </div>
          ) : (
            <div className="relative mt-1">
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedEntry(null);
                }}
                className="w-full appearance-none bg-slate-50 border border-slate-200 px-4 py-2.5 pr-10 rounded-lg text-xs font-bold text-[#1B2A4A] focus:outline-none focus:ring-1 focus:ring-[#1B2A4A] cursor-pointer"
              >
                {userBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {getBranchDisplayName(b.id, b.name, b.ownerName)}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px]">
                expand_more
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TIMELINE LIST (POLISHED, TAKES FULL WIDTH) */}
      <div className="max-w-4xl mx-auto space-y-4">
        {isHistoryLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="flex flex-col items-center justify-center gap-3">
              <span className="animate-spin text-[#1B2A4A] text-3xl font-light">⟳</span>
              <p className="text-sm font-black text-[#1B2A4A]">Carregando histórico...</p>
            </div>
          </div>
        ) : historyList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm max-w-md mx-auto space-y-3">
            <span className="material-symbols-outlined text-[48px] text-slate-400">
              assignment_late
            </span>
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase">📋 Nenhum histórico encontrado</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Nenhum histórico encontrado — aguardando primeiro ciclo encerrado
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 pl-6 ml-3 py-2 space-y-6">
            {historyList.map((entry) => {
              const criteriaListForScore = getCriteriaForHistory(entry.score, entry.nokItems, entry.criteriaState);
              const adjustedScore = criteriaListForScore.reduce((acc, c) => acc + c.pointsObtained, 0);
              const scoreToUse = adjustedScore !== undefined ? adjustedScore : entry.score;

              let displayType = entry.type;
              if (displayType === "Avaliação Semestral" || displayType === "Mensal" || !displayType) {
                if (scoreToUse >= 90) displayType = "Excelente";
                else if (scoreToUse >= 80) displayType = "Bom";
                else if (scoreToUse >= 70) displayType = "Atenção";
                else displayType = "Alerta";
              }

              const isSemestral = isSemestralMonth(entry.monthYear);

              return (
                <div key={entry.id} className="relative group">
                  {/* Connector Dot */}
                  <span className={`absolute -left-[31px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white shadow-md transition-all ${
                    scoreToUse >= 80 ? "bg-emerald-500" : scoreToUse >= 70 ? "bg-amber-400" : "bg-red-500"
                  }`}></span>

                  {/* Card */}
                  <div className="bg-white border border-slate-200 hover:border-[#1B2A4A]/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="text-sm font-extrabold text-[#1B2A4A]">{entry.monthYear}</span>
                          {isSemestral && (
                            <span className="block text-[10px] text-slate-400 font-semibold leading-tight mt-0.5">
                              Auditoria Semestral
                            </span>
                          )}
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${getTypeBadgeColor(displayType)} uppercase tracking-wider`}>
                          {displayType}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-bold">
                        {entry.nokItems.length > 0 ? (
                          <p>
                            Pendências identificadas no período:{" "}
                            <span className="text-red-500 font-black">{entry.nokItems.join(", ")}</span>
                          </p>
                        ) : (
                          <p className="text-emerald-600 font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] font-bold">check_circle</span>
                            Mês ideal sem conformidades reprovadas
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right score details */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-black text-[#1B2A4A] font-mono leading-none">
                          {adjustedScore} pts
                        </p>
                        <span className="text-[9px] text-[#C8A84B] font-black uppercase tracking-wider font-mono">PONTUAÇÃO</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedEntry({
                          ...entry,
                          score: adjustedScore
                        })}
                        className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-[#1B2A4A] hover:text-[#C8A84B] font-extrabold rounded-xl text-xs border border-slate-200 transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
                      >
                        <span>Detalhes</span>
                        <span className="material-symbols-outlined text-[14px]">zoom_in</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
