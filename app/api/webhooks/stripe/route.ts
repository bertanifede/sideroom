import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { createPartyFromCheckout } from "@/lib/create-party-from-checkout";
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
    try {
      const supabase = await createServiceClient();
      const result = await createPartyFromCheckout(supabase, event.data.object);
      // created | exists | not_paid | no_pending are all terminal — return
      // 200 so Stripe stops retrying. (no_pending is logged inside the
      // shared function; retrying cannot recover deleted data.)
      return NextResponse.json({ received: true, status: result.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Stripe webhook: party creation error:", message);
      // 500 → Stripe retries (genuine transient DB/Stripe failure).
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
