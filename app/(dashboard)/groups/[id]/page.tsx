import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { fetchGroupDetail } from "@/actions/group-detail";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let user, data;
  try {
    [user, data] = await Promise.all([
      getAuthenticatedUser(),
      fetchGroupDetail(id),
    ]);
  } catch {
    redirect("/groups");
  }

  return <GroupDetailClient data={data} currentUserId={user.id} />;
}
