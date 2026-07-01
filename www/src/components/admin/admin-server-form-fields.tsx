import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateServerRequest } from "@/lib/api/admin/servers";
import { cn } from "cnfast";

type AdminServerFormFieldsProps = {
  idPrefix: string;
  values: CreateServerRequest;
  onChange: (values: CreateServerRequest) => void;
};

function AdminServerFormFields({
  idPrefix,
  values,
  onChange,
}: AdminServerFormFieldsProps) {
  function patch(partial: Partial<CreateServerRequest>) {
    onChange({ ...values, ...partial });
  }

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(event) => patch({ name: event.target.value })}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-host`}>Host</Label>
        <Input
          id={`${idPrefix}-host`}
          value={values.host}
          onChange={(event) => patch({ host: event.target.value })}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-port`}>Port</Label>
        <Input
          id={`${idPrefix}-port`}
          type="number"
          value={values.port ?? ""}
          onChange={(event) =>
            patch({
              port: event.target.value ? Number(event.target.value) : null,
            })
          }
          placeholder="Default"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <select
          id={`${idPrefix}-type`}
          className={cn(
            "flex h-8 w-full rounded-snug border border-border bg-background px-2 text-sm",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
          )}
          value={values.type}
          onChange={(event) => patch({ type: event.target.value })}
        >
          <option value="PC">Java (PC)</option>
          <option value="PE">Bedrock (PE)</option>
        </select>
      </div>
    </>
  );
}

export { AdminServerFormFields };
