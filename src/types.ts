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
  scoreCategory: "Excelente" | "Médio" | "Bom" | "Crítico" | "Abaixo da Meta" | "Parcial" | "Regular";
  criteria: CriterionState[];
  ownerName: string;
  group: "A" | "B";
  semestralScore: number;
  isInventarioScheduledThisMonth?: boolean;
  pointsObtainedSum?: number;
  maxAuditablePoints?: number;
}

export interface MaterialOccurrence {
  id: string;
  material: string;
  date: string;
  status: "Comprado - Aguardando" | "Chegou" | "Sem Estoque Mín/Máx" | "Outro" | "RESOLVIDO" | "MATERIAL NO ALMOXARIFADO" | "COMPRADO, ESPERANDO CHEGAR" | "CIENTE" | "EM ABERTO" | "SOLICITADO" | "CANCELADO";
  obs?: string;
  branchId?: string;
  branchName?: string;
  veiculo?: string;
  solicitante?: string;
  codigoMaterial?: string;
  filial?: string;
  timestamp?: number;
  resolvedAt?: string;
  dias_aberto?: number;
  registrado_por?: string;
}

export interface WarrantyItem {
  id: string;
  itemCode: string;
  itemDescription: string;
  manufacturer: string;
  expiryDate: string;
  almoxarifado: string;
  nfEmissionDate: string;
  data_emissao_nf?: string;
  data_nf?: string;
  dataNf?: string;
  reference: string;
  referencia_item?: string;
  referencia?: string;
  lastUpdateDate: string;
  pieceObservation: string;
  scrapObservation: string;
  observacao_peca?: string;
  observacao_sucata?: string;
  observacao?: string;
  monthYear: string;
  createdAt?: string;
  registeredBy?: string;
  registrado_por?: string;
  anexo_url?: string;
  anexo_base64?: string;
  arquivo_base64?: string;
  anexo_nome?: string;
  notaFiscal?: string;
  nota_fiscal?: string;
  veiculo?: string;
  localizacao?: string;
  fabricante?: string;
  garantia_ate?: string;
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

export interface Top10Item {
  code: string;
  description: string;
  name?: string;
  localizacao?: string;
  qty?: number;
}

export interface AppUser {
  id?: string | number;
  name: string;
  role: "ADMIN" | "ALMOXARIFE" | "SUPERVISOR";
  email: string;
  ownerName: string;
  group: "A" | "B";
  password?: string;
  senha_hash?: string;
  status?: "ATIVO" | "SUSPENSO" | "DESATIVADO";
  almoxarifados?: string[];
  cargo?: string;
}

export type AppUserRole = "ROBSON" | "ADMIN";

export interface AuditHistoryEntry {
  id: string;
  almoxarifado_id?: string;
  branchId?: string;
  branchName?: string;
  mes?: string;
  ano?: string;
  monthYear: string;
  type?: "Mensal" | "Excelente" | "Alerta" | "Atenção" | "Avaliação Semestral" | "Bom";
  score: number;
  pontuacao_total?: number;
  scoreCategory?: string;
  status_ciclo?: string;
  status?: string;
  fechado_em?: string;
  dateEvaluated?: string;
  auditorName?: string;
  nokItems: string[];
  auditedDetails?: string;
  criterios?: any[];
  criteriaState?: CriterionState[];
}
