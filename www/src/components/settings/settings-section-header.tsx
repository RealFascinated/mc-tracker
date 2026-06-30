function SettingsSectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-xs font-bold text-muted-foreground">{description}</p>
    </div>
  );
}

export { SettingsSectionHeader };
