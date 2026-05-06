# Goodbye Wrapped — Project Context

## What this is

A personal goodbye gift for colleagues at **Pathlight School (Digital Academy)**. Each colleague gets their own custom Spotify-Wrapped-style slide deck — gated behind a password they receive privately.

The vibe: a heartfelt mini-memoir framed as a wrapped recap. Not a generic "thanks for everything" — each deck is custom-built per person.

Originally built as a single self-contained HTML file (still preserved as `index.original.html` for reference). Refactored to React + Vite + TypeScript so it's easier to extend.

**Live URL:** `https://artthoufeelingitnow.github.io/farewell-team-wrapped/`

## Stack

- **Vite 6** + **React 19** + **TypeScript 5.6** (strict mode, discriminated unions)
- **Zustand** for state (no Redux, no Context-only — small project, three discrete stores)
- **html-to-image** for capturing the keepsake cards (spirit-animal + soundtrack slides) as PNG downloads (small dep; better web-font handling than html2canvas, important for Jua)
- **Vanilla CSS** in one global stylesheet (`src/styles/global.css`). No CSS modules, no Tailwind. Class names like `.bg-pink`, `.slide-eyebrow`, `.podium-step`, `.keepsake-card` are stable contracts; don't rename casually.

## Repo layout

```
farewell_wrapped/
├── public/
│   └── videos/             # hosted .mp4/.webm files for mosaic video media
├── docs/                   # design briefs (MEMORY_ORB_BRIEF.md, SPIRIT_ANIMAL_BRIEF.md)
├── data.json.enc           # ENCRYPTED real content; data.json itself is gitignored
├── CLAUDE.md               # ← you are here. MUST stay at root for tools to load it.
├── src/
│   ├── types/
│   ├── utils/{index, constants}.ts
│   ├── store/{appStore, playerStore, toastStore}.ts
│   ├── hooks/{audioEngine, useAudioEngine, useItunesSearch, useHashRoute, useDataJsonLoader}.ts
│   ├── styles/global.css
│   └── components/
│       ├── Toast.tsx
│       ├── landing/{Landing, PasswordModal}.tsx
│       ├── player/Player.tsx
│       ├── slides/         # one view component per slide type + SlideRenderer + FragmentLayer + SlideBackground
│       └── admin/          # Admin shell + Editor + SlidePreview + SlideStyleEditor + SlideFieldsEditor + SongPicker
└── .github/workflows/deploy.yml
```

## Architecture

**Three views**, switched by URL hash + a separate "in player?" check:

| Route | View | Who sees it |
|---|---|---|
| `#` (default) | **Landing** | Visitors — bubble grid of names |
| `#admin` | **Admin tool** | Michael only — build/edit decks |
| (in-app, when a colleague is selected) | **Player** | Visitors after password auth |

The player overlay takes priority over routing — if `playerStore.currentColleagueId` is set, the player renders regardless of hash. See `src/App.tsx`.

### State

Three Zustand stores in `src/store/`:
- **`appStore`** — the persistent data (`meta` + `colleagues[]`). Every mutation calls `persist()` which writes to localStorage. Also exposes `loadFromExport(data)` for the runtime data.json fetch.
- **`playerStore`** — transient runtime state: `currentColleagueId`, `slideIndex`, `audioEnabled`, `paused` (hold-to-pause: halts auto-advance AND audio), `previewingMedia` (mosaic lightbox: halts auto-advance only — audio keeps playing as the emotional underscore), `unlockedColleagueIds`, `isPreviewMode`. Not persisted.
- **`toastStore`** — single-toast notifications, used via `showToast(msg)`.

### Data model

```ts
AppData = {
  meta: { title, subtitle, farewellNote },
  colleagues: [{
    id, name, passwordHash,  // SHA-256 of password
    slides: Slide[],         // discriminated union, see src/types/index.ts
  }]
}
```

