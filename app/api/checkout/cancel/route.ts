import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cleanupPendingCheckout } from "@/lib/cleanup-pending-checkout";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { session_id } = await request.json();

  if (!session_id || typeof session_id !== "string") {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  const { data: pending } = await serviceClient
    .from("pending_checkouts")
    .select("id, artist_id, party_data")
    .eq("stripe_session_id", session_id)
    .single();

  if (!pending) {
    // Already cleaned up or never existed — treat as success
    return NextResponse.json({ status: "ok" });
  }

  if (pending.artist_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await cleanupPendingCheckout(serviceClient, pending);

  return NextResponse.json({ status: "ok" });
}
