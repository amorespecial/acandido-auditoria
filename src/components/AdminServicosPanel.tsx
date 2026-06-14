import React, { useState, useEffect } from "react";
import { MaterialOccurrence, Branch } from "../types";
import { dbFetchOccurrences } from "../supabaseService";

interface AdminServicosPanelProps {
  branch?: Branch; // If provided, locks down to this specific branch!
  allBranches: Branch[];
}

export default function AdminServicosPanel({ branch, allBranches }: AdminServicosPanelProps) {
  const [occurrences, setOccurrences] = useState<MaterialOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedAlmoxarifado, setSelectedAlmoxarifado] = useState<string>("TODOS");
  const [selectedMonth, setSelectedMonth] = useState<string>("TODOS");
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedServiceType, setSelectedServiceType] = useState<string>("TODOS");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODOS");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Set selected almoxarifado when branch prop is passed or changed
  useEffect(() => {
    if (branch) {
      setSelectedAlmoxarifado(branch.id);
    }
  }, [branch]);

  // Fetch from DB
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await dbFetchOccurrences();
        setOccurrences(data || []);
      } catch (error) {
        console.error("Erro ao buscar serviços em tempo real:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Listen to other tab changes, branch switching, or supervisor panel updates
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("acandido_occurrences");
      if (saved) {
        try {
          setOccurrences(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse occurrences:", e);
        }
      }
    };
    
    // Trigger initially if stored in localStorage
    const saved = localStorage.getItem("acandido_occurrences");
    if (saved) {
      try {
        setOccurrences(JSON.parse(saved));
      } catch {}
    }

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const monthsList = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Helper functions
  const getServiceMonthAndYear = (dateStr: string) => {
    if (!dateStr) return { month: "Outro", year: "2026" };
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthNum = parseInt(parts[1], 10);
      const month = monthsList[monthNum - 1] || "Junho";
      return { month, year };
    }
    return { month: "Outro", year: "2026" };
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Translate status with rules:
  // - "RESOLVIDO", "Chegou", "Concluído", "CONCLUIDO" -> "Concluído"
  // - everything else -> "Pendente" (Note: "Em andamento" statuses are automatically Pendente on auditor view)
  const getServiceStatus = (statusStr: string) => {
    const s = (statusStr || "").toUpperCase().trim();
    if (s === "RESOLVIDO" || s === "CHEGOU" || s === "CONCLUÍDO" || s === "CONCLUIDO") {
      return {
        key: "CONCLUIDO",
        label: "✅ Concluído",
        colorClass: "bg-radial from-emerald-50 to-emerald-100/60 text-emerald-700 border border-emerald-200"
      };
    } else {
      return {
        key: "PENDENTE",
        label: "⏳ Pendente",
        colorClass: "bg-radial from-amber-50 to-amber-100/60 text-amber-700 border border-amber-200"
      };
    }
  };

  // Dynamic filter options extraction
  const availableServiceTypes = Array.from(
    new Set(occurrences.map((o) => o.material).filter(Boolean))
  ).sort();

  const availableYears = Array.from(
    new Set(
      occurrences.map((o) => {
        const { year } = getServiceMonthAndYear(o.date);
        return year;
      }).filter(Boolean)
    )
  ).sort((a: string, b: string) => b.localeCompare(a));

  if (!availableYears.includes("2026")) availableYears.push("2026");
  if (!availableYears.includes("2025")) availableYears.push("2025");
  availableYears.sort((a: string, b: string) => b.localeCompare(a));

  // Filter Occurrences
  const filteredOccurrences = occurrences.filter((occ) => {
    // 1. Almoxarifado Filter (if locked by branch prop, we restrict to branch.id)
    const targetAlmox = branch ? branch.id : selectedAlmoxarifado;
    if (targetAlmox !== "TODOS") {
      if (occ.branchId !== targetAlmox) {
        return false;
      }
    }

    const { month, year } = getServiceMonthAndYear(occ.date);

    // 2. Month-year Filter
    if (selectedMonth !== "TODOS" && month.toLowerCase() !== selectedMonth.toLowerCase()) {
      return false;
    }
    if (selectedYear !== "TODOS" && year !== selectedYear) {
      return false;
    }

    // 3. Service Type Filter
    if (selectedServiceType !== "TODOS" && occ.material !== selectedServiceType) {
      return false;
    }

    // 4. Status Filter
    const calcStatus = getServiceStatus(occ.status);
    if (selectedStatus !== "TODOS" && calcStatus.key !== selectedStatus) {
      return false;
    }

    // 5. Search Query (description / material or vehicle prefix)
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchMaterial = (occ.material || "").toLowerCase().includes(q);
      const matchVehicle = (occ.veiculo || "").toLowerCase().includes(q);
      const matchSolicitante = (occ.solicitante || "").toLowerCase().includes(q);
      if (!matchMaterial && !matchVehicle && !matchSolicitante) {
        return false;
      }
    }

    return true;
  });

  // Calculate stats based on filtered list (or all list depending on standard UI behavior - usually filtered is best!)
  const totalCount = filteredOccurrences.length;
  const pendenteCount = filteredOccurrences.filter((o) => getServiceStatus(o.status).key === "PENDENTE").length;
  const concluidoCount = filteredOccurrences.filter((o) => getServiceStatus(o.status).key === "CONCLUIDO").length;

  // Export to CSV
  const exportToCSV = () => {
    if (filteredOccurrences.length === 0) {
      alert("Nenhum registro encontrado para exportar.");
      return;
    }

    const headers = [
      "Almoxarifado",
      "Prefixo do Veiculo",
      "Servico",
      "Solicitante",
      "Data do Registro",
      "Mes de Referencia",
      "Status",
      "Codigo Material",
      "Observacao"
    ];

    const csvRows = [headers.join(";")];

    for (const o of filteredOccurrences) {
      const { month, year } = getServiceMonthAndYear(o.date);
      const statusObj = getServiceStatus(o.status);
      const statusText = statusObj.label.replace(/✅|⏳|🔄/, "").trim();

      const row = [
        `"${(o.branchName || o.filial || "").replace(/"/g, '""')}"`,
        `"${(o.veiculo || "").replace(/"/g, '""')}"`,
        `"${(o.material || "").replace(/"/g, '""')}"`,
        `"${(o.solicitante || "").replace(/"/g, '""')}"`,
        `"${formatDateBR(o.date)}"`,
        `"${month} ${year}"`,
        `"${statusText}"`,
        `"${o.codigoMaterial || ""}"`,
        `"${(o.obs || "").replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(";"));
    }

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const filename = branch 
      ? `servicos-${branch.name.toLowerCase().replace(/\s+/g, "-")}.csv`
      : "servicos-central-geral.csv";
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" id="central-servicos-view">
      {/* Header Banner */}
      <div className="p-6 bg-radial from-slate-900 via-slate-950/95 to-slate-950 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-405 text-[26px]">faucet</span>
            <span className="material-symbols-outlined text-amber-400 text-[26px]">build</span>
            <h2 className="text-lg font-black tracking-tight">🔧 Central de Serviços</h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            {branch 
              ? `Histórico de registros de serviços para a unidade ${branch.name}`
              : "Visão consolidada e controle de todos os registros de serviços lançados de todos os almoxarifados"}
          </p>
        </div>

        <button
          type="button"
          onClick={exportToCSV}
          disabled={filteredOccurrences.length === 0}
          className="bg-[#C8A85B] hover:bg-[#B6964E] text-[#1B2A4A] transition-all disabled:opacity-40 disabled:pointer-events-none px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Exportar CSV
        </button>
      </div>

      {/* Summary Cards Top */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-200 divide-x divide-y md:divide-y-0 divide-slate-100 bg-white">
        {/* Total */}
        <div className="p-5 flex flex-col justify-center items-center text-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Solicitados</span>
          <span className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalCount}</span>
        </div>
        
        {/* Pendentes */}
        <div className="p-5 flex flex-col justify-center items-center text-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Pendentes</span>
          <span className="text-2xl font-black text-amber-600 mt-1 font-mono flex items-center gap-1.5">
            {pendenteCount} <span className="text-base">⏳</span>
          </span>
        </div>

        {/* Concluídos */}
        <div className="p-5 flex flex-col justify-center items-center text-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Concluídos</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 font-mono flex items-center gap-1.5">
            {concluidoCount} <span className="text-base">✅</span>
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-5 bg-slate-50 border-b border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Almoxarifado Filter */}
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
                  <option key={b.id} value={b.id}>
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
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Mês de Referência</label>
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

          {/* Service Type Filter */}
          <div>
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Tipo de Serviço</label>
            <select
              value={selectedServiceType}
              onChange={(e) => setSelectedServiceType(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-705 mt-1 focus:ring-1 focus:ring-[#1B2A4A]"
            >
              <option value="TODOS">Todos os Serviços</option>
              {availableServiceTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Status do Serviço</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-705 mt-1 focus:ring-1 focus:ring-[#1B2A4A]"
            >
              <option value="TODOS">Todos os status</option>
              <option value="PENDENTE">⏳ Pendente</option>
              <option value="CONCLUIDO">✅ Concluído</option>
            </select>
          </div>
        </div>

        {/* Free Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-slate-400 text-[18px] absolute left-3.5 top-2.5">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descrição do serviço, prefixo do veículo ou solicitante..."
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

      {/* Tabela de Resultados */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-10 h-10 border-4 border-[#1B2A4A]/20 border-t-[#1B2A4A] rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500">Buscando registros de serviços...</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {filteredOccurrences.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 select-none">
                  {!branch && <th className="p-4 pl-6">Almoxarifado</th>}
                  <th className="p-4">Prefixo Veículo</th>
                  <th className="p-4">Serviço Solicitado</th>
                  <th className="p-4">Solicitante</th>
                  <th className="p-4">Data Registro</th>
                  <th className="p-4">Mês Referência</th>
                  <th className="p-4 pr-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold bg-white">
                {filteredOccurrences.map((occ) => {
                  const status = getServiceStatus(occ.status);
                  const { month, year } = getServiceMonthAndYear(occ.date);
                  return (
                    <tr key={occ.id} className="hover:bg-slate-50/40 transition-colors">
                      {!branch && (
                        <td className="p-4 pl-6 font-bold text-[#1B2A4A]">
                          {occ.branchName ? occ.branchName.replace("ALMOXARIFADO ", "") : (occ.filial || "—")}
                        </td>
                      )}
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold text-[11px] border border-slate-200">
                          🚘 {occ.veiculo || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{occ.material}</div>
                        {occ.obs && (
                          <div className="text-[10px] text-slate-400 font-medium limit-lines-1 mt-0.5" title={occ.obs}>
                            💬 Obs: {occ.obs}
                          </div>
                        )}
                        {occ.codigoMaterial && (
                          <span className="inline-block mt-1 text-[9px] bg-red-50 text-red-650 font-mono px-1.5 py-0.2 rounded font-bold border border-red-100">
                            Cód: {occ.codigoMaterial}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 font-bold uppercase">{occ.solicitante || "—"}</td>
                      <td className="p-4 font-mono text-slate-550">
                        {formatDateBR(occ.date)}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800">
                        {month} {year}
                      </td>
                      <td className="p-4 pr-6 text-center whitespace-nowrap">
                        <span className={`inline-block px-3 py-1 text-[10px] font-extrabold uppercase rounded-full ${status.colorClass}`}>
                          {status.label}
                        </span>
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
                <h4 className="text-sm font-black text-slate-800">Nenhum registro de serviço encontrado</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-normal">
                  Não existem serviços registrados para as seleções de filtros atuais. Revise ou altere a configuração acima.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Totalizer Footer */}
      {!isLoading && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
            Total de Resultados Encontrados: <strong className="text-[#1B2A4A] text-xs font-black font-mono">{filteredOccurrences.length}</strong>
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            * Dados sincronizados em tempo real com o histórico de ocorrências do nível de serviço.
          </span>
        </div>
      )}
    </div>
  );
}
