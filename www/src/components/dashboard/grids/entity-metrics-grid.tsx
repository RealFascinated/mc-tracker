import type { VisibleTimeseriesQueryOptions } from "@/lib/api/visible-timeseries-options";
import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";

import type { EntityPeakStats, TimeseriesResponse } from "@/lib/api/types";

import { DashboardCard } from "@/components/dashboard/cards/card";
import { LazyMetricChartBody } from "@/components/dashboard/charts/lazy-metric-chart-body";
import { resolveLazyMetricChartState } from "@/components/dashboard/charts/lazy-metric-chart-state";
import { AnimatedStatValue } from "@/components/dashboard/stats/animated-stat-value";
import { FadeInAnimation } from "@/components/motion/fade-in-animation";
import {
  useGridItemVisible,
  useIntersectionVisible,
} from "@/hooks/use-intersection-visible";
import { useVisibleTimeseriesQuery } from "@/hooks/timeseries/use-visible-timeseries-query";
import {
  EMPTY_METRIC_TIME_SERIES,
  timeseriesToMetric,
} from "@/lib/api/metric-timeseries";
import type { ChartDefinition } from "@/lib/metrics/charts/types";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { peakTimestampTooltip } from "@/lib/formatter";

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
  TTimeseries extends TimeseriesResponse = TimeseriesResponse,
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
  wrapItem?: (props: {
    item: T;
    visibilityKey: string;
    children: ReactNode;
  }) => ReactNode;
};

type EntityMetricsChartProps<T, TTimeseries extends TimeseriesResponse> = {
  visibilityKey: string;
  item: T;
  window: MetricTimeWindow;
  chartDef: (item: T) => ChartDefinition;
  timeseriesOptions: (
    item: T,
    window: MetricTimeWindow,
  ) => VisibleTimeseriesQueryOptions<TTimeseries>;
  timeseriesEnabled?: (item: T) => boolean;
};

function EntityMetricsChart<T, TTimeseries extends TimeseriesResponse>({
  visibilityKey,
  item,
  window,
  chartDef,
  timeseriesOptions,
  timeseriesEnabled,
}: EntityMetricsChartProps<T, TTimeseries>) {
  const { ref, isIntersecting, hasBeenVisible } =
    useGridItemVisible(visibilityKey);
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
    () => (data ? timeseriesToMetric(data) : EMPTY_METRIC_TIME_SERIES),
    [data],
  );
  const chartState = useMemo(
    () =>
      resolveLazyMetricChartState({
        isVisible: isIntersecting,
        hasBeenVisible,
        isPending,
        isError,
        hasData: chartData.timestamps.length > 0,
      }),
    [isIntersecting, hasBeenVisible, isPending, isError, chartData],
  );

  return (
    <div ref={ref} className="entity-metrics-card-chart">
      <LazyMetricChartBody
        state={chartState}
        chartDef={def}
        chartData={chartData}
        hydrateWhen={isIntersecting}
      />
    </div>
  );
}

type EntityMetricsCardProps<T, TTimeseries extends TimeseriesResponse> = {
  visibilityKey: string;
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

type EntityMetricsCardHeaderProps<T> = {
  item: T;
  renderHeader: (item: T) => ReactNode;
};

function EntityMetricsCardHeader<T>({
  item,
  renderHeader,
}: EntityMetricsCardHeaderProps<T>) {
  return renderHeader(item);
}

function EntityMetricsCard<T, TTimeseries extends TimeseriesResponse>({
  visibilityKey,
  item,
  window,
  renderHeader,
  chartDef,
  timeseriesOptions,
  timeseriesEnabled,
}: EntityMetricsCardProps<T, TTimeseries>) {
  return (
    <DashboardCard className="entity-metrics-card h-full">
      <EntityMetricsCardHeader item={item} renderHeader={renderHeader} />
      <EntityMetricsChart
        visibilityKey={visibilityKey}
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
  TTimeseries extends TimeseriesResponse = TimeseriesResponse,
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
  wrapItem,
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
      <FadeInAnimation as="section" className="entity-metrics-section">
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
      </FadeInAnimation>
    );
  }

  return (
    <section className="entity-metrics-section">
      <FadeInAnimation className="entity-metrics-section-header">
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
      </FadeInAnimation>

      <div className="entity-metrics-grid-container">
        <div className="entity-metrics-grid">
          {items.map((item) => {
            const visibilityKey = getKey(item);
            const card = (
              <EntityMetricsCard
                visibilityKey={visibilityKey}
                item={item}
                window={window}
                renderHeader={renderHeader}
                chartDef={chartDef}
                timeseriesOptions={timeseriesOptions}
                timeseriesEnabled={timeseriesEnabled}
              />
            );
            if (wrapItem) {
              return (
                <Fragment key={visibilityKey}>
                  {wrapItem({ item, visibilityKey, children: card })}
                </Fragment>
              );
            }
            return (
              <FadeInAnimation key={visibilityKey} className="min-w-0">
                {card}
              </FadeInAnimation>
            );
          })}
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
  const { ref, hasBeenVisible } = useIntersectionVisible();

  return (
    <div ref={ref} className="entity-card-stats">
      <div className="entity-card-stat">
        <span className="entity-card-stat-label">Now</span>
        <AnimatedStatValue
          active={hasBeenVisible}
          value={playersOnline}
          className="entity-card-stat-value"
        />
      </div>
      <div className="entity-card-stat">
        <span className="entity-card-stat-label">Peak 24h</span>
        <AnimatedStatValue
          active={hasBeenVisible}
          value={peaks.players24h}
          className="entity-card-stat-value"
        />
      </div>
      <div className="entity-card-stat">
        <span className="entity-card-stat-label">All-time</span>
        <AnimatedStatValue
          active={hasBeenVisible}
          tooltip={peakTimestampTooltip(peaks.allTime?.timestamp)}
          value={peaks.allTime?.players ?? null}
          className="entity-card-stat-value"
        />
      </div>
    </div>
  );
}
