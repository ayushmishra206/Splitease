import { auth } from "@/auth";
import { fetchInviteByToken } from "@/actions/group-invites";
import { InvitePageClient } from "./invite-page-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const invite = await fetchInviteByToken(token);

  return (
    <InvitePageClient
      token={token}
      invite={invite}
      userEmail={session?.user?.email ?? null}
      isLoggedIn={!!session?.user}
    />
  );
}
