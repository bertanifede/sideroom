const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    // Turnstile not configured — fail open in development
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not set, skipping verification");
    return true;
  }

  if (!token) {
    // Client-side Turnstile widget failed to resolve — fail open
    console.warn("[turnstile] No token provided (widget may have failed), skipping verification");
    return true;
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verification error:", err);
    // Fail open — don't block guests if Cloudflare is unreachable
    return true;
  }
}
