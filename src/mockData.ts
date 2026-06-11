import { Branch, AuditHistoryEntry, MaterialOccurrence, WarrantyItem, CollaboratorCertificate, InventoryItemToCount, CriterionState, EvaluationStatus } from "./types";

const getCriteriaForBranch = (score: number): CriterionState[] => {
  // score is guaranteed to be a multiple of 5: 0, 5, 10, ..., 100.
  // Let's decide statuses to sum to exactly score on a binary basis
  const statusList: EvaluationStatus[] = Array(10).fill("NOK");
  const weights = [20, 20, 10, 10, 10, 10, 5, 5, 5, 5];
  let remaining = score;
  
  for (let i = 0; i < weights.length; i++) {
    if (remaining >= weights[i]) {
      statusList[i] = "OK" as const;
      remaining -= weights[i];
    } else {
      if (i === 0) statusList[i] = "PENDENTE" as const;
      else if (i === 5) statusList[i] = "AGUARDANDO ENVIO" as const;
      else if (i === 2 || i === 7 || i === 8) statusList[i] = "PENDENTE" as const;
      else statusList[i] = "NOK" as const;
    }
  }

  return [
    { id: "1", number: "01", name: "Inventário", recurrence: "Semestral", pointsPossible: 20, pointsObtained: statusList[0] === "OK" ? 20 : 0, status: statusList[0] },
    { id: "2", number: "02", name: "TOP 10", recurrence: "Mensal", pointsPossible: 20, pointsObtained: statusList[1] === "OK" ? 20 : 0, status: statusList[1] },
    { id: "3", number: "03", name: "Nota Fiscal", recurrence: "Mensal", pointsPossible: 10, pointsObtained: statusList[2] === "OK" ? 10 : 0, status: statusList[2] },
    { id: "4", number: "04", name: "LayOut", recurrence: "Mensal", pointsPossible: 10, pointsObtained: statusList[3] === "OK" ? 10 : 0, status: statusList[3] },
    { id: "5", number: "05", name: "Recebimento de Material", recurrence: "Mensal", pointsPossible: 10, pointsObtained: statusList[4] === "OK" ? 10 : 0, status: statusList[4] },
    { id: "6", number: "06", name: "Curso Unimobin", recurrence: "Mensal", pointsPossible: 10, pointsObtained: statusList[5] === "OK" ? 10 : 0, status: statusList[5], evidenceNotes: "Aguardando envio do relatório oficial de frotas pelo almoxarife." },
    { id: "7", number: "07", name: "Nível de Serviço", recurrence: "Mensal", pointsPossible: 5, pointsObtained: statusList[6] === "OK" ? 5 : 0, status: statusList[6], notes: statusList[6] === "NOK" ? "Atraso no fornecimento de peças críticas de manutenção." : undefined },
    { id: "8", number: "08", name: "Registro de Requisições", recurrence: "Mensal", pointsPossible: 5, pointsObtained: statusList[7] === "OK" ? 5 : 0, status: statusList[7] },
    { id: "9", number: "09", name: "Controle de Garantia", recurrence: "Mensal", pointsPossible: 5, pointsObtained: statusList[8] === "OK" ? 5 : 0, status: statusList[8] },
    { id: "10", number: "10", name: "Material Sem Movimentação", recurrence: "Semestral", pointsPossible: 5, pointsObtained: statusList[9] === "OK" ? 5 : 0, status: statusList[9] }
  ];
};

