import { SupabaseClient } from "@supabase/supabase-js";

export function isPrivateRelayEmail(email: string): boolean {
  return email.endsWith("@privaterelay.appleid.com");
}

/**
 * Resolve the best deliverable email for a user.
 * Returns user_settings.notification_email if set, otherwise the auth email.
 * Requires a service-role client to read auth.users.
 */
export async function getNotificationEmail(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: settings } = await supabase
    .from("user_settings")
    .select("notification_email")
    .eq("user_id", userId)
    .maybeSingle();

  if (settings?.notification_email) return settings.notification_email;

  const { data: { user } } = await supabase.auth.admin.getUserById(userId);

  return user?.email ?? null;
}
