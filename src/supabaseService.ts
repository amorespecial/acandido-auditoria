import { supabase, isSupabaseReady, realtimeFlags } from "./supabaseClient";
export { isSupabaseReady };
import { AppUser, Branch, CriterionState, WarrantyItem, MaterialOccurrence, EvaluationStatus } from "./types";
import { OFFICIAL_CREDENTIALS } from "./components/Login";

// Helper variables for fallback / mock mode
const STORAGE_PREFIX = "acandido_";

// Month conversion helpers
export const monthNameToNum = (name: string): number => {
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const index = months.findIndex(m => m.toLowerCase() === name.toLowerCase());
  return index !== -1 ? index + 1 : 5; // default to 5 (Maio)
};

export const monthNumToName = (num: number): string => {
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return months[num - 1] || "Maio";
};

// Base64 helper for image uploads
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
    // Return a data URL or helper URL
    if (typeof fileSource === 'string' && fileSource.startsWith('data:')) {
      return fileSource; // keep raw image data for mockup view
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

  // Generate signed URL (expiring in 1 hour)
  const { data, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(cleanPath, 3600);

  if (signedError || !data?.signedUrl) {
    console.error("Error creating signed URL:", signedError);
    throw signedError || new Error("Signed URL generation failed");
  }

  return data.signedUrl;
};

// Auto Seeding function
export const seedDatabaseIfEmpty = async () => {
  if (!isSupabaseReady()) {
    console.log("[Supabase Offline] Seeding skipped (running in offline simulation mode)");
    return;
  }

  try {
    // 1. Seed system users
    const { data: existingUsers, error: usersError } = await supabase.from('usuarios').select('id').limit(1);
    if (usersError || !existingUsers || existingUsers.length === 0) {
      console.log("Seeding system users table ('usuarios') with complete profiles...");
      const usersToInsert = OFFICIAL_CREDENTIALS.map(u => ({
        nome: u.name,
        email: u.email.toLowerCase().trim(),
        perfil: JSON.stringify({
          role: u.role,
          group: u.group,
          cargo: u.cargo || "",
          password: u.password || "",
          almoxarifados: (u as any).almoxarifados || []
        }),
        almoxarifado: u.ownerName,
        ativo: true
      }));
      await supabase.from('usuarios').upsert(usersToInsert, { onConflict: 'email' });
    }

    // 2. Seed calendario_inventarios 2026
    const { data: existingCal, error: calError } = await supabase.from('calendario_inventarios').select('id').limit(1);
    if (!calError && (!existingCal || existingCal.length === 0)) {
      console.log("Seeding 2026 inventory schedule table ('calendario_inventarios')...");
      const CALENDAR_ENTRIES_2026 = [
        { almoxarifado: "Santa Maria JPA", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-06-26" },
        { almoxarifado: "Santa Maria JPA", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-11-27" },
        { almoxarifado: "A.Candido CG", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-17" },
        { almoxarifado: "A.Candido CG", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-08-18" },
        { almoxarifado: "Trans CG", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-17" },
        { almoxarifado: "Trans CG", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-08-18" },
        { almoxarifado: "Trans CG Metrop (Bayeux)", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-10" },
        { almoxarifado: "Trans CG Metrop (Bayeux)", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-12" },
        { almoxarifado: "Trans Fret CE", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-25" },
        { almoxarifado: "Trans Fret CE", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-15" },
        { almoxarifado: "Trans Fret Goiana", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-05-16" },
        { almoxarifado: "Trans Fret Goiana", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-31" },
        { almoxarifado: "Trans Fret PB", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-08" },
        { almoxarifado: "Trans Fret PB", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-07-22" },
        { almoxarifado: "Trans Fret PE", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-15" },
        { almoxarifado: "Trans Fret PE", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-07-08" },
        { almoxarifado: "Trans Rod CE", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-06-09" },
        { almoxarifado: "Trans Rod CE", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-10" },
        { almoxarifado: "Trans Rod PB (Bayeux)", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-10" },
        { almoxarifado: "Trans Rod PB (Bayeux)", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-12" },
        { almoxarifado: "Trans Rod PB Cabedelo", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-02-10" },
        { almoxarifado: "Trans Rod PB Cabedelo", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-12" },
        { almoxarifado: "Trans Rod PE", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-01-15" },
        { almoxarifado: "Trans Rod PE", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-07-08" },
        { almoxarifado: "Transnacional RN", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-07" },
        { almoxarifado: "Transnacional RN", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-26" },
        { almoxarifado: "Unissanta RN", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-06" },
        { almoxarifado: "Unissanta RN", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-10-25" },
        { almoxarifado: "Unitrans JPA", ano: 2026, semestre: 1, indice: 1, data_agendada: "2026-03-12" },
        { almoxarifado: "Unitrans JPA", ano: 2026, semestre: 2, indice: 1, data_agendada: "2026-09-09" }
      ];
      await supabase.from('calendario_inventarios').insert(CALENDAR_ENTRIES_2026);
    }

    // 3. Seed almoxarifados metadata
    const { data: existingAlms, error: almsError } = await supabase.from('almoxarifados').select('id').limit(1);
    if (!almsError && (!existingAlms || existingAlms.length === 0)) {
      console.log("Seeding warehouses table ('almoxarifados')...");
      const initialWarehousesMap = [
        { nome: "ALMOXARIFADO UNITRANS JP", cidade: "João Pessoa", estado: "PB", grupo: "A", responsavel: "Robson", ativo: true },
        { nome: "SANTA MARIA JP", cidade: "João Pessoa", estado: "PB", grupo: "A", responsavel: "Robson", ativo: true },
        { nome: "TRANS CG", cidade: "Campina Grande", estado: "PB", grupo: "A", responsavel: "Paulo", ativo: true },
        { nome: "A.CÂNDIDO CG", cidade: "Campina Grande", estado: "PB", grupo: "A", responsavel: "Paulo", ativo: true },
        { nome: "FRETAMENTO GOIANA", cidade: "Goiana", estado: "PE", grupo: "A", responsavel: "Ezequiel", ativo: true },
        { nome: "FRETAMENTO PE", cidade: "Recife", estado: "PE", grupo: "A", responsavel: "Sérgio", ativo: true },
        { nome: "RODOVIÁRIO PE", cidade: "Recife", estado: "PE", grupo: "A", responsavel: "Sérgio", ativo: true },
        { nome: "RODOVIÁRIO METROP CT", cidade: "Cabedelo", estado: "PB", grupo: "B", responsavel: "Robson", ativo: true },
        { nome: "FRETAMENTO PB", cidade: "João Pessoa", estado: "PB", group: "B", responsavel: "Lucas", ativo: true },
        { nome: "TRANS CG METROP BY", cidade: "Bayeux", estado: "PB", grupo: "B", responsavel: "Matheus", ativo: true },
        { nome: "RODOVIÁRIO RETROP BY", cidade: "Bayeux", estado: "PB", grupo: "B", responsavel: "Matheus", ativo: true },
        { nome: "TRANSNACIONAL RN", cidade: "Natal", estado: "RN", grupo: "B", responsavel: "Raimundo", ativo: true },
        { nome: "UNISSANTA RN", cidade: "Natal", estado: "RN", grupo: "B", responsavel: "Joel", ativo: true },
        { nome: "FRETAMENTO CE", cidade: "Fortaleza", estado: "CE", grupo: "B", responsavel: "Arline", ativo: true },
        { nome: "RODOVIÁRIO CE", cidade: "Fortaleza", estado: "CE", grupo: "B", responsavel: "Arline", ativo: true }
      ];
      await supabase.from('almoxarifados').insert(initialWarehousesMap);
    }
  } catch (error) {
    console.error("Failed to seed database tables:", error);
  }
};

// ======================= SYSTEM USERS (usuarios) =======================
export const dbFetchUsers = async (): Promise<AppUser[]> => {
  const saved = localStorage.getItem(`${STORAGE_PREFIX}users`);
  let localUsers: AppUser[] = OFFICIAL_CREDENTIALS;
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localUsers = parsed;
      }
    } catch (e) {
      console.warn("Error parsing saved users in dbFetchUsers:", e);
    }
  }

  if (!isSupabaseReady()) {
    return localUsers;
  }

  try {
    const { data, error } = await supabase.from('usuarios').select('*');
    if (error) {
      console.warn("dbFetchUsers error from Supabase, falling back:", error);
      return localUsers;
    }

    if (!data || data.length === 0) {
      // If Supabase has no data or RLS prevents reading, preserve existing localUsers
      return localUsers;
    }

    const dbUsersMapped = data.map(u => {
      let role: "ADMIN" | "ALMOXARIFE" | "SUPERVISOR" = "ALMOXARIFE";
      let group: "A" | "B" = "A";
      let cargo = "";
      let password = "";
      let almoxarifados: string[] = [];

      let parsed: any = null;
      if (u.perfil) {
        if (typeof u.perfil === "object") {
          parsed = u.perfil;
        } else if (typeof u.perfil === "string") {
          const trimmed = u.perfil.trim();
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
              parsed = JSON.parse(trimmed);
            } catch (e) {
              console.warn("Error parsing perfil string as JSON:", e);
            }
          }
        }
      }

      if (parsed && typeof parsed === "object") {
        role = (parsed.role || "ALMOXARIFE").toUpperCase() as any;
        group = parsed.group || "A";
        cargo = parsed.cargo || "";
        password = parsed.password || "";
        almoxarifados = parsed.almoxarifados || [];
      } else {
        // Legacy simple role string
        const roleStr = String(u.perfil || "ALMOXARIFE").toUpperCase();
        role = (roleStr === "AUDITOR" ? "ADMIN" : roleStr) as any;
        
        const matchedOfficial = OFFICIAL_CREDENTIALS.find(o => o.email.toLowerCase().trim() === u.email.toLowerCase().trim());
        if (matchedOfficial) {
          group = matchedOfficial.group;
          cargo = matchedOfficial.cargo || "";
          password = matchedOfficial.password || "";
          almoxarifados = (matchedOfficial as any).almoxarifados || [];
        } else {
          if (role === "ADMIN") {
            cargo = "Auditor Geral";
          } else if (role === "SUPERVISOR") {
            cargo = "Supervisor de Manutenção";
          } else {
            cargo = "Almoxarife";
          }
        }
      }

      return {
        id: u.id,
        name: u.nome,
        email: u.email,
        role,
        ownerName: u.almoxarifado || u.nome.split(" ")[0],
        group,
        status: u.ativo ? "ATIVO" : "SUSPENSO",
        cargo,
        password,
        almoxarifados
      };
    });

    // Merge database users with local users, letting database take precedence 
    // but preserving any local-only custom entries or passwords
    let merged = [...dbUsersMapped];
    for (const lu of localUsers) {
      const idx = merged.findIndex(mu => mu.email.toLowerCase().trim() === lu.email.toLowerCase().trim());
      if (idx === -1) {
        merged.push(lu);
      } else {
        // If the database user row exists but has no password or empty password,
        // and our local storage has the password, use/keep the local storage password to avoid breaking login!
        if (!merged[idx].password && lu.password) {
          merged[idx].password = lu.password;
        }
        if (merged[idx].id) {
          lu.id = merged[idx].id;
        }
      }
    }

    // Filter out any user from merged that has been explicitly deleted locally
    try {
      const deletedListSaved = localStorage.getItem(`${STORAGE_PREFIX}deleted_user_emails`);
      if (deletedListSaved) {
        const deletedList: string[] = JSON.parse(deletedListSaved);
        if (deletedList.length > 0) {
          merged = merged.filter(u => !deletedList.includes(u.email.toLowerCase().trim()));
        }
      }
    } catch (err) {
      console.warn("Could not apply deleted emails filter:", err);
    }

    // Keep state synced in localStorage
    localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.error("Critical error in dbFetchUsers:", err);
    return localUsers;
  }
};

export const dbSaveUser = async (user: AppUser) => {
  // Always update local storage first to guarantee immediate success
  const saved = localStorage.getItem(`${STORAGE_PREFIX}users`);
  const users: AppUser[] = saved ? JSON.parse(saved) : [...OFFICIAL_CREDENTIALS];
  
  const index = users.findIndex(u => u.email.toLowerCase().trim() === user.email.toLowerCase().trim());
  if (index !== -1) {
    users[index] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(users));

  // Remove from explicitly deleted registry since the user is recreated/updated
  try {
    const deletedListSaved = localStorage.getItem(`${STORAGE_PREFIX}deleted_user_emails`);
    if (deletedListSaved) {
      const deletedList: string[] = JSON.parse(deletedListSaved);
      const filtered = deletedList.filter(e => e !== user.email.toLowerCase().trim());
      localStorage.setItem(`${STORAGE_PREFIX}deleted_user_emails`, JSON.stringify(filtered));
    }
  } catch (err) {}

  // If Supabase is ready, attempt to save to the database in background/safe mode
  if (isSupabaseReady()) {
    try {
      realtimeFlags.isLocalUpdate = true;
      const perfilData = {
        role: user.role,
        group: user.group || "A",
        cargo: user.cargo || "",
        password: user.password || "",
        almoxarifados: user.almoxarifados || []
      };

      const { error } = await supabase.from('usuarios').upsert({
        nome: user.name,
        email: user.email.toLowerCase().trim(),
        perfil: JSON.stringify(perfilData),
        almoxarifado: user.ownerName,
        ativo: user.status !== "SUSPENSO"
      }, { onConflict: 'email' });

      if (error) {
        console.warn("Supabase user persist failed (already saved in Local Storage):", error);
      }
    } catch (err) {
      console.warn("Critical exception saving user to Supabase:", err);
    } finally {
      realtimeFlags.isLocalUpdate = false;
    }
  }
};

// ======================= CYCLES (ciclos) =======================
export interface CycleState {
  activeMonth: string;
  activeYear: string;
  status: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM";
  openedAt?: string;
  openedBy?: string;
}

export const dbFetchCycleState = async (): Promise<CycleState> => {
  const defaultState: CycleState = { activeMonth: "Janeiro", activeYear: "2026", status: "ABERTO", openedAt: "01/01/2026", openedBy: "Fernando Silva" };
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem("acandido_cycle_state_manual");
    return saved ? JSON.parse(saved) : defaultState;
  }

  // Seeks specifically for a cycle with status 'aberto' (open) first
  let { data, error } = await supabase.from('ciclos').select('*').eq('status', 'aberto').limit(1);

  if (error || !data || data.length === 0) {
    // Fallback search for a cycle with status 'bloqueado'
    const resBloq = await supabase.from('ciclos').select('*').eq('status', 'bloqueado').limit(1);
    if (!resBloq.error && resBloq.data && resBloq.data.length > 0) {
      data = resBloq.data;
    } else {
      // Final fallback to the latest initiated cycle
      const resLatest = await supabase.from('ciclos').select('*').order('iniciado_em', { ascending: false }).limit(1);
      if (!resLatest.error && resLatest.data && resLatest.data.length > 0) {
        data = resLatest.data;
      }
    }
  }

  if (!data || data.length === 0) {
    return defaultState;
  }

  const current = data[0];
  let statusStr: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM" = "ABERTO";
  if (current.status === 'bloqueado') statusStr = "AGUARDANDO_FECHAMENTO";
  else if (current.status === 'fechado') statusStr = "FECHADO";

  return {
    activeMonth: monthNumToName(current.mes),
    activeYear: String(current.ano),
    status: statusStr,
    openedAt: current.iniciado_em,
    openedBy: current.iniciado_por
  };
};

export const dbSaveCycleState = async (cycle: CycleState) => {
  // Sync to localstorage too
  localStorage.setItem("acandido_cycle_state_manual", JSON.stringify(cycle));

  if (!isSupabaseReady()) {
    return;
  }

  const statusDb = cycle.status === "ABERTO" ? "aberto" : cycle.status === "AGUARDANDO_FECHAMENTO" ? "bloqueado" : "fechado";

  try {
    realtimeFlags.isLocalUpdate = true;
    await supabase.from('ciclos').upsert({
      mes: monthNameToNum(cycle.activeMonth),
      ano: Number(cycle.activeYear),
      status: statusDb,
      iniciado_por: cycle.openedBy || "Fernando Silva",
      fechado_em: cycle.status === "NENHUM" || cycle.status === "FECHADO" ? new Date().toISOString() : null
    }, { onConflict: 'mes,ano' });
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbFetchAllCycles = async (): Promise<CycleState[]> => {
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem("acandido_all_cycles_list");
    return saved ? JSON.parse(saved) : [];
  }
  const { data, error } = await supabase.from('ciclos').select('*');
  if (error || !data) return [];
  return data.map(item => {
    let statusStr: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM" = "ABERTO";
    if (item.status === 'bloqueado') statusStr = "AGUARDANDO_FECHAMENTO";
    else if (item.status === 'fechado') statusStr = "FECHADO";
    return {
      activeMonth: monthNumToName(item.mes),
      activeYear: String(item.ano),
      status: statusStr,
      openedAt: item.iniciado_em,
      openedBy: item.iniciado_por
    };
  });
};

// ======================= CRITERIA EVALUATIONS (avaliacoes) =======================
export const dbFetchEvaluations = async (almoxarifado: string, mesName: string, anoStr: string): Promise<Record<string, Partial<CriterionState>>> => {
  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);

  if (!isSupabaseReady()) {
    return {};
  }

  const { data, error } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('almoxarifado', almoxarifado)
    .eq('mes', mes)
    .eq('ano', ano);

  if (error || !data) {
    return {};
  }

  const mapped: Record<string, Partial<CriterionState>> = {};
  data.forEach(row => {
    mapped[row.criterio_codigo] = {
      status: row.resultado as EvaluationStatus,
      pointsObtained: row.pontuacao ?? 0,
      notes: row.descricao_evidencia,
      evidenceNotes: row.descricao_evidencia,
      nokEvidenceLinks: row.links_evidencia || []
    };
  });
  return mapped;
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

  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);

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

  try {
    realtimeFlags.isLocalUpdate = true;
    await supabase.from('avaliacoes').upsert({
      almoxarifado,
      mes,
      ano,
      criterio_codigo: criterionId,
      criterio_nome: criterionName,
      resultado: evaluation.status || "PENDENTE",
      pontuacao: evaluation.pointsObtained ?? 0,
      avaliado_por: evaluatedBy,
      avaliado_em: new Date().toISOString(),
      descricao_evidencia: evaluation.notes || evaluation.evidenceNotes || "",
      links_evidencia: finalLinks
    }, { onConflict: 'almoxarifado,mes,ano,criterio_codigo' });
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= EVIDENCE SUBMISSIONS (envios_almoxarife) =======================
export const dbFetchAlmoxarifeSubmissions = async (almoxarifado: string, mesName: string, anoStr: string) => {
  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);

  if (!isSupabaseReady()) {
    return [];
  }

  const { data, error } = await supabase
    .from('envios_almoxarife')
    .select('*')
    .eq('almoxarifado', almoxarifado)
    .eq('mes', mes)
    .eq('ano', ano);

  return error ? [] : data;
};

export const dbSubmitAlmoxarifeEvidence = async (
  almoxarifado: string,
  mesName: string,
  anoStr: string,
  criterionId: string,
  submittedBy: string,
  comment: string,
  storageUrls: string[]
) => {
  if (!isSupabaseReady()) {
    return;
  }

  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);

  try {
    realtimeFlags.isLocalUpdate = true;
    await supabase.from('envios_almoxarife').insert({
      almoxarifado,
      mes,
      ano,
      criterio_codigo: criterionId,
      enviado_por: submittedBy,
      comentario: comment,
      storage_paths: storageUrls
    });
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= CALENDAR SCHEDULES (calendario_inventarios) =======================
export const dbFetchSchedules = async (): Promise<any[]> => {
  if (!isSupabaseReady()) {
    return [];
  }

  const { data, error } = await supabase.from('calendario_inventarios').select('*');
  if (error || !data) {
    console.error("Failed to fetch calendar schedules from Supabase:", error);
    return [];
  }

  return data.map(item => {
    const bId = item.almoxarifado_id || item.branchId || "";
    let idx = 1;
    if (item.indice !== undefined) {
      idx = Number(item.indice);
    } else if (item.sequencia) {
      const match = item.sequencia.match(/\d+/);
      if (match) idx = parseInt(match[0]) || 1;
    }

    return {
      id: item.id || `cal-${bId}-${item.ano}-${item.semestre}-${idx}`,
      branchId: bId,
      almoxarifado_id: bId,
      almoxarifado: item.almoxarifado || "",
      ano: Number(item.ano || 2026),
      semestre: Number(item.semestre || 1),
      indice: idx,
      sequencia: item.sequencia || `#${idx}`,
      data_agendada: item.data_agendada || "",
      status: item.status || "PENDENTE",
      nokEvidenceLink: item.nokEvidenceLink || "",
      created_by: item.created_by || "",
      created_at: item.created_at || ""
    };
  });
};

export const dbSaveSchedules = async (schedules: any[]) => {
  if (!isSupabaseReady()) {
    return;
  }

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of schedules) {
      const idx = item.indice || 1;
      const seq = item.sequencia || `#${idx}`;
      const record = {
        id: item.id || `cal-${item.branchId || item.almoxarifado_id}-${item.ano}-${item.semestre}-${idx}`,
        almoxarifado_id: item.branchId || item.almoxarifado_id || "",
        almoxarifado: item.almoxarifado || "",
        ano: Number(item.ano || 2026),
        semestre: Number(item.semestre || 1),
        sequencia: seq,
        indice: idx,
        data_agendada: item.data_agendada || item.data || "",
        status: item.status || "PENDENTE",
        nokEvidenceLink: item.nokEvidenceLink || "",
        created_by: item.created_by || ""
      };

      const { error } = await supabase.from('calendario_inventarios').upsert(record, { onConflict: 'id' });
      if (error) {
        console.error("Error upserting schedule in dbSaveSchedules:", error, "for record:", record);
      }
    }
  } catch (err) {
    console.error("Exception in dbSaveSchedules:", err);
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbSaveSingleSchedule = async (item: any, userEmailOrName?: string) => {
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    const idx = item.indice || 1;
    const seq = item.sequencia || `#${idx}`;
    const record = {
      id: item.id || `cal-${item.branchId || item.almoxarifado_id}-${item.ano}-${item.semestre}-${idx}`,
      almoxarifado_id: item.branchId || item.almoxarifado_id || "",
      almoxarifado: item.almoxarifado || "",
      ano: Number(item.ano || 2026),
      semestre: Number(item.semestre || 1),
      sequencia: seq,
      indice: idx,
      data_agendada: item.data_agendada || item.data || "",
      status: item.status || "PENDENTE",
      nokEvidenceLink: item.nokEvidenceLink || "",
      created_by: userEmailOrName || item.created_by || ""
    };

    const { error } = await supabase.from('calendario_inventarios').upsert(record, { onConflict: 'id' });
    if (error) {
      console.error("Error upserting single schedule:", error);
      throw error;
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbDeleteSchedule = async (id: string) => {
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    const { error } = await supabase.from('calendario_inventarios').delete().eq('id', id);
    if (error) {
      console.error("Error deleting schedule in DB:", error);
      throw error;
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= WARRANTIES (garantias) =======================
export const dbFetchWarranties = async (): Promise<WarrantyItem[]> => {
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem("acandido_warranties");
    return saved ? JSON.parse(saved) : [];
  }

  const { data, error } = await supabase.from('garantias').select('*').order('registrado_em', { ascending: false });
  if (error || !data) {
    const saved = localStorage.getItem("acandido_warranties");
    return saved ? JSON.parse(saved) : [];
  }

  return data.map(item => ({
    id: item.id,
    itemCode: item.item,
    itemDescription: item.item, // fallback
    manufacturer: item.fabricante || "",
    expiryDate: item.garantia_ate || "",
    almoxarifado: item.almoxarifado,
    nfEmissionDate: "",
    reference: "",
    lastUpdateDate: item.registrado_em,
    pieceObservation: "",
    scrapObservation: "",
    monthYear: `${monthNumToName(item.mes)} ${item.ano}`
  }));
};

export const dbSaveWarranties = async (warranties: WarrantyItem[]) => {
  localStorage.setItem("acandido_warranties", JSON.stringify(warranties));

  if (!isSupabaseReady()) {
    return;
  }

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of warranties) {
      const spaceParts = item.monthYear ? item.monthYear.split(' ') : [];
      const mesStr = spaceParts[0] || "Maio";
      const anoNum = Number(spaceParts[1] || "2026");

      await supabase.from('garantias').upsert({
        id: item.id.includes('tmp') || item.id.length < 5 ? undefined : item.id,
        almoxarifado: item.almoxarifado,
        mes: monthNameToNum(mesStr),
        ano: anoNum,
        item: item.itemCode,
        fabricante: item.manufacturer,
        garantia_ate: item.expiryDate || null,
        registrado_por: "Almoxarife",
        registrado_em: item.createdAt || new Date().toISOString()
      });
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= LEVEL OF SERVICE OCCURRENCES (nivel_servico) =======================
export const dbFetchOccurrences = async (): Promise<MaterialOccurrence[]> => {
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem("acandido_occurrences");
    return saved ? JSON.parse(saved) : [];
  }

  const { data, error } = await supabase.from('nivel_servico').select('*');
  if (error || !data) {
    const saved = localStorage.getItem("acandido_occurrences");
    return saved ? JSON.parse(saved) : [];
  }

  return data.map(o => ({
    id: o.id,
    material: o.material_em_falta,
    date: o.data_ocorrencia || "",
    status: "Sem Estoque Mín/Máx", // initial status
    branchId: o.almoxarifado,
    branchName: o.almoxarifado,
    veiculo: o.veiculo || "",
    solicitante: o.solicitante || "",
    codigoMaterial: o.codigo_material || "",
    filial: o.almoxarifado
  }));
};

export const dbSaveOccurrences = async (occs: MaterialOccurrence[]) => {
  localStorage.setItem("acandido_occurrences", JSON.stringify(occs));
  if (!isSupabaseReady()) {
    return;
  }

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of occs) {
      const rawDate = item.date || new Date().toISOString().split('T')[0];
      await supabase.from('nivel_servico').upsert({
        id: item.id.includes('tmp') || item.id.length < 5 ? undefined : item.id,
        almoxarifado: item.branchName || item.filial || "",
        mes: Number(rawDate.split('-')[1]) || 5,
        ano: Number(rawDate.split('-')[0]) || 2026,
        veiculo: item.veiculo,
        codigo_material: item.codigoMaterial,
        material_em_falta: item.material,
        data_ocorrencia: rawDate,
        solicitante: item.solicitante
      });
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= NON-MOVING MATERIALS (material_sem_movimentacao) =======================
export const dbFetchNonMovingMaterials = async (almoxarifado: string, ano: number, semestre: number): Promise<any> => {
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem(`acandido_materials_parados_${almoxarifado}`);
    return saved ? JSON.parse(saved) : null;
  }

  const { data, error } = await supabase
    .from('material_sem_movimentacao')
    .select('*')
    .eq('almoxarifado', almoxarifado)
    .eq('ano', ano)
    .eq('semestre', semestre);

  if (error || !data || data.length === 0) {
    return null;
  }

  const item = data[0];
  return {
    id: item.id,
    almoxarifado: item.almoxarifado,
    ano: item.ano,
    semestre: item.semestre,
    timestamp: item.lista_inserida_em,
    insertedBy: item.lista_inserida_por,
    materials: item.itens || [],
    isEvaluated: !!item.resultado,
    resultStatus: item.resultado as EvaluationStatus,
    reviewedBy: item.avaliado_por,
    reviewedAt: item.avaliado_em,
    nokEvidenceLinks: item.links_evidencia || []
  };
};

export const dbSaveNonMovingMaterials = async (almoxarifado: string, ano: number, semestre: number, payload: any) => {
  // Sync to localstorage
  localStorage.setItem(`acandido_materials_parados_${almoxarifado}`, JSON.stringify(payload));

  if (!isSupabaseReady()) {
    return;
  }

  try {
    realtimeFlags.isLocalUpdate = true;
    await supabase.from('material_sem_movimentacao').upsert({
      almoxarifado,
      ano,
      semestre,
      lista_inserida_em: payload.timestamp || new Date().toISOString(),
      lista_inserida_por: payload.insertedBy || "Almoxarife",
      itens: payload.materials || payload.itemsToCount || [],
      resultado: payload.resultStatus || null,
      avaliado_em: payload.reviewedAt || null,
      avaliado_por: payload.reviewedBy || null,
      links_evidencia: payload.nokEvidenceLinks || []
    }, { onConflict: 'almoxarifado,ano,semestre' });
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= TOP 10 CONFIG (top10_configuracao) =======================
export const dbFetchTop10Config = async (almoxarifado: string, mesName: string, anoStr: string) => {
  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);
  const lsKey = `acandido_top10_config_${almoxarifado}_${mesName}_${anoStr}`;

  if (!isSupabaseReady()) {
    const saved = localStorage.getItem(lsKey);
    return saved ? JSON.parse(saved) : null;
  }

  const { data, error } = await supabase
    .from('top10_configuracao')
    .select('*')
    .eq('almoxarifado', almoxarifado)
    .eq('mes', mes)
    .eq('ano', ano);

  if (error || !data || data.length === 0) {
    // try to read fallback
    const saved = localStorage.getItem(lsKey);
    return saved ? JSON.parse(saved) : null;
  }

  return {
    itens: data[0].itens,
    configurado_por: data[0].configurado_por,
    configurado_em: data[0].configurado_em
  };
};

export const dbSaveTop10Config = async (almoxarifado: string, mesName: string, anoStr: string, itens: any[], user: string) => {
  const lsKey = `acandido_top10_config_${almoxarifado}_${mesName}_${anoStr}`;
  localStorage.setItem(lsKey, JSON.stringify({ itens }));

  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);

  if (!isSupabaseReady()) {
    return;
  }

  await supabase.from('top10_configuracao').upsert({
    almoxarifado,
    mes,
    ano,
    itens,
    configurado_por: user,
    configurado_em: new Date().toISOString()
  }, { onConflict: 'almoxarifado,mes,ano' });
};

// ======================= TOP 10 ENVIOS (top10_envios) =======================
export const dbFetchTop10Envios = async (almoxarifado: string, mesName: string, anoStr: string) => {
  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);

  if (!isSupabaseReady()) {
    return null;
  }

  const { data, error } = await supabase
    .from('top10_envios')
    .select('*')
    .eq('almoxarifado', almoxarifado)
    .eq('mes', mes)
    .eq('ano', ano);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
};

export const dbSaveTop10Envio = async (almoxarifado: string, mesName: string, anoStr: string, fotos: any[], user: string) => {
  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);

  if (!isSupabaseReady()) {
    return;
  }

  await supabase.from('top10_envios').upsert({
    almoxarifado,
    mes,
    ano,
    enviado_por: user,
    fotos
  }, { onConflict: 'almoxarifado,mes,ano' });
};

// ======================= LAYOUT CONFIG (layout_configuracao) =======================
export const dbFetchLayoutConfig = async (almoxarifado: string, mesName: string, anoStr: string) => {
  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);
  const lsKey = `acandido_layout_config_${almoxarifado}_${mesName}_${anoStr}`;

  if (!isSupabaseReady()) {
    const saved = localStorage.getItem(lsKey);
    return saved ? JSON.parse(saved) : null;
  }

  const { data, error } = await supabase
    .from('layout_configuracao')
    .select('*')
    .eq('almoxarifado', almoxarifado)
    .eq('mes', mes)
    .eq('ano', ano);

  if (error || !data || data.length === 0) {
    const saved = localStorage.getItem(lsKey);
    return saved ? JSON.parse(saved) : null;
  }

  return {
    localizacao: data[0].localizacao,
    configurado_por: data[0].configurado_por,
    configurado_em: data[0].configurado_em
  };
};

export const dbSaveLayoutConfig = async (almoxarifado: string, mesName: string, anoStr: string, localizacao: string, user: string) => {
  const lsKey = `acandido_layout_config_${almoxarifado}_${mesName}_${anoStr}`;
  localStorage.setItem(lsKey, JSON.stringify({ localizacao }));

  const mes = monthNameToNum(mesName);
  const ano = Number(anoStr);

  if (!isSupabaseReady()) {
    return;
  }

  await supabase.from('layout_configuracao').upsert({
    almoxarifado,
    mes,
    ano,
    localizacao,
    configurado_por: user,
    configurado_em: new Date().toISOString()
  }, { onConflict: 'almoxarifado,mes,ano' });
};

// ======================= UNIMOBIN EMPLOYEES (colaboradores_unimobin) =======================
export const dbFetchColaboradoresUnimobin = async () => {
  if (!isSupabaseReady()) {
    const saved = localStorage.getItem("acandido_all_collab_profiles");
    return saved ? JSON.parse(saved) : [];
  }

  const { data, error } = await supabase.from('colaboradores_unimobin').select('*').eq('ativo', true);
  if (error || !data) {
    const saved = localStorage.getItem("acandido_all_collab_profiles");
    return saved ? JSON.parse(saved) : [];
  }

  return data.map(row => ({
    id: row.id,
    name: row.nome,
    status: "Aguardando envio" as const, // default status mapping
    cargo: row.cargo || "Motorista/Colaborador"
  }));
};

export const dbSaveColaboradorUnimobin = async (name: string, cargo: string) => {
  if (!isSupabaseReady()) {
    return;
  }

  await supabase.from('colaboradores_unimobin').insert({
    nome: name,
    cargo: cargo,
    ativo: true
  });
};

export const dbDeleteUser = async (email: string, id?: any) => {
  // Always remove from local storage first to guarantee immediate success
  const saved = localStorage.getItem(`${STORAGE_PREFIX}users`);
  if (saved) {
    try {
      const users: AppUser[] = JSON.parse(saved);
      const filtered = users.filter(u => u.email.toLowerCase().trim() !== email.toLowerCase().trim());
      localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(filtered));
    } catch (e) {
      console.error("Error updating local storage during deletion:", e);
    }
  }

  // Record that we deleted this user to prevent them from being restored during database merges
  try {
    const deletedListSaved = localStorage.getItem(`${STORAGE_PREFIX}deleted_user_emails`);
    const deletedList: string[] = deletedListSaved ? JSON.parse(deletedListSaved) : [];
    const normalizedEmail = email.toLowerCase().trim();
    if (!deletedList.includes(normalizedEmail)) {
      deletedList.push(normalizedEmail);
      localStorage.setItem(`${STORAGE_PREFIX}deleted_user_emails`, JSON.stringify(deletedList));
    }
  } catch (err) {
    console.warn("Could not save to deleted list:", err);
  }

  // Attempt to delete from Supabase if ready
  if (isSupabaseReady()) {
    try {
      realtimeFlags.isLocalUpdate = true;
      let query = supabase.from('usuarios').delete();
      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.eq('email', email.toLowerCase().trim());
      }
      const { error } = await query;
      if (error) {
        console.warn("Supabase user deletion failed (already deleted from Local Storage):", error);
      }
    } catch (err) {
      console.warn("Critical error deleting user from Supabase:", err);
    } finally {
      realtimeFlags.isLocalUpdate = false;
    }
  }
};
