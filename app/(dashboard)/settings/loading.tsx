export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