export const initialBranches: Branch[] = [
  // --- GRUPO A ---
  {
    id: "unitrans-jp",
    name: "ALMOXARIFADO UNITRANS JP",
    location: "João Pessoa, Paraíba",
    currentScore: 90,
    meta: 80,
    status: "OK",
    scoreCategory: "Excelente",
    ownerName: "Robson",
    group: "A",
    semestralScore: 240,
    criteria: getCriteriaForBranch(90)
  },
  {
    id: "santa-maria-jp",
    name: "SANTA MARIA JP",
    location: "João Pessoa, Paraíba",
    currentScore: 80,
    meta: 80,
    status: "OK",
    scoreCategory: "Bom",
    ownerName: "Robson",
    group: "A",
    semestralScore: 240, // 240 + 240 = 480 Total Semestral for Robson (JAN-MAI)
    criteria: getCriteriaForBranch(80)
  },
  {
    id: "expresso-nacional",
    name: "EXPRESSO NACIONAL",
    location: "Campina Grande, Paraíba",
    currentScore: 80,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Bom",
    ownerName: "Paulo",
    group: "A",
    semestralScore: 190,
    criteria: getCriteriaForBranch(80)
  },
  {
    id: "acandido-cg",
    name: "A.CÂNDIDO CG",
    location: "Campina Grande, Paraíba",
    currentScore: 70,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Médio",
    ownerName: "Paulo",
    group: "A",
    semestralScore: 190, // 190 + 190 = 380 Total Semestral for Paulo (JAN-MAI)
    criteria: getCriteriaForBranch(70)
  },
  {
    id: "fretamento-goiana",
    name: "FRETAMENTO GOIANA",
    location: "Goiana, Pernambuco",
    currentScore: 45,
    meta: 80,
    status: "NOK",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Ezequiel",
    group: "A",
    semestralScore: 330, // 330 Total Semestral for Ezequiel (JAN-MAI)
    criteria: getCriteriaForBranch(45)
  },
  {
    id: "fretamento-jaboatao",
    name: "FRETAMENTO JABOATÃO",
    location: "Jaboatão, Pernambuco",
    currentScore: 75,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Bom",
    ownerName: "Sérgio",
    group: "A",
    semestralScore: 185,
    criteria: getCriteriaForBranch(75)
  },
  {
    id: "rodoviario-jaboatao",
    name: "RODOVIÁRIO JABOATÃO",
    location: "Jaboatão, Pernambuco",
    currentScore: 65,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Médio",
    ownerName: "Sérgio",
    group: "A",
    semestralScore: 180, // 185 + 180 = 365 Total Semestral for Sérgio (JAN-MAI)
    criteria: getCriteriaForBranch(65)
  },

  // --- GRUPO B ---
  {
    id: "unissana-rn",
    name: "ALMOXARIFADO UNISSANA RN",
    location: "Natal, Rio Grande do Norte",
    currentScore: 50,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Médio",
    ownerName: "Raimundo",
    group: "B",
    semestralScore: 410, // 410 Total Semestral for Raimundo (JAN-MAI)
    criteria: getCriteriaForBranch(50)
  },
  {
    id: "reunidas-nat",
    name: "REUNIDAS TRANSPORTES NAT",
    location: "Natal, Rio Grande do Norte",
    currentScore: 90,
    meta: 80,
    status: "OK",
    scoreCategory: "Excelente",
    ownerName: "Joel",
    group: "B",
    semestralScore: 455, // 455 Total Semestral for Joel (JAN-MAI)
    criteria: getCriteriaForBranch(90)
  },
  {
    id: "fretamento-pb",
    name: "FRETAMENTO PB",
    location: "João Pessoa, Paraíba",
    currentScore: 85,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Bom",
    ownerName: "Lucas",
    group: "B",
    semestralScore: 390, // 390 Total Semestral for Lucas (JAN-MAI)
    criteria: getCriteriaForBranch(85)
  },
  {
    id: "trans-cg-bayeux",
    name: "TRANS CG BAYEUX",
    location: "Bayeux, Paraíba",
    currentScore: 70,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Bom",
    ownerName: "Matheus",
    group: "B",
    semestralScore: 215,
    criteria: getCriteriaForBranch(70)
  },
  {
    id: "rodoviario-cabedelo",
    name: "RODOVIÁRIO CABEDELO",
    location: "Cabedelo, Paraíba",
    currentScore: 70,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Médio",
    ownerName: "Matheus",
    group: "B",
    semestralScore: 215, // 215 + 215 = 430 Total Semestral for Matheus (JAN-MAI)
    criteria: getCriteriaForBranch(70)
  },
  {
    id: "fretamento-maracanau",
    name: "FRETAMENTO MARACANAU",
    location: "Maracanaú, Ceará",
    currentScore: 60,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Médio",
    ownerName: "Arline",
    group: "B",
    semestralScore: 155,
    criteria: getCriteriaForBranch(60)
  },
  {
    id: "rodoviario-fortaleza",
    name: "RODOVIÁRIO FORTALEZA",
    location: "Fortaleza, Ceará",
    currentScore: 60,
    meta: 80,
    status: "PENDENTE",
    scoreCategory: "Médio",
    ownerName: "Arline",
    group: "B",
    semestralScore: 150, // 155 + 150 = 305 Total Semestral for Arline (JAN-MAI)
    criteria: getCriteriaForBranch(60)
  }
];

