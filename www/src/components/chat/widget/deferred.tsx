import { lazy, Suspense, useEffect, useState } from "react";

const TrackerChatWidget = lazy(() =>
  import("@/components/chat/widget/widget").then((mod) => ({
    default: mod.TrackerChatWidget,
  })),
);

export function DeferredChatWidget() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const schedule =
      typeof requestIdleCallback === "function"
        ? (cb: () => void) => requestIdleCallback(cb, { timeout: 4000 })
        : (cb: () => void) => window.setTimeout(cb, 2000);
    const cancel =
      typeof requestIdleCallback === "function"
        ? (id: number) => cancelIdleCallback(id)
        : (id: number) => clearTimeout(id);

    const id = schedule(() => setReady(true));
    return () => cancel(id);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <TrackerChatWidget />
    </Suspense>
  );
}
