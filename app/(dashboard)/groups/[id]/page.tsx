import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchGroupDetail } from "@/actions/group-detail";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let data;
  try {
    data = await fetchGroupDetail(id);
  } catch {
    redirect("/groups");
  }

  return <GroupDetailClient data={data} currentUserId={user.id} />;
}
