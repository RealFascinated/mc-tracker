import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { DashboardView } from "@/components/dashboard/dashboard-view-toggle";

type DashboardSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  view?: DashboardView;
};

const PLACEHOLDERS: Record<DashboardView, { placeholder: string; label: string }> =
  {
    server: {
      placeholder: "Search servers…",
      label: "Search servers",
    },
    asn: {
      placeholder: "Search networks…",
      label: "Search networks",
    },
  };

export function DashboardSearchInput({
  value,
  onChange,
  view = "server",
}: DashboardSearchInputProps) {
  const { placeholder, label } = PLACEHOLDERS[view];

  return (
    <div className="dashboard-search">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="dashboard-search-input"
      />
      {value ? (
        <button
          type="button"
          className="dashboard-search-clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
