import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Sync profile
  const fullName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  await prisma.profile.upsert({
    where: { id: user.id },
    update: { fullName, avatarUrl: user.user_metadata?.avatar_url },
    create: {
      id: user.id,
      fullName,
      avatarUrl: user.user_metadata?.avatar_url,
    },
  });

  // Serialize user for client components
  const serializedUser = {
    id: user.id,
    email: user.email,
    user_metadata: {
      full_name: user.user_metadata?.full_name,
      avatar_url: user.user_metadata?.avatar_url,
    },
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-50">
      <Sidebar user={serializedUser} />
      <main className="relative flex min-h-screen flex-1 flex-col">
        <Header user={serializedUser} />
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:pb-12">
          {children}
        </div>
        <MobileNav />
      </main>
    </div>
  );
}
