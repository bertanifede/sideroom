import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — sideroom",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-brand-blue text-text-primary">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-text-secondary transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-tertiary mb-12">Last updated: February 24, 2026</p>

        <div className="space-y-10 text-sm text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">What We Collect</h2>
            <p className="mb-3">
              <strong className="text-text-secondary">Artists (account holders):</strong> Your
              email address for authentication and the audio files you upload. We also store
              party metadata you provide (title, description, seat limit, scheduled time).
            </p>
            <p>
              <strong className="text-text-secondary">Guests (no account required):</strong> The
              display name you enter when joining a party. We do not collect your email,
              location, or any personal information beyond your chosen name.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">How We Store Your Data</h2>
            <p className="mb-3">
              All data is stored on Supabase (hosted on AWS) with encryption at rest. Audio
              files are stored in private storage buckets and are only accessible through
              time-limited signed URLs that expire after 4 hours.
            </p>
            <p>
              We do not store audio files permanently. All uploaded audio is automatically
              and permanently deleted 48 hours after your party ends. You will receive an
              email confirmation when deletion is complete.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Cookies</h2>
            <p>We use the following cookies, all essential to the service functioning:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong className="text-text-secondary">Authentication cookies</strong> — Supabase
                session tokens for logged-in artists.
              </li>
              <li>
                <strong className="text-text-secondary">Guest token</strong> — An httpOnly cookie
                that identifies your seat in a party. Contains a random token, not personal
                data.
              </li>
              <li>
                <strong className="text-text-secondary">PIN verification</strong> — A temporary
                cookie (30-minute expiry) confirming you entered the correct party PIN.
              </li>
            </ul>
            <p className="mt-3">
              We do not use tracking cookies, analytics cookies, or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Third-Party Services</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-text-secondary">Supabase</strong> — Database, authentication,
                and file storage. Subject to the{" "}
                <a href="https://supabase.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Supabase Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-text-secondary">Stripe</strong> — Payment processing for
                party creation. We never see or store your full card number. Subject to the{" "}
                <a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Stripe Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-text-secondary">Cloudflare Turnstile</strong> — Bot protection
                when guests join a party. No personal data is collected; it analyzes browser
                signals to distinguish humans from bots.
              </li>
              <li>
                <strong className="text-text-secondary">Vercel</strong> — Application hosting.
                Standard server logs (IP address, user agent) may be retained per{" "}
                <a href="https://vercel.com/legal/privacy-policy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Vercel&apos;s Privacy Policy
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Your Rights</h2>
            <p>
              You can delete your account and all associated data at any time. Audio files
              are deleted automatically after 48 hours regardless. If you have questions about
              your data, contact us at{" "}
              <a href="mailto:privacy@sideroom.link" className="text-primary hover:underline">
                privacy@sideroom.link
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Changes to This Policy</h2>
            <p>
              We may update this policy as the service evolves. Significant changes will be
              communicated via email to registered artists. Continued use of the service
              after changes constitutes acceptance.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
