import React, { useState } from "react";
import { CriterionState } from "../types";
import { dbFetchLayoutConfig, dbFetchLayoutFieldConfig, isSupabaseReady } from "../supabaseService";
import { getOrderedFields, BUILTIN_LAYOUT_FIELDS } from "../utils/fieldOrdering";

interface AlmoxarifeLayoutProps {
  onBack: () => void;
  onSubmitEvidence: (criterionId: string, comments: string, photos: string[]) => void;
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
  const [layoutConfig, setLayoutConfig] = useState<any>(null);

  React.useEffect(() => {
    const loadLayout = async () => {
      if (branchId && isSupabaseReady()) {
        try {
          const config = await dbFetchLayoutConfig(branchId, activeMonth, activeYear);
          setLayoutConfig(config);
        } catch (e) {
          console.error("Error loading layout config in AlmoxarifeLayout:", e);
        }
      }
    };
    loadLayout();
  }, [branchId, activeMonth, activeYear]);

  const isConfigured = !!layoutConfig?.location;
  const locationText = isConfigured 
    ? layoutConfig.location 
    : "Aguardando definição da localização pelo auditor.";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (photos.length >= 5) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setPhotos((prev) => {
            if (prev.length >= 5) return prev;
            return [...prev, reader.result as string];
          });
        }
      };
      reader.readAsDataURL(file as any);
    });
  };

  const handleSimulatePreset = () => {
    if (photos.length >= 5) {
      alert("Limite de 5 fotos atingido.");
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

  const handleConfirmSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (layoutFieldsConfig.fotos !== false && photos.length === 0) {
      alert("Por favor, adicione pelo menos 1 foto antes de enviar.");
      return;
    }
    if (layoutFieldsConfig.customFields && layoutFieldsConfig.customFields.length > 0) {
      const missingReq = layoutFieldsConfig.customFields.find((cf: any) => cf.required && !customFormValues[cf.id]?.trim());
      if (missingReq) {
        alert(`O campo "${missingReq.name}" é obrigatório.`);
        return;
      }
    }
    setIsSending(true);

    setTimeout(() => {
      const finalComments =
        commentInput ||
        `LayOut da localização auditada deste ciclo enviado. Organização e limpeza de canaletas, prateleiras de código e arrumação física efetuadas com sucesso.`;

      onSubmitEvidence("4", finalComments, photos);
      setIsSending(false);
      onBack();
    }, 1200);
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
            return (
              <div key="fotos" className="space-y-3 font-sans">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">Mídia Enviada</span>
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
                      <label className="bg-white border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#1B2A4A] hover:bg-slate-50/50 transition-all select-none aspect-square p-2 min-h-[140px]">
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
              </div>
            );
          }

          if (field.id === "comentario") {
            if (layoutFieldsConfig.comentario === false) return null;
            return (
              <div key="comentario" className="space-y-2 font-sans">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Comentários do Almoxarife
                </label>
                <textarea
                  rows={3}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Descreva o status da sua organização física ou informe caso precise de porta-etiquetas ou fitas demarcadoras..."
                  className="w-full border border-slate-200 bg-white rounded-lg p-3 text-xs focus:outline-none focus:border-[#1B2A4A] text-slate-700"
                ></textarea>
              </div>
            );
          }

          if (!field.builtIn) {
            return (
              <div key={field.id} className="space-y-1 font-sans">
                <label className="text-xs font-bold text-[#1B2A4A] block">
                  {field.name} {field.required && "*"}
                </label>
                {field.type === "select" ? (
                  <select
                    value={customFormValues[field.id] || ""}
                    onChange={(e) => setCustomFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                    className="w-full border border-slate-200 bg-white rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                  >
                    <option value="">— Selecione —</option>
                    {(field.options || []).map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    value={customFormValues[field.id] || ""}
                    onChange={(e) => setCustomFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder={`Digite ${field.name}`}
                    className="w-full border border-slate-200 bg-white rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                  />
                )}
              </div>
            );
          }

          return null;
        })}

        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={`w-full py-3 rounded-lg text-xs font-bold shadow-md transition-all text-center flex items-center justify-center gap-2 select-none ${
            isSubmitDisabled
              ? "bg-slate-250 text-slate-400 cursor-not-allowed border border-slate-200 bg-slate-200"
              : "bg-[#1B2A4A] hover:opacity-95 text-white active:scale-95"
          }`}
        >
          {isSending ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
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
