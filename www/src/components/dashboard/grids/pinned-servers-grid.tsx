import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EntityMetricsGrid } from "@/components/dashboard/grids/entity-metrics-grid";
import { ServerIdentityHeader } from "@/components/dashboard/server-identity-header";
import { ServerPinButton } from "@/components/dashboard/server-pin-button";
import { Button } from "@/components/ui/button";
import { reorderPinnedServers } from "@/lib/api/pinned-servers";
import { pinnedServersQueryKey } from "@/lib/api/pinned-servers.queries";
import type {
  ServerListItem,
  ServerTimeseriesResponse,
} from "@/lib/api/servers";
import { serverTimeseriesQueryOptions } from "@/lib/api/servers.queries";
import { toVisibleTimeseriesOptions } from "@/lib/api/visible-timeseries-options";
import { createServerPlayersChart } from "@/lib/metrics/charts/players";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { cn } from "cnfast";

type PinnedServersGridProps = {
  servers: ServerListItem[];
  window: MetricTimeWindow;
};

type SortablePinnedItemProps = {
  id: string;
  children: ReactNode;
};

type SortableDragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

const SortableDragHandleContext = createContext<SortableDragHandleProps | null>(
  null,
);

function SortableDragHandle() {
  const dragHandle = useContext(SortableDragHandleContext);
  if (!dragHandle) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 cursor-grab active:cursor-grabbing"
      aria-label="Drag to rearrange"
      {...dragHandle.attributes}
      {...dragHandle.listeners}
    >
      <GripVertical className="size-4" aria-hidden />
    </Button>
  );
}

function SortablePinnedItem({ id, children }: SortablePinnedItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const dragHandle = useMemo(
    () => ({ attributes, listeners }),
    [attributes, listeners],
  );

  return (
    <SortableDragHandleContext.Provider value={dragHandle}>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        className={cn("min-w-0", isDragging && "z-10 opacity-90")}
      >
        {children}
      </div>
    </SortableDragHandleContext.Provider>
  );
}

function PinnedServerHeader({ server }: { server: ServerListItem }) {
  const trailing = useMemo(
    () => (
      <div className="flex items-center">
        <ServerPinButton serverId={server.id} isPinned />
        <SortableDragHandle />
      </div>
    ),
    [server.id],
  );

  return (
    <ServerIdentityHeader server={server} linkToDetail trailing={trailing} />
  );
}

function PinnedServerWrapItem({
  item,
  visibilityKey,
  children,
}: {
  item: ServerListItem;
  visibilityKey: string;
  children: ReactNode;
}) {
  return (
    <SortablePinnedItem key={visibilityKey} id={item.id}>
      {children}
    </SortablePinnedItem>
  );
}

export function PinnedServersGrid({ servers, window }: PinnedServersGridProps) {
  const queryClient = useQueryClient();
  const [optimisticItems, setOptimisticItems] = useState<
    ServerListItem[] | null
  >(null);
  const items = optimisticItems ?? servers;

  const reorderMutation = useMutation({
    mutationFn: reorderPinnedServers,
    onSuccess: (data) => {
      queryClient.setQueryData(pinnedServersQueryKey, data);
      setOptimisticItems(null);
    },
    onError: () => {
      setOptimisticItems(null);
      toast.error("Failed to reorder pinned servers");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = items.findIndex((server) => server.id === active.id);
      const newIndex = items.findIndex((server) => server.id === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const nextItems = arrayMove(items, oldIndex, newIndex);
      setOptimisticItems(nextItems);
      reorderMutation.mutate(nextItems.map((server) => server.id));
    },
    [items, reorderMutation],
  );

  const renderHeader = useCallback(
    (server: ServerListItem) => <PinnedServerHeader server={server} />,
    [],
  );

  const chartDef = useCallback(
    (server: ServerListItem) =>
      createServerPlayersChart(`pinned-server-players-${server.id}`),
    [],
  );

  const timeseriesOptions = useCallback(
    (server: ServerListItem, timeWindow: MetricTimeWindow) =>
      toVisibleTimeseriesOptions(
        serverTimeseriesQueryOptions(server.id, timeWindow),
      ),
    [],
  );

  const wrapItem = useCallback(
    ({
      item,
      visibilityKey,
      children,
    }: {
      item: ServerListItem;
      visibilityKey: string;
      children: ReactNode;
    }) => (
      <PinnedServerWrapItem item={item} visibilityKey={visibilityKey}>
        {children}
      </PinnedServerWrapItem>
    ),
    [],
  );

  if (servers.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((server) => server.id)}
        strategy={rectSortingStrategy}
      >
        <EntityMetricsGrid<ServerListItem, ServerTimeseriesResponse>
          items={items}
          window={window}
          trackedCount={items.length}
          getKey={(server) => `pinned:${server.id}`}
          renderHeader={renderHeader}
          chartDef={chartDef}
          timeseriesOptions={timeseriesOptions}
          timeseriesEnabled={(server) => server.id.length > 0}
          wrapItem={wrapItem}
          section={{
            title: "Pinned servers",
            subtitleDefault: "Drag to rearrange",
            subtitleFiltered: () => "Drag to rearrange",
            emptyTracked: "",
            emptyFiltered: "",
            emptyFilteredHint: "",
          }}
        />
      </SortableContext>
    </DndContext>
  );
}
