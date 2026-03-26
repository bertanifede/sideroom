import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createHmac } from "crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { guest_name, turnstile_token } = body;

  if (!guest_name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (guest_name.trim().length > 50) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }

  // Verify Turnstile token (bot protection)
  if (!await verifyTurnstileToken(turnstile_token || "")) {
    return NextResponse.json({ error: "Bot verification failed" }, { status: 403 });
  }

  const guest_token = crypto.randomUUID();

  // Use service client to bypass RLS for the RPC call
  const supabase = await createServiceClient();

  // Check party status
  const { data: party } = await supabase
    .from("parties")
    .select("ended_at, payment_status, scheduled_at")
    .eq("id", id)
    .single();

  if (!party) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  const isExpired =
    party.scheduled_at &&
    Date.now() - new Date(party.scheduled_at).getTime() > 6 * 60 * 60 * 1000;

  if (party.ended_at || isExpired) {
    return NextResponse.json({ error: "This party has ended" }, { status: 400 });
  }

  if (party.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Party is not yet available" },
      { status: 403 }
    );
  }

  // Check if party has a PIN set (stored in party_secrets, not publicly queryable)
  const { data: partySecret } = await supabase
    .from("party_secrets")
    .select("pin_hash")
    .eq("party_id", id)
    .single();

  if (partySecret?.pin_hash) {
    const cookieStore = await cookies();
    const pinCookie = cookieStore.get(`party_pin_verified_${id}`)?.value;
    const secret = process.env.COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const expected = createHmac("sha256", secret).update(id).digest("hex");
    if (pinCookie !== expected) {
      return NextResponse.json(
        { error: "Passcode verification required" },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabase.rpc("claim_seat", {
    p_party_id: id,
    p_guest_name: guest_name.trim(),
    p_guest_token: guest_token,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data?.[0];
  if (!result?.success) {
    return NextResponse.json(
      { error: result?.reason || "Could not join party" },
      { status: 400 }
    );
  }

  // Set guest token cookie
  const cookieStore = await cookies();
  cookieStore.set(`party_token_${id}`, guest_token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return NextResponse.json({
    seat_id: result.seat_id,
    guest_token,
    guest_name: guest_name.trim(),
  });
}
