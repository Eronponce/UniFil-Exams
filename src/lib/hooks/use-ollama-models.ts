"use client";

import { useState, useEffect } from "react";

export function useOllamaModels(active: boolean) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const data = await fetch("/api/ollama/models").then((r) => r.json() as Promise<{ models: string[]; error?: string }>);
        if (cancelled) return;
        setModels(data.models ?? []);
        if (data.error) setError(data.error);
      } catch {
        if (!cancelled) setError("Ollama offline");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { models, loading, error };
}
