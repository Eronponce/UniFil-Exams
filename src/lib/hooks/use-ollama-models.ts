"use client";

import { useState, useEffect } from "react";

export function useOllamaModels(active: boolean) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setError(undefined);
    fetch("/api/ollama/models")
      .then((r) => r.json() as Promise<{ models: string[]; error?: string }>)
      .then((data) => {
        setModels(data.models ?? []);
        if (data.error) setError(data.error);
      })
      .catch(() => setError("Ollama offline"))
      .finally(() => setLoading(false));
  }, [active]);

  return { models, loading, error };
}
