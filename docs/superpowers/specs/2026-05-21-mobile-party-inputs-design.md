# Mobile party-room input & layout fixes

**Date:** 2026-05-21
**Status:** Approved

## Problem

On mobile (iOS Safari), the in-party experience has three related issues:

1. **Inputs trigger zoom on focus.** Tapping the "Note at this moment…" input or
   the "Say something…" chat input zooms the page in. iOS Safari auto-zooms when
   a focused input has a computed `font-size` below 16px.
2. **Content overflows the viewport.** The zoom from issue #1 pushes the page
   wider than the screen, cutting off the track title and making the send
   targets hard to reach.
3. **Chat area is too short.** The artwork (`w-72` / 288px), a two-line title,
   the audio player, and the note button stack above the tab panel, leaving the
   chat panel only enough room for ~1.5 messages.

## Goal

- No zoom or horizontal overflow when focusing either input on mobile.
- The chat panel shows ~3–4 messages without scrolling.
- **Desktop is unchanged.** Every change is gated behind the `md:` breakpoint,
  so the desktop two-column layout renders byte-for-byte identical to today.

## Root cause

- **Zoom + overflow:** both inputs use sub-16px fonts —
  `LiveNoteButton` note input at `text-xs` (12px) and `ChatPanel` chat textarea
  at `text-sm` (14px). iOS Safari zooms on focus for anything under 16px. The
  resulting zoom is what produces the horizontal overflow. One root cause.
- **Short chat:** in `PartyLayout`, the mobile body is a vertical flex column.
  The left section (artwork + meta) is `shrink-0` and takes its full natural
  height; the right section (tabs + chat) is `flex-1` and only gets the
  leftover. A 288px artwork plus stacked meta consumes most of the screen.

## Changes

All changes are mobile-only (no `md:` prefix = mobile; `md:` restores the
current desktop value).

### 1. Eliminate iOS auto-zoom — `components/party/LiveNoteButton.tsx`

Note input (line ~76): `text-xs` → `text-base md:text-xs`
(16px on mobile, 12px on desktop).

### 2. Eliminate iOS auto-zoom — `components/party/ChatPanel.tsx`

Chat textarea (line ~149): `text-sm` → `text-base md:text-sm`
(16px on mobile, 14px on desktop).

No `maximum-scale` / `user-scalable=no` viewport hack — that disables
pinch-to-zoom and harms accessibility. The 16px font-size is the standard fix.

### 3. Shrink the artwork on mobile — `components/party/ArtworkOverlay.tsx`

Artwork `<img>` and gradient fallback `<div>` (lines ~36 and ~40):
`w-72 md:w-96` → `w-40 md:w-96` (160px on mobile, 384px on desktop unchanged).

Both elements use `aspect-square`, so height tracks width automatically.

### 4. Tighten mobile vertical spacing — `components/party/PartyRoom.tsx`

- Track title `<p>`: `mt-4` → `mt-3 md:mt-4`
- Audio player wrapper `<div>`: `mt-3` → `mt-2 md:mt-3`

## Expected outcome

The artwork shrinks by 128px and spacing tightens, handing that vertical space
to the `flex-1` chat panel below the tabs — yielding ~3–4 visible messages.
Focusing either input no longer zooms, which also resolves the horizontal
overflow. Desktop is untouched.

## Out of scope

`app/party/[inviteCode]/JoinForm.tsx` (the name-entry screen before joining a
party) likely has the same sub-16px zoom issue. Not included — the request
covered only the two in-party inputs. Can be addressed separately if desired.

## Testing

Manual verification on a real iPhone (or iOS Safari simulator):

1. Join a party as a guest on mobile.
2. Tap the note input — confirm no zoom, no horizontal overflow, title stays
   fully visible.
3. Tap the chat input — confirm no zoom, no overflow.
4. Confirm the chat panel shows ~3–4 messages without scrolling.
5. On desktop, confirm the layout is visually identical to before.
