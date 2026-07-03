import { Calendar, Check, ChevronDown, Clock3 } from "lucide-react";
import { useReducer, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover } from "@/components/ui/popover-root";
import { PopoverContent } from "@/components/ui/popover-content";
import { PopoverTrigger } from "@/components/ui/popover-trigger";
import {
  datetimeLocalValueToEpoch,
  epochToDatetimeLocalValue,
} from "@/lib/metrics/datetime-local";
import { METRIC_RANGE_GROUPS } from "@/lib/metrics/range";
import type { MetricTimeRange } from "@/lib/metrics/range";
import {
  formatMetricTimeWindowLabel,
  formatMetricTimeWindowShortLabel,
  isPresetMetricTimeWindow,
  metricTimeWindowToEpochWindow,
  validateMetricEpochWindow,
} from "@/lib/metrics/time-window";
import type { MetricTimeWindow } from "@/lib/metrics/time-window";
import { cn } from "cnfast";

type DashboardTimeRangePickerProps = {
  window: MetricTimeWindow;
  onPresetChange: (range: MetricTimeRange) => void;
  onCustomChange: (from: number, to: number) => void;
  className?: string;
};

function draftFromWindow(window: MetricTimeWindow): {
  from: string;
  to: string;
} {
  const { from, to } = metricTimeWindowToEpochWindow(window);
  return {
    from: epochToDatetimeLocalValue(from),
    to: epochToDatetimeLocalValue(to),
  };
}

type CustomDraftState = {
  from: string;
  to: string;
  customError: string | undefined;
};

type CustomDraftAction =
  | { type: "reset"; window: MetricTimeWindow }
  | { type: "set-from"; value: string }
  | { type: "set-to"; value: string }
  | { type: "set-error"; error: string };

function customDraftReducer(
  state: CustomDraftState,
  action: CustomDraftAction,
): CustomDraftState {
  switch (action.type) {
    case "reset": {
      const draft = draftFromWindow(action.window);
      return { from: draft.from, to: draft.to, customError: undefined };
    }
    case "set-from":
      return { ...state, from: action.value, customError: undefined };
    case "set-to":
      return { ...state, to: action.value, customError: undefined };
    case "set-error":
      return { ...state, customError: action.error };
  }
}

const emptyCustomDraft: CustomDraftState = {
  from: "",
  to: "",
  customError: undefined,
};

export function DashboardTimeRangePicker({
  window,
  onPresetChange,
  onCustomChange,
  className,
}: DashboardTimeRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customDraft, dispatchCustomDraft] = useReducer(
    customDraftReducer,
    emptyCustomDraft,
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      dispatchCustomDraft({ type: "reset", window });
    }
    setOpen(nextOpen);
  };

  const applyCustomRange = () => {
    const from = datetimeLocalValueToEpoch(customDraft.from);
    const to = datetimeLocalValueToEpoch(customDraft.to);
    if (from == null || to == null) {
      dispatchCustomDraft({
        type: "set-error",
        error: "Enter valid start and end times.",
      });
      return;
    }

    const error = validateMetricEpochWindow(from, to);
    if (error) {
      dispatchCustomDraft({ type: "set-error", error });
      return;
    }

    const clampedTo = Math.min(to, Math.floor(Date.now() / 1000));
    onCustomChange(from, clampedTo);
    setOpen(false);
  };

  const selectPreset = (range: MetricTimeRange) => {
    onPresetChange(range);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "dashboard-time-controls-segment dashboard-time-controls-segment--range",
            className,
          )}
          aria-label={`Time range: ${formatMetricTimeWindowLabel(window)}`}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Clock3 className="size-3.5 shrink-0" aria-hidden />
          <span className="dashboard-time-controls-segment-label dashboard-time-controls-segment-label--short">
            {formatMetricTimeWindowShortLabel(window)}
          </span>
          <span className="dashboard-time-controls-segment-label dashboard-time-controls-segment-label--full">
            {formatMetricTimeWindowLabel(window)}
          </span>
          <ChevronDown
            className="dashboard-time-controls-segment-chevron size-3.5"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="dashboard-time-range-picker w-[min(100vw-1.5rem,42rem)] p-0"
      >
        <div className="dashboard-time-range-picker-layout">
          <aside className="dashboard-time-range-picker-quick">
            <header className="dashboard-time-range-picker-section-header">
              <Clock3 className="size-3.5 shrink-0" aria-hidden />
              <span>Quick ranges</span>
            </header>
            <div className="dashboard-time-range-picker-groups">
              {METRIC_RANGE_GROUPS.map((group) => (
                <div
                  key={group.id}
                  className="dashboard-time-range-picker-group"
                >
                  <p className="dashboard-time-range-picker-group-label">
                    {group.label}
                  </p>
                  <ul className="dashboard-time-range-picker-options">
                    {group.options.map((option) => {
                      const selected = isPresetMetricTimeWindow(
                        window,
                        option.value,
                      );

                      return (
                        <li key={option.value}>
                          <button
                            type="button"
                            className={cn(
                              "dashboard-time-range-picker-option",
                              selected &&
                                "dashboard-time-range-picker-option--selected",
                            )}
                            onClick={() => selectPreset(option.value)}
                          >
                            <span>{option.label}</span>
                            {selected ? (
                              <Check
                                className="size-3.5 shrink-0"
                                aria-hidden
                              />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          <aside className="dashboard-time-range-picker-custom">
            <div className="dashboard-time-range-picker-custom-body">
              <header className="dashboard-time-range-picker-section-header">
                <Calendar className="size-3.5 shrink-0" aria-hidden />
                <span>Custom range</span>
              </header>
              <div className="dashboard-time-range-picker-fields">
                <div className="dashboard-time-range-picker-field">
                  <Label htmlFor="dashboard-time-range-from">From</Label>
                  <div className="dashboard-time-range-picker-input-wrap">
                    <Input
                      id="dashboard-time-range-from"
                      type="datetime-local"
                      value={customDraft.from}
                      onChange={(event) => {
                        dispatchCustomDraft({
                          type: "set-from",
                          value: event.target.value,
                        });
                      }}
                      aria-invalid={customDraft.customError ? true : undefined}
                    />
                    <Calendar
                      className="dashboard-time-range-picker-input-icon"
                      aria-hidden
                    />
                  </div>
                </div>
                <div className="dashboard-time-range-picker-field">
                  <Label htmlFor="dashboard-time-range-to">To</Label>
                  <div className="dashboard-time-range-picker-input-wrap">
                    <Input
                      id="dashboard-time-range-to"
                      type="datetime-local"
                      value={customDraft.to}
                      onChange={(event) => {
                        dispatchCustomDraft({
                          type: "set-to",
                          value: event.target.value,
                        });
                      }}
                      aria-invalid={customDraft.customError ? true : undefined}
                    />
                    <Calendar
                      className="dashboard-time-range-picker-input-icon"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
              {customDraft.customError ? (
                <p className="dashboard-time-range-picker-error" role="alert">
                  {customDraft.customError}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="dashboard-time-range-picker-apply"
              onClick={applyCustomRange}
            >
              Apply range
            </Button>
          </aside>
        </div>
      </PopoverContent>
    </Popover>
  );
}
