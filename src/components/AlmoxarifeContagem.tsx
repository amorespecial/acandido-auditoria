import React, { useState, useEffect } from "react";
import { CriterionState } from "../types";
import { dbFetchTop10Config, dbFetchTop10FieldConfig, isSupabaseReady, comprimirImagem, getPublicImageUrl } from "../supabaseService";
import { getOrderedFields, BUILTIN_TOP10_FIELDS, isFieldRequired } from "../utils/fieldOrdering";

interface AlmoxarifeContagemProps {
  onBack: () => void;
  onSubmitEvidence: (
    criterionId: string,
    comments: string,
    photos: string[],
    top10Quantities?: number[],
    onProgress?: (msg: string, percent: number) => void
  ) => Promise<any> | void;
  criterionState?: CriterionState;
  top10?: Array<{ code: string; name?: string; description?: string; localizacao?: string }>;
  branchId: string;
  activeMonth: string;
  activeYear: string;
}

// Preset mock photo URLs for easy testing/simulation by the reviewer
const top10PresetPhotos = [
  "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1553413719-8758737de7c6?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1532635241-17e820acf59f?auto=format&fit=crop&q=80&w=400"
];

export default function AlmoxarifeContagem({
  onBack,
  onSubmitEvidence,
  criterionState,
  top10,
  branchId,
  activeMonth,
  activeYear
}: AlmoxarifeContagemProps) {
  const [monthlyConfig, setMonthlyConfig] = useState<any>(null);

  // 1. Fetch monthly top 10 configurations from database on mount/change
  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      try {
        if (branchId && isSupabaseReady()) {
          const remoteConfig = await dbFetchTop10Config(
            branchId,
            activeMonth,
            activeYear
          );
          if (remoteConfig?.itens && active) {
            setMonthlyConfig(remoteConfig);
          }
        }
      } catch (error) {
        console.error("Error fetching remote Top 10 config in AlmoxarifeContagem:", error);
      }
    };
    loadConfig();
    return () => {
      active = false;
    };
  }, [branchId, activeMonth, activeYear]);

  const items = monthlyConfig?.itens || top10?.map((it: any) => ({
    code: it.code,
    description: it.description || it.name,
    localizacao: it.localizacao || it.location || "",
    qty: 1
  })) || [];
  const totalItemsCount = items.length;

  // 2. Local state for photos upload
  const [uploadedPhotos, setUploadedPhotos] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (criterionState?.submittedPhotos && items.length > 0) {
      items.forEach((item: any, idx: number) => {
        if (criterionState.submittedPhotos?.[idx]) {
          initial[item.code] = criterionState.submittedPhotos[idx];
        }
      });
    }
    return initial;
  });

  // State for quantities entered by the almoxarife
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (criterionState?.top10AlmoxarifeQuantities && items.length > 0) {
      items.forEach((item: any, idx: number) => {
        if (criterionState.top10AlmoxarifeQuantities?.[idx] !== undefined) {
          initial[item.code] = String(criterionState.top10AlmoxarifeQuantities[idx]);
        }
      });
    }
    return initial;
  });

  // Sync uploaded photos and quantities when items or state changes dynamically
  useEffect(() => {
    if (items.length > 0) {
      setUploadedPhotos((prev) => {
        const next = { ...prev };
        let updated = false;
        items.forEach((item: any, idx: number) => {
          if (!next[item.code] && criterionState?.submittedPhotos?.[idx]) {
            next[item.code] = criterionState.submittedPhotos[idx];
            updated = true;
          }
        });
        return updated ? next : prev;
      });

      setQuantities((prev) => {
        const next = { ...prev };
        let updated = false;
        items.forEach((item: any, idx: number) => {
          if (next[item.code] === undefined && criterionState?.top10AlmoxarifeQuantities?.[idx] !== undefined) {
            next[item.code] = String(criterionState.top10AlmoxarifeQuantities[idx]);
            updated = true;
          }
        });
        return updated ? next : prev;
      });
    }
  }, [items, criterionState]);

  const [top10Config, setTop10Config] = useState(() => {
    try {
      const saved = localStorage.getItem("acandido_top10_fields_config");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { quantidade: true, foto: true, customFields: [] as any[] };
  });

  const [customFormValues, setCustomFormValues] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    let active = true;
    const loadRemoteConfig = async () => {
      try {
        const remoteCfg = await dbFetchTop10FieldConfig();
        if (remoteCfg && typeof remoteCfg === "object" && active) {
          setTop10Config(remoteCfg);
        }
      } catch (e) {
        console.warn("Error fetching remote top10 field config:", e);
      }
    };

    loadRemoteConfig();

    const handleStorage = () => {
      loadRemoteConfig();
      try {
        const saved = localStorage.getItem("acandido_top10_fields_config");
        if (saved) setTop10Config(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("field-configs-updated", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("field-configs-updated", handleStorage);
    };
  }, []);

  const [commentsInput, setCommentsInput] = useState(() => {
    return criterionState?.evidenceNotes || "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");
  const [uploadProgressPct, setUploadProgressPct] = useState(0);
  const [activeImgLightbox, setActiveImgLightbox] = useState<string | null>(null);

  // Drag and drop states per item code
  const [isDragging, setIsDragging] = useState<Record<string, boolean>>({});

  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const filledPhotosCount = items.filter((it: any) => !!uploadedPhotos[it.code]).length;
  const isSubmitBtnAllowed = totalItemsCount > 0 && 
    items.every((it: any) => {
      const isPhotoReq = isFieldRequired({ id: "foto", name: "Anexar Foto de Evidência", builtIn: true }, top10Config);
      const photoOk = !isPhotoReq || !!uploadedPhotos[it.code];
      const isQtyReq = isFieldRequired({ id: "quantidade", name: "Quantidade Física Encontrada", builtIn: true }, top10Config);
      const qtyOk = !isQtyReq || (quantities[it.code] !== undefined && quantities[it.code].trim() !== "");
      let customOk = true;
      if (top10Config.customFields && top10Config.customFields.length > 0) {
        const itemVals = customFormValues[it.code] || {};
        const missingReq = top10Config.customFields.find((cf: any) => isFieldRequired(cf, top10Config) && !itemVals[cf.id]?.trim());
        if (missingReq) customOk = false;
      }
      return photoOk && qtyOk && customOk;
    });

  // Handle local File conversions with compression (Max 1280px width, image/webp 0.8)
  const processFile = async (itemCode: string, file: File) => {
    if (!file) return;
    try {
      const compressed = await comprimirImagem(file, 800, 1280, 0.8, "image/webp");
      if (compressed) {
        setUploadedPhotos((prev) => ({
          ...prev,
          [itemCode]: compressed
        }));
      }
    } catch (err) {
      console.error("Erro ao comprimir imagem de item:", err);
    }
  };

  const handleDragOver = (e: React.DragEvent, itemCode: string) => {
    e.preventDefault();
    setIsDragging(prev => ({ ...prev, [itemCode]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, itemCode: string) => {
    e.preventDefault();
    setIsDragging(prev => ({ ...prev, [itemCode]: false }));
  };

  const handleDrop = (e: React.DragEvent, itemCode: string) => {
    e.preventDefault();
    setIsDragging(prev => ({ ...prev, [itemCode]: false }));
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(itemCode, file);
    }
  };

  // Easily simulate a photo selection for standard testing
  const handleSimulatePhoto = (itemCode: string, idx: number) => {
    const nextPhoto = top10PresetPhotos[idx % top10PresetPhotos.length];
    setUploadedPhotos((prev) => ({
      ...prev,
      [itemCode]: nextPhoto
    }));
  };

  const handleRemovePhoto = (itemCode: string) => {
    setUploadedPhotos((prev) => {
      const copy = { ...prev };
      delete copy[itemCode];
      return copy;
    });
  };

  // Submit all photos back up to parent state
  const handleFormSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitBtnAllowed) {
      alert("Por favor, preencha todos os campos obrigatórios e anexe as fotos antes de enviar.");
      return;
    }
    setIsSubmitting(true);
    setUploadProgressMsg("Iniciando envio...");
    setUploadProgressPct(5);

    try {
      const finalComment = commentsInput.trim() || `Evidências fotográficas do TOP 10 concluídas para o ciclo de ${activeMonth} de ${activeYear}.`;
      // Map photos in the strict order of items
      const orderedPhotos = items.map((it: any) => uploadedPhotos[it.code] || "");
      const orderedQuantities = items.map((it: any) => Number(quantities[it.code]) || 0);

      await onSubmitEvidence(
        "2",
        finalComment,
        orderedPhotos,
        orderedQuantities,
        (msg: string, pct: number) => {
          setUploadProgressMsg(msg);
          setUploadProgressPct(pct);
        }
      );

      setIsSubmitting(false);
      onBack();
    } catch (err: any) {
      console.error("Erro ao transmitir TOP 10:", err);
      alert(`Erro na transmissão do TOP 10: ${err?.message || "Erro de conexão. Tente novamente."}`);
      setIsSubmitting(false);
    }
  };

  // 3. UI Decision Tree
  const isPresencial = criterionState?.auditMode === "Presencial";
  const isAguardandoConfiguracao = !isPresencial && totalItemsCount === 0;

  // View state (submitted/OK/NOK)
  const isAlreadyProcessed = criterionState?.status === "ENVIADO" || criterionState?.status === "OK" || criterionState?.status === "NOK";

  return (
    <div className="max-w-md mx-auto space-y-6 font-sans">
      {/* Header Panel */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-600 active:scale-95 transition-all shadow-sm"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl font-black text-[#1B2A4A] leading-tight font-sans">02 - TOP 10</h2>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">Lista Rotativa Mensal de Alta Relevância</p>
        </div>
      </div>

      {isPresencial ? (
        // Scenario PRESENCIAL
        <div className="bg-white rounded-xl border border-blue-100 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-blue-800 text-sm font-black uppercase tracking-wider">
            <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
            📋 Auditoria Presencial
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-semibold">
            Este critério de TOP 10 está configurado para o modo <strong className="text-blue-900 font-extrabold">Presencial</strong> neste ciclo.
          </p>
          <div className="bg-blue-50/50 p-4 border border-blue-100 rounded-lg text-[11px] text-blue-900 leading-normal font-medium">
            O auditor geral Fernando Silva fará a avaliação física presencialmente durante a visita programada na filial. Nenhuma ação online de envio de evidências por fotos é requerida.
          </div>
          <button
            onClick={onBack}
            className="w-full py-2.5 bg-blue-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition hover:bg-opacity-90 mt-2"
          >
            Voltar ao Painel
          </button>
        </div>
      ) : isAguardandoConfiguracao ? (
        // Scenario 1: Auditor has not configured Top 10 items list yet
        <div className="bg-white rounded-xl border border-slate-150 shadow-xs p-6 text-center space-y-5">
          <div className="flex justify-between items-center pb-2 border-b">
            <span className="text-xs font-black text-slate-450 text-slate-500 uppercase tracking-wider">📋 TOP 10</span>
            <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-150/50 px-2 py-0.5 rounded">20 pts</span>
          </div>

          <div className="py-8 space-y-3">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-100">
              <span className="material-symbols-outlined text-[26px]">hourglass_empty</span>
            </div>
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider">⏳ Lista ainda não disponível</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              O auditor geral está definindo os itens selecionados para este mês. A lista aparecerá assim que for salva no sistema.
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg text-[10.5px] text-slate-400 font-extrabold uppercase select-none border border-slate-100">
            Apenas visualização — avaliado pelo auditor
          </div>

          <button
            onClick={onBack}
            className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition hover:bg-slate-200"
          >
            Voltar ao Painel
          </button>
        </div>
      ) : isAlreadyProcessed ? (
        // Scenario 3: Submitted or Fully Evaluated View
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-150 shadow-xs p-5 space-y-4">
            <div className="flex justify-between items-center pb-1.5 border-b">
              <div>
                <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider">📋 TOP 10 — {activeMonth} {activeYear}</h3>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase font-bold text-slate-400">Enviado por {criterionState?.status === "ENVIADO" ? "Você" : "Almoxarifado"}</p>
              </div>
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-150/50 px-2 py-0.5 rounded">20 pts</span>
            </div>

            {/* Status alerts */}
            {criterionState?.status === "ENVIADO" && (
              <div className="bg-violet-50/50 p-3.5 border border-violet-100 rounded-lg space-y-1">
                <p className="text-violet-850 font-black text-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-violet-700 animate-pulse">check_circle</span>
                  ✅ Fotos enviadas em: {criterionState.submittedAt || "---"}
                </p>
                <p className="text-[10.5px] text-violet-600 leading-normal font-semibold">
                  Aguardando avaliação do auditor geral. As fotos estão trancadas para edição.
                </p>
              </div>
            )}

            {criterionState?.status === "OK" && (
              <div className="bg-emerald-50/50 p-3.5 border border-emerald-100 rounded-lg space-y-1">
                <p className="text-emerald-850 font-black text-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600">stars</span>
                  ✅ OK — 20 pts obtidos!
                </p>
                <p className="text-[10.5px] text-emerald-600 leading-normal font-semibold">
                  Avaliado por: Fernando Silva ({criterionState.submittedAt || "Ciclo Corrente"})
                </p>
              </div>
            )}

            {criterionState?.status === "NOK" && (
              <div className="bg-rose-50/50 p-3.5 border border-rose-150 rounded-lg space-y-1">
                <p className="text-rose-850 font-black text-xs flex items-center gap-1 text-red-700">
                  <span className="material-symbols-outlined text-[15px] text-rose-600">cancel</span>
                  ❌ NOK — 0 pts obtidos
                </p>
                <p className="text-[10.5px] text-rose-600 leading-normal font-semibold">
                  Avaliado por: Fernando Silva ({criterionState.submittedAt || "Ciclo Corrente"})
                </p>
                {criterionState.notes && (
                  <div className="mt-2 text-[10px] bg-white border border-rose-100 p-2 rounded text-rose-700 italic font-bold">
                    Justificativa: "{criterionState.notes}"
                  </div>
                )}
              </div>
            )}

            {/* Configured materials list */}
            <div className="space-y-3 font-sans">
              <h4 className="text-[10px] font-black text-slate-450 text-slate-400 uppercase tracking-widest">Itens Auditados</h4>
              <div className="divide-y divide-slate-100 border border-slate-100 bg-slate-50/30 rounded-xl overflow-hidden text-xs">
                {items.map((item: any, idx: number) => {
                  const pImg = criterionState?.submittedPhotos?.[idx];
                  return (
                    <div key={item.code} className="p-3.5 flex items-center justify-between gap-4 bg-white font-medium">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono font-bold text-slate-400">Nº {idx + 1} • CÓD. {item.code}</span>
                        <p className="font-extrabold text-[#1B2A4A] text-xs leading-snug">{item.description}</p>
                        {item.localizacao && (
                          <p className="text-[10.5px] text-slate-600 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-indigo-600">location_on</span>
                            <span>Localização: <strong className="text-slate-800 font-bold">{item.localizacao}</strong></span>
                          </p>
                        )}
                        <div className="space-y-0.5 text-[10px] block">
                          <p className="text-slate-605 text-slate-600 font-bold">
                            📦 Qtd Almoxarife: <strong className="text-[#1B2A4A] font-extrabold">{criterionState?.top10AlmoxarifeQuantities?.[idx] ?? 0} un</strong>
                          </p>
                          {(criterionState?.status === "OK" || criterionState?.status === "NOK") && criterionState?.top10AuditorQuantities?.[idx] !== undefined && (
                            <>
                              <p className="text-slate-605 text-slate-600 font-bold">
                                🖥️ Qtd Auditor (Transnet): <strong className="text-[#1B2A4A] font-extrabold">{criterionState.top10AuditorQuantities[idx]} un</strong>
                              </p>
                              {(() => {
                                const diff = (criterionState?.top10AlmoxarifeQuantities?.[idx] ?? 0) - criterionState.top10AuditorQuantities[idx];
                                return (
                                  <p className="font-black">
                                    Divergência:{" "}
                                    <span className={diff === 0 ? "text-emerald-600 font-extrabold" : "text-rose-600 font-extrabold"}>
                                      {diff === 0 ? "0 (Sem divergência - OK)" : `${diff} un (Divergente)`}
                                    </span>
                                  </p>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {(() => {
                          const resolvedPhoto = getPublicImageUrl(pImg);
                          if (!resolvedPhoto) {
                            return <span className="text-[10px] italic text-slate-400 font-bold">Sem imagem</span>;
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => setActiveImgLightbox(resolvedPhoto)}
                              className="w-14 h-14 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center hover:opacity-90 select-none transition"
                            >
                              <img
                                src={resolvedPhoto}
                                alt="Envio"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const btn = (e.target as HTMLElement).closest('button');
                                  if (btn) btn.style.display = 'none';
                                }}
                              />
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {criterionState?.evidenceNotes && (
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Anotações do Almoxarife:</span>
                <p className="text-xs text-slate-700 italic font-semibold">"{criterionState.evidenceNotes}"</p>
              </div>
            )}

            <button
              onClick={onBack}
              className="w-full py-2.5 bg-[#1B2A4A] text-white rounded-lg text-xs font-black uppercase tracking-wider tracking-widest transition hover:opacity-90"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      ) : (
        // Scenario 2: Form mode — Almoxarife must upload photos
        <form onSubmit={handleFormSubmission} className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-150 shadow-xs p-5 space-y-4">
            <div className="flex justify-between items-center pb-1 border-b">
              <div>
                <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider">📋 TOP 10 — {activeMonth} {activeYear}</h3>
                <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Envia as fotos de verificação exigidas</p>
              </div>
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-150/50 px-2 py-0.5 rounded">20 pts</span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-[11px] leading-relaxed text-[#1B2A4A] flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-amber-600 mt-0.5 shrink-0">info</span>
              <div>
                <p className="font-bold">Itens para fotografar este mês:</p>
                <p className="text-slate-600 font-medium">
                  Selecione uma foto correspondente e verifique se a quantidade física na garagem confere com a quantidade solicitada pelo auditor geral.
                </p>
              </div>
            </div>

            {/* List of items */}
            <div className="space-y-4">
              {items.map((item: any, idx: number) => {
                const photoData = uploadedPhotos[item.code];
                const activeDrag = isDragging[item.code];

                return (
                  <div
                    key={item.code}
                    onDragOver={(e) => handleDragOver(e, item.code)}
                    onDragLeave={(e) => handleDragLeave(e, item.code)}
                    onDrop={(e) => handleDrop(e, item.code)}
                    className={`border rounded-xl p-4 transition-all duration-200. ${
                      photoData
                        ? "bg-slate-50/50 border-emerald-300"
                        : activeDrag
                        ? "bg-blue-50/50 border-blue-400 border-dashed"
                        : "bg-white border-slate-150 shadow-2xs hover:border-slate-300"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <div>
                          <span className="text-[9.5px] font-black text-slate-400 font-mono uppercase tracking-wider block">
                            Nº {idx + 1} — CÓD. {item.code}
                          </span>
                          <h4 className="text-xs font-black text-[#1B2A4A] mt-0.5 leading-snug">
                            {item.description}
                          </h4>
                          {item.localizacao && (
                            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50/80 border border-indigo-100/80 text-indigo-900 text-[11px] font-medium">
                              <span className="material-symbols-outlined text-[13px] text-indigo-600">location_on</span>
                              <span>Localização: <strong className="font-bold text-indigo-950">{item.localizacao}</strong></span>
                            </div>
                          )}
                        </div>

                        {/* Dynamic Ordered Fields for Item */}
                        {getOrderedFields(top10Config, BUILTIN_TOP10_FIELDS).map((field) => {
                          if (field.id === "quantidade") {
                            if (top10Config.quantidade === false) return null;
                            const isQtyReq = isFieldRequired({ id: "quantidade", name: "Quantidade Física Encontrada", builtIn: true }, top10Config);
                            const val = quantities[item.code] || "";
                            const hasQtyErr = isQtyReq && !val.trim() && showFieldErrors;
                            return (
                              <div key="quantidade" className="space-y-1 mt-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                  Qtd Física no Estoque{isQtyReq && <span className="text-[#F11E26]"> *</span>}:
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Digite a quantidade encontrada"
                                  value={val}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setQuantities((prev) => ({
                                      ...prev,
                                      [item.code]: value
                                    }));
                                  }}
                                  className={`w-full border ${hasQtyErr ? "border-[#F11E26]" : "border-slate-200"} bg-white rounded-lg p-2 text-xs focus:outline-none focus:border-[#1B2A4A] font-bold`}
                                />
                                {hasQtyErr && (
                                  <p className="text-[11px] text-[#F11E26] font-medium mt-0.5">Este campo é obrigatório</p>
                                )}
                              </div>
                            );
                          }

                          if (!field.builtIn) {
                            const isCFReq = isFieldRequired(field, top10Config);
                            const val = customFormValues[item.code]?.[field.id] || "";
                            const hasCFErr = isCFReq && !val.trim() && showFieldErrors;
                            return (
                              <div key={field.id} className="space-y-1 mt-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                  {field.name}{isCFReq && <span className="text-[#F11E26]"> *</span>}
                                </label>
                                {field.type === "select" ? (
                                  <select
                                    value={val}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setCustomFormValues(prev => ({
                                        ...prev,
                                        [item.code]: { ...(prev[item.code] || {}), [field.id]: value }
                                      }));
                                    }}
                                    className={`w-full border ${hasCFErr ? "border-[#F11E26]" : "border-slate-200"} bg-white rounded-lg p-1.5 text-xs font-bold`}
                                  >
                                    <option value="">— Selecione —</option>
                                    {(field.options || []).map((opt: string) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={field.type === "number" ? "number" : "text"}
                                    value={val}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setCustomFormValues(prev => ({
                                        ...prev,
                                        [item.code]: { ...(prev[item.code] || {}), [field.id]: value }
                                      }));
                                    }}
                                    placeholder={`Digite ${field.name}`}
                                    className={`w-full border ${hasCFErr ? "border-[#F11E26]" : "border-slate-200"} bg-white rounded-lg p-1.5 text-xs font-bold`}
                                  />
                                )}
                                {hasCFErr && (
                                  <p className="text-[11px] text-[#F11E26] font-medium mt-0.5">Este campo é obrigatório</p>
                                )}
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>

                      {/* Right panel - Photo Upload Slot */}
                      {top10Config.foto !== false && (() => {
                        const isFotoReq = isFieldRequired({ id: "foto", name: "Anexar Foto de Evidência", builtIn: true }, top10Config);
                        const hasFotoErr = isFotoReq && !photoData && showFieldErrors;
                        return (
                          <div className="shrink-0 pt-1">
                            {photoData ? (
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-emerald-250 bg-slate-50 group shadow-xs">
                                <img src={photoData} alt="Thumb" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(item.code)}
                                  className="absolute inset-0 bg-red-800/80 hover:bg-red-900/90 text-white flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition duration-150 select-none"
                                >
                                  <span className="material-symbols-outlined text-[15px]">delete</span>
                                  Remover
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                <label className={`h-9 px-3.5 bg-indigo-50 border ${hasFotoErr ? "border-[#F11E26]" : "border-indigo-200"} hover:bg-indigo-100 cursor-pointer rounded-lg text-[10.5px] font-black uppercase text-indigo-800 tracking-wider flex items-center gap-1 relative shadow-3xs active:scale-95 transition-all select-none`}>
                                  <span className="material-symbols-outlined text-[15px]">add_a_photo</span>
                                  Anexar{isFotoReq && <span className="text-[#F11E26]"> *</span>}
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) processFile(item.code, f);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                                {hasFotoErr && (
                                  <p className="text-[10px] text-[#F11E26] font-medium text-right">Este campo é obrigatório</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Real-time counters block */}
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex items-center justify-between gap-4 text-xs font-semibold">
              <span className="text-slate-600">Fotos anexadas para o envio:</span>
              <span className={`px-2.5 py-1 rounded-full font-black font-mono text-center text-[11px] ${
                isSubmitBtnAllowed
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200/50"
                  : "bg-amber-50 text-amber-800 border border-amber-200/50 animate-pulse"
              }`}>
                {filledPhotosCount} de {totalItemsCount} anexadas
              </span>
            </div>

            {/* Input logs comments */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-450 text-slate-500 uppercase tracking-wider block">
                Anotações e Justificativas (opcional)
              </label>
              <textarea
                rows={3}
                value={commentsInput}
                onChange={(e) => setCommentsInput(e.target.value)}
                placeholder="Ex: Todos os itens conferem fisicamente nos saldos da garagem. Peças em prateleiras identificadas..."
                className="w-full border border-slate-200 bg-white rounded-lg p-3 text-xs focus:outline-none focus:border-[#1B2A4A] text-slate-700 font-semibold"
              ></textarea>
            </div>

            {/* Real-time progress bar indicator during submission */}
            {isSubmitting && (
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 border border-slate-800 shadow-xl my-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-emerald-300 font-mono text-[11px] uppercase tracking-wide">
                      {uploadProgressMsg || "Processando envio..."}
                    </span>
                  </div>
                  <span className="font-mono text-emerald-400 font-black text-xs">{uploadProgressPct}%</span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700 p-0.5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${Math.max(5, uploadProgressPct)}%` }}
                  />
                </div>

                <div className="text-[10px] font-mono text-slate-400 text-center tracking-wider">
                  {(() => {
                    const blocksTotal = 10;
                    const filled = Math.round((uploadProgressPct / 100) * blocksTotal);
                    const empty = blocksTotal - filled;
                    const barStr = "█".repeat(filled) + "░".repeat(empty);
                    return `[${barStr}] ${uploadProgressPct}%`;
                  })()}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!isSubmitBtnAllowed || isSubmitting}
              className={`w-full py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-widest text-center flex items-center justify-center gap-2 transition shadow ${
                isSubmitBtnAllowed && !isSubmitting
                  ? "bg-[#1B2A4A] text-white hover:opacity-95 active:scale-95"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-150"
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Transmitindo Relatório...</span>
                </>
              ) : (
                <>
                  <span>Enviar Evidências do TOP 10 ⬆</span>
                  <span className="material-symbols-outlined text-[15px]">send</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* LIGHTBOX POPUP FOR FULL IMAGE VIEWER (Works in iframe perfectly) */}
      {activeImgLightbox && (
        <div className="fixed inset-0 bg-slate-950/90 z-90 flex flex-col items-center justify-center p-4 z-[999]">
          <div className="relative max-w-lg w-full max-h-[80vh] flex items-center justify-center">
            <img src={activeImgLightbox} alt="Ampliada" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-slate-800" />
            <button
              onClick={() => setActiveImgLightbox(null)}
              className="absolute -top-12 right-0 bg-white text-[#1B2A4A] font-extrabold w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all shadow-md cursor-pointer text-sm"
              type="button"
            >
              ✖
            </button>
          </div>
          <p className="text-white/60 text-xs mt-3 font-semibold font-mono">Clique no ✖ acima para fechar a visualização</p>
        </div>
      )}
    </div>
  );
}
