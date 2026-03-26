import { createServiceClient } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/pin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { pin } = body;

  if (!pin?.trim()) {
    return NextResponse.json({ error: "Passcode is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data: secret } = await supabase
    .from("party_secrets")
    .select("pin_hash")
    .eq("party_id", id)
    .single();

  if (!secret?.pin_hash) {
    // No PIN set — allow through
    return NextResponse.json({ verified: true });
  }

  const valid = await verifyPin(pin.trim(), secret.pin_hash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 403 });
  }

  // Set a signed cookie to prove PIN was verified
  const cookieSecret = process.env.COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const signature = createHmac("sha256", cookieSecret).update(id).digest("hex");
  const cookieStore = await cookies();
  cookieStore.set(`party_pin_verified_${id}`, signature, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30, // 30 minutes — enough to complete join flow
  });

  return NextResponse.json({ verified: true });
}
