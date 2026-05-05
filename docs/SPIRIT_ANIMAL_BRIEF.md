# Spirit Animal + Soundtrack Finale — Feature Brief

## Goal

Replace the current signoff slide with a finale that reveals the colleague's "spirit animal" (image + name + tagline curated by Michael) alongside the **soundtrack of their wrapped** — the list of songs that played across their slides, styled as a Spotify-style track list. The whole composition is downloadable as a PNG keepsake.

## Why this approach

This replaces an earlier idea (a generative 3D "memory orb") that didn't land — abstract generative art doesn't carry emotional weight without a name attached. The spirit animal pattern lets Michael curate the personality directly per colleague, which is more meaningful than any algorithm. The soundtrack list reuses data already in the project (every slide with a song has `songName`, `songArtist`, `songArt`) so it's mostly composition, not new data plumbing.

The result: a single shareable card that captures *both* the personal-touch element (animal) and the listenable-memory element (tracks). Spotify Wrapped's two best mechanics, fused.

## Build phases

### Phase 1 (MVP — ship and evaluate)

- Admin additions: 3 new fields per colleague (animal image, animal name, tagline)
- Finale slide redesigned around animal hero + soundtrack list
- "Save my wrapped" button → PNG download via `html-to-image` or `html2canvas`
- Replaces existing signoff slide as the deck's last entry

**Stop here. Show Michael. Iterate from feedback.**

### Phase 2 (only after Phase 1 lands)

- Reveal animations (animal fades in, tracks slide in sequentially, Spotify-Wrapped style)
- Optional gradient theming that shifts subtly based on animal/colleague
- 2x resolution PNG export for crisp prints / phone wallpapers

### Skip entirely

- 3D, Three.js, generative art
- Auto-pairing animals from data (Michael curates manually)

## Tech additions

```bash
npm install html-to-image
```

`html-to-image` is preferred over `html2canvas` — smaller, better support for modern CSS, handles web fonts (important for Jua), produces cleaner output.

No other new deps. Everything else uses what's already in the project.

## Admin changes

Add to the per-colleague editor (above or below the slides section, your call):

```
SPIRIT ANIMAL
┌─────────────────────────────────────┐
│ [📷 Upload animal image]            │
│ Name:    [The Otter             ]   │
│ Tagline: [playful, loyal, snack...] │
└─────────────────────────────────────┘
```

