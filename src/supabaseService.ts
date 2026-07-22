import { supabase, isSupabaseReady, realtimeFlags } from "./supabaseClient";
export { isSupabaseReady };
import { AppUser, Branch, CriterionState, WarrantyItem, MaterialOccurrence, EvaluationStatus, CollaboratorCertificate } from "./types";
import { OFFICIAL_CREDENTIALS } from "./components/Login";
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
    console.error(`Error uploading to Supabase Storage:`, error);
    throw error;
  }

  const { data, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(cleanPath, 3600);

  if (signedError || !data?.signedUrl) {
    console.error("Error creating signed URL:", signedError);
    throw signedError || new Error("Signed URL generation failed");
  }

  return data.signedUrl;
};

// ==========================================
// ROLE AND PERMISSION VALIDATION HELPERS (FASE 7)
// ==========================================
export const getRequesterRole = (): string | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    const raw = window.localStorage.getItem("acandido_app_user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        return u.role || null;
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

export const checkPermission = (allowedRoles: string[], requesterRole?: string) => {
  // If we are in the browser, always prioritize the true localStorage session role
  // to prevent spoofing via manually passed parameters in developer tools.
  const sessionRole = getRequesterRole();
  const role = sessionRole || requesterRole;
  if (!role) {
    throw new Error("Acesso negado: Usuário não autenticado no sistema.");
  }
  if (!allowedRoles.includes(role)) {
    throw new Error(`Acesso negado: O perfil '${role}' não possui permissão para executar esta operação.`);
  }
};

// UUID helper generator
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
    
    if (usersError || !existingUsers || existingUsers.length < OFFICIAL_CREDENTIALS.length || !hasFernando) {
      console.log("Seeding system users table ('usuarios') with complete profiles...");
      const usersToInsert = OFFICIAL_CREDENTIALS.map(u => {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(u.password, salt);
        return {
          nome: u.name,
          email: u.email.toLowerCase().trim(),
          perfil: u.role === "ADMIN" ? "auditor" : u.role === "SUPERVISOR" ? "supervisor" : "almoxarife",
          senha_hash: hash,
          almoxarifado: JSON.stringify({
            password: "",
            cargo: (u as any).cargo || "",
            group: u.group || "A",
            ownerName: u.ownerName || u.name.split(" ")[0],
            almoxarifados: (u as any).almoxarifados || []
          }),
          ativo: true
        };
      });
      await supabase.from('usuarios').upsert(usersToInsert, { onConflict: 'email' });
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
    const { data: users, error } = await supabase.from("usuarios").select("*");
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

      // Recover plain password
      let plainPassword = "";
      if (u.almoxarifado && typeof u.almoxarifado === "string" && u.almoxarifado.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(u.almoxarifado);
          plainPassword = parsed.password || "";
        } catch (e) {}
      }

      if (!plainPassword) {
        const official = OFFICIAL_CREDENTIALS.find(o => o.email.toLowerCase().trim() === email);
        if (official) {
          plainPassword = official.password;
        }
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
    const { data: users, error } = await supabase.from("usuarios").select("*");
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

export const dbFetchUsers = async (): Promise<AppUser[]> => {
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem("acandido_users");
    return saved ? JSON.parse(saved) : [];
  }

  const { data, error } = await supabase.from('usuarios').select('*');
  if (error || !data) {
    const saved = localStorage.getItem("acandido_users");
    return saved ? JSON.parse(saved) : [];
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

    // Match with OFFICIAL_CREDENTIALS for robust fallback definitions
    const official = OFFICIAL_CREDENTIALS.find(o => o.email.toLowerCase().trim() === u.email.toLowerCase().trim());
    const cargo = extra.cargo || (official ? (official as any).cargo : "");
    const almoxarifados = extra.almoxarifados || (official ? (official as any).almoxarifados : []);
    const group = extra.group || (official ? official.group : "A");
    const ownerName = extra.ownerName || (official ? official.ownerName : u.nome.split(" ")[0]);

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
    password: "", // ALWAYS empty, no plain text password ever stored in JSON
    cargo: (user as any).cargo || "",
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
    await query;
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
    .select('*')
    .eq('status', 'ABERTO')
    .single();
  return data;
}

export async function dbAbrirCiclo(mes: string, ano: string, aberto_por: string, requesterRole?: string) {
  checkPermission(["ADMIN"], requesterRole);
  const { data, error } = await supabase
    .from('ciclos')
    .upsert({ mes, ano, status: 'ABERTO', aberto_por, aberto_em: new Date().toISOString() })
    .select().single();
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
  const defaultState: CycleState = { activeMonth: "Janeiro", activeYear: "2026", status: "ABERTO", openedAt: "01/01/2026", openedBy: "Fernando Silva" };
  
  // Rule 4: If Supabase is not ready, load from localStorage fallback to ensure the last state is persisted.
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem("acandido_cycle_state_manual");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse cached cycleState on offline fallback:", e);
      }
    }
    return defaultState;
  }

  // Fetch the active cycle (ABERTO or aberto) from the database
  let { data, error } = await supabase
    .from('ciclos')
    .select('*')
    .in('status', ['ABERTO', 'aberto'])
    .order('iniciado_em', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    // Fetch critical locked cycle (AGUARDANDO_FECHAMENTO or aguardando_fechamento)
    const resBloq = await supabase
      .from('ciclos')
      .select('*')
      .in('status', ['AGUARDANDO_FECHAMENTO', 'aguardando_fechamento'])
      .order('iniciado_em', { ascending: false })
      .limit(1);
      
    if (!resBloq.error && resBloq.data && resBloq.data.length > 0) {
      data = resBloq.data;
    } else {
      // Fetch the latest cycle of all (e.g. FECHADO or fechado)
      const resLatest = await supabase
        .from('ciclos')
        .select('*')
        .order('iniciado_em', { ascending: false })
        .limit(1);
        
      if (!resLatest.error && resLatest.data && resLatest.data.length > 0) {
        data = resLatest.data;
      }
    }
  }

  if (!data || data.length === 0) {
    const saved = localStorage.getItem("acandido_cycle_state_manual");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status) {
          return parsed;
        }
      } catch (e) {}
    }
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
    status: String(current.status).toUpperCase() as any,
    openedAt: current.iniciado_em || current.aberto_em,
    openedBy: current.iniciado_por || current.aberto_por
  };
};

