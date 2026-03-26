"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface NotificationEmailDialogProps {
  userId: string;
  open: boolean;
  onDismiss: () => void;
}

export function NotificationEmailDialog({
  userId,
  open,
  onDismiss,
}: NotificationEmailDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleSave() {
    if (!isValidEmail) {
      setError("Please enter a valid email address.");
      return;
    }
    setSaving(true);
    setError("");

    const { error: upsertError } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, notification_email: email });

    setSaving(false);
    if (upsertError) {
      setError("Failed to save. Please try again.");
      return;
    }
    onDismiss();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="bg-brand-blue border-surface-border text-text-primary sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-text-primary">Add a notification email</DialogTitle>
          <DialogDescription className="text-text-secondary">
            Apple hides your real email. To notify you when your listening party
            files are deleted after 48 hours, please provide an email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            className="bg-surface-inset border-surface-border text-text-primary placeholder:text-text-tertiary"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="text-text-secondary hover:text-text-primary hover:bg-surface-hover"
          >
            Skip
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !email}
            className="bg-surface border border-surface-border text-text-primary hover:bg-surface-hover"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
