import { fetchGroups } from "@/actions/groups";
import { getAuthenticatedUser } from "@/lib/auth";
import { GroupList } from "@/components/groups/group-list";

export default async function GroupsPage() {
  const [user, groups] = await Promise.all([
    getAuthenticatedUser(),
    fetchGroups(),
  ]);

  return <GroupList groups={groups} currentUserId={user.id} />;
}
