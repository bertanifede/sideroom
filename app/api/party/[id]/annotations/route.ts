import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partyId } = await params;
  const body = await request.json();
  const { track_id, timestamp_sec, text, is_live_reaction } = body;

  // Validate text
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (trimmed.length < 1 || trimmed.length > 280) {
    return NextResponse.json(
      { error: "Text must be between 1 and 280 characters" },
      { status: 400 }
    );
  }

  // Validate timestamp
  if (typeof timestamp_sec !== "number" || timestamp_sec < 0) {
    return NextResponse.json(
      { error: "Invalid timestamp" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // Verify track belongs to party
  const { data: track } = await supabase
    .from("tracks")
    .select("id")
    .eq("id", track_id)
    .eq("party_id", partyId)
    .single();

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Try guest auth first
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(`party_token_${partyId}`)?.value;

  if (guestToken) {
    const { data: seat } = await supabase
      .from("seats")
      .select("id, guest_name")
      .eq("party_id", partyId)
      .eq("guest_token", guestToken)
      .single();

    if (seat) {
      const { error } = await supabase.from("track_annotations").insert({
        party_id: partyId,
        track_id,
        seat_id: seat.id,
        author_name: seat.guest_name,
        timestamp_sec,
        text: trimmed,
        is_live_reaction: !!is_live_reaction,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
  }

  // Try artist auth
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (user) {
    const { data: party } = await supabase
      .from("parties")
      .select("artist_id")
      .eq("id", partyId)
      .single();

    if (party?.artist_id === user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.from("track_annotations").insert({
        party_id: partyId,
        track_id,
        seat_id: null,
        author_name: profile?.display_name || "Host",
        timestamp_sec,
        text: trimmed,
        is_live_reaction: !!is_live_reaction,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
  }

  return NextResponse.json({ error: "Not authorized" }, { status: 401 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partyId } = await params;
  const { searchParams } = new URL(request.url);
  const annotationId = searchParams.get("annotationId");

  if (!annotationId) {
    return NextResponse.json({ error: "Missing annotationId" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Try guest auth
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(`party_token_${partyId}`)?.value;

  if (guestToken) {
    const { data: seat } = await supabase
      .from("seats")
      .select("id")
      .eq("party_id", partyId)
      .eq("guest_token", guestToken)
      .single();

    if (seat) {
      const { error } = await supabase
        .from("track_annotations")
        .delete()
        .eq("id", annotationId)
        .eq("seat_id", seat.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
  }

  // Try artist auth
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (user) {
    const { data: party } = await supabase
      .from("parties")
      .select("artist_id")
      .eq("id", partyId)
      .single();

    if (party?.artist_id === user.id) {
      // Artist can delete their own annotations (seat_id is null)
      const { error } = await supabase
        .from("track_annotations")
        .delete()
        .eq("id", annotationId)
        .is("seat_id", null);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
  }

  return NextResponse.json({ error: "Not authorized" }, { status: 401 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partyId } = await params;
  const body = await request.json();
  const { annotationId, text } = body;

  if (!annotationId) {
    return NextResponse.json({ error: "Missing annotationId" }, { status: 400 });
  }

  const trimmed = typeof text === "string" ? text.trim() : "";
  if (trimmed.length < 1 || trimmed.length > 280) {
    return NextResponse.json(
      { error: "Text must be between 1 and 280 characters" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // Try guest auth
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(`party_token_${partyId}`)?.value;

  if (guestToken) {
    const { data: seat } = await supabase
      .from("seats")
      .select("id")
      .eq("party_id", partyId)
      .eq("guest_token", guestToken)
      .single();

    if (seat) {
      const { error } = await supabase
        .from("track_annotations")
        .update({ text: trimmed })
        .eq("id", annotationId)
        .eq("seat_id", seat.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
  }

  // Try artist auth
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (user) {
    const { data: party } = await supabase
      .from("parties")
      .select("artist_id")
      .eq("id", partyId)
      .single();

    if (party?.artist_id === user.id) {
      const { error } = await supabase
        .from("track_annotations")
        .update({ text: trimmed })
        .eq("id", annotationId)
        .is("seat_id", null);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
  }

  return NextResponse.json({ error: "Not authorized" }, { status: 401 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partyId } = await params;
  const supabase = await createServiceClient();

  // Try guest auth first
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(`party_token_${partyId}`)?.value;

  if (guestToken) {
    const { data: seat } = await supabase
      .from("seats")
      .select("id")
      .eq("party_id", partyId)
      .eq("guest_token", guestToken)
      .single();

    if (seat) {
      // Guest sees only their own annotations
      const { data: annotations } = await supabase
        .from("track_annotations")
        .select("*")
        .eq("party_id", partyId)
        .eq("seat_id", seat.id)
        .order("timestamp_sec", { ascending: true });

      return NextResponse.json(annotations ?? []);
    }
  }

  // Try artist auth
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (user) {
    const { data: party } = await supabase
      .from("parties")
      .select("artist_id")
      .eq("id", partyId)
      .single();

    if (party?.artist_id === user.id) {
      // Artist sees all annotations
      const { data: annotations } = await supabase
        .from("track_annotations")
        .select("*")
        .eq("party_id", partyId)
        .order("timestamp_sec", { ascending: true });

      return NextResponse.json(annotations ?? []);
    }
  }

  return NextResponse.json({ error: "Not authorized" }, { status: 401 });
}
