import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { generateInviteCode } from "@/lib/invite-code";
import { hashPin } from "@/lib/pin";

interface PartyData {
  title: string;
  description?: string | null;
  seat_limit: number;
  scheduled_at: string;
  cover_image_path?: string | null;
  theme?: unknown;
  pin?: string | null;
  tracks?: {
    file_path: string;
    file_name: string;
    position: number;
    duration?: number | null;
  }[];
}

type PartyRef = { id: string; invite_code: string };

export type CreatePartyResult =
  | { status: "created"; party: PartyRef; inviteCode: string }
  | { status: "exists"; party: PartyRef; inviteCode: string }
  | { status: "not_paid" }
  | { status: "no_pending" };

/**
 * Creates a party from a completed Stripe Checkout session.
 *
 * The single source of truth for checkout-driven party creation, called by
 * both the Stripe webhook and the /api/checkout/finalize endpoint.
 *
 * - Payment-gated: creates nothing unless `session.payment_status === "paid"`.
 * - Idempotent: a party already created for the session is returned as-is.
 * - Race-safe: relies on the UNIQUE index on parties.stripe_session_id;
 *   the loser of a webhook-vs-finalize race returns the winner's party.
 */
export async function createPartyFromCheckout(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<CreatePartyResult> {
  // 1. Payment gate — Stripe is the source of truth.
  if (session.payment_status !== "paid") {
    return { status: "not_paid" };
  }

  const sessionId = session.id;

  // 2. Idempotency — has a party already been created for this session?
  const { data: existing } = await supabase
    .from("parties")
    .select("id, invite_code")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (existing) {
    return { status: "exists", party: existing, inviteCode: existing.invite_code };
  }

  // 3. Load the pending checkout captured at checkout time.
  const { data: pending } = await supabase
    .from("pending_checkouts")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (!pending) {
    console.error(
      "createPartyFromCheckout: no pending checkout for session",
      sessionId
    );
    return { status: "no_pending" };
  }

  const partyData = pending.party_data as PartyData;

  // 4. Generate a unique invite code (invite_code is also UNIQUE in the DB).
  let invite_code = "";
  let codeFound = false;
  for (let attempts = 0; attempts < 5; attempts++) {
    invite_code = generateInviteCode();
    const { data: clash } = await supabase
      .from("parties")
      .select("id")
      .eq("invite_code", invite_code)
      .maybeSingle();
    if (!clash) {
      codeFound = true;
      break;
    }
  }
  if (!codeFound) {
    throw new Error(
      "createPartyFromCheckout: could not generate a unique invite code"
    );
  }

  // 5. Hash the PIN if one was set.
  let pin_hash: string | null = null;
  if (partyData.pin) {
    pin_hash = await hashPin(partyData.pin);
  }

  // 6. Insert the party.
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .insert({
      invite_code,
      artist_id: pending.artist_id,
      title: partyData.title,
      description: partyData.description ?? null,
      seat_limit: partyData.seat_limit,
      scheduled_at: partyData.scheduled_at,
      payment_status: "paid",
      cover_image_path: partyData.cover_image_path ?? null,
      theme: partyData.theme ?? null,
      stripe_session_id: sessionId,
      // Legacy fields — populated from the first track.
      file_path: partyData.tracks?.[0]?.file_path,
      file_name: partyData.tracks?.[0]?.file_name,
    })
    .select("id, invite_code")
    .single();

  if (partyError) {
    // 23505 = unique violation. The other path (webhook vs finalize) won
    // the race and already created the party — return that one.
    if (partyError.code === "23505") {
      const { data: raced } = await supabase
        .from("parties")
        .select("id, invite_code")
        .eq("stripe_session_id", sessionId)
        .single();
      if (raced) {
        return { status: "exists", party: raced, inviteCode: raced.invite_code };
      }
    }
    throw new Error(`Party creation failed: ${partyError.message}`);
  }

  // 7. Store the PIN hash in the secrets table.
  if (pin_hash) {
    const { error: secretError } = await supabase
      .from("party_secrets")
      .insert({ party_id: party.id, pin_hash });
    if (secretError) {
      console.error(
        "createPartyFromCheckout: failed to store PIN hash for party",
        party.id,
        secretError.message
      );
    }
  }

  // 8. Insert tracks.
  if (partyData.tracks?.length) {
    const trackRows = partyData.tracks.map((t) => ({
      party_id: party.id,
      position: t.position,
      file_path: t.file_path,
      file_name: t.file_name,
      duration: t.duration ?? null,
    }));
    const { error: tracksError } = await supabase
      .from("tracks")
      .insert(trackRows);
    if (tracksError) {
      // Roll back the party so it is not left track-less.
      await supabase.from("parties").delete().eq("id", party.id);
      throw new Error(`Track creation failed: ${tracksError.message}`);
    }
  }

  // 9. Delete the consumed pending checkout.
  await supabase.from("pending_checkouts").delete().eq("id", pending.id);

  return { status: "created", party, inviteCode: party.invite_code };
}
