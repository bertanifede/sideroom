import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params;
  const supabase = await createServiceClient();

  const { data: party } = await supabase
    .from("parties")
    .select("cover_image_path")
    .eq("invite_code", inviteCode)
    .single();

  if (!party?.cover_image_path) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: signedUrlData } = await supabase.storage
    .from("party-images")
    .createSignedUrl(party.cover_image_path, 60 * 60 * 4);

  if (!signedUrlData?.signedUrl) {
    return new NextResponse(null, { status: 404 });
  }

  const imageResponse = await fetch(signedUrlData.signedUrl);

  if (!imageResponse.ok) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

  return new NextResponse(imageResponse.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
