import React, { useState, useEffect } from "react";
import { WarrantyItem, Branch } from "../types";
import { dbFetchWarranties, dbDeleteWarranty, dbSalvarGarantia } from "../supabaseService";
import { getAnosDisponiveis } from "../utils/dateUtils";
import { getWarrantyFieldValue, handleOpenAnexo } from "./AlmoxarifeGarantia";

interface AdminGarantiasPanelProps {
  branch?: Branch; // If provided, locks down to this specific branch!
  allBranches: Branch[];
}

export default function AdminGarantiasPanel({ branch, allBranches }: AdminGarantiasPanelProps) {
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [garantiaConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("acandido_garantia_fields_config");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Edit Modal State
  const [editingWarranty, setEditingWarranty] = useState<WarrantyItem | null>(null);
  const [editForm, setEditForm] = useState({
    itemCode: "",
    itemDescription: "",
    manufacturer: "",
    expiryDate: "",
    almoxarifado: "",
    nfEmissionDate: "",
    reference: "",
    pieceObservation: "",
    scrapObservation: ""
  });

  // Filters
  const [selectedAlmoxarifado, setSelectedAlmoxarifado] = useState<string>(branch ? branch.name : "TODOS");
  const [selectedMonth, setSelectedMonth] = useState<string>("TODOS");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("TODOS");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODOS");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Delete Handler
  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir esta garantia?")) {
      try {
        await dbDeleteWarranty(id);
        setWarranties((prev) => prev.filter((w) => w.id !== id));
        localStorage.setItem("acandido_warranties", JSON.stringify(warranties.filter((w) => w.id !== id)));
        window.dispatchEvent(new Event("realtime-garantias-update"));
      } catch (e) {
        console.error("Erro ao excluir garantia:", e);
        alert("Erro ao excluir registro de garantia.");
      }
    }
  };

  // Open Edit Handler
  const handleOpenEdit = (w: WarrantyItem) => {
    setEditingWarranty(w);
    setEditForm({
      itemCode: w.itemCode || "",
      itemDescription: w.itemDescription || "",
      manufacturer: w.manufacturer || "",
      expiryDate: w.expiryDate || "",
      almoxarifado: w.almoxarifado || "",
      nfEmissionDate: w.nfEmissionDate || "",
      reference: w.reference || "",
      pieceObservation: w.pieceObservation || "",
      scrapObservation: w.scrapObservation || ""
    });
  };

  // Save Edit Handler
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarranty) return;

    try {
      const updatedItem: WarrantyItem = {
        ...editingWarranty,
        itemCode: editForm.itemCode,
        itemDescription: editForm.itemDescription,
        manufacturer: editForm.manufacturer,
        expiryDate: editForm.expiryDate,
        almoxarifado: editForm.almoxarifado,
        nfEmissionDate: editForm.nfEmissionDate,
        reference: editForm.reference,
        pieceObservation: editForm.pieceObservation,
        scrapObservation: editForm.scrapObservation,
        lastUpdateDate: new Date().toISOString().split("T")[0]
      };

      await dbSalvarGarantia(updatedItem);

      setWarranties((prev) => prev.map((w) => (w.id === editingWarranty.id ? updatedItem : w)));
      localStorage.setItem(
        "acandido_warranties",
        JSON.stringify(warranties.map((w) => (w.id === editingWarranty.id ? updatedItem : w)))
      );
      window.dispatchEvent(new Event("realtime-garantias-update"));
      setEditingWarranty(null);
      alert("Garantia atualizada com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar garantia:", err);
      alert("Erro ao salvar alterações da garantia.");
    }
  };

  // Fetch warranties
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await dbFetchWarranties();
        setWarranties(data || []);
      } catch (error) {
        console.error("Erro ao buscar garantias para auditor:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();

    const handleRealtime = () => {
      console.log("Realtime event received! Reloading guarantees records...");
      loadData();
    };

    window.addEventListener("realtime-garantias-update", handleRealtime);
    return () => {
      window.removeEventListener("realtime-garantias-update", handleRealtime);
    };
  }, []);

  // Set selected almoxarifado when branch prop changes
  useEffect(() => {
    if (branch) {
      setSelectedAlmoxarifado(branch.name);
    }
  }, [branch]);

  // Translate status with rules:
  // ✅ Vigente: expireDate > today + 30 days
  // ⚠ Vencendo: expireDate between today and today + 30 days
  // ❌ Vencida: expireDate < today
  const getWarrantyStatus = (expiryDateStr: string) => {
    if (!expiryDateStr) {
      return {
        key: "VENCIDA",
        label: "❌ Vencida (Sem data)",
        colorClass: "bg-rose-50 text-rose-700 border-rose-200"
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDateStr + "T00:00:00");
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        key: "VENCIDA",
        label: "❌ Vencida",
        colorClass: "bg-radial from-rose-50 to-rose-100/60 text-rose-700 border border-rose-200"
      };
    } else if (diffDays <= 30) {
      return {
        key: "VENCENDO",
        label: `⚠ Vencendo (${diffDays}d)`,
        colorClass: "bg-radial from-amber-50 to-amber-100/60 text-amber-700 border border-amber-200"
      };
    } else {
      return {
        key: "VIGENTE",
        label: "✅ Vigente",
        colorClass: "bg-radial from-emerald-50 to-emerald-100/60 text-emerald-700 border border-emerald-200"
      };
    }
  };

  // Extract static list options based on data for dropdown selections
  const availableAlmoxarifados = Array.from(
    new Set(warranties.map((w) => w.almoxarifado).filter(Boolean))
  ).sort();

  const availableManufacturers = Array.from(
    new Set(warranties.map((w) => w.manufacturer).filter(Boolean))
  ).sort();

  const availableYears = Array.from(
    new Set<string>([
      ...getAnosDisponiveis().map(String),
      ...warranties.map((w) => {
        if (!w.monthYear) return "";
        const parts = w.monthYear.split(" ");
        return parts[1] || "";
      }).filter(Boolean)
    ])
  ).sort((a: string, b: string) => b.localeCompare(a)); // Descending years

  const monthsList = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Filtering Logic
  const filteredWarranties = warranties.filter((w) => {
    // 1. Almoxarifado Filter (if locked by branch prop, we restrict to branch.name)
    const targetAlmox = branch ? branch.name : selectedAlmoxarifado;
    if (targetAlmox !== "TODOS") {
      // Normalize comparison to prevent minor spacing differences
      const normalizedWName = (w.almoxarifado || "").toLowerCase().trim();
      const normalizedTarget = targetAlmox.toLowerCase().trim();
      if (!normalizedWName.includes(normalizedTarget) && !normalizedTarget.includes(normalizedWName)) {
        return false;
      }
    }

    // 2. Month-Year Split Filters
    const splitMy = w.monthYear ? w.monthYear.split(" ") : [];
    const itemMonth = splitMy[0] || "";
    const itemYear = splitMy[1] || "";

    if (selectedMonth !== "TODOS" && itemMonth.toLowerCase() !== selectedMonth.toLowerCase()) {
      return false;
    }

    if (selectedYear !== "TODOS" && itemYear !== selectedYear) {
      return false;
    }

    // 3. Manufacturer Filter
    if (selectedManufacturer !== "TODOS" && w.manufacturer !== selectedManufacturer) {
      return false;
    }

    // 4. Status Filter
    const calcStatus = getWarrantyStatus(w.expiryDate);
    if (selectedStatus !== "TODOS" && calcStatus.key !== selectedStatus) {
      return false;
    }

    // 5. Free Search Query (item description or code)
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const codeMatch = (w.itemCode || "").toLowerCase().includes(q);
      const descMatch = (w.itemDescription || "").toLowerCase().includes(q);
      const manufacturerMatch = (w.manufacturer || "").toLowerCase().includes(q);
      if (!codeMatch && !descMatch && !manufacturerMatch) {
         return false;
      }
    }

    return true;
  });

  // Export CSV Functionality
  const exportToCSV = () => {
    if (filteredWarranties.length === 0) {
      alert("Nenhum registro encontrado para exportar.");
      return;
    }

    // Header definition
    const headers = [
      "Almoxarifado",
      "Codigo Item",
      "Descricao Item",
      "Fabricante",
      "Vencimento Garantia",
      "Data Emissao NF",
      "Referência",
      "Registrado Em",
      "Status"
    ];

    // CSV rows build map
    const csvRows = [headers.join(";")];

    for (const w of filteredWarranties) {
      const statusObj = getWarrantyStatus(w.expiryDate);
      const statusText = statusObj.label.replace(/✅|⚠|❌/, "").trim();
      
      const row = [
        `"${(w.almoxarifado || "").replace(/"/g, '""')}"`,
        `"${(w.itemCode || "").replace(/"/g, '""')}"`,
        `"${(w.itemDescription || "").replace(/"/g, '""')}"`,
        `"${(w.manufacturer || "").replace(/"/g, '""')}"`,
        `"${w.expiryDate ? new Date(w.expiryDate + 'T00:00:00').toLocaleDateString("pt-BR") : ""}"`,
        `"${w.nfEmissionDate ? new Date(w.nfEmissionDate + 'T00:00:00').toLocaleDateString("pt-BR") : ""}"`,
        `"${(w.reference || "").replace(/"/g, '""')}"`,
        `"${w.lastUpdateDate ? new Date(w.lastUpdateDate + 'T00:00:00').toLocaleDateString("pt-BR") : ""}"`,
        `"${statusText}"`
      ];
      csvRows.push(row.join(";"));
    }

    // BLOB stream execution
    const csvContent = "\uFEFF" + csvRows.join("\n"); // prepending UTF-8 BOM
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = branch 
      ? `garantias-${branch.name.toLowerCase().replace(/\s+/g, "-")}.csv`
      : "garantias-central-geral.csv";
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" id="central-garantias-view">
      {/* Header Banner */}
      <div className="p-[24px_28px] bg-[#00194C] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-[3px] border-[#F11E26]">
        <div>
          <h2 className="text-[18px] font-semibold text-white tracking-tight" id="central-garantias-header-title">Central de Garantias</h2>
          <p className="text-[13px] text-[#94A3B8] mt-0.5" id="central-garantias-header-subtitle">
            {branch 
              ? `Visão consolidada e controle de todos os registros de garantia para a unidade ${branch.name}`
              : "Visão consolidada e controle de todos os registros de garantia de todos os almoxarifados"}
          </p>
        </div>

        <button
          type="button"
          onClick={exportToCSV}
          disabled={filteredWarranties.length === 0}
          className="border border-white text-white bg-transparent hover:bg-white/10 transition-all disabled:opacity-40 disabled:pointer-events-none px-4 py-2 rounded-lg text-xs font-semibold uppercase flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Exportar CSV
        </button>
      </div>

      {/* Control Filters Bar */}
      <div className="p-5 bg-slate-50 border-b border-slate-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Almoxarifado Select (Only editable if no branch prop is supplied) */}
          {!branch ? (
            <div>
              <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Almoxarifado</label>
              <select
                value={selectedAlmoxarifado}
                onChange={(e) => setSelectedAlmoxarifado(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-705 mt-1 focus:ring-1 focus:ring-[#1B2A4A]"
              >
                <option value="TODOS">Todos os Almoxarifados</option>
                {allBranches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name.replace("ALMOXARIFADO ", "")}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Almoxarifado</label>
              <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs font-black text-slate-655 mt-1 select-none">
                📍 {branch.name.replace("ALMOXARIFADO ", "")}
              </div>
            </div>
          )}

          {/* Month Filter */}
          <div>
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Mês do Registro</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-705 mt-1 focus:ring-1 focus:ring-[#1B2A4A]"
            >
              <option value="TODOS">Todos os meses</option>
              {monthsList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Ano</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-705 mt-1 focus:ring-1 focus:ring-[#1B2A4A]"
            >
              <option value="TODOS">Todos os anos</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Free search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-slate-400 text-[18px] absolute left-3.5 top-2.5">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código de item, descrição ou fabricante..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold focus:outline-none focus:border-[#1B2A4A] shadow-3xs"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-colors"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Main Content Details */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-10 h-10 border-4 border-[#1B2A4A]/20 border-t-[#1B2A4A] rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500">Buscando garantias em tempo real...</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {filteredWarranties.length > 0 ? (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 select-none">
                  {!branch && <th className="p-4 pl-6 min-w-[130px]">Almoxarifado</th>}
                  <th className="p-4 min-w-[170px]">Item (Código / Nome)</th>
                  <th className="p-4 min-w-[120px]">Fabricante</th>
                  <th className="p-4 min-w-[110px]">Garantia Até</th>
                  <th className="p-4 min-w-[100px]">Data NF</th>
                  <th className="p-4 min-w-[110px]">Nota Fiscal</th>
                  <th className="p-4 min-w-[110px]">Referência</th>
                  <th className="p-4 min-w-[100px]">Veículo</th>
                  <th className="p-4 min-w-[120px]">Localização</th>
                  <th className="p-4 min-w-[160px]">Observação</th>
                  <th className="p-4 text-center min-w-[80px]">Anexo</th>
                  <th className="p-4 min-w-[110px]">Registrado Em</th>
                  <th className="p-4 min-w-[120px]">Registrado Por</th>
                  <th className="p-4 text-center min-w-[100px]">Status</th>
                  <th className="p-4 pr-6 text-center min-w-[140px]">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold bg-white">
                {filteredWarranties.map((w) => {
                  const status = getWarrantyStatus(w.expiryDate);
                  const dataNf = getWarrantyFieldValue(w, "dataNf", garantiaConfig?.customFields);
                  const notaFiscal = getWarrantyFieldValue(w, "notaFiscal", garantiaConfig?.customFields);
                  const referencia = getWarrantyFieldValue(w, "referencia", garantiaConfig?.customFields);
                  const veiculo = getWarrantyFieldValue(w, "veiculo", garantiaConfig?.customFields);
                  const localizacao = getWarrantyFieldValue(w, "localizacao", garantiaConfig?.customFields);
                  const observacao = getWarrantyFieldValue(w, "observacao", garantiaConfig?.customFields);
                  const hasAnexo = Boolean((w as any).anexo_base64 || (w as any).arquivo_base64);

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/40 transition-colors">
                      {!branch && (
                        <td className="p-4 pl-6 font-bold text-[#1B2A4A] whitespace-nowrap">
                          {w.almoxarifado ? w.almoxarifado.replace("ALMOXARIFADO ", "") : "—"}
                        </td>
                      )}
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{w.itemCode || "—"}</div>
                        <div className="text-[10px] text-slate-400 font-medium limit-lines-1" title={w.itemDescription}>
                          {w.itemDescription || "Sem descrição"}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 font-bold uppercase whitespace-nowrap">{w.manufacturer || "—"}</td>
                      <td className="p-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {w.expiryDate ? new Date(w.expiryDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-4 font-mono text-slate-600 whitespace-nowrap">{dataNf}</td>
                      <td className="p-4 font-mono font-bold text-slate-700 whitespace-nowrap">{notaFiscal}</td>
                      <td className="p-4 font-mono text-slate-600 whitespace-nowrap">{referencia}</td>
                      <td className="p-4 text-slate-700 font-bold uppercase whitespace-nowrap">{veiculo}</td>
                      <td className="p-4 text-slate-700 font-bold whitespace-nowrap">{localizacao}</td>
                      <td className="p-4 text-slate-600 text-xs min-w-[160px]">{observacao}</td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {hasAnexo ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAnexo((w as any).anexo_base64 || (w as any).arquivo_base64, (w as any).anexo_nome)}
                            title="Visualizar / Baixar Anexo"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#00194C] transition inline-flex items-center justify-center cursor-pointer active:scale-95 border border-slate-200"
                          >
                            <span className="material-symbols-outlined text-[18px]">attach_file</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-slate-500 whitespace-nowrap">
                        {w.lastUpdateDate ? new Date(w.lastUpdateDate + 'T00:00:00').toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-4 text-[11px] text-slate-600 font-medium whitespace-nowrap">
                        {w.registeredBy || "Almoxarife"}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-3 py-1 text-[10px] font-extrabold uppercase rounded-full ${status.colorClass}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(w)}
                            title="Editar"
                            className="p-1.5 px-2.5 rounded-lg bg-transparent border border-[#00194C] text-[#00194C] hover:bg-[#E8EDF5] transition flex items-center gap-1 text-xs font-bold active:scale-95 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(w.id)}
                            title="Excluir"
                            className="p-1.5 px-2.5 rounded-lg bg-transparent border border-[#F11E26] text-[#F11E26] hover:bg-[#FEE8E8] transition flex items-center gap-1 text-xs font-bold active:scale-95 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-20 px-4 space-y-4 bg-slate-50/50">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 border border-slate-200 shadow-inner select-none">
                <span className="material-symbols-outlined text-[28px]">search_off</span>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800">Nenhum registro de garantia encontrado</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-normal">
                  Não existem garantias registradas para os filtros configurados. Tente alterar ou ampliar suas seleções acima.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row counter info footer */}
      {!isLoading && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
            Total de Registros Encontrados: <strong className="text-[#1B2A4A] text-xs font-black font-mono">{filteredWarranties.length}</strong>
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            * Dados sincronizados diretamente com o banco de dados principal de auditoria.
          </span>
        </div>
      )}

      {/* Edit Warranty Modal for Auditor */}
      {editingWarranty && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="p-4 px-6 bg-[#00194C] text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Editar Item de Garantia
              </h3>
              <button
                type="button"
                onClick={() => setEditingWarranty(null)}
                className="text-white/70 hover:text-white p-1 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-[11px] font-bold text-[#1B2A4A] mb-1">Código do Item</label>
                <input
                  type="text"
                  required
                  value={editForm.itemCode}
                  onChange={(e) => setEditForm((p) => ({ ...p, itemCode: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1B2A4A] mb-1">Descrição do Item</label>
                <input
                  type="text"
                  required
                  value={editForm.itemDescription}
                  onChange={(e) => setEditForm((p) => ({ ...p, itemDescription: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1B2A4A] mb-1">Fabricante</label>
                  <input
                    type="text"
                    value={editForm.manufacturer}
                    onChange={(e) => setEditForm((p) => ({ ...p, manufacturer: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1B2A4A] mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    required
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm((p) => ({ ...p, expiryDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1B2A4A] mb-1">Almoxarifado</label>
                <select
                  value={editForm.almoxarifado}
                  onChange={(e) => setEditForm((p) => ({ ...p, almoxarifado: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1B2A4A] bg-white font-bold"
                >
                  {allBranches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingWarranty(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#00194C] hover:bg-[#001033] text-white font-bold text-xs shadow-sm active:scale-95 transition cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
