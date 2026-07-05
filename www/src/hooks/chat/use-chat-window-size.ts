import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  localStorageJsonOptions,
  useLocalStorage,
} from "@/hooks/use-local-storage";

const CHAT_WINDOW_SIZE_STORAGE_KEY = "chat-window-size";

const DEFAULT_CHAT_WINDOW_SIZE = { width: 512, height: 608 };
const MIN_CHAT_WINDOW_WIDTH = 320;
const MIN_CHAT_WINDOW_HEIGHT = 360;
const CHAT_WINDOW_VIEWPORT_MARGIN = 32;

export type ChatWindowSize = {
  width: number;
  height: number;
};

function parseChatWindowSize(raw: unknown): ChatWindowSize | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const { width, height } = raw as Record<string, unknown>;
  if (typeof width !== "number" || typeof height !== "number") {
    return null;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  return { width, height };
}

function clampChatWindowSize(size: ChatWindowSize): ChatWindowSize {
  const maxWidth = window.innerWidth - CHAT_WINDOW_VIEWPORT_MARGIN;
  const maxHeight = window.innerHeight - CHAT_WINDOW_VIEWPORT_MARGIN;

  return {
    width: Math.min(Math.max(size.width, MIN_CHAT_WINDOW_WIDTH), maxWidth),
    height: Math.min(Math.max(size.height, MIN_CHAT_WINDOW_HEIGHT), maxHeight),
  };
}

const POINTER_FINE_QUERY = "(hover: hover) and (pointer: fine)";

function subscribePointerFine(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(POINTER_FINE_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getPointerFine() {
  return window.matchMedia(POINTER_FINE_QUERY).matches;
}

export function useChatWindowSize() {
  const [size, setSize] = useLocalStorage(CHAT_WINDOW_SIZE_STORAGE_KEY, {
    defaultValue: DEFAULT_CHAT_WINDOW_SIZE,
    ...localStorageJsonOptions(parseChatWindowSize),
  });
  const isResizable = useSyncExternalStore(
    subscribePointerFine,
    getPointerFine,
    () => false,
  );
  const [isResizing, setIsResizing] = useState(false);
  const [dragSize, setDragSize] = useState<ChatWindowSize | null>(null);

  useEffect(() => {
    const clampStoredSize = () => {
      setSize((current) => {
        const next = clampChatWindowSize(current);
        if (next.width === current.width && next.height === current.height) {
          return current;
        }
        return next;
      });
    };

    clampStoredSize();
    window.addEventListener("resize", clampStoredSize);
    return () => window.removeEventListener("resize", clampStoredSize);
  }, [setSize]);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = size.width;
      const startHeight = size.height;

      setIsResizing(true);
      setDragSize({ width: startWidth, height: startHeight });

      const onMove = (moveEvent: PointerEvent) => {
        setDragSize(
          clampChatWindowSize({
            width: startWidth - (moveEvent.clientX - startX),
            height: startHeight - (moveEvent.clientY - startY),
          }),
        );
      };

      const onEnd = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onEnd);
        document.removeEventListener("pointercancel", onEnd);
        document.body.style.removeProperty("user-select");
        document.body.style.removeProperty("cursor");
        setDragSize((current) => {
          if (current) {
            setSize(current);
          }
          return null;
        });
        setIsResizing(false);
      };

      document.body.style.userSelect = "none";
      document.body.style.cursor = "nwse-resize";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onEnd);
      document.addEventListener("pointercancel", onEnd);
    },
    [setSize, size.height, size.width],
  );

  return {
    size: dragSize ?? size,
    isResizable,
    isResizing,
    onResizePointerDown,
  };
}
