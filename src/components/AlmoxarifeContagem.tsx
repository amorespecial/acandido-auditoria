import React, { useState } from "react";
import { InventoryItemToCount, CriterionState } from "../types";
import { initialInventoryItems } from "../mockData";

interface AlmoxarifeContagemProps {
  onBack: () => void;
  onSubmitEvidence: (criterionId: string, comments: string, photos: string[]) => void;
  criterionState?: CriterionState;
  top10?: Array<{ code: string; name: string }>;
}

export default function AlmoxarifeContagem({
  onBack,
  onSubmitEvidence,
  criterionState,
  top10,
}: AlmoxarifeContagemProps) {
  const [items, setItems] = useState<InventoryItemToCount[]>(() => {
    const list = top10 && top10.length === 9 ? top10 : initialInventoryItems;
    return list.map((item) => ({
      ...item,
      physicalCount: criterionState?.status === "OK" || criterionState?.status === "ENVIADO" ? 12 : 0,
      visualEvidenceUploaded: criterionState?.status === "OK" || criterionState?.status === "ENVIADO",
    }));
  });

  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCountChange = (code: string, change: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.code === code) {
          const newVal = Math.max(0, item.physicalCount + change);
          return { ...item, physicalCount: newVal };
        }
        return item;
      })
    );
  };

  const handleInputChange = (code: string, val: string) => {
    const num = parseInt(val) || 0;
    setItems((prev) =>
      prev.map((item) => {
        if (item.code === code) {
          return { ...item, physicalCount: Math.max(0, num) };
        }
        return item;
      })
    );
  };

  const handleUploadPhoto = (code: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.code === code) {
          return { ...item, visualEvidenceUploaded: true };
        }
        return item;
      })
    );
  };

  const handleConfirmSend = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      // Mock photo assets
      const samplePhotos = [
        "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=200",
        "https://images.unsplash.com/photo-1553413719-8758737de7c6?auto=format&fit=crop&q=80&w=200",
      ];

      const filledComment =
        comments ||
        `Inventário mensal do TOP 10 peças concluído. Encontramos conformidade física de todos os itens em estoque no Unitrans JP.`;

      // Submit back up to main app state
      onSubmitEvidence("2", filledComment, samplePhotos);
      setIsSubmitting(false);
      onBack();
    }, 1200);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header heading */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-600 active:scale-90 transition-all select-none"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl font-black text-[#1B2A4A] leading-tight">02 - TOP 10</h2>
          <p className="text-xs text-slate-400 mt-0.5">Inventário Rotativo de Alta Rotatividade</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[11px] leading-relaxed text-[#1B2A4A]">
        <p className="font-bold">Como funciona a contagem mensal?</p>
        <p className="text-slate-600 mt-1">
          Informe a quantidade física exata de cada componente do TOP 10 abaixo e tire fotos de evidência física direta para evitar divergências de conciliação.
        </p>
      </div>

      <form onSubmit={handleConfirmSend} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lista de Materiais</h3>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.code}
                className="bg-white border border-slate-100 rounded-xl p-4 audit-card-shadow space-y-3"
              >
                <div>
                  <span className="text-[9px] font-bold text-slate-400 font-mono">CÓD. {item.code}</span>
                  <h4 className="text-xs font-extrabold text-[#1B2A4A] mt-0.5 leading-snug">{item.name}</h4>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-50">
                  {/* Photo attachments */}
                  <button
                    type="button"
                    onClick={() => handleUploadPhoto(item.code)}
                    className={`h-8.5 px-3 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 shrink-0 ${
                      item.visualEvidenceUploaded
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold"
                        : "bg-white hover:bg-slate-50 border-slate-200 text-[#1B2A4A]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {item.visualEvidenceUploaded ? "check_circle" : "add_a_photo"}
                    </span>
                    {item.visualEvidenceUploaded ? "FOTO AUXILIAR OK" : "ANEXAR EVIDÊNCIA"}
                  </button>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCountChange(item.code, -1)}
                      className="w-8 h-8 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      pattern="[0-9]*"
                      value={item.physicalCount}
                      onChange={(e) => handleInputChange(item.code, e.target.value)}
                      className="w-12 h-8 text-center border border-slate-200 rounded text-xs font-bold font-mono focus:outline-none focus:border-[#1B2A4A]"
                    />
                    <button
                      type="button"
                      onClick={() => handleCountChange(item.code, 1)}
                      className="w-8 h-8 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Anotações / Justificativas
          </label>
          <textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Alguma divergência? Informe se houver materiais com pendências de entrada ou baixas fiscais atrasadas..."
            className="w-full border border-slate-200 bg-white rounded-lg p-3 text-xs focus:outline-none focus:border-[#1B2A4A] text-slate-700"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#1B2A4A] active:bg-[#0F172B] text-white py-3 rounded-lg text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Transmitindo Envio...</span>
            </>
          ) : (
            <>
              <span>Enviar Contagem Mensal</span>
              <span className="material-symbols-outlined text-[16px]">send</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
