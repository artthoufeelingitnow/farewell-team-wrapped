# Goodbye Wrapped — Project Context

## What this is

A personal goodbye gift for colleagues at **Pathlight School (Digital Academy)**. Each colleague gets their own custom Spotify-Wrapped-style slide deck — gated behind a password they receive privately.

The vibe: a heartfelt mini-memoir framed as a wrapped recap. Not a generic "thanks for everything" — each deck is custom-built per person.

Originally built as a single self-contained HTML file (still preserved as `index.original.html` for reference). Refactored to React + Vite + TypeScript so it's easier to extend.

**Live URL:** `https://artthoufeelingitnow.github.io/farewell-team-wrapped/`

## Stack

- **Vite 6** + **React 19** + **TypeScript 5.6** (strict mode, discriminated unions)
- **Zustand** for state (no Redux, no Context-only — small project, three discrete stores)
- **html-to-image** for capturing the wrapped-finale card as a PNG keepsake (small dep; better web-font handling than html2canvas, important for Jua)
- **Vanilla CSS** in one global stylesheet (`src/styles/global.css`). No CSS modules, no Tailwind. Class names like `.bg-pink`, `.slide-eyebrow`, `.podium-step`, `.wrapped-finale` are stable contracts; don't rename casually.

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
- **`playerStore`** — transient runtime state: `currentColleagueId`, `slideIndex`, `audioEnabled`, `paused` (used by mosaic lightbox to halt auto-advance), `unlockedColleagueIds`, `isPreviewMode`. Not persisted.
- **`toastStore`** — single-toast notifications, used via `showToast(msg)`.

### Data model

