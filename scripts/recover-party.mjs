// One-off recovery: create a party from a paid pending_checkout whose
// Stripe webhook never landed (307 redirect bug). Replicates the logic in
// app/api/webhooks/stripe/route.ts exactly.
//
// Usage:  node scripts/recover-party.mjs <pending_checkout_id> [--commit]
// Without --commit it does a dry run and prints what it would do.

import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";

// --- load env from .env.local ---
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const pendingId = process.argv[2];
const COMMIT = process.argv.includes("--commit");
if (!pendingId) {
  console.error("Usage: node scripts/recover-party.mjs <pending_checkout_id> [--commit]");
  process.exit(1);
}

const H = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// --- invite code generation (mirrors lib/invite-code.ts) ---
const adjectives = ["cosmic","velvet","golden","silent","lunar","neon","crystal","shadow","amber","violet","copper","mystic","arctic","solar","thunder","iron","coral","ember","frost","jade","ocean","ruby","sage","dusk"];
const nouns = ["session","groove","wave","echo","pulse","loop","vibe","tone","drift","bloom","spark","chord","bass","beat","haze","glow","sonic","flux","realm","orbit","phase","ride","rush","dawn"];
const rand = (max) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
function generateInviteCode() {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${adjectives[rand(adjectives.length)]}-${nouns[rand(nouns.length)]}-${hex}`;
}

async function main() {
  // 1. Fetch the pending checkout
  const [pending] = await rest(`pending_checkouts?id=eq.${pendingId}&select=*`);
  if (!pending) throw new Error(`No pending_checkout with id ${pendingId}`);
  const partyData = pending.party_data;
  console.log(`Pending checkout: "${partyData.title}" (artist ${pending.artist_id})`);
  console.log(`Stripe session:   ${pending.stripe_session_id}`);
  console.log(`Tracks:           ${partyData.tracks?.length ?? 0}`);

  // 2. Idempotency guard — bail if a party already exists for this session
  const existing = await rest(`parties?stripe_session_id=eq.${pending.stripe_session_id}&select=id,invite_code`);
  if (existing.length) {
    console.log(`\n⚠️  Party already exists (${existing[0].invite_code}). Nothing to do.`);
    return;
  }

  // 3. Unique invite code
  let invite_code;
  for (let i = 0; i < 5; i++) {
    invite_code = generateInviteCode();
    const clash = await rest(`parties?invite_code=eq.${invite_code}&select=id`);
    if (!clash.length) break;
  }
  console.log(`Invite code:      ${invite_code}`);

  if (!COMMIT) {
    console.log("\n-- DRY RUN -- re-run with --commit to write.");
    return;
  }

  // 4. Insert the party
  const [party] = await rest(`parties`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      invite_code,
      artist_id: pending.artist_id,
      title: partyData.title,
      description: partyData.description ?? null,
      seat_limit: partyData.seat_limit,
      scheduled_at: partyData.scheduled_at,
      payment_status: "paid",
      cover_image_path: partyData.cover_image_path ?? null,
      theme: partyData.theme ?? null,
      stripe_session_id: pending.stripe_session_id,
      file_path: partyData.tracks?.[0]?.file_path,
      file_name: partyData.tracks?.[0]?.file_name,
    }),
  });
  console.log(`✓ Party created: ${party.id}`);

  // 5. PIN secret (separate table)
  if (partyData.pin) {
    const pin_hash = await bcrypt.hash(partyData.pin, 10);
    await rest(`party_secrets`, {
      method: "POST",
      body: JSON.stringify({ party_id: party.id, pin_hash }),
    });
    console.log(`✓ PIN secret stored`);
  }

  // 6. Tracks
  if (partyData.tracks?.length) {
    await rest(`tracks`, {
      method: "POST",
      body: JSON.stringify(
        partyData.tracks.map((t) => ({
          party_id: party.id,
          position: t.position,
          file_path: t.file_path,
          file_name: t.file_name,
          duration: t.duration ?? null,
        }))
      ),
    });
    console.log(`✓ ${partyData.tracks.length} track(s) inserted`);
  }

  // 7. Remove the pending checkout (also the webhook's dedup guard)
  await rest(`pending_checkouts?id=eq.${pendingId}`, { method: "DELETE" });
  console.log(`✓ pending_checkout removed`);

  console.log(`\n✅ Done. Party live at invite code: ${invite_code}`);
}

main().catch((e) => {
  console.error("\n❌ FAILED:", e.message);
  process.exit(1);
});
