import { Calendar, Check, ChevronDown, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  datetimeLocalValueToEpoch,
  epochToDatetimeLocalValue,
} from "@/lib/metrics/datetime-local";
import {
  METRIC_RANGE_GROUPS,
  type MetricTimeRange,
} from "@/lib/metrics/range";
import {
  formatMetricTimeWindowLabel,
  isPresetMetricTimeWindow,
  metricTimeWindowToEpochWindow,
  validateMetricEpochWindow,
  type MetricTimeWindow,
} from "@/lib/metrics/time-window";
import { cn } from "@/lib/utils";

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

export function DashboardTimeRangePicker({
  window,
  onPresetChange,
  onCustomChange,
  className,
}: DashboardTimeRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [customError, setCustomError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) {
      return;
    }

    const draft = draftFromWindow(window);
    setDraftFrom(draft.from);
    setDraftTo(draft.to);
    setCustomError(undefined);
  }, [open, window]);

  const applyCustomRange = () => {
    const from = datetimeLocalValueToEpoch(draftFrom);
    const to = datetimeLocalValueToEpoch(draftTo);
    if (from == null || to == null) {
      setCustomError("Enter valid start and end times.");
      return;
    }

    const error = validateMetricEpochWindow(from, to);
    if (error) {
      setCustomError(error);
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "dashboard-time-controls-segment dashboard-time-controls-segment--range",
            className,
          )}
          aria-label="Chart time range"
          onMouseDown={(event) => event.preventDefault()}
        >
          <Clock3 className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {formatMetricTimeWindowLabel(window)}
          </span>
          <ChevronDown
            className="size-3 shrink-0 opacity-70"
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
                <div key={group.id} className="dashboard-time-range-picker-group">
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
                      value={draftFrom}
                      onChange={(event) => {
                        setDraftFrom(event.target.value);
                        setCustomError(undefined);
                      }}
                      aria-invalid={customError ? true : undefined}
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
                      value={draftTo}
                      onChange={(event) => {
                        setDraftTo(event.target.value);
                        setCustomError(undefined);
                      }}
                      aria-invalid={customError ? true : undefined}
                    />
                    <Calendar
                      className="dashboard-time-range-picker-input-icon"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
              {customError ? (
                <p className="dashboard-time-range-picker-error" role="alert">
                  {customError}
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
