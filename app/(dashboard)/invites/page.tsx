import { getAuthenticatedUser } from "@/lib/auth";
import { fetchPendingInvitesForUser } from "@/actions/group-invites";
import { InvitesListClient } from "./invites-list-client";

export default async function InvitesPage() {
  await getAuthenticatedUser();
  const invites = await fetchPendingInvitesForUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pending Invites</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Group invitations waiting for your response
        </p>
      </div>
      <InvitesListClient invites={JSON.parse(JSON.stringify(invites))} />
    </div>
  );
}
