import { StatValueTooltip } from "@/components/dashboard/stats/stat-value-tooltip";

type CardStatProps = {
  label: string;
  value: string;
  valueTooltip?: string;
};

export function CardStat({ label, value, valueTooltip }: CardStatProps) {
  return (
    <div className="entity-card-stat">
      <span className="entity-card-stat-label">{label}</span>
      <StatValueTooltip
        tooltip={valueTooltip}
        value={value}
        className="entity-card-stat-value"
      />
    </div>
  );
}
