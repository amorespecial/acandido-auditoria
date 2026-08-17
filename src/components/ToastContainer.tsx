import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { toastManager, ToastItem, ToastType } from "../utils/toast";

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[999999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full px-3 sm:px-0 pointer-events-none"
      id="toast-global-container"
      role="region"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => toastManager.dismiss(t.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ item: ToastItem; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const getStyle = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-white border-emerald-500/30 text-slate-800 shadow-emerald-950/10",
          iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/60",
          bar: "bg-emerald-500",
          badge: "bg-emerald-100 text-emerald-800",
          title: "Sucesso",
          Icon: CheckCircle2,
        };
      case "error":
        return {
          bg: "bg-white border-rose-500/30 text-slate-800 shadow-rose-950/10",
          iconBg: "bg-rose-50 text-rose-600 border border-rose-200/60",
          bar: "bg-rose-500",
          badge: "bg-rose-100 text-rose-800",
          title: "Atenção",
          Icon: AlertCircle,
        };
      case "warning":
        return {
          bg: "bg-white border-amber-500/30 text-slate-800 shadow-amber-950/10",
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200/60",
          bar: "bg-amber-500",
          badge: "bg-amber-100 text-amber-800",
          title: "Aviso",
          Icon: AlertTriangle,
        };
      case "info":
      default:
        return {
          bg: "bg-white border-blue-500/30 text-slate-800 shadow-blue-950/10",
          iconBg: "bg-blue-50 text-blue-600 border border-blue-200/60",
          bar: "bg-blue-500",
          badge: "bg-blue-100 text-blue-800",
          title: "Informação",
          Icon: Info,
        };
    }
  };

  const config = getStyle(item.type);
  const IconComponent = config.Icon;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border shadow-xl transition-all duration-200 transform translate-y-0 opacity-100 backdrop-blur-md relative overflow-hidden animate-in fade-in slide-in-from-top-3 ${config.bg}`}
      style={{
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)"
      }}
    >
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.iconBg}`}>
        <IconComponent className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${config.badge}`}>
            {config.title}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-700 leading-snug whitespace-pre-line break-words">
          {item.message}
        </p>
      </div>

      <button
        onClick={onDismiss}
        className="shrink-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        type="button"
        title="Fechar notificação"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Decorative progress accent */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 ${config.bar} opacity-80`}
      />
    </div>
  );
};
