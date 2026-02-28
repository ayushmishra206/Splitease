export default function GroupDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6 space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
