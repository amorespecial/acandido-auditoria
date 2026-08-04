import React, { useState } from "react";
import { CollaboratorCertificate, CriterionState } from "../types";
import { getCollaboratorsForBranch } from "../mockData";
import { dbBuscarCertificados, dbSalvarCertificado, dbFetchUnimobinFieldConfig, isSupabaseReady } from "../supabaseService";
import { getOrderedFields, BUILTIN_UNIMOBIN_FIELDS, isFieldRequired } from "../utils/fieldOrdering";

interface AlmoxarifeUnimobinProps {
  onBack: () => void;
  onSubmitEvidence: (criterionId: string, comments: string, photos: string[]) => Promise<void> | void;
  criterionState?: CriterionState;
  branchId?: string;
  branchName?: string;
  activeMonth?: string;
  activeYear?: string;
}

export default function AlmoxarifeUnimobin({
  onBack,
  onSubmitEvidence,
  criterionState,
  branchId,
  branchName,
  activeMonth,
  activeYear,
}: AlmoxarifeUnimobinProps) {
  // Safe Fallback Parsing for month/year to guarantee independent scoping under all flows
  const cycleStateParsed = (() => {
    try {
      const saved = localStorage.getItem("acandido_cycle_state_manual");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          activeMonth: parsed.activeMonth || activeMonth || "Janeiro",
          activeYear: parsed.activeYear || activeYear || "2026"
        };
      }
    } catch {}
    return { activeMonth: activeMonth || "Janeiro", activeYear: activeYear || "2026" };
  })();

  const currentMonth = cycleStateParsed.activeMonth;
  const currentYear = cycleStateParsed.activeYear;

  const [unimobinConfig, setUnimobinConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("acandido_unimobin_fields_config");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { certificado: true, customFields: [] as any[] };
  });

  const [customFormValues, setCustomFormValues] = useState<Record<string, Record<string, string>>>({});

  React.useEffect(() => {
    let active = true;
    const loadRemoteConfig = async () => {
      try {
        const remoteCfg = await dbFetchUnimobinFieldConfig();
        if (remoteCfg && typeof remoteCfg === "object" && active) {
          setUnimobinConfig(remoteCfg);
        }
      } catch (e) {
        console.warn("Error fetching remote unimobin field config:", e);
      }
    };

    loadRemoteConfig();

    const handleStorage = () => {
      loadRemoteConfig();
      try {
        const saved = localStorage.getItem("acandido_unimobin_fields_config");
        if (saved) setUnimobinConfig(JSON.parse(saved));
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

  const [certs, setCerts] = useState<CollaboratorCertificate[]>(() => {
    const baseCerts = getCollaboratorsForBranch(branchId, branchName);
    const isSentGlobal = criterionState?.status === "OK" || criterionState?.status === "ENVIADO";
    return baseCerts.map((baseC) => ({
      ...baseC,
      status: isSentGlobal ? ("Certificado enviado" as const) : baseC.status,
    }));
  });

  React.useEffect(() => {
    let active = true;
    const loadCerts = async () => {
      if (!branchId) return;
      
      let dbCerts: any[] = [];
      if (isSupabaseReady()) {
        try {
          dbCerts = await dbBuscarCertificados(branchId, currentMonth, currentYear);
        } catch (err) {
          console.error("Error loading certificates from Supabase:", err);
        }
      }
      
      if (dbCerts && dbCerts.length > 0 && active) {
        const isSentGlobal = criterionState?.status === "OK" || criterionState?.status === "ENVIADO";
        setCerts((prev) => {
          return prev.map((c) => {
            const match = dbCerts.find(
              (db) => db.colaborador_nome.toLowerCase().trim() === c.name.toLowerCase().trim()
            );
            if (match) {
              return {
                ...c,
                status: (isSentGlobal ? "Certificado enviado" : match.status) as CollaboratorCertificate['status'],
                fileName: match.file_name,
                fileType: match.file_type,
                fileData: match.file_data,
                uploadedAt: match.uploaded_at
              };
            }
            return c;
          });
        });
      }
    };
    loadCerts();
    return () => {
      active = false;
    };
  }, [branchId, currentMonth, currentYear, criterionState]);

  React.useEffect(() => {
    if (!branchId || !isSupabaseReady()) return;
    try {
      certs.forEach((c) => {
        dbSalvarCertificado(branchId, currentMonth, currentYear, c.name, {
          status: c.status,
          fileName: c.fileName || null,
          fileType: c.fileType || null,
          fileData: c.fileData || null,
          uploadedAt: c.uploadedAt || new Date().toISOString()
        }).catch((err) => console.error("Error background saving certificate:", err));
      });
    } catch (e) {
      console.error("Error saving certs to Supabase on change:", e);
    }
  }, [certs, branchId, currentMonth, currentYear]);

  React.useEffect(() => {
    const handleRealtime = async () => {
      if (!branchId || !isSupabaseReady()) return;
      try {
        const dbCerts = await dbBuscarCertificados(branchId, currentMonth, currentYear);
        if (dbCerts && dbCerts.length > 0) {
          const isSentGlobal = criterionState?.status === "OK" || criterionState?.status === "ENVIADO";
          setCerts((prev) =>
            prev.map((c) => {
              const match = dbCerts.find(
                (db) => db.colaborador_nome.toLowerCase().trim() === c.name.toLowerCase().trim()
              );
              if (match) {
                return {
                  ...c,
                  status: (isSentGlobal ? "Certificado enviado" : match.status) as CollaboratorCertificate['status'],
                  fileName: match.file_name,
                  fileType: match.file_type,
                  fileData: match.file_data,
                  uploadedAt: match.uploaded_at
                };
              }
              return c;
            })
          );
        }
      } catch (err) {
        console.error("Error loading certificates on realtime event:", err);
      }
    };
    window.addEventListener("realtime-unimobin-certificados-update", handleRealtime);
    return () => {
      window.removeEventListener("realtime-unimobin-certificados-update", handleRealtime);
    };
  }, [branchId, currentMonth, currentYear, criterionState]);

  const [isSending, setIsSending] = useState(false);

  const handleFileChange = (id: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("Erro: O arquivo excede o limite máximo de 10 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setCerts((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              status: "Certificado enviado" as const,
              uploadedAt: new Date().toLocaleDateString("pt-BR"),
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileData: base64
            };
          }
          return item;
        })
      );
    };
    reader.readAsDataURL(file);
  };

  const handleViewFile = (cert: CollaboratorCertificate) => {
    let fileData = cert.fileData;
    if (!fileData || fileData === "placeholder-heavy-data") {
      // Generate standard visual certificate mockup
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(0, 0, 800, 600);
        
        ctx.strokeStyle = "#1B2A4A";
        ctx.lineWidth = 15;
        ctx.strokeRect(20, 20, 760, 560);
        
        ctx.strokeStyle = "#C8A84B";
        ctx.lineWidth = 4;
        ctx.strokeRect(35, 35, 730, 530);
        
        ctx.fillStyle = "#1B2A4A";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CERTIFICADO DE TREINAMENTO", 400, 150);
        
        ctx.fillStyle = "#64748B";
        ctx.font = "italic 16px sans-serif";
        ctx.fillText("Este documento certifica que o colaborador", 400, 210);
        
        ctx.fillStyle = "#1B2A4A";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(cert.name, 400, 275);
        
        ctx.fillStyle = "#64748B";
        ctx.font = "16px sans-serif";
        ctx.fillText("concluiu com êxito o treinamento corporativo", 400, 335);
        
        ctx.fillStyle = "#1B2A4A";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("CURSO UNIMOBIN - OPERAÇÃO DE ALMOXARIFADO", 400, 375);
        
        ctx.fillStyle = "#94A3B8";
        ctx.font = "12px monospace";
        ctx.fillText(`ID de Registro: ${cert.id.toUpperCase()}`, 400, 440);
        ctx.fillText(`Data de Envio: ${cert.uploadedAt || new Date().toLocaleDateString("pt-BR")}`, 400, 465);
        
        ctx.fillStyle = "#1B2A4A";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Grupo A. Cândido • Validação de Frotas", 400, 520);
      }
      fileData = canvas.toDataURL("image/png");
    }

    const newTab = window.open();
    if (newTab) {
      newTab.document.write(
        `<html><head><title>Certificado - ${cert.name}</title></head>` +
        `<body style="margin: 0; display: flex; align-items: center; justify-content: center; background: #1E293B; font-family: sans-serif;">` +
        `<div style="max-width: 90%; text-align: center; color: white;">` +
        `<p style="font-size: 14px; margin-bottom: 10px; font-weight: bold;">Certificado Digital Carregado</p>` +
        `<img src="${fileData}" style="max-width: 100%; max-height: 85vh; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" />` +
        `<p style="font-size: 11px; margin-top: 10px; color: #94A3B8;">Arquivo Origem: ${cert.fileName || "documento.pdf"}</p>` +
        `</div></body></html>`
      );
      newTab.document.close();
    } else {
      alert("Bloqueador de pop-ups ativo. Por favor, permita pop-ups para visualizar o arquivo.");
    }
  };

  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const handleCompleteSend = async () => {
    setShowFieldErrors(true);

    const isCertReq = isFieldRequired({ id: "certificado", name: "Certificado", builtIn: true }, unimobinConfig);
    if (isCertReq) {
      const missingCert = certs.some((c) => c.status !== "Certificado enviado" || !c.fileName);
      if (missingCert) {
        return;
      }
    }

    if (unimobinConfig.customFields && unimobinConfig.customFields.length > 0) {
      const missingCustom = certs.some((c) =>
        unimobinConfig.customFields.some((cf: any) => isFieldRequired(cf, unimobinConfig) && !customFormValues[c.id]?.[cf.id]?.trim())
      );
      if (missingCustom) {
        return;
      }
    }

    setIsSending(true);
    try {
      if (isSupabaseReady() && branchId) {
        // 1. Persist each collaborator's certificate in database securely
        await Promise.all(
          certs.map((c) =>
            dbSalvarCertificado(branchId, currentMonth, currentYear, c.name, {
              status: c.status,
              fileName: c.fileName || null,
              fileType: c.fileType || null,
              fileData: c.fileData || null,
              uploadedAt: c.uploadedAt || new Date().toLocaleDateString("pt-BR")
            })
          )
        );

        // 2. Confirm persistence from backend before considering success (Bug 2 requirement)
        const dbData = await dbBuscarCertificados(branchId, currentMonth, currentYear);
        if (!dbData || dbData.length === 0) {
          throw new Error("Persistência não confirmada.");
        }
      }

      const completedCount = certs.filter((c) => c.status === "Certificado enviado").length;
      const totalCollabs = certs.length;

      const summaryNote = `Certificados do Curso Unimobin anexados. Proporção de conclusão: ${completedCount}/${totalCollabs} colaboradores devidamente certificados.`;

      // 3. Submit back up to main app state and close subscreen
      await onSubmitEvidence("6", summaryNote, []);
      onBack();
    } catch (e: any) {
      console.error("Error confirming and completing certificate send:", e);
      const detailMsg = e?.message || e?.details || "Erro de conexão com o banco de dados";
      alert(`Erro de sincronização no Supabase: ${detailMsg}. Por favor, tente novamente.`);
    } finally {
      setIsSending(false);
    }
  };

  const isFinalized = criterionState?.status === "OK" || criterionState?.status === "ENVIADO";

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
          <h2 className="text-xl font-black text-[#1B2A4A] leading-tight">06 - Curso Unimobin</h2>
          <p className="text-xs text-slate-400 mt-0.5">Certificação e Capacitação Operacional</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[11px] leading-relaxed text-[#1B2A4A]">
        <p className="font-bold">Colaboradores do Almoxarifado</p>
        <p className="text-slate-600 mt-1">
          Todos os colaboradores atuantes devem concluir o curso corporativo obrigatório Unimobin. Faça o upload direto dos certificados correspondentes para liberação do ciclo de avaliação.
        </p>
      </div>

      {/* Collaborator certifications checklist */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Colaboradores de {branchName?.replace("ALMOXARIFADO ", "")}</h3>

        <div className="space-y-3">
          {certs.map((c) => {
            const hasFile = c.status === "Certificado enviado" && c.fileName;
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-150 rounded-xl p-4 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-extrabold text-[#1B2A4A]">{c.name}</h4>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {c.status === "Certificado enviado" ? "✅ Certificado enviado" : "⏳ Aguardando envio"}
                      {c.uploadedAt ? ` (${c.uploadedAt})` : ""}
                    </p>
                  </div>
                </div>

                {/* Dynamic Ordered Fields for Collaborator */}
                {getOrderedFields(unimobinConfig, BUILTIN_UNIMOBIN_FIELDS).map((field) => {
                  if (field.id === "certificado") {
                    if (unimobinConfig.certificado === false) return null;
                    const isCertReq = isFieldRequired({ id: "certificado", name: "Certificado", builtIn: true }, unimobinConfig);
                    const hasCertErr = isCertReq && !hasFile && showFieldErrors;
                    return (
                      <React.Fragment key="certificado">
                        {hasFile ? (
                          <div className="flex items-center justify-between bg-emerald-50/50 border border-emerald-150 p-2.5 rounded-lg text-xs font-semibold">
                            <div className="flex items-center gap-2 text-emerald-900 min-w-0">
                              <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">description</span>
                              <span className="truncate font-mono text-[10.5px]" title={c.fileName}>
                                {c.fileName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleViewFile(c)}
                                className="py-1 px-2.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200 rounded text-[9.5px] font-bold transition-all"
                              >
                                Visualizar
                              </button>
                              {!isFinalized && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCerts((prev) =>
                                      prev.map((item) => {
                                        if (item.id === c.id) {
                                          return {
                                            ...item,
                                            status: "Aguardando envio" as const,
                                            uploadedAt: undefined,
                                            fileName: undefined,
                                            fileSize: undefined,
                                            fileType: undefined,
                                            fileData: undefined
                                          };
                                        }
                                        return item;
                                      })
                                    );
                                  }}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                  title="Remover arquivo"
                                >
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            {!isFinalized ? (
                              <div className={`border-2 border-dashed ${hasCertErr ? "border-[#F11E26]" : "border-slate-200"} hover:border-indigo-400 rounded-lg p-4 bg-slate-50 transition-all text-center flex flex-col items-center justify-center space-y-1.5`}>
                                <span className="material-symbols-outlined text-[20px] text-slate-400">attach_file</span>
                                <div className="text-[10px] text-slate-500 font-semibold leading-normal">
                                  <p className="font-bold text-[#1B2A4A]">Anexar certificado do colaborador{isCertReq && <span className="text-[#F11E26]"> *</span>}</p>
                                  <p className="text-slate-400 text-[9px]">JPG, PNG ou PDF • máx. 10 MB</p>
                                </div>
                                <label className="cursor-pointer bg-white hover:bg-slate-100 border border-slate-200 text-[#1B2A4A] py-1 px-3 rounded text-[9.5px] font-black transition-all shadow-3xs active:scale-95 inline-block">
                                  Escolher arquivo
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileChange(c.id, file);
                                    }}
                                  />
                                </label>
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-slate-100 p-2.5 rounded text-center text-[10px] text-slate-400 italic">
                                Item bloqueado para edição (Auditado/Enviado)
                              </div>
                            )}
                            {hasCertErr && (
                              <p className="text-[11px] text-[#F11E26] font-medium mt-0.5">Este campo é obrigatório</p>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  }

                  if (!field.builtIn) {
                    const isCFReq = isFieldRequired(field, unimobinConfig);
                    const val = customFormValues[c.id]?.[field.id] || "";
                    const hasCFErr = isCFReq && !val.trim() && showFieldErrors;
                    return (
                      <div key={field.id} className="space-y-1 mt-2">
                        <label className="text-[10px] font-extrabold text-[#1B2A4A] uppercase tracking-wider block">
                          {field.name}{isCFReq && <span className="text-[#F11E26]"> *</span>}
                        </label>
                        {field.type === "select" ? (
                          <select
                            value={val}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCustomFormValues(prev => ({
                                ...prev,
                                [c.id]: { ...(prev[c.id] || {}), [field.id]: value }
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
                                [c.id]: { ...(prev[c.id] || {}), [field.id]: value }
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
            );
          })}
        </div>
      </section>

      {/* Big Action Button */}
      {!isFinalized ? (
        <button
          onClick={handleCompleteSend}
          disabled={isSending}
          className="w-full bg-[#1B2A4A] active:bg-[#0F172B] text-white py-3 rounded-lg text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Transmitindo Certificados...</span>
            </>
          ) : (
            <>
              <span>Confirmar Envio do Tópico 06</span>
              <span className="material-symbols-outlined text-[16px]">send</span>
            </>
          )}
        </button>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-4 rounded-xl text-center flex items-center justify-center gap-2 shadow-sm animate-fade-in">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <span>Certificados transmitidos com sucesso. Aguardando auditoria.</span>
        </div>
      )}
    </div>
  );
}
