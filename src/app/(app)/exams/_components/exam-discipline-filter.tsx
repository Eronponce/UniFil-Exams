"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { ThematicAreaFilter } from "@/components/thematic-area-filter";
import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";

interface Discipline { id: number; name: string }

export function ExamDisciplineFilter({
  disciplines,
  areas,
  selectedAreas,
}: {
  disciplines: Discipline[];
  areas: string[];
  selectedAreas: string[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // When discipline changes, reset area
    if (key === "discipline") params.delete("area");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function setAreas(nextAreas: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("area");
    for (const area of nextAreas) params.append("area", area);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const hasDiscipline = !!searchParams.get("discipline");

  return (
    <div style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s" }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Disciplina *</label>
          <select
            className="form-select"
            value={searchParams.get("discipline") ?? ""}
            onChange={(e) => navigate("discipline", e.target.value)}
          >
            <option value="">Selecione para ver questões…</option>
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <ThematicAreaFilter areas={areas} selectedAreas={normalizeThematicAreas(selectedAreas)} onChange={setAreas} />
        </div>
      </div>

      {hasDiscipline && (
        <Link href="/exams" className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>Limpar</Link>
      )}
    </div>
  );
}
