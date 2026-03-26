import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, Palette } from "lucide-react";
import { UploadFile } from "@/hooks/useFileUpload";

const ColorPickerField = dynamic(() => import("@/components/party/ColorPickerField"));
const PartyPreviewCard = dynamic(() => import("@/components/party/PartyPreviewCard"));

interface WizardStepCustomizeProps {
  themeBg: string;
  setThemeBg: (v: string) => void;
  themeFg: string;
  setThemeFg: (v: string) => void;
  themeAccent: string;
  setThemeAccent: (v: string) => void;
  themeSurface: string;
  setThemeSurface: (v: string) => void;
  coverPreview: string | null;
  title: string;
  files: UploadFile[];
}

export default function WizardStepCustomize({
  themeBg,
  setThemeBg,
  themeFg,
  setThemeFg,
  themeAccent,
  setThemeAccent,
  themeSurface,
  setThemeSurface,
  coverPreview,
  title,
  files,
}: WizardStepCustomizeProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-surface border-surface-border text-text-primary">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="size-4" />
            Customize Your Party Room
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PartyPreviewCard
            themeBg={themeBg}
            themeFg={themeFg}
            themeAccent={themeAccent}
            themeSurface={themeSurface}
            coverPreview={coverPreview}
            title={title}
            trackNames={files.map((f) => f.name)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorPickerField
              label="Background"
              value={themeBg}
              onChange={setThemeBg}
              presets={["#0c51da", "#000000", "#0a0a1a", "#1a0a2e", "#0a1a0a", "#1a0a0a", "#0f172a"]}
            />
            <ColorPickerField
              label="Text"
              value={themeFg}
              onChange={setThemeFg}
              presets={["#ffffff", "#fef3c7", "#e2e8f0", "#d1d5db"]}
            />
            <ColorPickerField
              label="Accent"
              value={themeAccent}
              onChange={setThemeAccent}
              presets={["#4a9aff", "#ffffff", "#f59e0b", "#8b5cf6", "#3b82f6", "#ec4899", "#10b981", "#ef4444"]}
            />
            <ColorPickerField
              label="Surface"
              value={themeSurface}
              onChange={setThemeSurface}
              presets={["#0a3fa8", "#18181b", "#27272a", "#0f172a", "#1e1b4b", "#1a0a2e"]}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setThemeBg("#0c51da");
              setThemeFg("#ffffff");
              setThemeAccent("#4a9aff");
              setThemeSurface("#0a3fa8");
            }}
          >
            <RotateCcw className="size-3" />
            Reset to Defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
