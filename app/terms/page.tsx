import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Use — sideroom",
};

export default function TermsOfUse() {
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

        <h1 className="text-3xl font-bold mb-2">Terms of Use</h1>
        <p className="text-sm text-text-tertiary mb-12">Last updated: February 24, 2026</p>

        <div className="space-y-10 text-sm text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">The Service</h2>
            <p>
              sideroom is a tool for hosting private, real-time listening sessions for
              music. Artists upload audio, invite guests via a link, and everyone listens
              together with synchronized playback and live chat. It is an event tool, not a
              storage or streaming platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Your Content</h2>
            <p className="mb-3">
              You retain all rights to any audio you upload. We claim no ownership, licensing
              rights, or any interest in your music. Your files exist on our servers only for
              the duration needed to host your party.
            </p>
            <p>
              By uploading audio, you represent that you have the right to share it with the
              guests you invite. You are responsible for ensuring you have the necessary rights
              to the content you upload.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Ephemeral Storage</h2>
            <p>
              All uploaded audio files are permanently deleted 48 hours after a party ends. If
              a party is not manually ended, it automatically ends 6 hours after the scheduled
              time. This deletion is irreversible. We do not maintain backups of your audio
              files after deletion.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Content Protection</h2>
            <p className="mb-3">
              We take reasonable technical measures to protect your audio from unauthorized
              access, including private storage, time-limited signed URLs, guest authentication,
              and bot protection.
            </p>
            <p>
              However, we are transparent about limitations: we protect your music from public
              access, but we cannot prevent a trusted guest from recording or downloading audio
              using browser developer tools or screen recording software. By using the service,
              you acknowledge this inherent limitation of web-based audio delivery.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Guest Conduct</h2>
            <p>
              Guests join parties by invitation from the artist. By joining a party, guests
              agree not to redistribute, record, download, or publicly share any audio heard
              during the session. Violation of this trust may result in removal from the party
              and being blocked from future sessions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Payments</h2>
            <p>
              Party creation requires a one-time payment processed through Stripe. Payments
              are non-refundable once a party has been created and audio has been uploaded,
              except at our discretion. No subscriptions or recurring charges apply.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Limitation of Liability</h2>
            <p>
              The service is provided &ldquo;as is&rdquo; without warranties of any kind. We
              are not liable for any unauthorized access to or distribution of your content by
              third parties, service interruptions, or data loss. Our total liability is limited
              to the amount you paid for the specific party in question.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Account Termination</h2>
            <p>
              You may delete your account at any time. We may suspend or terminate accounts
              that violate these terms, upload illegal content, or abuse the service. Upon
              termination, all associated data is deleted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Changes to These Terms</h2>
            <p>
              We may update these terms as the service evolves. Significant changes will be
              communicated via email to registered artists. Continued use of the service after
              changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">Contact</h2>
            <p>
              Questions about these terms? Contact us at{" "}
              <a href="mailto:hello@sideroom.link" className="text-primary hover:underline">
                hello@sideroom.link
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
