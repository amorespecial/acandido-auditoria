import { supabase, isSupabaseReady, realtimeFlags } from "./supabaseClient";
export { isSupabaseReady };
import { AppUser, Branch, CriterionState, WarrantyItem, MaterialOccurrence, EvaluationStatus, CollaboratorCertificate } from "./types";
import { OFFICIAL_CREDENTIALS } from "./components/Login";

const STORAGE_PREFIX = "acandido_";

// Month helper functions
export const monthNameToNum = (name: string): number => {
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const index = months.findIndex(m => m.toLowerCase() === name.toLowerCase());
  return index !== -1 ? index + 1 : 5; // default to 5 (Maio)
};

export const monthNumToName = (num: number): string => {
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return months[num - 1] || "Maio";
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
      const usersToInsert = OFFICIAL_CREDENTIALS.map(u => ({
        nome: u.name,
        email: u.email.toLowerCase().trim(),
        perfil: u.role === "ADMIN" ? "auditor" : u.role === "SUPERVISOR" ? "supervisor" : "almoxarife",
        almoxarifado: JSON.stringify({
          password: u.password,
          cargo: (u as any).cargo || "",
          group: u.group || "A",
          ownerName: u.ownerName || u.name.split(" ")[0],
          almoxarifados: (u as any).almoxarifados || []
        }),
        ativo: true
      }));
      await supabase.from('usuarios').upsert(usersToInsert, { onConflict: 'email' });
    }

    const { data: existingCal, error: calError } = await supabase.from('calendario_inventarios').select('id').limit(1);
    if (!calError && (!existingCal || existingCal.length === 0)) {
      console.log("Seeding 2026 inventory schedule table ('calendario_inventarios')...");
      const CALENDAR_ENTRIES_2026 = [
        { almoxarifado_id:"unitrans-jp", ano:2026, semestre:1, data_agendada:"2026-06-26", status: "PENDENTE" },
        { almoxarifado_id:"unitrans-jp", ano:2026, semestre:2, data_agendada:"2026-11-27", status: "PENDENTE" },
        { almoxarifado_id:"santa-maria-jp", ano:2026, semestre:1, data_agendada:"2026-06-26", status: "PENDENTE" },
        { almoxarifado_id:"santa-maria-jp", ano:2026, semestre:2, data_agendada:"2026-11-27", status: "PENDENTE" },
        { almoxarifado_id:"expresso-nacional", ano:2026, semestre:1, data_agendada:"2026-01-17", status: "PENDENTE" },
        { almoxarifado_id:"expresso-nacional", ano:2026, semestre:2, data_agendada:"2026-07-18", status: "PENDENTE" },
        { almoxarifado_id:"acandido-cg", ano:2026, semestre:1, data_agendada:"2026-01-17", status: "PENDENTE" },
        { almoxarifado_id:"acandido-cg", ano:2026, semestre:2, data_agendada:"2026-07-18", status: "PENDENTE" },
        { almoxarifado_id:"trans-cg-bayeux", ano:2026, semestre:1, data_agendada:"2026-02-10", status: "PENDENTE" },
        { almoxarifado_id:"trans-cg-bayeux", ano:2026, semestre:2, data_agendada:"2026-08-12", status: "PENDENTE" },
        { almoxarifado_id:"rodoviario-cabedelo", ano:2026, semestre:1, data_agendada:"2026-02-10", status: "PENDENTE" },
        { almoxarifado_id:"rodoviario-cabedelo", ano:2026, semestre:2, data_agendada:"2026-08-12", status: "PENDENTE" },
        { almoxarifado_id:"fretamento-maracanau", ano:2026, semestre:1, data_agendada:"2026-06-09", status: "PENDENTE" },
        { almoxarifado_id:"fretamento-maracanau", ano:2026, semestre:2, data_agendada:"2026-11-10", status: "PENDENTE" },
        { almoxarifado_id:"rodoviario-fortaleza", ano:2026, semestre:1, data_agendada:"2026-06-09", status: "PENDENTE" },
        { almoxarifado_id:"rodoviario-fortaleza", ano:2026, semestre:2, data_agendada:"2026-11-10", status: "PENDENTE" },
        { almoxarifado_id:"fretamento-goiana", ano:2026, semestre:1, data_agendada:"2026-05-16", status: "PENDENTE" },
        { almoxarifado_id:"fretamento-goiana", ano:2026, semestre:2, data_agendada:"2026-10-31", status: "PENDENTE" },
        { almoxarifado_id:"fretamento-pb", ano:2026, semestre:1, data_agendada:"2026-03-03", status: "PENDENTE" },
        { almoxarifado_id:"fretamento-pb", ano:2026, semestre:2, data_agendada:"2026-09-23", status: "PENDENTE" },
        { almoxarifado_id:"fretamento-jaboatao", ano:2026, semestre:1, data_agendada:"2026-04-24", status: "PENDENTE" },
        { almoxarifado_id:"fretamento-jaboatao", ano:2026, semestre:2, data_agendada:"2026-10-16", status: "PENDENTE" },
        { almoxarifado_id:"rodoviario-jaboatao", ano:2026, semestre:1, data_agendada:"2026-04-24", status: "PENDENTE" },
        { almoxarifado_id:"rodoviario-jaboatao", ano:2026, semestre:2, data_agendada:"2026-10-16", status: "PENDENTE" },
        { almoxarifado_id:"reunidas-nat", ano:2026, semestre:1, data_agendada:"2026-03-07", status: "PENDENTE" },
        { almoxarifado_id:"reunidas-nat", ano:2026, semestre:2, data_agendada:"2026-09-26", status: "PENDENTE" },
        { almoxarifado_id:"unissana-rn", ano:2026, semestre:1, data_agendada:"2026-03-06", status: "PENDENTE" },
        { almoxarifado_id:"unissana-rn", ano:2026, semestre:2, data_agendada:"2026-09-25", status: "PENDENTE" }
      ];
      await supabase.from('calendario_inventarios').upsert(CALENDAR_ENTRIES_2026, { onConflict: 'almoxarifado_id,ano,semestre' });
    }
  } catch (e) {
    console.error("Auto seeding exception:", e);
  }
};

