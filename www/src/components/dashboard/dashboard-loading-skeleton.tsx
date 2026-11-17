import { DashboardCard } from "@/components/dashboard/cards/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_CARD_CHART_HEIGHT } from "@/lib/metrics/dashboard-chart-constants";

const STAT_COUNT = 6;
const CARD_COUNT = 6;

function StatRowSkeleton() {
  return (
    <div className="dashboard-stats-row">
      {Array.from({ length: STAT_COUNT }, (_, index) => (
        <div key={index} className="metric-stat min-w-0">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

function HeroChartSkeleton() {
  return (
    <DashboardCard>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="px-4 py-3">
        <Skeleton className="h-[360px] w-full" />
      </div>
    </DashboardCard>
  );
}

function CardSkeleton() {
  return (
    <DashboardCard className="entity-metrics-card">
      <div className="flex items-center gap-3 px-3 pt-3">
        <Skeleton className="size-9 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
        <Skeleton className="h-5 w-16 shrink-0" />
      </div>
      <div className="entity-card-stats">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="entity-card-stat">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <Skeleton style={{ height: DASHBOARD_CARD_CHART_HEIGHT }} />
      </div>
    </DashboardCard>
  );
}

function GridSkeleton({ cardCount = CARD_COUNT }: { cardCount?: number }) {
  return (
    <section className="entity-metrics-section">
      <div className="entity-metrics-section-header">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-64 shrink-0" />
      </div>
      <div className="entity-metrics-grid">
        {Array.from({ length: cardCount }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

function DashboardLoadingSkeleton() {
  return (
    <main className="dashboard-shell" aria-busy="true">
      <span className="sr-only">Loading dashboard</span>
      <StatRowSkeleton />
      <HeroChartSkeleton />
      <GridSkeleton />
    </main>
  );
}

export {
  DashboardLoadingSkeleton,
  StatRowSkeleton,
  HeroChartSkeleton,
  GridSkeleton,
};
