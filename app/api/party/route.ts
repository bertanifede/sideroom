import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/invite-code";
import { hashPin } from "@/lib/pin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, seat_limit, scheduled_at, tracks, file_path, file_name, cover_image_path, theme, pin } = body;

  // Support both new multi-track and legacy single-file format
  if (!title || (!tracks?.length && !file_path)) {
    return NextResponse.json(
      { error: "Title and at least one track are required" },
      { status: 400 }
    );
  }

  if (title.length > 100) {
    return NextResponse.json({ error: "Title must be 100 characters or fewer" }, { status: 400 });
  }

  if (description && description.length > 500) {
    return NextResponse.json({ error: "Description must be 500 characters or fewer" }, { status: 400 });
  }

  // Generate unique invite code with collision check
  let invite_code: string;
  let attempts = 0;
  do {
    invite_code = generateInviteCode();
    const { data: existing } = await supabase
      .from("parties")
      .select("id")
      .eq("invite_code", invite_code)
      .single();
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  if (attempts >= 5) {
    return NextResponse.json(
      { error: "Could not generate unique invite code. Please try again." },
      { status: 500 }
    );
  }

  let pin_hash: string | null = null;
  if (pin) {
    const trimmedPin = pin.trim();
    if (trimmedPin.length < 4 || trimmedPin.length > 8 || !/^[a-zA-Z0-9]+$/.test(trimmedPin)) {
      return NextResponse.json(
        { error: "Passcode must be 4–8 alphanumeric characters" },
        { status: 400 }
      );
    }
    pin_hash = await hashPin(trimmedPin);
  }

  const { data: party, error } = await supabase
    .from("parties")
    .insert({
      invite_code,
      artist_id: user.id,
      title,
      description,
      seat_limit: Math.min(Math.max(seat_limit || 10, 1), 50),
      scheduled_at: scheduled_at || new Date().toISOString(),
      payment_status: "paid",
      cover_image_path: cover_image_path || null,
      theme: theme || null,
      // Legacy fields — populated from first track for backward compat
      file_path: tracks?.length ? tracks[0].file_path : file_path,
      file_name: tracks?.length ? tracks[0].file_name : file_name,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store PIN hash in separate secrets table (not publicly queryable)
  if (pin_hash) {
    await supabase
      .from("party_secrets")
      .insert({ party_id: party.id, pin_hash });
  }

  // Insert tracks if provided
  if (tracks?.length) {
    const trackRows = tracks.map(
      (t: { file_path: string; file_name: string; position: number; duration?: number | null }) => ({
        party_id: party.id,
        position: t.position,
        file_path: t.file_path,
        file_name: t.file_name,
        duration: t.duration ?? null,
      })
    );

    const { error: tracksError } = await supabase
      .from("tracks")
      .insert(trackRows);

    if (tracksError) {
      // Clean up the party if track insert fails
      await supabase.from("parties").delete().eq("id", party.id);
      return NextResponse.json(
        { error: "Failed to save tracks: " + tracksError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(party);
}
