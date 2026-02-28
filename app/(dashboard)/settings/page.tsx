import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  return (
    <SettingsClient
      profile={{
        id: user.id,
        email: user.email ?? "",
        fullName: profile?.fullName ?? "",
        avatarUrl: profile?.avatarUrl ?? null,
        createdAt: profile?.createdAt ?? new Date(),
      }}
    />
  );
}
