import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Trust | sideroom",
};

export default function Trust() {
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

        <h1 className="text-3xl font-bold mb-12">Trust</h1>

        <div className="space-y-10 text-sm text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">
              How we protect your music
            </h2>
            <p className="mb-3">
              Your audio is never exposed as a downloadable file. Our server
              streams audio directly to guests. There is no URL to copy, no
              file to save.
            </p>
            <p className="mb-3">
              Only people you invite can join. Invite codes are cryptographically
              random, and you can add a passcode for extra control. Bot
              protection runs on every join request.
            </p>
            <p>
              All audio files are permanently deleted 48 hours after your party
              ends. No backups, no archives. We confirm deletion by email.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">
              What happens when someone presses play
            </h2>
            <p>
              Our server verifies that the guest has a valid seat and the party
              is still active, then streams the audio directly. The guest hears
              music. Their browser sees nothing downloadable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">
              Who can access your files
            </h2>
            <p>
              Only you. Your tracks and storage are locked behind row-level
              policies that restrict access to the party&apos;s artist. Guests
              never touch your data. Our server handles everything on their
              behalf.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">
              What we can&apos;t prevent
            </h2>
            <p>
              A guest can record what they hear. Screen recording, browser
              extensions, or a phone held to speakers. Your
              guests are people you chose to invite.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">
              Infrastructure
            </h2>
            <p className="mb-3">
              Stored on Supabase (AWS) with encryption at rest. Runs on Vercel.
              No analytics, tracking, or advertising.
            </p>
            <p>
              To report a security concern:{" "}
              <a
                href="mailto:contact@sideroom.link"
                className="text-primary hover:underline"
              >
                contact@sideroom.link
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
