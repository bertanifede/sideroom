import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { createPartyFromCheckout } from "@/lib/create-party-from-checkout";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = body?.session_id;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  // Verify payment directly with Stripe — the source of truth.
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("checkout/finalize: Stripe retrieve failed:", message);
    return NextResponse.json({ error: "stripe_unavailable" }, { status: 503 });
  }

  // Ownership — the session must belong to the logged-in user.
  if (session.metadata?.artist_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const serviceClient = await createServiceClient();
    const result = await createPartyFromCheckout(serviceClient, session);

    if (result.status === "created" || result.status === "exists") {
      return NextResponse.json({ invite_code: result.inviteCode });
    }
    if (result.status === "not_paid") {
      return NextResponse.json({ status: "not_paid" });
    }
    // no_pending — the checkout data is gone; cannot self-heal.
    return NextResponse.json({ error: "checkout_data_missing" }, { status: 409 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("checkout/finalize: party creation error:", message);
    return NextResponse.json({ error: "creation_failed" }, { status: 500 });
  }
}
