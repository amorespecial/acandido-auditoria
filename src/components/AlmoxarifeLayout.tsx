import React, { useState } from "react";
import { CriterionState } from "../types";
import { dbFetchLayoutConfig, dbFetchLayoutFieldConfig, isSupabaseReady, comprimirImagem } from "../supabaseService";
import { getOrderedFields, BUILTIN_LAYOUT_FIELDS, isFieldRequired } from "../utils/fieldOrdering";
import { toast } from "../utils/toast";
import { Loader2 } from "lucide-react";

interface AlmoxarifeLayoutProps {
  onBack: () => void;
  onSubmitEvidence: (
    criterionId: string,
    comments: string,
    photos: string[],
    top10Quantities?: number[],
    onProgress?: (msg: string, percent: number) => void
  ) => Promise<any> | void;
  criterionState?: CriterionState;
  branchId: string;
  activeMonth: string;
  activeYear: string;
}

const presetPhotosList = [
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1553413719-8758737de7c6?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1532635241-17e820acf59f?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=600"
];

export default function AlmoxarifeLayout({
  onBack,
  onSubmitEvidence,
  criterionState,
  branchId,
  activeMonth,
  activeYear,
}: AlmoxarifeLayoutProps) {
  const [photos, setPhotos] = useState<string[]>(() => {
    return criterionState?.submittedPhotos || [];
  });

  const [commentInput, setCommentInput] = useState(() => {
    return criterionState?.evidenceNotes || "";
  });
  const [isSending, setIsSending] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");
  const [uploadProgressPct, setUploadProgressPct] = useState(0);
  const [layoutConfig, setLayoutConfig] = useState<any>(null);

  React.useEffect(() => {
    const loadLayout = async () => {
      if (branchId) {
        try {
          const config = await dbFetchLayoutConfig(branchId, activeMonth, activeYear);
          setLayoutConfig(config);
        } catch (e) {
          console.error("Error loading layout config in AlmoxarifeLayout:", e);
        }
      }
    };
    loadLayout();

    const handleRealtime = () => {
      loadLayout();
    };

    window.addEventListener("realtime-layout-config-update", handleRealtime);
    window.addEventListener("realtime-avaliacoes-update", handleRealtime);
    return () => {
      window.removeEventListener("realtime-layout-config-update", handleRealtime);
      window.removeEventListener("realtime-avaliacoes-update", handleRealtime);
    };
  }, [branchId, activeMonth, activeYear]);

  const isConfigured = !!layoutConfig?.location;
  const locationText = isConfigured 
    ? layoutConfig.location 
    : "Aguardando definição da localização pelo auditor.";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (photos.length >= 5) break;
      try {
        const compressed = await comprimirImagem(file, 800, 1280, 0.8, "image/webp");
        if (compressed) {
          setPhotos((prev) => (prev.length < 5 ? [...prev, compressed] : prev));
        }
      } catch (err) {
        console.error("Erro ao comprimir imagem:", err);
      }
    }
    e.target.value = "";
  };

  const handleSimulatePreset = () => {
    if (photos.length >= 5) {
      toast.warning("Limite de 5 fotos atingido.");
      return;
    }
    const nextPhoto = presetPhotosList[photos.length % presetPhotosList.length];
    setPhotos(prev => [...prev, nextPhoto]);
  };

  const [layoutFieldsConfig, setLayoutFieldsConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("acandido_layout_fields_config");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { localizacao: true, fotos: true, comentario: true, customFields: [] as any[] };
  });

  const [customFormValues, setCustomFormValues] = useState<Record<string, string>>({});

  React.useEffect(() => {
    let active = true;
    const loadRemoteConfig = async () => {
      try {
        const remoteCfg = await dbFetchLayoutFieldConfig();
        if (remoteCfg && typeof remoteCfg === "object" && active) {
          setLayoutFieldsConfig(remoteCfg);
        }
      } catch (e) {
        console.warn("Error fetching remote layout field config:", e);
      }
    };

    loadRemoteConfig();

    const handleStorage = () => {
      loadRemoteConfig();
      try {
        const saved = localStorage.getItem("acandido_layout_fields_config");
        if (saved) setLayoutFieldsConfig(JSON.parse(saved));
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

  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const handleConfirmSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowFieldErrors(true);

    const isFotosReq = isFieldRequired({ id: "fotos", name: "Evidência Fotográfica", builtIn: true }, layoutFieldsConfig);
    if (isFotosReq && photos.length === 0) {
      return;
    }

    const isComentarioReq = isFieldRequired({ id: "comentario", name: "Comentários do Almoxarife", builtIn: true }, layoutFieldsConfig);
    if (isComentarioReq && !commentInput.trim()) {
      return;
    }

    if (layoutFieldsConfig.customFields && layoutFieldsConfig.customFields.length > 0) {
      const missingReq = layoutFieldsConfig.customFields.find((cf: any) => isFieldRequired(cf, layoutFieldsConfig) && !customFormValues[cf.id]?.trim());
      if (missingReq) {
        return;
      }
    }
    setIsSending(true);
    setUploadProgressMsg("Iniciando envio das fotos...");
    setUploadProgressPct(5);

    try {
      const finalComments =
        commentInput ||
        `LayOut da localização auditada deste ciclo enviado. Organização e limpeza de canaletas, prateleiras de código e arrumação física efetuadas com sucesso.`;

      await onSubmitEvidence(
        "4",
        finalComments,
        photos,
        undefined,
        (msg: string, pct: number) => {
          setUploadProgressMsg(msg);
          setUploadProgressPct(pct);
        }
      );

      setIsSending(false);
      toast.success("Evidência de LayOut enviada com sucesso!");
      onBack();
    } catch (err: any) {
      console.error("Erro ao enviar evidência do LayOut:", err);
      toast.error(`Erro na transmissão do LayOut: ${err?.message || "Erro de conexão. Tente novamente."}`);
      setIsSending(false);
    }
  };

  const isPhotoRequired = layoutFieldsConfig.fotos !== false;
  const isSubmitDisabled = (isPhotoRequired && photos.length === 0) || isSending;

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Top action header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-600 active:scale-90 transition-all select-none"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl font-black text-[#1B2A4A] leading-tight font-sans">04 - LayOut</h2>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">Auditoria por Registro Fotográfico</p>
        </div>
      </div>

      {/* Dynamic Guideline Card */}
      {layoutFieldsConfig.localizacao !== false && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[11px] leading-relaxed text-[#1B2A4A] space-y-2 font-sans">
          <p className="font-extrabold uppercase tracking-wider text-[10px] text-amber-850">
            Diretrizes Fotográficas de Conformidade
          </p>
          
          <p className="font-semibold text-slate-700">
            A localização definida pelo auditor para o circuito de <strong className="font-bold">{activeMonth}/{activeYear}</strong> é:
          </p>
          
          <div className="bg-amber-100 border border-amber-200 rounded-lg p-2.5 my-1.5 shadow-3xs">
            <p className={`font-black text-xs ${isConfigured ? "text-indigo-950" : "text-amber-800 italic"}`}>
              {locationText}
            </p>
          </div>

          <p className="text-slate-600 leading-normal font-medium">
            Tire ou anexe até 5 fotos focando na prateleira inteira e nos itens a serem auditados, mostrando claramente a identificação visual dos códigos que se encontram na área indicada.
          </p>

          {layoutConfig?.instructions && (
            <div className="pt-2 border-t border-amber-200/60 text-slate-700 mt-2">
              <span className="font-bold block text-[10px] uppercase text-amber-900">Observação do auditor:</span>
              <p className="italic font-medium text-amber-950">"{layoutConfig.instructions}"</p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleConfirmSubmission} className="space-y-6">
        {getOrderedFields(layoutFieldsConfig, BUILTIN_LAYOUT_FIELDS).map((field) => {
          if (field.id === "localizacao") {
            if (layoutFieldsConfig.localizacao === false) return null;
            return null; // Localizacao directive card is already rendered above form or can be rendered here
          }

          if (field.id === "fotos") {
            if (layoutFieldsConfig.fotos === false) return null;
            const isFotosReq = isFieldRequired({ id: "fotos", name: "Anexar Foto de Evidência", builtIn: true }, layoutFieldsConfig);
            const hasFotosErr = isFotosReq && photos.length === 0 && showFieldErrors;
            return (
              <div key="fotos" className="space-y-3 font-sans">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">
                    Mídia Enviada{isFotosReq && <span className="text-[#F11E26]"> *</span>}
                  </span>
                  <span className="font-black text-[#1B2A4A] bg-slate-100 px-2.5 py-1 rounded-full font-mono text-[10px]">
                    {photos.length} de 5 fotos anexadas
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden aspect-square relative shadow-2xs group"
                    >
                      <img
                        src={url}
                        referrerPolicy="no-referrer"
                        alt={`Evidência ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 bg-black/75 hover:bg-black text-white w-6 h-6 rounded-full flex items-center justify-center transition-all shadow active:scale-90"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                      <div className="absolute bottom-1.5 left-1.5 bg-black/60 px-1.5 py-0.5 rounded text-[8.5px] font-bold text-white uppercase tracking-wider">
                        Foto {idx + 1}
                      </div>
                    </div>
                  ))}

                  {/* "+ Adicionar Foto" button as slot */}
                  {photos.length < 5 && (
                    <div className="flex flex-col gap-2">
                      <label className={`bg-white border-2 border-dashed ${hasFotosErr ? "border-[#F11E26]" : "border-slate-300"} rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#1B2A4A] hover:bg-slate-50/50 transition-all select-none aspect-square p-2 min-h-[140px]`}>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <span className="material-symbols-outlined text-[28px] text-slate-400">add_a_photo</span>
                        <span className="text-[10px] font-black text-[#1B2A4A] mt-1.5">
                          + Adicionar Foto
                        </span>
                        <span className="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-wider leading-none">
                          {photos.length === 0 ? "Nenhuma foto (0/5)" : `${photos.length}/5 fotos`}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
                {hasFotosErr && (
                  <p className="text-[11px] text-[#F11E26] font-medium mt-0.5">Este campo é obrigatório</p>
                )}
              </div>
            );
          }

          if (field.id === "comentario") {
            if (layoutFieldsConfig.comentario === false) return null;
            const isComentarioReq = isFieldRequired({ id: "comentario", name: "Comentários do Almoxarife", builtIn: true }, layoutFieldsConfig);
            const hasComentarioErr = isComentarioReq && !commentInput.trim() && showFieldErrors;
            return (
              <div key="comentario" className="space-y-2 font-sans">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Comentários do Almoxarife{isComentarioReq && <span className="text-[#F11E26]"> *</span>}
                </label>
                <textarea
                  rows={3}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Descreva o status da sua organização física ou informe caso precise de porta-etiquetas ou fitas demarcadoras..."
                  className={`w-full border ${hasComentarioErr ? "border-[#F11E26]" : "border-slate-200"} bg-white rounded-lg p-3 text-xs focus:outline-none focus:border-[#1B2A4A] text-slate-700`}
                ></textarea>
                {hasComentarioErr && (
                  <p className="text-[11px] text-[#F11E26] font-medium mt-0.5">Este campo é obrigatório</p>
                )}
              </div>
            );
          }

          if (!field.builtIn) {
            const isCFReq = isFieldRequired(field, layoutFieldsConfig);
            const val = customFormValues[field.id] || "";
            const hasCFErr = isCFReq && !val.trim() && showFieldErrors;
            return (
              <div key={field.id} className="space-y-1 font-sans">
                <label className="text-xs font-bold text-[#1B2A4A] block">
                  {field.name}{isCFReq && <span className="text-[#F11E26]"> *</span>}
                </label>
                {field.type === "select" ? (
                  <select
                    value={val}
                    onChange={(e) => setCustomFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                    className={`w-full border ${hasCFErr ? "border-[#F11E26]" : "border-slate-200"} bg-white rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
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
                    onChange={(e) => setCustomFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder={`Digite ${field.name}`}
                    className={`w-full border ${hasCFErr ? "border-[#F11E26]" : "border-slate-200"} bg-white rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]`}
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

        {/* Real-time progress bar indicator during submission */}
        {isSending && (
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 border border-slate-800 shadow-xl my-3 font-sans">
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
          disabled={isSubmitDisabled}
          className={`w-full py-3 rounded-lg text-xs font-bold shadow-md transition-all text-center flex items-center justify-center gap-2 select-none ${
            isSubmitDisabled
              ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200"
              : "bg-[#1B2A4A] hover:opacity-95 text-white active:scale-95"
          }`}
        >
          {isSending ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 text-white" />
              <span>Transmitindo Fotos...</span>
            </>
          ) : (
            <>
              <span>Enviar Evidência do LayOut</span>
              <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
