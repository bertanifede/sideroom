import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    // Auth: must be a seated guest or the artist
    const cookieStore = await cookies();
    const guestToken = cookieStore.get(`party_token_${id}`)?.value;

    let authorized = false;

    if (guestToken) {
      const { data: seat } = await supabase
        .from("seats")
        .select("id")
        .eq("party_id", id)
        .eq("guest_token", guestToken)
        .is("left_at", null)
        .single();

      if (seat) authorized = true;
    }

    if (!authorized) {
      const authClient = await createClient();
      const { data: { user } } = await authClient.auth.getUser();

      if (user) {
        const { data: party } = await supabase
          .from("parties")
          .select("artist_id")
          .eq("id", id)
          .single();

        if (party?.artist_id === user.id) authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: party } = await supabase
      .from("parties")
      .select("playback_state")
      .eq("id", id)
      .single();

    return NextResponse.json({ playback_state: party?.playback_state ?? null });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify the caller is the party's artist
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: party } = await supabase
      .from("parties")
      .select("artist_id")
      .eq("id", id)
      .single();

    if (!party || party.artist_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { track_position, position, is_playing } = body;

    const { error } = await supabase
      .from("parties")
      .update({
        playback_state: {
          track_position,
          position,
          is_playing,
          updated_at: new Date().toISOString(),
        },
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
