import { SupabaseClient } from "@supabase/supabase-js";
import { getResend, EMAIL_FROM } from "@/lib/resend";
import { getNotificationEmail } from "@/lib/email-utils";
import { tracksDeletedEmail } from "@/lib/emails/tracks-deleted";

interface CleanupResult {
  cleaned: number;
  total: number;
  errors: string[];
}

/**
 * Delete audio files for ended parties, then mark files_deleted.
 * Cover images are preserved so past parties remain visually identifiable.
 * If artistId is provided, only cleans up that artist's parties (for testing).
 * Otherwise cleans up all parties ended 48+ hours ago.
 */
export async function cleanupPartyFiles(
  supabase: SupabaseClient,
  opts?: { artistId?: string; skipTimeCheck?: boolean }
): Promise<CleanupResult> {
  const errors: string[] = [];

  // Find eligible parties
  let query = supabase
    .from("parties")
    .select("id, artist_id, title")
    .eq("files_deleted", false);

  if (opts?.artistId) {
    query = query.eq("artist_id", opts.artistId);
  }

  if (!opts?.skipTimeCheck) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    // Clean up parties that were either:
    // 1. Explicitly ended 48+ hours ago, OR
    // 2. Never ended but scheduled 48+ hours ago (artist never clicked "End Party")
    query = query.or(
      `ended_at.lt.${cutoff},and(ended_at.is.null,scheduled_at.lt.${cutoff})`
    );
  } else {
    // For testing: no time or ended_at filter — clean up all parties
  }

  const { data: parties, error: queryError } = await query;

  if (queryError) {
    return { cleaned: 0, total: 0, errors: [queryError.message] };
  }

  if (!parties || parties.length === 0) {
    return { cleaned: 0, total: 0, errors: [] };
  }

  const total = parties.length;
  let cleaned = 0;

  for (const party of parties) {
    try {
      // Delete tracks from party-audio bucket
      const { data: tracks } = await supabase
        .from("tracks")
        .select("file_path")
        .eq("party_id", party.id);

      const trackPaths = (tracks ?? [])
        .map((t) => t.file_path)
        .filter((p): p is string => !!p);

      if (trackPaths.length > 0) {
        const { error: audioErr } = await supabase.storage
          .from("party-audio")
          .remove(trackPaths);
        if (audioErr) {
          errors.push(`party ${party.id} audio: ${audioErr.message}`);
        }
      }

      // Mark files as deleted (cover images preserved for visual history)
      const { error: updateErr } = await supabase
        .from("parties")
        .update({ files_deleted: true })
        .eq("id", party.id);

      if (updateErr) {
        errors.push(`party ${party.id} update: ${updateErr.message}`);
      } else {
        cleaned++;
      }

      // Send deletion notification email to artist
      try {
        const artistEmail = await getNotificationEmail(
          supabase,
          party.artist_id
        );
        if (artistEmail) {
          const { subject, html } = tracksDeletedEmail({
            partyTitle: party.title || "Untitled Party",
          });
          await getResend().emails.send({
            from: EMAIL_FROM,
            to: artistEmail,
            subject,
            html,
          });
          console.log(
            `[cleanup] Deletion email sent for party ${party.id} to ${artistEmail}`
          );
        }
      } catch (emailErr) {
        errors.push(
          `party ${party.id} email: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`
        );
      }

      console.log(
        `[cleanup] Party ${party.id} files deleted (artist: ${party.artist_id})`
      );
    } catch (err) {
      errors.push(
        `party ${party.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { cleaned, total, errors };
}
