import { fetchDashboardData } from "@/actions/dashboard";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await fetchDashboardData();

  return <DashboardClient data={data} currentUserId={user!.id} />;
}
