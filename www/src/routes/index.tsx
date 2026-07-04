import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ search }) => {
    const raw = search as Record<string, unknown>;
    const { view, ...rest } = raw;
    throw redirect({
      to: view === "asn" ? "/asns" : "/servers",
      search: rest,
    });
  },
});