`Slide` is a discriminated union over `type`. Each slide carries:
- `bg: BgConfig` — discriminated union: `{kind:'preset', preset}` | `{kind:'gradient', from, to, angle, shape, textColor}` | `{kind:'lava', baseColor, blobs[], speed, blur, textColor}`
- Optional `fragments?: FragmentConfig` — decorative animated overlay
- Optional song fields (`songUrl`, `songName`, `songStart`, `songDuration`, …)
- Type-specific fields

### Slide types

Registered in `src/utils/constants.ts → SLIDE_TYPES`:

| Type | Notes |
|---|---|
| `intro` | Opener — eyebrow + title + sub |
| `stat` | Big number/text + label + caption |
| `photo` | Single polaroid-framed photo with caption |
| `quote` | Quote body + attribution. Open `"` and close `"` are absolutely-positioned in a `.quote-frame` *around the body* (not slide corners) — they scale with text length. |
| `podium` | Top-3 ranks. Each item has optional `media: MediaItem`. Visual order: 2nd, 1st, 3rd. Step heights 340/290/250 differ for hierarchy; media + name + count anchored to bottom; rank stuck to top. |
| `letter` | Long-form heartfelt message (scrollable) |
| `mosaic` | 3×3 grid of `media: MediaItem[]` (mixed images and videos). Tap a tile → swipe-down-to-dismiss lightbox. **`photos: string[]` is legacy — migration converts to `media`.** |
| `spirit-animal` | Two-column keepsake card. Each section holds a `MediaItem` (image/GIF/video URL) with drag-to-position crop + optional caption. Slide-level: eyebrow (default "this is you if you were a cat..."), optional title (display font, with Display/Spotify font picker), tagline, optional bottom caption. PNG export via Web Share API → camera roll on mobile, download elsewhere. Default duration 30s. |
| `soundtrack` | Soundtrack keepsake card. Eyebrow (default "your soundtrack") + optional title (display font, with Display/Spotify font picker) + auto-derived track list (max 5, curated via `featuredTrackKeys`) + optional italic tagline at the bottom. PNG export via Web Share API. Default duration 30s. |
| `signoff` | Final card with replay/close buttons |

`MediaItem = { kind: 'image', src } | { kind: 'video', src }`. Image `src` is base64 dataUrl; video `src` is a URL (typically `${BASE_URL}videos/foo.mp4`).

Each slide type has its own view component in `src/components/slides/` and gets dispatched by `SlideRenderer.tsx`. Field editors live in `src/components/admin/SlideFieldsEditor.tsx`.

### Backgrounds, fragments, audio

- **Background**: discriminated `BgConfig`. Editor in `SlideStyleEditor.tsx` has three tabs (Preset / Custom / Lava). Preset tiles have a hover-revealed pencil that opens the native color picker → on pick, bg flips to `gradient` with that color as `from`. Lava blobs use `mix-blend-mode: screen` + per-blob `lava-drift-N` keyframes.
- **Fragments**: `FragmentConfig = { source: {kind:'preset', type} | {kind:'image', dataUrls[]}, pattern, density }`. Six motion patterns (`fall`, `fall-slow`, `flip-fall`, `rise`, `twinkle`, `drift`). Enabled on every slide type. `.fragment-layer { z-index: 0 }` — same level as `.slide-bg` but DOM-later so fragments paint over the bg, and DOM-earlier than slide content so anything at `z-index: 2` (the layering rule) or `z-index: auto` (excluded full-bleed wrappers like `.keepsake`) paints over fragments by document order. The keepsake PNG export only captures the inner `.keepsake-card` node, not the fragments around it — so fragments show in the live slide but the saved keepsake remains clean.
- **Audio engine** (`src/hooks/audioEngine.ts`): iTunes Search API → 30s previews. Two `Audio` elements crossfade between slides with 600ms ramp (`FADE_MS`). `pauseCurrent()` / `resumeCurrent()` halt and resume the current track without losing position (used by hold-to-pause). `onAutoplayBlocked(cb)` lets the player surface an unmute overlay if the first `play()` rejects with `NotAllowedError` (rare after the unlock click but real on iOS Low Power mode and some in-app browsers). Admin preview audio is separate (`previewSong`/`stopPreviewAudio`/`seekPreviewAudio`).

