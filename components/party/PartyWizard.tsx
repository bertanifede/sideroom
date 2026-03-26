"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFileUpload, UploadFile } from "@/hooks/useFileUpload";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import {
  validateImageFile,
  MAX_ARTWORK_SIZE,
  compressArtwork,
} from "@/lib/image-utils";

import WizardStepInfo from "./WizardStepInfo";
import WizardStepSchedule from "./WizardStepSchedule";
import WizardStepTracks from "./WizardStepTracks";
import WizardStepPreview from "./WizardStepPreview";

const STEP_LABELS = ["Party Info", "Schedule", "Tracks", "Preview"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === step;
        const isComplete = stepNum < step;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                  isActive
                    ? "bg-text-primary text-brand-blue"
                    : isComplete
                      ? "bg-surface text-text-primary"
                      : "bg-surface-inset text-text-tertiary"
                }`}
              >
                {isComplete ? <Check className="size-3.5" /> : stepNum}
              </div>
              <span
                className={`text-xs truncate ${
                  isActive
                    ? "text-text-primary font-medium"
                    : "text-text-tertiary"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`h-px flex-1 min-w-4 ${
                  isComplete ? "bg-surface-border" : "bg-surface-inset"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Types ───

export interface WizardPayload {
  title: string;
  description: string;
  coverFile: File | null;
  existingCoverPath: string | null;
  scheduledAt: Date;
  seatLimit: number;
  pinEnabled: boolean;
  pin: string;
  pinAction: "keep" | "change" | "remove";
  themeBg: string;
  themeFg: string;
  themeAccent: string;
  themeSurface: string;
  themeFont: string;
  files: UploadFile[];
  uploadAll: (userId: string, accessToken: string) => Promise<UploadFile[]>;
}

export interface PartyWizardInitialData {
  title: string;
  description: string;
  coverPreview: string | null;
  existingCoverPath: string | null;
  scheduledDate?: Date;
  hour: string;
  minute: string;
  ampm: string;
  seatLimit: number;
  pinEnabled: boolean;
  pin: string;
  hasPinSet?: boolean;
  themeBg: string;
  themeFg: string;
  themeAccent: string;
  themeSurface: string;
  themeFont: string;
  initialFiles?: UploadFile[];
}

export interface PartyWizardProps {
  mode: "create" | "edit";
  initialData?: PartyWizardInitialData;
  onSubmit: (payload: WizardPayload) => Promise<void>;
  submitLabel: string;
  submittingLabel: string;
  pageTitle: string;
  pageSubtitle: string;
  backHref: string;
  backConfirmMessage: string;
}

export default function PartyWizard({
  mode,
  initialData,
  onSubmit,
  submitLabel,
  submittingLabel,
  pageTitle,
  pageSubtitle,
  backHref,
  backConfirmMessage,
}: PartyWizardProps) {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  // Form data
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialData?.coverPreview ?? null);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(initialData?.scheduledDate);
  const [hour, setHour] = useState(initialData?.hour ?? "7");
  const [minute, setMinute] = useState(initialData?.minute ?? "00");
  const [ampm, setAmpm] = useState(initialData?.ampm ?? "PM");
  const [seatLimit, setSeatLimit] = useState(initialData?.seatLimit ?? 10);
  const [submitting, setSubmitting] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(initialData?.pinEnabled ?? false);
  const [pin, setPin] = useState(initialData?.pin ?? "");

  // Edit-mode PIN state
  const [hasPinSet] = useState(initialData?.hasPinSet ?? false);
  const [pinChanging, setPinChanging] = useState(false);

  const existingCoverPathRef = useRef<string | null>(initialData?.existingCoverPath ?? null);

  // Theme customization
  const [themeBg, setThemeBg] = useState(initialData?.themeBg ?? "#0c51da");
  const [themeFg, setThemeFg] = useState(initialData?.themeFg ?? "#ffffff");
  const [themeAccent, setThemeAccent] = useState(initialData?.themeAccent ?? "#4a9aff");
  const [themeSurface, setThemeSurface] = useState(initialData?.themeSurface ?? "#0a3fa8");
  const [themeFont, setThemeFont] = useState(initialData?.themeFont ?? "");

  // File upload hook for tracks
  const {
    files,
    addFiles,
    removeFile,
    renameFile,
    reorderFiles,
    setInitialFiles,
    uploadAll,
    isUploading,
    overallProgress,
  } = useFileUpload();

  // Form is dirty if user has entered any data (create) or always in edit mode
  const isDirty =
    mode === "edit" ||
    title !== "" ||
    description !== "" ||
    coverFile !== null ||
    files.length > 0 ||
    scheduledDate !== undefined;

  // Set initial files once on mount
  const initialFilesSet = useRef(false);
  if (!initialFilesSet.current && initialData?.initialFiles?.length) {
    initialFilesSet.current = true;
    setTimeout(() => setInitialFiles(initialData.initialFiles!), 0);
  }

  // Computed scheduled datetime
  const scheduledAt = useMemo(() => {
    if (!scheduledDate) return null;
    const d = new Date(scheduledDate);
    let h = parseInt(hour);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    d.setHours(h, parseInt(minute), 0, 0);
    return d;
  }, [scheduledDate, hour, minute, ampm]);

  // Compute PIN action for edit mode
  function getPinAction(): "keep" | "change" | "remove" {
    if (mode === "create") return pinEnabled ? "change" : "remove";
    if (!pinEnabled && hasPinSet) return "remove";
    if (pinEnabled && pinChanging) return "change";
    if (pinEnabled && !hasPinSet) return "change";
    return "keep";
  }

  // ─── Cover image handling ───
  async function handleCoverFile(file: File) {
    const validationError = validateImageFile(file, MAX_ARTWORK_SIZE);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    const compressed = await compressArtwork(file);
    setCoverFile(compressed);
    setCoverPreview(URL.createObjectURL(compressed));
  }

  // ─── Step validation ───
  function validateStep(): boolean {
    setError("");
    switch (step) {
      case 1:
        if (!title.trim()) {
          setError("Title is required.");
          return false;
        }
        return true;
      case 2:
        if (!scheduledAt) {
          setError("Please select a date and time.");
          return false;
        }
        if (mode === "create" && scheduledAt.getTime() < Date.now() + 60 * 60 * 1000) {
          setError("Scheduled time must be at least 1 hour from now.");
          return false;
        }
        if (mode === "create" && scheduledAt.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) {
          setError("Parties can be scheduled up to 7 days in advance.");
          return false;
        }
        if (pinEnabled && getPinAction() !== "keep") {
          if (pin.trim().length < 4 || !/^[a-zA-Z0-9]+$/.test(pin.trim())) {
            setError("Passcode must be 4–8 alphanumeric characters.");
            return false;
          }
        }
        return true;
      case 3:
        if (files.length === 0) {
          setError("Add at least one track.");
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  function handleNext() {
    if (validateStep()) {
      setStep((s) => Math.min(s + 1, 4));
    }
  }

  function handleBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  }

  // ─── Submit ───
  const handleSubmit = useCallback(async () => {
    if (files.length === 0 || !title || !scheduledAt) return;

    setSubmitting(true);
    setError("");

    try {
      await onSubmit({
        title,
        description,
        coverFile,
        existingCoverPath: existingCoverPathRef.current,
        scheduledAt,
        seatLimit,
        pinEnabled,
        pin: pin.trim(),
        pinAction: getPinAction(),
        themeBg,
        themeFg,
        themeAccent,
        themeSurface,
        themeFont,
        files,
        uploadAll,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, title, description, seatLimit, scheduledAt, coverFile, onSubmit, uploadAll, themeBg, themeFg, themeAccent, themeSurface, themeFont, pin, pinEnabled, pinChanging, hasPinSet]);

  const busy = isUploading || submitting;

  // ─── Wizard ───
  return (
    <div className="min-h-screen bg-brand-blue text-text-primary" style={{ backgroundImage: "var(--dot-grid)", backgroundSize: "var(--dot-grid-size)" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 text-text-secondary hover:text-text-primary hover:bg-transparent cursor-pointer"
          onClick={() => {
            if (!isDirty || confirm(backConfirmMessage)) {
              router.push(backHref);
            }
          }}
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Button>

        <h1 className="text-2xl font-bold mb-2">{pageTitle}</h1>
        <p className="text-text-secondary mb-8">{pageSubtitle}</p>

        <StepIndicator step={step} />

        {step === 1 && (
          <WizardStepInfo
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            coverPreview={coverPreview}
            onCoverFile={handleCoverFile}
            onCoverClear={() => {
              setCoverFile(null);
              setCoverPreview(null);
              existingCoverPathRef.current = null;
            }}
          />
        )}

        {step === 2 && (
          <WizardStepSchedule
            scheduledDate={scheduledDate}
            setScheduledDate={setScheduledDate}
            hour={hour}
            setHour={setHour}
            minute={minute}
            setMinute={setMinute}
            ampm={ampm}
            setAmpm={setAmpm}
            seatLimit={seatLimit}
            setSeatLimit={setSeatLimit}
            pinEnabled={pinEnabled}
            setPinEnabled={setPinEnabled}
            pin={pin}
            setPin={setPin}
            scheduledAt={scheduledAt}
            mode={mode}
            hasPinSet={hasPinSet}
            pinChanging={pinChanging}
            setPinChanging={setPinChanging}
          />
        )}

        {step === 3 && (
          <WizardStepTracks
            files={files}
            addFiles={addFiles}
            removeFile={removeFile}
            renameFile={renameFile}
            reorderFiles={reorderFiles}
            setError={setError}
          />
        )}

        {/* Error message */}
        {error && step < 4 && <p className="text-destructive text-sm mt-4">{error}</p>}

        {/* Navigation (steps 1–3 only; step 4 has its own) */}
        {step < 4 && (
          <div className="flex items-center justify-between mt-6">
            {step > 1 ? (
              <Button variant="ghost" onClick={handleBack} disabled={busy} className="rounded-full border border-surface-border bg-surface hover:bg-surface-hover text-text-primary cursor-pointer">
                <ArrowLeft className="size-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            <Button onClick={handleNext} className="rounded-full border border-surface-border bg-surface hover:bg-surface-hover text-text-primary cursor-pointer">
              Next
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {step === 4 && (
        <WizardStepPreview
          title={title}
          description={description}
          coverPreview={coverPreview}
          themeBg={themeBg}
          setThemeBg={setThemeBg}
          themeFg={themeFg}
          setThemeFg={setThemeFg}
          themeAccent={themeAccent}
          setThemeAccent={setThemeAccent}
          themeSurface={themeSurface}
          setThemeSurface={setThemeSurface}
          themeFont={themeFont}
          setThemeFont={setThemeFont}
          files={files}
          seatLimit={seatLimit}
          busy={busy}
          isUploading={isUploading}
          overallProgress={overallProgress}
          submitting={submitting}
          submittingLabel={submittingLabel}
          submitLabel={submitLabel}
          error={error}
          onBack={handleBack}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
