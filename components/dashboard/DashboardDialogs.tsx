"use client";

import { useState } from "react";
import { NotificationEmailDialog } from "./NotificationEmailDialog";

interface DashboardDialogsProps {
  userId: string;
}

export function DashboardDialogs({ userId }: DashboardDialogsProps) {
  const [open, setOpen] = useState(true);

  return (
    <NotificationEmailDialog
      userId={userId}
      open={open}
      onDismiss={() => setOpen(false)}
    />
  );
}
