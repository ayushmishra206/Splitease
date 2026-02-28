import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Cached per-request auth call. React's cache() deduplicates
 * within a single server request, so multiple components/actions
 * calling this only make one Supabase getUser() network call.
 */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
});
