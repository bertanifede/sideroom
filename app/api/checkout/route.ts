import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/pin";
import { stripe } from "@/lib/stripe";
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
  const { title, description, seat_limit, scheduled_at, tracks, cover_image_path, theme, pin, previous_session_id, existing_cover_path } = body;

  // Validate required fields
  if (!title || !tracks?.length) {
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

  // Validate pin if provided
  let pinValue: string | null = null;
  if (pin) {
    const trimmedPin = pin.trim();
    if (trimmedPin.length < 4 || trimmedPin.length > 8 || !/^[a-zA-Z0-9]+$/.test(trimmedPin)) {
      return NextResponse.json(
        { error: "Passcode must be 4–8 alphanumeric characters" },
        { status: 400 }
      );
    }
    pinValue = trimmedPin;
  }

  // Resolve cover image path: use new upload or reuse existing
  const resolvedCoverPath = cover_image_path || existing_cover_path || null;

  // Build party data to store as pending
  const partyData = {
    title,
    description: description || null,
    seat_limit: Math.min(Math.max(seat_limit || 10, 1), 50),
    scheduled_at: scheduled_at || new Date().toISOString(),
    tracks,
    cover_image_path: resolvedCoverPath,
    theme: theme || null,
    pin: pinValue,
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Create Stripe Checkout Session
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
    metadata: { artist_id: user.id },
  });

  // Store pending checkout data with service client (bypasses RLS)
  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("pending_checkouts")
    .insert({
      stripe_session_id: checkoutSession.id,
      artist_id: user.id,
      party_data: partyData,
    });

  if (error) {
    console.error("Failed to store pending checkout:", error.message);
    return NextResponse.json({ error: "Failed to initiate checkout" }, { status: 500 });
  }

  // Clean up old pending checkout row (files are reused, not deleted)
  if (previous_session_id) {
    await serviceClient
      .from("pending_checkouts")
      .delete()
      .eq("stripe_session_id", previous_session_id)
      .eq("artist_id", user.id);
  }

  return NextResponse.json({ checkout_url: checkoutSession.url });
}
