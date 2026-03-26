import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Party, Feedback, TrackAnnotation, Track } from "@/types";
import { PartyFeedbackList } from "@/components/dashboard/PartyFeedbackList";
import TrackAnnotationsList from "@/components/dashboard/TrackAnnotationsList";

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const service = await createServiceClient();

  const [
    { data: party },
    { data: feedback },
    { count: listenerCount },
    { data: annotations },
    { data: tracks },
  ] = await Promise.all([
    supabase
      .from("parties")
      .select("*")
      .eq("id", id)
      .eq("artist_id", user.id)
      .single(),
    service
      .from("feedback")
      .select("*")
      .eq("party_id", id)
      .order("created_at", { ascending: true }),
    service
      .from("seats")
      .select("*", { count: "exact", head: true })
      .eq("party_id", id),
    service
      .from("track_annotations")
      .select("*")
      .eq("party_id", id)
      .order("timestamp_sec", { ascending: true }),
    service
      .from("tracks")
      .select("*")
      .eq("party_id", id)
      .order("position", { ascending: true }),
  ]);

  if (!party) redirect("/dashboard");

  const typedParty = party as Party;
  const typedFeedback = (feedback ?? []) as Feedback[];

  return (
    <div className="min-h-screen bg-brand-blue text-text-primary">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link
          href="/dashboard"
          className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
        >
          &larr; Back to Dashboard
        </Link>

        <div className="mt-6 mb-8">
          <h1 className="text-2xl font-bold">{typedParty.title}</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {listenerCount ?? 0} listener{listenerCount !== 1 ? "s" : ""}{" "}
            &middot;{" "}
            {new Date(typedParty.scheduled_at).toLocaleDateString()}
          </p>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4">Listener Notes</h2>
          <PartyFeedbackList feedback={typedFeedback} />
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Track Annotations</h2>
          <TrackAnnotationsList
            annotations={(annotations ?? []) as TrackAnnotation[]}
            tracks={(tracks ?? []) as Track[]}
          />
        </section>
      </div>
    </div>
  );
}
