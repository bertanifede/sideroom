import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Party, Profile, Feedback } from "@/types";
import { Navbar } from "@/components/dashboard/Navbar";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { DashboardDialogs } from "@/components/dashboard/DashboardDialogs";
import { PostPartySummaryDialog } from "@/components/dashboard/PostPartySummaryDialog";
import { isPrivateRelayEmail } from "@/lib/email-utils";

async function getCoverImageUrl(
  coverImagePath: string | null | undefined
): Promise<string | null> {
  if (!coverImagePath) return null;
  const supabase = await createServiceClient();
  const { data } = await supabase.storage
    .from("party-images")
    .createSignedUrl(coverImagePath, 60 * 60 * 4);
  return data?.signedUrl ?? null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ended?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: parties }, { data: profileData }, { data: userSettings }] =
    await Promise.all([
      supabase
        .from("parties")
        .select("*")
        .eq("artist_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const profile: Profile = profileData ?? {
    id: user.id,
    display_name: null,
    avatar_url: null,
    created_at: new Date().toISOString(),
  };

  const allParties: Party[] = parties ?? [];
  const now = new Date();
  const activeParties: Party[] = [];
  const pastParties: Party[] = [];
  for (const p of allParties) {
    if (p.ended_at || new Date(p.scheduled_at) < now) pastParties.push(p);
    else activeParties.push(p);
  }

  // Fetch cover image URLs in parallel
  const coverUrls: Record<string, string | null> = {};
  await Promise.all(
    allParties.map(async (p) => {
      coverUrls[p.id] = await getCoverImageUrl(p.cover_image_path);
    })
  );

  // Fetch all feedback for this artist's parties
  const service = await createServiceClient();
  const partyIds = allParties.map((p) => p.id);
  const { data: allFeedback } = partyIds.length > 0
    ? await service
        .from("feedback")
        .select("*")
        .in("party_id", partyIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const feedbackByParty: Record<string, Feedback[]> = {};
  for (const fb of (allFeedback ?? []) as Feedback[]) {
    if (!feedbackByParty[fb.party_id]) feedbackByParty[fb.party_id] = [];
    feedbackByParty[fb.party_id].push(fb);
  }

  // Parties that have feedback (for the Notes tab)
  const partiesWithFeedback = allParties.filter((p) => feedbackByParty[p.id]?.length > 0);

  const email = user.email ?? "";
  const hasRelayEmail = isPrivateRelayEmail(email);
  const needsNotificationEmail =
    hasRelayEmail &&
    !userSettings?.notification_email &&
    allParties.length > 0;

  // Post-party summary dialog
  const { ended: endedPartyId } = await searchParams;
  let partySummary: {
    partyId: string;
    title: string;
    coverUrl: string | null;
    attendeeCount: number;
    feedbackCount: number;
    existingFeedback: { rating: number; message: string | null } | null;
  } | null = null;

  if (endedPartyId) {
    const endedParty = allParties.find((p) => p.id === endedPartyId);
    if (endedParty && endedParty.artist_id === user.id) {
      const [{ count: seatCount }, { count: guestFeedbackCount }, { data: hostFeedback }] =
        await Promise.all([
          service.from("seats").select("*", { count: "exact", head: true }).eq("party_id", endedPartyId),
          service.from("feedback").select("*", { count: "exact", head: true }).eq("party_id", endedPartyId),
          service.from("host_feedback").select("rating, message").eq("party_id", endedPartyId).maybeSingle(),
        ]);

      partySummary = {
        partyId: endedPartyId,
        title: endedParty.title,
        coverUrl: coverUrls[endedPartyId] ?? null,
        attendeeCount: seatCount ?? 0,
        feedbackCount: guestFeedbackCount ?? 0,
        existingFeedback: hostFeedback ?? null,
      };
    }
  }

  return (
    <div
      className="h-screen flex flex-col overflow-y-auto bg-brand-blue text-text-primary [scrollbar-gutter:stable]"
      style={{
        backgroundImage: "var(--dot-grid)",
        backgroundSize: "var(--dot-grid-size)",
      }}
    >
      <Navbar profile={profile} email={email} notificationEmail={userSettings?.notification_email ?? null} />

      {needsNotificationEmail && (
        <DashboardDialogs userId={user.id} />
      )}

      {partySummary && (
        <PostPartySummaryDialog summary={partySummary} />
      )}

      <DashboardContent
        activeParties={activeParties}
        pastParties={pastParties}
        coverUrls={coverUrls}
        partiesWithFeedback={partiesWithFeedback}
        feedbackByParty={feedbackByParty}
        isFirstTime={allParties.length === 0}
      />

    </div>
  );
}