Three fields on `colleague`:
- `spiritAnimalImage` — base64 data URL, like existing photo uploads. Reuse the existing `compressImage()` helper (or whatever it's called in the React version) — same path as photo slides.
- `spiritAnimalName` — string, e.g. "The Otter"
- `spiritAnimalTagline` — string, e.g. "playful, loyal, snack enthusiast"

Validation: all three should be present before the finale slide can render properly. If any are missing, fall back gracefully (show placeholder or skip the animal section).

## Finale slide structure

Replaces the existing `signoff` slide as the deck's terminal slide. Could either:
- **Option A:** Modify the existing `signoff` type to take on this new responsibility
- **Option B:** Add a new slide type `finale` that supersedes `signoff`

Default to **Option A** — less code surface, simpler mental model. Existing decks will need their `signoff` slides re-saved with the new fields (acceptable migration cost).

### Layout

Vertical card, portrait-oriented (works on phone, prints well, fits Instagram story format ~9:16):

```
┌─────────────────────────────────────────┐
│                                         │
│        ╭─────────────────╮              │
│        │                 │              │
│        │  [Animal Image] │              │
│        │                 │              │
│        ╰─────────────────╯              │
│                                         │
│        YOUR SPIRIT ANIMAL               │
│        The Otter           ← Jua, large │
│        playful, loyal,                  │
│        snack enthusiast    ← italic     │
│                                         │
│        ────────────                     │
│                                         │
│        THE SOUNDTRACK                   │
│                                         │
│        ▶ 1  [art] Heart of Glass        │
│                   Blondie               │
│        ▶ 2  [art] Strawberry Fields     │
│                   The Beatles           │
│        ▶ 3  [art] Yebrak                │
│                   Tabber                │
│        ...                              │
│                                         │
│        ─────────                        │
│        Made with care · For LS · 2026   │
│                                         │
│   [ Save my wrapped ]   [ Replay ]      │
│                                         │
└─────────────────────────────────────────┘
```

### Visual specs

- **Background:** dark gradient (matches existing `bg-dark` palette: `#1a1a1a → #000`). Subtle, not pure black — keeps it from looking like a void.
- **Animal image:** circular crop or rounded-square (16-20px radius), max 200-240px wide, soft glow/shadow to lift it off the background
- **Animal name:** Jua font, ~36-44px, white, generous letter-spacing
- **Tagline:** Nunito italic, ~14-16px, opacity 0.75
- **Section dividers:** thin (1px), opacity 0.15, white
- **Section headers** ("YOUR SPIRIT ANIMAL", "THE SOUNDTRACK"): Nunito 700 weight, ~11px, uppercase, letter-spacing 2px, opacity 0.6
- **Track row:** small album art thumbnail (~40px square), then track name (Nunito 600, 14px) + artist (Nunito 400, 12px, opacity 0.7) stacked
- **Track number:** ~11px, opacity 0.5, monospace if available
- **Save button:** primary-styled, prominent. Use existing button styling pattern.

### Card dimensions

- On screen: scale to fit viewport, maintain ~9:16 aspect ratio when possible
- For PNG export: render at fixed dimensions (recommend 1080x1920, Instagram-story-sized) regardless of screen size — gives consistent quality

## Soundtrack data flow

Pull from existing slide data. The soundtrack list = every slide in this colleague's deck that has a song, deduped:

```ts
function getSoundtrack(colleague) {
  const tracks = colleague.slides
    .filter(s => s.songUrl && s.songName)
    .map(s => ({
      name: s.songName,
      artist: s.songArtist || '',
      art: s.songArt || '',
    }));
  // dedupe by name + artist (same song used on 2 slides → 1 entry)
  const seen = new Set();
  return tracks.filter(t => {
    const key = t.name + '|' + t.artist;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

### Edge cases

- **0 songs:** Show a quiet line like "(this one was wordless)" or just hide the section entirely. Don't show "Soundtrack" header followed by emptiness.
- **1-2 songs:** Display normally — small lists still look intentional with right styling.
- **8+ songs:** Cap display at ~7-8, with a fade-out gradient at the bottom suggesting more. Or scroll within the card on screen but flatten to first 7 in the export.

## "Save my wrapped" mechanic

Implementation:

```ts
import { toPng } from 'html-to-image';

async function saveWrapped(cardRef: HTMLElement, colleagueName: string) {
  try {
    const dataUrl = await toPng(cardRef, {
      pixelRatio: 2,        // 2x resolution for crisp output
      backgroundColor: '#0a0a0a',  // matches card bg in case of transparency
      cacheBust: true,
    });
    const link = document.createElement('a');
    link.download = `wrapped-${colleagueName.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to save:', err);
    // Show toast/alert with friendly error
  }
}
```

Behavior:
- Button label starts as "Save my wrapped"
- During capture (~500ms-2s): "Saving..."
- Success: "Saved!" for 2 seconds, then back to original label
- On error: "Couldn't save — try again?" briefly

### Important font caveat

`html-to-image` needs web fonts to be **fully loaded** before capture or the exported image will fall back to system fonts. Two approaches:

1. **Wait for fonts before render:**
```ts
await document.fonts.ready;
```
2. **Embed fonts as data URLs** in the cloned DOM. `html-to-image` has a `fontEmbedCSS` option for this.

Test the export on a fresh page load (cold cache) to verify fonts come through. This is the most likely thing to silently break.

## Save button placement

The card has two buttons at the bottom:
- **Save my wrapped** (primary) — triggers download
- **Replay** (ghost/secondary) — restarts the deck from slide 1

When the user clicks Save, the buttons should be **hidden** during capture (they shouldn't appear in the saved PNG). Implementation:
- Add `data-html-to-image-ignore` attribute to the button container, OR
- Briefly toggle a `.capturing` class that sets `display: none` on buttons during capture, then restores after

## Things to ask Michael before implementing

1. **Where in the deck does the finale go?** Confirming Option A (replace existing signoff) vs Option B (new slide type after signoff).
2. **What text appears as the footer line?** Default suggestion: "Made with care · For [Name] · 2026". Confirm or replace.
3. **Card orientation** — portrait (9:16, suggested above) or landscape (16:9)? Portrait works better for phone wallpapers and Instagram stories. Landscape works better for desktop wallpapers.
4. **What if a colleague has no spirit animal data set?** Should the deck refuse to render, fall back to old-style signoff, or show a generic placeholder?

## Don't

- Don't auto-trigger the save — let the user click the button
- Don't include audio playback in the saved PNG (impossible anyway, but worth flagging)
- Don't put text *over* the animal image — it must read clearly on its own
- Don't reuse slide background gradients on the finale — give it its own distinct, calm aesthetic that says "this is the takeaway"
- Don't crop animal images aggressively — let Michael control composition by what he uploads. The CSS frames the image; it doesn't reframe it.

## Testing checklist

- [ ] Spirit animal fields persist correctly through admin save/load cycle
- [ ] Animal image survives the project's photo compression pipeline
- [ ] Soundtrack list correctly dedupes if same song appears on 2 slides
- [ ] Save button produces PNG with all fonts rendered correctly (test on cold page load)
- [ ] Save filename uses sanitized colleague name
- [ ] Buttons don't appear in saved PNG
- [ ] Card renders correctly with 0, 1, and 8+ tracks
- [ ] Card renders correctly with missing animal data (graceful fallback)
- [ ] Layout is readable on a 360px-wide phone screen
- [ ] Replay button works after a save action

## Update CLAUDE.md after building

Add to project docs:
- Spirit animal data fields on `colleague`
- Soundtrack derivation logic (one-line description + reference to function)
- `html-to-image` dependency
- Font-loading caveat for capture
- The "buttons hidden during capture" pattern

---

**Build Phase 1 first. Test the save flow with real fonts. Then talk to Michael before Phase 2.**
