import React, { useState } from "react";
import { toast } from "../utils/toast";
import { Loader2 } from "lucide-react";

interface InventoryItem {
  code: string;
  name: string;
}

interface AdminConfigurarCicloProps {
  selectedMonth: string;
  selectedYear: string;
  onSaveConfig: (config: {
    top10: InventoryItem[];
    layoutLocation: string;
    materialParadoUploaded: boolean;
  }) => void;
  currentConfig?: {
    top10: InventoryItem[];
    layoutLocation: string;
    materialParadoUploaded: boolean;
    configured: boolean;
  };
}

export default function AdminConfigurarCiclo({
  selectedMonth,
  selectedYear,
  onSaveConfig,
  currentConfig,
}: AdminConfigurarCicloProps) {
  const [isSaving, setIsSaving] = useState(false);
  // 9 initial prefilled items
  const defaultItems: InventoryItem[] = [
    { code: "1080571", name: "BATERIA 180 AMP" },
    { code: "1050177", name: "KIT EMBREAGEM 1722" },
    { code: "1081086", name: "ALTERNADOR BOSCH 24V 150AMP" },
    { code: "1080901", name: "ALTERNADOR 24V 80 AMP" },
    { code: "1140356", name: "COMPRESSOR AR CONDICIONADO TM" },
    { code: "1091094", name: "TENSOR CORREIA ALTERNADOR MB O500" },
    { code: "1090604", name: "TURBINA 1721 EURO 5 NOVA" },
    { code: "1090667", name: "BOMBA DO ARLA EURO 5" },
    { code: "1091730", name: "BOMBA DO ARLA EURO 6" },
  ];

  const [top10, setTop10] = useState<InventoryItem[]>(() => {
    if (currentConfig && currentConfig.top10 && currentConfig.top10.length === 9) {
      return currentConfig.top10;
    }
    return defaultItems;
  });

  const [layoutLocation, setLayoutLocation] = useState(() => {
    return currentConfig?.layoutLocation || "";
  });

  const [pdfName, setPdfName] = useState<string | null>(() => {
    return currentConfig?.materialParadoUploaded ? "relatorio_transnet_material_parado.pdf" : null;
  });

  const isSemestralMonth =
    selectedMonth.toLowerCase() === "janeiro" || selectedMonth.toLowerCase() === "julho";

  const handleItemChange = (index: number, field: "code" | "name", value: string) => {
    const updated = [...top10];
    updated[index] = { ...updated[index], [field]: value };
    setTop10(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPdfName(e.target.files[0].name);
    }
  };

  const isFormValid = () => {
    if (!layoutLocation.trim()) return false;
    // Verify each TOP10 is filled
    const hasEmptyTop10 = top10.some((item) => !item.code.trim() || !item.name.trim());
    if (hasEmptyTop10) return false;

    // If semestral, report must be uploaded
    if (isSemestralMonth && !pdfName) return false;

    return true;
  };

  const handleSave = async () => {
    if (!isFormValid()) return;
    setIsSaving(true);
    try {
      await onSaveConfig({
        top10,
        layoutLocation,
        materialParadoUploaded: !!pdfName,
      });
      toast.success(`O ciclo de ${selectedMonth}/${selectedYear} foi configurado e aberto com sucesso para todos os almoxarifes!`);
    } catch (err: any) {
      toast.error(`Erro ao salvar configuração do ciclo: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="configurar-ciclo-tela">
      <header className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-extrabold text-[#1B2A4A] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#C8A84B]">settings_suggest</span>
          Configurar Ciclo Mensal — {selectedMonth} {selectedYear}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Etapa 1 do Fluxo de Auditoria. Defina quais materiais e localizações serão vistoriados neste ciclo para que os almoxarifes possam realizar seus envios.
        </p>

        {currentConfig?.configured && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs rounded-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>Este ciclo já se encontra configurado e liberado para envios. Você pode editar os parâmetros e salvar novamente se necessário.</span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Items configuration */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider">
              TOP 10 — Definir 9 Materiais Críticos
            </h3>
            <span className="bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-2 py-0.5 rounded border">
              9 Itens Obrigatórios
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {top10.map((item, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="font-mono text-xs font-black text-slate-400 w-6 text-right">
                  {index + 1}.
                </span>
                <input
                  type="text"
                  placeholder="Cód. Material"
                  value={item.code}
                  onChange={(e) => handleItemChange(index, "code", e.target.value)}
                  className="w-1/3 px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                />
                <input
                  type="text"
                  placeholder="Descrição Completa do Material"
                  value={item.name}
                  onChange={(e) => handleItemChange(index, "name", e.target.value)}
                  className="w-2/3 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:border-[#1B2A4A]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Physical boundaries (Layout location and semestral files) */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#1B2A4A] uppercase tracking-wider border-b pb-3">
              Área e Layout do Mês
            </h3>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block">
                Localização Solicitada para Fotos
              </label>
              <input
                type="text"
                value={layoutLocation}
                onChange={(e) => setLayoutLocation(e.target.value)}
                placeholder="Ex: Corredor B — Prateleira 2 ou Setor de Filtros"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#1B2A4A]"
              />
              <span className="text-[10px] text-slate-400 block italic leading-normal">
                Indique com precisão qual estante, gôndola ou setor físico do armazém o almoxarife deve fotografar para provar o ordenamento físico (Lay Out).
              </span>
            </div>
          </div>

          {/* Semestral rules if January or July */}
          {isSemestralMonth && (
            <div className="bg-white p-6 rounded-xl border border-rose-100 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5 text-rose-800 border-b pb-3">
                <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Requisitos Semestrais
                </h3>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-550 uppercase block">
                  Material Parado (Transnet)
                </label>

                <div className="border-2 border-dashed border-rose-200 rounded-xl p-4 text-center bg-rose-50/20 relative">
                  <span className="material-symbols-outlined text-rose-500 text-[28px] mb-1">
                    file_upload
                  </span>
                  <p className="text-[11px] font-bold text-slate-700">Relatório Transnet Peças Sem Giro</p>
                  <p className="text-[10px] text-slate-400 mt-1">Insira a lista PDF gerada do Transnet</p>

                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />

                  {pdfName && (
                    <div className="mt-2 text-[10px] bg-red-100 text-red-800 font-bold p-1 rounded inline-flex items-center gap-1 border border-red-200">
                      <span className="material-symbols-outlined text-[12px]">check</span>
                      {pdfName}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block leading-normal italic">
                  Obrigatório para abrir o ciclo semestral no mês de {selectedMonth}.
                </span>
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isFormValid() || isSaving}
            className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow active:scale-95 flex items-center justify-center gap-2 ${
              isFormValid() && !isSaving
                ? "bg-[#1B2A4A] text-white hover:brightness-110"
                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando e Abrindo Ciclo...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                <span>Salvar e Abrir Ciclo de {selectedMonth}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
