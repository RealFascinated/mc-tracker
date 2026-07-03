import {
  DndContext,
  
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import type {DragEndEvent} from "@dnd-kit/core";
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
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EntityMetricsGrid } from "@/components/dashboard/grids/entity-metrics-grid";
import { ServerIdentityHeader } from "@/components/dashboard/server-identity-header";
import { ServerPinButton } from "@/components/dashboard/server-pin-button";
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

function SortablePinnedItem({ id, children }: SortablePinnedItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn("min-w-0", isDragging && "z-10 opacity-90")}
    >
      <div className="relative">
        <button
          type="button"
          className="absolute top-3 left-2 z-10 flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to rearrange"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}

export function PinnedServersGrid({ servers, window }: PinnedServersGridProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState(servers);

  const reorderMutation = useMutation({
    mutationFn: reorderPinnedServers,
    onSuccess: (data) => {
      queryClient.setQueryData(pinnedServersQueryKey, data);
      setItems(data.servers);
    },
    onError: () => {
      setItems(servers);
      toast.error("Failed to reorder pinned servers");
    },
  });

  useEffect(() => {
    if (!reorderMutation.isPending) {
      setItems(servers);
    }
  }, [servers, reorderMutation.isPending]);

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
      setItems(nextItems);
      reorderMutation.mutate(nextItems.map((server) => server.id));
    },
    [items, reorderMutation],
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
          getKey={(server) => server.id}
          renderHeader={(server) => (
            <ServerIdentityHeader
              server={server}
              linkToDetail
              trailing={<ServerPinButton serverId={server.id} isPinned />}
            />
          )}
          chartDef={(server) =>
            createServerPlayersChart(`pinned-server-players-${server.id}`)
          }
          timeseriesOptions={(server, timeWindow) =>
            toVisibleTimeseriesOptions(
              serverTimeseriesQueryOptions(server.id, timeWindow),
            )
          }
          timeseriesEnabled={(server) => server.id.length > 0}
          wrapItem={({ item, visibilityKey, children }) => (
            <SortablePinnedItem key={visibilityKey} id={item.id}>
              {children}
            </SortablePinnedItem>
          )}
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
