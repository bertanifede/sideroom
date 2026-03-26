"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";
import GuestAvatar from "@/components/party/GuestAvatar";
import {
  validateImageFile,
  compressAvatar,
  MAX_AVATAR_SIZE,
} from "@/lib/image-utils";
import { isPrivateRelayEmail } from "@/lib/email-utils";

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  email: string;
  notificationEmail?: string | null;
}

export function ProfileSheet({
  open,
  onOpenChange,
  profile,
  email,
  notificationEmail,
}: ProfileSheetProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(
    profile.display_name || ""
  );
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [notifEmail, setNotifEmail] = useState(notificationEmail || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const showNotifEmail = isPrivateRelayEmail(email);

  const fallbackName = profile.display_name || email.split("@")[0];

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file, MAX_AVATAR_SIZE);
    if (validationError) {
      alert(validationError);
      return;
    }

    setUploading(true);
    const compressed = await compressAvatar(file);
    const ext = compressed.type === "image/webp" ? "webp" : file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("user-avatars")
      .upload(path, compressed, { upsert: true });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("user-avatars").getPublicUrl(path);

    // Append cache-buster so the browser shows the new image
    const url = `${publicUrl}?t=${Date.now()}`;

    await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", profile.id);

    setAvatarUrl(url);
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ display_name: displayName || null })
      .eq("id", profile.id);

    if (showNotifEmail) {
      await supabase
        .from("user_settings")
        .upsert({
          user_id: profile.id,
          notification_email: notifEmail || null,
        });
    }

    setSaving(false);
    onOpenChange(false);
    router.refresh();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-brand-blue/90 backdrop-blur-xl border-surface-border text-text-primary"
      >
        <SheetHeader>
          <SheetTitle className="text-text-primary font-pixel">Profile</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col items-center gap-4 px-4 pt-4">
          {/* Avatar */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative group cursor-pointer"
            disabled={uploading}
          >
            <Avatar className="size-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
              <AvatarFallback className="bg-surface">
                <GuestAvatar name={fallbackName} size={80} />
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-text-primary">
                {uploading ? "..." : "Edit"}
              </span>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <p className="text-sm text-text-secondary">{email}</p>
        </div>

        {/* Name input */}
        <div className="px-4 pt-6 space-y-2">
          <label className="text-sm text-text-secondary">Display name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={email.split("@")[0]}
            className="bg-surface border-surface-border text-text-primary"
          />
        </div>

        {/* Notification email (Apple Private Relay users) */}
        {showNotifEmail && (
          <div className="px-4 pt-4 space-y-2">
            <label className="text-sm text-text-secondary">Notification email</label>
            <Input
              type="email"
              value={notifEmail}
              onChange={(e) => setNotifEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-surface border-surface-border text-text-primary"
            />
            <p className="text-xs text-text-tertiary">
              Your Apple sign-in uses a private relay. Add an email to receive file deletion notices.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-3 p-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full border border-surface-border bg-surface rounded-full hover:bg-surface-hover cursor-pointer text-text-primary"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-full cursor-pointer"
          >
            Log out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
