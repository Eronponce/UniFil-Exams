export const MIN_ESSAY_TABLE_SCALE = 0.58;

export interface EssayTableLayoutDecision {
  layout: "column" | "full";
  tableScale: number;
  requiredColumnScale: number;
  requiredFullScale: number;
}

interface DecideEssayTableLayoutInput {
  tableNaturalWidth: number;
  columnWidth: number;
  fullWidth: number;
  minScale?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function decideEssayTableLayout({
  tableNaturalWidth,
  columnWidth,
  fullWidth,
  minScale = MIN_ESSAY_TABLE_SCALE,
}: DecideEssayTableLayoutInput): EssayTableLayoutDecision {
  if (!(tableNaturalWidth > 0) || !(columnWidth > 0) || !(fullWidth > 0)) {
    return {
      layout: "full",
      tableScale: 1,
      requiredColumnScale: 0,
      requiredFullScale: 0,
    };
  }

  const requiredColumnScale = columnWidth / tableNaturalWidth;
  const requiredFullScale = fullWidth / tableNaturalWidth;
  const canUseColumn = requiredColumnScale >= minScale;

  return {
    layout: canUseColumn ? "column" : "full",
    tableScale: canUseColumn ? clamp(requiredColumnScale, minScale, 1) : clamp(requiredFullScale, minScale, 1),
    requiredColumnScale,
    requiredFullScale,
  };
}
