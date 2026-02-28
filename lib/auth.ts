import { cache } from "react";
import { auth } from "@/auth";

export const getAuthenticatedUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return {
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  };
});
