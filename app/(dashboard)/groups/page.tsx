import { fetchGroups, fetchGroupTotals } from "@/actions/groups";
import { getAuthenticatedUser } from "@/lib/auth";
import { GroupList } from "@/components/groups/group-list";

export default async function GroupsPage() {
  const [user, groups] = await Promise.all([getAuthenticatedUser(), fetchGroups()]);
  const totals = await fetchGroupTotals(groups.map((g) => g.id));

  return <GroupList groups={groups} totals={totals} currentUserId={user.id} />;
}