### Player gestures + timing

- **Hold-to-pause** (Instagram-style). Pointer-event handlers on `.player` start a 220ms timer (`HOLD_PAUSE_MS`); if the pointer hasn't moved more than 8px (`HOLD_MOVE_THRESHOLD_PX`) when it fires, `paused` flips true. Release flips it back. Move-threshold cancels the hold so swipes/scrolls (e.g. inside `.letter-wrap`) don't accidentally pause. The trailing `click` after a hold is suppressed via a ref so a hold never doubles as a nav-zone tap.
- **Two pause causes, intentionally distinct:**
  - `paused` (hold-to-pause) — halts the auto-advance timer AND pauses audio. Audio keeps its position so resume picks up mid-bar.
  - `previewingMedia` (mosaic lightbox open) — halts auto-advance but lets audio keep playing. The song is the emotional underscore for the memory the user is lingering on; cutting it mid-bar to zoom on a photo broke the moment. `useAudioEngine` only watches `paused`; the player's auto-advance + keyboard nav watch `paused || previewingMedia`.
- **Timer resume across pauses.** `elapsedRef` accumulates elapsed-ms inside the interval tick. On unpause, `startedAt = Date.now() - elapsedRef.current`, so the first post-resume tick reads back the prior elapsed value. A separate effect resets `elapsedRef` only when `slideIndex` / `currentColleagueId` changes — pause toggles preserve it.
- **Autoplay-blocked overlay.** `#unmute-overlay` renders when `audioEngine.playSlide` first rejects with `NotAllowedError`. Single tap → `unblockAutoplay()` retries inside the user gesture. Mostly a fallback for iOS Low Power / corporate browsers; the unlock-click usually counts as activation.
- **iOS gesture polish.** `.player` sets `-webkit-touch-callout: none` + `user-select: none` so a long press doesn't trigger native image-save / text-callout UI. `onContextMenu` is preventDefaulted on the player root.

### Asset preloading

- `src/utils/preload.ts` exposes `preloadColleagueAssets(colleague)` — iterates the deck's slides and creates an `Audio` (for every `songUrl`) + a hidden `<video>` (for every remote video `MediaItem.src`) with `preload="auto"`, retaining strong refs so GC doesn't abort the in-flight fetches. URLs are deduped across calls (one fetch per asset per session).
- Wired in **two places**: `Landing.handleBubbleClick` (the moment the user shows intent — the password-entry seconds give the browser a head start) and `Player`'s mount effect (safety net for dev/preview flows that bypass Landing).
- Base64-inlined images aren't preloaded (they're already in memory); only network-hosted videos benefit. No-op for assets without URLs.

### Persistence + load order

