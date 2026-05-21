import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PartyRoom from "@/components/party/PartyRoom";
import { PartyFeedbackList } from "@/components/dashboard/PartyFeedbackList";
import PostPartyReview from "@/components/party/review/PostPartyReview";
import { Feedback, PartyTheme } from "@/types";
import { partyLifecycle } from "@/lib/party-lifecycle";
import JoinForm from "./JoinForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}): Promise<Metadata> {
  const { inviteCode } = await params;
  const supabase = await createServiceClient();

  const { data: party } = await supabase
    .from("parties")
    .select("title, description, cover_image_path")
    .eq("invite_code", inviteCode)
    .single();

  if (!party) return {};

  const title = `${party.title} — sideroom`;
  const description = party.description || "Private listening sessions for unreleased music";
  const ogImage = party.cover_image_path
    ? { url: `/api/og-image/${inviteCode}`, width: 1200, height: 1200 }
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(ogImage && { images: [ogImage] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage && { images: [ogImage.url] }),
    },
  };
}

async function getCoverImageUrl(coverImagePath: string | null | undefined): Promise<string | null> {
  if (!coverImagePath) return null;
  const supabase = await createServiceClient();
  const { data } = await supabase.storage
    .from("party-images")
    .createSignedUrl(coverImagePath, 60 * 60 * 4);
  return data?.signedUrl ?? null;
}

