import Link from "next/link";
import { BrowserFrame } from "@/components/landing/BrowserFrame";
import { DotGrid } from "@/components/landing/DotGrid";
import { FadeIn } from "@/components/landing/FadeIn";

export default function Home() {
  return (
    <div
      className="min-h-screen flex flex-col bg-brand-blue text-foreground text-center font-pixel"
      style={{
        backgroundImage: "var(--dot-grid)",
        backgroundSize: "var(--dot-grid-size)",
      }}
    >
      <DotGrid />

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-3">
        <Link href="/" className="font-medium text-white tracking-widest">
          sideroom
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium px-4 py-1.5 border border-current/20 bg-white/15 rounded-full hover:bg-white/5 transition-colors"
        >
          Get Started
        </Link>
      </header>

      <main className="relative z-10 flex-1 mt-8 p-3 max-w-7xl mx-auto space-y-12 md:space-y-14">
        {/* Section 1 & 2: Headlines */}
        <section>
          <h1 className="text-[clamp(1.9rem,5vw,2.2rem)] leading-[1.1] tracking-tight font-medium ">
            Private listening sessions for your unreleased music
          </h1>
        </section>

        {/* Section 3: The Experience */}
        <FadeIn>
          <section className="flex justify-center">
            <div className="w-full max-w-5xl">
              <BrowserFrame>
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                  src="/party-video.mp4"
                />
              </BrowserFrame>
            </div>
          </section>
        </FadeIn>

        {/* Trust statement */}
        <FadeIn>
          <p className="text-current/80 text-sm leading-relaxed">
            Your files are encrypted, automatically deleted after 48 hours, and
            we never claim rights to your music.
          </p>
        </FadeIn>

        {/* Section 4: How It Works — 4 cards */}
        <section className="-mx-3 grid grid-cols-1 md:grid-cols-4 gap-3 px-3">
          <FadeIn delay={0}>
            <div className="border border-dotted border-current/20 rounded-xl p-6 flex flex-col items-center gap-4 h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/upload.svg" alt="" width={48} height={48} className="opacity-40 invert" />
              <div>
                <p className="text-lg font-medium">Upload</p>
                <p className="text-sm text-current/80 mt-1">Drag in your unreleased tracks and album cover.</p>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="border border-dotted border-current/20 rounded-xl p-6 flex flex-col items-center gap-4 h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/customize.svg" alt="" width={40} height={40} className="opacity-40" />
              <div>
                <p className="text-lg font-medium">Customize your party</p>
                <p className="text-sm text-current/80 mt-1">Pick colors and add release notes to make it your own.</p>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={200}>
            <div className="border border-dotted border-current/20 rounded-xl p-6 flex flex-col items-center gap-4 h-full">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current/40">
                <circle cx="10" cy="24" r="4" fill="currentColor" />
                <circle cx="24" cy="24" r="4" fill="currentColor" />
                <circle cx="38" cy="24" r="4" fill="currentColor" />
              </svg>
              <div>
                <p className="text-lg font-medium">Share the invite link</p>
                <p className="text-sm text-current/80 mt-1">Add a passcode if you want. No accounts needed to join.</p>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="border border-dotted border-current/20 rounded-xl p-6 flex flex-col items-center gap-4 h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/listen-together.svg" alt="" width={48} height={48} />
              <div>
                <p className="text-lg font-medium">Listen together</p>
                <p className="text-sm text-current/80 mt-1">Gather notes, feedback, and chat using the real-time chat.</p>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* Section 5: Who it's for */}
        <FadeIn>
          <section className="max-w-3xl mx-auto space-y-10">
            <h2 className="text-[clamp(1.4rem,4vw,1.75rem)] leading-[1.2] tracking-tight font-medium">
              Built for artists, producers, and anyone sitting on unreleased music
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-dotted border-current/20 rounded-xl p-6 flex flex-col items-center gap-4 text-center">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current/40">
                  <circle cx="6" cy="10" r="3.5" fill="currentColor" />
                  <circle cx="40" cy="6" r="3.5" fill="currentColor" />
                  <circle cx="20" cy="24" r="3.5" fill="currentColor" />
                  <circle cx="42" cy="38" r="3.5" fill="currentColor" />
                  <circle cx="10" cy="40" r="3.5" fill="currentColor" />
                </svg>
                <div>
                  <p className="text-lg font-medium">Your circle is everywhere</p>
                  <p className="text-sm text-current/80 mt-1">
                    Different cities, different schedules. The people whose ears
                    you trust most are rarely in the same room.
                  </p>
                </div>
              </div>

              <div className="border border-dotted border-current/20 rounded-xl p-6 flex flex-col items-center gap-4 text-center">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current/40">
                  <circle cx="24" cy="8" r="3.5" fill="currentColor" />
                  <circle cx="39.2" cy="16.1" r="3.5" fill="currentColor" />
                  <circle cx="33.4" cy="33.9" r="3.5" fill="currentColor" />
                  <circle cx="14.6" cy="33.9" r="3.5" fill="currentColor" />
                  <circle cx="8.8" cy="16.1" r="3.5" fill="currentColor" />
                </svg>
                <div>
                  <p className="text-lg font-medium">One room, everyone listening</p>
                  <p className="text-sm text-current/80 mt-1">
                    sideroom brings your people together to hear your music at the
                    same time, react together, and share what they think while
                    it&apos;s still playing.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Section 6: Questions */}
        <FadeIn>
          <section className="max-w-xl mx-auto text-center space-y-8">
            <h2 className="text-2xl font-medium">Questions</h2>

            <div className="space-y-2">
              <p className="font-medium">Why does sideroom cost money?</p>
              <p className="text-sm text-current/80 leading-relaxed">
                sideroom is an independent project — no venture capital, no ads.
                Your payment covers servers, storage, and the infrastructure
                needed to keep your listening sessions running smoothly.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium">What do you use for payments?</p>
              <p className="text-sm text-current/80 leading-relaxed">
                We use Stripe to process all payments.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium">What happens to my music?</p>
              <p className="text-sm text-current/80 leading-relaxed">
                Your files are encrypted and automatically deleted 48 hours after
                your party ends. We never claim any rights to your music.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-medium">How much does it cost?</p>
              <p className="text-sm text-current/80 leading-relaxed">
                $10 per party. One-time payment — no subscriptions, no hidden
                fees.
              </p>
            </div>
          </section>
        </FadeIn>

        {/* Section 7: CTA */}
        <FadeIn>
          <section className="mt-8 md:mt-10 mb-8 md:mb-10">
            <Link
              href="/login"
              className="inline-flex px-6 py-2 text-sm font-medium border border-current/20 bg-white/15 rounded-full hover:bg-white/5 transition-colors"
            >
              Host a Party
            </Link>
          </section>
        </FadeIn>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-10 py-3 pb-16 sm:pb-3">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4 sm:gap-6 text-xs">
          <span className="order-last sm:order-first">&copy; {new Date().getFullYear()} sideroom</span>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <Link href="/privacy" className="hover:text-current/50 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-current/50 transition-colors">
              Terms of Use
            </Link>
            <Link href="/trust" className="hover:text-current/50 transition-colors">
              Trust
            </Link>
            <a href="mailto:contact@sideroom.link" className="hover:text-current/50 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
