"use client";

import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";

interface Props {
  areas: string[];
  selectedAreas: string[];
  onChange: (areas: string[]) => void;
  label?: string;
}

/** Compact, touch-friendly checkbox panel for the thematic-area union filter. */
export function ThematicAreaFilter({ areas, selectedAreas, onChange, label = "Áreas temáticas" }: Props) {
  const options = [...new Set(areas.map((area) => area.trim()).filter(Boolean))];
  const normalizedSelectedAreas = normalizeThematicAreas(selectedAreas);
  if (options.length === 0 && normalizedSelectedAreas.length === 0) return null;

  const selected = new Set(normalizedSelectedAreas);
  function toggle(area: string) {
    const next = new Set(selected);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    onChange(options.filter((item) => next.has(item)));
  }

  return (
    <fieldset style={{ minWidth: 0, maxWidth: 460, border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem 0.65rem", margin: 0 }}>
      <legend style={{ padding: "0 0.2rem", fontSize: "0.8rem", fontWeight: 600 }}>{label}</legend>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.35rem" }}>
        <span aria-live="polite" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{selected.size} selecionada{selected.size === 1 ? "" : "s"}</span>
        {selected.size > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange([])}>
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
