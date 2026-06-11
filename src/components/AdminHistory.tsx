import React, { useState, useEffect, useCallback } from "react";
import { initialHistory } from "../mockData";
import { AuditHistoryEntry, AppUser, Branch, CriterionState } from "../types";

interface AdminHistoryProps {
  user: AppUser;
  branches: Branch[];
}

// 1. HELPERS FOR TEXT NORMALIZATION AND STRING MATCHING
const removeAccentsAndSpaces = (str: string) => {
  return str
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
  const m = monthYear.toLowerCase();
  return m.includes("janeiro") || m.includes("junho") || m.includes("dezembro") || m.includes("semestral");
};

const getScheduledInventoryDate = (branchName: string, monthYear: string) => {
  let localCalendar: any[] = [];
  try {
    const saved = localStorage.getItem("acandido_calendario_inventarios");
    localCalendar = saved ? JSON.parse(saved) : [];
  } catch (e) {}

  if (localCalendar.length === 0) {
    localCalendar = [
      { id: "cal-1", almoxarifado: "Santa Maria JPA", ano: 2026, semestre: 1, data_agendada: "2026-06-26" },
      { id: "cal-2", almoxarifado: "Santa Maria JPA", ano: 2026, semestre: 2, data_agendada: "2026-11-27" },
      { id: "cal-3", almoxarifado: "A.Candido (CG)", ano: 2026, semestre: 1, data_agendada: "2026-01-17" },
      { id: "cal-4", almoxarifado: "A.Candido (CG)", ano: 2026, semestre: 2, data_agendada: "2026-08-18" },
      { id: "cal-5", almoxarifado: "Trans CG", ano: 2026, semestre: 1, data_agendada: "2026-01-17" },
      { id: "cal-6", almoxarifado: "Trans CG", ano: 2026, semestre: 2, data_agendada: "2026-08-18" },
      { id: "cal-7", almoxarifado: "Trans CG Metrop (Bayeux)", ano: 2026, semestre: 1, data_agendada: "2026-02-10" },
      { id: "cal-8", almoxarifado: "Trans CG Metrop (Bayeux)", ano: 2026, semestre: 2, data_agendada: "2026-09-12" },
      { id: "cal-9", almoxarifado: "Trans Fret CE", ano: 2026, semestre: 1, data_agendada: "2026-02-25" },
      { id: "cal-10", almoxarifado: "Trans Fret CE", ano: 2026, semestre: 2, data_agendada: "2026-09-15" },
      { id: "cal-11", almoxarifado: "Trans Fret Goiana", ano: 2026, semestre: 1, data_agendada: "2026-05-16" },
      { id: "cal-12", almoxarifado: "Trans Fret Goiana", ano: 2026, semestre: 2, data_agendada: "2026-10-31" },
      { id: "cal-13", almoxarifado: "Trans Fret PB", ano: 2026, semestre: 1, data_agendada: "2026-01-08" },
      { id: "cal-14", almoxarifado: "Trans Fret PB", ano: 2026, semestre: 2, data_agendada: "2026-07-22" },
      { id: "cal-15", almoxarifado: "Trans Fret PE", ano: 2026, semestre: 1, data_agendada: "2026-01-15" },
      { id: "cal-16", almoxarifado: "Trans Fret PE", ano: 2026, semestre: 2, data_agendada: "2026-07-08" },
      { id: "cal-17", almoxarifado: "Trans Rod CE", ano: 2026, semestre: 1, data_agendada: "2026-06-09" }
    ];
  }

  const m = monthYear.toLowerCase();
  const isSem2 = m.includes("julho") || m.includes("agosto") || m.includes("setembro") || m.includes("outubro") || m.includes("novembro") || m.includes("dezembro");
  const sem = isSem2 ? 2 : 1;

  const item = localCalendar.find(
    (c) => c.almoxarifado === branchName && c.semestre === sem
  );

  if (item && item.data_agendada) {
    const parts = item.data_agendada.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return item.data_agendada;
  }

  return sem === 1 ? "26/06/2026" : "27/11/2026";
};

