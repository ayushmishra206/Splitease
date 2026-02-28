export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-800 px-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur text-white text-2xl font-bold mb-6">
          SE
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">SplitEase</h1>
        <p className="text-emerald-100 text-center max-w-xs">
          Split smart. Stay even. The easiest way to share expenses with friends and family.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col bg-background">
        {/* Mobile brand header */}
        <div className="flex items-center gap-3 px-6 py-5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white dark:bg-emerald-600 font-bold text-sm">
            SE
          </div>
          <div>
            <p className="text-sm font-semibold">SplitEase</p>
            <p className="text-[11px] text-muted-foreground">Split smart. Stay even.</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
