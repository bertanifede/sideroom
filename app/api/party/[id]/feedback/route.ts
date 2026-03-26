import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { message } = body;

  const trimmed = typeof message === "string" ? message.trim() : "";
  if (trimmed.length < 1 || trimmed.length > 1000) {
    return NextResponse.json(
      { error: "Message must be between 1 and 1000 characters" },
      { status: 400 }
    );
  }

  // Verify guest token
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(`party_token_${id}`)?.value;
  if (!guestToken) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Look up seat by token
  const { data: seat } = await supabase
    .from("seats")
    .select("id, guest_name")
    .eq("party_id", id)
    .eq("guest_token", guestToken)
    .single();

  if (!seat) {
    return NextResponse.json({ error: "Seat not found" }, { status: 404 });
  }

  // Verify party has ended
  const { data: party } = await supabase
    .from("parties")
    .select("ended_at")
    .eq("id", id)
    .single();

  if (!party?.ended_at) {
    return NextResponse.json(
      { error: "Party has not ended yet" },
      { status: 400 }
    );
  }

  // Upsert feedback (handles retries gracefully)
  const { error } = await supabase.from("feedback").upsert(
    {
      party_id: id,
      seat_id: seat.id,
      guest_name: seat.guest_name,
      message: trimmed,
    },
    { onConflict: "seat_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
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

  // Use service client to read feedback (RLS would also work via policy, but service is simpler)
  const service = await createServiceClient();
  const { data: feedback } = await service
    .from("feedback")
    .select("*")
    .eq("party_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json(feedback ?? []);
}
