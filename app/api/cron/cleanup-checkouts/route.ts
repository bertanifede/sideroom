import { createServiceClient } from "@/lib/supabase/server";
import { cleanupPendingCheckout } from "@/lib/cleanup-pending-checkout";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await serviceClient
    .from("pending_checkouts")
    .select("id, party_data")
    .lt("created_at", cutoff);

  if (error) {
    console.error("Failed to query stale checkouts:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let cleaned = 0;
  for (const record of stale ?? []) {
    try {
      await cleanupPendingCheckout(serviceClient, record);
      cleaned++;
    } catch (err) {
      console.error(`Failed to clean up checkout ${record.id}:`, err);
    }
  }

  return NextResponse.json({ cleaned, total: stale?.length ?? 0 });
}
