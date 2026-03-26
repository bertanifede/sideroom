import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/invite-code";
import { hashPin } from "@/lib/pin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const supabase = await createServiceClient();

    // Look up pending checkout by stripe session ID
    const { data: pending, error: fetchError } = await supabase
      .from("pending_checkouts")
      .select("*")
      .eq("stripe_session_id", session.id)
      .single();

    if (fetchError || !pending) {
      console.error("Stripe webhook: no pending checkout for session", session.id);
      return NextResponse.json({ error: "No pending checkout found" }, { status: 400 });
    }

    const partyData = pending.party_data;

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
      console.error("Stripe webhook: could not generate unique invite code");
      return NextResponse.json({ error: "Invite code generation failed" }, { status: 500 });
    }

    // Hash pin if provided
    let pin_hash: string | null = null;
    if (partyData.pin) {
      pin_hash = await hashPin(partyData.pin);
    }

    // Create the party
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .insert({
        invite_code,
        artist_id: pending.artist_id,
        title: partyData.title,
        description: partyData.description,
        seat_limit: partyData.seat_limit,
        scheduled_at: partyData.scheduled_at,
        payment_status: "paid",
        cover_image_path: partyData.cover_image_path,
        theme: partyData.theme,
        stripe_session_id: session.id,
        // Legacy fields — populated from first track
        file_path: partyData.tracks[0]?.file_path,
        file_name: partyData.tracks[0]?.file_name,
      })
      .select()
      .single();

    if (partyError) {
      console.error("Stripe webhook: failed to create party:", partyError.message);
      return NextResponse.json({ error: "Party creation failed" }, { status: 500 });
    }

    // Store PIN hash in separate secrets table (not publicly queryable)
    if (pin_hash) {
      await supabase
        .from("party_secrets")
        .insert({ party_id: party.id, pin_hash });
    }

    // Insert tracks
    if (partyData.tracks?.length) {
      const trackRows = partyData.tracks.map(
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
        console.error("Stripe webhook: failed to insert tracks:", tracksError.message);
        // Clean up the party
        await supabase.from("parties").delete().eq("id", party.id);
        return NextResponse.json({ error: "Track creation failed" }, { status: 500 });
      }
    }

    // Delete the pending checkout record
    await supabase
      .from("pending_checkouts")
      .delete()
      .eq("id", pending.id);
  }

  return NextResponse.json({ received: true });
}
