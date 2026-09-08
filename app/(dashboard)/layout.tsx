import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { fetchGroups } from "@/actions/groups";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { QuickAddProvider } from "@/components/quick-add-expense";
import { PushPrompt } from "@/components/push-prompt";
import type { GroupWithMembers } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch {
    redirect("/login");
  }

  const serializedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
  };

  const groups = await fetchGroups();
  // Only the fields the quick-add form needs; keeps the client payload small on every page
  const quickAddGroups: GroupWithMembers[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    currency: g.currency,
    status: g.status,
    ownerId: g.ownerId,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    owner: g.owner,
    members: g.members.map((m) => ({ memberId: m.memberId, role: m.role, member: m.member })),
  }));

  return (
    <QuickAddProvider groups={quickAddGroups} currentUserId={serializedUser.id}>
      <div className="flex min-h-dvh bg-background text-foreground">
        <Sidebar user={serializedUser} />
        <main className="relative flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden">
          <Header user={serializedUser} />
          <PushPrompt />
          <div className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 md:pb-8 md:pt-8">
            {children}
          </div>
          <MobileNav />
        </main>
      </div>
    </QuickAddProvider>
  );
}
