"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UploadFile } from "@/hooks/useFileUpload";
import PartyWizard, { type WizardPayload, type PartyWizardInitialData } from "@/components/party/PartyWizard";

export default function CreatePartyPage() {
  return (
    <Suspense fallback={null}>
      <CreatePartyContent />
    </Suspense>
  );
}

function CreatePartyContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [initialData, setInitialData] = useState<PartyWizardInitialData | undefined>(undefined);
  const existingCoverPathRef = useRef<string | null>(null);

  // Resume pending checkout if session_id is in URL
  useEffect(() => {
    const sid = searchParams.get("session_id");
    if (!sid) return;

    setResumeLoading(true);
    fetch(`/api/checkout/pending?session_id=${encodeURIComponent(sid)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ party_data, cover_url }) => {
        setResumeSessionId(sid);
        existingCoverPathRef.current = party_data.cover_image_path || null;

        let hour = "7", minute = "00", ampm = "PM";
        let scheduledDate: Date | undefined;
        if (party_data.scheduled_at) {
          const d = new Date(party_data.scheduled_at);
          scheduledDate = d;
          let h = d.getHours();
          const m = d.getMinutes();
          ampm = h >= 12 ? "PM" : "AM";
          if (h > 12) h -= 12;
          if (h === 0) h = 12;
          hour = String(h);
          minute = String(m).padStart(2, "0");
        }

        const stubs: UploadFile[] = (party_data.tracks || []).map(
          (t: { file_path: string; file_name: string; position: number }) => ({
            id: crypto.randomUUID(),
            file: null,
            name: t.file_name,
            size: 0,
            progress: 100,
            status: "complete" as const,
            storagePath: t.file_path,
          })
        );

        setInitialData({
          title: party_data.title || "",
          description: party_data.description || "",
          coverPreview: cover_url || null,
          existingCoverPath: party_data.cover_image_path || null,
          scheduledDate,
          hour,
          minute,
          ampm,
          seatLimit: party_data.seat_limit || 10,
          pinEnabled: !!party_data.pin,
          pin: party_data.pin || "",
          themeBg: party_data.theme?.bg || "#000000",
          themeFg: party_data.theme?.fg || "#ffffff",
          themeAccent: party_data.theme?.accent || "#ffffff",
          themeSurface: party_data.theme?.surface || "#18181b",
          themeFont: party_data.theme?.font || "",
          initialFiles: stubs,
        });
      })
      .catch(() => {})
      .finally(() => setResumeLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (resumeLoading) return null;

  async function handleCreate(payload: WizardPayload) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");

    // Upload cover image if present (or reuse existing)
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

    // Upload tracks via TUS
    const results = await payload.uploadAll(session.user.id, session.access_token);
    const failed = results.filter((f) => f.status === "error");
    if (failed.length > 0) {
      throw new Error(`${failed.length} file(s) failed to upload. Retry or remove them.`);
    }

    const tracks = results.map((f, i) => ({
      file_path: f.storagePath!,
      file_name: f.name,
      position: i + 1,
      duration: f.duration ?? null,
    }));

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description || null,
        seat_limit: payload.seatLimit,
        scheduled_at: payload.scheduledAt.toISOString(),
        tracks,
        cover_image_path: coverImagePath,
        theme: { bg: payload.themeBg, fg: payload.themeFg, accent: payload.themeAccent, surface: payload.themeSurface, font: payload.themeFont || undefined },
        pin: payload.pinEnabled ? payload.pin : undefined,
        previous_session_id: resumeSessionId || undefined,
        existing_cover_path: (!payload.coverFile && payload.existingCoverPath) ? payload.existingCoverPath : undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create party");
    }

    const { checkout_url } = await res.json();
    window.location.href = checkout_url;
  }

  return (
    <PartyWizard
      mode="create"
      initialData={initialData}
      onSubmit={handleCreate}
      submitLabel="Create Party — $10"
      submittingLabel="Creating..."
      pageTitle="Create a Party"
      pageSubtitle="Upload your tracks, set a time, share the link."
      backHref="/dashboard"
      backConfirmMessage="Are you sure? Your party information will be lost."
    />
  );
}
