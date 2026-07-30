import { supabase, isSupabaseReady, realtimeFlags } from "./supabaseClient";
export { isSupabaseReady };
import { AppUser, Branch, CriterionState, WarrantyItem, MaterialOccurrence, EvaluationStatus, CollaboratorCertificate } from "./types";
import { getCurrentUser, requirePermission } from "./authorization";
import { getCriteriaForBranch } from "./mockData";
import bcrypt from "bcryptjs";

const STORAGE_PREFIX = "acandido_";

// Month helper functions
export const MONTH_NAME_TO_NUM: Record<string, number> = {
  "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3,
  "abril": 4, "maio": 5, "junho": 6, "julho": 7,
  "agosto": 8, "setembro": 9, "outubro": 10,
  "novembro": 11, "dezembro": 12,
  "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
  "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
  "1": 1, "01": 1, "2": 2, "02": 2, "3": 3, "03": 3, "4": 4, "04": 4,
  "5": 5, "05": 5, "6": 6, "06": 6, "7": 7, "07": 7, "8": 8, "08": 8,
  "9": 9, "09": 9, "10": 10, "11": 11, "12": 12
};

export const MONTH_NUM_TO_NAME: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
  5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
  9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
};

export const MONTH_NORMALIZE: Record<string, string> = {
  "1": "Janeiro", "01": "Janeiro", "janeiro": "Janeiro",
  "2": "Fevereiro", "02": "Fevereiro", "fevereiro": "Fevereiro",
  "3": "Março", "03": "Março", "marco": "Março", "março": "Março",
  "4": "Abril", "04": "Abril", "abril": "Abril",
  "5": "Maio", "05": "Maio", "maio": "Maio",
  "6": "Junho", "06": "Junho", "junho": "Junho",
  "7": "Julho", "07": "Julho", "julho": "Julho",
  "8": "Agosto", "08": "Agosto", "agosto": "Agosto",
  "9": "Setembro", "09": "Setembro", "setembro": "Setembro",
  "10": "Outubro", "outubro": "Outubro",
  "11": "Novembro", "novembro": "Novembro",
  "12": "Dezembro", "dezembro": "Dezembro"
};

export const monthNameToNum = (name: string): number => {
  const normInput = String(name || "").toLowerCase().trim();
  return MONTH_NAME_TO_NUM[normInput] || 1;
};

export const monthNumToName = (num: number): string => {
  return MONTH_NUM_TO_NAME[num] || "Janeiro";
};

