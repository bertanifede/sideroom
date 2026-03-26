"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ProfileSheet } from "./ProfileSheet";
import { Profile } from "@/types";
import GuestAvatar from "@/components/party/GuestAvatar";

interface NavbarProps {
  profile: Profile;
  email: string;
  notificationEmail?: string | null;
}

export function Navbar({ profile, email, notificationEmail }: NavbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const fallbackName = profile.display_name || email.split("@")[0];

  return (
    <>
      <nav className="sticky top-0 z-40 w-full flex items-center justify-between px-6 md:px-10 py-3 bg-brand-blue/80 backdrop-blur-md">
        <Link href="/dashboard" className="font-medium text-text-primary tracking-widest font-pixel">
          sideroom
        </Link>

        <button
          onClick={() => setSheetOpen(true)}
          className="cursor-pointer -mr-2"
        >
          <Avatar>
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt="Avatar" />
            )}
            <AvatarFallback className="bg-surface">
              <GuestAvatar name={fallbackName} size={40} />
            </AvatarFallback>
          </Avatar>
        </button>
      </nav>

      <ProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        profile={profile}
        email={email}
        notificationEmail={notificationEmail}
      />
    </>
  );
}
