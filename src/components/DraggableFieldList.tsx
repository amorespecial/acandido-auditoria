import React, { useState } from "react";
import { ConfigFieldItem, isFieldRequired } from "../utils/fieldOrdering";

interface DraggableFieldListProps {
  fields: ConfigFieldItem[];
  onReorder: (newFields: ConfigFieldItem[]) => void;
  configState?: any;
  onToggleField?: (fieldId: string, checked: boolean) => void;
  onToggleRequired?: (fieldId: string, checked: boolean) => void;
  onDeleteCustomField?: (field: ConfigFieldItem) => void;
  onNameChange?: (fieldId: string, newName: string) => void;
  title?: string;
  subtitle?: string;
}

export function DraggableFieldList({
  fields,
  onReorder,
  configState,
  onToggleField,
  onToggleRequired,
  onDeleteCustomField,
  onNameChange,
  title,
  subtitle,
}: DraggableFieldListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= fields.length || toIndex >= fields.length) {
      return;
    }
    const updated = [...fields];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onReorder(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromStr = e.dataTransfer.getData("text/plain");
    const fromIndex = fromStr ? parseInt(fromStr, 10) : draggedIndex;
    if (fromIndex !== null && !isNaN(fromIndex)) {
      moveItem(fromIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-3 font-sans">
      {(title || subtitle) && (
        <div className="mb-2">
          {title && <span className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider block font-sans">{title}</span>}
          {subtitle && <span className="text-[10px] text-slate-400 font-medium block font-sans">{subtitle}</span>}
        </div>
      )}

      <div className="space-y-2">
        {fields.map((field, idx) => {
          const isDragging = draggedIndex === idx;
          const isDragOver = dragOverIndex === idx;

          // Check toggle state: if configState is provided, read configState[field.id], else field.enabled
          let isEnabled = true;
          if (configState && field.id in configState) {
            isEnabled = configState[field.id] !== false;
          } else if (field.enabled !== undefined) {
            isEnabled = field.enabled !== false;
          }

          const isReq = isFieldRequired(field, configState);

          return (
            <div
              key={field.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`bg-white border rounded-xl p-2.5 flex items-center justify-between shadow-xs transition-all select-none ${
                isDragging ? "opacity-40 border-dashed border-indigo-400 bg-indigo-50/50" : ""
              } ${isDragOver && !isDragging ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200/90 hover:border-slate-350"}`}
            >
              {/* Left side: Drag handle + Field name */}
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div
                  className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-[#1B2A4A] p-1 rounded hover:bg-slate-100 flex items-center justify-center shrink-0"
                  title="Arrastar para reordenar"
                >
                  <span className="font-bold text-base leading-none select-none">☰</span>
                </div>

                <div className="min-w-0">
                  {onNameChange && !field.builtIn ? (
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => onNameChange(field.id, e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-2 py-0.5 font-bold text-slate-800 text-xs rounded focus:outline-none focus:border-[#1B2A4A]"
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-800 block truncate">
                      {field.name}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {field.builtIn ? (
                      <span className="text-[8.5px] px-1.5 py-0.2 bg-slate-100 text-slate-500 font-extrabold rounded uppercase">
                        Fixo
                      </span>
                    ) : (
                      <span className="text-[8.5px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-extrabold rounded uppercase">
                        Personalizado ({field.type || "texto"})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right side: Controls & Move buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Enable toggle checkbox */}
                {onToggleField && (
                  <label className="flex items-center gap-1 cursor-pointer select-none bg-slate-50 px-2 py-1 rounded border border-slate-150 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => onToggleField(field.id, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-[9.5px] font-extrabold text-slate-600 uppercase tracking-wider font-sans">
                      {isEnabled ? "Exibir" : "Oculto"}
                    </span>
                  </label>
                )}

                {/* Required toggle checkbox */}
                {onToggleRequired && (
                  <label className={`flex items-center gap-1.5 cursor-pointer select-none px-2 py-1 rounded border transition-colors ${
                    isReq
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}>
                    <input
                      type="checkbox"
                      checked={isReq}
                      onChange={(e) => onToggleRequired(field.id, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-[9.5px] font-extrabold uppercase tracking-wider font-sans flex items-center gap-1">
                      <span className={isReq ? "text-amber-600 font-black text-xs" : "text-slate-400 font-black text-xs"}>
                        {isReq ? "●" : "○"}
                      </span>
                      Obrigatório
                    </span>
                  </label>
                )}

                {/* Move Up / Down Buttons */}
                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, idx - 1)}
                    className="p-1 text-slate-600 hover:text-[#1B2A4A] hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                    title="Mover para cima"
                  >
                    <span className="material-symbols-outlined text-[15px] leading-none">expand_less</span>
                  </button>
                  <button
                    type="button"
                    disabled={idx === fields.length - 1}
                    onClick={() => moveItem(idx, idx + 1)}
                    className="p-1 text-slate-600 hover:text-[#1B2A4A] hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                    title="Mover para baixo"
                  >
                    <span className="material-symbols-outlined text-[15px] leading-none">expand_more</span>
                  </button>
                </div>

                {/* Delete button for custom fields */}
                {onDeleteCustomField && !field.builtIn && (
                  <button
                    type="button"
                    onClick={() => onDeleteCustomField(field)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer"
                    title="Remover campo"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
