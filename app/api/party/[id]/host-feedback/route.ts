import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify artist owns the party
  const { data: party } = await supabase
    .from("parties")
    .select("artist_id")
    .eq("id", id)
    .single();

  if (!party || party.artist_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { rating, message } = body;

  if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json(
      { error: "Rating must be an integer between 1 and 5" },
      { status: 400 }
    );
  }

  const trimmedMessage = typeof message === "string" ? message.trim().slice(0, 2000) : null;

  const service = await createServiceClient();
  const { error } = await service.from("host_feedback").upsert(
    {
      party_id: id,
      artist_id: user.id,
      rating,
      message: trimmedMessage || null,
    },
    { onConflict: "party_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
