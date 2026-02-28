import { fetchGroups } from "@/actions/groups";
import { GroupList } from "@/components/groups/group-list";
import { createClient } from "@/lib/supabase/server";

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const groups = await fetchGroups();

  return <GroupList groups={groups} currentUserId={user!.id} />;
}
