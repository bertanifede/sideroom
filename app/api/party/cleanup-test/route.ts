import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cleanupPartyFiles } from "@/lib/cleanup-party-files";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const result = await cleanupPartyFiles(serviceClient, {
    artistId: user.id,
    skipTimeCheck: true,
  });

  return NextResponse.json(result);
}