// ======================= USERS (usuarios) =======================
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
    const password = extra.password || (official ? official.password : "123456");
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
      password: password,
      cargo: cargo
    };
  });
};

export const dbSaveUser = async (user: AppUser) => {
  if (!isSupabaseReady()) {
    return;
  }

  const perf = user.role === "ADMIN" ? "auditor" : user.role === "SUPERVISOR" ? "supervisor" : "almoxarife";
  
  // Package extra properties like password and warehouses securely to avoid db structure constraints
  const extraPayload = {
    password: user.password,
    cargo: (user as any).cargo || "",
    group: user.group || "A",
    ownerName: user.ownerName || user.name.split(" ")[0],
    almoxarifados: user.almoxarifados || []
  };

  await supabase.from('usuarios').upsert({
    id: user.id && user.id.length > 5 ? user.id : undefined,
    nome: user.name,
    email: user.email.toLowerCase().trim(),
    perfil: perf,
    almoxarifado: JSON.stringify(extraPayload),
    ativo: user.status !== "DESATIVADO"
  }, { onConflict: 'email' });
};

export const dbDeleteUser = async (email: string, id?: any) => {
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
  status: "ABERTO" | "AGUARDANDO_FECHAMENTO" | "FECHADO" | "NENHUM";
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

export async function dbAbrirCiclo(mes: string, ano: string, aberto_por: string) {
  const { data, error } = await supabase
    .from('ciclos')
    .upsert({ mes, ano, status: 'ABERTO', aberto_por, aberto_em: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function dbFecharCiclo(mes: string, ano: string) {
  const { error } = await supabase
    .from('ciclos')
    .update({ status: 'FECHADO', fechado_em: new Date().toISOString() })
    .eq('mes', mes).eq('ano', ano);
  if (error) throw error;
}

export const dbFetchCycleState = async (): Promise<CycleState> => {
  const defaultState: CycleState = { activeMonth: "Janeiro", activeYear: "2026", status: "ABERTO", openedAt: "01/01/2026", openedBy: "Fernando Silva" };
  if (!isSupabaseReady()) {
    return defaultState;
  }

  let { data, error } = await supabase.from('ciclos').select('*').eq('status', 'ABERTO').limit(1);

  if (error || !data || data.length === 0) {
    const resBloq = await supabase.from('ciclos').select('*').eq('status', 'AGUARDANDO_FECHAMENTO').limit(1);
    if (!resBloq.error && resBloq.data && resBloq.data.length > 0) {
      data = resBloq.data;
    } else {
      const resLatest = await supabase.from('ciclos').select('*').order('aberto_em', { ascending: false }).limit(1);
      if (!resLatest.error && resLatest.data && resLatest.data.length > 0) {
        data = resLatest.data;
      }
    }
  }

  if (!data || data.length === 0) {
    return defaultState;
  }

  const current = data[0];
  return {
    activeMonth: current.mes,
    activeYear: String(current.ano),
    status: current.status as any,
    openedAt: current.aberto_em,
    openedBy: current.aberto_por
  };
};

export const dbSaveCycleState = async (cycle: CycleState) => {
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    await supabase.from('ciclos').upsert({
      mes: cycle.activeMonth,
      ano: cycle.activeYear,
      status: cycle.status === "NENHUM" ? "ABERTO" : cycle.status,
      aberto_por: cycle.openedBy || "Fernando Silva",
      aberto_em: cycle.openedAt || new Date().toISOString(),
      fechado_em: cycle.status === "FECHADO" ? new Date().toISOString() : null
    }, { onConflict: 'mes,ano' });
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbFetchAllCycles = async (): Promise<CycleState[]> => {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase.from('ciclos').select('*');
  if (error || !data) return [];
  return data.map(item => ({
    activeMonth: item.mes,
    activeYear: String(item.ano),
    status: item.status as any,
    openedAt: item.aberto_em,
    openedBy: item.aberto_por
  }));
};

// ======================= CRITERIA EVALUATIONS (avaliacoes) =======================
export async function dbSalvarAvaliacao(avaliacao: {
  almoxarifado_id: string, mes: string, ano: string,
  criterio_id: string, criterio_nome: string, status: string,
  pontos_obtidos: number, pontos_possiveis: number,
  notes?: string, nok_link1?: string, nok_link2?: string,
  nok_link3?: string, nok_descricao?: string, avaliado_por?: string
}) {
  const { error } = await supabase
    .from('avaliacoes')
    .upsert({ ...avaliacao, avaliado_em: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'almoxarifado_id,mes,ano,criterio_id' });
  if (error) throw error;
}

export async function dbBuscarAvaliacoes(almoxarifado_id: string, mes: string, ano: string) {
  const { data, error } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('mes', mes)
    .eq('ano', ano);
  if (error) throw error;
  return data || [];
}

export async function dbBuscarTodasAvaliacoes(mes: string, ano: string) {
  const { data, error } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('mes', mes)
    .eq('ano', ano);
  if (error) throw error;
  return data || [];
}

export const dbFetchEvaluations = async (almoxarifado: string, mesName: string, anoStr: string): Promise<Record<string, Partial<CriterionState>>> => {
  if (!isSupabaseReady()) {
    return {};
  }

  const { data, error } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('almoxarifado_id', almoxarifado)
    .eq('mes', mesName)
    .eq('ano', anoStr);

  if (error || !data) {
    return {};
  }

  const mapped: Record<string, Partial<CriterionState>> = {};
  data.forEach(row => {
    const links = [row.nok_link1, row.nok_link2, row.nok_link3].filter(Boolean) as string[];
    mapped[row.criterio_id] = {
      status: row.status as EvaluationStatus,
      pointsObtained: row.pontos_obtidos ?? 0,
      pointsPossible: row.pontos_possiveis ?? 20,
      notes: row.notes || row.nok_descricao || "",
      evidenceNotes: row.nok_descricao || row.notes || "",
      nokEvidenceLinks: links,
      auditMode: row.audit_mode
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

  const maxPoints = evaluation.pointsPossible ?? 20;

  try {
    realtimeFlags.isLocalUpdate = true;
    await supabase.from('avaliacoes').upsert({
      almoxarifado_id: almoxarifado,
      mes: mesName,
      ano: anoStr,
      criterio_id: criterionId,
      criterio_nome: criterionName,
      status: evaluation.status || "PENDENTE",
      pontos_obtidos: evaluation.pointsObtained ?? 0,
      pontos_possiveis: maxPoints,
      audit_mode: evaluation.auditMode || "A_Distancia",
      notes: evaluation.notes || "",
      nok_descricao: evaluation.evidenceNotes || "",
      nok_link1: finalLinks[0] || null,
      nok_link2: finalLinks[1] || null,
      nok_link3: finalLinks[2] || null,
      avaliado_por: evaluatedBy,
      avaliado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'almoxarifado_id,mes,ano,criterio_id' });
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
  storageUrls: string[]
) => {
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    // Map submissions of TOP 10 (which is criterion 1) or keep it recorded
    if (criterionId === "1") {
      await supabase.from('top10_envios').upsert({
        almoxarifado_id: almoxarifado,
        mes: mesName,
        ano: anoStr,
        quantidades: [],
        fotos: storageUrls,
        enviado_por: submittedBy,
        enviado_em: new Date().toISOString()
      }, { onConflict: 'almoxarifado_id,mes,ano' });
    } else {
      // Save other criterion updates as and general evaluations if required
      await supabase.from('avaliacoes').upsert({
        almoxarifado_id: almoxarifado,
        mes: mesName,
        ano: anoStr,
        criterio_id: criterionId,
        criterio_nome: "Evidência Almoxarife",
        status: "ENVIADO",
        pontos_obtidos: 0,
        pontos_possiveis: 20,
        notes: comment,
        nok_link1: storageUrls[0] || null,
        nok_link2: storageUrls[1] || null,
        nok_link3: storageUrls[2] || null,
        avaliado_por: submittedBy,
        avaliado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'almoxarifado_id,mes,ano,criterio_id' });
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

  const { data, error } = await supabase.from('calendario_inventarios').select('*').order('updated_at', { ascending: true });
  if (error || !data) {
    return [];
  }

  return data.map(item => {
    const bId = item.almoxarifado_id || "";
    return {
      id: item.id || `cal-${bId}-${item.ano}-${item.semestre}`,
      branchId: bId,
      almoxarifado_id: bId,
      almoxarifado: bId,
      ano: Number(item.ano || 2026),
      semestre: Number(item.semestre || 1),
      data_agendada: item.data_agendada || "",
      status: item.status || "PENDENTE",
      nokEvidenceLink: item.nok_evidence_link || ""
    };
  });
};

export const dbSaveSchedules = async (schedules: any[], forceYear?: number) => {
  if (!isSupabaseReady()) return;

  try {
    realtimeFlags.isLocalUpdate = true;
    for (const item of schedules) {
      const bId = item.branchId || item.almoxarifado_id || item.almoxarifado || "";
      if (!bId) continue;
      const yr = forceYear || Number(item.ano || 2026);
      const sem = Number(item.semestre || 1);

      await supabase.from('calendario_inventarios').upsert({
        almoxarifado_id: bId,
        ano: yr,
        semestre: sem,
        data_agendada: item.data_agendada || null,
        status: item.status || "PENDENTE",
        nok_evidence_link: item.nokEvidenceLink || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'almoxarifado_id,ano,semestre' });
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbFetchBranchSchedules = async (branchId: string, options?: { ano?: number; semestre?: number }): Promise<any[]> => {
  if (!isSupabaseReady()) return [];

  let query = supabase.from('calendario_inventarios').select('*').eq('almoxarifado_id', branchId);
  if (options?.ano) query = query.eq('ano', options.ano);
  if (options?.semestre) query = query.eq('semestre', options.semestre);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(item => {
    const bId = item.almoxarifado_id || "";
    return {
      id: item.id || `cal-${bId}-${item.ano}-${item.semestre}`,
      branchId: bId,
      almoxarifado_id: bId,
      almoxarifado: bId,
      ano: Number(item.ano || 2026),
      semestre: Number(item.semestre || 1),
      data_agendada: item.data_agendada || "",
      status: item.status || "PENDENTE",
      nokEvidenceLink: item.nok_evidence_link || ""
    };
  });
};

export const dbSaveSingleSchedule = async (item: any, userEmailOrName?: string) => {
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    const bId = item.branchId || item.almoxarifado_id || item.almoxarifado || "";
    const record = {
      almoxarifado_id: bId,
      ano: Number(item.ano || 2026),
      semestre: Number(item.semestre || 1),
      data_agendada: item.data_agendada || item.data || null,
      status: item.status || "PENDENTE",
      nok_evidence_link: item.nokEvidenceLink || null,
      updated_at: new Date().toISOString()
    };
    await supabase.from('calendario_inventarios').upsert(record, { onConflict: 'almoxarifado_id,ano,semestre' });
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbDeleteSchedule = async (id: string) => {
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    await supabase.from('calendario_inventarios').delete().eq('id', id);
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

// ======================= WARRANTIES (garantias) =======================
export async function dbSalvarGarantia(garantia: any) {
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

export const dbSaveWarranties = async (warranties: WarrantyItem[]) => {
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
export async function dbSalvarNivelServico(registro: any) {
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

export const dbDeleteOccurrence = async (id: string): Promise<boolean> => {
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

export const dbSaveOccurrences = async (occs: MaterialOccurrence[]) => {
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
export async function dbSalvarMateriaisParados(almoxarifado_id: string, semestre: number, ano: number, materiais: any[]) {
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

export const dbSaveNonMovingMaterials = async (almoxarifado: string, ano: number, semestre: number, payload: any) => {
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
  const { data, error } = await supabase
    .from('materiais_parados')
    .select('almoxarifado_id, status')
    .eq('ano', ano)
    .eq('semestre', semestre);

  if (error) {
    console.error("Error in dbFetchAllNonMovingSummaries:", error);
    return [];
  }

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
}

// ======================= TOP 10 CONFIG =======================
export async function dbSalvarTop10Config(almoxarifado_id: string, mes: string, ano: string, itens: any[], configurado_por: string) {
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

export const dbSaveTop10Config = async (almoxarifado: string, mesName: string, anoStr: string, itens: any[], user: string) => {
  if (!isSupabaseReady()) return;
  await dbSalvarTop10Config(almoxarifado, mesName, anoStr, itens, user);
};

// ======================= TOP 10 ENVIOS =======================
export async function dbSalvarTop10Envio(almoxarifado_id: string, mes: string, ano: string, quantidades: any[], fotos: any[], enviado_por: string) {
  const { error } = await supabase
    .from('top10_envios')
    .upsert({ almoxarifado_id, mes, ano, quantidades, fotos, enviado_por, enviado_em: new Date().toISOString() },
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

export const dbSaveTop10Envio = async (almoxarifado: string, mesName: string, anoStr: string, fotos: any[], user: string) => {
  if (!isSupabaseReady()) return;
  await dbSalvarTop10Envio(almoxarifado, mesName, anoStr, [], fotos, user);
};

// ======================= LAYOUT CONFIG =======================
export async function dbSalvarLayoutConfig(almoxarifado_id: string, mes: string, ano: string, localizacao: string, instrucoes: string) {
  const { error } = await supabase
    .from('layout_config')
    .upsert({ almoxarifado_id, mes, ano, localizacao, instrucoes, updated_at: new Date().toISOString() },
      { onConflict: 'almoxarifado_id,mes,ano' });
  if (error) throw error;
}

export async function dbBuscarLayoutConfig(almoxarifado_id: string, mes: string, ano: string) {
  const { data } = await supabase
    .from('layout_config')
    .select('*')
    .eq('almoxarifado_id', almoxarifado_id)
    .eq('mes', mes)
    .eq('ano', ano)
    .single();
  return data;
}

export const dbFetchLayoutConfig = async (almoxarifado: string, mesName: string, anoStr: string) => {
  if (!isSupabaseReady()) return null;
  const data = await dbBuscarLayoutConfig(almoxarifado, mesName, anoStr);
  if (!data) return null;
  return {
    localizacao: data.localizacao,
    instrucoes: data.instrucoes,
    configurado_por: data.configurado_por || "Almoxarife",
    configurado_em: data.updated_at
  };
};

export const dbSaveLayoutConfig = async (almoxarifado: string, mesName: string, anoStr: string, localizacao: string, user: string) => {
  if (!isSupabaseReady()) return;
  await dbSalvarLayoutConfig(almoxarifado, mesName, anoStr, localizacao, "");
};

// ======================= UNIMOBIN CERTIFICADOS =======================
export async function dbSalvarCertificado(almoxarifado_id: string, mes: string, ano: string, colaborador_nome: string, dados: any) {
  const { error } = await supabase
    .from('unimobin_certificados')
    .upsert({
      almoxarifado_id, mes, ano, colaborador_nome,
      status: dados.status || 'Aguardando envio',
      file_name: dados.fileName || dados.file_name || null,
      file_type: dados.fileType || dados.file_type || null,
      file_data: dados.fileData || dados.file_data || null,
      uploaded_at: dados.uploadedAt || dados.uploaded_at || new Date().toISOString()
    },
      { onConflict: 'almoxarifado_id,mes,ano,colaborador_nome' });
  if (error) throw error;
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

export const dbSaveColaboradorUnimobin = async (name: string, cargo: string) => {
  if (!isSupabaseReady()) return;
  // Just save a blank mock certificate
  await dbSalvarCertificado("default", "Janeiro", "2026", name, {
    status: "Aguardando envio"
  });
};

// ======================= HISTORICO AVALIACOES =======================
export async function dbSalvarHistorico(entry: any) {
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

export async function dbSaveHistory(historyList: any[]) {
  if (!isSupabaseReady()) return;
  try {
    realtimeFlags.isLocalUpdate = true;
    for (const entry of historyList) {
      await dbSalvarHistorico(entry);
    }
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
}

export async function dbFetchHistory(): Promise<any[]> {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabase
    .from('historico_avaliacoes')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Error standardizing history in dbFetchHistory:", error);
    return [];
  }
  
  return (data || []).map(entry => ({
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

