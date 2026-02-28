import { fetchDashboardData } from "@/actions/dashboard";
import { getAuthenticatedUser } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const [user, data] = await Promise.all([
    getAuthenticatedUser(),
    fetchDashboardData(),
  ]);

  return <DashboardClient data={data} currentUserId={user.id} />;
}