const getHistoryForBranch = (bId: string): AuditHistoryEntry[] => {
  const monthlyScoresMap: Record<string, number[]> = {
    "unitrans-jp": [50, 50, 50, 45, 45],
    "santa-maria-jp": [50, 50, 50, 45, 45],
    "expresso-nacional": [40, 40, 40, 35, 35],
    "acandido-cg": [40, 40, 40, 35, 35],
    "fretamento-goiana": [70, 70, 70, 60, 60],
    "fretamento-jaboatao": [40, 40, 35, 35, 35],
    "rodoviario-jaboatao": [40, 35, 35, 35, 35],
    "unissana-rn": [85, 85, 80, 80, 80],
    "reunidas-nat": [95, 90, 90, 90, 90],
    "fretamento-pb": [80, 80, 80, 75, 75],
    "trans-cg-bayeux": [45, 45, 45, 40, 40],
    "rodoviario-cabedelo": [45, 45, 45, 40, 40],
    "fretamento-maracanau": [35, 30, 30, 30, 30],
    "rodoviario-fortaleza": [30, 30, 30, 30, 30],
  };

  let savedEntries: any[] = [];
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = localStorage.getItem("acandido_history");
    if (saved) {
      try {
        savedEntries = JSON.parse(saved);
        if (!Array.isArray(savedEntries)) savedEntries = [];
      } catch (e) {
        savedEntries = [];
      }
    }
  }

  // Filter real entries that belong to this branch
  const realBranchEntries = savedEntries.filter((e) => e.branchId === bId);

  // Default simulated months
  const scores = monthlyScoresMap[bId] || [40, 40, 40, 40, 40];
  const months = ["Maio 2026", "Abril 2026", "Março 2026", "Fevereiro 2026", "Janeiro 2026"];

  const simulated: AuditHistoryEntry[] = months.map((m, idx) => {
    const isJan = idx === 4; // Janeiro 2026
    const score = scores[idx];

    let type: "Excelente" | "Alerta" | "Atenção" | "Avaliação Semestral" | "Mensal" = "Mensal";
    if (isJan) {
      type = "Avaliação Semestral";
    } else if (score >= 90) {
      type = "Excelente";
    } else if (score >= 80) {
      type = "Mensal";
    } else if (score >= 45) {
      type = "Atenção";
    } else {
      type = "Alerta";
    }

    let nokItems: string[] = [];
    const missing = 100 - score;

    if (missing > 0) {
      if (missing === 5) {
        nokItems = ["Nível de Serviço"];
      } else if (missing === 10) {
        nokItems = ["Curso Unimobin"];
      } else if (missing === 15) {
        nokItems = ["Curso Unimobin", "Nível de Serviço"];
      } else if (missing === 20) {
        nokItems = ["TOP 10"];
      } else if (missing === 25) {
        nokItems = ["TOP 10", "Nível de Serviço"];
      } else if (missing === 30) {
        nokItems = ["TOP 10", "Curso Unimobin"];
      } else if (missing === 35) {
        nokItems = ["TOP 10", "Curso Unimobin", "Nível de Serviço"];
      } else if (missing === 40) {
        nokItems = ["Inventário", "TOP 10"];
      } else if (missing === 45) {
        nokItems = ["Inventário", "TOP 10", "Nível de Serviço"];
      } else if (missing === 50) {
        nokItems = ["Inventário", "TOP 10", "Curso Unimobin"];
      } else if (missing === 55) {
        nokItems = ["Inventário", "TOP 10", "Curso Unimobin", "Nível de Serviço"];
      } else if (missing === 60) {
        nokItems = ["Inventário", "TOP 10", "Nota Fiscal", "LayOut"];
      } else if (missing === 65) {
        nokItems = ["Inventário", "TOP 10", "Nota Fiscal", "LayOut", "Nível de Serviço"];
      } else if (missing === 70) {
        nokItems = ["Inventário", "TOP 10", "Nota Fiscal", "LayOut", "Curso Unimobin"];
      } else {
        nokItems = ["Inventário", "TOP 10", "Nota Fiscal", "LayOut", "Curso Unimobin"];
      }
    }

    let auditedDetails = `Ciclo encerrado e validado em conformidade estrutural.`;
    if (nokItems.length > 0) {
      auditedDetails = `Unidade avaliada com inconformidades operacionais pontuais em: ${nokItems.join(", ")}.`;
    }

    return {
      id: `h-${bId}-${idx}`,
      monthYear: m,
      type,
      score,
      nokItems,
      auditedDetails
    };
  });

  const combined: AuditHistoryEntry[] = [];
  
  realBranchEntries.forEach((entry) => {
    let type: "Excelente" | "Alerta" | "Atenção" | "Avaliação Semestral" | "Mensal" = "Mensal";
    if (isSemestralMonth(entry.monthYear)) {
      type = "Avaliação Semestral";
    } else if (entry.score >= 90) {
      type = "Excelente";
    } else if (entry.score >= 80) {
      type = "Mensal";
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
      auditedDetails: entry.auditedDetails || "Ciclo encerrado e enviado à auditoria pelo usuário."
    });
  });

  simulated.forEach((sim) => {
    const isOverwritten = combined.some((e) => e.monthYear === sim.monthYear);
    if (!isOverwritten) {
      combined.push(sim);
    }
  });

  return combined;
};

