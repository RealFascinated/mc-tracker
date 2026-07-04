import { useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { RefObject } from "react";

import type { BuiltChartConfig } from "@/lib/metrics/build-chart-config";
import type { TooltipSortEntry } from "@/lib/metrics/charts/types";
import type { MetricChartMode } from "@/components/metrics/metric-chart";
import {
  buildMultiSeriesData,
  getLatestValue,
  sortSeriesForStack,
} from "@/lib/metrics/series";
import { resolveChartSeriesColor } from "@/lib/metrics/chart-colors";
import type { MetricsDataWindow } from "@/lib/metrics/chart-zoom";
import { useChartHydration } from "@/hooks/use-chart-hydration";
import { useChartSeriesVisibility } from "@/hooks/use-chart-series-visibility";
import { MetricChart } from "@/components/metrics/metric-chart";
import { cn } from "cnfast";
import { useTheme } from "@/hooks/use-theme";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MetricChartCardProps = {
  config: BuiltChartConfig;
  height?: number;
  description?: string;
  showCurrentValues?: boolean;
  hideHeader?: boolean;
  hideLegend?: boolean;
  flush?: boolean;
  hydrateWhen?: boolean;
  mode?: MetricChartMode;
  tooltipColumnSize?: number;
  tooltipSort?: (a: TooltipSortEntry, b: TooltipSortEntry) => number;
  queryWindow?: MetricsDataWindow;
};

const FULLSCREEN_CHART_MIN_HEIGHT = 480;

const chartTitleClassName =
  "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground";

function ChartSeriesToggle({
  label,
  color,
  hidden,
  formatted,
  hasValue,
  showValue = false,
  onToggle,
}: {
  label: string;
  color: string;
  hidden: boolean;
  formatted?: string;
  hasValue: boolean;
  showValue?: boolean;
  onToggle: () => void;
}) {
  const displayValue = hasValue ? formatted : "—";

  return (
    <Toggle
      pressed={!hidden}
      onPressedChange={() => onToggle()}
      aria-label={`${hidden ? "Show" : "Hide"} ${label}`}
      variant="outline"
      size="sm"
      className={cn(
        "h-auto min-h-0 gap-1.5 rounded-snug px-2 py-1 font-normal",
        hidden
          ? "border-transparent bg-transparent text-muted-foreground/55 hover:bg-muted/50"
          : "border-border bg-background/90 text-foreground shadow-sm hover:bg-background",
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", hidden && "opacity-35")}
        style={{ backgroundColor: color }}
      />
      <span
        className={cn(
          "text-[11px] font-medium",
          hidden && "text-muted-foreground/70",
        )}
      >
        {label}
        {hidden ? (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground/60">
            (hidden)
          </span>
        ) : null}
      </span>
      {showValue ? (
        <span
          className={cn(
            "font-mono text-[11px] font-semibold tabular-nums",
            hidden || !hasValue
              ? "text-muted-foreground/60"
              : "text-muted-foreground",
          )}
        >
          {displayValue}
        </span>
      ) : null}
    </Toggle>
  );
}

function ChartTitleLabel({
  title,
  description,
  as: Component = "span",
}: {
  title: string;
  description?: string;
  as?: "span" | typeof DialogTitle;
}) {
  if (!description) {
    return <Component className={chartTitleClassName}>{title}</Component>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Component className={cn(chartTitleClassName, "cursor-help")}>
          {title}
        </Component>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

type MetricChartPanelProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  height: number;
  built: ReturnType<typeof buildMultiSeriesData>;
  config: BuiltChartConfig;
  mode?: MetricChartMode;
  tooltipColumnSize?: number;
  tooltipSort?: (a: TooltipSortEntry, b: TooltipSortEntry) => number;
  className?: string;
  fill?: boolean;
  hiddenSeries?: ReadonlySet<number>;
  chartId?: string;
  seriesColors?: Array<string>;
  seriesFills?: Array<boolean | undefined>;
  queryWindow?: MetricsDataWindow;
  inlineLegend?: boolean;
};

function MetricChartPanel({
  containerRef,
  height,
  built,
  config,
  mode,
  tooltipColumnSize,
  tooltipSort,
  className,
  fill = false,
  hiddenSeries,
  chartId,
  seriesColors,
  seriesFills,
  queryWindow,
  inlineLegend = false,
}: MetricChartPanelProps) {
  const seriesAxisIds = built
    ? built.sourceIndices.map((index) => config.series[index]?.axis ?? "left")
    : [];

  if (fill) {
    return (
      <div className={cn("flex min-h-0 w-full flex-1 flex-col", className)}>
        {built ? (
          <MetricChart
            fill
            mountRef={containerRef}
            sizeRef={containerRef}
            data={built.data}
            labels={built.labels}
            chartAxes={config.axes}
            seriesAxisIds={seriesAxisIds}
            negated={built.negated}
            seriesRenders={built.renders}
            seriesFormatters={config.seriesFormatters}
            height={height}
            mode={mode}
            tooltipColumnSize={tooltipColumnSize}
            tooltipSort={tooltipSort}
            hiddenSeries={hiddenSeries}
            sourceIndices={built.sourceIndices}
            seriesColors={seriesColors}
            seriesFills={seriesFills}
            queryWindow={queryWindow}
            inlineLegend={inlineLegend}
          />
        ) : (
          <div
            ref={containerRef}
            id={chartId}
            className="min-h-0 w-full flex-1"
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div
        ref={containerRef}
        id={chartId}
        className="relative w-full"
        style={{ height }}
      >
        {built ? (
          <MetricChart
            sizeRef={containerRef}
            data={built.data}
            labels={built.labels}
            chartAxes={config.axes}
            seriesAxisIds={seriesAxisIds}
            negated={built.negated}
            seriesRenders={built.renders}
            seriesFormatters={config.seriesFormatters}
            height={height}
            mode={mode}
            tooltipColumnSize={tooltipColumnSize}
            tooltipSort={tooltipSort}
            hiddenSeries={hiddenSeries}
            sourceIndices={built.sourceIndices}
            seriesColors={seriesColors}
            seriesFills={seriesFills}
            queryWindow={queryWindow}
            inlineLegend={inlineLegend}
          />
        ) : null}
      </div>
    </div>
  );
}

function MetricChartCard({
  config,
  height,
  description,
  showCurrentValues,
  hideHeader,
  hideLegend = false,
  flush = false,
  hydrateWhen,
  mode,
  tooltipColumnSize,
  tooltipSort,
  queryWindow,
}: MetricChartCardProps) {
  const chartHeight = height ?? 260;
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const { inView, containerRef } = useChartHydration(hydrateWhen);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const chartWasReadyRef = useRef(false);
  if (inView || fullscreenOpen) {
    chartWasReadyRef.current = true;
  }
  const chartReady = inView || fullscreenOpen || chartWasReadyRef.current;
  const displaySeries = useMemo(
    () =>
      mode === "stack" ? sortSeriesForStack(config.series) : config.series,
    [mode, config.series],
  );
  const seriesLabels = useMemo(
    () => displaySeries.map((entry) => entry.label),
    [displaySeries],
  );
  const { hiddenSeries, toggleSeries } = useChartSeriesVisibility(
    config.id,
    seriesLabels,
  );
  const built = useMemo(() => {
    if (!chartReady) return null;
    return buildMultiSeriesData(config.timestamps, displaySeries);
  }, [chartReady, config.timestamps, displaySeries]);
  const { resolvedTheme } = useTheme();
  const shouldShowCurrentValues =
    showCurrentValues ?? displaySeries.length <= 4;
  const canToggleSeries = displaySeries.length > 1;

  const resolveColor = (index: number) =>
    resolveChartSeriesColor(displaySeries[index]?.color, index, resolvedTheme);

  const builtSeriesColors = useMemo(
    () =>
      built
        ? built.sourceIndices.map((sourceIndex) =>
            resolveChartSeriesColor(
              displaySeries[sourceIndex]?.color,
              sourceIndex,
              resolvedTheme,
            ),
          )
        : undefined,
    [built, displaySeries, resolvedTheme],
  );

  const builtSeriesFills = useMemo(
    () =>
      built
        ? built.sourceIndices.map(
            (sourceIndex) => displaySeries[sourceIndex]?.fill,
          )
        : undefined,
    [built, displaySeries],
  );

  const formatSeriesValue = (index: number, value: number) => {
    return config.seriesFormatters.at(index)?.(value) ?? String(value);
  };

  const seriesLegendNode = canToggleSeries ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {displaySeries.map((entry, index) => {
        const value = getLatestValue(entry.values);
        const formatted =
          value == null ? undefined : formatSeriesValue(index, value);
        const color = resolveColor(index);
        const hidden = hiddenSeries.has(index);

        return (
          <ChartSeriesToggle
            key={entry.label}
            label={entry.label}
            color={color}
            hidden={hidden}
            formatted={formatted}
            hasValue={value != null}
            showValue={shouldShowCurrentValues}
            onToggle={() => toggleSeries(index)}
          />
        );
      })}
    </div>
  ) : shouldShowCurrentValues ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {displaySeries.map((entry, index) => {
        const value = getLatestValue(entry.values);
        if (value == null) return null;
        const formatted = formatSeriesValue(index, value);
        const color = resolveColor(index);
        return (
          <span key={entry.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-px w-4 shrink-0"
              style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
            />
            {displaySeries.length > 1 ? (
              <span className="text-[11px] text-muted-foreground">
                {entry.label}
              </span>
            ) : null}
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatted}
            </span>
          </span>
        );
      })}
    </div>
  ) : null;
  const inlineLegendNode = hideLegend ? null : seriesLegendNode;
  const inlineLegend = Boolean(hideHeader && inlineLegendNode);

  return (
    <div
      id={config.id}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      {!hideHeader && (
        <div className="shrink-0 border-b border-border bg-muted/90 px-3 py-2 dark:bg-muted/60">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <ChartTitleLabel title={config.title} description={description} />
            {canToggleSeries ? (
              <div id={`${config.id}-legend`}>{inlineLegendNode}</div>
            ) : (
              inlineLegendNode
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto shrink-0 text-muted-foreground"
              onClick={() => setFullscreenOpen(true)}
              aria-label="Expand chart"
            >
              <Maximize2 />
            </Button>
          </div>
        </div>
      )}
      {hideHeader && inlineLegendNode ? (
        <div id={`${config.id}-legend`} className="shrink-0 px-3 pt-1 pb-0">
          {inlineLegendNode}
        </div>
      ) : null}
      <div className={cn("overflow-visible", flush ? "p-0" : "px-3 pt-2 pb-3")}>
        <MetricChartPanel
          containerRef={containerRef}
          height={chartHeight}
          built={built}
          config={config}
          mode={mode}
          tooltipColumnSize={tooltipColumnSize}
          tooltipSort={tooltipSort}
          hiddenSeries={hiddenSeries}
          chartId={`${config.id}-plot`}
          seriesColors={builtSeriesColors}
          seriesFills={builtSeriesFills}
          queryWindow={queryWindow}
          inlineLegend={inlineLegend}
        />
      </div>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          showCloseButton
          className="flex h-[min(90vh,calc(100vh-2rem))] w-[min(96vw,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <DialogHeader className="shrink-0 border-b border-border bg-muted/90 px-3 py-2 dark:bg-muted/60">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pr-8">
              <ChartTitleLabel
                title={config.title}
                description={description}
                as={DialogTitle}
              />
              {seriesLegendNode}
            </div>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-visible px-3 pt-2 pb-3">
            <MetricChartPanel
              containerRef={fullscreenContainerRef}
              height={FULLSCREEN_CHART_MIN_HEIGHT}
              fill
              built={built}
              config={config}
              mode={mode}
              tooltipColumnSize={tooltipColumnSize}
              tooltipSort={tooltipSort}
              hiddenSeries={hiddenSeries}
              chartId={`${config.id}-plot-fullscreen`}
              seriesColors={builtSeriesColors}
              seriesFills={builtSeriesFills}
              queryWindow={queryWindow}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { MetricChartCard };