```ts
AppData = {
  meta: { title, subtitle, farewellNote },
  colleagues: [{
    id, name, passwordHash,  // SHA-256 of password
    slides: Slide[],         // discriminated union, see src/types/index.ts
    spiritAnimalMedia?,      // optional — MediaItem: { kind:'image', src:base64 } (incl. GIF) | { kind:'video', src:URL }
    spiritAnimalName?,       // optional — e.g. "The Otter"
    spiritAnimalTagline?,    // optional — e.g. "playful, loyal, snack enthusiast"
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
| `wrapped-finale` | Curated keepsake card: spirit animal hero + auto-derived soundtrack list + PNG export. Slide carries no content — reads `spiritAnimal*` from `Colleague` and derives the soundtrack from this colleague's other slides. Default duration 30s (vs 7s) so the user can tap Save before auto-advance. |
| `signoff` | Final card with replay/close buttons |

`MediaItem = { kind: 'image', src } | { kind: 'video', src }`. Image `src` is base64 dataUrl; video `src` is a URL (typically `${BASE_URL}videos/foo.mp4`).

Each slide type has its own view component in `src/components/slides/` and gets dispatched by `SlideRenderer.tsx`. Field editors live in `src/components/admin/SlideFieldsEditor.tsx`.

### Backgrounds, fragments, audio

- **Background**: discriminated `BgConfig`. Editor in `SlideStyleEditor.tsx` has three tabs (Preset / Custom / Lava). Preset tiles have a hover-revealed pencil that opens the native color picker → on pick, bg flips to `gradient` with that color as `from`. Lava blobs use `mix-blend-mode: screen` + per-blob `lava-drift-N` keyframes.
- **Fragments**: `FragmentConfig = { source: {kind:'preset', type} | {kind:'image', dataUrls[]}, pattern, density }`. Six motion patterns (`fall`, `fall-slow`, `flip-fall`, `rise`, `twinkle`, `drift`). Enabled on every slide type. `.fragment-layer { z-index: 0 }` — same level as `.slide-bg` but DOM-later so fragments paint over the bg, and DOM-earlier than slide content so anything at `z-index: 2` (the layering rule) or `z-index: auto` (excluded full-bleed wrappers like `.wrapped-finale`) paints over fragments by document order. The wrapped-finale's PNG export only captures the inner card node, not the fragments around it — so fragments show in the live slide but the saved keepsake remains clean.
- **Audio engine** (`src/hooks/audioEngine.ts`): iTunes Search API → 30s previews. Two `Audio` elements crossfade between slides with 600ms ramp (`FADE_MS`). Admin preview audio is separate (`previewSong`/`stopPreviewAudio`/`seekPreviewAudio`).

### Persistence + load order

On boot:
1. `appStore` initializes synchronously from **localStorage** (key `goodbye_wrapped_data_v1`). `migrateAppData()` runs on every load — coerces legacy shapes (string `bg`, `{kind:'preset'}` bg unchanged, mosaic `photos[]` → `media[]`, single fragment `dataUrl` → `dataUrls[]`, **`'orb-finale'` slides → `'wrapped-finale'`** with the orb config dropped).
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

## Wrapped Finale slide (current)

The `'wrapped-finale'` slide is a curated keepsake card placed before `signoff`. Brief: [`docs/SPIRIT_ANIMAL_BRIEF.md`](docs/SPIRIT_ANIMAL_BRIEF.md). It supersedes the earlier 3D memory orb (which was removed — see "Removed: Memory Orb" below).

### Pieces

- **Slide type:** `WrappedFinaleSlide` in `src/types/index.ts`. The slide carries no content fields — just the standard `bg`/`fragments`/song fields. Everything renders from the colleague's data.
- **Per-colleague data:** three optional fields on `Colleague` — `spiritAnimalMedia` (MediaItem — image base64 incl. GIF, or video URL), `spiritAnimalName`, `spiritAnimalTagline`. Missing media or name triggers the generic placeholder (★ in a glow circle + "Yet to be discovered" name). GIFs are stored uncompressed (the `compressImage()` canvas → JPEG path strips animation, so the upload handler skips it for `image/gif` MIME). Videos follow the same `public/videos/`-hosted URL pattern as mosaic/podium.
- **Soundtrack:** `getSoundtrack(colleague)` in `src/utils/wrapped.ts` walks `colleague.slides`, keeps any with `songUrl` + `songName`, and dedupes by `name|artist`. Capped at 8 in the rendered list with a "+ N more" hint when over.
- **PNG export:** `saveWrappedAsPng(card, name)` in `src/utils/wrapped.ts` uses `html-to-image` `toPng` with `pixelRatio: 3`. Filename is `wrapped-{slug}.png`. Awaits `document.fonts.ready` first (without it, fonts silently fall back to system on cold cache).
- **View:** `src/components/slides/WrappedFinaleSlideView.tsx`. Card node is the capture target via `cardRef`. Save button lives outside the card and is also tagged `data-html-to-image-ignore` (the `filter` callback in `saveWrappedAsPng` skips any element with that attr).

### Wiring

- `'wrapped-finale'` is in the `Slide` union, `SLIDE_TYPES` (🎁), and `makeDefaultSlide()`.
- `SlideRenderer.tsx` dispatches to `WrappedFinaleSlideView`.
- Fragments are **suppressed** on wrapped-finale slides so the keepsake card reads cleanly.
- `.wrapped-finale` is in the `:not()` exclusion list of the slide-content layering rule so the full-bleed card shell can be `position: absolute; inset: 0`.
- Admin: spirit animal fields edit at the **colleague level** (top of `ColleagueEditor.tsx`, `.spirit-animal-panel`). The slide's own field editor shows only a notice pointing to the colleague-level fields.
- `getSlideDuration()` returns 30 s (vs 7 s default) for wrapped-finale so the user has time to tap Save before auto-advance.
- `cleanColleagueForExport()` preserves `spiritAnimalImage`/`Name`/`Tagline` on export — add new colleague-level fields to that helper too or they'll vanish on export.

### Migration

`migrateSlide()` in `src/utils/index.ts` rewrites any legacy `'orb-finale'` slide to `'wrapped-finale'`, preserving the slot, bg, fragments, and song fields and dropping the `orb` config. Existing decks load + re-render with placeholder spirit animal data until Michael fills in the three fields per colleague.

`migrateColleague()` in the same file lifts legacy `spiritAnimalImage: string` (base64 dataUrl) → `spiritAnimalMedia: { kind: 'image', src }`. Old data round-trips cleanly into the new MediaItem-shaped field.

### Things to test before shipping

- **Fonts on cold cache:** Open in a private window, jump to the wrapped-finale, hit Save. Verify Jua + Nunito render in the PNG. If they fall back, switch to embedding fonts via `html-to-image`'s `fontEmbedCSS` option.
- **Save filename + sanitization:** colleague names with spaces/punctuation slugify cleanly.
- **Buttons not in PNG:** `data-html-to-image-ignore` strips them via the `filter` callback.
- **Layout @ 360px width:** narrowest realistic phone screen.
- **0 / 1 / 8+ tracks:** card renders correctly in all three.
- **Missing animal data:** placeholder appears, no broken image icon.

## Removed: Memory Orb

A 3D generative orb (three.js + @react-three/fiber + colorthief + simplex-noise) was previously the finale. It "didn't land" emotionally — abstract generative art without a name attached carried no weight. Replaced by the curated wrapped-finale (see above). All orb code, deps, and CSS were ripped out:
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
.slide > *:not(.fragment-layer):not(.slide-bg):not(.photo-lightbox):not(.photo-mosaic):not(.quote-mark):not(.wrapped-finale) {
  position: relative;
  z-index: 2;
}
```
This applies `position: relative; z-index: 2` to every direct child of `.slide`, *except* the listed exclusions. Anything that needs to be `position: absolute` (lightbox overlays, full-bleed children, the wrapped-finale shell) must be added to the exclusion list — otherwise its layout breaks silently. Specificity is (0,6,0), so a per-class override needs equal-or-higher specificity to win.

