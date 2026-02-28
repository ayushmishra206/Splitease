export default function ExpensesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
