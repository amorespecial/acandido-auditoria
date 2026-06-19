// ======================= CALENDAR SCHEDULES (calendario_inventarios) =======================
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

export const dbFetchSchedules = async (): Promise<any[]> => {
  if (!isSupabaseReady()) {
    return [];
  }

  const { data, error } = await supabase.from('calendario_inventarios').select('*').order('indice', { ascending: true });
  if (error || !data) {
    console.error("Failed to fetch calendar schedules from Supabase:", error);
    return [];
  }

  console.log(`[dbFetchSchedules] READ ALL SUCCESS - count: ${data.length}`);

  return data.map(item => {
    const bId = item.almoxarifado || item.almoxarifado_id || item.branchId || "";
    let idx = 1;
    if (item.indice !== undefined) {
      idx = Number(item.indice);
    }
    return {
      id: item.id || `cal-${bId}-${item.ano}-${item.semestre}-${idx}`,
      branchId: bId,
      almoxarifado_id: bId,
      almoxarifado: bId,
      ano: Number(item.ano || 2026),
      semestre: Number(item.semestre || 1),
      indice: idx,
      sequencia: item.sequencia || `#${idx}`,
      data_agendada: item.data_agendada || "",
      status: item.status || "PENDENTE",
      nokEvidenceLink: item.nokEvidenceLink || ""
    };
  });
};

export const dbSaveSchedules = async (schedules: any[], forceYear?: number) => {
  if (!isSupabaseReady()) {
    throw new Error("Supabase não está configurada ou pronta.");
  }

  try {
    realtimeFlags.isLocalUpdate = true;
    console.log("Starting dbSaveSchedules. Total items received:", schedules.length, "forceYear:", forceYear);

    // 1. Determine unique combinations of (almoxarifado, semestre, ano) to delete and insert
    const groups = new Map<string, { almoxarifado: string; semestre: number; ano: number; items: any[] }>();

    if (forceYear) {
      const branchIds = Array.from(new Set(schedules.map(s => s.branchId || s.almoxarifado || s.almoxarifado_id).filter(Boolean)));
      for (const bId of branchIds) {
        for (const sem of [1, 2]) {
          const key = `${bId}_${sem}_${forceYear}`;
          groups.set(key, { almoxarifado: bId, semestre: sem, ano: forceYear, items: [] });
        }
      }
    }

    for (const item of schedules) {
      const almoxId = item.branchId || item.almoxarifado || item.almoxarifado_id;
      if (!almoxId) continue;
      const sem = Number(item.semestre || 1);
      const year = Number(item.ano || 2026);

      if (forceYear && year !== forceYear) {
        continue;
      }

      const key = `${almoxId}_${sem}_${year}`;
      if (!groups.has(key)) {
        groups.set(key, { almoxarifado: almoxId, semestre: sem, ano: year, items: [] });
      }

      if (item.data_agendada && item.data_agendada.trim() !== "") {
        groups.get(key)!.items.push(item);
      }
    }

    // 2. Perform DELETE + INSERT for each group
    for (const [key, group] of groups.entries()) {
      console.log(`[dbSaveSchedules] Deleting existing records for - Almox/Slug: ${group.almoxarifado}, Semestre: ${group.semestre}, Ano: ${group.ano}`);
      
      const { error: deleteError } = await supabase
        .from('calendario_inventarios')
        .delete()
        .eq('almoxarifado', group.almoxarifado)
        .eq('semestre', group.semestre)
        .eq('ano', group.ano);

      if (deleteError) {
        console.error("Delete error in dbSaveSchedules:", deleteError);
        throw new Error(`Falha ao limpar agendamentos antigos para ${group.almoxarifado}: ${deleteError.message}`);
      }

      if (group.items.length > 0) {
        const recordsToInsert = group.items.map((item, idx) => {
          const idxVal = item.indice || (idx + 1);
          const seqVal = item.sequencia || `#${idxVal}`;
          
          const isUuid = item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);
          const useId = isUuid ? item.id : generateUUID();
          
          console.log(`[dbSaveSchedules] PREPARING INSERT - ID: ${useId}, almoxarifado: ${group.almoxarifado}, DATA: ${item.data_agendada}`);

          return {
            id: useId,
            almoxarifado: group.almoxarifado,
            ano: Number(group.ano),
            semestre: Number(group.semestre),
            sequencia: seqVal,
            indice: Number(idxVal),
            data_agendada: item.data_agendada,
            status: item.status || "PENDENTE",
            nokEvidenceLink: item.nokEvidenceLink || ""
          };
        });

        const { error: insertError } = await supabase
          .from('calendario_inventarios')
          .insert(recordsToInsert);

        if (insertError) {
          console.error("Insert error in dbSaveSchedules:", insertError);
          throw new Error(`Falha ao inserir novos agendamentos para ${group.almoxarifado}: ${insertError.message}`);
        }

        // 3. CONFIRMATION SELECT
        const { data: confirmData, error: confirmError } = await supabase
          .from('calendario_inventarios')
          .select('*')
          .eq('almoxarifado', group.almoxarifado)
          .eq('semestre', group.semestre)
          .eq('ano', group.ano)
          .order('indice', { ascending: true });

        if (confirmError) {
          console.error("Confirmation query error in dbSaveSchedules:", confirmError);
          throw new Error(`Falha ao ler dados do Supabase para confirmação: ${confirmError.message}`);
        } else if (!confirmData || confirmData.length < recordsToInsert.length) {
          console.error("Confirmation inequality in dbSaveSchedules. Inserted:", recordsToInsert.length, "Found:", confirmData?.length);
          throw new Error(`Confirmação falhou para ${group.almoxarifado}: Dados salvos não correspondem ao esperado.`);
        } else {
          console.log(`[dbSaveSchedules] SUCCESS - Confirmed ${confirmData.length} records in DB for:`, group.almoxarifado, confirmData);
        }
      } else {
        console.log(`[dbSaveSchedules] Clear done (0 new schedules) for - Almox/Slug: ${group.almoxarifado}, Semestre: ${group.semestre}, Ano: ${group.ano}`);
      }
    }
  } catch (err) {
    console.error("Critical Exception in dbSaveSchedules:", err);
    throw err;
  } finally {
    realtimeFlags.isLocalUpdate = false;
  }
};

