import { fetchSettlements } from "@/actions/settlements";
import { fetchGroups } from "@/actions/groups";
import { createClient } from "@/lib/supabase/server";
import { SettlementList } from "@/components/settlements/settlement-list";

export default async function SettlementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [settlements, groups] = await Promise.all([
    fetchSettlements(),
    fetchGroups(),
  ]);

  return (
    <SettlementList
      settlements={settlements}
      groups={groups}
      currentUserId={user!.id}
    />
  );
}