export const initialHistory: AuditHistoryEntry[] = [
  { id: "h1", monthYear: "Maio 2026", type: "Mensal", score: 95, nokItems: ["Nível de Serviço"], auditedDetails: "Unidade auditada. Reclamação registrada de falta de filtros de linha técnica." },
  { id: "h2", monthYear: "Abril 2026", type: "Excelente", score: 100, nokItems: [], auditedDetails: "Desempenho excelente com 100% dos checklists em conformidade técnica." },
  { id: "h3", monthYear: "Março 2026", type: "Alerta", score: 80, nokItems: ["LayOut", "Curso Unimobin"], auditedDetails: "Falha de organização identificada na prateleira de conexões pneumáticas (LayOut) e pendência de cursos nas frotas." },
  { id: "h4", monthYear: "Fevereiro 2026", type: "Atenção", score: 95, nokItems: ["Nível de Serviço"], auditedDetails: "Ligeiro retardo de entrega de materiais cadastrada no módulo de Service Level." },
  { id: "h5", monthYear: "Janeiro 2026", type: "Excelente", score: 100, nokItems: [], auditedDetails: "Ciclo com fechamento semestral. Incluído de forma satisfatória os critérios adicionais de Inventário e Material Sem Movimentação sem pendências acumuladas." }
];

export const initialOccurrences: MaterialOccurrence[] = [
  { id: "occ-1", material: "Filtro de Combustível", date: "2026-05-10", status: "Comprado - Aguardando" },
  { id: "occ-2", material: "Pastilha de Freio", date: "2026-05-05", status: "Chegou" },
  { id: "occ-3", material: "Correia Dentada", date: "2026-05-01", status: "Sem Estoque Mín/Máx" }
];

export const initialWarranties: WarrantyItem[] = [
  {
    id: "war-1",
    itemCode: "1080571",
    itemDescription: "BATERIA 180 AMP",
    manufacturer: "MOURA",
    expiryDate: "2026-12-15",
    almoxarifado: "ALMOXARIFADO UNITRANS JP",
    nfEmissionDate: "2026-06-03",
    reference: "REF-BAT-99",
    lastUpdateDate: "2026-06-10",
    pieceObservation: "Bateria apresentou fuga de carga prematura em testes de bancada.",
    scrapObservation: "Sucata devolvida ao fornecedor.",
    monthYear: "Junho 2026"
  },
  {
    id: "war-2",
    itemCode: "1050177",
    itemDescription: "KIT EMBREAGEM 1722",
    manufacturer: "EATON",
    expiryDate: "2027-01-10",
    almoxarifado: "SANTA MARIA JP",
    nfEmissionDate: "2026-06-01",
    reference: "EMB-7722",
    lastUpdateDate: "2026-06-10",
    pieceObservation: "Nenhuma observação",
    scrapObservation: "Aguardando coleta física.",
    monthYear: "Junho 2026"
  }
];

const mapIdToNames: Record<string, string[]> = {
  "fretamento-maracanau": ["Arline"],
  "rodoviario-fortaleza": ["Arline"],
  "fretamento-jaboatao": ["Sérgio", "Alexandro", "Cristian"],
  "rodoviario-jaboatao": ["Sérgio", "Alexandro", "Cristian"],
  "unitrans-jp": ["Robson", "Cassiano", "João", "Wesley", "Jeferson"],
  "santa-maria-jp": ["Robson", "Cassiano", "João", "Wesley", "Jeferson"],
  "fretamento-pb": ["Lucas"],
  "fretamento-goiana": ["Ezequiel", "Leo"],
  "expresso-nacional": ["Paulo", "Wegeles", "Vagner"],
  "acandido-cg": ["Paulo", "Wegeles", "Vagner"],
  "trans-cg-bayeux": ["Matheus"],
  "rodoviario-cabedelo": ["Matheus"],
  "unissana-rn": ["Raimundo"],
  "reunidas-nat": ["Joel"]
};

