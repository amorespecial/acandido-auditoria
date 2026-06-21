import { Branch, AuditHistoryEntry, MaterialOccurrence, WarrantyItem, CollaboratorCertificate, InventoryItemToCount, CriterionState, EvaluationStatus } from "./types";

const getCriteriaForBranch = (score: number = 0): CriterionState[] => {
  if (score === 0) {
    return [
      { id: "1", number: "01", name: "Inventário", recurrence: "Semestral", pointsPossible: 20, pointsObtained: 0, status: "PENDENTE" },
      { id: "2", number: "02", name: "TOP 10", recurrence: "Mensal", pointsPossible: 20, pointsObtained: 0, status: "PENDENTE" },
      { id: "3", number: "03", name: "Nota Fiscal", recurrence: "Mensal", pointsPossible: 10, pointsObtained: 0, status: "PENDENTE" },
      { id: "4", number: "04", name: "LayOut", recurrence: "Mensal", pointsPossible: 10, pointsObtained: 0, status: "PENDENTE" },
      { id: "5", number: "05", name: "Recebimento de Material", recurrence: "Mensal", pointsPossible: 10, pointsObtained: 0, status: "PENDENTE" },
      { id: "6", number: "06", name: "Curso Unimobin", recurrence: "Mensal", pointsPossible: 10, pointsObtained: 0, status: "PENDENTE" },
      { id: "7", number: "07", name: "Nível de Serviço", recurrence: "Mensal", pointsPossible: 5, pointsObtained: 0, status: "PENDENTE" },
      { id: "8", number: "08", name: "Registro de Requisições", recurrence: "Mensal", pointsPossible: 5, pointsObtained: 0, status: "PENDENTE" },
      { id: "9", number: "09", name: "Controle de Garantia", recurrence: "Mensal", pointsPossible: 5, pointsObtained: 0, status: "PENDENTE" },
      { id: "10", number: "10", name: "Material Sem Movimentação", recurrence: "Semestral", pointsPossible: 5, pointsObtained: 0, status: "PENDENTE" }
    ];
  }

  // score is guaranteed to be a multiple of 5: 5, 10, ..., 100.
  const statusList: EvaluationStatus[] = Array(10).fill("PENDENTE");
  const weights = [20, 20, 10, 10, 10, 10, 5, 5, 5, 5];
  let remaining = score;
  
  for (let i = 0; i < weights.length; i++) {
    if (remaining >= weights[i]) {
      statusList[i] = "OK" as const;
      remaining -= weights[i];
    } else {
      statusList[i] = "PENDENTE" as const;
    }
  }

  return [
    { id: "1", number: "01", name: "Inventário", recurrence: "Semestral", pointsPossible: 20, pointsObtained: statusList[0] === "OK" ? 20 : 0, status: statusList[0] },
    { id: "2", number: "02", name: "TOP 10", recurrence: "Mensal", pointsPossible: 20, pointsObtained: statusList[1] === "OK" ? 20 : 0, status: statusList[1] },
    { id: "3", number: "03", name: "Nota Fiscal", recurrence: "Mensal", pointsPossible: 10, pointsObtained: statusList[2] === "OK" ? 10 : 0, status: statusList[2] },
    { id: "4", number: "04", name: "LayOut", recurrence: "Mensal", pointsPossible: 10, pointsObtained: statusList[3] === "OK" ? 10 : 0, status: statusList[3] },
    { id: "5", number: "05", name: "Recebimento de Material", recurrence: "Mensal", pointsPossible: 10, pointsObtained: statusList[4] === "OK" ? 10 : 0, status: statusList[4] },
    { id: "6", number: "06", name: "Curso Unimobin", recurrence: "Mensal", pointsPossible: 10, pointsObtained: statusList[5] === "OK" ? 10 : 0, status: statusList[5] },
    { id: "7", number: "07", name: "Nível de Serviço", recurrence: "Mensal", pointsPossible: 5, pointsObtained: statusList[6] === "OK" ? 5 : 0, status: statusList[6] },
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
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Robson",
    group: "A",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "santa-maria-jp",
    name: "SANTA MARIA JP",
    location: "João Pessoa, Paraíba",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Robson",
    group: "A",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "expresso-nacional",
    name: "TRANS CG",
    location: "Campina Grande, Paraíba",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Paulo",
    group: "A",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "acandido-cg",
    name: "A.CÂNDIDO CG",
    location: "Campina Grande, Paraíba",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Paulo",
    group: "A",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "fretamento-goiana",
    name: "FRETAMENTO GOIANA",
    location: "Goiana, Pernambuco",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Ezequiel",
    group: "A",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "fretamento-jaboatao",
    name: "FRETAMENTO JABOATÃO",
    location: "Jaboatão, Pernambuco",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Sérgio",
    group: "A",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "rodoviario-jaboatao",
    name: "RODOVIÁRIO JABOATÃO",
    location: "Jaboatão, Pernambuco",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Sérgio",
    group: "A",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },

  // --- GRUPO B ---
  {
    id: "unissana-rn",
    name: "ALMOXARIFADO UNISSANA RN",
    location: "Natal, Rio Grande do Norte",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Raimundo",
    group: "B",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "reunidas-nat",
    name: "REUNIDAS TRANSPORTES NAT",
    location: "Natal, Rio Grande do Norte",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Joel",
    group: "B",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "fretamento-pb",
    name: "FRETAMENTO PB",
    location: "João Pessoa, Paraíba",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Lucas",
    group: "B",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "trans-cg-bayeux",
    name: "TRANS CG BAYEUX",
    location: "Bayeux, Paraíba",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Matheus",
    group: "B",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "rodoviario-cabedelo",
    name: "RODOVIÁRIO CABEDELO",
    location: "Cabedelo, Paraíba",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Matheus",
    group: "B",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "fretamento-maracanau",
    name: "FRETAMENTO MARACANAU",
    location: "Maracanaú, Ceará",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Arline",
    group: "B",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  },
  {
    id: "rodoviario-fortaleza",
    name: "RODOVIÁRIO FORTALEZA",
    location: "Fortaleza, Ceará",
    currentScore: 0,
    meta: 100,
    status: "PENDENTE",
    scoreCategory: "Abaixo da Meta",
    ownerName: "Arline",
    group: "B",
    semestralScore: 0,
    criteria: getCriteriaForBranch(0)
  }
];

export const initialHistory: AuditHistoryEntry[] = [];

export const initialOccurrences: MaterialOccurrence[] = [];

export const initialWarranties: WarrantyItem[] = [];

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
    } else if (bId.includes("expresso") || bId.includes("nacional") || bName.includes("nacional") || bName.includes("trans") || bName.includes("cg")) {
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
