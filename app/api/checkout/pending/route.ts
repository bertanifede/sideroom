import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("pending_checkouts")
    .select("party_data, artist_id")
    .eq("stripe_session_id", sessionId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Pending checkout not found" }, { status: 404 });
  }

  if (data.artist_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate signed URL for cover image if it exists
  let coverUrl: string | null = null;
  const coverPath = data.party_data?.cover_image_path;
  if (coverPath) {
    const { data: signedData } = await serviceClient.storage
      .from("party-images")
      .createSignedUrl(coverPath, 3600);
    coverUrl = signedData?.signedUrl ?? null;
  }

  return NextResponse.json({
    party_data: data.party_data,
    cover_url: coverUrl,
  });
}