### 12. .mov files don't play reliably outside Safari
iPhone-recorded `.mov` (HEVC/H.265) plays in Safari but breaks in Chrome/Firefox. Always re-encode to `.mp4` (H.264) with the ffmpeg one-liner above.

### 13. html-to-image + web fonts
`html-to-image` will silently fall back to system fonts if the page's web fonts aren't fully loaded at capture time. `saveWrappedAsPng()` awaits `document.fonts.ready` first, but if a font is added after capture (rare), it can still miss. Test PNG export on a cold cache (private window) before shipping any change to the wrapped-finale's typography.

### 14. Mosaic edge-photo taps register as nav
Player has 30%-wide `nav-zone` overlays at left/right (z-index 4). Mosaic photos sit at `z-index: 7` so taps land on the photo. Critical that `.photo-mosaic` does NOT form a stacking context (it's in the `:not()` exclusion list — keeps the inner `<img>`/`<video>` z-index propagating to the player's stacking context).

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
| Tweak wrapped-finale visuals | `src/components/slides/WrappedFinaleSlideView.tsx` + `.wrapped-finale-*` rules in `global.css` |
| Tweak the soundtrack list | `getSoundtrack()` in `src/utils/wrapped.ts` (dedupe, ordering, cap) |
| Tweak the PNG export | `saveWrappedAsPng()` in `src/utils/wrapped.ts` (pixelRatio, filter, filename) |
| Edit a colleague's spirit animal | `.spirit-animal-panel` at the top of `ColleagueEditor.tsx` |

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
- The orb-finale → wrapped-finale migration in `migrateSlide()` — removing it would orphan any legacy decks still carrying `'orb-finale'` slides
- `cleanColleagueForExport()` must include any new colleague-level fields (e.g. `spiritAnimalImage`); otherwise they vanish on export
- `CLAUDE.md` must stay at project root (Claude Code loads it from there). Other docs go in `docs/`.
