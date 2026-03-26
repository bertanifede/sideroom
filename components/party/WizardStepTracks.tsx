import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, GripVertical } from "lucide-react";
import { UploadFile } from "@/hooks/useFileUpload";

const ALLOWED_AUDIO_EXTENSIONS = /\.(wav|flac|mp3)$/i;
const ALLOWED_AUDIO_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/mp3",
  "audio/mpeg",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateAudioFiles(fileList: FileList | File[]): File[] {
  const valid: File[] = [];
  for (const file of Array.from(fileList)) {
    if (
      ALLOWED_AUDIO_TYPES.includes(file.type) ||
      ALLOWED_AUDIO_EXTENSIONS.test(file.name)
    ) {
      valid.push(file);
    }
  }
  return valid;
}

interface WizardStepTracksProps {
  files: UploadFile[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  renameFile: (id: string, name: string) => void;
  reorderFiles: (from: number, to: number) => void;
  setError: (msg: string) => void;
}

export default function WizardStepTracks({
  files,
  addFiles,
  removeFile,
  renameFile,
  reorderFiles,
  setError,
}: WizardStepTracksProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  function handleTrackSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    const valid = validateAudioFiles(selected);
    if (valid.length === 0) {
      setError("Please upload WAV, FLAC, or MP3 files.");
      return;
    }
    if (valid.length < selected.length) {
      setError(
        `${selected.length - valid.length} file(s) skipped — unsupported format.`
      );
    } else {
      setError("");
    }
    addFiles(valid);
    e.target.value = "";
  }

  function handleTrackDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files;
    if (!dropped || dropped.length === 0) return;
    const valid = validateAudioFiles(dropped);
    if (valid.length > 0) addFiles(valid);
    if (valid.length === 0) {
      setError("Please upload WAV, FLAC, or MP3 files.");
    }
  }

  return (
    <Card className="bg-surface border-surface-border text-text-primary">
      <CardHeader>
        <CardTitle className="text-base">
          Tracks{" "}
          <span className="text-text-secondary font-normal">
            ({files.length} file{files.length !== 1 ? "s" : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleTrackDrop}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed
                     border-surface-border px-4 py-8 text-center cursor-pointer
                     hover:border-text-tertiary hover:bg-surface-hover transition-colors"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-surface-inset">
            <Upload className="size-5 text-text-secondary" />
          </div>
          <p className="text-sm text-text-primary">
            Drop your files or click to browse
          </p>
          <p className="text-xs text-text-secondary">
            WAV, FLAC, or MP3 — multiple files supported
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.flac,.mp3"
          multiple
          onChange={handleTrackSelect}
          className="hidden"
        />

        {/* Track list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, index) => (
              <div
                key={f.id}
                draggable
                onDragStart={() => {
                  dragIndexRef.current = index;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (
                    dragIndexRef.current !== null &&
                    dragIndexRef.current !== index
                  ) {
                    reorderFiles(dragIndexRef.current, index);
                  }
                  dragIndexRef.current = null;
                }}
                className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-inset
                           px-3 py-2 group"
              >
                <GripVertical className="size-4 text-text-secondary cursor-grab shrink-0" />
                <span className="text-xs text-text-secondary w-6 text-right font-mono">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => renameFile(f.id, e.target.value)}
                      className="text-sm bg-transparent border-none outline-none truncate w-full text-text-primary
                                 focus:ring-1 focus:ring-surface-border rounded px-1 -ml-1"
                    />
                    <span className="text-xs text-text-secondary ml-2 shrink-0">
                      {f.size > 0 ? formatFileSize(f.size) : f.status === "complete" ? "uploaded" : ""}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <X className="size-3 text-text-secondary" />
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length > 1 && (
          <p className="text-xs text-text-secondary">
            Drag tracks to set the playback order.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
