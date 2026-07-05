import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { ServerFavicon } from "@/components/dashboard/server-favicon";
import { Input } from "@/components/ui/input";
import type { ServerSearchItem } from "@/lib/api/servers";
import { formatServerHost } from "@/lib/api/servers";
import { serversSearchQueryOptions } from "@/lib/api/servers.queries";
import { formatPlayers } from "@/lib/formatter";
import { cn } from "cnfast";

type CompareServerSearchProps = {
  selectedIds: Set<string>;
  onAdd: (server: ServerSearchItem) => void;
  disabled?: boolean;
};

const AUTOCOMPLETE_DEBOUNCE_MS = 150;
const AUTOCOMPLETE_MIN_CHARS = 1;

export function CompareServerSearch({
  selectedIds,
  onAdd,
  disabled = false,
}: CompareServerSearchProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
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
    enabled:
      !disabled && isOpen && debouncedQuery.length >= AUTOCOMPLETE_MIN_CHARS,
  });

  const suggestions = (searchData?.servers ?? []).filter(
    (server) => !selectedIds.has(server.id),
  );
  const isSearching = isFetching && suggestions.length === 0;
  const showSuggestions =
    !disabled &&
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
      onAdd(server);
      setValue("");
      closeSuggestions();
      inputRef.current?.focus();
    },
    [closeSuggestions, onAdd],
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
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          globalThis.setTimeout(() => closeSuggestions(), 120);
        }}
        onKeyDown={handleKeyDown}
        placeholder={
          disabled ? "Maximum servers selected" : "Search to add a server…"
        }
        aria-label="Search servers to compare"
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
        className="dashboard-search-input pl-8 pr-8"
      />
      {value ? (
        <button
          type="button"
          className="dashboard-search-clear"
          onClick={() => {
            setValue("");
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
            <div
              className="dashboard-search-suggestion-status"
              aria-live="polite"
            >
              <output>Searching…</output>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="dashboard-search-suggestion-status">
              <output>All matching servers are already selected.</output>
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
                      {formatServerHost(server.host, server.port)}
                    </span>
                  </span>
                  {server.playersOnline != null ? (
                    <span className="dashboard-search-suggestion-players">
                      {formatPlayers(server.playersOnline)}
                    </span>
                  ) : null}
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