On boot:
1. `appStore` initializes synchronously from **localStorage** (key `goodbye_wrapped_data_v1`). `migrateAppData()` runs on every load — coerces legacy shapes (string `bg`, `{kind:'preset'}` bg unchanged, mosaic `photos[]` → `media[]`, single fragment `dataUrl` → `dataUrls[]`, **`'orb-finale'` and `'wrapped-finale'` slides → `[spirit-animal, soundtrack]` pair** with bg/fragments/song fields preserved on the spirit-animal slide and the legacy colleague-level spirit animal data lifted onto its left section).
2. `useDataJsonLoader` async-fetches `${BASE_URL}data.json`. If it returns 200 with valid JSON, calls `loadFromExport()` which **replaces** the store data (and skips persistence — viewers shouldn't accumulate state).

So in production, `data.json` always wins over a viewer's stale localStorage.

## Conventions

### Fonts
- **Display:** Jua (single weight 400)
- **Body:** Nunito
- CSS vars: `--font-display`, `--font-body`

### Color palette (preset gradients)
```
bg-pink   FF6B9D → C9184A          bg-yellow FFC75F → F39C12  (dark text)
bg-orange FF8C42 → D32F2F          bg-green  06D6A0 → 115E47
bg-teal   4ECDC4 → 1A535C          bg-blue   4FC3F7 → 1E3A8A
bg-purple B57EDC → 5E2A8C          bg-cream  FFF8E7 → F5DEB3  (dark text)
                                    bg-dark   1a1a1a → 000
```

Dark text mode driven by `.slide.text-dark` class set in JS via `bgNeedsDarkText(bg)`.

### Code style
- Strict TypeScript. Prefer narrowing via the `Slide` discriminated union over type assertions.
- React StrictMode is on. Effects run twice in dev — be idempotent.
- `uid()` returns 8-char base36 IDs.

## Deploy story

Hosted on **GitHub Pages** at `https://artthoufeelingitnow.github.io/farewell-team-wrapped/` (repo: `artthoufeelingitnow/farewell-team-wrapped`, public).

The repo is **public**, so committing real content directly would expose letter text + photos. Workaround: data ships as an **encrypted blob**.

### Content workflow

1. Edit content in admin (`npm run dev`), click "Export final file" → downloads `data.json`
2. Move it to repo root: `mv ~/Downloads/data.json .`
3. `npm run encrypt-data` → produces `data.json.enc` (AES-256, PBKDF2 600k iterations)
4. Commit + push `data.json.enc` (`data.json` is gitignored)
5. The GitHub Actions workflow decrypts `data.json.enc` → `dist/data.json` using the `DATA_PASSPHRASE` repo secret, then deploys to Pages.

To verify locally: `npm run decrypt-data` reverses the operation.

### Video workflow (separate from encrypted blob)

Videos are too big for base64 inlining, so they're hosted as static files alongside the deploy:
1. Convert `.mov` → `.mp4` (H.264) — iPhone .mov files don't play reliably in Chrome/Firefox:
   ```sh
   ffmpeg -i input.mov -c:v libx264 -c:a aac -movflags +faststart public/videos/clip.mp4
   ```
2. Commit + push the `.mp4` to `public/videos/`
3. GitHub Pages serves it at `https://artthoufeelingitnow.github.io/farewell-team-wrapped/videos/clip.mp4`
4. Paste that URL into admin's "🎥 Add video URL" button (mosaic or podium)

**Privacy caveat:** videos are publicly hotlinkable from the public repo. The encrypted `data.json.enc` only hides *which colleague gets which video*, not the video files themselves.

### Vite base path

Production builds use `base: '/farewell-team-wrapped/'`. Dev stays at `/`. See `vite.config.ts`. Asset URLs and the `data.json` fetch use `import.meta.env.BASE_URL` so they resolve correctly.

## Keepsake slides (current)

Two saveable keepsake slides sit before `signoff`: `'spirit-animal'` and `'soundtrack'`. Both render a 9:16 portrait card with a "Save to gallery" PNG download. Earlier history at [`docs/SPIRIT_ANIMAL_BRIEF.md`](docs/SPIRIT_ANIMAL_BRIEF.md). Together they replace the earlier single `wrapped-finale` slide (which itself replaced the 3D memory orb).

### Spirit-animal slide

Two side-by-side sections (`left` + `right`), each with: a `MediaItem` (image/GIF/video URL) + optional `mediaPosition` (drag-to-position crop, `{ x, y }` 0-100% applied as `object-position`) + optional `caption`. Slide-level fields: `eyebrow` (small caps, default `"this is you if you were a cat..."`), `title` (display font, optional — empty = no title rendered), `titleFont` (Display = Jua / Spotify = Montserrat 900), `tagline` (italic, prominent), optional bottom `caption`. The "made with care, for [name]" footer was removed — felt redundant with the password-gated landing.

- **Type:** `SpiritAnimalSlide` in `src/types/index.ts` (sections via `SpiritAnimalSection`). Per-section `name` field was removed — the slide-level `title` carries that role now.
- **View:** [`src/components/slides/SpiritAnimalSlideView.tsx`](src/components/slides/SpiritAnimalSlideView.tsx). Eyebrow / title / images / tagline / caption all rendered as **direct children** of the card (no `.keepsake-section` wrapper) so `justify-content: space-evenly` produces uniform gaps top to bottom.
- **Field editor:** `SpiritAnimalFields` in `SlideFieldsEditor.tsx`. Eyebrow + title + `TitleFontPicker` at the top, then a 2-column grid of `SectionEditor` (each: media upload — image / GIF / video URL — drag-to-reposition crop on the preview, caption input), then tagline + optional bottom caption.

### Soundtrack slide

Slide-level fields: `eyebrow` (small caps, default `"your soundtrack"`), `title` (display font, optional — e.g. a custom phrase), `titleFont` (Display / Spotify), `featuredTrackKeys?: string[]` (curated subset of the deck's songs, capped at 5; `undefined` = auto-pick first 5), optional `tagline` (italic, rendered at the bottom). No footer (matches spirit-animal).

- **Type:** `SoundtrackSlide` in `src/types/index.ts`.
- **View:** [`src/components/slides/SoundtrackSlideView.tsx`](src/components/slides/SoundtrackSlideView.tsx). Same flat structure as spirit-animal: eyebrow / title / tracks / tagline rendered as **direct children** of the card. `justify-content: space-evenly` distributes equal gaps; with 4 children that's 5 gaps (top edge + 3 between + bottom edge).
- **Field editor:** `SoundtrackFields` in `SlideFieldsEditor.tsx`. Eyebrow + title + `TitleFontPicker`, then the tagline input, then the checkbox-based track picker (capped at 5, with "↺ Auto" reset). Stored `featuredTrackKeys` are filtered against the current song list before display so orphaned keys (from songs that were renamed/removed elsewhere) don't inflate the counter.

### Shared keepsake plumbing

- **CSS:** `.keepsake` shell + `.keepsake-card` (the captured node) + universal `.keepsake-eyebrow` (small-caps body font) / `.keepsake-title` (display font) / `.keepsake-tagline` / `.keepsake-caption` / `.keepsake-actions` / `.keepsake-save`. The optional `.keepsake-title.font-spotify` modifier swaps to Montserrat 900 lowercase. Spirit-animal-specific styles: `.spirit-sections` / `.spirit-section-*`. Soundtrack-specific: `.keepsake-tracks` / `.keepsake-track-*`. Both cards use `justify-content: space-evenly` and symmetric `30px 26px` padding so the slack between children distributes into equal gaps; `.keepsake-card > .keepsake-eyebrow { margin-bottom: 0 }` zeroes the global eyebrow margin so the eyebrow→title gap matches every other gap. The legacy `.keepsake-footer` rule still exists in CSS but no longer has any callers — leave alone or strip later.
- **Save button:** opaque black pill with a 1.5px white halo border + drop shadow. Earlier semi-transparent white-on-white was invisible on the lighter cards; the solid-dark style reads on every card variant.
- **PNG export → camera roll on mobile:** `saveCardAsPng(card, name, kind)` in `src/utils/wrapped.ts` captures via `html-to-image` `toPng` (`pixelRatio: 3`), then prefers `navigator.share({ files: [pngFile] })` so iOS / Android users get the OS share sheet → "Save to Photos" / "Save to Gallery" lands the file directly in the camera roll. Falls back to a download link on desktop or browsers without Web-Share-with-files (in-app browsers like Instagram/Slack/Gmail are the common offenders — open in real Safari/Chrome to get the share sheet). Filename `{kind}-{slug}.png`. Awaits `document.fonts.ready` first (without it, fonts silently fall back to system on cold cache). Save button is `data-html-to-image-ignore` and the `filter` callback strips it from the captured DOM.
- **Fonts:** `--font-display` (Jua), `--font-body` (Nunito), `--font-spotify` (Montserrat 900). All three loaded via the Google Fonts link in `index.html`.
- **`.keepsake`** is in the `:not()` exclusion list of the slide-content layering rule so the full-bleed shell can be `position: absolute; inset: 0`. The inner `.keepsake-card` has explicit `z-index: 2` to paint above the fragment layer (a flex item with `z-index: auto` would otherwise paint at Layer 2 of the player's stacking context, behind fragments).
- **`getSlideDuration()`** returns 30 s (vs 7 s default) for both so the user has time to tap Save before auto-advance.
- **Now-playing bubble suppressed** on both keepsake slide types in `Player.tsx` — the spirit-animal hero / soundtrack tracklist already convey the song. Audio still plays normally; the audio engine reads `slide.songUrl` independently of the bubble UI.

### Migration

`migrateColleague()` in `src/utils/index.ts` expands every legacy `'orb-finale'` and `'wrapped-finale'` slide into a `[spirit-animal, soundtrack]` pair. The spirit-animal half inherits bg/fragments/song fields; on the FIRST such expansion per colleague, legacy colleague-level spirit animal data (`spiritAnimalMedia`/`Image`/`Name`/`Tagline`/`Position`) lifts onto its `left` section, and the legacy `spiritAnimalName` lifts onto the slide's `title`. The soundtrack half inherits bg + `featuredTrackKeys`. Colleague-level spirit animal fields are stripped during migration since the data now lives on the slide.

`migrateSlideFields()` also handles two intra-type renames:
- Soundtrack slides used to render their small-caps text from `slide.title`; that field has been promoted to `slide.eyebrow` and `title` is now the optional display-font line below.
- Spirit-animal sections used to carry a `name` field above the media; it's now stripped from sections and (if no slide title is set) promoted to `slide.title`.

### Things to test before shipping

- **Fonts on cold cache:** Open in a private window, jump to either keepsake slide, hit Save. Verify Jua / Nunito / Montserrat all render in the PNG. If any fall back to system fonts, switch to embedding fonts via `html-to-image`'s `fontEmbedCSS` option.
- **Save filename:** `spirit-animal-{slug}.png` and `soundtrack-{slug}.png`; colleague names with spaces/punctuation slugify cleanly.
- **Buttons not in PNG:** `data-html-to-image-ignore` strips them via the `filter` callback.
- **Layout @ 360px width:** narrowest realistic phone screen — two side-by-side sections need to remain readable.
- **0 / 1 / 5 tracks:** soundtrack card renders correctly in all three (0 shows "(this one was wordless)").
- **Orphan key counter:** delete a song that's listed in `featuredTrackKeys` and confirm the soundtrack slide's `N/5` counter reflects only valid keys.
- **Missing media on a section:** placeholder ★ appears, no broken image icon.

## Removed: Memory Orb

A 3D generative orb (three.js + @react-three/fiber + colorthief + simplex-noise) was previously the finale. It "didn't land" emotionally — abstract generative art without a name attached carried no weight. Replaced first by a single `wrapped-finale` keepsake card, then split into the current `spirit-animal` + `soundtrack` pair (see above). All orb code, deps, and CSS were ripped out:
- Removed deps: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`, `colorthief`, `simplex-noise`. Bundle dropped ~900 KB.
- Removed dirs/files: `src/components/orb/`, `src/components/slides/OrbFinaleSlideView.tsx`.
- Removed types: `OrbFinaleSlide`, `OrbConfig`, `OrbGeometryPreset`.
- Removed CSS: all `.memory-orb*` classes (was at the bottom of `global.css`).
- The `'orb-finale'` slide type is gone from the union; the migration converts existing data so this is non-breaking for production decks.

## Gotchas

### 1. localStorage scope
Editing on laptop ≠ editing on phone. Pick one device, or export frequently as backup.

### 2. Photo size
Each photo is base64-embedded into `data.json`. `compressImage()` shrinks to 900px max @ 0.85 JPEG (single photos) or 700px (mosaic). 9 mosaic + 3 single can push past 5MB. Drop `maxDim` if it gets unwieldy.

### 3. iTunes preview URLs are fixed
The 30s clip Apple returns always starts at the same point (usually the chorus). `songStart` only skips forward inside that 30s window.

### 4. Songs need internet at view time
Song URLs reference Apple's CDN. Colleagues must be online when viewing.

### 5. Password security caveat
SHA-256 hashed but **goal is casual privacy, not real security**. Don't put anything in a deck that would be a problem if leaked.

### 6. Transient admin state in slides
Admin-only fields leak into `slide` objects: `showSongPicker`, `songSearchQuery`, etc. `cleanColleagueForExport()` strips them. Add new transient fields to `TRANSIENT_FIELDS` in `src/utils/index.ts`.

### 7. Encrypt + decrypt iter count must match
`-iter 600000` is hardcoded in npm scripts AND the workflow. Change all three together or decryption silently fails on deploy.

### 8. Don't commit data.json (plaintext)
It's in `.gitignore`. Stick to `data.json.enc`.

### 9. Vite base path mismatches
If you rename the GH Pages repo or switch to a custom domain, update `base` in `vite.config.ts`.

### 10. StrictMode double-render
React 19 + StrictMode runs effects twice in dev. The audio engine's URL-match guard makes it idempotent; new module-level state must tolerate double-firing.

### 11. The `:not()` content-layering rule
`src/styles/global.css` has:
```css
.slide > *:not(.fragment-layer):not(.slide-bg):not(.photo-lightbox):not(.photo-mosaic):not(.quote-mark):not(.keepsake) {
  position: relative;
  z-index: 2;
}
```
This applies `position: relative; z-index: 2` to every direct child of `.slide`, *except* the listed exclusions. Anything that needs to be `position: absolute` (lightbox overlays, full-bleed children, the keepsake shell) must be added to the exclusion list — otherwise its layout breaks silently. Specificity is (0,6,0), so a per-class override needs equal-or-higher specificity to win.

### 12. .mov files don't play reliably outside Safari
iPhone-recorded `.mov` (HEVC/H.265) plays in Safari but breaks in Chrome/Firefox. Always re-encode to `.mp4` (H.264) with the ffmpeg one-liner above.

### 13. html-to-image + web fonts
`html-to-image` will silently fall back to system fonts if the page's web fonts aren't fully loaded at capture time. `saveCardAsPng()` awaits `document.fonts.ready` first, but if a font is added after capture (rare), it can still miss. Test PNG export on a cold cache (private window) before shipping any change to the keepsake slides' typography.

### 14. Mosaic edge-photo taps register as nav
Player has 30%-wide `nav-zone` overlays at left/right (z-index 4). Mosaic photos sit at `z-index: 7` so taps land on the photo. Critical that `.photo-mosaic` does NOT form a stacking context (it's in the `:not()` exclusion list — keeps the inner `<img>`/`<video>` z-index propagating to the player's stacking context). The `.letter-wrap` is in the same exclusion list at `z-index: 7` for the same reason — without it, only the middle 40% of a long letter is actually scrollable because the side nav-zones cover the rest.

### 15. `navigator.share({ files })` only works in real browsers
The keepsake save flow opens the OS share sheet (→ "Save to Photos" / "Save to Gallery") only when the browser supports Web Share with files. **In-app browsers** (Instagram, Facebook, Slack, Gmail link previews, etc.) usually return `false` from `navigator.canShare({ files })`, so the user falls through to the download path. There is no zero-tap "save to gallery" available on the open web — even when the share sheet works, the user still taps "Save Image" once. If a colleague reports the file going to Downloads instead of Photos, they're almost certainly opening the link inside an app, not Safari/Chrome.

### 16. Hold-to-pause vs scroll containers
The hold-to-pause pointer handlers live on `.player` and bubble-receive every touch. The `HOLD_MOVE_THRESHOLD_PX` of 8px cancels the timer once the user starts scrolling — that's why letter-wrap scrolling works without accidentally triggering pause. If you add a new scrollable region, make sure its `touch-action` permits the axis you want (`pan-y` for vertical) so the browser actually scrolls instead of fighting the pointer handler.

## Common tasks

| Task | Where to look |
|---|---|
| Add a new slide type | `src/types/index.ts` (add to union) → `SLIDE_TYPES` in `constants.ts` → `makeDefaultSlide()` in `utils/index.ts` → new view component in `slides/` → `SlideRenderer.tsx` → fields case in `SlideFieldsEditor.tsx` |
| Add an admin field | `SlideFieldsEditor.tsx` — find the slide's case, add a `<Field />` |
| Tweak slide timing | `DEFAULT_SLIDE_DURATION` in `src/utils/constants.ts` (per-slide `songDuration` overrides) |
| Tweak crossfade | `FADE_MS` in `src/utils/constants.ts` |
| Change slide gradient | `bg-*` CSS classes near top of `src/styles/global.css` |
| Modify export | `handleExport()` in `src/components/admin/Admin.tsx` |
| Touch the password flow | `src/components/landing/PasswordModal.tsx` + `sha256()` in `src/utils/index.ts` |
| Change deploy / data flow | `.github/workflows/deploy.yml` + `useDataJsonLoader.ts` |
| Tweak spirit-animal slide visuals | `src/components/slides/SpiritAnimalSlideView.tsx` + `.keepsake-*` / `.spirit-section-*` rules in `global.css` |
| Tweak soundtrack slide visuals | `src/components/slides/SoundtrackSlideView.tsx` + `.keepsake-*` / `.keepsake-track-*` rules in `global.css` |
| Tweak the soundtrack list logic | `getSoundtrack()` / `getFeaturedSoundtrack()` in `src/utils/wrapped.ts` (dedupe, cap) |
| Tweak the PNG export | `saveCardAsPng()` in `src/utils/wrapped.ts` (pixelRatio, filter, filename prefix) |
| Add another title font | Add the family to `index.html` Google Fonts link → add a CSS variable + `.keepsake-title.font-X` rule in `global.css` → extend `TitleFontKind` in `types/index.ts` → add a button to `TitleFontPicker` in `SlideFieldsEditor.tsx` |
| Edit spirit-animal data | The slide's own field editor (`SpiritAnimalFields`). Per-colleague spirit animal panel was removed — data now lives on the slide. |
| Tweak hold-to-pause feel | `HOLD_PAUSE_MS` / `HOLD_MOVE_THRESHOLD_PX` at the top of `Player.tsx` |
| Tweak audio pause/resume | `pauseCurrent()` / `resumeCurrent()` in `audioEngine.ts`; `useAudioEngine` watches `paused` only |
| Add a new asset to preload | Extend `collectVideoUrls()` in `src/utils/preload.ts` for the new slide-type's media shape |
| Touch the autoplay-blocked overlay | `#unmute-overlay` markup in `Player.tsx` + `audioEngine.onAutoplayBlocked` wiring + CSS in `global.css` |

## Local dev

```sh
npm run dev          # localhost:5173
npm run build        # production bundle into dist/
npm run preview      # serve dist/ locally
npm run typecheck    # tsc -b --noEmit
npm run encrypt-data # data.json → data.json.enc (prompts for passphrase)
npm run decrypt-data # data.json.enc → data.json (sanity-check)
```

## Don't break

- The password gate (no plaintext passwords ever — only SHA-256 hashes)
- The encrypted-blob deploy invariant (`data.json` gitignored, only `data.json.enc` committed)
- Auto-save on every edit (don't introduce a manual "save" requirement)
- The single global CSS file — visual consistency depends on it
- The discriminated unions for `Slide` / `BgConfig` / `FragmentSource` / `MediaItem` — type narrowing depends on the discriminator field
- The `:not()` content-layering rule — adding new full-bleed components requires updating the exclusion list
- The legacy-finale → `[spirit-animal, soundtrack]` expansion in `migrateColleague()` — removing it would orphan any legacy decks still carrying `'orb-finale'` or `'wrapped-finale'` slides
- `cleanColleagueForExport()` must include any new colleague-level fields; otherwise they vanish on export
- The `paused` vs `previewingMedia` split in `playerStore` — collapsing them back together would re-introduce the regression where opening a mosaic photo cuts the song mid-bar. Hold-to-pause must keep killing audio; mosaic preview must not.
- `useAudioEngine` watches `paused` only (not `previewingMedia`) — preserve that asymmetry.
- Hold-to-pause's nav-zone click suppression — if you remove `suppressClickRef`, releasing a hold will navigate the deck.
- `CLAUDE.md` must stay at project root (Claude Code loads it from there). Other docs go in `docs/`.
