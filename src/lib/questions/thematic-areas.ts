/**
 * Normalizes thematic-area values used by URLs, forms, and database filters.
 * A non-empty multi-value input takes precedence over the legacy singular
 * value so callers can accept both representations during the transition.
 */
export function normalizeThematicAreas(
  thematicAreas?: string | readonly string[] | null,
  thematicArea?: string | null,
): string[] {
  const values = typeof thematicAreas === "string" ? [thematicAreas] : thematicAreas ?? [];
  const normalizedMulti = [...new Set(values.map((area) => area.trim()).filter(Boolean))];
  if (normalizedMulti.length > 0) return normalizedMulti;

  const legacy = thematicArea?.trim();
  return legacy ? [legacy] : [];
}
