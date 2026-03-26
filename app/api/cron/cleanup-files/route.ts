import { createServiceClient } from "@/lib/supabase/server";
import { cleanupPartyFiles } from "@/lib/cleanup-party-files";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const result = await cleanupPartyFiles(supabase);

  if (result.errors.length > 0) {
    console.error("[cleanup-files] Errors:", result.errors);
  }

  return NextResponse.json(result);
}
