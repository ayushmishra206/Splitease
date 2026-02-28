import { prisma } from "@/lib/prisma";
import type { User } from "@supabase/supabase-js";

/**
 * Fire-and-forget profile sync. Runs the upsert without awaiting
 * so it doesn't block layout rendering. Errors are silently caught.
 */
export function syncProfile(user: User) {
  const fullName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

  prisma.profile
    .upsert({
      where: { id: user.id },
      update: { fullName, avatarUrl: user.user_metadata?.avatar_url },
      create: {
        id: user.id,
        fullName,
        avatarUrl: user.user_metadata?.avatar_url,
      },
    })
    .catch(() => {
      // Silently ignore — profile sync is best-effort
    });
}
