export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-100 via-slate-100 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-5xl bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_60%)]" />
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
