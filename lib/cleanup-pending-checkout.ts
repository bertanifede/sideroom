import { SupabaseClient } from "@supabase/supabase-js";

export async function cleanupPendingCheckout(
  supabase: SupabaseClient,
  pending: { id: string; party_data: Record<string, unknown> }
) {
  const partyData = pending.party_data as {
    tracks?: { file_path?: string }[];
    cover_image_path?: string;
  };

  // Delete track files from party-audio
  const trackPaths = (partyData.tracks ?? [])
    .map((t) => t.file_path)
    .filter((p): p is string => !!p);

  if (trackPaths.length > 0) {
    await supabase.storage.from("party-audio").remove(trackPaths);
  }

  // Delete cover image from party-images
  if (partyData.cover_image_path) {
    await supabase.storage
      .from("party-images")
      .remove([partyData.cover_image_path]);
  }

  // Delete the pending_checkouts row
  await supabase.from("pending_checkouts").delete().eq("id", pending.id);
}
