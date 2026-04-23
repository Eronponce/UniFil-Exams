"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";

interface Discipline { id: number; name: string }

export function AuditFilters({ disciplines }: { disciplines: Discipline[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
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
      {searchParams.get("discipline") && <Link href="/audit" className="btn btn-ghost">Limpar</Link>}
    </div>
  );
}
