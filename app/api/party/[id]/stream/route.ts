import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    // --- Fetch party status (needed for both auth and expiry checks) ---
    const { data: party } = await supabase
      .from("parties")
      .select("artist_id, ended_at, scheduled_at, files_deleted")
      .eq("id", id)
      .single();

    if (!party) {
      return new Response("Party not found", { status: 404 });
    }

    // Check if party has ended
    const isExpired =
      party.scheduled_at &&
      Date.now() - new Date(party.scheduled_at).getTime() > 6 * 60 * 60 * 1000;
    const isPostParty = !!(party.ended_at || isExpired);

    // If files are deleted, no streaming regardless of auth
    if (isPostParty && party.files_deleted) {
      return new Response("Party files have been deleted", { status: 410 });
    }

    // --- Auth check: must be a seated guest or the artist ---
    const cookieStore = await cookies();
    const guestToken = cookieStore.get(`party_token_${id}`)?.value;

    let authorized = false;

    if (guestToken) {
      // During active party: guest must have an active seat (left_at IS NULL)
      // Post-party review: any guest who was ever seated can stream (left_at check skipped)
      const query = supabase
        .from("seats")
        .select("id")
        .eq("party_id", id)
        .eq("guest_token", guestToken);

      if (!isPostParty) {
        query.is("left_at", null);
      }

      const { data: seat } = await query.single();
      if (seat) authorized = true;
    }

    if (!authorized) {
      const authClient = await createClient();
      const { data: { user } } = await authClient.auth.getUser();

      if (user && party.artist_id === user.id) authorized = true;
    }

    if (!authorized) {
      return new Response("Unauthorized", { status: 403 });
    }

    // --- Resolve file path ---
    const { searchParams } = new URL(request.url);
    const trackPosition = parseInt(searchParams.get("track") || "1", 10);

    const { data: track } = await supabase
      .from("tracks")
      .select("file_path")
      .eq("party_id", id)
      .eq("position", trackPosition)
      .single();

    let filePath = track?.file_path;

    if (!filePath) {
      const { data: party } = await supabase
        .from("parties")
        .select("file_path")
        .eq("id", id)
        .single();

      filePath = party?.file_path;
    }

    if (!filePath) {
      return new Response("Track not found", { status: 404 });
    }

    // --- Generate signed URL server-side (never sent to client) ---
    const { data: signedUrl, error: storageError } = await supabase.storage
      .from("party-audio")
      .createSignedUrl(filePath, 60); // short-lived: 60 seconds

    if (storageError || !signedUrl) {
      console.error("[stream] storage error:", storageError?.message, "for path:", filePath);
      return new Response("Could not generate stream", { status: 500 });
    }

    // --- Fetch from Supabase, forwarding Range headers ---
    const headers: Record<string, string> = {};
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const upstream = await fetch(signedUrl.signedUrl, { headers });

    // --- Pipe response back to client ---
    const responseHeaders = new Headers();

    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    responseHeaders.set("Accept-Ranges", "bytes");

    return new Response(upstream.body, {
      status: upstream.status, // 200 for full, 206 for range
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[stream] unhandled error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
