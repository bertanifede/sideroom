import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Records when the host's last track finished — start of the wind-down. */
export async function POST(
  _request: Request,
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

    const { data: party } = await supabase
      .from("parties")
      .select("artist_id, playback_ended_at")
      .eq("id", id)
      .single();

    if (!party || party.artist_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotent — the first call wins.
    if (party.playback_ended_at) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("parties")
      .update({ playback_ended_at: new Date().toISOString() })
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
