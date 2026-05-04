# Goodbye Wrapped — Project Context

## What this is

A personal goodbye gift for colleagues at **Pathlight School (Digital Academy)**. Each colleague gets their own custom Spotify-Wrapped-style slide deck — gated behind a password they receive privately.

The vibe: a heartfelt mini-memoir framed as a wrapped recap. Not a generic "thanks for everything" — each deck is custom-built per person.

Originally built as a single self-contained HTML file (still preserved as `index.original.html` for reference). Refactored to React + Vite + TypeScript so it's easier to extend.

**Live URL:** `https://artthoufeelingitnow.github.io/farewell-team-wrapped/`

## Stack

- **Vite 6** + **React 19** + **TypeScript 5.6** (strict mode, discriminated unions)
- **Zustand** for state (no Redux, no Context-only — small project, three discrete stores)
- **three.js + @react-three/fiber + @react-three/drei** for the orb finale slide (Phase 1 added recently — bumped bundle 250 KB → 1.16 MB / gzip 77 → 324 KB)
- **colorthief** v3 for palette extraction from photos (uses named exports `getPaletteSync` etc., NOT the old default-class API the docs sometimes show)
- **Vanilla CSS** in one global stylesheet (`src/styles/global.css`). No CSS modules, no Tailwind. Class names like `.bg-pink`, `.slide-eyebrow`, `.podium-step`, `.memory-orb` are stable contracts; don't rename casually.

## Repo layout