export const initialCertificates: CollaboratorCertificate[] = [];

export function getCollaboratorsForBranch(branchId?: string, branchName?: string): CollaboratorCertificate[] {
  const bId = (branchId || "").toLowerCase().trim();
  const bName = (branchName || "").toLowerCase().trim();

  // Try retrieving from custom managed list first!
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = localStorage.getItem("acandido_all_collab_profiles");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const match = parsed.filter((c: any) => c.branchId === branchId);
          if (match.length > 0) {
            return match.map((profile: any, index: number) => ({
              id: profile.id || `collab-${index}-${profile.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")}`,
              name: profile.name,
              status: "Aguardando envio" as const
            }));
          }
        }
      } catch (e) {
        // Safe catch
      }
    }
  }

  let names: string[] = [];

  if (mapIdToNames[bId]) {
    names = mapIdToNames[bId];
  } else {
    // Fallback based on substrings
    if (bId.includes("maracanau") || bName.includes("maracanau")) {
      names = ["Arline"];
    } else if (bId.includes("fortaleza") || bName.includes("fortaleza")) {
      names = ["Arline"];
    } else if (bId.includes("jaboatao") || bName.includes("jaboatão") || bName.includes("jaboatao")) {
      names = ["Sérgio", "Alexandro", "Cristian"];
    } else if (bId.includes("unitrans") || bName.includes("unitrans")) {
      names = ["Robson", "Cassiano", "João", "Wesley", "Jeferson"];
    } else if (bId.includes("santa-maria") || bName.includes("santa maria")) {
      names = ["Robson", "Cassiano", "João", "Wesley", "Jeferson"];
    } else if (bId.includes("pb") || bName.includes("pb")) {
      names = ["Lucas"];
    } else if (bId.includes("goiana") || bName.includes("goiana")) {
      names = ["Ezequiel", "Leo"];
    } else if (bId.includes("expresso") || bId.includes("nacional") || bName.includes("nacional")) {
      names = ["Paulo", "Wegeles", "Vagner"];
    } else if (bId.includes("acandido") || bId.includes("candido") || bName.includes("cândido") || bName.includes("candido")) {
      names = ["Paulo", "Wegeles", "Vagner"];
    } else if (bId.includes("bayeux") || bName.includes("bayeux") || bId.includes("trans-cg")) {
      names = ["Matheus"];
    } else if (bId.includes("cabedelo") || bName.includes("cabedelo")) {
      names = ["Matheus"];
    } else if (bId.includes("unissana") || bName.includes("unissana")) {
      names = ["Raimundo"];
    } else if (bId.includes("reunidas") || bName.includes("reunidas")) {
      names = ["Joel"];
    } else {
      names = ["Sérgio", "Alexandro", "Cristian"];
    }
  }

  return names.map((name, index) => ({
    id: `collab-${index}-${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")}`,
    name,
    status: "Aguardando envio" as const
  }));
}

export const initialInventoryItems: InventoryItemToCount[] = [
  { code: "1080571", name: "BATERIA 180 AMP", physicalCount: 0, visualEvidenceUploaded: false },
  { code: "1050177", name: "KIT EMBREAGEM 1722", physicalCount: 0, visualEvidenceUploaded: false },
  { code: "1081086", name: "ALTERNADOR BOSCH 24V 150AMP", physicalCount: 0, visualEvidenceUploaded: false },
  { code: "1080901", name: "ALTERNADOR 24V 80 AMP", physicalCount: 0, visualEvidenceUploaded: false },
  { code: "1140356", name: "COMPRESSOR AR CONDICIONADO TM", physicalCount: 0, visualEvidenceUploaded: false },
  { code: "1091094", name: "TENSOR CORREIA ALTERNADOR MB O500", physicalCount: 0, visualEvidenceUploaded: false },
  { code: "1090604", name: "TURBINA 1721 EURO 5 NOVA", physicalCount: 0, visualEvidenceUploaded: false },
  { code: "1090667", name: "BOMBA DO ARLA EURO 5", physicalCount: 0, visualEvidenceUploaded: false },
  { code: "1091730", name: "BOMBA DO ARLA EURO 6", physicalCount: 0, visualEvidenceUploaded: false }
];
