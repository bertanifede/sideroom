import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/pin";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch party to verify ownership and state
    const { data: party } = await supabase
      .from("parties")
      .select("artist_id, ended_at, cover_image_path")
      .eq("id", id)
      .single();

    if (!party || party.artist_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (party.ended_at) {
      return NextResponse.json({ error: "Cannot edit an ended party" }, { status: 400 });
    }

    const body = await request.json();
    const {
      title,
      description,
      seat_limit,
      scheduled_at,
      cover_image_path,
      theme,
      pin_action,
      pin,
      tracks,
    } = body;

    // Validate
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (title.length > 100) {
      return NextResponse.json({ error: "Title must be 100 characters or fewer" }, { status: 400 });
    }
    if (description && description.length > 500) {
      return NextResponse.json({ error: "Description must be 500 characters or fewer" }, { status: 400 });
    }
    if (!tracks?.length) {
      return NextResponse.json({ error: "At least one track is required" }, { status: 400 });
    }

    // Build party update
    const update: Record<string, unknown> = {
      title: title.trim(),
      description: description || null,
      seat_limit: Math.min(Math.max(seat_limit || 10, 2), 50),
      scheduled_at: scheduled_at || new Date().toISOString(),
      cover_image_path: cover_image_path || null,
      theme: theme || null,
    };

    // Use service client for storage operations and cross-table updates
    const serviceClient = await createServiceClient();

    // PIN handling — stored in party_secrets table (not publicly queryable)
    if (pin_action === "change" && pin) {
      const trimmedPin = pin.trim();
      if (trimmedPin.length < 4 || trimmedPin.length > 8 || !/^[a-zA-Z0-9]+$/.test(trimmedPin)) {
        return NextResponse.json({ error: "Passcode must be 4–8 alphanumeric characters" }, { status: 400 });
      }
      const newPinHash = await hashPin(trimmedPin);
      await serviceClient
        .from("party_secrets")
        .upsert({ party_id: id, pin_hash: newPinHash });
    } else if (pin_action === "remove") {
      await serviceClient
        .from("party_secrets")
        .delete()
        .eq("party_id", id);
    }
    // "keep" → don't touch party_secrets

    // Update party row
    const { error: updateError } = await serviceClient
      .from("parties")
      .update(update)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // ─── Track sync ───
    // Fetch existing tracks
    const { data: existingTracks } = await serviceClient
      .from("tracks")
      .select("id, file_path")
      .eq("party_id", id);

    const existingTrackMap = new Map(
      (existingTracks || []).map((t) => [t.id, t.file_path])
    );

    const incomingTrackIds = new Set(
      tracks.filter((t: { id?: string }) => t.id).map((t: { id: string }) => t.id)
    );

    // Delete removed tracks (rows + storage files)
    const removedTracks = (existingTracks || []).filter(
      (t) => !incomingTrackIds.has(t.id)
    );

    if (removedTracks.length > 0) {
      const removedIds = removedTracks.map((t) => t.id);
      const removedPaths = removedTracks.map((t) => t.file_path);

      await serviceClient.from("tracks").delete().in("id", removedIds);
      await serviceClient.storage.from("party-audio").remove(removedPaths);
    }

    // Upsert tracks (update position for existing, insert new)
    for (const track of tracks as Array<{
      id?: string;
      file_path: string;
      file_name: string;
      position: number;
      duration?: number | null;
    }>) {
      if (track.id && existingTrackMap.has(track.id)) {
        // Existing track — update position, name, and duration
        await serviceClient
          .from("tracks")
          .update({ position: track.position, file_name: track.file_name, duration: track.duration ?? null })
          .eq("id", track.id);
      } else {
        // New track — insert
        await serviceClient.from("tracks").insert({
          party_id: id,
          file_path: track.file_path,
          file_name: track.file_name,
          position: track.position,
          duration: track.duration ?? null,
        });
      }
    }

    // ─── Cover cleanup ───
    const oldCoverPath = party.cover_image_path;
    if (oldCoverPath && oldCoverPath !== cover_image_path) {
      await serviceClient.storage.from("party-images").remove([oldCoverPath]);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Party update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