export const dbSaveCycleState = async (cycle: CycleState, requesterRole?: string) => {
  checkPermission(["ADMIN"], requesterRole);
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    
    // Convert string month to number (e.g. "Março" -> 3) and year to integer (e.g. "2026" -> 2026)
    const dbMes = typeof cycle.activeMonth === "string" ? monthNameToNum(cycle.activeMonth) : cycle.activeMonth;
    const dbAno = typeof cycle.activeYear === "string" ? parseInt(cycle.activeYear, 10) : cycle.activeYear;

    const updateObj = {
      mes: dbMes,
      ano: dbAno,
      status: cycle.status === "NENHUM" ? "ABERTO" : cycle.status,
      aberto_por: cycle.openedBy || "Fernando Silva",
      aberto_em: cycle.openedAt || new Date().toISOString(),
      iniciado_por: cycle.openedBy || "Fernando Silva",
      iniciado_em: cycle.openedAt || new Date().toISOString(),
      fechado_em: cycle.status === "FECHADO" || cycle.status === "ARQUIVADO" ? new Date().toISOString() : null
    };

    const { error } = await supabase.from('ciclos').upsert(updateObj, { onConflict: 'mes,ano' });
    if (error) {
      console.warn("Error upserting cycle state, falling back to update:", error);
      // Fallback to updating status and fechado_em directly if the row already exists and upsert fails
      const { error: updateError } = await supabase
        .from('ciclos')
        .update({
          status: updateObj.status,
          fechado_em: updateObj.fechado_em
        })
        .eq('mes', dbMes)
        .eq('ano', dbAno);
      if (updateError) {
        throw updateError;
      }
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbFetchAllCycles = async (): Promise<CycleState[]> => {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase.from('ciclos').select('*');
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
      status: String(item.status).toUpperCase() as any,
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
    .select('*')
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
    .select('*')
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
    .select('*')
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
      .select('*')
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
  if (branchId === "unissana-rn") return "ALMOXARIFADO UNISSANA RN";
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
      .select('*')
      .eq('mes', mesNum)
      .eq('ano', anoNum),
    supabase
      .from('audit_modes')
      .select('*')
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
    .select('*')
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

  const { data, error } = await supabase.from('calendario_inventarios').select('*').order('id', { ascending: true });
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

  let query = supabase.from('calendario_inventarios').select('*').eq('almoxarifado', branchId);
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
    await supabase.from('calendario_inventarios').upsert(record, { onConflict: 'almoxarifado,ano,semestre,indice' });
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbDeleteSchedule = async (id: string, requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR"], requesterRole);
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    await supabase.from('calendario_inventarios').delete().eq('id', id);
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= WARRANTIES (garantias) =======================
export async function dbSalvarGarantia(garantia: any, requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  const { error } = await supabase
    .from('garantias')
    .upsert({
      id: garantia.id && !garantia.id.startsWith("tmp") ? garantia.id : undefined,
      almoxarifado_id: garantia.almoxarifado_id || garantia.almoxarifado || "",
      mes: garantia.mes || "Janeiro",
      ano: garantia.ano || "2026",
      item_code: garantia.item_code || garantia.itemCode || "",
      item_description: garantia.item_description || garantia.itemDescription || "",
      fabricante: garantia.fabricante || "",
      garantia_ate: garantia.garantia_ate || garantia.expiryDate || null,
      data_nf: garantia.data_nf || garantia.nfEmissionDate || null,
      referencia_item: garantia.referencia_item || garantia.reference || "",
      observacao_peca: garantia.observacao_peca || garantia.pieceObservation || "Nenhuma observação",
      observacao_sucata: garantia.observacao_sucata || garantia.scrapObservation || "",
      updated_at: new Date().toISOString()
    });
  if (error) throw error;
}

export async function dbBuscarGarantias(almoxarifado_id: string, mes: string, ano: string) {
  const { data, error } = await supabase
    .from('garantias')
    .select('*')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('mes', mes)
    .eq('ano', ano);
  if (error) throw error;
  return data || [];
}

export const dbFetchWarranties = async (): Promise<WarrantyItem[]> => {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase.from('garantias').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(item => ({
    id: item.id,
    itemCode: item.item_code,
    itemDescription: item.item_description || "",
    manufacturer: item.fabricante || "",
    expiryDate: item.garantia_ate || "",
    almoxarifado: item.almoxarifado_id,
    nfEmissionDate: item.data_nf || "",
    reference: item.referencia_item || "",
    lastUpdateDate: item.updated_at,
    pieceObservation: item.observacao_peca || "",
    scrapObservation: item.observacao_sucata || "",
    monthYear: `${item.mes} ${item.ano}`
  }));
};

export const dbSaveWarranties = async (warranties: WarrantyItem[], requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of warranties) {
      const spaceParts = item.monthYear ? item.monthYear.split(' ') : [];
      const mesStr = spaceParts[0] || "Maio";
      const anoStr = spaceParts[1] || "2026";

      await dbSalvarGarantia({
        id: item.id,
        almoxarifado_id: item.almoxarifado,
        mes: mesStr,
        ano: anoStr,
        item_code: item.itemCode,
        item_description: item.itemDescription,
        fabricante: item.manufacturer,
        garantia_ate: item.expiryDate || null,
        data_nf: item.nfEmissionDate || null,
        referencia_item: item.reference,
        observacao_peca: item.pieceObservation,
        observacao_sucata: item.scrapObservation
      });
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= LEVEL OF SERVICE OCCURRENCES =======================
export async function dbSalvarNivelServico(registro: any, requesterRole?: string) {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  const { error } = await supabase
    .from('nivel_servico')
    .upsert({
      id: registro.id && !registro.id.startsWith("tmp") ? registro.id : undefined,
      almoxarifado_id: registro.almoxarifado_id || registro.branchName || registro.filial || "",
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
    .select('*')
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

export const dbFetchOccurrences = async (): Promise<MaterialOccurrence[]> => {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase.from('nivel_servico').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(o => ({
    id: o.id,
    material: o.material_falta,
    date: o.data_ocorrencia || "",
    status: o.status as any,
    branchId: o.almoxarifado_id,
    branchName: o.almoxarifado_id,
    veiculo: o.veiculo || "",
    solicitante: o.solicitante || "",
    codigoMaterial: o.codigo_material || "",
    filial: o.almoxarifado_id,
    obs: o.observacao || "",
    dias_aberto: o.dias_aberto || 0,
    resolvedAt: o.data_resolucao || ""
  }));
};

export const dbSaveOccurrences = async (occs: MaterialOccurrence[], requesterRole?: string) => {
  checkPermission(["ADMIN", "SUPERVISOR", "ALMOXARIFE"], requesterRole);
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of occs) {
      await dbSalvarNivelServico({
        id: item.id,
        almoxarifado_id: item.branchName || item.filial || "",
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
  await supabase.from('materiais_parados')
    .delete()
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('semestre', semestre)
    .eq('ano', ano);

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
  const { data, error } = await supabase
    .from('materiais_parados')
    .select('*')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('semestre', semestre)
    .eq('ano', ano);
  if (error) throw error;
  return data || [];
}

export const dbFetchNonMovingMaterials = async (almoxarifado: string, ano: number, semestre: number): Promise<any> => {
  if (!isSupabaseReady()) return null;

  const dbRows = await dbBuscarMateriaisParados(almoxarifado, semestre, ano);
  if (!dbRows || dbRows.length === 0) return null;

  return {
    almoxarifado,
    ano,
    semestre,
    timestamp: dbRows[0].inserted_em,
    insertedBy: "Almoxarife",
    materials: dbRows.map(r => ({
      code: r.codigo,
      description: r.descricao,
      lastMovement: r.ultimo_movimento,
      status: r.status
    })),
    isEvaluated: dbRows.some(r => r.status && r.status !== "OK"),
    resultStatus: (dbRows.some(r => r.status === "NOK") ? "NOK" : "OK") as EvaluationStatus
  };
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
    .select('*')
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
    .select('*')
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
    .select('*')
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
    .select('*')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('mes', mes)
    .eq('ano', ano);
  if (error) throw error;
  return data || [];
}

export const dbFetchColaboradoresUnimobin = async () => {
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem("acandido_all_collab_profiles");
    return saved ? JSON.parse(saved) : [];
  }

  // Fallback map colaboradores_unimobin from unimobin_certificados or returning base profiles
  const { data, error } = await supabase.from('unimobin_certificados').select('*');
  if (error || !data) return [];
  return data.map(item => ({
    id: item.id,
    name: item.colaborador_nome,
    status: item.status as any,
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
  checkPermission(["ADMIN"], requesterRole);
  if (!isSupabaseReady()) return;
  
  // Create object mapping both camelCase and snake_case properties
  const dbEntry = {
    id: entry.id,
    branch_id: entry.branchId || entry.branch_id || "",
    branch_name: entry.branchName || entry.branch_name || "",
    month_year: entry.monthYear || entry.month_year || "",
    score: entry.score !== undefined ? entry.score : 0,
    score_category: entry.scoreCategory || entry.score_category || "",
    status: entry.status || "PENDENTE",
    date_evaluated: entry.dateEvaluated || entry.date_evaluated || "",
    auditor_name: entry.auditorName || entry.auditor_name || "",
    nok_items: entry.nokItems || entry.nok_items || [],
    criteria_state: entry.criteriaState || entry.criteria_state || []
  };
  
  const { error } = await supabase
    .from('historico_avaliacoes')
    .upsert(dbEntry, { onConflict: 'id' });
    
  if (error) {
    console.error("Error saving to database in dbSalvarHistorico:", error);
    throw error;
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
    .select('*')
    .order('created_at', { ascending: false });
    
  if (result.error) {
    console.warn("Could not order by created_at in dbFetchHistory, retrying without order:", result.error);
    result = await supabase
      .from('historico_avaliacoes')
      .select('*');
  }
  
  if (result.error) {
    console.error("Error standardizing history in dbFetchHistory:", result.error);
    return [];
  }
  
  const rawData = result.data || [];
  
  // Sort in memory safely
  try {
    rawData.sort((a: any, b: any) => {
      const valA = a.created_at || a.date_evaluated || a.id || "";
      const valB = b.created_at || b.date_evaluated || b.id || "";
      return String(valB).localeCompare(String(valA));
    });
  } catch (e) {
    console.warn("Failed to sort history in memory:", e);
  }
  
  return rawData.map(entry => ({
    id: entry.id,
    branchId: entry.branch_id || entry.branchId,
    branchName: entry.branch_name || entry.branchName,
    monthYear: entry.month_year || entry.monthYear,
    score: entry.score,
    scoreCategory: entry.score_category || entry.scoreCategory,
    status: entry.status,
    dateEvaluated: entry.date_evaluated || entry.dateEvaluated,
    auditorName: entry.auditor_name || entry.auditorName,
    nokItems: entry.nok_items || entry.nokItems || [],
    criteriaState: entry.criteria_state || entry.criteriaState || []
  }));
}

export async function dbFetchYearEvaluations(ano: string | number): Promise<any[]> {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('ano', Number(ano));
  if (error || !data) {
    console.warn("Error in dbFetchYearEvaluations:", error);
    return [];
  }
  return data;
}


