/** Keeps table selection constrained to the questions currently rendered. */
export function reconcileSelectedQuestionIds(selectedIds: Iterable<number>, visibleIds: Iterable<number>): Set<number> {
  const visible = new Set(visibleIds);
  return new Set([...selectedIds].filter((id) => visible.has(id)));
}