// Base64 to Blob helper
export const base64ToBlob = (base64: string): Blob => {
  try {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'image/jpeg';
    const raw = window.atob(parts[1] || parts[0]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.error("Failed to parse base64 to blob", e);
    return new Blob([], { type: 'image/jpeg' });
  }
};

// Supabase Storage file upload helper with signed URL (1 hour expiration)
export const uploadFile = async (
  bucket: 'evidencias-almoxarife' | 'evidencias-auditor',
  filePath: string,
  fileSource: File | Blob | string // string means base64
): Promise<string> => {
  try {
    let blob: Blob;
    if (typeof fileSource === 'string') {
      blob = base64ToBlob(fileSource);
    } else {
      blob = fileSource;
    }

    const cleanPath = filePath.replace(/^\/+/, ''); // remove leading slash

    if (!isSupabaseReady()) {
      console.warn(`[Supabase Storage Offline] Simulating upload of ${cleanPath} to bucket: ${bucket}`);
      if (typeof fileSource === 'string' && fileSource.startsWith('data:')) {
        return fileSource;
      }
      return `https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600`;
    }

    const { error } = await supabase.storage.from(bucket).upload(cleanPath, blob, {
      cacheControl: '3600',
      upsert: true
    });

    if (error) {
      console.error(`Error uploading to Supabase Storage (${bucket}):`, error);
      throw new Error(`Falha no upload do arquivo: ${error.message || "Erro de envio no Storage"}`);
    }

    const { data, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanPath, 3600);

    if (signedError || !data?.signedUrl) {
      console.error("Error creating signed URL:", signedError);
      throw signedError || new Error("Falha ao gerar URL assinada do arquivo");
    }

    return data.signedUrl;
  } catch (err: any) {
    console.error(`[uploadFile Exception] Bucket: ${bucket}, Path: ${filePath}:`, err);
    throw err instanceof Error ? err : new Error(String(err?.message || "Erro ao realizar upload do arquivo."));
  }
};

// ==========================================
// ROLE AND PERMISSION VALIDATION HELPERS (FASE 7)
// ==========================================
export const getRequesterRole = (): string | null => {
  const user = getCurrentUser();
  return user?.role || null;
};

export const checkPermission = (allowedRoles: string[], requesterRole?: string) => {
  const user = getCurrentUser();
  if (user) {
    requirePermission(allowedRoles, user);
  } else if (requesterRole) {
    if (!allowedRoles.includes(requesterRole)) {
      throw new Error(`Acesso negado: O perfil '${requesterRole}' não possui permissão para executar esta operação.`);
    }
  } else {
    throw new Error("Acesso negado: Usuário não autenticado no sistema.");
  }
};

export const normalizeCycleStatus = (val: any): CycleState['status'] => {
  const s = String(val || "").toUpperCase().trim();
  if (s === "ABERTO") return "ABERTO";
  if (s === "AGUARDANDO_FECHAMENTO") return "AGUARDANDO_FECHAMENTO";
  if (s === "FECHADO") return "FECHADO";
  if (s === "ARQUIVADO") return "ARQUIVADO";
  if (s === "NENHUM") return "NENHUM";
  return "NENHUM";
};
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Auto Seeding function
export const seedDatabaseIfEmpty = async () => {
  if (!isSupabaseReady()) {
    return;
  }

  try {
    const { data: existingUsers, error: usersError } = await supabase.from('usuarios').select('email');
    const hasFernando = existingUsers && existingUsers.some(u => u.email.toLowerCase().trim() === "estoque01jp@gmail.com");
    
    if (usersError || !existingUsers || existingUsers.length === 0 || !hasFernando) {
      console.log("Seeding system users table ('usuarios') with complete profiles...");
      const defaultSalt = bcrypt.genSaltSync(10);
      const defaultHash = bcrypt.hashSync("123456", defaultSalt);
      const INITIAL_SEED_USERS = [
        { nome: "Fernando Silva", email: "estoque01jp@gmail.com", perfil: "auditor", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Auditor Geral", group: "A", ownerName: "Fernando", almoxarifados: [] }), ativo: true },
        { nome: "Natalice Oliveira", email: "estoquejp@acandidotransportes.com.br", perfil: "auditor", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Auditor Geral", group: "A", ownerName: "Natalice Oliveira", almoxarifados: [] }), ativo: true },
        { nome: "Robson", email: "almoxarifadojp@acandidotransportes.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "A", ownerName: "Robson", almoxarifados: ["unitrans-jp", "santa-maria-jp"] }), ativo: true },
        { nome: "Robson Jaboatão", email: "robson.almoxarife@acandidogrupo.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife Jaboatão", group: "A", ownerName: "Robson Jaboatão", almoxarifados: ["fretamento-jaboatao", "rodoviario-jaboatao"] }), ativo: true },
        { nome: "Muniz", email: "muniz.jabo@acandidotransportes.com.br", perfil: "supervisor", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Supervisor de Manutenção", group: "A", ownerName: "Muniz", almoxarifados: ["fretamento-jaboatao", "rodoviario-jaboatao"] }), ativo: true },
        { nome: "Glebson", email: "glebson.jabo@acandidotransportes.com.br", perfil: "supervisor", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Supervisor de Manutenção", group: "A", ownerName: "Glebson", almoxarifados: ["fretamento-jaboatao", "rodoviario-jaboatao"] }), ativo: true },
        { nome: "Paulo", email: "comprascg@acandidotransportes.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "A", ownerName: "Paulo", almoxarifados: ["expresso-nacional", "acandido-cg"] }), ativo: true },
        { nome: "Ezequiel", email: "almoxarifadogo@transnacionalfretamento.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "A", ownerName: "Ezequiel", almoxarifados: ["fretamento-goiana"] }), ativo: true },
        { nome: "Sérgio", email: "almoxarifadope01@transnacionalfretamento.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "A", ownerName: "Sérgio", almoxarifados: ["fretamento-jaboatao", "rodoviario-jaboatao"] }), ativo: true },
        { nome: "Raimundo", email: "almoxarifadorn@acandidotransportes.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "B", ownerName: "Raimundo", almoxarifados: ["unissana-rn"] }), ativo: true },
        { nome: "Joel", email: "ti02rn@acandidotransportes.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "B", ownerName: "Joel", almoxarifados: ["reunidas-nat"] }), ativo: true },
        { nome: "Lucas", email: "fretamentojoaopessoa@gmail.com", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "B", ownerName: "Lucas", almoxarifados: ["fretamento-pb"] }), ativo: true },
        { nome: "Matheus", email: "almoxarifadobayeux@rodoviarionordestino.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "B", ownerName: "Matheus", almoxarifados: ["trans-cg-bayeux", "rodoviario-cabedelo"] }), ativo: true },
        { nome: "Arline", email: "almoxarifadoce@transnacionalfretamento.com.br", perfil: "almoxarife", senha_hash: defaultHash, almoxarifado: JSON.stringify({ cargo: "Almoxarife", group: "B", ownerName: "Arline", almoxarifados: ["fretamento-maracanau", "rodoviario-fortaleza"] }), ativo: true }
      ];
      await supabase.from('usuarios').upsert(INITIAL_SEED_USERS, { onConflict: 'email' });
    }

    const { data: existingCal, error: calError } = await supabase.from('calendario_inventarios').select('id').limit(1);
    if (!calError && (!existingCal || existingCal.length === 0)) {
      console.log("Seeding 2026 inventory schedule table ('calendario_inventarios')...");
      const CALENDAR_ENTRIES_2026 = [
        { almoxarifado: "unitrans-jp", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-06-26", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "unitrans-jp", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-11-27", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "santa-maria-jp", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-06-26", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "santa-maria-jp", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-11-27", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "expresso-nacional", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-17", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "expresso-nacional", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-07-18", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "acandido-cg", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-17", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "acandido-cg", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-07-18", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "trans-cg-bayeux", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-10", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "trans-cg-bayeux", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-08-12", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "rodoviario-cabedelo", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-10", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "rodoviario-cabedelo", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-08-12", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "fretamento-maracanau", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-06-09", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "fretamento-maracanau", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-11-10", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "rodoviario-fortaleza", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-06-09", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "rodoviario-fortaleza", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-11-10", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "fretamento-goiana", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-05-16", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "fretamento-goiana", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-31", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "fretamento-pb", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-03", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "fretamento-pb", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-23", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "fretamento-jaboatao", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-04-24", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "fretamento-jaboatao", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-16", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "rodoviario-jaboatao", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-04-24", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "rodoviario-jaboatao", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-16", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "reunidas-nat", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-07", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "reunidas-nat", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-26", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "unissana-rn", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-06", status: "PENDENTE", sequencia: "#1" },
        { almoxarifado: "unissana-rn", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-25", status: "PENDENTE", sequencia: "#1" }
      ];
      await supabase.from('calendario_inventarios').upsert(CALENDAR_ENTRIES_2026, { onConflict: 'almoxarifado,ano,semestre,indice' });
    }
  } catch (e) {
    console.error("Auto seeding exception:", e);
  }
};

// ======================= USERS (usuarios) =======================
export interface MigrationReport {
  totalFound: number;
  migratedCount: number;
  ignoredCount: number;
  errorCount: number;
  errors: string[];
}

export const dbMigrateUsersPasswords = async (requesterRole?: string): Promise<MigrationReport> => {
  checkPermission(["ADMIN"], requesterRole);
  const report: MigrationReport = {
    totalFound: 0,
    migratedCount: 0,
    ignoredCount: 0,
    errorCount: 0,
    errors: []
  };

  if (!isSupabaseReady()) {
    report.errors.push("Supabase não está configurado.");
    return report;
  }

  try {
    const { data: users, error } = await supabase.from("usuarios").select("id, email, nome, perfil, senha_hash, almoxarifado, ativo");
    if (error) {
      throw error;
    }

    if (!users || users.length === 0) {
      return report;
    }

    report.totalFound = users.length;

    for (const u of users) {
      const email = u.email ? u.email.toLowerCase().trim() : "";
      const nome = u.nome || "Sem Nome";

      // Check if already has a valid bcrypt password hash
      const hasHash = u.senha_hash && (
        u.senha_hash.startsWith("$2a$") || 
        u.senha_hash.startsWith("$2b$") || 
        u.senha_hash.startsWith("$2y$")
      );

      if (hasHash) {
        report.ignoredCount++;
        continue;
      }

      // Recover plain password from almoxarifado JSON if any legacy exists
      let plainPassword = "";
      if (u.almoxarifado && typeof u.almoxarifado === "string" && u.almoxarifado.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(u.almoxarifado);
          plainPassword = parsed.password || "";
        } catch (e) {}
      }

      if (!plainPassword) {
        plainPassword = "123456"; // Default safe fallback
      }

      try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(plainPassword, salt);

        const { error: updateError } = await supabase
          .from("usuarios")
          .update({ senha_hash: hash })
          .eq("id", u.id);

        if (updateError) {
          throw updateError;
        }

        report.migratedCount++;
      } catch (err: any) {
        report.errorCount++;
        report.errors.push(`${nome} (${email}): ${err.message || JSON.stringify(err)}`);
      }
    }
  } catch (err: any) {
    report.errors.push(`Erro geral durante a migração: ${err.message || JSON.stringify(err)}`);
  }

  return report;
};

export interface CleanupReport {
  totalUsers: number;
  cleanedCount: number;
  alreadyCleanedCount: number;
  errorCount: number;
  errors: string[];
}

export const dbCleanupLegacyPlainPasswords = async (requesterRole?: string): Promise<CleanupReport> => {
  checkPermission(["ADMIN"], requesterRole);
  const report: CleanupReport = {
    totalUsers: 0,
    cleanedCount: 0,
    alreadyCleanedCount: 0,
    errorCount: 0,
    errors: []
  };

  if (!isSupabaseReady()) {
    report.errors.push("Supabase não está configurado.");
    return report;
  }

  try {
    const { data: users, error } = await supabase.from("usuarios").select("id, email, nome, senha_hash, almoxarifado");
    if (error) {
      throw error;
    }

    if (!users || users.length === 0) {
      return report;
    }

    report.totalUsers = users.length;

    for (const u of users) {
      const email = u.email ? u.email.toLowerCase().trim() : "";
      const nome = u.nome || "Sem Nome";

      // Safety check: only clean if we have a valid bcrypt hash
      const hasHash = u.senha_hash && (
        u.senha_hash.startsWith("$2a$") || 
        u.senha_hash.startsWith("$2b$") || 
        u.senha_hash.startsWith("$2y$")
      );

      if (!hasHash) {
        report.errorCount++;
        report.errors.push(`${nome} (${email}): Usuário não possui senha_hash. Abortando limpeza para este usuário.`);
        continue;
      }

      let extra: any = {};
      let needsSaving = false;

      if (u.almoxarifado && typeof u.almoxarifado === "string" && u.almoxarifado.trim().startsWith("{")) {
        try {
          extra = JSON.parse(u.almoxarifado);
        } catch (e) {
          report.errorCount++;
          report.errors.push(`${nome} (${email}): Erro ao parsear JSON almoxarifado.`);
          continue;
        }
      }

      // If password field is present and has ANY non-empty value, we clear it!
      if (extra && extra.password !== undefined && extra.password !== "") {
        extra.password = "";
        needsSaving = true;
      }

      if (needsSaving) {
        const { error: updateError } = await supabase
          .from("usuarios")
          .update({ almoxarifado: JSON.stringify(extra) })
          .eq("id", u.id);

        if (updateError) {
          throw updateError;
        }

        report.cleanedCount++;
      } else {
        report.alreadyCleanedCount++;
      }
    }
  } catch (err: any) {
    report.errorCount++;
    report.errors.push(`Erro geral durante a limpeza: ${err.message || JSON.stringify(err)}`);
  }

  return report;
};

export const validateUserPassword = (
  passwordEntered: string,
  senhaHash?: string
): boolean => {
  if (!passwordEntered) return false;

  // Validate exclusively using bcrypt.compareSync
  if (senhaHash && (senhaHash.startsWith("$2a$") || senhaHash.startsWith("$2b$") || senhaHash.startsWith("$2y$"))) {
    try {
      return bcrypt.compareSync(passwordEntered, senhaHash);
    } catch (err) {
      console.error("Error in bcrypt comparison:", err);
    }
  }

  return false;
};

export const dbValidateLogin = async (emailInput: string, passwordInput: string): Promise<AppUser | null> => {
  if (!isSupabaseReady()) {
    throw new Error("Supabase não está configurado.");
  }

  const cleanEmail = emailInput.toLowerCase().trim();

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, perfil, almoxarifado, ativo, senha_hash')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar usuário para login no Supabase:", error);
    throw new Error("Erro de conexão ao buscar usuário.");
  }

  if (!data) {
    return null; // Usuário não encontrado
  }

  const isPasswordCorrect = validateUserPassword(passwordInput, data.senha_hash);
  if (!isPasswordCorrect) {
    throw new Error("Senha incorreta.");
  }

  let extra: any = {};
  if (data.almoxarifado && typeof data.almoxarifado === "string" && data.almoxarifado.trim().startsWith("{")) {
    try {
      extra = JSON.parse(data.almoxarifado);
    } catch (e) {
      console.warn("Could not parse extra payload from user almoxarifado column:", e);
    }
  }

  const cargo = extra.cargo || "";
  const almoxarifados = extra.almoxarifados || [];
  const group = extra.group || "A";
  const ownerName = extra.ownerName || data.nome.split(" ")[0];

  return {
    id: data.id,
    name: data.nome,
    email: data.email,
    role: data.perfil === "auditor" ? "ADMIN" : data.perfil === "supervisor" ? "SUPERVISOR" : "ALMOXARIFE",
    ownerName: ownerName,
    group: group,
    status: data.ativo ? "ATIVO" : "DESATIVADO",
    almoxarifados: almoxarifados || [],
    password: "",
    senha_hash: data.senha_hash || undefined,
    cargo: cargo
  };
};

export const dbFetchUsers = async (): Promise<AppUser[]> => {
  if (!isSupabaseReady()) {
    return [];
  }

  const { data, error } = await supabase.from('usuarios').select('id, nome, email, perfil, almoxarifado, ativo, senha_hash');
  if (error || !data) {
    return [];
  }

  return data.map(u => {
    let extra: any = {};
    if (u.almoxarifado && typeof u.almoxarifado === "string" && u.almoxarifado.trim().startsWith("{")) {
      try {
        extra = JSON.parse(u.almoxarifado);
      } catch (e) {
        console.warn("Could not parse extra payload from user almoxarifado column:", e);
      }
    }

    const cargo = extra.cargo || "";
    const almoxarifados = extra.almoxarifados || [];
    const group = extra.group || "A";
    const ownerName = extra.ownerName || u.nome.split(" ")[0];

    return {
      id: u.id,
      name: u.nome,
      email: u.email,
      role: u.perfil === "auditor" ? "ADMIN" : u.perfil === "supervisor" ? "SUPERVISOR" : "ALMOXARIFE",
      ownerName: ownerName,
      group: group,
      status: u.ativo ? "ATIVO" : "DESATIVADO",
      almoxarifados: almoxarifados || [],
      password: "", // ALWAYS empty, we never expose or read the plain password from database JSON anymore
      senha_hash: u.senha_hash || undefined,
      cargo: cargo
    };
  });
};

export const dbSaveUser = async (user: AppUser, requesterRole?: string) => {
  checkPermission(["ADMIN"], requesterRole);
  if (!isSupabaseReady()) {
    return;
  }

  const perf = user.role === "ADMIN" ? "auditor" : user.role === "SUPERVISOR" ? "supervisor" : "almoxarife";
  const cleanEmail = user.email.toLowerCase().trim();

  // Check if the user already exists in the database to distinguish between create and edit
  let existingUser: any = null;
  try {
    const { data } = await supabase
      .from('usuarios')
      .select('id, senha_hash, almoxarifado')
      .eq('email', cleanEmail);
    if (data && data.length > 0) {
      existingUser = data[0];
    }
  } catch (err) {
    console.error("Error querying existing user:", err);
  }

  let finalPasswordHash = user.senha_hash || (existingUser ? existingUser.senha_hash : undefined);

  if (user.password && user.password.trim() !== "") {
    // A password was typed (creation or edit/update). Hash it safely with bcryptjs.
    const salt = bcrypt.genSaltSync(10);
    finalPasswordHash = bcrypt.hashSync(user.password.trim(), salt);
  }

  const extraPayload = {
    cargo: user.cargo || "",
    group: user.group || "A",
    ownerName: user.ownerName || user.name.split(" ")[0],
    almoxarifados: user.almoxarifados || []
  };

  const payload: any = {
    id: user.id && String(user.id).length > 5 ? user.id : (existingUser ? existingUser.id : undefined),
    nome: user.name,
    email: cleanEmail,
    perfil: perf,
    almoxarifado: JSON.stringify(extraPayload),
    ativo: user.status !== "DESATIVADO"
  };

  if (finalPasswordHash) {
    payload.senha_hash = finalPasswordHash;
  }

  const { error } = await supabase.from('usuarios').upsert(payload, { onConflict: 'email' });
  if (error) {
    throw error;
  }
};

export const dbDeleteUser = async (email: string, id?: any, requesterRole?: string) => {
  checkPermission(["ADMIN"], requesterRole);
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    let query = supabase.from('usuarios').delete();
    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('email', email.toLowerCase().trim());
    }
    const { error } = await query;
    if (error) throw error;
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= CYCLES (ciclos) =======================
export interface CycleState {
  activeMonth: string;
  activeYear: string;
  status: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM" | "ARQUIVADO";
  openedAt?: string;
  openedBy?: string;
}

export async function dbGetCicloAtivo() {
  const { data } = await supabase
    .from('ciclos')
    .select('id, mes, ano, status, iniciado_em, iniciado_por')
    .eq('status', 'ABERTO')
    .single();
  return data;
}

export async function dbAbrirCiclo(mes: string, ano: string, aberto_por: string, requesterRole?: string) {
  checkPermission(["ADMIN"], requesterRole);
  const { data, error } = await supabase
    .from('ciclos')
    .upsert({ mes, ano, status: 'ABERTO', iniciado_por: aberto_por, iniciado_em: new Date().toISOString() })
    .select('id, mes, ano, status, iniciado_em, iniciado_por').single();
  if (error) throw error;
  return data;
}

export async function dbFecharCiclo(mes: string, ano: string, requesterRole?: string) {
  checkPermission(["ADMIN"], requesterRole);
  const { error } = await supabase
    .from('ciclos')
    .update({ status: 'FECHADO', fechado_em: new Date().toISOString() })
    .eq('mes', mes).eq('ano', ano);
  if (error) throw error;
}

export const dbFetchCycleState = async (): Promise<CycleState> => {
  const defaultState: CycleState = { activeMonth: "Janeiro", activeYear: "2026", status: "NENHUM" };
  
  if (!isSupabaseReady()) {
    return defaultState;
  }

  // Fetch the active cycle (ABERTO or aberto) from the database
  let { data, error } = await supabase
    .from('ciclos')
    .select('id, mes, ano, status, iniciado_em, aberto_em, iniciado_por, aberto_por')
    .in('status', ['ABERTO', 'aberto'])
    .order('iniciado_em', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    // Fetch critical locked cycle (AGUARDANDO_FECHAMENTO or aguardando_fechamento)
    const resBloq = await supabase
      .from('ciclos')
      .select('id, mes, ano, status, iniciado_em, aberto_em, iniciado_por, aberto_por')
      .in('status', ['AGUARDANDO_FECHAMENTO', 'aguardando_fechamento'])
      .order('iniciado_em', { ascending: false })
      .limit(1);
      
    if (!resBloq.error && resBloq.data && resBloq.data.length > 0) {
      data = resBloq.data;
    } else {
      // Fetch the latest cycle of all (e.g. FECHADO or ARQUIVADO)
      const resLatest = await supabase
        .from('ciclos')
        .select('id, mes, ano, status, iniciado_em, aberto_em, iniciado_por, aberto_por')
        .order('iniciado_em', { ascending: false })
        .limit(1);
        
      if (!resLatest.error && resLatest.data && resLatest.data.length > 0) {
        data = resLatest.data;
      }
    }
  }

  if (!data || data.length === 0) {
    return defaultState;
  }

  // Rule 3: Return exact DB status ("ABERTO", "AGUARDANDO_FECHAMENTO", "FECHADO") without any default overrides
  const current = data[0];
  
  // Normalize month integer or string
  let monthStr = "Janeiro";
  if (current.mes) {
    if (typeof current.mes === "number") {
      monthStr = monthNumToName(current.mes);
    } else {
      const num = parseInt(current.mes, 10);
      if (!isNaN(num)) {
        monthStr = monthNumToName(num);
      } else {
        monthStr = current.mes;
      }
    }
  }

  return {
    activeMonth: monthStr,
    activeYear: String(current.ano),
    status: normalizeCycleStatus(current.status),
    openedAt: current.iniciado_em || current.aberto_em,
    openedBy: current.iniciado_por || current.aberto_por
  };
};

export const dbSaveCycleState = async (cycle: CycleState, requesterRole?: string) => {
  try {
    checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  } catch (e) {
    console.warn("Permission warning in dbSaveCycleState:", e);
  }
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    
    // Convert string month to number (e.g. "Março" -> 3) and year to integer (e.g. "2026" -> 2026)
    const dbMesNum = typeof cycle.activeMonth === "string" ? monthNameToNum(cycle.activeMonth) : cycle.activeMonth;
    const dbAnoNum = typeof cycle.activeYear === "string" ? parseInt(cycle.activeYear, 10) : cycle.activeYear;

    let validIniciadoEm = new Date().toISOString();
    if (cycle.openedAt && typeof cycle.openedAt === "string" && cycle.openedAt.includes("-") && !isNaN(Date.parse(cycle.openedAt))) {
      validIniciadoEm = new Date(cycle.openedAt).toISOString();
    }

    const targetStatus = cycle.status === "NENHUM" ? "ABERTO" : cycle.status;

    const updateObj = {
      mes: dbMesNum,
      ano: dbAnoNum,
      status: targetStatus,
      iniciado_por: cycle.openedBy || "Fernando Silva",
      iniciado_em: validIniciadoEm,
      fechado_em: (targetStatus === "FECHADO" || targetStatus === "ARQUIVADO") ? new Date().toISOString() : null
    };

    console.log('[CICLO] dbSaveCycleState salvando:', updateObj);

    // Check if row exists by matching ano and mes (integer or string name)
    const { data: existingRows } = await supabase
      .from('ciclos')
      .select('id, mes, ano')
      .eq('ano', dbAnoNum);

    const matchRow = existingRows?.find(r => {
      const rMesNum = typeof r.mes === "number" ? r.mes : parseInt(r.mes, 10);
      return rMesNum === dbMesNum || String(r.mes).toLowerCase() === String(cycle.activeMonth).toLowerCase();
    });

    if (matchRow) {
      console.log('[CICLO] Atualizando registro existente ID:', matchRow.id);
      const { error: updateErr } = await supabase
        .from('ciclos')
        .update({
          status: updateObj.status,
          iniciado_por: updateObj.iniciado_por,
          iniciado_em: updateObj.iniciado_em,
          fechado_em: updateObj.fechado_em
        })
        .eq('id', matchRow.id);

      if (updateErr) {
        console.error("[CICLO] Erro ao atualizar ciclo:", updateErr);
      } else {
        console.log('[CICLO] Ciclo atualizado com sucesso no Supabase!');
      }
    } else {
      console.log('[CICLO] Inserindo novo registro de ciclo no Supabase');
      const { error: insertErr } = await supabase
        .from('ciclos')
        .insert(updateObj);

      if (insertErr) {
        console.warn("[CICLO] Erro ao inserir ciclo com mes numérico, tentando com string:", insertErr);
        const { error: insertStringErr } = await supabase
          .from('ciclos')
          .insert({
            ...updateObj,
            mes: cycle.activeMonth
          });
        if (insertStringErr) {
          console.error("[CICLO] Erro crítico ao inserir ciclo:", insertStringErr);
        } else {
          console.log('[CICLO] Ciclo inserido com sucesso (mes string)!');
        }
      } else {
        console.log('[CICLO] Ciclo inserido com sucesso!');
      }
    }
  } catch (err) {
    console.error("[CICLO] Exceção em dbSaveCycleState:", err);
  } finally {
    // Keep realtimeFlags.isLocalUpdate true for 3000ms so Realtime echo does not revert state
    setTimeout(() => {
      realtimeFlags.isLocalUpdate = false;
      console.log('[CICLO] realtimeFlags.isLocalUpdate liberado (3s após salvamento)');
    }, 3000);
  }
};

export const dbFetchAllCycles = async (): Promise<CycleState[]> => {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase.from('ciclos').select('id, mes, ano, status, iniciado_em, aberto_em, iniciado_por, aberto_por');
  if (error || !data) return [];
  return data.map(item => {
    let monthStr = "Janeiro";
    if (item.mes) {
      if (typeof item.mes === "number") {
        monthStr = monthNumToName(item.mes);
      } else {
        const num = parseInt(item.mes, 10);
        if (!isNaN(num)) {
          monthStr = monthNumToName(num);
        } else {
          monthStr = item.mes;
        }
      }
    }
    return {
      activeMonth: monthStr,
      activeYear: String(item.ano),
      status: normalizeCycleStatus(item.status),
      openedAt: item.iniciado_em || item.aberto_em,
      openedBy: item.iniciado_por || item.aberto_por
    };
  });
};

// ======================= CRITERIA EVALUATIONS (avaliacoes) =======================
export async function dbSalvarAvaliacao(avaliacao: {
  almoxarifado_id: string, mes: string | number, ano: string | number,
  criterio_id: string, criterio_nome: string, status: string,
  pontos_obtidos: number, pontos_possiveis: number,
  notes?: string, nok_link1?: string, nok_link2?: string,
  nok_link3?: string, nok_descricao?: string, avaliado_por?: string
}, requesterRole?: string) {
  checkPermission(["ADMIN"], requesterRole);
  const mesNum = typeof avaliacao.mes === "string" ? monthNameToNum(avaliacao.mes) : avaliacao.mes;
  const anoNum = typeof avaliacao.ano === "string" ? parseInt(avaliacao.ano) : avaliacao.ano;
  const links = [avaliacao.nok_link1, avaliacao.nok_link2, avaliacao.nok_link3].filter(Boolean) as string[];

  const safeResultado = (avaliacao.status === "OK" || avaliacao.status === "NOK") 
    ? avaliacao.status 
    : "PENDENTE";

  const { error } = await supabase
    .from('avaliacoes')
    .upsert({
      almoxarifado: avaliacao.almoxarifado_id,
      mes: mesNum,
      ano: anoNum,
      criterio_codigo: avaliacao.criterio_id,
      criterio_nome: avaliacao.criterio_nome,
      resultado: safeResultado,
      pontuacao: avaliacao.pontos_obtidos,
      descricao_evidencia: avaliacao.nok_descricao || avaliacao.notes || "",
      links_evidencia: links,
      avaliado_por: avaliacao.avaliado_por || "Fernando Silva",
      avaliado_em: new Date().toISOString(),
      audit_mode: "A_Distancia",
      modo_auditoria: "A_Distancia"
    }, { onConflict: 'almoxarifado,mes,ano,criterio_codigo' });

  if (error) throw error;
}

export async function dbBuscarAvaliacoes(almoxarifado_id: string, mes: string | number, ano: string | number) {
  const mesNum = typeof mes === "string" ? monthNameToNum(mes) : mes;
  const anoNum = typeof ano === "string" ? parseInt(ano) : ano;

  const { data, error } = await supabase
    .from('avaliacoes')
    .select('id, almoxarifado, mes, ano, criterio_codigo, criterio_nome, resultado, pontuacao, descricao_evidencia, links_evidencia, avaliado_por, avaliado_em, audit_mode, modo_auditoria')
    .eq('almoxarifado', almoxarifado_id)
    .eq('mes', mesNum)
    .eq('ano', anoNum);

  if (error) throw error;
  return data || [];
}

export async function dbBuscarTodasAvaliacoes(mes: string | number, ano: string | number) {
  const mesNum = typeof mes === "string" ? monthNameToNum(mes) : mes;
  const anoNum = typeof ano === "string" ? parseInt(ano) : ano;

  const { data, error } = await supabase
    .from('avaliacoes')
    .select('id, almoxarifado, mes, ano, criterio_codigo, criterio_nome, resultado, pontuacao, descricao_evidencia, links_evidencia, avaliado_por, avaliado_em, audit_mode, modo_auditoria')
    .eq('mes', mesNum)
    .eq('ano', anoNum);

  if (error) throw error;
  return data || [];
}

export const getBranchIdByName = (name: string): string => {
  const norm = (name || "").toUpperCase().trim();
  if (norm.includes("UNITRANS JP")) return "unitrans-jp";
  if (norm.includes("SANTA MARIA JP")) return "santa-maria-jp";
  if (norm.includes("TRANS CG BAYEUX")) return "trans-cg-bayeux";
  if (norm.includes("TRANS CG")) return "expresso-nacional";
  if (norm.includes("A.CÂNDIDO CG") || norm.includes("CANDIDO CG")) return "acandido-cg";
  if (norm.includes("RODOVIARIO JABOATAO") || norm.includes("RODOVIÁRIO JABOATÃO")) return "rodoviario-jaboatao";
  if (norm.includes("FRETAMENTO JABOATAO") || norm.includes("FRETAMENTO JABOATÃO")) return "fretamento-jaboatao";
  if (norm.includes("RODOVIARIO CABEDELO") || norm.includes("RODOVIÁRIO CABEDELO")) return "rodoviario-cabedelo";
  if (norm.includes("RODOVIARIO FORTALEZA") || norm.includes("RODOVIÁRIO FORTALEZA")) return "rodoviario-fortaleza";
  if (norm.includes("FRETAMENTO MARACANAU") || norm.includes("FRETAMENTO MARACANAÚ")) return "fretamento-maracanau";
  return name.toLowerCase().replace(/\s+/g, "-");
};

const twinPairs = [
  ["unitrans-jp", "santa-maria-jp"],
  ["expresso-nacional", "acandido-cg"],
  ["fretamento-jaboatao", "rodoviario-jaboatao"],
  ["trans-cg-bayeux", "rodoviario-cabedelo"],
  ["fretamento-maracanau", "rodoviario-fortaleza"]
];

export const getTwinBranchId = (branchId: string): string | null => {
  const pair = twinPairs.find((p) => p.includes(branchId));
  return pair ? (pair[0] === branchId ? pair[1] : pair[0]) : null;
};

export async function dbSaveAuditMode(branchId: string, criterionId: string, mes: string, ano: string, mode: "Presencial" | "A_Distancia", requesterRole?: string) {
  checkPermission(["ADMIN"], requesterRole);
  if (!isSupabaseReady()) return;
  try {
    const { error } = await supabase.from('audit_modes').upsert({
      almoxarifado_id: branchId,
      criterio_id: criterionId,
      mes,
      ano,
      modo: mode
    }, { onConflict: 'almoxarifado_id,criterio_id,mes,ano' });
    if (error) {
      console.error("[dbSaveAuditMode] error:", error);
    }
  } catch (err) {
    console.error("[dbSaveAuditMode] catch error:", err);
  }
}

export const dbFetchEvaluations = async (almoxarifado: string, mesName: string, anoStr: string): Promise<Record<string, Partial<CriterionState>>> => {
  if (!isSupabaseReady()) {
    return {};
  }

  const mesNum = monthNameToNum(mesName);
  const anoNum = parseInt(anoStr);

  const { data, error } = await supabase
    .from('avaliacoes')
    .select('id, almoxarifado, mes, ano, criterio_codigo, criterio_nome, resultado, pontuacao, descricao_evidencia, links_evidencia, avaliado_por, avaliado_em, audit_mode, modo_auditoria')
    .eq('almoxarifado', almoxarifado)
    .eq('mes', mesNum)
    .eq('ano', anoNum);

  if (error || !data) {
    return {};
  }

  // BUG 1 Correction: Fetch audit modes from audit_modes table
  let auditModesMap: Record<string, "Presencial" | "A_Distancia"> = {};
  try {
    const branchId = getBranchIdByName(almoxarifado);
    const { data: modes, error: modesErr } = await supabase
      .from('audit_modes')
      .select('criterio_id, modo')
      .eq('almoxarifado_id', branchId)
      .eq('mes', mesName)
      .eq('ano', anoStr);
    
    if (!modesErr && modes) {
      modes.forEach((m: any) => {
        auditModesMap[m.criterio_id] = m.modo as "Presencial" | "A_Distancia";
      });
    }
  } catch (err) {
    console.error("Error fetching modes from audit_modes table:", err);
  }

  const mapped: Record<string, Partial<CriterionState>> = {};
  data.forEach(row => {
    const links = Array.isArray(row.links_evidencia) ? row.links_evidencia : [];
    const critId = row.criterio_codigo;
    // Prefer audit mode from audit_modes table if available, fallback to evaluations values
    const finalAuditMode = auditModesMap[critId] || row.audit_mode || row.modo_auditoria || "A_Distancia";

    let finalNotes = row.descricao_evidencia || "";
    let finalAlmoxarifeQuantities: number[] | undefined = undefined;
    let finalAuditorQuantities: number[] | undefined = undefined;

    if (critId === "2" && row.descricao_evidencia) {
      try {
        if (row.descricao_evidencia.trim().startsWith("{")) {
          const parsed = JSON.parse(row.descricao_evidencia);
          finalNotes = parsed.notes || "";
          finalAlmoxarifeQuantities = parsed.top10AlmoxarifeQuantities;
          finalAuditorQuantities = parsed.top10AuditorQuantities;
        }
      } catch (e) {
        console.error("Failed to parse JSON for top10 quantities inside dbFetchEvaluations:", e);
      }
    }

    let displayStatus: EvaluationStatus = (row.resultado || "PENDENTE") as EvaluationStatus;
    if (displayStatus === "PENDENTE") {
      if (finalAuditMode === "A_Distancia") {
        let hasEvidence = false;
        if (critId === "2") {
          const hasAlmoxarifeQuantities = Array.isArray(finalAlmoxarifeQuantities) && finalAlmoxarifeQuantities.length > 0;
          hasEvidence = links.length > 0 || hasAlmoxarifeQuantities;
        } else {
          hasEvidence = links.length > 0 || (row.descricao_evidencia && row.descricao_evidencia.trim().length > 0);
        }
        displayStatus = hasEvidence ? "ENVIADO" : "AGUARDANDO ENVIO";
      }
    }

    mapped[critId] = {
      status: displayStatus,
      pointsObtained: row.pontuacao ?? 0,
      pointsPossible: ["7", "8", "9", "10"].includes(critId) ? 5 : 20,
      notes: finalNotes,
      evidenceNotes: finalNotes,
      top10AlmoxarifeQuantities: finalAlmoxarifeQuantities,
      top10AuditorQuantities: finalAuditorQuantities,
      nokEvidenceLinks: links,
      submittedPhotos: links,
      submittedAt: row.avaliado_em ? new Date(row.avaliado_em).toLocaleDateString("pt-BR") : "",
      auditMode: finalAuditMode as "Presencial" | "A_Distancia"
    };
  });

  // Ensure auditMode config is propagated even if no evaluations row exists yet
  Object.keys(auditModesMap).forEach(critId => {
    if (!mapped[critId]) {
      const finalAuditMode = auditModesMap[critId] || "A_Distancia";
      const displayStatus: EvaluationStatus = finalAuditMode === "A_Distancia" ? "AGUARDANDO ENVIO" : "PENDENTE";
      mapped[critId] = {
        status: displayStatus,
        pointsObtained: 0,
        pointsPossible: ["7", "8", "9", "10"].includes(critId) ? 5 : 20,
        notes: "",
        evidenceNotes: "",
        nokEvidenceLinks: [],
        submittedPhotos: [],
        submittedAt: "",
        auditMode: finalAuditMode
      };
    }
  });

  return mapped;
};

export const getBranchNameById = (id: string): string => {
  const branchId = id.toLowerCase().trim();
  if (branchId === "unitrans-jp") return "ALMOXARIFADO UNITRANS JP";
  if (branchId === "santa-maria-jp") return "SANTA MARIA JP";
  if (branchId === "trans-cg-bayeux") return "TRANS CG BAYEUX";
  if (branchId === "expresso-nacional") return "TRANS CG";
  if (branchId === "acandido-cg") return "A.CÂNDIDO CG";
  if (branchId === "rodoviario-jaboatao") return "RODOVIÁRIO JABOATÃO";
  if (branchId === "fretamento-jaboatao") return "FRETAMENTO JABOATÃO";
  if (branchId === "rodoviario-cabedelo") return "RODOVIÁRIO CABEDELO";
  if (branchId === "rodoviario-fortaleza") return "RODOVIÁRIO FORTALEZA";
  if (branchId === "fretamento-maracanau") return "FRETAMENTO MARACANAU";
  if (branchId === "reunidas-nat") return "REUNIDAS TRANSPORTES NAT";
  if (branchId === "fretamento-pb") return "FRETAMENTO PB";
  if (branchId === "unissana-rn" || branchId === "unissanta-rn") return "ALMOXARIFADO UNISSANTA RN";
  return id;
};

export const dbFetchAllEvaluationsForPeriod = async (
  mesName: string,
  anoStr: string
): Promise<Record<string, Record<string, Partial<CriterionState>>>> => {
  if (!isSupabaseReady()) {
    return {};
  }

  const mesNum = monthNameToNum(mesName);
  const anoNum = parseInt(anoStr, 10);

  // Run both queries in parallel to fetch all data for the period at once
  const [evaluationsResult, auditModesResult] = await Promise.all([
    supabase
      .from('avaliacoes')
      .select('id, almoxarifado, mes, ano, criterio_codigo, criterio_nome, resultado, pontuacao, descricao_evidencia, links_evidencia, avaliado_por, avaliado_em, audit_mode, modo_auditoria')
      .eq('mes', mesNum)
      .eq('ano', anoNum),
    supabase
      .from('audit_modes')
      .select('almoxarifado_id, criterio_id, modo')
      .eq('mes', mesName)
      .eq('ano', anoStr)
  ]);

  const { data: evaluationsData, error: evalsError } = evaluationsResult;
  const { data: auditModesData, error: modesError } = auditModesResult;

  if (evalsError) {
    console.error("Error in dbFetchAllEvaluationsForPeriod (avaliacoes):", evalsError);
  }
  if (modesError) {
    console.error("Error in dbFetchAllEvaluationsForPeriod (audit_modes):", modesError);
  }

  const result: Record<string, Record<string, Partial<CriterionState>>> = {};

  // Build a structure for audit modes first
  const auditModesMap: Record<string, Record<string, "Presencial" | "A_Distancia">> = {};
  if (auditModesData) {
    auditModesData.forEach((m: any) => {
      const branchName = getBranchNameById(m.almoxarifado_id);
      if (branchName) {
        if (!auditModesMap[branchName]) {
          auditModesMap[branchName] = {};
        }
        auditModesMap[branchName][m.criterio_id] = m.modo as "Presencial" | "A_Distancia";
      }
    });
  }

  // Map evaluationsData
  if (evaluationsData) {
    evaluationsData.forEach((row: any) => {
      const almoxarifado = row.almoxarifado;
      if (!almoxarifado) return;

      if (!result[almoxarifado]) {
        result[almoxarifado] = {};
      }

      const critId = row.criterio_codigo;
      const branchAuditModes = auditModesMap[almoxarifado] || {};
      const finalAuditMode = branchAuditModes[critId] || row.audit_mode || row.modo_auditoria || "A_Distancia";

      let finalNotes = row.descricao_evidencia || "";
      let finalAlmoxarifeQuantities: number[] | undefined = undefined;
      let finalAuditorQuantities: number[] | undefined = undefined;

      const links = Array.isArray(row.links_evidencia) ? row.links_evidencia : [];

      if (critId === "2" && row.descricao_evidencia) {
        try {
          if (row.descricao_evidencia.trim().startsWith("{")) {
            const parsed = JSON.parse(row.descricao_evidencia);
            finalNotes = parsed.notes || "";
            finalAlmoxarifeQuantities = parsed.top10AlmoxarifeQuantities;
            finalAuditorQuantities = parsed.top10AuditorQuantities;
          }
        } catch (e) {
          console.error("Failed to parse JSON for top10 quantities in batch fetch:", e);
        }
      }

      let displayStatus: EvaluationStatus = (row.resultado || "PENDENTE") as EvaluationStatus;
      if (displayStatus === "PENDENTE") {
        if (finalAuditMode === "A_Distancia") {
          let hasEvidence = false;
          if (critId === "2") {
            const hasAlmoxarifeQuantities = Array.isArray(finalAlmoxarifeQuantities) && finalAlmoxarifeQuantities.length > 0;
            hasEvidence = links.length > 0 || hasAlmoxarifeQuantities;
          } else {
            hasEvidence = links.length > 0 || (row.descricao_evidencia && row.descricao_evidencia.trim().length > 0);
          }
          displayStatus = hasEvidence ? "ENVIADO" : "AGUARDANDO ENVIO";
        }
      }

      result[almoxarifado][critId] = {
        status: displayStatus,
        pointsObtained: row.pontuacao ?? 0,
        pointsPossible: ["7", "8", "9", "10"].includes(critId) ? 5 : 20,
        notes: finalNotes,
        evidenceNotes: finalNotes,
        top10AlmoxarifeQuantities: finalAlmoxarifeQuantities,
        top10AuditorQuantities: finalAuditorQuantities,
        nokEvidenceLinks: links,
        submittedPhotos: links,
        submittedAt: row.avaliado_em ? new Date(row.avaliado_em).toLocaleDateString("pt-BR") : "",
        auditMode: finalAuditMode as "Presencial" | "A_Distancia"
      };
    });
  }

  // Propagate remaining audit modes even if no evaluations row exists
  Object.keys(auditModesMap).forEach((branchName) => {
    if (!result[branchName]) {
      result[branchName] = {};
    }
    const branchModes = auditModesMap[branchName];
    Object.keys(branchModes).forEach((critId) => {
      if (!result[branchName][critId]) {
        const finalAuditMode = branchModes[critId] || "A_Distancia";
        const displayStatus: EvaluationStatus = finalAuditMode === "A_Distancia" ? "AGUARDANDO ENVIO" : "PENDENTE";
        result[branchName][critId] = {
          status: displayStatus,
          pointsObtained: 0,
          pointsPossible: ["7", "8", "9", "10"].includes(critId) ? 5 : 20,
          notes: "",
          evidenceNotes: "",
          nokEvidenceLinks: [],
          submittedPhotos: [],
          submittedAt: "",
          auditMode: finalAuditMode
        };
      }
    });
  });

  return result;
};

export const dbSaveEvaluation = async (
  almoxarifado: string,
  mesName: string,
  anoStr: string,
  criterionId: string,
  criterionName: string,
  evaluation: Partial<CriterionState>,
  evaluatedBy: string
) => {
  checkPermission(["ADMIN", "SUPERVISOR"]);
  if (!isSupabaseReady()) {
    return;
  }

  let finalLinks = evaluation.nokEvidenceLinks || [];
  if (evaluation.nokEvidenceFileData && evaluation.nokEvidenceFileData.trim().length > 0) {
    try {
      const ext = evaluation.nokEvidenceFileType?.split('/')?.[1] || 'jpg';
      const pathName = `evaluations/${almoxarifado}/${criterionId}_evidence_${Date.now()}.${ext}`;
      const signedUrl = await uploadFile('evidencias-auditor', pathName, evaluation.nokEvidenceFileData);
      if (signedUrl) {
        finalLinks = [...finalLinks, signedUrl];
      }
    } catch (e) {
      console.error("Failed to upload evaluation evidence file to Supabase Storage:", e);
    }
  }

  const mesNum = monthNameToNum(mesName);
  const anoNum = parseInt(anoStr);

  try {
    realtimeFlags.isLocalUpdate = true;
    const safeResultado = (evaluation.status === "OK" || evaluation.status === "NOK") 
      ? evaluation.status 
      : "PENDENTE";

    let finalDescricao = evaluation.evidenceNotes || evaluation.notes || "";
    if (criterionId === "2") {
      finalDescricao = JSON.stringify({
        notes: evaluation.notes || evaluation.evidenceNotes || "",
        top10AlmoxarifeQuantities: evaluation.top10AlmoxarifeQuantities || [],
        top10AuditorQuantities: evaluation.top10AuditorQuantities || []
      });
    }

    const { error } = await supabase.from('avaliacoes').upsert({
      almoxarifado: almoxarifado,
      mes: mesNum,
      ano: anoNum,
      criterio_codigo: criterionId,
      criterio_nome: criterionName,
      resultado: safeResultado,
      pontuacao: evaluation.pointsObtained ?? 0,
      descricao_evidencia: finalDescricao,
      links_evidencia: finalLinks,
      avaliado_por: evaluatedBy,
      avaliado_em: new Date().toISOString(),
      audit_mode: evaluation.auditMode || "A_Distancia",
      modo_auditoria: evaluation.auditMode || "A_Distancia"
    }, { onConflict: 'almoxarifado,mes,ano,criterio_codigo' });

    if (error) {
      console.error("[dbSaveEvaluation] Supabase error during upsert:", error);
      throw error;
    }

    // Persist to audit_modes table as well
    if (evaluation.auditMode) {
      const branchId = getBranchIdByName(almoxarifado);
      await supabase.from('audit_modes').upsert({
        almoxarifado_id: branchId,
        criterio_id: criterionId,
        mes: mesName,
        ano: anoStr,
        modo: evaluation.auditMode
      }, { onConflict: 'almoxarifado_id,criterio_id,mes,ano' });
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= ALMOXARIFE EVIDENCE SUBMISSIONS =======================
export const dbFetchAlmoxarifeSubmissions = async (almoxarifado: string, mesName: string, anoStr: string) => {
  if (!isSupabaseReady()) return [];
  // Fallback map envios_almoxarife to top10_envios
  const { data } = await supabase
    .from('top10_envios')
    .select('id, almoxarifado_id, mes, ano, enviado_por, enviado_em, fotos, quantidades')
    .eq('almoxarifado_id', almoxarifado)
    .eq('mes', mesName)
    .eq('ano', anoStr);
  return data || [];
};

export const dbSubmitAlmoxarifeEvidence = async (
  almoxarifado: string,
  mesName: string,
  anoStr: string,
  criterionId: string,
  submittedBy: string,
  comment: string,
  storageUrls: string[],
  top10Quantities?: number[]
) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"]);
  if (!isSupabaseReady()) return;

  const mesNum = monthNameToNum(mesName);
  const anoNum = parseInt(anoStr);

  try {
    realtimeFlags.isLocalUpdate = true;

    // Convert criterionId to official Criterion Names to stay unified
    const criterionNames: Record<string, string> = {
      "2": "TOP 10",
      "3": "Nota Fiscal",
      "4": "LayOut",
      "5": "Recebimento de Material",
      "6": "Curso Unimobin",
      "7": "Nível de Serviço",
      "8": "Registro de Requisições",
      "9": "Controle de Garantia",
      "10": "Material Sem Movimentação"
    };
    const cName = criterionNames[criterionId] || "Evidência Almoxarife";

    // Fetch active audit mode config to preserve it in the row
    let currentAuditMode = "A_Distancia";
    try {
      const branchId = getBranchIdByName(almoxarifado);
      const { data: modeData } = await supabase
        .from('audit_modes')
        .select('modo')
        .eq('almoxarifado_id', branchId)
        .eq('mes', mesName)
        .eq('ano', anoStr)
        .eq('criterio_id', criterionId)
        .maybeSingle();
      if (modeData && modeData.modo) {
        currentAuditMode = modeData.modo;
      }
    } catch (e) {
      console.error("Error fetching current audit mode inside dbSubmitAlmoxarifeEvidence:", e);
    }

    // Map submissions of TOP 10 (which is criterion 1 in top10_envios) or keep it recorded
    if (criterionId === "1" || criterionId === "2") {
      await supabase.from('top10_envios').upsert({
        almoxarifado_id: almoxarifado,
        mes: mesName,
        ano: anoStr,
        quantidades: top10Quantities || [],
        fotos: storageUrls,
        enviado_por: submittedBy,
        uploaded_at: new Date().toISOString()
      }, { onConflict: 'almoxarifado_id,mes,ano' });
    }

    let finalDescricao = comment;
    if (criterionId === "2") {
      finalDescricao = JSON.stringify({
        notes: comment,
        top10AlmoxarifeQuantities: top10Quantities || [],
        top10AuditorQuantities: []
      });
    }

    // Also write to evaluations table with conforming schema columns to make it visible to auditors/almoxarifes
    const { error } = await supabase.from('avaliacoes').upsert({
      almoxarifado: almoxarifado,
      mes: mesNum,
      ano: anoNum,
      criterio_codigo: criterionId,
      criterio_nome: cName,
      resultado: "PENDENTE",
      pontuacao: 0,
      descricao_evidencia: finalDescricao,
      links_evidencia: storageUrls,
      avaliado_por: submittedBy,
      avaliado_em: new Date().toISOString(),
      audit_mode: currentAuditMode,
      modo_auditoria: currentAuditMode
    }, { onConflict: 'almoxarifado,mes,ano,criterio_codigo' });

    if (error) {
      console.error("Error upserting conforming submission row inside avaliacoes:", error);
      throw error;
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= CALENDAR SCHEDULES (calendario_inventarios) =======================
export const dbFetchSchedules = async (): Promise<any[]> => {
  if (!isSupabaseReady()) {
    return [];
  }

  const { data, error } = await supabase.from('calendario_inventarios').select('id, almoxarifado, ano, semestre, indice, data_agendada, status, nokEvidenceLink').order('id', { ascending: true });
  if (error || !data) {
    return [];
  }

  return data.map(item => {
    const bId = item.almoxarifado || "";
    const idx = Number(item.indice || 1);
    return {
      id: item.id || `cal-${bId}-${item.ano}-${item.semestre}-${idx}`,
      branchId: bId,
      almoxarifado_id: bId,
      almoxarifado: bId,
      ano: Number(item.ano || 2026),
      semestre: Number(item.semestre || 1),
      indice: idx,
      data_agendada: item.data_agendada || "",
      status: item.status || "PENDENTE",
      nokEvidenceLink: item.nokEvidenceLink || ""
    };
  });
};

export const dbSaveSchedules = async (schedules: any[], forceYear?: number, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of schedules) {
      const bId = item.branchId || item.almoxarifado_id || item.almoxarifado || "";
      if (!bId) continue;
      const yr = forceYear || Number(item.ano || 2026);
      const sem = Number(item.semestre || 1);
      const ind = Number(item.indice || 1);

      await supabase.from('calendario_inventarios').upsert({
        almoxarifado: bId,
        ano: yr,
        semestre: sem,
        indice: ind,
        data_agendada: item.data_agendada || null,
        status: item.status || "PENDENTE",
        nokEvidenceLink: item.nokEvidenceLink || null,
        sequencia: item.sequencia || `#${ind}`
      }, { onConflict: 'almoxarifado,ano,semestre,indice' });
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbFetchBranchSchedules = async (branchId: string, options?: { ano?: number; semestre?: number }): Promise<any[]> => {
  if (!isSupabaseReady()) return [];

  let query = supabase.from('calendario_inventarios').select('id, almoxarifado, ano, semestre, indice, data_agendada, status, nokEvidenceLink').eq('almoxarifado', branchId);
  if (options?.ano) query = query.eq('ano', options.ano);
  if (options?.semestre) query = query.eq('semestre', options.semestre);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(item => {
    const bId = item.almoxarifado || "";
    const idx = Number(item.indice || 1);
    return {
      id: item.id || `cal-${bId}-${item.ano}-${item.semestre}-${idx}`,
      branchId: bId,
      almoxarifado_id: bId,
      almoxarifado: bId,
      ano: Number(item.ano || 2026),
      semestre: Number(item.semestre || 1),
      indice: idx,
      data_agendada: item.data_agendada || "",
      status: item.status || "PENDENTE",
      nokEvidenceLink: item.nokEvidenceLink || ""
    };
  });
};

export const dbSaveSingleSchedule = async (item: any, userEmailOrName?: string, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    const bId = item.branchId || item.almoxarifado_id || item.almoxarifado || "";
    const yr = Number(item.ano || 2026);
    const sem = Number(item.semestre || 1);
    const ind = Number(item.indice || 1);
    const record = {
      almoxarifado: bId,
      ano: yr,
      semestre: sem,
      indice: ind,
      data_agendada: item.data_agendada || item.data || null,
      status: item.status || "PENDENTE",
      nokEvidenceLink: item.nokEvidenceLink || null,
      sequencia: item.sequencia || `#${ind}`
    };
    const { error } = await supabase.from('calendario_inventarios').upsert(record, { onConflict: 'almoxarifado,ano,semestre,indice' });
    if (error) throw error;
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbDeleteSchedule = async (id: string, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    const { error } = await supabase.from('calendario_inventarios').delete().eq('id', id);
    if (error) throw error;
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= WARRANTIES (garantias) =======================
const GARANTIA_MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function garantiaMonthToNum(monthStr: string): number {
  if (!monthStr) return 1;
  const cleaned = monthStr.split(' ')[0].trim();
  const idx = GARANTIA_MONTH_NAMES.findIndex(m => m.toLowerCase() === cleaned.toLowerCase());
  if (idx !== -1) return idx + 1;
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) || parsed < 1 || parsed > 12 ? 1 : parsed;
}

function garantiaNumToMonth(num: number): string {
  if (num >= 1 && num <= 12) return GARANTIA_MONTH_NAMES[num - 1];
  return "Janeiro";
}

export async function dbSalvarGarantia(garantia: any, requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  
  const spaceParts = (garantia.monthYear || `${garantia.mes || ''} ${garantia.ano || ''}`).trim().split(' ');
  const mesName = spaceParts[0] || "Janeiro";
  const anoNum = parseInt(spaceParts[1] || "2026", 10) || 2026;
  const mesNum = typeof garantia.mes === "number" ? garantia.mes : garantiaMonthToNum(mesName);

  const itemCode = garantia.itemCode || garantia.item_code || garantia.item_codigo || "";
  const itemDesc = garantia.itemDescription || garantia.item_description || garantia.item_nome || "";
  
  let fullItem = garantia.item || "";
  if (!fullItem) {
    if (itemCode && itemDesc) {
      fullItem = `${itemCode} - ${itemDesc}`;
    } else {
      fullItem = itemCode || itemDesc || "";
    }
  }

  const obsPeca = garantia.observacao || garantia.observacao_peca || garantia.pieceObservation || null;
  const anexo = garantia.anexo_url || garantia.anexo_base64 || garantia.arquivo_base64 || null;

  const payload: any = {
    almoxarifado: garantia.almoxarifado || garantia.almoxarifado_id || "",
    mes: mesNum,
    ano: anoNum,
    item: fullItem,
    fabricante: garantia.fabricante || garantia.manufacturer || "",
    garantia_ate: garantia.garantia_ate || garantia.expiryDate || null,
    registrado_por: garantia.registrado_por || garantia.registeredBy || null,
    data_emissao_nf: garantia.data_emissao_nf || garantia.data_nf || garantia.nfEmissionDate || null,
    referencia_item: garantia.referencia_item || garantia.referencia || garantia.reference || null,
    nota_fiscal: garantia.nota_fiscal || garantia.notaFiscal || null,
    veiculo: garantia.veiculo || null,
    localizacao: garantia.localizacao || null,
    observacao: obsPeca,
    observacao_sucata: garantia.observacao_sucata || garantia.scrapObservation || null,
    anexo_url: anexo
  };

  if (garantia.id && !garantia.id.startsWith("war-") && !garantia.id.startsWith("tmp")) {
    payload.id = garantia.id;
  }

  let { data, error } = await supabase.from('garantias').upsert(payload).select();

  if (error) {
    console.warn("Retrying dbSalvarGarantia with safe payload without optional/large attachment columns:", error.message);
    const safePayload = { ...payload };
    delete safePayload.anexo_url;

    const retry = await supabase.from('garantias').upsert(safePayload).select();
    data = retry.data;
    error = retry.error;

    if (error) {
      console.warn("Retrying dbSalvarGarantia with core fields:", error.message);
      const corePayload: any = {
        almoxarifado: garantia.almoxarifado || "",
        mes: mesNum,
        ano: anoNum,
        item: fullItem,
        fabricante: garantia.fabricante || garantia.manufacturer || "",
        garantia_ate: garantia.garantia_ate || garantia.expiryDate || null,
        registrado_por: garantia.registrado_por || garantia.registeredBy || null,
        data_emissao_nf: garantia.data_emissao_nf || garantia.data_nf || garantia.nfEmissionDate || null,
        referencia_item: garantia.referencia_item || garantia.referencia || garantia.reference || null,
        nota_fiscal: garantia.nota_fiscal || garantia.notaFiscal || null,
        veiculo: garantia.veiculo || null,
        localizacao: garantia.localizacao || null,
        observacao: obsPeca,
        observacao_sucata: garantia.observacao_sucata || garantia.scrapObservation || null
      };
      if (payload.id) corePayload.id = payload.id;
      const retryCore = await supabase.from('garantias').upsert(corePayload).select();
      data = retryCore.data;
      error = retryCore.error;
    }
  }

  if (error) {
    console.error("Erro fatal ao salvar garantia no Supabase:", error);
    throw new Error(error.message || "Erro de conexão ao salvar garantia");
  }

  return data?.[0];
}

export async function dbBuscarGarantias(almoxarifado: string, mes: string | number, ano: string | number) {
  const mesNum = typeof mes === "number" ? mes : garantiaMonthToNum(mes);
  const anoNum = typeof ano === "number" ? ano : (parseInt(String(ano), 10) || 2026);

  try {
    let query = supabase.from('garantias').select('*').eq('mes', mesNum).eq('ano', anoNum);
    if (almoxarifado && almoxarifado !== "TODOS") {
      query = query.ilike('almoxarifado', `%${almoxarifado.replace("ALMOXARIFADO ", "").trim()}%`);
    }
    const { data, error } = await query;
    if (error) {
      console.warn("dbBuscarGarantias notice:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("dbBuscarGarantias exception:", err);
    return [];
  }
}

export const dbFetchWarranties = async (): Promise<WarrantyItem[]> => {
  if (!isSupabaseReady()) return [];
  try {
    let { data, error } = await supabase
      .from('garantias')
      .select('*')
      .order('registrado_em', { ascending: false });

    if (error) {
      const retry = await supabase.from('garantias').select('*');
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      console.warn("Notice fetching warranties from Supabase:", error);
      return [];
    }

    return data.map((item) => {
      let itemCode = item.item_code || item.item_codigo || "";
      let itemDescription = item.item || item.item_description || item.item_nome || "";
      if (item.item && item.item.includes(" - ")) {
        const parts = item.item.split(" - ");
        itemCode = parts[0].trim();
        itemDescription = parts.slice(1).join(" - ").trim();
      }

      const monthName = item.mes ? (typeof item.mes === "number" ? garantiaNumToMonth(item.mes) : item.mes) : "Janeiro";
      const monthYear = item.mes && item.ano ? `${monthName} ${item.ano}` : (item.monthYear || "");

      const obsPeca = item.observacao || item.observacao_peca || item.pieceObservation || "";
      const obsSucata = item.observacao_sucata || item.scrap_observation || item.scrapObservation || "";

      const branchName = item.almoxarifado || item.almoxarifado_id || "";

      return {
        ...item,
        id: item.id,
        itemCode,
        itemDescription,
        manufacturer: item.fabricante || item.manufacturer || "",
        expiryDate: item.garantia_ate || item.warranty_expiry || "",
        almoxarifado: branchName,
        nfEmissionDate: item.data_emissao_nf || item.data_nf || item.nf_emission_date || "",
        data_emissao_nf: item.data_emissao_nf || item.data_nf || item.nf_emission_date || "",
        reference: item.referencia_item || item.referencia || item.reference || "",
        referencia_item: item.referencia_item || item.referencia || item.reference || "",
        notaFiscal: item.nota_fiscal || item.notaFiscal || "",
        nota_fiscal: item.nota_fiscal || item.notaFiscal || "",
        veiculo: item.veiculo || "",
        localizacao: item.localizacao || "",
        scrapObservation: obsSucata,
        observacao_sucata: obsSucata,
        pieceObservation: obsPeca,
        observacao_peca: obsPeca,
        observacao: obsPeca,
        anexo_url: item.anexo_url || item.anexo_base64 || item.arquivo_base64 || "",
        anexo_base64: item.anexo_url || item.anexo_base64 || item.arquivo_base64 || "",
        arquivo_base64: item.anexo_url || item.anexo_base64 || item.arquivo_base64 || "",
        registeredBy: item.registrado_por || item.registeredBy || "",
        monthYear,
        lastUpdateDate: item.registrado_em ? String(item.registrado_em).split("T")[0] : (item.created_at ? String(item.created_at).split("T")[0] : ""),
        createdAt: item.registrado_em ? new Date(item.registrado_em).toLocaleString("pt-BR") : (item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "")
      };
    });
  } catch (err) {
    console.warn("Exception in dbFetchWarranties:", err);
    return [];
  }
};

export const dbSaveWarranties = async (warranties: WarrantyItem[], requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of warranties) {
      await dbSalvarGarantia({
        id: item.id,
        almoxarifado: item.almoxarifado,
        monthYear: item.monthYear,
        itemCode: item.itemCode,
        itemDescription: item.itemDescription,
        manufacturer: item.manufacturer || item.fabricante,
        expiryDate: item.expiryDate || item.garantia_ate,
        data_emissao_nf: item.nfEmissionDate || item.data_emissao_nf || item.data_nf,
        referencia_item: item.reference || item.referencia_item || item.referencia,
        nota_fiscal: item.notaFiscal || item.nota_fiscal,
        veiculo: item.veiculo,
        localizacao: item.localizacao,
        observacao: item.pieceObservation || item.observacao_peca || item.observacao,
        observacao_sucata: item.scrapObservation || item.observacao_sucata,
        anexo_url: item.anexo_url || item.anexo_base64 || item.arquivo_base64,
        registeredBy: item.registeredBy || item.registrado_por,
        ...item
      }, requesterRole);
    }
  } catch (err) {
    console.error("Error in dbSaveWarranties:", err);
    throw err;
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbDeleteWarranty = async (id: string, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady() || !id) return;
  if (id.startsWith("war-") || id.startsWith("tmp")) return;
  const { error } = await supabase.from('garantias').delete().eq('id', id);
  if (error) {
    console.error("Error deleting warranty from Supabase:", error);
    throw error;
  }
};

// ======================= LEVEL OF SERVICE OCCURRENCES =======================
export async function dbSalvarNivelServico(registro: any, requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  const rawBranch = registro.almoxarifado_id || registro.branchId || registro.branchName || registro.filial || "";
  const canonicalBranchId = (rawBranch.includes("-") && !rawBranch.includes(" ")) ? rawBranch : (getBranchIdByName(rawBranch) || rawBranch);

  const { error } = await supabase
    .from('nivel_servico')
    .upsert({
      id: registro.id && !registro.id.startsWith("tmp") ? registro.id : undefined,
      almoxarifado_id: canonicalBranchId,
      veiculo: registro.veiculo || "",
      codigo_material: registro.codigo_material || registro.codigoMaterial || "",
      material_falta: registro.material_falta || registro.material || "",
      solicitante: registro.solicitante || "",
      data_ocorrencia: registro.data_ocorrencia || registro.date || new Date().toISOString().split("T")[0],
      status: registro.status || "EM ABERTO",
      observacao: registro.observacao || registro.obs || "",
      dias_aberto: registro.dias_aberto || 0,
      data_resolucao: registro.data_resolucao || registro.resolvedAt || null,
      registrado_por: registro.registrado_por || "Supervisor",
      updated_at: new Date().toISOString()
    });
  if (error) throw error;
}

export async function dbBuscarNivelServico(almoxarifado_id: string) {
  const { data, error } = await supabase
    .from('nivel_servico')
    .select('id, almoxarifado_id, veiculo, codigo_material, material_falta, solicitante, data_ocorrencia, status, observacao, dias_aberto, data_resolucao, registrado_por, created_at')
    .eq('almoxarifado_id', almoxarifado_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export const dbDeleteOccurrence = async (id: string, requesterRole?: string): Promise<boolean> => {
  checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  if (!isSupabaseReady()) return false;
  try {
    realtimeFlags.isLocalUpdate = true;
    const { error } = await supabase
      .from('nivel_servico')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to delete occurrence in Supabase:", err);
    throw err;
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export async function dbFetchNivelServicioEntries() {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase
    .from('nivel_servico')
    .select('id, almoxarifado, mes, ano, ns_porcentagem, ocorrencias, observacao');
  if (error) return [];
  return data || [];
}

export const dbFetchOccurrences = async (): Promise<MaterialOccurrence[]> => {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase.from('nivel_servico').select('id, almoxarifado_id, almoxarifado, status, material_falta, data_ocorrencia, veiculo, solicitante, codigo_material, observacao, dias_aberto, data_resolucao, registrado_por, created_at').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(o => {
    const rawBranch = o.almoxarifado_id || "";
    const bId = (rawBranch.includes("-") && !rawBranch.includes(" ")) ? rawBranch : (getBranchIdByName(rawBranch) || rawBranch);
    const bName = getBranchNameById(bId) || rawBranch;
    const validStatus = (o.status as MaterialOccurrence['status']) || "EM ABERTO";
    return {
      id: o.id,
      material: o.material_falta,
      date: o.data_ocorrencia || "",
      status: validStatus,
      branchId: bId,
      branchName: bName,
      veiculo: o.veiculo || "",
      solicitante: o.solicitante || "",
      codigoMaterial: o.codigo_material || "",
      filial: bName,
      obs: o.observacao || "",
      dias_aberto: o.dias_aberto || 0,
      resolvedAt: o.data_resolucao || "",
      registrado_por: o.registrado_por || ""
    };
  });
};

export const dbSaveOccurrences = async (occs: MaterialOccurrence[], requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of occs) {
      const rawBranch = item.branchId || item.branchName || item.filial || "";
      const canonicalBranchId = (rawBranch.includes("-") && !rawBranch.includes(" ")) ? rawBranch : (getBranchIdByName(rawBranch) || rawBranch);

      await dbSalvarNivelServico({
        id: item.id,
        almoxarifado_id: canonicalBranchId,
        veiculo: item.veiculo,
        codigo_material: item.codigoMaterial,
        material_falta: item.material,
        solicitante: item.solicitante,
        data_ocorrencia: item.date,
        status: item.status,
        observacao: item.obs,
        dias_aberto: item.dias_aberto || 0,
        data_resolucao: item.resolvedAt || null,
        registrado_por: item.registrado_por || "Supervisor"
      });
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= MATERIAIS PARADOS =======================
export async function dbSalvarMateriaisParados(almoxarifado_id: string, semestre: number, ano: number, materiais: any[], requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  const { error: delError } = await supabase.from('materiais_parados')
    .delete()
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('semestre', semestre)
    .eq('ano', ano);

  if (delError) {
    console.error("[dbSalvarMateriaisParados Delete Error]:", delError);
    throw delError;
  }

  if (materiais.length > 0) {
    const { error } = await supabase.from('materiais_parados')
      .insert(materiais.map(m => ({
        almoxarifado_id,
        semestre,
        ano,
        codigo: m.codigo || m.code || "",
        descricao: m.descricao || m.description || "",
        ultimo_movimento: m.ultimo_movimento || m.lastMovement || "",
        status: m.status || "OK"
      })));
    if (error) throw error;
  }
}

export async function dbBuscarMateriaisParados(almoxarifado_id: string, semestre: number, ano: number) {
  try {
    const { data, error } = await supabase
      .from('materiais_parados')
      .select('*')
      .eq('almoxarifado_id', almoxarifado_id)
      .eq('semestre', semestre)
      .eq('ano', ano);
    if (error) {
      console.warn("dbBuscarMateriaisParados notice:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("dbBuscarMateriaisParados exception:", err);
    return [];
  }
}

export const dbFetchNonMovingMaterials = async (almoxarifado: string, ano: number, semestre: number): Promise<any> => {
  if (!isSupabaseReady()) return null;

  try {
    const dbRows = await dbBuscarMateriaisParados(almoxarifado, semestre, ano);
    if (!dbRows || dbRows.length === 0) return null;

    return {
      almoxarifado,
      ano,
      semestre,
      timestamp: dbRows[0]?.inserted_em || dbRows[0]?.uploaded_at || dbRows[0]?.created_at || new Date().toISOString(),
      insertedBy: "Almoxarife",
      materials: dbRows.map(r => ({
        code: r.codigo || r.code || "",
        description: r.descricao || r.description || "",
        lastMovement: r.ultimo_movimento || r.lastMovement || "",
        status: r.status || "OK"
      })),
      isEvaluated: dbRows.some(r => r.status && r.status !== "OK"),
      resultStatus: (dbRows.some(r => r.status === "NOK") ? "NOK" : "OK") as EvaluationStatus
    };
  } catch (err) {
    console.warn("dbFetchNonMovingMaterials exception:", err);
    return null;
  }
};

export const dbSaveNonMovingMaterials = async (almoxarifado: string, ano: number, semestre: number, payload: any, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    const mats = payload.materials || payload.itemsToCount || [];
    await dbSalvarMateriaisParados(almoxarifado, semestre, ano, mats);
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export async function dbFetchAllNonMovingSummaries(ano: number, semestre: number): Promise<any[]> {
  if (!isSupabaseReady()) return [];
  try {
    const { data, error } = await supabase
      .from('materiais_parados')
      .select('almoxarifado_id, status')
      .eq('ano', ano)
      .eq('semestre', semestre);

    if (error) {
      console.warn("[Supabase] materiais_parados não encontrado ou erro ao buscar:", error);
      return [];
    }

    if (!data) return [];

    // Group by almoxarifado_id
    const groups: Record<string, string[]> = {};
    data.forEach((row) => {
      const id = row.almoxarifado_id;
      if (!groups[id]) groups[id] = [];
      groups[id].push(row.status);
    });

    const summaries = Object.keys(groups).map((almoxarifado) => {
      const statuses = groups[almoxarifado];
      const hasNok = statuses.some(s => s === "NOK");
      return {
        almoxarifado,
        ano,
        semestre,
        status: hasNok ? "NOK" : "OK"
      };
    });

    return summaries;
  } catch (err) {
    console.warn("[Supabase] dbFetchAllNonMovingSummaries falhou:", err);
    return [];
  }
}

export async function dbFetchNonMovingSummaries() {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase
    .from('materiais_parados')
    .select('id, almoxarifado_id, mes, ano, quantidade_itens, valor_total, porcentagem_sem_giro');
  if (error) return [];
  return data || [];
}

// ======================= SYSTEM GLOBAL CONFIGURATIONS =======================
export async function dbSaveSystemConfig(configKey: string, payload: any, requesterRole?: string) {
  if (!isSupabaseReady()) return;
  try {
    const { error } = await supabase
      .from('top10_config')
      .upsert({
        almoxarifado_id: 'sys_config',
        mes: configKey,
        ano: 'global',
        itens: payload,
        configurado_por: 'Admin',
        updated_at: new Date().toISOString()
      }, { onConflict: 'almoxarifado_id,mes,ano' });

    if (error) {
      console.error(`[dbSaveSystemConfig] Error saving ${configKey}:`, error);
    }
  } catch (err) {
    console.error(`[dbSaveSystemConfig] Exception saving ${configKey}:`, err);
  }
}

export async function dbFetchSystemConfig(configKey: string): Promise<any | null> {
  if (!isSupabaseReady()) return null;
  try {
    const { data, error } = await supabase
      .from('top10_config')
      .select('itens')
      .eq('almoxarifado_id', 'sys_config')
      .eq('mes', configKey)
      .eq('ano', 'global')
      .single();

    if (error || !data) return null;
    return data.itens;
  } catch (err) {
    return null;
  }
}

export async function dbFetchGarantiaFieldConfig() {
  return await dbFetchSystemConfig('garantia_fields');
}
export async function dbSaveGarantiaFieldConfig(config: any, requesterRole?: string) {
  await dbSaveSystemConfig('garantia_fields', config, requesterRole);
}

export async function dbFetchTop10FieldConfig() {
  return await dbFetchSystemConfig('top10_fields');
}
export async function dbSaveTop10FieldConfig(config: any, requesterRole?: string) {
  await dbSaveSystemConfig('top10_fields', config, requesterRole);
}

export async function dbFetchLayoutFieldConfig() {
  return await dbFetchSystemConfig('layout_fields');
}
export async function dbSaveLayoutFieldConfig(config: any, requesterRole?: string) {
  await dbSaveSystemConfig('layout_fields', config, requesterRole);
}

export async function dbFetchUnimobinFieldConfig() {
  return await dbFetchSystemConfig('unimobin_fields');
}
export async function dbSaveUnimobinFieldConfig(config: any, requesterRole?: string) {
  await dbSaveSystemConfig('unimobin_fields', config, requesterRole);
}

export async function dbFetchSupervisorFieldConfig() {
  return await dbFetchSystemConfig('supervisor_fields');
}
export async function dbSaveSupervisorFieldConfig(fields: any[], requesterRole?: string) {
  await dbSaveSystemConfig('supervisor_fields', fields, requesterRole);
}

export async function dbFetchPresetItems() {
  return await dbFetchSystemConfig('preset_items');
}
export async function dbSavePresetItems(items: any[], requesterRole?: string) {
  await dbSaveSystemConfig('preset_items', items, requesterRole);
}

export async function dbFetchPresetManufacturers() {
  return await dbFetchSystemConfig('preset_manufacturers');
}
export async function dbSavePresetManufacturers(mfrs: string[], requesterRole?: string) {
  await dbSaveSystemConfig('preset_manufacturers', mfrs, requesterRole);
}

// ======================= TOP 10 CONFIG =======================
export async function dbSalvarTop10Config(almoxarifado_id: string, mes: string, ano: string, itens: any[], configurado_por: string, requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  const { error } = await supabase
    .from('top10_config')
    .upsert({ almoxarifado_id, mes, ano, itens, configurado_por, updated_at: new Date().toISOString() },
      { onConflict: 'almoxarifado_id,mes,ano' });
  if (error) throw error;
}

export async function dbBuscarTop10Config(almoxarifado_id: string, mes: string, ano: string) {
  const { data } = await supabase
    .from('top10_config')
    .select('itens, configurado_por, updated_at')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('mes', mes)
    .eq('ano', ano)
    .single();
  return data;
}

export const dbFetchTop10Config = async (almoxarifado: string, mesName: string, anoStr: string) => {
  if (!isSupabaseReady()) return null;
  const data = await dbBuscarTop10Config(almoxarifado, mesName, anoStr);
  if (!data) return null;
  return {
    itens: data.itens,
    configurado_por: data.configurado_por,
    configurado_em: data.updated_at
  };
};

export const dbSaveTop10Config = async (almoxarifado: string, mesName: string, anoStr: string, itens: any[], user: string, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  if (!isSupabaseReady()) return;
  await dbSalvarTop10Config(almoxarifado, mesName, anoStr, itens, user);
};

// ======================= TOP 10 ENVIOS =======================
export async function dbSalvarTop10Envio(almoxarifado_id: string, mes: string, ano: string, quantidades: any[], fotos: any[], enviado_por: string, requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  const { error } = await supabase
    .from('top10_envios')
    .upsert({ almoxarifado_id, mes, ano, quantidades, fotos, enviado_por, uploaded_at: new Date().toISOString() },
      { onConflict: 'almoxarifado_id,mes,ano' });
  if (error) throw error;
}

export async function dbBuscarTop10Envio(almoxarifado_id: string, mes: string, ano: string) {
  const { data } = await supabase
    .from('top10_envios')
    .select('id, almoxarifado_id, mes, ano, quantidades, fotos, enviado_por, uploaded_at')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('mes', mes)
    .eq('ano', ano)
    .single();
  return data;
}

export const dbFetchTop10Envios = async (almoxarifado: string, mesName: string, anoStr: string) => {
  if (!isSupabaseReady()) return null;
  const data = await dbBuscarTop10Envio(almoxarifado, mesName, anoStr);
  return data || null;
};

export const dbSaveTop10Envio = async (almoxarifado: string, mesName: string, anoStr: string, fotos: any[], user: string, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady()) return;
  await dbSalvarTop10Envio(almoxarifado, mesName, anoStr, [], fotos, user, requesterRole);
};

// ======================= LAYOUT CONFIG =======================
export async function dbSalvarLayoutConfig(almoxarifado_id: string, mes: string, ano: string, localizacao: string, instrucoes: string, requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  const mesInt = typeof mes === "number" ? mes : monthNameToNum(mes);
  const anoInt = typeof ano === "number" ? ano : parseInt(String(ano), 10);

  const { error } = await supabase
    .from('layout_config')
    .upsert({ 
      almoxarifado_id, 
      mes: mesInt, 
      ano: anoInt, 
      localizacao, 
      instrucoes, 
      updated_at: new Date().toISOString() 
    }, { onConflict: 'almoxarifado_id,mes,ano' });
  if (error) throw error;
}

export async function dbBuscarLayoutConfig(almoxarifado_id: string, mes: string, ano: string) {
  const mesInt = typeof mes === "number" ? mes : monthNameToNum(mes);
  const anoInt = typeof ano === "number" ? ano : parseInt(String(ano), 10);

  const { data } = await supabase
    .from('layout_config')
    .select('localizacao, instrucoes, configurado_por, updated_at')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('mes', mesInt)
    .eq('ano', anoInt)
    .single();
  return data;
}

export const dbFetchLayoutConfig = async (almoxarifado: string, mesName: string, anoStr: string) => {
  if (!isSupabaseReady()) return null;
  const data = await dbBuscarLayoutConfig(almoxarifado, mesName, anoStr);
  if (!data) return null;
  return {
    location: data.localizacao,
    instructions: data.instrucoes,
    configurado_por: data.configurado_por || "Almoxarife",
    configurado_em: data.updated_at
  };
};

export const dbSaveLayoutConfig = async (almoxarifado: string, mesName: string, anoStr: string, localizacao: string, user: string, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady()) return;
  await dbSalvarLayoutConfig(almoxarifado, mesName, anoStr, localizacao, "", requesterRole);
};

// ======================= UNIMOBIN CERTIFICADOS =======================
export async function dbSalvarCertificado(almoxarifado_id: string, mes: string, ano: string, colaborador_nome: string, dados: any, requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  // If fileData is too large, use a placeholder instead of sending megabytes over PostgREST/PostgreSQL
  const inputData = dados.fileData || dados.file_data || null;
  const safeFileData = (inputData && inputData.length > 50000)
    ? "placeholder-heavy-data"
    : inputData;

  let safeUploadedAt = dados.uploadedAt || dados.uploaded_at || new Date().toISOString();
  if (typeof safeUploadedAt === 'string' && safeUploadedAt.includes('/')) {
    safeUploadedAt = new Date().toISOString();
  }

  const { error } = await supabase
    .from('unimobin_certificados')
    .upsert({
      almoxarifado_id, mes, ano, colaborador_nome,
      status: dados.status || 'Aguardando envio',
      file_name: dados.fileName || dados.file_name || null,
      file_type: dados.fileType || dados.file_type || null,
      file_data: safeFileData,
      uploaded_at: safeUploadedAt,
      enviado_em: safeUploadedAt
    },
      { onConflict: 'almoxarifado_id,mes,ano,colaborador_nome' });
  if (error) {
    console.error("[dbSalvarCertificado ERROR DETAILED]:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }

  // Sincronização de almoxarifados duplos:
  const twinId = getTwinBranchId(almoxarifado_id);
  if (twinId) {
    const { error: twinError } = await supabase
      .from('unimobin_certificados')
      .upsert({
        almoxarifado_id: twinId, mes, ano, colaborador_nome,
        status: dados.status || 'Aguardando envio',
        file_name: dados.fileName || dados.file_name || null,
        file_type: dados.fileType || dados.file_type || null,
        file_data: safeFileData,
        uploaded_at: safeUploadedAt,
        enviado_em: safeUploadedAt
      },
        { onConflict: 'almoxarifado_id,mes,ano,colaborador_nome' });
    if (twinError) {
      console.error("[twin sync certificates] Error:", twinError);
    }
  }
}

export async function dbBuscarCertificados(almoxarifado_id: string, mes: string, ano: string) {
  const { data, error } = await supabase
    .from('unimobin_certificados')
    .select('id, almoxarifado_id, mes, ano, colaborador_nome, status, anexo_url, enviado_por, enviado_em')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('mes', mes)
    .eq('ano', ano);
  if (error) throw error;
  return data || [];
}

export const dbFetchColaboradoresUnimobin = async () => {
  if (!isSupabaseReady()) {
    return [];
  }

  // Fallback map colaboradores_unimobin from unimobin_certificados or returning base profiles
  const { data, error } = await supabase.from('unimobin_certificados').select('id, colaborador_nome, status');
  if (error || !data) return [];
  return data.map(item => ({
    id: item.id,
    name: item.colaborador_nome,
    status: (item.status as CollaboratorCertificate['status']) || "Aguardando envio",
    cargo: "Motorista/Colaborador"
  }));
};

export const dbSaveColaboradorUnimobin = async (name: string, cargo: string, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady()) return;
  // Just save a blank mock certificate
  await dbSalvarCertificado("default", "Janeiro", "2026", name, {
    status: "Aguardando envio"
  }, requesterRole);
};

// ======================= HISTORICO AVALIACOES =======================
export async function dbSalvarHistorico(entry: any, requesterRole?: string) {
  if (!isSupabaseReady()) return;
  try {
    checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  } catch (e) {
    console.warn("Permission notice in dbSalvarHistorico:", e);
  }
  
  let mesVal = entry.mes;
  let anoVal = entry.ano;
  if ((!mesVal || !anoVal) && entry.monthYear) {
    const parts = String(entry.monthYear).trim().split(" ");
    if (parts.length >= 2) {
      mesVal = mesVal || parts[0];
      anoVal = anoVal || parts[1];
    } else if (parts.length === 1) {
      mesVal = mesVal || parts[0];
    }
  }

  let rawDate = entry.fechado_em || entry.dateEvaluated || entry.date_evaluated;
  let fechadoEmIso = new Date().toISOString();
  if (rawDate && typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    const ddmmyyyyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year, hours = "00", minutes = "00", seconds = "00"] = ddmmyyyyMatch;
      const parsedDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`);
      if (!isNaN(parsedDate.getTime())) {
        fechadoEmIso = parsedDate.toISOString();
      }
    } else {
      const parsedDate = new Date(trimmed);
      if (!isNaN(parsedDate.getTime())) {
        fechadoEmIso = parsedDate.toISOString();
      }
    }
  }

  const branchIdentifier = entry.almoxarifado_id || entry.almoxarifado || entry.branchId || entry.branch_id || "";

  // Clean JSON serialization to ensure no undefined values or non-serializable objects cause payload failures
  let cleanCriterios: any[] = [];
  try {
    cleanCriterios = JSON.parse(JSON.stringify(
      entry.criterios || entry.criteriaState || entry.criteria_state || entry.nokItems || []
    ));
  } catch (e) {
    console.warn("Could not stringify criterios in dbSalvarHistorico:", e);
  }

  const dbEntry: any = {
    almoxarifado_id: branchIdentifier,
    mes: mesVal || "",
    ano: anoVal || "",
    pontuacao_total: entry.pontuacao_total !== undefined ? entry.pontuacao_total : (entry.score !== undefined ? entry.score : 0),
    status_ciclo: entry.status_ciclo || entry.status || "ARQUIVADO",
    criterios: cleanCriterios,
    fechado_em: fechadoEmIso
  };

  // Delete existing history row for same branch, month, year if present to avoid 23505 unique violation error
  if (branchIdentifier && mesVal) {
    try {
      await supabase
        .from('historico_avaliacoes')
        .delete()
        .eq('almoxarifado_id', branchIdentifier)
        .eq('mes', mesVal)
        .eq('ano', anoVal || "2026");
    } catch (e) {
      // Ignore pre-delete error
    }
  }
  
  let { error } = await supabase
    .from('historico_avaliacoes')
    .insert(dbEntry);

  if (error) {
    console.warn("Attempt 1 insert in dbSalvarHistorico failed, trying with 'almoxarifado' column fallback:", error);
    
    // Fallback attempt with 'almoxarifado' column instead of 'almoxarifado_id'
    const fallbackEntry = { ...dbEntry, almoxarifado: branchIdentifier };
    delete fallbackEntry.almoxarifado_id;

    const res2 = await supabase
      .from('historico_avaliacoes')
      .insert(fallbackEntry);

    if (res2.error) {
      console.warn("Attempt 2 insert in dbSalvarHistorico failed, trying numeric month/year:", res2.error);

      const numericMes = typeof mesVal === "string" ? monthNameToNum(mesVal) : mesVal;
      const numericAno = typeof anoVal === "string" ? parseInt(anoVal, 10) : anoVal;

      const attempt3Entry = { ...dbEntry, mes: numericMes, ano: numericAno };
      const res3 = await supabase
        .from('historico_avaliacoes')
        .insert(attempt3Entry);

      if (res3.error) {
        console.error("Error saving to database in dbSalvarHistorico:", res3.error);
        // Non-blocking warning so user operation finishes smoothly and UI state updates
      }
    }
  }
}

export async function dbSaveHistory(historyList: any[], requesterRole?: string) {
  checkPermission(["ADMIN"], requesterRole);
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    for (const entry of historyList) {
      await dbSalvarHistorico(entry, requesterRole);
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
}

export async function dbFetchHistory(): Promise<any[]> {
  if (!isSupabaseReady()) return [];
  let result = await supabase
    .from('historico_avaliacoes')
    .select('id, almoxarifado_id, mes, ano, pontuacao_total, status_ciclo, criterios, fechado_em')
    .order('fechado_em', { ascending: false })
    .limit(100);
    
  if (result.error) {
    console.warn("Could not order by fechado_em in dbFetchHistory, retrying without order:", result.error);
    result = await supabase
      .from('historico_avaliacoes')
      .select('id, almoxarifado_id, mes, ano, pontuacao_total, status_ciclo, criterios, fechado_em')
      .limit(100);
  }
  
  if (result.error) {
    console.error("Error standardizing history in dbFetchHistory:", result.error);
    return [];
  }
  
  const rawData = result.data || [];
  
  // Sort in memory safely
  try {
    rawData.sort((a: any, b: any) => {
      const valA = a.fechado_em || a.date_evaluated || a.id || "";
      const valB = b.fechado_em || b.date_evaluated || b.id || "";
      return String(valB).localeCompare(String(valA));
    });
  } catch (e) {
    console.warn("Failed to sort history in memory:", e);
  }
  
  return rawData.map(entry => {
    const mes = entry.mes || (entry.month_year ? entry.month_year.split(" ")[0] : "");
    const ano = entry.ano || (entry.month_year ? entry.month_year.split(" ")[1] : "");
    const monthYear = entry.monthYear || entry.month_year || (mes && ano ? `${mes} ${ano}` : mes || ano || "");
    const scoreVal = entry.pontuacao_total !== undefined ? entry.pontuacao_total : (entry.score !== undefined ? entry.score : 0);
    const criteriosList = entry.criterios || entry.criteria_state || entry.criteriaState || [];

    return {
      id: entry.id,
      almoxarifado_id: entry.almoxarifado_id || entry.branch_id || entry.branchId,
      branchId: entry.almoxarifado_id || entry.branch_id || entry.branchId,
      branchName: entry.branchName || entry.branch_name,
      mes: mes,
      ano: ano,
      monthYear: monthYear,
      pontuacao_total: scoreVal,
      score: scoreVal,
      scoreCategory: scoreVal >= 90 ? "EXCELENTE" : (scoreVal >= 80 ? "BOM" : "EM ALERTA"),
      status_ciclo: entry.status_ciclo || entry.status || "ARQUIVADO",
      status: entry.status_ciclo || entry.status || "ARQUIVADO",
      fechado_em: entry.fechado_em || entry.date_evaluated || entry.dateEvaluated,
      dateEvaluated: entry.fechado_em || entry.date_evaluated || entry.dateEvaluated,
      auditorName: entry.auditorName || entry.auditor_name || "Fernando Silva",
      criterios: criteriosList,
      criteriaState: criteriosList,
      nokItems: Array.isArray(criteriosList)
        ? criteriosList.filter((c: any) => typeof c === 'string' ? true : (c && c.status === "NOK")).map((c: any) => typeof c === 'string' ? c : c.name)
        : (entry.nok_items || entry.nokItems || [])
    };
  });
}

export async function dbFetchYearEvaluations(ano: string | number): Promise<any[]> {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase
    .from('avaliacoes')
    .select('id, almoxarifado, mes, ano, criterio_codigo, criterio_nome, resultado, pontuacao, descricao_evidencia, links_evidencia, avaliado_por, avaliado_em, audit_mode, modo_auditoria')
    .eq('ano', Number(ano));
  if (error || !data) {
    console.warn("Error in dbFetchYearEvaluations:", error);
    return [];
  }
  return data;
}

export async function dbFetchAlmoxarifados(): Promise<Branch[]> {
  if (!isSupabaseReady()) return [];
  try {
    const { data, error } = await supabase
      .from('almoxarifados')
      .select('id, nome, cidade, estado, grupo, responsavel, garagem_dupla_com, ativo')
      .eq('ativo', true)
      .order('grupo', { ascending: true })
      .order('nome', { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn("dbFetchAlmoxarifados error or empty:", error);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.nome || row.id,
      location: row.cidade && row.estado ? `${row.cidade}, ${row.estado}` : row.cidade || row.estado || "Brasil",
      currentScore: 0,
      meta: 100,
      status: "PENDENTE" as const,
      scoreCategory: "Abaixo da Meta" as const,
      criteria: getCriteriaForBranch(0),
      ownerName: row.responsavel || "Almoxarife",
      group: (row.grupo === "A" || row.grupo === "B") ? row.grupo : "A",
      semestralScore: 0
    }));
  } catch (err) {
    console.error("Error in dbFetchAlmoxarifados:", err);
    return [];
  }
}

export async function dbUpdateAlmoxarifadoNome(id: string, newNome: string): Promise<boolean> {
  if (!isSupabaseReady()) return false;
  try {
    const { error } = await supabase
      .from('almoxarifados')
      .update({ nome: newNome })
      .eq('id', id);

    if (error) {
      console.error("Error updating almoxarifado in Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error in dbUpdateAlmoxarifadoNome:", err);
    return false;
  }
}


