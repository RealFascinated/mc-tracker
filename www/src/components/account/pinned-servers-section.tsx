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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GripVertical, Pin } from "lucide-react";
import { createContext, use, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ServerFavicon } from "@/components/dashboard/server/favicon";
import { ServerPinButton } from "@/components/dashboard/server/pin-button";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { reorderPinnedServers } from "@/lib/api/pinned-servers";
import {
  pinnedServersQueryKey,
  pinnedServersQueryOptions,
} from "@/lib/api/pinned-servers.queries";
import type { ServerListItem } from "@/lib/api/servers";
import { formatServerHost } from "@/lib/api/servers";
import { formatPlayers } from "@/lib/formatter";
import { cn } from "cnfast";

type SortableDragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

const SortableDragHandleContext = createContext<SortableDragHandleProps | null>(
  null,
);

function SortableDragHandle() {
  const dragHandle = use(SortableDragHandleContext);
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

function PinnedServerRow({ server }: { server: ServerListItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: server.id });

  const dragHandle = useMemo(
    () => ({ attributes, listeners }),
    [attributes, listeners],
  );

  const address = formatServerHost(server.host, server.port);
  const playersLabel =
    server.playersOnline == null
      ? "—"
      : `${formatPlayers(server.playersOnline)} online`;

  return (
    <SortableDragHandleContext.Provider value={dragHandle}>
      <li
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        className={cn(
          "flex items-center gap-2 rounded-soft border border-border bg-card px-2 py-2",
          isDragging && "z-10 opacity-90 shadow-sm",
        )}
      >
        <SortableDragHandle />
        <ServerFavicon
          name={server.name}
          favicon={server.favicon}
          size="sm"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <Link
            to="/servers/$serverId"
            params={{ serverId: server.id }}
            className="link-underline-animate link-underline-animate--primary block truncate text-sm font-medium text-foreground hover:text-monitor dark:hover:text-warning"
          >
            {server.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{address}</p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {playersLabel}
        </span>
        <ServerPinButton serverId={server.id} isPinned />
      </li>
    </SortableDragHandleContext.Provider>
  );
}

export function AccountPinnedServersSection() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(pinnedServersQueryOptions());
  const servers = data?.servers ?? [];
  const [optimisticItems, setOptimisticItems] = useState<
    ServerListItem[] | null
  >(null);
  const items = optimisticItems ?? servers;

  const reorderMutation = useMutation({
    mutationFn: reorderPinnedServers,
    onSuccess: (nextData) => {
      queryClient.setQueryData(pinnedServersQueryKey, nextData);
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

  return (
    <section className="app-shell-section">
      <div className="app-shell-section-header">
        <h2 className="app-shell-section-title">Pinned servers</h2>
        <p className="app-shell-section-description">
          Reorder or unpin servers shown at the top of your dashboard.
        </p>
      </div>
      <div className="app-shell-section-body">
        {isPending ? (
          <LoadingState message="Loading pinned servers…" />
        ) : isError ? (
          <p className="text-sm text-destructive">
            Failed to load pinned servers.
          </p>
        ) : items.length === 0 ? (
          <Empty className="rounded-soft border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia>
                <Pin className="text-muted-foreground size-8 stroke-1" />
              </EmptyMedia>
              <EmptyTitle>No pinned servers</EmptyTitle>
              <EmptyDescription>
                Pin servers from the dashboard to keep them at the top and
                manage them here.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/servers">Go to servers</Link>
            </Button>
          </Empty>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((server) => server.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex max-w-2xl flex-col gap-2">
                {items.map((server) => (
                  <PinnedServerRow key={server.id} server={server} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  );
}