export default function AdminHistory({ user, branches }: AdminHistoryProps) {
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

  const [historyList, setHistoryList] = useState<AuditHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditHistoryEntry | null>(null);

  const onAlmoxarifadoChange = useCallback(async (almoxarifadoId: string) => {
    setHistoryList([]);
    setIsHistoryLoading(true);
    setSelectedEntry(null);

    // Simulate async database/network search
    await new Promise((resolve) => setTimeout(resolve, 600));

    const data = getHistoryForBranch(almoxarifadoId);
    setHistoryList(data);
    setIsHistoryLoading(false);
  }, []);

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
      case "expresso-nacional": return `Expresso Nacional (${ownerName})`;
      case "acandido-cg": return `A.Cândido CG (${ownerName})`;
      case "fretamento-jaboatao": return `Fretamento Jaboatão (${ownerName})`;
      case "rodoviario-jaboatao": return `Rodoviário Jaboatão (${ownerName})`;
      case "fretamento-goiana": return `Fretamento Goiana (${ownerName})`;
      case "unissana-rn": return `Unissana RN (${ownerName})`;
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
      case "Alerta":
        return "bg-red-50 text-red-700 border-red-200";
      case "Atenção":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Avaliação Semestral":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getCriteriaForHistory = (score: number, nokItems: string[]) => {
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

      const nokEvidenceLink = isNok ? `https://drive.google.com/drive/folders/mock-nok-folder-${c.id}` : undefined;
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

  const handleExportPDF = () => {
    if (!selectedEntry) return;
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setToastMessage(
        `Relatório em PDF de ${selectedEntry.monthYear} para o ${activeBranch.name} exportado com sucesso!`
      );
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      try {
        window.print();
      } catch (err) {
        console.error("Print feature errored: ", err);
      }
    }, 1200);
  };

  // ----------------------------------------------------
  // FULL DETAILED MONTHLY VIEW IMPLEMENTATION (REPLACES TIMELINE GRID)
  // ----------------------------------------------------
  if (selectedEntry) {
    const criteriaList = getCriteriaForHistory(selectedEntry.score, selectedEntry.nokItems);
    const score = criteriaList.reduce((sum, c) => sum + c.pointsObtained, 0);

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

    // Helpers for generating dynamic assessment summaries
    const okList = criteriaList.filter(c => c.status === "OK");
    const nokList = criteriaList.filter(c => c.status === "NOK");
    const okCount = okList.length;
    const nokCount = nokList.length;

    const buildAutomaticResumoExecutivo = () => {
      const isSem = isSemestralMonth(selectedEntry.monthYear);
      const crits = getCriteriaForHistory(selectedEntry.score, selectedEntry.nokItems);
      
      let obtPoints = selectedEntry.score;
      let maxPoints = 100;
      
      if (!isSem) {
        const monthly = crits.filter(c => c.id !== "1" && c.id !== "10");
        obtPoints = monthly.reduce((acc, c) => acc + c.pointsObtained, 0);
        maxPoints = 75;
      } else {
        obtPoints = crits.reduce((acc, c) => acc + c.pointsObtained, 0);
        maxPoints = 100;
      }

      const groupBranches = branches
        .filter((b) => b.group === activeBranch.group)
        .sort((a, b) => b.currentScore - a.currentScore);
      const rankIndex = groupBranches.findIndex((b) => b.id === activeBranch.id);
      const posNumer = rankIndex !== -1 ? rankIndex + 1 : 1;
      const groupLabel = activeBranch.group === "A" ? "GRUPO A" : "GRUPO B";
      const rankPos = `${posNumer}º lugar`;

      const listOK = (isSem ? crits : crits.filter(c => c.id !== "1" && c.id !== "10")).filter(c => c.status === "OK");
      const listNOK = (isSem ? crits : crits.filter(c => c.id !== "1" && c.id !== "10")).filter(c => c.status === "NOK");

      const conformidadesStr = listOK.map(c => `✅ ${c.name} — ${c.pointsPossible} pts`).join("\n");
      const naoConformidadesBlock = listNOK.length > 0
        ? `Não Conformidades (${listNOK.length} critérios):\n` +
          listNOK.map(c => `❌ ${c.name} — 0 pts\n   Plano de ação: ${planosDeAcao[c.name] || ""}`).join("\n")
        : "";

      const semestraisBlock = !isSem
        ? `(critérios semestrais ainda não avaliados):\n` +
          `⏳ Inventário — aguardando realização em ${getScheduledInventoryDate(activeBranch.name, selectedEntry.monthYear)}\n` +
          `⏳ Material Sem Movimentação — aguardando fechamento semestral`
        : "";

      const histLines: string[] = [];
      const entryIdx = historyList.findIndex(h => h.id === selectedEntry.id);
      if (entryIdx !== -1) {
        const preceding = historyList.slice(entryIdx + 1);
        for (let i = 0; i < Math.min(3, preceding.length); i++) {
          const h = preceding[i];
          const histIsSem = isSemestralMonth(h.monthYear);
          const histCrits = getCriteriaForHistory(h.score, h.nokItems);
          let hObt = h.score;
          let hMax = 100;
          if (!histIsSem) {
            const histMonthly = histCrits.filter(c => c.id !== "1" && c.id !== "10");
            hObt = histMonthly.reduce((acc, c) => acc + c.pointsObtained, 0);
            hMax = 75;
          } else {
            hObt = histCrits.reduce((acc, c) => acc + c.pointsObtained, 0);
            hMax = 100;
          }
          const label = i === 0 ? "Mês anterior" : i === 1 ? "2 meses atrás" : "3 meses atrás";
          histLines.push(`- ${label} (${h.monthYear}): ${hObt} pts / ${hMax} pts`);
        }
      }
      const histStr = histLines.length > 0
        ? `Histórico recente:\n` + histLines.join("\n")
         : "";

      // Tendencia
      let tendencyStr = "➡ Desempenho estável em relação ao mês anterior.";
      if (entryIdx !== -1 && entryIdx + 1 < historyList.length) {
        const prevEntry = historyList[entryIdx + 1];
        const prevIsSem = isSemestralMonth(prevEntry.monthYear);
        const prevCrits = getCriteriaForHistory(prevEntry.score, prevEntry.nokItems);
        let prevObt = prevEntry.score;
        let prevMax = 100;
        if (!prevIsSem) {
          const prevMonthly = prevCrits.filter(c => c.id !== "1" && c.id !== "10");
          prevObt = prevMonthly.reduce((acc, c) => acc + c.pointsObtained, 0);
          prevMax = 75;
        } else {
          prevObt = prevCrits.reduce((acc, c) => acc + c.pointsObtained, 0);
          prevMax = 100;
        }
        const currentPct = obtPoints / maxPoints;
        const prevPct = prevObt / prevMax;
        if (currentPct > prevPct) {
          tendencyStr = "📈 Tendência de melhora em relação ao mês anterior.";
        } else if (currentPct < prevPct) {
          tendencyStr = "📉 Queda de desempenho em relação ao mês anterior.";
        }
      }

      let template = `RESUMO EXECUTIVO OPERACIONAL\n${activeBranch.name.toUpperCase()} — ${selectedEntry.monthYear.toUpperCase()}\nResponsável: ${activeBranch.ownerName}\n\n`;
      template += `Pontuação do período: ${obtPoints} pts / ${maxPoints} pts\n`;
      template += `Posição no ranking ${groupLabel}: ${rankPos}\n\n`;
      template += `Conformidades (${listOK.length} critérios):\n${conformidadesStr}\n\n`;
      if (naoConformidadesBlock) {
        template += `${naoConformidadesBlock}\n\n`;
      }
      if (semestraisBlock) {
        template += `${semestraisBlock}\n\n`;
      }
      if (histStr) {
        template += `${histStr}\n\n`;
      }
      template += `(tendência):\n${tendencyStr}`;

      return template;
    };

    const buildAutomaticConclusion = () => {
      const isSem = isSemestralMonth(selectedEntry.monthYear);
      const crits = getCriteriaForHistory(selectedEntry.score, selectedEntry.nokItems);
      
      let obtPoints = selectedEntry.score;
      let maxPoints = 100;
      
      if (!isSem) {
        const monthly = crits.filter(c => c.id !== "1" && c.id !== "10");
        obtPoints = monthly.reduce((acc, c) => acc + c.pointsObtained, 0);
        maxPoints = 75;
      } else {
        obtPoints = crits.reduce((acc, c) => acc + c.pointsObtained, 0);
        maxPoints = 100;
      }

      const listOK = (isSem ? crits : crits.filter(c => c.id !== "1" && c.id !== "10")).filter(c => c.status === "OK");
      const listNOK = (isSem ? crits : crits.filter(c => c.id !== "1" && c.id !== "10")).filter(c => c.status === "NOK");

      const pct = (obtPoints / maxPoints) * 100;
      let performanceText = "";
      if (pct >= 90) {
        performanceText = "O almoxarifado apresentou desempenho excelente no período, demonstrando alto nível de organização e controle dos processos.";
      } else if (pct >= 75) {
        performanceText = "O almoxarifado apresentou desempenho satisfatório no período, com oportunidades pontuais de melhoria nos critérios indicados.";
      } else if (pct >= 60) {
        performanceText = "O almoxarifado apresentou desempenho regular no período, requerendo atenção nos critérios em não conformidade para recuperação da pontuação nos próximos ciclos.";
      } else {
        performanceText = "O almoxarifado apresentou desempenho abaixo do esperado no período, sendo necessária ação imediata nos critérios em não conformidade identificados.";
      }

      let recsBlock = "";
      if (listNOK.length > 0) {
        recsBlock = listNOK.map(c => `- ${c.name}: ${planosDeAcao[c.name] || ""}`).join("\n");
      } else {
        recsBlock = "Não há recomendações corretivas para este período. Manter os padrões de excelência operacional já estabelecidos e continuar com os controles em vigor.";
      }

      let template = `CONCLUSÃO\n\n`;
      template += `A auditoria de ${selectedEntry.monthYear} do almoxarifado ${activeBranch.name} resultou em ${obtPoints} pontos de um total de ${maxPoints} pontos possíveis neste mês, representando ${listOK.length} critérios em conformidade e ${listNOK.length} critérios em não conformidade.\n\n`;
      template += `${performanceText}\n\n`;
      template += `RECOMENDAÇÃO\n\n`;
      template += `${recsBlock}`;

      return template;
    };

    const currentSummary = editedSummaries[selectedEntry.id] !== undefined
      ? editedSummaries[selectedEntry.id]
      : buildAutomaticResumoExecutivo();

    const currentConclusion = editedConclusions[selectedEntry.id] !== undefined
      ? editedConclusions[selectedEntry.id]
      : buildAutomaticConclusion();

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
        <div id="audit-report-printable" className="print-container bg-white border-2 border-slate-300 rounded-2xl p-6 sm:p-10 shadow-lg  text-[#0F172A] font-sans">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-[#1B2A4A] pb-5">
            <div>
              <h1 className="text-xl font-black text-[#1B2A4A] tracking-wider font-mono">
                A. CÂNDIDO GRUPO
              </h1>
              <p className="text-[10px] text-slate-500 font-extrabold tracking-widest uppercase mt-0.5">
                Gestão de Conformidade e Auditoria
              </p>
            </div>
            <div className="text-left sm:text-right">
              <h2 className="text-base font-black text-[#C8A84B] uppercase tracking-normal">
                Relatório de Auditoria Preventiva
              </h2>
              <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                Ref ID: ACD-AUD-2026-{selectedBranchId.toUpperCase().slice(0, 4)}-{selectedEntry.monthYear.toUpperCase().replace(/\s/g, "")}
              </p>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="mt-5 bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <h3 className="text-[10px] font-black text-[#1B2A4A] uppercase tracking-wider mb-2.5">
              Identificação do Ciclo de Auditoria
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px]">Almoxarifado / Filial</p>
                <p className="font-extrabold text-[#1B2A4A] mt-0.5">{activeBranch.name}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px]">Responsável Alocado</p>
                <p className="font-extrabold text-[#1B2A4A] mt-0.5">{activeBranch.ownerName}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px]">Mês Referência</p>
                <p className="font-extrabold text-[#1B2A4A] mt-0.5">{selectedEntry.monthYear}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px]">Data de Emissão</p>
                <p className="font-extrabold text-[#1B2A4A] mt-0.5">{evaluationDate} (Vistoria)</p>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#C8A84B]">description</span>
              1. Resumo Executivo Operacional
            </h3>
            <div className="relative group">
              {/* On screen (editable) */}
              <div className="no-print space-y-2 bg-[#f8fafc] p-4 border-l-4 border-[#1B2A4A] rounded-r-lg">
                <span className="text-[10px] uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-250 font-extrabold flex items-center gap-1 self-start select-none w-max mb-1.5">
                  <span className="material-symbols-outlined text-[12px]">edit</span>Texto editável pelo auditor (campo de digitação livre)
                </span>
                <textarea
                  value={currentSummary}
                  onChange={(e) => {
                    setEditedSummaries(prev => ({
                      ...prev,
                      [selectedEntry.id]: e.target.value
                    }));
                  }}
                  className="w-full min-h-[300px] text-xs font-mono p-3 border border-slate-300 rounded-xl bg-white focus:ring-1 focus:ring-[#1B2A4A] focus:border-[#1B2A4A] transition-all outline-none"
                />
              </div>
              {/* On print (crisp clean formatted text) */}
              <div className="hidden print:block text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-[#f8fafc] p-4 border-l-4 border-[#1B2A4A] rounded-r-lg">
                {currentSummary}
              </div>
            </div>
          </div>

          {/* Section 2: Full Checklist Table */}
          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#C8A84B]">fact_check</span>
              2. Checklist Geral de Auditoria (10 Critérios)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl mt-2.5">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase text-[9px] tracking-wider">
                    <th className="py-2.5 px-4 w-12">#</th>
                    <th className="py-2.5 px-4">Critério Operacional Avaliado</th>
                    <th className="py-2.5 px-4 text-center">Frequência</th>
                    <th className="py-2.5 px-4 text-center">Pontos Possíveis</th>
                    <th className="py-2.5 px-4 text-center">Pontos Obtidos</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {criteriaList.map((c) => (
                    <tr key={c.id} className="border-b border-slate-150 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-black text-slate-400">{c.id.padStart(2, "0")}</td>
                      <td className="py-2.5 px-4 font-bold text-[#1B2A4A]">
                        <div>{c.name}</div>
                        {c.status === "NOK" && (c.nokEvidenceLink || c.nokEvidenceFileData) && (
                          <div className="text-[10px] text-rose-700 font-sans mt-1 font-bold break-all">
                            Evidência:{" "}
                            {c.nokEvidenceFileData ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                                }}
                                className="underline font-mono text-rose-800 font-bold hover:text-rose-950"
                              >
                                {c.nokEvidenceFileName || "evidência.pdf"} (Visualizar)
                              </button>
                            ) : (
                              <a
                                href={c.nokEvidenceLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-mono text-rose-800 hover:text-rose-950"
                              >
                                {c.nokEvidenceLink}
                              </a>
                            )}
                            {c.nokEvidenceDescription && <span className="block text-slate-500 font-sans font-medium italic mt-0.5">"{c.nokEvidenceDescription}"</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center font-semibold text-slate-500">{c.recurrence}</td>
                      <td className="py-2.5 px-4 text-center text-slate-500 font-mono font-semibold">{c.pointsPossible} pts</td>
                      <td className={`py-2.5 px-4 text-center font-mono font-black ${c.status === "OK" ? "text-emerald-700" : "text-rose-600"}`}>
                        {c.pointsObtained} pts
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                          c.status === "OK" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-55 bg-slate-100 font-black border-t border-slate-250">
                    <td colSpan={3} className="py-2.5 px-4 text-right text-slate-550 text-slate-500">PONTUAÇÃO ACUMULADA:</td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-600">100 pts</td>
                    <td className={`py-2.5 px-4 text-center font-mono text-sm ${score >= 80 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {score} pts
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded text-xs uppercase font-black tracking-wider ${
                        score >= 80 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      }`}>
                        {score >= 80 ? "QUALIFICADO" : "REPROVADO"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 3: Conformidades */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-emerald-800 uppercase tracking-wider border-b border-emerald-200 pb-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                3. Conformidades Identificadas ({okCount})
              </h3>
              {okCount > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {okList.map(c => (
                    <div key={c.id} className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-sm font-black shrink-0">check</span>
                      <div className="overflow-hidden">
                        <p className="text-[11px] font-bold text-emerald-900 truncate">{c.name}</p>
                        <p className="text-[9px] text-[#C8A84B] font-mono font-black">{c.pointsPossible} pts obtidos</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Nenhum processo em conformidade.</p>
              )}
            </div>

            {/* Section 4: Não Conformidades */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-rose-800 uppercase tracking-wider border-b border-rose-200 pb-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-rose-600">report_problem</span>
                4. Não Conformidades Registradas ({nokCount})
              </h3>
              {nokCount > 0 ? (
                <div className="space-y-3 mt-2">
                  {nokList.map(c => {
                    const evidence = getEvidenceForCriterion(c.id);
                    return (
                      <div key={c.id} className="p-3 bg-rose-50/75 border border-rose-100 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-black text-rose-950 flex items-center gap-1">
                            <span className="material-symbols-outlined text-rose-600 text-sm">warning</span>
                            {c.name}
                          </p>
                          <span className="font-mono text-[9px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                            0 / {c.pointsPossible} pts
                          </span>
                        </div>
                        <div className="text-[11px] pl-5 space-y-1 text-rose-900 leading-normal">
                          <p><strong className="text-rose-950">Desvio: </strong>{evidence.reasonNok}</p>
                          <p className="font-medium italic text-rose-850"><strong className="text-rose-950">Nota de Auditoria: </strong>"{evidence.obsNok}"</p>
                          <div className="mt-2 p-2.5 bg-white/60 border border-rose-100/80 rounded-lg text-slate-700 text-xs shadow-3xs">
                            <strong className="text-rose-950 font-bold block mb-0.5">Plano de Ação Corretiva Oficial:</strong>
                            <span className="font-medium text-rose-900 leading-relaxed">{planosDeAcao[c.name]}</span>
                          </div>
                          <p className="text-[9px] font-mono text-slate-500 font-bold bg-white/70 inline-block px-1.5 py-0.5 rounded border border-rose-100 mt-1.5">
                            📁 Arquivo de Evidência: {evidence.title}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 leading-relaxed font-semibold">
                  ✅ Unidade opera em perfeição técnica estrutural! Nenhuma não-conformidade operacional foi detectada neste ciclo mensal de vistoria preventiva.
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Conclusão e Recomendações */}
          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#C8A84B]">engineering</span>
              5. Conclusão e Recomendações
            </h3>
            <div className="relative group">
              {/* On screen (editable) */}
              <div className="no-print space-y-2 bg-[#f8fafc] p-4 border-l-4 border-teal-600 rounded-r-lg">
                <span className="text-[10px] uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-250 font-extrabold flex items-center gap-1 self-start select-none w-max mb-1.5">
                  <span className="material-symbols-outlined text-[12px]">edit</span>Texto editável pelo auditor (Conclusão e Recomendações)
                </span>
                <textarea
                  value={currentConclusion}
                  onChange={(e) => {
                    setEditedConclusions(prev => ({
                      ...prev,
                      [selectedEntry.id]: e.target.value
                    }));
                  }}
                  className="w-full min-h-[250px] text-xs font-mono p-3 border border-slate-300 rounded-xl bg-white focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition-all outline-none"
                />
              </div>
              {/* On print (crisp clean formatted text) */}
              <div className="hidden print:block text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50 border border-slate-200 p-4 rounded-xl">
                {currentConclusion}
              </div>
            </div>
          </div>

          {/* Section 6: Histórico Consolidado */}
          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#C8A84B]">history</span>
              6. Histórico Consolidado dos Ciclos Anteriores
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl mt-2.5">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase text-[9px] tracking-wider">
                    <th className="py-2.5 px-4 font-mono">Ciclo</th>
                    <th className="py-2.5 px-4 text-center font-mono">Tipo</th>
                    <th className="py-2.5 px-4 text-center font-mono">Pontuação</th>
                    <th className="py-2.5 px-4 font-mono">Ocorrências / Desvios</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((h) => (
                    <tr key={h.id} className="border-b border-slate-150 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-[#1B2A4A]">{h.monthYear}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${getTypeBadgeColor(h.type)}`}>
                          {h.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-black text-slate-800">
                        {h.score} pts
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {h.nokItems.length > 0 ? (
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
          <div className="mt-8 pt-6 border-t border-slate-250 flex flex-col md:flex-row md:items-end justify-between gap-6 text-[10px] text-slate-400 font-bold">
            <div>
              <p className="text-slate-500 font-black uppercase">Auditoria de Operações Preventivas</p>
              <p className="mt-0.5 text-slate-400">A.Cândido Grupo S/A — Seção de Planejamento de Ativos</p>
              <p className="text-slate-400">Emissão Oficial: {new Date().toLocaleDateString("pt-BR")}</p>
            </div>
            
            <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
              <div className="w-52 h-px bg-slate-350"></div>
              <p className="text-slate-700 font-black font-sans">
                Fernando Silva
              </p>
              <p className="text-[9px] text-slate-400 font-bold tracking-tight uppercase leading-none">
                Auditor Geral de Qualidade — Grupo A. Cândido
              </p>
            </div>
          </div>
        </div>

        {/* INTERACTIVE DASHBOARD SECTION - HIDDEN IN PRINTING */}
        <div className="no-print space-y-6">
          {/* Dashboard Top Card */}
          <div id="print-area" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
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

            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl shrink-0 self-start md:self-auto">
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

          {/* 10 CRITERIA TABLE */}
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider">
                Checklist de Auditoria Preventiva — 10 Critérios Consolidados
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded font-black uppercase tracking-wide">
                {criteriaList.length} Itens Verificados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-6 w-12">#</th>
                    <th className="py-3 px-4">Critério Operacional</th>
                    <th className="py-3 px-4 text-center">Frequência</th>
                    <th className="py-3 px-4 text-center">Pontos Possíveis</th>
                    <th className="py-3 px-4 text-center">Pontos Obtidos</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Data Avaliação</th>
                    <th className="py-3 px-6 text-right">Ação</th>
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
                          className={`border-b border-slate-100 hover:bg-slate-50/75 transition-colors cursor-pointer ${
                            isExpanded ? "bg-slate-50/50" : ""
                          }`}
                        >
                          <td className="py-3.5 px-6 font-mono text-xs font-black text-slate-400">
                            {c.id.padStart(2, "0")}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-[#1B2A4A] text-xs">
                            <div>{c.name}</div>
                            {c.status === "NOK" && (c.nokEvidenceLink || c.nokEvidenceFileData) && (
                              <div className="mt-1.5 flex flex-wrap gap-2 items-center">
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
                                  className="inline-flex items-center gap-1 text-[9px] bg-rose-100/60 hover:bg-rose-100/90 text-rose-800 border border-[#F7C1C1] px-1.5 py-0.5 rounded font-black transition-all shadow-3xs"
                                >
                                  <span>📎 Ver evidência</span>
                                </button>
                                {c.nokEvidenceDescription && (
                                  <span className="text-[9px] text-slate-450 font-normal italic max-w-[240px] truncate" title={c.nokEvidenceDescription}>
                                    "{c.nokEvidenceDescription}"
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="text-[11px] font-semibold text-slate-500">
                              {c.recurrence}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs font-bold text-slate-500">
                            {c.pointsPossible} pts
                          </td>
                          <td className={`py-3.5 px-4 text-center font-mono text-xs font-black ${
                            c.status === "OK" ? "text-emerald-700" : "text-rose-600"
                          }`}>
                            {c.pointsObtained} pts
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                              c.status === "OK"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200 font-extrabold"
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-xs font-medium">
                            {evaluationDate}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <span className="material-symbols-outlined text-slate-400 text-[18px] select-none">
                              {isExpanded ? "expand_less" : "expand_more"}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Section Details */}
                        {isExpanded && (
                          <tr className="bg-slate-50/30 border-b border-slate-200/60 font-sans">
                            <td colSpan={8} className="py-4 px-8">
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
                                    <div className="p-3 bg-rose-55 bg-rose-50 border border-rose-150/40 rounded-xl">
                                      <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-rose-700 text-[14px]">announcement</span>
                                        Motivo Registrado para Inconformidade:
                                      </h5>
                                      <p className="text-xs text-rose-950 font-medium leading-normal mt-1">
                                        {evidence.reasonNok}
                                      </p>
                                    </div>
                                  )}
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
                </tbody>
              </table>
            </div>
          </section>

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
              Este almoxarifado ainda não possui ciclos encerrados registrados.
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 pl-6 ml-3 py-2 space-y-6">
            {historyList.map((entry) => {
              const criteriaListForScore = getCriteriaForHistory(entry.score, entry.nokItems);
              const adjustedScore = criteriaListForScore.reduce((acc, c) => acc + c.pointsObtained, 0);
              
              return (
                <div key={entry.id} className="relative group">
                  {/* Connector Dot */}
                  <span className={`absolute -left-[31px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white shadow-md transition-all ${
                    adjustedScore >= 80 ? "bg-emerald-500" : adjustedScore >= 70 ? "bg-amber-400" : "bg-red-500"
                  }`}></span>

                  {/* Card */}
                  <div className="bg-white border border-slate-200 hover:border-[#1B2A4A]/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#1B2A4A]">{entry.monthYear}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${getTypeBadgeColor(entry.type)} uppercase tracking-wider`}>
                          {entry.type}
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
