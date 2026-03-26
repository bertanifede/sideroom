import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, ImageIcon } from "lucide-react";

interface WizardStepInfoProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  coverPreview: string | null;
  onCoverFile: (file: File) => void;
  onCoverClear: () => void;
}

export default function WizardStepInfo({
  title,
  setTitle,
  description,
  setDescription,
  coverPreview,
  onCoverFile,
  onCoverClear,
}: WizardStepInfoProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onCoverFile(file);
    e.target.value = "";
  }

  function handleCoverDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    onCoverFile(file);
  }

  return (
    <Card className="bg-surface border-surface-border text-text-primary">
      <CardHeader>
        <CardTitle className="text-base">Party Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Album Release Party"
            required
            className="bg-surface-inset border-surface-border text-text-primary placeholder:text-text-tertiary"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="First listen of my new album with close friends..."
            rows={3}
            className="resize-none bg-surface-inset border-surface-border text-text-primary placeholder:text-text-tertiary"
          />
        </div>

        <div className="space-y-2">
          <Label>Album Cover (Optional)</Label>
          {coverPreview ? (
            <div className="relative w-32 h-32">
              <img
                src={coverPreview}
                alt="Cover preview"
                className="w-32 h-32 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={onCoverClear}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-text-primary
                           rounded-full flex items-center justify-center"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => coverInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCoverDrop}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed
                         border-surface-border px-4 py-8 text-center cursor-pointer
                         hover:border-text-tertiary hover:bg-surface-hover transition-colors"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-surface-inset">
                <ImageIcon className="size-5 text-text-secondary" />
              </div>
              <p className="text-sm text-text-primary">
                Drop your cover image or click to browse
              </p>
              <p className="text-xs text-text-tertiary">
                PNG, JPG, or WEBP
              </p>
            </div>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleCoverSelect}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
}