export default async function PartyPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  const supabase = await createClient();

  // Fetch party by invite code
  const { data: party } = await supabase
    .from("parties")
    .select("*")
    .eq("invite_code", inviteCode)
    .single();

  if (!party) notFound();

  // Ended = host ended it, 1h past wind-down, or 6h past the scheduled start.
  const lifecycle = partyLifecycle(party, Date.now());

  if (lifecycle === "ended") {
    const coverImageUrl = await getCoverImageUrl(party.cover_image_path);
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    const isHost = currentUser?.id === party.artist_id;

    // If files still available, show review mode with waveform annotations
    if (!party.files_deleted) {
      const service = await createServiceClient();
      const { data: tracks } = await service
        .from("tracks")
        .select("*")
        .eq("party_id", party.id)
        .order("position", { ascending: true });

      // Guests need a valid seat token to access review
      if (!isHost) {
        const cookieStore = await cookies();
        const guestToken = cookieStore.get(`party_token_${party.id}`)?.value;
        if (!guestToken) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-brand-blue text-text-primary">
              <div className="text-center px-6">
                <h2 className="text-2xl font-bold mb-4">Party Ended</h2>
                <a href="/" className="text-sm opacity-50 hover:opacity-80">Back to Home</a>
              </div>
            </div>
          );
        }
      }

      const theme: PartyTheme = {
        bg: party.theme?.bg ?? "#0c51da",
        fg: party.theme?.fg ?? "#ffffff",
        accent: party.theme?.accent ?? "#4a9aff",
        surface: party.theme?.surface ?? "#0a3fa8",
        font: party.theme?.font,
      };

      return (
        <PostPartyReview
          party={party}
          tracks={tracks ?? []}
          isHost={isHost}
          coverImageUrl={coverImageUrl}
          theme={theme}
        />
      );
    }

    // Files deleted — show simple ended screen (existing behavior)
    let feedback: Feedback[] = [];
    let listenerCount = 0;
    if (isHost) {
      const service = await createServiceClient();
      const [{ data: fb }, { count }] = await Promise.all([
        service
          .from("feedback")
          .select("*")
          .eq("party_id", party.id)
          .order("created_at", { ascending: true }),
        service
          .from("seats")
          .select("*", { count: "exact", head: true })
          .eq("party_id", party.id),
      ]);
      feedback = (fb ?? []) as Feedback[];
      listenerCount = count ?? 0;
    }

    return (
      <div className="min-h-screen bg-brand-blue text-text-primary">
        <div className="max-w-2xl mx-auto px-6 py-10">
          {isHost && (
            <a
              href="/dashboard"
              className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
            >
              &larr; Back to Dashboard
            </a>
          )}

          <div className={`${isHost ? "mt-6" : "mt-20"} text-center`}>
            {coverImageUrl && (
              <img
                src={coverImageUrl}
                alt={`${party.title} cover`}
                className="w-32 h-32 rounded-lg object-cover mx-auto mb-6"
              />
            )}
            <h1 className="text-2xl font-bold mb-2">{party.title}</h1>
            <p className="text-text-secondary mb-2">This party has ended.</p>
            {isHost && (
              <p className="text-sm text-text-tertiary mb-6">
                {listenerCount} listener{listenerCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {isHost && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold mb-4">Listener Notes</h2>
              <PartyFeedbackList feedback={feedback} />
            </section>
          )}

          {!isHost && (
            <div className="text-center mt-6">
              <a
                href="/"
                className="inline-block px-5 py-2.5 bg-surface border border-surface-border text-text-primary text-sm font-medium rounded-full hover:bg-surface-hover transition-colors"
              >
                Back to Home
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Use service client for data behind restrictive RLS
  const serviceClient = await createServiceClient();
  const { data: tracks } = await serviceClient
    .from("tracks")
    .select("*")
    .eq("party_id", party.id)
    .order("position", { ascending: true });

  // Get signed URL for cover image
  const coverImageUrl = await getCoverImageUrl(party.cover_image_path);

  // Check if current user is the artist
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isArtist = user?.id === party.artist_id;

  // Check for existing guest token
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(`party_token_${party.id}`)?.value;

  // If artist, auto-join as host
  if (isArtist) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user!.id)
      .single();

    const artistName = profile?.display_name || user!.email?.split("@")[0] || "host";

    return (
      <PartyRoom
        party={party}
        tracks={tracks ?? []}
        isArtist={true}
        guestName={artistName}
        avatarUrl={profile?.avatar_url ?? null}
        seatId="artist"
        coverImageUrl={coverImageUrl}
        initialPlaybackState={party.playback_state}
      />
    );
  }

  // If guest already joined (has token), find their seat
  // Use service client since RLS restricts seats to artist only
  if (guestToken) {
    const { data: seat } = await serviceClient
      .from("seats")
      .select("id, guest_name")
      .eq("guest_token", guestToken)
      .eq("party_id", party.id)
      .is("left_at", null)
      .single();

    if (seat) {
      return (
        <PartyRoom
          party={party}
          tracks={tracks ?? []}
          isArtist={false}
          guestName={seat.guest_name}
          seatId={seat.id}
          coverImageUrl={coverImageUrl}
          initialPlaybackState={party.playback_state}
        />
      );
    }
  }

  // Count active seats (service client — RLS restricts seats to artist only)
  const { count } = await serviceClient
    .from("seats")
    .select("*", { count: "exact", head: true })
    .eq("party_id", party.id)
    .is("left_at", null);

  const seatsAvailable = party.seat_limit - (count || 0);

  // Check if party has a PIN (stored in party_secrets, not on parties table)
  const [{ data: partySecret }, { data: artistProfile }] = await Promise.all([
    serviceClient
      .from("party_secrets")
      .select("party_id")
      .eq("party_id", party.id)
      .single(),
    serviceClient
      .from("profiles")
      .select("display_name")
      .eq("id", party.artist_id)
      .single(),
  ]);
  const hasPin = !!partySecret;
  const artistName = artistProfile?.display_name || "Someone";

  // Show join form / waiting room
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-blue text-text-primary">
      <div className="max-w-md w-full px-6 text-center">
        {coverImageUrl && (
          <img
            src={coverImageUrl}
            alt={`${party.title} cover`}
            className="w-32 h-32 rounded-lg object-cover mx-auto mb-6"
          />
        )}

        <p className="text-text-secondary mb-6">{artistName} invited you to</p>

        <JoinForm
          partyId={party.id}
          partyTitle={party.title}
          scheduledAt={party.scheduled_at}
          seatsAvailable={seatsAvailable}
          seatLimit={party.seat_limit}
          hasPin={hasPin}
        />
      </div>
    </div>
  );
}
