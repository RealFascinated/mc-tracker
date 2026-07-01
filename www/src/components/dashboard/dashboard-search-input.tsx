import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { ServerFavicon } from "@/components/dashboard/server-favicon";
import { Input } from "@/components/ui/input";
import { useMetricTimeWindowLinkSearch } from "@/hooks/use-metric-time-window-link-search";
import type { ServerSearchItem } from "@/lib/api/servers";
import { serversSearchQueryOptions } from "@/lib/api/servers.queries";
import { cn } from "@/lib/utils";

type DashboardSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

const AUTOCOMPLETE_DEBOUNCE_MS = 150;
const AUTOCOMPLETE_MIN_CHARS = 1;

function formatServerAddress(server: ServerSearchItem): string {
  if (server.port == null) {
    return server.host;
  }
  return `${server.host}:${server.port}`;
}

export function DashboardSearchInput({
  value,
  onChange,
}: DashboardSearchInputProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const timeWindowSearch = useMetricTimeWindowLinkSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => globalThis.clearTimeout(timer);
  }, [value]);

  const { data: searchData, isFetching } = useQuery({
    ...serversSearchQueryOptions(debouncedQuery),
    enabled: isOpen && debouncedQuery.length >= AUTOCOMPLETE_MIN_CHARS,
  });

  const suggestions = searchData?.servers ?? [];
  const isSearching = isFetching && suggestions.length === 0;
  const showSuggestions =
    isOpen &&
    value.trim().length >= AUTOCOMPLETE_MIN_CHARS &&
    (isFetching || suggestions.length > 0);
  const showListbox = showSuggestions && !isSearching;

  const closeSuggestions = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const selectSuggestion = useCallback(
    (server: ServerSearchItem) => {
      closeSuggestions();
      inputRef.current?.blur();
      void navigate({
        to: "/servers/$serverId",
        params: { serverId: server.id },
        search: timeWindowSearch,
      });
    },
    [closeSuggestions, navigate, timeWindowSearch],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (event.key === "Escape") {
        closeSuggestions();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions();
    }
  };

  return (
    <div className="dashboard-search">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        role="combobox"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          globalThis.setTimeout(() => closeSuggestions(), 120);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search servers…"
        aria-label="Search servers"
        aria-expanded={showSuggestions}
        aria-busy={isFetching || undefined}
        aria-controls={showListbox ? listboxId : undefined}
        aria-activedescendant={
          showListbox && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        aria-autocomplete="list"
        autoComplete="off"
        className="dashboard-search-input"
      />
      {value ? (
        <button
          type="button"
          className="dashboard-search-clear"
          onClick={() => {
            onChange("");
            closeSuggestions();
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      {showSuggestions ? (
        <div className="dashboard-search-suggestions">
          {isSearching ? (
            <div className="dashboard-search-suggestion-status" aria-live="polite">
              <output>Searching…</output>
            </div>
          ) : (
            <div id={listboxId} className="dashboard-search-suggestions-list">
              {suggestions.map((server, index) => (
                <button
                  key={server.id}
                  type="button"
                  id={`${listboxId}-option-${index}`}
                  tabIndex={-1}
                  className={cn(
                    "dashboard-search-suggestion",
                    index === activeIndex &&
                      "dashboard-search-suggestion-active",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(server)}
                >
                  <ServerFavicon
                    name={server.name}
                    favicon={server.favicon}
                    size="sm"
                  />
                  <span className="dashboard-search-suggestion-copy">
                    <span className="dashboard-search-suggestion-name">
                      {server.name}
                    </span>
                    <span className="dashboard-search-suggestion-host">
                      {formatServerAddress(server)}
                    </span>
                  </span>
                  {server.playersOnline != null ? (
                    <span className="dashboard-search-suggestion-players">
                      {server.playersOnline.toLocaleString()}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
