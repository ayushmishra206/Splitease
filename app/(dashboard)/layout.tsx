import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

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

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar user={serializedUser} />
      <main className="relative flex min-h-screen flex-1 flex-col">
        <Header user={serializedUser} />
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
          {children}
        </div>
        <MobileNav />
      </main>
    </div>
  );
}
