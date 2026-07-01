import type { VisibleTimeseriesQueryOptions } from "@/lib/api/visible-timeseries-options";
import { useMemo } from "react";
import type { ReactNode } from "react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { LazyMetricChartBody } from "@/components/dashboard/charts/lazy-metric-chart-body";
import { StatValueTooltip } from "@/components/dashboard/stats/stat-value-tooltip";
import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { useVisibleTimeseriesQuery } from "@/hooks/timeseries/use-visible-timeseries-query";
import { EMPTY_METRIC_TIME_SERIES } from "@/lib/api/metric-timeseries";
import type {
  EntityPeakStats,
  PlayersTimeseriesPayload,
} from "@/lib/api/types";
import { playersTimeseriesToMetric } from "@/lib/metrics/adapters";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { formatPlayers } from "@/lib/format-players";
import { peakTimestampTooltip } from "@/lib/format-peak-at";

export type EntityMetricsSectionCopy = {
  title: string;
  subtitleDefault: string;
  subtitleFiltered: (shown: number, total: number) => string;
  emptyTracked: string;
  emptyFiltered: string;
  emptyFilteredHint: string;
};

export type EntityMetricsGridConfig<
  T,
  TTimeseries extends PlayersTimeseriesPayload = PlayersTimeseriesPayload,
> = {
  items: T[];
  window: MetricTimeWindow;
  hasActiveFilter?: boolean;
  trackedCount: number;
  headerTrailing?: ReactNode;
  getKey: (item: T) => string;
  renderHeader: (item: T) => ReactNode;
  chartDef: (item: T) => ChartDefinition;
  timeseriesOptions: (
    item: T,
    window: MetricTimeWindow,
  ) => VisibleTimeseriesQueryOptions<TTimeseries>;
  timeseriesEnabled?: (item: T) => boolean;
  section: EntityMetricsSectionCopy;
};

type EntityMetricsChartProps<
  T,
  TTimeseries extends PlayersTimeseriesPayload,
> = {
  item: T;
  window: MetricTimeWindow;
  chartDef: (item: T) => ChartDefinition;
  timeseriesOptions: (
    item: T,
    window: MetricTimeWindow,
  ) => VisibleTimeseriesQueryOptions<TTimeseries>;
  timeseriesEnabled?: (item: T) => boolean;
};

function EntityMetricsChart<T, TTimeseries extends PlayersTimeseriesPayload>({
  item,
  window,
  chartDef,
  timeseriesOptions,
  timeseriesEnabled,
}: EntityMetricsChartProps<T, TTimeseries>) {
  const { ref, isIntersecting, hasBeenVisible } = useIntersectionVisible();
  const def = useMemo(() => chartDef(item), [chartDef, item]);
  const options = useMemo(
    () => timeseriesOptions(item, window),
    [timeseriesOptions, item, window],
  );
  const enabled = timeseriesEnabled?.(item) ?? true;
  const { data, isPending, isError } = useVisibleTimeseriesQuery(
    options,
    isIntersecting,
    enabled,
  );

  const chartData = useMemo(
    () => (data ? playersTimeseriesToMetric(data) : EMPTY_METRIC_TIME_SERIES),
    [data],
  );

  return (
    <div ref={ref} className="entity-metrics-card-chart">
      <LazyMetricChartBody
        isVisible={isIntersecting}
        hasBeenVisible={hasBeenVisible}
        isPending={isPending}
        isError={isError}
        chartDef={def}
        chartData={chartData}
      />
    </div>
  );
}

type EntityMetricsCardProps<T, TTimeseries extends PlayersTimeseriesPayload> = {
  item: T;
  window: MetricTimeWindow;
  renderHeader: (item: T) => ReactNode;
  chartDef: (item: T) => ChartDefinition;
  timeseriesOptions: (
    item: T,
    window: MetricTimeWindow,
  ) => VisibleTimeseriesQueryOptions<TTimeseries>;
  timeseriesEnabled?: (item: T) => boolean;
};

function EntityMetricsCard<T, TTimeseries extends PlayersTimeseriesPayload>({
  item,
  window,
  renderHeader,
  chartDef,
  timeseriesOptions,
  timeseriesEnabled,
}: EntityMetricsCardProps<T, TTimeseries>) {
  return (
    <DashboardCard className="entity-metrics-card h-full">
      {renderHeader(item)}
      <EntityMetricsChart
        item={item}
        window={window}
        chartDef={chartDef}
        timeseriesOptions={timeseriesOptions}
        timeseriesEnabled={timeseriesEnabled}
      />
    </DashboardCard>
  );
}

export function EntityMetricsGrid<
  T,
  TTimeseries extends PlayersTimeseriesPayload = PlayersTimeseriesPayload,
>({
  items,
  window,
  hasActiveFilter = false,
  trackedCount,
  headerTrailing,
  getKey,
  renderHeader,
  chartDef,
  timeseriesOptions,
  timeseriesEnabled,
  section,
}: EntityMetricsGridConfig<T, TTimeseries>) {
  if (trackedCount === 0) {
    return (
      <div className="entity-metrics-empty">
        <p className="text-sm text-muted-foreground">{section.emptyTracked}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <section className="entity-metrics-section motion-chart-reveal">
        <div className="entity-metrics-section-header">
          <h2 className="entity-metrics-section-title">{section.title}</h2>
          <p className="entity-metrics-section-subtitle">
            {section.emptyFiltered}
          </p>
        </div>
        <div className="entity-metrics-empty">
          <p className="text-sm text-muted-foreground">
            {section.emptyFilteredHint}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="entity-metrics-section motion-chart-reveal">
      <div className="entity-metrics-section-header">
        <div className="min-w-0">
          <h2 className="entity-metrics-section-title">{section.title}</h2>
          <p className="entity-metrics-section-subtitle">
            {hasActiveFilter
              ? section.subtitleFiltered(items.length, trackedCount)
              : section.subtitleDefault}
          </p>
        </div>
        {headerTrailing ? (
          <div className="shrink-0">{headerTrailing}</div>
        ) : null}
      </div>

      <div className="entity-metrics-grid-container">
        <div className="entity-metrics-grid">
          {items.map((item) => (
            <EntityMetricsCard
              key={getKey(item)}
              item={item}
              window={window}
              renderHeader={renderHeader}
              chartDef={chartDef}
              timeseriesOptions={timeseriesOptions}
              timeseriesEnabled={timeseriesEnabled}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function EntityCardStats({
  playersOnline,
  peaks,
}: {
  playersOnline: number | null;
  peaks: EntityPeakStats;
}) {
  return (
    <div className="entity-card-stats">
      <div className="entity-card-stat">
        <span className="entity-card-stat-label">Now</span>
        <StatValueTooltip
          value={formatPlayers(playersOnline)}
          className="entity-card-stat-value"
        />
      </div>
      <div className="entity-card-stat">
        <span className="entity-card-stat-label">Peak 24h</span>
        <StatValueTooltip
          value={formatPlayers(peaks.players24h)}
          className="entity-card-stat-value"
        />
      </div>
      <div className="entity-card-stat">
        <span className="entity-card-stat-label">All-time</span>
        <StatValueTooltip
          tooltip={peakTimestampTooltip(peaks.allTime?.timestamp)}
          value={formatPlayers(peaks.allTime?.players ?? null)}
          className="entity-card-stat-value"
        />
      </div>
    </div>
  );
}
