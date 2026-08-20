"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";

interface Props {
  areas: string[];
  selectedAreas: string[];
  onChange: (areas: string[]) => void;
  label?: string;
  /** Keep the historical checkbox panel by default; callers may opt into a compact native dropdown. */
  presentation?: "checkboxes" | "dropdown";
  compact?: boolean;
  /** Parent-owned navigation context used to reset optimistic state on discipline changes. */
  syncKey?: string;
}

/** Compact, touch-friendly checkbox panel for the thematic-area union filter. */
export function ThematicAreaFilter({
  areas,
  selectedAreas,
  onChange,
  label = "Áreas temáticas",
  presentation = "checkboxes",
  compact = false,
  syncKey = "",
}: Props) {
  const options = [...new Set(areas.map((area) => area.trim()).filter(Boolean))];
  const normalizedSelectedAreas = normalizeThematicAreas(selectedAreas);
  const optionsKey = options.slice().sort().join("\u0000");
  const [localSelectedAreas, setLocalSelectedAreas] = useState(normalizedSelectedAreas);
  const [pendingSelectionKey, setPendingSelectionKey] = useState<string | null>(null);
  const previousOptionsKeyRef = useRef(optionsKey);
  const previousSyncKeyRef = useRef(syncKey);

  function selectionKey(nextAreas: readonly string[]): string {
    return normalizeThematicAreas(nextAreas).slice().sort().join("\u0000");
  }

  useEffect(() => {
    const incoming = normalizeThematicAreas(selectedAreas);
    const incomingKey = selectionKey(incoming);
    const optionsChanged = previousOptionsKeyRef.current !== optionsKey;
    const contextChanged = previousSyncKeyRef.current !== syncKey;
    previousOptionsKeyRef.current = optionsKey;
    previousSyncKeyRef.current = syncKey;

    // A filter navigation can leave props one render behind. Keep the latest
    // optimistic selection until the router acknowledges that exact set; a
    // changed option universe (discipline/filter) is an intentional reset.
    if (contextChanged || optionsChanged || pendingSelectionKey === null || pendingSelectionKey === incomingKey) {
      setPendingSelectionKey(null);
      setLocalSelectedAreas(incoming);
    }
  }, [optionsKey, pendingSelectionKey, selectedAreas, syncKey]);

  function commitSelection(nextAreas: readonly string[]): void {
    const normalized = normalizeThematicAreas(nextAreas);
    setPendingSelectionKey(selectionKey(normalized));
    setLocalSelectedAreas(normalized);
    onChange(normalized);
  }

  if (options.length === 0 && localSelectedAreas.length === 0) return null;

  const selected = new Set(localSelectedAreas);
  function toggle(area: string) {
    const next = new Set(selected);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    commitSelection(options.filter((item) => next.has(item)));
  }

  if (presentation === "dropdown" || compact) {
    return (
      <details className="thematic-area-filter thematic-area-filter--dropdown">
        <summary className="thematic-area-filter-dropdown-summary">
          <span>{label}</span>
          <span className="thematic-area-filter-dropdown-value">
            {selected.size === 0 ? "Todas" : `${selected.size} selecionada${selected.size === 1 ? "" : "s"}`}
          </span>
        </summary>
        <fieldset className="thematic-area-filter-dropdown-options">
          <legend className="sr-only">{label}</legend>
          <div className="thematic-area-filter-dropdown-actions">
            <span aria-live="polite">{selected.size} selecionada{selected.size === 1 ? "" : "s"}</span>
            {selected.size > 0 && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => commitSelection([])}>
                Limpar
              </button>
            )}
          </div>
          {options.length === 0 ? (
            <span className="thematic-area-filter-empty">Área selecionada não está disponível neste filtro.</span>
          ) : options.map((area, index) => (
            <label key={area} htmlFor={`thematic-area-dropdown-${index}`}>
              <input
                id={`thematic-area-dropdown-${index}`}
                type="checkbox"
                checked={selected.has(area)}
                onChange={() => toggle(area)}
                aria-label={`Selecionar área temática ${area}`}
              />
              <span>{area}</span>
            </label>
          ))}
        </fieldset>
      </details>
    );
  }

  return (
    <fieldset style={{ minWidth: 0, maxWidth: 460, border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem 0.65rem", margin: 0 }}>
      <legend style={{ padding: "0 0.2rem", fontSize: "0.8rem", fontWeight: 600 }}>{label}</legend>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.35rem" }}>
        <span aria-live="polite" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{selected.size} selecionada{selected.size === 1 ? "" : "s"}</span>
        {selected.size > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => commitSelection([])}>
            Limpar
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 0.75rem", maxHeight: 132, overflowY: "auto" }}>
        {options.length === 0 ? (
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Área selecionada não está disponível neste filtro.</span>
        ) : options.map((area, index) => (
          <label key={area} htmlFor={`thematic-area-${index}`} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.84rem", cursor: "pointer", minHeight: 28, maxWidth: "100%" }}>
            <input id={`thematic-area-${index}`} type="checkbox" checked={selected.has(area)} onChange={() => toggle(area)} aria-label={`Selecionar área temática ${area}`} />
            <span>{area}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
