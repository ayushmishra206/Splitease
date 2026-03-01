import { getAuthenticatedUser } from "@/lib/auth";
import { fetchSettlements } from "@/actions/settlements";
import { fetchGroups } from "@/actions/groups";
import { SettlementList } from "@/components/settlements/settlement-list";

export default async function SettlementsPage() {
  const [user, settlements, groups] = await Promise.all([
    getAuthenticatedUser(),
    fetchSettlements(),
    fetchGroups(),
  ]);

  return (
    <SettlementList
      settlements={settlements}
      groups={groups}
      currentUserId={user.id}
    />
  );
}