```
farewell_wrapped/
├── public/
│   └── videos/             # hosted .mp4/.webm files for mosaic video media
├── docs/                   # design briefs (MEMORY_ORB_BRIEF.md etc.)
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
│       ├── orb/            # the 3D memory orb finale (Phase 1 — see "Active WIP" below)
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
    slides: Slide[]          // discriminated union, see src/types/index.ts
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
| `orb-finale` | 3D generative finale orb (Phase 1 — see "Active WIP"). |
| `signoff` | Final card with replay/close buttons |

`MediaItem = { kind: 'image', src } | { kind: 'video', src }`. Image `src` is base64 dataUrl; video `src` is a URL (typically `${BASE_URL}videos/foo.mp4`).

Each slide type has its own view component in `src/components/slides/` and gets dispatched by `SlideRenderer.tsx`. Field editors live in `src/components/admin/SlideFieldsEditor.tsx`.

### Backgrounds, fragments, audio

- **Background**: discriminated `BgConfig`. Editor in `SlideStyleEditor.tsx` has three tabs (Preset / Custom / Lava). Preset tiles have a hover-revealed pencil that opens the native color picker → on pick, bg flips to `gradient` with that color as `from`. Lava blobs use `mix-blend-mode: screen` + per-blob `lava-drift-N` keyframes.
- **Fragments**: `FragmentConfig = { source: {kind:'preset', type} | {kind:'image', dataUrls[]}, pattern, density }`. Six motion patterns (`fall`, `fall-slow`, `flip-fall`, `rise`, `twinkle`, `drift`). Disabled on `orb-finale` slides.
- **Audio engine** (`src/hooks/audioEngine.ts`): iTunes Search API → 30s previews. Two `Audio` elements crossfade between slides with 600ms ramp (`FADE_MS`). Admin preview audio is separate (`previewSong`/`stopPreviewAudio`/`seekPreviewAudio`).

### Persistence + load order

On boot:
1. `appStore` initializes synchronously from **localStorage** (key `goodbye_wrapped_data_v1`). `migrateAppData()` runs on every load — coerces legacy shapes (string `bg`, `{kind:'preset'}` bg unchanged, mosaic `photos[]` → `media[]`, single fragment `dataUrl` → `dataUrls[]`).
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

## Active WIP — Memory Orb finale

A 3D generative orb is the planned finale, parameterized deterministically by colleague name + photo palette. Brief lives at `docs/MEMORY_ORB_BRIEF.md`.

### Phase 1 — DONE (do not redo)

Files in `src/components/orb/`:
- `useOrbSeed.ts` — `hashName(name) → 32-bit int` and derived values (norm, rotationStart, hueOffset)
- `usePalette.ts` — collects images from photo/mosaic/podium slides → `getPaletteSync` from `colorthief` → harmonized hex palette. Falls back to brand-tinted preset endpoints when no photos exist.
- `OrbScene.tsx` — `<Canvas>` with faceted `IcosahedronGeometry(1, 1)`, `MeshStandardMaterial` (flatShading, slight metalness, emissive tint), gentle Y-axis rotation, ambient + key + fill light, `gl={{ preserveDrawingBuffer: true }}` so PNG export works.
- `saveOrbImage.ts` — composites the live orb canvas into a 1080×1080 share-card with title + caption, triggers PNG download.
- `MemoryOrb.tsx` — wraps OrbScene with title/caption overlay + "Save my wrapped" button.

Wiring:
- `'orb-finale'` is in the `Slide` union, `SLIDE_TYPES` (🔮), and `makeDefaultSlide()`.
- `SlideRenderer.tsx` dispatches to `OrbFinaleSlideView`.
- Fragments are **suppressed** on orb-finale slides (clean 3D stage).
- `.memory-orb` is in the `:not()` exclusion list of the slide-content layering rule so its `position: absolute; inset: 0` survives.
- Admin field editor shows a "no editable fields" notice for orb-finale.

**Placement decision (Michael):** the orb-finale lives **before** the signoff slide (not replacing it). Admin manually places it.

### Phase 2 — PENDING (DO NOT START without Michael's signal)

The brief explicitly says: ship Phase 1, get Michael's feedback, *then* talk about Phase 2. Phase 2 work to do:
- Particle field around the orb (color-matched, 2000–5000 max)
- Surface displacement using simplex noise → orb shape varies per person
- Better lighting setup (3-point, environment map)
- Smooth fade-in animation when slide loads

### Phase 3 — STRETCH

- Per-colleague shape variation beyond color (different geometry types selected by hash)
- Optional video export (MediaRecorder API → webm)
- Sound on save success

### Open polish items for Phase 1 (small, can do anytime)

- **Lazy-load three.js**: wrap `MemoryOrb` in `React.lazy()` so the 1 MB three.js bundle only loads when an orb-finale slide actually plays. Vite's chunk-size warning currently fires on build.
- **Test cross-browser save**: Chrome/Safari/Firefox PNG download. `preserveDrawingBuffer: true` is set, but worth confirming on the live deploy.
- **Test on phones / throttled CPU**: rotation should not stutter.

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
.slide > *:not(.fragment-layer):not(.slide-bg):not(.photo-lightbox):not(.photo-mosaic):not(.quote-mark):not(.memory-orb) {
  position: relative;
  z-index: 2;
}
```
This applies `position: relative; z-index: 2` to every direct child of `.slide`, *except* the listed exclusions. Anything that needs to be `position: absolute` (lightbox overlays, full-bleed children, the orb container) must be added to the exclusion list — otherwise its layout breaks silently. Specificity is (0,6,0), so a per-class override needs equal-or-higher specificity to win.

### 12. .mov files don't play reliably outside Safari
iPhone-recorded `.mov` (HEVC/H.265) plays in Safari but breaks in Chrome/Firefox. Always re-encode to `.mp4` (H.264) with the ffmpeg one-liner above.

### 13. Three.js bundle size
Adding the orb pulled in three.js (~900 KB minified). Until lazy-loading is added, the whole bundle ships up front. Watch for slow phone loads.

### 14. colorthief v3 API
The colorthief package on npm is now v3 with **named exports** (`getPalette`, `getPaletteSync`, `getColor`, etc.) returning Color objects with `.hex()`. The brief in `docs/` references the older default-class API — that's stale; do not import `ColorThief` as default.

### 15. Mosaic edge-photo taps register as nav
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
| Tweak orb visuals | `src/components/orb/OrbScene.tsx` (geometry, materials, lights) |
| Tweak orb palette | `src/components/orb/usePalette.ts` (harmonization, fallback) |
| Adjust the export PNG | `src/components/orb/saveOrbImage.ts` |

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
- **Phase boundaries on the memory orb** — Phase 1 is shipped, Phase 2 needs Michael's go-ahead per the brief
- `CLAUDE.md` must stay at project root (Claude Code loads it from there). Other docs go in `docs/`.
