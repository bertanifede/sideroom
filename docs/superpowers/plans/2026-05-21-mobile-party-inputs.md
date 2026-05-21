# Mobile Party-Room Input & Layout Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile, stop iOS Safari from zooming when the party-room inputs are focused, and free up vertical space so the chat panel shows ~3–4 messages.

**Architecture:** Four surgical Tailwind className changes. Every change is gated behind the `md:` breakpoint so the desktop layout renders byte-for-byte identical to today. iOS auto-zoom is eliminated by raising input font-size to 16px on mobile only; the chat panel grows because the artwork shrinks from 288px to 160px on mobile.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, Vitest + @testing-library/react + jsdom.

**Spec:** `docs/superpowers/specs/2026-05-21-mobile-party-inputs-design.md`

---

## File Structure

- `components/party/ArtworkOverlay.tsx` — artwork `<img>` / fallback `<div>` width (Task 1)
- `__tests__/components/ArtworkOverlay.test.tsx` — existing test file, add a describe block (Task 1)
- `vitest.setup.ts` — add a `ResizeObserver` stub so `ChatPanel` can render under jsdom (Task 2)
- `components/party/ChatPanel.tsx` — chat textarea font-size (Task 2)
- `__tests__/components/ChatPanel.test.tsx` — new test file (Task 2)
- `components/party/LiveNoteButton.tsx` — note input font-size (Task 3)
- `__tests__/components/LiveNoteButton.test.tsx` — new test file (Task 3)
- `components/party/PartyRoom.tsx` — mobile vertical spacing (Task 4)

Tasks 1–3 are test-driven. Task 4 changes only spacing classes on `PartyRoom`, a component that cannot be rendered in isolation without mocking the realtime channel, playback-sync, and audio stack — so it is verified by lint + build + the manual checklist in Task 5 instead of a unit test.

---

## Task 1: Shrink the artwork on mobile

**Files:**
- Modify: `components/party/ArtworkOverlay.tsx:36` and `:40`
- Test: `__tests__/components/ArtworkOverlay.test.tsx` (existing file — append a describe block)

- [ ] **Step 1: Write the failing test**

Append this describe block to the end of `__tests__/components/ArtworkOverlay.test.tsx` (the file already imports `render`, `screen`, `vi` from its existing tests — do not duplicate imports):

```tsx
describe("ArtworkOverlay — responsive artwork size", () => {
  it("renders the cover image at w-40 on mobile and md:w-96 on desktop", () => {
    render(
      <ArtworkOverlay title="Test" coverImageUrl="https://example.com/cover.jpg" />
    );
    const img = screen.getByAltText("Test cover");
    expect(img).toHaveClass("w-40", "md:w-96");
  });

  it("renders the gradient fallback at w-40 on mobile and md:w-96 on desktop", () => {
    const { container } = render(<ArtworkOverlay title="Test" />);
    const fallback = container.querySelector("div.aspect-square");
    expect(fallback).toHaveClass("w-40", "md:w-96");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/ArtworkOverlay.test.tsx`
Expected: FAIL — the two new tests fail because the element has class `w-72`, not `w-40`. The three pre-existing "guest resume overlay" tests still pass.

- [ ] **Step 3: Make the change**

In `components/party/ArtworkOverlay.tsx`, change the artwork width on both the image and the fallback div from `w-72` to `w-40`.

Line 36 (`<img>`):
```tsx
          className="w-40 md:w-96 aspect-square rounded-2xl object-cover shadow-lg shadow-black/10"
```

Line 40 (fallback `<div>`):
```tsx
          className="w-40 md:w-96 aspect-square rounded-2xl shadow-lg shadow-black/10"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/ArtworkOverlay.test.tsx`
Expected: PASS — all five tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/party/ArtworkOverlay.tsx __tests__/components/ArtworkOverlay.test.tsx
git commit -m "Shrink party artwork to w-40 on mobile (desktop unchanged)"
```

---

## Task 2: Fix iOS zoom on the chat input

**Files:**
- Modify: `vitest.setup.ts` (add a `ResizeObserver` stub)
- Modify: `components/party/ChatPanel.tsx:149`
- Test: `__tests__/components/ChatPanel.test.tsx` (new file)

- [ ] **Step 1: Add a ResizeObserver stub to the test setup**

`ChatPanel` calls `new ResizeObserver(...)` in an effect; jsdom does not provide `ResizeObserver`, so rendering it in a test throws `ReferenceError` without this stub.

Replace the entire contents of `vitest.setup.ts` with:

```ts
import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; components that observe element size need a stub.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/components/ChatPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatPanel from "@/components/party/ChatPanel";

