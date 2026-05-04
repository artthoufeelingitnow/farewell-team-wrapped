# Memory Orb — Feature Brief

## Goal

Add a generative 3D "memory orb" as the final beat of each colleague's wrapped. It's a unique 3D object whose appearance is deterministically derived from that colleague's data — same colleague always renders the same orb, but different colleagues get genuinely different orbs. They can save it as a PNG keepsake.

This is the **finale**. It plays after (or replaces) the existing signoff slide.

## Why this works

- Spotify Wrapped's "share card" hits because it's a tangible takeaway. The orb plays the same role — the colleague leaves with something that's *theirs*.
- Determinism matters: re-rendering produces the same orb, so it feels stable, like a real object that exists for them.
- The contrast with the rest of the deck (2D + ambient fragments → suddenly 3D + dimensional) gives the finale weight.

## Build phases — DO NOT SKIP TO PHASE 2

### Phase 1 (MVP — ship this first, evaluate, then iterate)

Simplest possible version. Goal: prove the concept feels good before investing in polish.

- Single orb shape: faceted icosahedron (geometry: `IcosahedronGeometry(1, 1)` or `(1, 2)` for slightly more facets)
- Deterministic seed from colleague's name (hash → number)
- Color palette extracted from their photos (use `colorthief` or similar) — fallback to slide bg gradients if no photos
- Gentle auto-rotation (~0.005 rad/frame on Y axis)
- Soft ambient lighting + one directional light
- Subtle bloom or glow if easy, skip if not
- "Save as image" button → downloads PNG via `renderer.domElement.toDataURL()`

**Stop here. Show Michael. Get feedback before Phase 2.**

### Phase 2 (only after Phase 1 lands well)

- Particle field around the orb (color-matched to palette, ~2000-5000 particles max)
- Surface displacement using simplex noise → orb shape varies per person
- Better lighting setup (3-point, environment map)
- Smooth fade-in animation when slide loads

### Phase 3 (stretch)

- Per-colleague shape variation beyond color (different geometry types selected by hash)
- Optional video export (MediaRecorder API → webm)
- Sound on save success

## Tech stack

- `three` — Three.js core
- `@react-three/fiber` — React renderer for Three.js (essential, makes this feel like JSX)
- `@react-three/drei` — helpers like `<OrbitControls>`, `<Environment>`
- `colorthief` — palette extraction from images (small, ~6KB)

Install:
```bash
npm install three @react-three/fiber @react-three/drei colorthief
npm install -D @types/three  # if using TypeScript
```

## Component structure

```
src/components/orb/
├── MemoryOrb.tsx          # main component, takes colleague prop
├── OrbScene.tsx           # the <Canvas> contents (orb + lighting)
├── usePalette.ts          # hook: photos[] → colors[]
├── useOrbSeed.ts          # hook: name → deterministic numbers
└── saveOrbImage.ts        # canvas → PNG download
```

## Inputs → visual mapping

| Input | Drives |
|---|---|
| `colleague.name` (hashed) | Seed for any randomness — rotation start, facet jitter, etc. |
| `colleague.slides[].photoData` (all photos) | Color palette (3-5 dominant colors) |
| `colleague.slides.length` | Particle count (Phase 2) |
| Photo count | Orb scale or detail (Phase 2 — subtle) |

**Important:** the seed must be stable. Same name = same orb, every time. Use a simple hash like:
```ts
function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
```

Then derive everything from that number — `seed % 360` for hue offset, `(seed >> 8) % 100 / 100` for some 0-1 value, etc.

## Where it goes in the deck

Two options — Michael will decide:

**Option A (recommended):** New slide type `orb-finale` that replaces the existing `signoff` slide as the last entry. Has its own admin controls (title, subtitle text overlay).

**Option B:** Add it as an *additional* slide after signoff — the deck plays normally, signoff appears, then "and one more thing..." reveals the orb.

Default to A unless Michael says otherwise.

## Save button behavior

- Button label: "Save my wrapped" (matches what was discussed)
- On click:
  1. Capture canvas at higher resolution if possible (set renderer to 2x pixel ratio for the capture frame)
  2. Composite a clean export: orb + their name in Jua + a small "made for [name]" caption
  3. Convert to PNG, trigger browser download
  4. Filename: `wrapped-${colleague.name.toLowerCase().replace(/\s+/g, '-')}.png`
- Subtle feedback: button text → "Saved!" for 2 seconds

## Performance constraints

- Target: smooth 60fps on a mid-range laptop, acceptable on phones
- Particle count cap: 5000 (Phase 2)
- No expensive post-processing in Phase 1
- `<Canvas>` should pause rendering when not visible (use `frameloop="demand"` and trigger on interaction, or `frameloop="always"` only while finale slide is active)
- Photos for palette extraction: load once, cache the palette in state — don't re-extract on every render

## Visual direction

- Aesthetic: **keepsake**, not gimmick. Think glass paperweight, not video game.
- Colors: pulled from photos but slightly desaturated and harmonized — don't just dump raw photo colors, blend toward warm/cohesive
- Background: dark gradient (matches existing deck's `bg-dark`), not pure black
- Animation: gentle, breathing, never frenetic
- Reference vibe: think of how Spotify Wrapped's "year in pixels" or Apple Music Replay end card feel — calm, intentional, share-worthy

## Don't

- Don't make it a perfect sphere — too generic
- Don't use raw bright photo colors — they'll clash
- Don't auto-download on slide reveal — let them click the button
- Don't make the rotation interactive in Phase 1 (no orbit controls) — hands-off feels more cinematic
- Don't add text on the orb itself — keep the 3D object pure, put text overlay in HTML around it

## Things to ask Michael before implementing

1. **Option A vs B for placement** (above)
2. **Does he want the orb to react to mouse hover** (subtle parallax) or stay completely autonomous?
3. **Save format**: PNG only (Phase 1) or also include video export in Phase 1?
4. **What text should appear next to the orb**? Suggested default: "[Name]'s Wrapped 2026" + small caption "made with care"

## Tie-in to existing fragments system

The slide-level fragment system (configured in admin per-slide) is a **separate** 2D layer and should keep working unchanged. The orb finale slide can:
- Disable fragments entirely (clean stage for the 3D moment)
- Or keep them (fragments drifting in front of the 3D scene as a depth cue)

Default to disabling on the orb slide. Cleaner.

## Testing

- Test with 3 different colleague names → confirm visibly different orbs
- Test with same name twice → confirm identical orb (determinism)
- Test with 0 photos → confirm fallback palette works
- Test save button on Chrome, Safari, Firefox — `toDataURL` is universal but the download trigger varies slightly
- Test on a low-spec device or throttled CPU in DevTools — should not stutter

---

**Build Phase 1 first. Ship it. Then talk to Michael before Phase 2.**
