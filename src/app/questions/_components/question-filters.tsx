"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTransition, useRef } from "react";
import Link from "next/link";

interface Discipline { id: number; name: string }

export function QuestionFilters({ disciplines }: { disciplines: Discipline[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlSearch = searchParams.get("q") ?? "";

  const hasFilters = searchParams.get("discipline") || searchParams.get("audited") || searchParams.get("q") || searchParams.get("type");

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate("q", value), 350);
  }

  return (
    <div className="filter-bar" style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s" }}>
      <select
        className="form-select"
        value={searchParams.get("discipline") ?? ""}
        onChange={(e) => navigate("discipline", e.target.value)}
      >
        <option value="">Todas as disciplinas</option>
        {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      <select
        className="form-select"
        value={searchParams.get("type") ?? ""}
        onChange={(e) => navigate("type", e.target.value)}
      >
        <option value="">Todos os tipos</option>
        <option value="objetiva">Objetiva</option>
        <option value="verdadeiro_falso">V ou F</option>
        <option value="dissertativa">Dissertativa</option>
      </select>

      <select
        className="form-select"
        value={searchParams.get("audited") ?? ""}
        onChange={(e) => navigate("audited", e.target.value)}
      >
        <option value="">Todos os status</option>
        <option value="0">Rascunho</option>
        <option value="1">Auditada</option>
      </select>

      <input
        key={urlSearch}
        className="form-input"
        placeholder="Buscar enunciado…"
        defaultValue={urlSearch}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {hasFilters && <Link href="/questions" className="btn btn-ghost">Limpar</Link>}
    </div>
  );
}
