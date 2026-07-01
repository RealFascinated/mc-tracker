import { cn } from "cnfast";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("app-shell-page-header", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="app-shell-page-title">{title}</h1>
        {description ? (
          <p className="app-shell-page-description">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
