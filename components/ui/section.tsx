export function SectionHeader({ 
  title, 
  subtitle 
}: {
  title: string; 
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
