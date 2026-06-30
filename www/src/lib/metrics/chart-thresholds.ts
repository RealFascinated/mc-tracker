import uPlot from "uplot";
import type { ResolvedTheme } from "@/lib/theme/context";

export type ChartThresholdLevel = "warning" | "critical";

export type ChartThreshold = {
  value: number;
  level: ChartThresholdLevel;
};

const THRESHOLD_COLORS: Record<
  ResolvedTheme,
  Record<ChartThresholdLevel, string>
> = {
  light: { warning: "#D4A030", critical: "#DC6B6B" },
  dark: { warning: "#FADE2A", critical: "#F2495C" },
};

function thresholdStroke(pxRatio: number) {
  const scale = (v: number) => v * pxRatio;
  return { lineWidth: scale(1), dash: [5, 4].map(scale) };
}

export function createThresholdDrawHook(
  thresholds: Array<ChartThreshold>,
  theme: ResolvedTheme,
  scale: "y" | "y2" = "y",
): (u: uPlot) => void {
  return (u) => {
    if (thresholds.length === 0) return;

    const { ctx, bbox } = u;
    const xLeft = bbox.left;
    const xRight = bbox.left + bbox.width;
    const yTop = bbox.top;
    const yBottom = bbox.top + bbox.height;
    const stroke = thresholdStroke(uPlot.pxRatio);

    ctx.save();
    for (const threshold of thresholds) {
      const yPos = u.valToPos(threshold.value, scale, true);
      if (yPos < yTop || yPos > yBottom) continue;

      ctx.beginPath();
      ctx.setLineDash(stroke.dash);
      ctx.strokeStyle = THRESHOLD_COLORS[theme][threshold.level];
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.moveTo(xLeft, yPos);
      ctx.lineTo(xRight, yPos);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  };
}
