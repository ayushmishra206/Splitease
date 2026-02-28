export default function GroupsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6 space-y-3">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
