"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import { ThematicAreaFilter } from "@/components/thematic-area-filter";
import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";

interface Discipline { id: number; name: string }

export function QuestionFilters({ disciplines, areas = [] }: { disciplines: Discipline[]; areas?: string[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedAreas = normalizeThematicAreas(searchParams.getAll("area"));
  const withoutArea = searchParams.get("withoutArea") === "1";
  const urlSearch = searchParams.get("q") ?? "";
  const hasFilters = searchParams.get("discipline") || searchParams.get("audited") || searchParams.get("rejected") || urlSearch || searchParams.get("type") || selectedAreas.length > 0 || withoutArea;

  function replace(params: URLSearchParams) {
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key === "discipline") params.delete("area");
    replace(params);
  }

  function setAreas(nextAreas: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("area");
    for (const area of nextAreas) params.append("area", area);
    if (nextAreas.length > 0) params.delete("withoutArea");
    replace(params);
  }

  function toggleWithoutArea() {
    const params = new URLSearchParams(searchParams.toString());
    if (withoutArea) {
      params.delete("withoutArea");
    } else {
      params.set("withoutArea", "1");
      params.delete("area");
    }
    replace(params);
  }

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate("q", value), 350);
  }

  return (
    <div className="filter-bar" style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s" }}>
      <select className="form-select" value={searchParams.get("discipline") ?? ""} onChange={(event) => navigate("discipline", event.target.value)}>
        <option value="">Todas as disciplinas</option>
        {disciplines.map((discipline) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}
      </select>

      <select className="form-select" value={searchParams.get("type") ?? ""} onChange={(event) => navigate("type", event.target.value)}>
        <option value="">Todos os tipos</option>
        <option value="objetiva">Objetiva</option>
        <option value="verdadeiro_falso">V ou F</option>
        <option value="numerica">Numérica</option>
        <option value="dissertativa">Dissertativa</option>
      </select>

      <ThematicAreaFilter areas={areas} selectedAreas={selectedAreas} onChange={setAreas} />

      <button
        type="button"
        className={withoutArea ? "btn btn-primary" : "btn btn-ghost"}
        aria-pressed={withoutArea}
        onClick={toggleWithoutArea}
      >
        Sem área temática
      </button>

      <select
        className="form-select"
        value={searchParams.get("rejected") === "1" ? "rejected" : (searchParams.get("audited") ?? "")}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === "rejected") {
            params.set("rejected", "1");
            params.delete("audited");
          } else {
            params.delete("rejected");
            if (event.target.value) params.set("audited", event.target.value);
            else params.delete("audited");
          }
          replace(params);
        }}
      >
        <option value="">Todos os status</option>
        <option value="0">Rascunho</option>
        <option value="1">Auditada</option>
        <option value="rejected">Recusada</option>
      </select>

      <input key={urlSearch} className="form-input" placeholder="Buscar enunciado…" defaultValue={urlSearch} onChange={(event) => handleSearch(event.target.value)} />
      {hasFilters && <Link href="/questions" className="btn btn-ghost">Limpar</Link>}
    </div>
  );
}
