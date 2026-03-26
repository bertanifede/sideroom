"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Provider } from "@supabase/supabase-js";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { DotGrid } from "@/components/landing/DotGrid";

type Step = "idle" | "otp_sent";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    searchParams.get("error") === "auth"
      ? "Authentication failed. Please try again."
      : ""
  );
  const supabase = createClient();

  async function handleOAuthLogin(provider: Provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
    }
  }

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({ email });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStep("otp_sent");
    }
  }

  async function verifyOtp() {
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      setLoading(false);
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  }

  if (step === "otp_sent") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-brand-blue text-white font-pixel"
        style={{
          backgroundImage: "var(--dot-grid)",
          backgroundSize: "var(--dot-grid-size)",
        }}
      >
        <DotGrid />
        <div className="relative z-10 max-w-md w-full px-6 text-center">
          <h1 className="text-2xl font-medium mb-2">Enter your code</h1>
          <p className="text-current/60 mb-8 font-sans">
            We sent an 8-digit code to{" "}
            <span className="text-white">{email}</span>
          </p>

          <div className="flex justify-center mb-6">
            <InputOTP maxLength={8} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
                <InputOTPSlot index={6} />
                <InputOTPSlot index={7} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            onClick={verifyOtp}
            disabled={otp.length < 8 || loading}
            className="w-full px-4 py-3 border border-current/20 bg-white/10 rounded-full font-medium font-sans
                       hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50
                       disabled:cursor-not-allowed"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>

          <div className="mt-4 flex items-center justify-center gap-4 text-sm font-sans">
            <button
              type="button"
              onClick={() => sendOtp()}
              className="text-current/50 hover:text-white transition-colors"
            >
              Resend code
            </button>
            <span className="text-current/20">|</span>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setOtp("");
                setError("");
              }}
              className="text-current/50 hover:text-white transition-colors"
            >
              Use a different email
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm font-sans">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-brand-blue text-white font-pixel"
      style={{
        backgroundImage: "var(--dot-grid)",
        backgroundSize: "var(--dot-grid-size)",
      }}
    >
      <DotGrid />

      {/* Header — matches landing page */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-3">
        <a href="/" className="font-medium text-white tracking-widest hover:opacity-80 transition-opacity">
          sideroom
        </a>
        <div className="w-[44px]" />
      </header>

      {/* Centered content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full flex flex-col items-center">
          <h1 className="text-xl sm:text-2xl font-medium text-center mb-8 leading-tight">
            Host private listening sessions{"\n"}for your unreleased music
          </h1>

          <div className="w-full space-y-3 mb-4">
            <button
              type="button"
              onClick={() => handleOAuthLogin("google")}
              className="w-full flex items-center gap-3 px-5 py-3
                         border border-current/20 bg-white/10 rounded-full font-medium font-sans
                         hover:bg-white/5 transition-colors cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                  fill="#EA4335"
                />
              </svg>
              <span className="flex-1 text-center">Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin("apple")}
              className="w-full flex items-center gap-3 px-5 py-3
                         border border-current/20 bg-white/10 rounded-full font-medium font-sans
                         hover:bg-white/5 transition-colors cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
                <path d="M13.784 9.422c-.02-2.077 1.696-3.076 1.773-3.124-0.965-1.41-2.467-1.604-3.003-1.626-1.278-.13-2.495.753-3.145.753-.648 0-1.652-.734-2.715-.714-1.397.02-2.684.812-3.403 2.063-1.451 2.517-.371 6.247 1.043 8.291.691.999 1.515 2.121 2.597 2.082 1.042-.042 1.435-.674 2.694-.674 1.26 0 1.613.674 2.714.653 1.121-.02 1.836-1.019 2.522-2.021.795-1.16 1.122-2.283 1.142-2.342-.025-.01-2.19-.84-2.213-3.334zM11.716 3.156c.574-.696.962-1.662.856-2.625-.827.034-1.83.551-2.423 1.245-.532.616-.998 1.6-.873 2.544.923.072 1.865-.469 2.44-1.164z" />
              </svg>
              <span className="flex-1 text-center">Continue with Apple</span>
            </button>
          </div>

          <div className="flex items-center gap-4 my-4 w-full">
            <div className="flex-1 h-px bg-current/10" />
            <span className="text-current/40 text-sm font-sans">or</span>
            <div className="flex-1 h-px bg-current/10" />
          </div>

          <button
            id="email-toggle"
            type="button"
            onClick={() => {
              document.getElementById("email-toggle")?.classList.add("hidden");
              document.getElementById("email-section")?.classList.remove("hidden");
            }}
            className="text-sm text-current/50 hover:text-white transition-colors mb-4 font-sans cursor-pointer"
          >
            Sign in with email
          </button>

          <div id="email-section" className="w-full hidden">
            <form onSubmit={sendOtp} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 bg-white/10 border border-current/20 rounded-full
                           text-white placeholder-current/40 focus:outline-none focus:border-current/40 font-sans"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 border border-current/20 bg-white/10 rounded-full font-medium font-sans
                           hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm font-sans">{error}</p>}

          <p className="mt-8 text-xs text-current/40 text-center leading-relaxed font-sans">
            By continuing you confirm that you&apos;ve read and accepted our{" "}
            <a href="/terms" className="underline hover:text-current/70">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-current/70">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