describe("ChatPanel — mobile input zoom fix", () => {
  it("renders the chat textarea at text-base on mobile and md:text-sm on desktop", () => {
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} currentUserName="Tester" />
    );
    const textarea = screen.getByPlaceholderText("Say something...");
    expect(textarea).toHaveClass("text-base", "md:text-sm");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/components/ChatPanel.test.tsx`
Expected: FAIL — the textarea has class `text-sm`, not `text-base`. (If it instead errors with `ResizeObserver is not defined`, Step 1 was not applied correctly.)

- [ ] **Step 4: Make the change**

In `components/party/ChatPanel.tsx`, the `<textarea>` className starts at line 149. Change the font-size token `text-sm` to `text-base md:text-sm`. The full className becomes:

```tsx
            className="w-full pl-3.5 pr-10 py-2.5 bg-transparent text-[var(--party-fg)] text-base md:text-sm
                       placeholder-[var(--party-fg)]/40 focus:outline-none focus:ring-0
                       disabled:cursor-not-allowed resize-none overflow-y-auto
                       [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/components/ChatPanel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vitest.setup.ts components/party/ChatPanel.tsx __tests__/components/ChatPanel.test.tsx
git commit -m "Bump chat input to 16px font on mobile to stop iOS zoom"
```

---

## Task 3: Fix iOS zoom on the note input

**Files:**
- Modify: `components/party/LiveNoteButton.tsx:76`
- Test: `__tests__/components/LiveNoteButton.test.tsx` (new file)

- [ ] **Step 1: Write the failing test**

The note input only renders after the collapsed "+ Add Note" button is clicked (`isOpen` state).

Create `__tests__/components/LiveNoteButton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LiveNoteButton from "@/components/party/LiveNoteButton";

describe("LiveNoteButton — mobile input zoom fix", () => {
  it("renders the note input at text-base on mobile and md:text-xs on desktop", () => {
    render(
      <LiveNoteButton partyId="party-1" trackId="track-1" currentTime={0} />
    );
    fireEvent.click(screen.getByText("+ Add Note"));
    const input = screen.getByPlaceholderText("Note at this moment...");
    expect(input).toHaveClass("text-base", "md:text-xs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/LiveNoteButton.test.tsx`
Expected: FAIL — the input has class `text-xs`, not `text-base`.

- [ ] **Step 3: Make the change**

In `components/party/LiveNoteButton.tsx`, the `<input>` className is on line 76. Change the font-size token `text-xs` to `text-base md:text-xs`. The full className becomes:

```tsx
        className="flex-1 bg-[var(--party-fg)]/5 border border-[var(--party-fg)]/10 rounded-full px-3 py-1.5 text-base md:text-xs text-[var(--party-fg)] placeholder:text-[var(--party-fg)]/30 outline-none"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/LiveNoteButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/party/LiveNoteButton.tsx __tests__/components/LiveNoteButton.test.tsx
git commit -m "Bump note input to 16px font on mobile to stop iOS zoom"
```

---

## Task 4: Tighten mobile vertical spacing in the party room

**Files:**
- Modify: `components/party/PartyRoom.tsx:188` and `:191`

No unit test — `PartyRoom` depends on the realtime channel, playback-sync, and audio hooks and cannot be rendered in isolation without extensive mocking. These are spacing-only className changes, verified by lint here and by the manual checklist in Task 5.

- [ ] **Step 1: Tighten the track-title top margin**

In `components/party/PartyRoom.tsx`, line 188 is the track-title `<p>`. Change `mt-4` to `mt-3 md:mt-4`:

```tsx
      <p className="text-base font-semibold tracking-tight text-center mt-3 md:mt-4">
```

- [ ] **Step 2: Tighten the audio-player top margin**

Line 191 is the audio-player wrapper `<div>`. Change `mt-3` to `mt-2 md:mt-3`:

```tsx
      <div className="w-full max-w-sm mt-2 md:mt-3">
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/party/PartyRoom.tsx
git commit -m "Tighten mobile party-room spacing above the chat panel"
```

---

## Task 5: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all test files green, including the new `ChatPanel` and `LiveNoteButton` tests and the existing suites.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Manual verification on mobile**

On a real iPhone (or iOS Safari with a mobile viewport):

1. Join a party as a guest on mobile.
2. Tap the note input ("+ Add Note" → "Note at this moment…") — confirm the page does **not** zoom and the track title stays fully visible (no horizontal overflow).
3. Tap the chat input ("Say something…") — confirm the page does **not** zoom and there is no horizontal overflow.
4. Confirm the chat panel shows ~3–4 messages without scrolling.
5. On a desktop browser, confirm the party room looks visually identical to before this change.
