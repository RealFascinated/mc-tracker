import type { VisibleTimeseriesQueryOptions } from "@/lib/api/visible-timeseries-options";
import { useMemo } from "react";
import type { ReactNode } from "react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { LazyMetricChartBody } from "@/components/dashboard/charts/lazy-metric-chart-body";
import { LazyVisibleMount } from "@/components/dashboard/lazy-visible-mount";
import { StatValueTooltip } from "@/components/dashboard/stats/stat-value-tooltip";
import { useVisibleTimeseriesQuery } from "@/hooks/timeseries/use-visible-timeseries-query";
import { EMPTY_METRIC_TIME_SERIES } from "@/lib/api/metric-timeseries";
import type {
  EntityPeakStats,
  PlayersTimeseriesPayload,
} from "@/lib/api/types";
import { playersTimeseriesToMetric } from "@/lib/metrics/adapters";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import { DASHBOARD_CARD_CHART_HEIGHT } from "@/lib/metrics/dashboard-chart-constants";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { formatPlayers } from "@/lib/format-players";
import { peakTimestampTooltip } from "@/lib/format-peak-at";

type EntityMetricsSectionCopy = {
  title: string;
  subtitleDefault: string;
  subtitleSearch: (shown: number, total: number) => string;
  emptyTracked: string;
  emptySearch: string;
  emptySearchHint: string;
};

export type EntityMetricsGridConfig<
  T,
  TTimeseries extends PlayersTimeseriesPayload = PlayersTimeseriesPayload,
> = {
  items: T[];
  window: MetricTimeWindow;
  hasActiveSearch: boolean;
  trackedCount: number;
  isLoading?: boolean;
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

type EntityMetricsCardProps<T, TTimeseries extends PlayersTimeseriesPayload> = {
  item: T;
  window: MetricTimeWindow;
  isIntersecting: boolean;
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
  isIntersecting,
  renderHeader,
  chartDef,
  timeseriesOptions,
  timeseriesEnabled,
}: EntityMetricsCardProps<T, TTimeseries>) {
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
    <DashboardCard className="entity-metrics-card h-full">
      {renderHeader(item)}
      <div className="entity-metrics-card-chart">
        <LazyMetricChartBody
          isVisible={isIntersecting}
          isPending={isPending}
          isError={isError}
          chartDef={def}
          chartData={chartData}
        />
      </div>
    </DashboardCard>
  );
}

function EntityMetricsCardPlaceholder<T>({
  item,
  renderHeader,
}: {
  item: T;
  renderHeader: (item: T) => ReactNode;
}) {
  return (
    <DashboardCard className="entity-metrics-card h-full">
      {renderHeader(item)}
      <div
        className="entity-metrics-card-chart"
        style={{ height: DASHBOARD_CARD_CHART_HEIGHT }}
        aria-hidden
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
  hasActiveSearch,
  trackedCount,
  isLoading = false,
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
            {section.emptySearch}
          </p>
        </div>
        <div className="entity-metrics-empty">
          <p className="text-sm text-muted-foreground">
            {section.emptySearchHint}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="entity-metrics-section motion-chart-reveal"
      aria-busy={isLoading}
    >
      <div className="entity-metrics-section-header">
        <h2 className="entity-metrics-section-title">{section.title}</h2>
        <p className="entity-metrics-section-subtitle">
          {hasActiveSearch
            ? section.subtitleSearch(items.length, trackedCount)
            : section.subtitleDefault}
        </p>
      </div>

      <div className={isLoading ? "entity-metrics-grid-loading" : undefined}>
        <div className="entity-metrics-grid-container">
          <div className="entity-metrics-grid">
            {items.map((item) => (
              <LazyVisibleMount
                key={getKey(item)}
                placeholder={
                  <EntityMetricsCardPlaceholder
                    item={item}
                    renderHeader={renderHeader}
                  />
                }
              >
                {(isIntersecting) => (
                  <EntityMetricsCard
                    item={item}
                    window={window}
                    isIntersecting={isIntersecting}
                    renderHeader={renderHeader}
                    chartDef={chartDef}
                    timeseriesOptions={timeseriesOptions}
                    timeseriesEnabled={timeseriesEnabled}
                  />
                )}
              </LazyVisibleMount>
            ))}
          </div>
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
