"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { UploadFile } from "@/hooks/useFileUpload";
import type { Party, Track } from "@/types";
import PartyWizard, { type WizardPayload, type PartyWizardInitialData } from "@/components/party/PartyWizard";
import Link from "next/link";

export default function EditPartyPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<PartyWizardInitialData | null>(null);

  useEffect(() => {
    async function loadParty() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: party } = await supabase
        .from("parties")
        .select("*")
        .eq("id", id)
        .eq("artist_id", user.id)
        .single();

      if (!party) {
        router.push("/dashboard");
        return;
      }

      const typedParty = party as Party;

      if (typedParty.ended_at) {
        setError("This party has ended and cannot be edited.");
        return;
      }

      // Fetch tracks
      const { data: tracks } = await supabase
        .from("tracks")
        .select("*")
        .eq("party_id", id)
        .order("position", { ascending: true });

      const typedTracks = (tracks || []) as Track[];

      // Check if party has a PIN (stored in party_secrets, artist-only RLS)
      const { data: pinSecret } = await supabase
        .from("party_secrets")
        .select("party_id")
        .eq("party_id", id)
        .single();
      const hasPinSet = !!pinSecret;

      // Generate signed cover URL if cover exists
      let coverPreview: string | null = null;
      if (typedParty.cover_image_path) {
        const { data: signedData } = await supabase.storage
          .from("party-images")
          .createSignedUrl(typedParty.cover_image_path, 3600);
        coverPreview = signedData?.signedUrl || null;
      }

      // Transform tracks into UploadFile stubs
      const trackStubs: UploadFile[] = typedTracks.map((t) => ({
        id: t.id,
        file: null,
        name: t.file_name,
        size: 0,
        duration: t.duration ?? null,
        progress: 100,
        status: "complete" as const,
        storagePath: t.file_path,
      }));

      // Parse scheduled_at into date/time parts
      const d = new Date(typedParty.scheduled_at);
      let h = d.getHours();
      const m = d.getMinutes();
      const ap = h >= 12 ? "PM" : "AM";
      if (h > 12) h -= 12;
      if (h === 0) h = 12;

      setInitialData({
        title: typedParty.title,
        description: typedParty.description || "",
        coverPreview,
        existingCoverPath: typedParty.cover_image_path || null,
        scheduledDate: d,
        hour: String(h),
        minute: String(m).padStart(2, "0"),
        ampm: ap,
        seatLimit: typedParty.seat_limit,
        pinEnabled: hasPinSet,
        pin: "",
        hasPinSet,
        themeBg: typedParty.theme?.bg || "#000000",
        themeFg: typedParty.theme?.fg || "#ffffff",
        themeAccent: typedParty.theme?.accent || "#ffffff",
        themeSurface: typedParty.theme?.surface || "#18181b",
        themeFont: typedParty.theme?.font || "",
        initialFiles: trackStubs,
      });

      setLoading(false);
    }

    loadParty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-brand-blue text-text-primary flex items-center justify-center" style={{ backgroundImage: "var(--dot-grid)", backgroundSize: "var(--dot-grid-size)" }}>
        <div className="text-center space-y-4">
          <p className="text-text-secondary">{error}</p>
          <Link
            href="/dashboard"
            className="text-text-primary underline text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !initialData) return null;

  async function handleEdit(payload: WizardPayload) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");

    // Upload new cover image if changed
    let coverImagePath: string | null = payload.existingCoverPath;
    if (payload.coverFile) {
      const ext = payload.coverFile.name.split(".").pop();
      coverImagePath = `${session.user.id}/cover-${crypto.randomUUID()}.${ext}`;
      const { error: coverError } = await supabase.storage
        .from("party-images")
        .upload(coverImagePath, payload.coverFile, {
          contentType: payload.coverFile.type,
          upsert: false,
        });
      if (coverError) throw new Error("Failed to upload cover image: " + coverError.message);
    }

    // Upload new tracks (skips already-complete stubs)
    const results = await payload.uploadAll(session.user.id, session.access_token);
    const failed = results.filter((f) => f.status === "error");
    if (failed.length > 0) {
      throw new Error(`${failed.length} file(s) failed to upload. Retry or remove them.`);
    }

    const tracks = results.map((f, i) => ({
      id: f.id,
      file_path: f.storagePath!,
      file_name: f.name,
      position: i + 1,
      duration: f.duration ?? null,
    }));

    const res = await fetch(`/api/party/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description || null,
        seat_limit: payload.seatLimit,
        scheduled_at: payload.scheduledAt.toISOString(),
        cover_image_path: coverImagePath,
        theme: { bg: payload.themeBg, fg: payload.themeFg, accent: payload.themeAccent, surface: payload.themeSurface, font: payload.themeFont || undefined },
        pin_action: payload.pinAction,
        pin: payload.pinAction === "change" ? payload.pin : undefined,
        tracks,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to save changes");
    }

    toast.success("Party updated successfully");
    router.push("/dashboard");
  }

  return (
    <PartyWizard
      mode="edit"
      initialData={initialData}
      onSubmit={handleEdit}
      submitLabel="Save Changes"
      submittingLabel="Saving..."
      pageTitle="Edit Party"
      pageSubtitle="Update your party details before it starts."
      backHref="/dashboard"
      backConfirmMessage="Are you sure? Unsaved changes will be lost."
    />
  );
}