export const dbFetchBranchSchedules = async (branchId: string, options?: { ano?: number; semestre?: number }): Promise<any[]> => {
  if (!isSupabaseReady()) {
    return [];
  }

  try {
    let query = supabase.from('calendario_inventarios').select('*').eq('almoxarifado', branchId);
    if (options?.ano) {
      query = query.eq('ano', options.ano);
    }
    if (options?.semestre) {
      query = query.eq('semestre', options.semestre);
    }

    query = query.order('indice', { ascending: true });

    const { data, error } = await query;
    if (error) {
      console.error(`Error querying calendar from Supabase for branch ${branchId}:`, error);
      return [];
    }

    if (!data) return [];

    console.log(`[dbFetchBranchSchedules] READ SUCCESS - Almoxarifado: ${branchId}, count: ${data.length}`, data);

    return data.map(item => {
      const bId = item.almoxarifado || item.branchId || item.almoxarifado_id || "";
      let idx = 1;
      if (item.indice !== undefined) {
        idx = Number(item.indice);
      }
      return {
        id: item.id || `cal-${bId}-${item.ano}-${item.semestre}-${idx}`,
        branchId: bId,
        almoxarifado_id: bId,
        almoxarifado: bId,
        ano: Number(item.ano || 2026),
        semestre: Number(item.semestre || 1),
        indice: idx,
        sequencia: item.sequencia || `#${idx}`,
        data_agendada: item.data_agendada || "",
        status: item.status || "PENDENTE",
        nokEvidenceLink: item.nokEvidenceLink || ""
      };
    });
  } catch (e) {
    console.error("Exception in dbFetchBranchSchedules:", e);
    return [];
  }
};
