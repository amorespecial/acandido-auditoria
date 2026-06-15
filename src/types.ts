export type EvaluationStatus = "OK" | "PENDENTE" | "NOK" | "AGUARDANDO ENVIO" | "ENVIADO";

export interface CriterionState {
  id: string;
  number: string;
  name: string;
  recurrence: "Mensal" | "Semestral";
  pointsPossible: number;
  pointsObtained: number;
  status: EvaluationStatus;
  notes?: string;
  evidenceNotes?: string;
  submittedAt?: string;
  submittedPhotos?: string[];
  top10AlmoxarifeQuantities?: number[];
  top10AuditorQuantities?: number[];
  rawStatus?: EvaluationStatus;
  rawPointsObtained?: number;
  auditMode?: "Presencial" | "A_Distancia";
  nokEvidenceLink?: string;
  nokEvidenceDescription?: string;
  nokEvidenceFileName?: string;
  nokEvidenceFileType?: string;
  nokEvidenceFileData?: string;
  nokEvidenceLinks?: string[];
  isAguardandoRealizacao?: boolean;
  isAguardandoFechamento?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  currentScore: number;
  meta: number;
  status: "OK" | "PENDENTE" | "NOK";
  scoreCategory: "Excelente" | "Médio" | "Bom" | "Crítico" | "Abaixo da Meta";
  criteria: CriterionState[];
  ownerName: string;
  group: "A" | "B";
  semestralScore: number;
  pointsObtainedSum?: number;
  maxAuditablePoints?: number;
}

export interface MaterialOccurrence {
  id: string;
  material: string;
  date: string;
  status: "Comprado - Aguardando" | "Chegou" | "Sem Estoque Mín/Máx" | "Outro" | "RESOLVIDO" | "MATERIAL NO ALMOXARIFADO" | "COMPRADO, ESPERANDO CHEGAR" | "CIENTE";
  obs?: string;
  branchId?: string;
  branchName?: string;
  veiculo?: string;
  solicitante?: string;
  codigoMaterial?: string;
  filial?: string;
  timestamp?: number;
  resolvedAt?: string;
  [key: string]: any;
}

export interface WarrantyItem {
  id: string;
  itemCode: string;
  itemDescription: string;
  manufacturer: string;
  expiryDate: string;
  almoxarifado: string;
  nfEmissionDate: string;
  reference: string;
  lastUpdateDate: string;
  pieceObservation: string;
  scrapObservation: string;
  monthYear: string;
  createdAt?: string;
}

export interface CollaboratorCertificate {
  id: string;
  name: string;
  status: "Aguardando envio" | "Certificado enviado";
  uploadedAt?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileData?: string;
}

export interface InventoryItemToCount {
  code: string;
  name: string;
  physicalCount: number;
  visualEvidenceUploaded: boolean;
}

export interface AppUser {
  id?: any;
  name: string;
  role: "ADMIN" | "ALMOXARIFE" | "SUPERVISOR";
  email: string;
  ownerName: string;
  group: "A" | "B";
  password?: string;
  status?: "ATIVO" | "SUSPENSO" | "DESATIVADO";
  almoxarifados?: string[];
  cargo?: string;
}

export type AppUserRole = "ROBSON" | "ADMIN";

export interface AuditHistoryEntry {
  id: string;
  monthYear: string;
  type: "Mensal" | "Excelente" | "Alerta" | "Atenção" | "Avaliação Semestral";
  score: number;
  nokItems: string[];
  auditedDetails?: string;
}
