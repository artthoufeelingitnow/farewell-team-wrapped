# Goodbye Wrapped — Project Context

## What this is

A personal goodbye gift for colleagues at **Pathlight School (Digital Academy)**. Each colleague gets their own custom Spotify-Wrapped-style slide deck, reached via a **private per-person link** and gated behind a password they receive privately.

**There is no public roster.** Nothing shipped to the web says who this was made for — not names, not ids, not a count. A colleague's name lives inside their own encrypted blob and only appears after their password decrypts it.

There is one deliberate exception: **the polaroid wall** (`#/w/<token>`), a single shared page for the wider team — everyone as a cat, pegged to a string. It *is* a roster by design, so it's sealed under a 134-bit link-token rather than a password. See "The polaroid wall" below.

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
├── data/                   # COMMITTED encrypted artifacts — produced by `npm run encrypt-data`
│   ├── index.json          #   public: meta ONLY. No names, no ids, no roster.
│   ├── colleagues/         #   per-colleague AES-GCM blobs, key = each colleague's plaintext password
│   │   └── <id>.json.enc   #   payload = { name, category?, slides }
│   ├── lookup/             #   password → deck id, for entry without a link
│   │   └── <digest>.json   #   { id }. Filename = PBKDF2(password), 600k iters
│   └── gallery/<digest>/   #   the shared polaroid wall, key = gallery token
│       ├── index.json.enc  #     names + COVER images only — the first paint
│       └── <i>.json.enc    #     one person's full card, fetched on tap
├── data.json               # gitignored. Admin source-of-truth (plaintext passwords on each colleague)
├── scripts/encrypt-data.mjs # data.json → data/index.json + data/colleagues/*.json.enc (Node WebCrypto)
├── CLAUDE.md               # ← you are here. MUST stay at root for tools to load it.
├── src/
│   ├── types/
│   ├── utils/{index, constants}.ts
│   ├── store/{appStore, playerStore, toastStore}.ts
│   ├── hooks/{audioEngine, useAudioEngine, useItunesSearch, useHashRoute, useDataJsonLoader}.ts
│   ├── styles/global.css
│   └── components/
│       ├── Toast.tsx
│       ├── landing/Unlock.tsx   # the entire public surface: password box + greeting
│       ├── gallery/        # GalleryWall + GalleryLightbox — the polaroid wall
│       ├── player/Player.tsx
│       ├── slides/         # one view component per slide type + SlideRenderer + FragmentLayer + SlideBackground
│       └── admin/          # Admin shell + Editor + SlidePreview + SlideStyleEditor + SlideFieldsEditor + SongPicker
└── .github/workflows/deploy.yml
```

## Architecture

**Three views**, switched by URL hash + a separate "in player?" check:

| Route | View | Who sees it |
|---|---|---|
| `#/d/<id>` | **Unlock** (password box, deck pinned by the link) | A colleague following their private link |
| `#` (default) | **Unlock** (password box, deck found *from* the password) | Someone who has their password but not their link |
| `#/w/<token>` | **Polaroid wall** (everyone as a cat, no password) | The wider team, via one shared link |
| `#admin` | **Admin tool** | Michael only — build/edit decks |
| (in-app, once a deck is unlocked) | **Player** | Visitors after decrypt |

`Route` is a discriminated union (`{kind:'landing'|'admin'|'deck'|'gallery'}`) in `useHashRoute.ts`; `parseHash` validates the deck id against `DECK_ID_RE` and the wall token against `GALLERY_TOKEN_RE` before either can reach a fetch URL, so `#/d/../../x` and `#/w/../../x` can't path-traverse out of `data/`.

The player overlay takes priority over routing — if `playerStore.currentColleagueId` is set, the player renders regardless of hash. See `src/App.tsx`.

**No roster route exists.** The old landing (category bubbles → name bubbles → password modal) is gone, along with the `trainer`/`yfa` routes and `Landing.tsx` / `PasswordModal.tsx`. Don't reintroduce a view that enumerates colleagues — that's the whole point of this design.

### State

Three Zustand stores in `src/store/`:
- **`appStore`** — the data (`meta` + `colleagues[]`). Admin mutations fire-and-forget a write to IndexedDB. Viewer-side entry points are `loadIndex(index)` (meta only) and `loadDeck(deck)` (one decrypted colleague, never persisted).
- **`playerStore`** — transient runtime state: `currentColleagueId`, `slideIndex`, `audioEnabled`, `paused` (hold-to-pause: halts auto-advance AND audio), `previewingMedia` (mosaic lightbox: halts auto-advance only — audio keeps playing as the emotional underscore), `unlockedColleagueIds`, `isPreviewMode`. Not persisted.
- **`toastStore`** — single-toast notifications, used via `showToast(msg)`.

### Data model

```ts
// In-memory + admin localStorage (the source-of-truth `data.json`):
AppData = {
  meta: { title, subtitle, farewellNote },
  colleagues: [{
    id, name,
    password?,               // plaintext, ADMIN-ONLY — IS the AES-GCM key. Stripped before encryption.
    slides: Slide[],         // discriminated union, see src/types/index.ts
    category?: 'trainer' | 'yfa',   // admin-side grouping only; drives no public UI
    hidden?: boolean,               // "Paused" — encrypt-data writes NO blob, link 404s
    inGallery?: boolean,            // opt in to the polaroid wall
    galleryCover?: 'left' | 'right',// which spirit-animal section fronts their polaroid
    galleryOnly?: boolean,          // wall polaroid but NO deck (no password, no link)
  }],
  gallery?: { token?, title?, note? }  // wall config. `token` is a credential — never committed.
}

// What every visitor fetches — `data/index.json`. Meta only. No roster:
AppDataIndex = { meta: { title, subtitle, farewellNote } }

// What's inside `data/colleagues/<id>.json.enc`, post-decrypt:
DeckPayload = { name, category?, slides }
```

A colleague only materialises in the viewer's store after their password
decrypts their blob: `loadDeck({id, name, category, slides})` inserts them and
runs `migrateAppData` over the deck. Not persisted, so a refresh re-prompts.
The **name comes from inside the ciphertext** — that's what makes the "Hi,
&lt;name&gt; 👋" greeting possible without publishing anyone's name.

Legacy blobs that encrypted a bare `Slide[]` still decrypt; `readPayload()` in
`Unlock.tsx` accepts both shapes (the legacy one just has no name).

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
| `soundtrack` | Soundtrack keepsake card. Eyebrow (default "your soundtrack") + optional title (display font, with Display/Spotify font picker) + track list (max 5, curated via `featuredTrackKeys`) + optional italic tagline at the bottom. Tracks come from the deck's songs **plus `extraTracks`** — bonus songs stored on the slide that aren't on any slide. PNG export via Web Share API. Default duration 30s. |
| `signoff` | Final card with replay/close buttons |

`MediaItem = { kind: 'image', src } | { kind: 'video', src }`. Image `src` is base64 dataUrl; video `src` is a URL (typically `${BASE_URL}videos/foo.mp4`).

Each slide type has its own view component in `src/components/slides/` and gets dispatched by `SlideRenderer.tsx`. Field editors live in `src/components/admin/SlideFieldsEditor.tsx`.

### Backgrounds, fragments, audio

- **Background**: discriminated `BgConfig`. Editor in `SlideStyleEditor.tsx` has three tabs (Preset / Custom / Lava). Preset tiles have a hover-revealed pencil that opens the native color picker → on pick, bg flips to `gradient` with that color as `from`. Lava blobs use `mix-blend-mode: screen` + per-blob `lava-drift-N` keyframes.
- **Fragments**: `FragmentConfig = { source: {kind:'preset', type} | {kind:'image', dataUrls[]}, pattern, density }`. Six motion patterns (`fall`, `fall-slow`, `flip-fall`, `rise`, `twinkle`, `drift`). Enabled on every slide type. `.fragment-layer { z-index: 0 }` — same level as `.slide-bg` but DOM-later so fragments paint over the bg, and DOM-earlier than slide content so anything at `z-index: 2` (the layering rule) or `z-index: auto` (excluded full-bleed wrappers like `.keepsake`) paints over fragments by document order. The keepsake PNG export only captures the inner `.keepsake-card` node, not the fragments around it — so fragments show in the live slide but the saved keepsake remains clean.
- **Audio engine** (`src/hooks/audioEngine.ts`): iTunes Search API → 30s previews. Two `Audio` elements crossfade between slides with 600ms ramp (`FADE_MS`). `pauseCurrent()` / `resumeCurrent()` halt and resume the current track without losing position (used by hold-to-pause). `onAutoplayBlocked(cb)` lets the player surface an unmute overlay if the first `play()` rejects with `NotAllowedError` (rare after the unlock click but real on iOS Low Power mode and some in-app browsers). Admin preview audio is separate (`previewSong`/`stopPreviewAudio`/`seekPreviewAudio`).

### Player gestures + timing

- **Hold-to-pause** (Instagram-style). Pointer-event handlers on `.player` start a 220ms timer (`HOLD_PAUSE_MS`); if the pointer hasn't moved more than 8px (`HOLD_MOVE_THRESHOLD_PX`) when it fires, `paused` flips true. Release flips it back. Move-threshold cancels the hold so swipes/scrolls (e.g. inside `.letter-wrap`) don't accidentally pause. The trailing `click` after a hold is suppressed via a ref so a hold never doubles as a nav-zone tap.
- **Three pause causes, intentionally distinct:**
  - `paused` (hold-to-pause) — halts the auto-advance timer AND pauses audio. Audio keeps its position so resume picks up mid-bar.
  - `pausedByVisibility` (tab/app backgrounded — `document.hidden` is true) — same effect as `paused`, but tracked separately so coming back to the tab doesn't override an in-flight hold. Set by a `visibilitychange` listener in `Player.tsx`.
  - `previewingMedia` (mosaic lightbox open) — halts auto-advance but lets audio keep playing. The song is the emotional underscore for the memory the user is lingering on; cutting it mid-bar to zoom on a photo broke the moment. `useAudioEngine` is fed `paused: paused || pausedByVisibility` (visibility halts audio, mosaic doesn't); the player's auto-advance + keyboard nav watch `halted || previewingMedia` where `halted = paused || pausedByVisibility`.
- **Timer resume across pauses.** `elapsedRef` accumulates elapsed-ms inside the interval tick. On unpause, `startedAt = Date.now() - elapsedRef.current`, so the first post-resume tick reads back the prior elapsed value. A separate effect resets `elapsedRef` only when `slideIndex` / `currentColleagueId` changes — pause toggles preserve it.
- **Autoplay-blocked overlay.** `#unmute-overlay` renders when `audioEngine.playSlide` first rejects with `NotAllowedError`. Single tap → `unblockAutoplay()` retries inside the user gesture. Mostly a fallback for iOS Low Power / corporate browsers; the unlock-click usually counts as activation.
- **iOS gesture polish.** `.player` sets `-webkit-touch-callout: none` + `user-select: none` so a long press doesn't trigger native image-save / text-callout UI. `onContextMenu` is preventDefaulted on the player root.

### Asset preloading

- `src/utils/preload.ts` exposes `preloadColleagueAssets(colleague)` — iterates the deck's slides and creates an `Audio` (for every `songUrl`) + a hidden `<video>` (for every remote video `MediaItem.src`) with `preload="auto"`, retaining strong refs so GC doesn't abort the in-flight fetches. URLs are deduped across calls (one fetch per asset per session).
- Wired in **two places**: `Landing.handleBubbleClick` (the moment the user shows intent — the password-entry seconds give the browser a head start) and `Player`'s mount effect (safety net for dev/preview flows that bypass Landing).
- Base64-inlined images aren't preloaded (they're already in memory); only network-hosted videos benefit. No-op for assets without URLs.

### Persistence + load order

On boot:
1. `appStore` kicks off an async read from **IndexedDB** at module load (`src/utils/storage.ts`; a one-time migration lifts the legacy `goodbye_wrapped_data_v1` localStorage key if it's still around). `isHydrated` flips true when it resolves. `migrateAppData()` runs on every load — coerces legacy shapes (string `bg`, `{kind:'preset'}` bg unchanged, mosaic `photos[]` → `media[]`, single fragment `dataUrl` → `dataUrls[]`, **`'orb-finale'` and `'wrapped-finale'` slides → `[spirit-animal, soundtrack]` pair** with bg/fragments/song fields preserved on the spirit-animal slide and the legacy colleague-level spirit animal data lifted onto its left section). Migration also DROPS the legacy `passwordHash` field — it's no longer used; admin shows "(needed for encryption)" until the user enters a plaintext `password`.
2. `useDataJsonLoader` async-fetches `${BASE_URL}data/index.json` (skipped entirely on the `#/w/` wall route — the wall needs nothing from the index, and `loadIndex()` would wipe the local draft it previews from). If it returns 200 with valid JSON, calls `loadIndex()` which **replaces** the store with meta and an **empty** colleague list. Marks `isExportedFile: true` — that flag is also what tells `Unlock` to take the fetch-and-decrypt path instead of the admin-draft path.
3. On submit, `Unlock` needs a deck id. The `#/d/<id>` link supplies one directly. **Without a link** it derives one: `deriveLookupDigest(password)` (PBKDF2-SHA256, 600k iters, fixed site salt) → fetch `data/lookup/<digest>.json` → `{ id }`. A 404 there is the wrong-password case.
4. With an id in hand it fetches `${BASE_URL}data/colleagues/<id>.json.enc` and runs `decryptJson(blob, enteredPassword)` (AES-GCM via WebCrypto). Auth-tag mismatch surfaces as `WrongPasswordError`. On success, `loadDeck()` inserts the colleague, and the "Hi, &lt;name&gt;" overlay's tap opens the player (that tap is also the user gesture that unblocks audio autoplay).

The link **pins** the deck: entering someone else's (valid) password against your link fails rather than opening their deck. The lookup path only runs when there's no id at all.

So in production, the index file always wins over a viewer's stale local data; a colleague's deck only lands in memory after a successful decrypt and is never persisted (refresh re-prompts).

**Failure messages are deliberately identical.** Wrong password, unknown id, and unpublished deck all render `GENERIC_FAILURE`. Distinct errors would let someone probe the id space to learn how many decks exist and which ids are real. HTTP status is `console.warn`'d for your own debugging, not shown.

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

The repo is **public**, so committing real content directly would expose letter text + photos — and a public name list would expose *who the gift is for*. Workaround: each colleague's deck ships as a **per-colleague AES-GCM blob** (including their name), encrypted with that colleague's own password. Every visitor downloads only a tiny `index.json` carrying `meta` and nothing else; the deck is fetched and decrypted only after the right password is entered against the right link. This solves privacy of content, privacy of the roster, AND page weight (~10s of MB → a few hundred bytes).

### Content workflow

1. Edit content in admin (`npm run dev`). Each colleague needs a `password` field set (plaintext — admin shows "(set ✓)" / "(needed for encryption)") and Link status = **Live**.
2. Click "Export final file" → downloads `data.json`. **This file contains plaintext passwords** and is gitignored.
3. Move it to repo root: `mv ~/Downloads/data.json .`
4. `npm run encrypt-data` → reads `data.json` and writes:
   - `data/index.json` — public, meta only, **no roster**
   - `data/colleagues/<id>.json.enc` — AES-GCM-256, PBKDF2-SHA256 600k iters, key = colleague's plaintext password, payload `{name, category?, slides}`
   The script wipes `data/` first, so removing a colleague from `data.json` removes their `.json.enc` too. It skips anyone with no password, no slides, or Link status = Paused, warns loudly for each, then **prints every published person's private link** to stdout.
5. Commit + push the `data/` tree.
6. GitHub Actions builds with `npm run build`, then copies the committed `data/` tree into `dist/data/`. No secrets needed in the workflow — there's no global passphrase anymore.
7. Send each person their link + password. Admin's **💬 Copy message** button (per colleague) puts a ready-to-send blurb with both on the clipboard; **🔗 Copy link** copies just the URL.
8. If anyone is marked for the polaroid wall, `encrypt-data` also writes `data/gallery/<digest>.json.enc` and prints the **one wall link** to share with the group. Export warns if people are featured but no wall token has been generated yet.

`scripts/encrypt-data.mjs` (Node, WebCrypto) MUST stay in sync with `src/utils/crypto.ts` (browser, WebCrypto) — same format `{v, salt, iv, ciphertext}` with the same KDF parameters.

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

Slide-level fields: `eyebrow` (small caps, default `"your soundtrack"`), `title` (display font, optional — e.g. a custom phrase), `titleFont` (Display / Spotify), `featuredTrackKeys?: string[]` (curated subset of the **track pool**, capped at 5; `undefined` = auto-pick first 5), `extraTracks?: ExtraTrack[]` (bonus songs, below), optional `tagline` (italic, rendered at the bottom). No footer (matches spirit-animal).

**The track pool** = the deck's songs (deck order, deduped by `name|artist`) **+** the slide's `extraTracks`. Built by `getTrackPool(colleague, slide)`; `getFeaturedSoundtrack(colleague, slide)` then applies the curation. All three of these agree on one key format via `trackKey(name, artist)` — if they ever diverge, `featuredTrackKeys` silently drops entries.

- **Type:** `SoundtrackSlide` + `ExtraTrack` in `src/types/index.ts`.
- **View:** [`src/components/slides/SoundtrackSlideView.tsx`](src/components/slides/SoundtrackSlideView.tsx). Same flat structure as spirit-animal: eyebrow / title / tracks / tagline rendered as **direct children** of the card. `justify-content: space-evenly` distributes equal gaps; with 4 children that's 5 gaps (top edge + 3 between + bottom edge). The card renders deck songs and bonus tracks identically — the distinction is admin-only.
- **Field editor:** `SoundtrackFields` in `SlideFieldsEditor.tsx`. Eyebrow + title + `TitleFontPicker`, tagline, then the checkbox track picker (capped at 5, "↺ Auto" reset, ↑↓ reorder), then an iTunes search for adding bonus tracks. Stored `featuredTrackKeys` are filtered against the current pool before display so orphaned keys (renamed/removed songs, deleted extras) don't inflate the counter.

**Bonus tracks (`extraTracks`)** — songs that belong on someone's list but never scored a slide. Added via the editor's "Add a song that isn't in the deck" iTunes search, which stores `{name, artist, art}` on the slide. They're marked with a `bonus` badge and an `×` remove button in the picker only. Notes:
- Adding one **features it immediately** (unless already at 5) — otherwise you'd add a track and see nothing change on the card.
- Deck songs win key collisions, so a bonus track that later gets used on a slide collapses to one entry rather than duplicating.
- Removing one leaves `featuredTrackKeys` alone if it's still `undefined` (auto), so deleting a bonus track doesn't silently freeze an auto-pick into a fixed list.
- They carry **no `songUrl`** — a bonus track is a line on the card, not something the audio engine ever plays.

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
- **Bonus tracks:** add one to a deck with 0 songs and to a deck already at 5 featured; confirm the first appears on the card immediately and the second lands in "add more" as disabled. Remove one and confirm it leaves both the pool and the featured list.
- **Missing media on a section:** placeholder ★ appears, no broken image icon.

## The polaroid wall

A second, separate page for the wider team — the colleagues who didn't get a
full deck. One shared link, no password, showing everyone as a cat: polaroids
pegged to sagging twine, tap one to open the full spirit-animal card.

**It loads in two stages.** `index.json.enc` carries names and cover images
only; a person's full spirit-animal card is fetched and decrypted when their
polaroid is tapped, then cached for the session. This is not premature
optimisation — the first version bundled all 27 cards into one blob and came
out at **107 MB**, over GitHub's hard 100 MB file limit and an absurd download
for a page of thumbnails. The cover half of a card is a small jpeg; the other
half is routinely a multi-MB GIF (one is 25 MB). Splitting took the first paint
to ~6 MB. `encrypt-data` prints both numbers and warns at 90 MB.

**Reached at `#/w/<token>`.** The token is 26 base36 chars (~134 bits) from
`makeGalleryToken()`, and it is simultaneously the AES-GCM key for the wall's
blob and (via SHA-256) the blob's filename. So the link *is* the credential:
there's no password box, and the repo shows only ciphertext at an opaque
filename. Rotating the token in admin invalidates every copy of the old link on
the next export.

### Why it doesn't break the no-roster rule

The wall genuinely is a roster — names and faces on one page. That's the point
of it, and it's fine *because it's sealed under the token*. Two invariants keep
it from leaking into the deck system:

- **No colleague ids anywhere in the wall.** `GalleryEntry` carries a name and
  a cover image; a card blob carries a slide. The `<i>` in a card's filename is
  a position on the wall, nothing more. The wall goes to a whole group; an id in
  it would hand every recipient the deck ids of the people featured, enough to
  probe `data/colleagues/<id>.json.enc` and work out which of their colleagues
  *also* got a private wrapped. Don't add one, not even as a React key.
  (The file *count* in `data/gallery/<digest>/` does reveal how many people are
  on the wall — same accepted leak as `data/colleagues/`, and the recipients can
  see the wall anyway.)
- **The token never ships in `data/index.json`.** It lives in `AppData.gallery`,
  which stays in the gitignored `data.json`.

### Where the cards come from

The wall renders **the same `<SpiritAnimalCard>` the player does** — extracted
into `src/components/slides/SpiritAnimalCard.tsx` so the deck and the wall can't
drift apart. Each entry is that person's *first* `spirit-animal` slide, so
people who already have decks need no second copy of their cat: edit the slide,
re-export, the polaroid updates.

`buildWallPeople()` in `src/utils/gallery.ts` is the single ordered list both
the index and the card blobs derive from — **that order is a contract**, since a
person's position in it is the `<i>` their card is named after. It's mirrored by
the same logic in `scripts/encrypt-data.mjs`, including `DROPPED_CARD_FIELDS`
(song fields, fragments, transient admin state are all stripped; the wall has no
audio engine). **If those diverge, the wall you preview stops matching the wall
you ship — or worse, a polaroid opens someone else's card.**

### People with no deck

A wall-only person is just a `Colleague` with `galleryOnly: true`, no password,
and a single spirit-animal slide. Reusing `Colleague` rather than a parallel
type means they get the whole existing `SpiritAnimalFields` editor for free —
media upload, drag-to-crop, captions, title font picker. `encrypt-data` skips
them silently for deck/lookup generation (they're *expected* to have no
password, so warning about it every export would train you to ignore the
warning that matters). Admin's "+ Add wall-only person" pre-wires all of it.

### Admin surface

- **Per person** (`ColleagueEditor`): a Type select (full deck / wall only), a
  "Polaroid wall" on-off, and a "Polaroid shows" left/right cover picker. A
  warning appears inline if someone's featured but has no spirit-animal slide.
- **Globally** ("Polaroid wall" button → `GalleryEditor`): heading, note,
  generate/rotate/copy the link, and a read-only roster of who's on it.
- `ColleagueList` marks wall members 📌 and shows 🖼 (not ⚠️) for wall-only people.

### Visual design

Modelled on physical photo displays — twine, mini clothespins, handwriting.
Details that carry it:

- **Measured sag.** Each row draws an SVG catenary, and every polaroid's
  `--drop` is *measured* from its laid-out position (`WallRow`'s layout effect),
  not computed from its index. Flexbox centres short rows and sizes gaps with
  `clamp()`, so index math left the clothespins floating off the twine at most
  widths. Written straight to the DOM — this runs on every resize.
- **Stable tilt.** `polaroidTilt(name, index)` hashes to −4°..+4°, so a photo
  hangs the same way on every visit instead of reshuffling per render.
- **Swing from the peg.** `transform-origin: 50% 0`. Hover sets `--tilt: 0deg`
  on `.polaroid`, which straightens the counter-rotating `.polaroid-pin` for
  free.
- **Handwriting** (`--font-hand`, Caveat) on the white strip under each photo.
  Added to the Google Fonts link in `index.html`.
- The wall uses its own warm off-white palette, deliberately *not* the deck
  gradients — the cats carry the colour.

## Removed: Memory Orb

A 3D generative orb (three.js + @react-three/fiber + colorthief + simplex-noise) was previously the finale. It "didn't land" emotionally — abstract generative art without a name attached carried no weight. Replaced first by a single `wrapped-finale` keepsake card, then split into the current `spirit-animal` + `soundtrack` pair (see above). All orb code, deps, and CSS were ripped out:
- Removed deps: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`, `colorthief`, `simplex-noise`. Bundle dropped ~900 KB.
- Removed dirs/files: `src/components/orb/`, `src/components/slides/OrbFinaleSlideView.tsx`.
- Removed types: `OrbFinaleSlide`, `OrbConfig`, `OrbGeometryPreset`.
- Removed CSS: all `.memory-orb*` classes (was at the bottom of `global.css`).
- The `'orb-finale'` slide type is gone from the union; the migration converts existing data so this is non-breaking for production decks.

## Gotchas

### 1. Admin draft is device-local (IndexedDB)
Editing on laptop ≠ editing on phone. Pick one device, or export frequently as backup. "Import data.json" in admin restores a draft from a previous export.

### 2. Photo size
Each photo is base64-embedded into `data.json`. `compressImage()` shrinks to 900px max @ 0.85 JPEG (single photos) or 700px (mosaic). 9 mosaic + 3 single can push past 5MB. Drop `maxDim` if it gets unwieldy.

### 3. iTunes preview URLs are fixed
The 30s clip Apple returns always starts at the same point (usually the chorus). `songStart` only skips forward inside that 30s window.

### 4. Songs need internet at view time
Song URLs reference Apple's CDN. Colleagues must be online when viewing.

### 5. Password-only entry and its trade-off
`data/lookup/<digest>.json` lets someone with only their password find their deck (they bookmarked the old landing page, or lost the link). The digest is PBKDF2-SHA256 at the same 600k iterations as the deck key, so a guess costs the same as attacking a blob directly, and the file contains only an id — no name.

The salt **has to be fixed** (`LOOKUP_SALT`, duplicated in `src/utils/crypto.ts` and `scripts/encrypt-data.mjs`) because the point is finding the deck before you know whose it is. Consequence: one PBKDF2 run tests a candidate password against *every* deck at once, rather than one run per deck. With a handful of decks that's a small constant factor, but it does mean password entropy is now the only thing standing between a guesser and *somebody's* deck — before, they also had to pick the right id. Don't reuse a password across two colleagues; `encrypt-data` warns if you do, since the lookup file would collide.

### 6. What the private link does and doesn't hide
The link (`#/d/<id>`) is a *locator*, not a credential — the password is the credential. Anyone holding a link still needs the password. The link also **pins** the deck: a valid password for a different colleague won't open their deck through your link. Limits of the roster hiding:
- **The public repo lists the blob filenames.** Anyone browsing `data/colleagues/` on GitHub sees N opaque ids, so the *count* of decks is visible. The names are not.
- **The hash fragment never reaches the server**, so the id doesn't appear in GH Pages logs or Referer headers — but it does appear in the recipient's browser history and in any screenshot of the URL bar.
- Blob sizes differ, so file listings leak rough deck sizes. Nothing identifying.

### 7. Password security
Each colleague's deck is real AES-GCM encrypted with their own password (PBKDF2-SHA256 600k iters). The encrypted blob is what ships to GitHub; the slides only exist in plaintext server-side as the gitignored `data.json` and client-side after a successful decrypt. Still: a determined attacker who guesses the password gets the deck, and the password DOES travel through your laptop's localStorage (admin source-of-truth). Don't pick passwords that would be catastrophic if cracked, and don't share `data.json`.

### 8. Transient admin state in slides
Admin-only fields leak into `slide` objects: `showSongPicker`, `songSearchQuery`, etc. `cleanColleagueForExport()` strips them. Add new transient fields to `TRANSIENT_FIELDS` in `src/utils/index.ts`.

### 9. WebCrypto parameters must match across encrypt + decrypt
`PBKDF2_ITERATIONS = 600_000`, `SALT_BYTES = 16`, `IV_BYTES = 12`, `AES-GCM-256` and `LOOKUP_SALT` are duplicated in `src/utils/crypto.ts` (browser) and `scripts/encrypt-data.mjs` (Node). Change one without the other and every existing `.json.enc` becomes undecryptable — or, for `LOOKUP_SALT`, password-only entry silently 404s for everyone while the link path keeps working (an easy one to miss). Bump the `v` field in the blob format if you ever need to change the cipher params; both sides reject mismatched versions.

### 10. Don't commit data.json (plaintext, includes plaintext passwords)
It's in `.gitignore`. The committed artifacts are `data/index.json` (public) + `data/colleagues/*.json.enc` (encrypted).

### 11. Vite base path mismatches
If you rename the GH Pages repo or switch to a custom domain, update `base` in `vite.config.ts`.

### 12. Vite dev DOES serve the committed `data/` tree
`data/` sits at the project root, and Vite's dev server serves the root — so
`http://localhost:5173/data/index.json` returns the **real committed file**, not
a 404. Consequences that have already bitten once:
- `isExportedFile` is `true` in dev, so any "we must be in admin/dev" check
  written against it is wrong on your own machine. The wall decides via "does
  this browser hold a draft with anyone pinned to the wall" instead.
- A *missing* file under `data/` returns **200 with `index.html`** (Vite's SPA
  fallback), not 404. So `res.ok` is not a sufficient guard in dev — the JSON
  parse is the real one.

### 13. The wall has a hard size ceiling
GitHub rejects any file over 100 MB at push time (`GH001`), and the wall
aggregates media across everyone on it. That's why it ships split — see "The
polaroid wall". Two things follow: a *single person's* card must stay under
100 MB on its own, and the index (every cover, downloaded by everyone on open)
should stay small. Animated GIFs are the usual culprit — `compressImage()`
doesn't touch them, since rasterising would kill the animation. `encrypt-data`
prints both sizes on every run.

### 14. On your own machine, the wall always shows your draft
`GalleryWall` prefers the local IndexedDB draft whenever it holds anyone with
`inGallery`, so you can build the wall without exporting. That means the wall
link never shows you the *published* blob on the laptop you author from. To see
what everyone else sees, open it in a private window.

### 15. StrictMode double-render
React 19 + StrictMode runs effects twice in dev. The audio engine's URL-match guard makes it idempotent; new module-level state must tolerate double-firing.

### 16. The `:not()` content-layering rule
`src/styles/global.css` has:
```css
.slide > *:not(.fragment-layer):not(.slide-bg):not(.photo-lightbox):not(.photo-mosaic):not(.quote-mark):not(.keepsake) {
  position: relative;
  z-index: 2;
}
```
This applies `position: relative; z-index: 2` to every direct child of `.slide`, *except* the listed exclusions. Anything that needs to be `position: absolute` (lightbox overlays, full-bleed children, the keepsake shell) must be added to the exclusion list — otherwise its layout breaks silently. Specificity is (0,6,0), so a per-class override needs equal-or-higher specificity to win.

### 17. .mov files don't play reliably outside Safari
iPhone-recorded `.mov` (HEVC/H.265) plays in Safari but breaks in Chrome/Firefox. Always re-encode to `.mp4` (H.264) with the ffmpeg one-liner above.

### 18. html-to-image + web fonts
`html-to-image` will silently fall back to system fonts if the page's web fonts aren't fully loaded at capture time. `saveCardAsPng()` awaits `document.fonts.ready` first, but if a font is added after capture (rare), it can still miss. Test PNG export on a cold cache (private window) before shipping any change to the keepsake slides' typography.

### 19. Mosaic edge-photo taps register as nav
Player has 30%-wide `nav-zone` overlays at left/right (z-index 4). Mosaic photos sit at `z-index: 7` so taps land on the photo. Critical that `.photo-mosaic` does NOT form a stacking context (it's in the `:not()` exclusion list — keeps the inner `<img>`/`<video>` z-index propagating to the player's stacking context). The `.letter-wrap` is in the same exclusion list at `z-index: 7` for the same reason — without it, only the middle 40% of a long letter is actually scrollable because the side nav-zones cover the rest.

### 20. `navigator.share({ files })` only works in real browsers
The keepsake save flow opens the OS share sheet (→ "Save to Photos" / "Save to Gallery") only when the browser supports Web Share with files. **In-app browsers** (Instagram, Facebook, Slack, Gmail link previews, etc.) usually return `false` from `navigator.canShare({ files })`, so the user falls through to the download path. There is no zero-tap "save to gallery" available on the open web — even when the share sheet works, the user still taps "Save Image" once. If a colleague reports the file going to Downloads instead of Photos, they're almost certainly opening the link inside an app, not Safari/Chrome.

### 21. Hold-to-pause vs scroll containers
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
| Touch the password / unlock flow | `src/components/landing/Unlock.tsx` + `decryptJson()` in `src/utils/crypto.ts` |
| Tweak the polaroid wall's look | `src/components/gallery/GalleryWall.tsx` + the `.wall*` / `.polaroid*` rules at the bottom of `global.css` |
| Change who's on the wall | Per-colleague "Polaroid wall" toggle in `ColleagueEditor.tsx` (`inGallery` / `galleryCover`); global settings in `GalleryEditor.tsx` |
| Change what the wall publishes | `buildWallPeople()`/`buildGalleryEntries()` in `src/utils/gallery.ts` AND `writeGallery()` in `scripts/encrypt-data.mjs` — together, always |
| Wall too heavy / a file near 100 MB | Shrink that person's spirit-animal media. `encrypt-data` prints the index size and the largest card, and warns at 90 MB |
| Rotate / regenerate the wall link | "♻ New link" in `GalleryEditor` → re-run `npm run encrypt-data`. Every old link dies. |
| Change the wall link format | `galleryHash`/`galleryUrl`/`GALLERY_TOKEN_RE` in `src/utils/links.ts` + `parseHash()` + `galleryUrl` in `scripts/encrypt-data.mjs` |
| Change the private-link format | `src/utils/links.ts` (`deckHash`/`deckUrl`/`SITE_URL`) + `parseHash()` in `useHashRoute.ts` + `SITE_URL` in `scripts/encrypt-data.mjs` — all three together |
| Change the encrypt format | `src/utils/crypto.ts` AND `scripts/encrypt-data.mjs` together — they MUST agree |
| Change deploy / data flow | `.github/workflows/deploy.yml` + `useDataJsonLoader.ts` + `scripts/encrypt-data.mjs` |
| Tweak spirit-animal slide visuals | `src/components/slides/SpiritAnimalSlideView.tsx` + `.keepsake-*` / `.spirit-section-*` rules in `global.css` |
| Tweak soundtrack slide visuals | `src/components/slides/SoundtrackSlideView.tsx` + `.keepsake-*` / `.keepsake-track-*` rules in `global.css` |
| Tweak the soundtrack list logic | `getSoundtrack()` / `getTrackPool()` / `getFeaturedSoundtrack()` in `src/utils/wrapped.ts` (dedupe, cap, bonus tracks) — all keyed by `trackKey()` |
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
npm run encrypt-data # data.json → data/index.json + data/colleagues/*.json.enc
```

## Don't break

- **The no-roster invariant.** `data/index.json` carries `meta` and nothing else, and no name, id, or count is published anywhere. Don't add a colleague list to the index, a name to the URL, or any view that enumerates people. The whole design exists so a visitor can't see who this was made for. The polaroid wall is the one sanctioned exception, and only because it's sealed under its own link-token.
- **No colleague ids in the wall blob** (`GalleryEntry` = name + cover + slide). Adding one — even as a React key — would let anyone holding the shared wall link work out which of the featured people also has a private deck.
- **The wall token never ships publicly.** It lives in `AppData.gallery` in the gitignored `data.json`, and `loadIndex()` deliberately drops it. It's the key AND the filename AND the credential.
- **`buildGalleryEntries()` / `DROPPED_CARD_FIELDS` are mirrored** in `src/utils/gallery.ts` and `scripts/encrypt-data.mjs`. Diverging them makes admin's wall preview lie about what ships.
- **`<SpiritAnimalCard>` is shared** by the player and the wall. Fork it and the "your polaroid opens your actual card" promise quietly stops being true.
- **Names live inside the ciphertext** (`DeckPayload.name`). Moving a name back out to a public file re-breaks the above.
- **Identical failure messages** in `Unlock.tsx` — separate "no such deck" / "wrong password" / "no lookup match" errors would make the id space probeable.
- **`LOOKUP_SALT` and the 600k iterations on the lookup digest.** Dropping the iteration count to make password-only entry feel snappier would turn `data/lookup/` into a cheaply brute-forceable list of password hashes.
- The decrypt-to-unlock gate (no `passwordHash` field anymore — gating IS the AES-GCM auth-tag check; if you bring back a hash field, also bring back the bypass it represents)
- `DECK_ID_RE` validation before a deck id reaches a fetch URL — it's what stops `#/d/../../whatever`
- The encrypted-blob deploy invariant (`data.json` gitignored — contains plaintext passwords; only `data/index.json` + `data/colleagues/*.json.enc` are committed)
- Auto-save on every edit (don't introduce a manual "save" requirement)
- The single global CSS file — visual consistency depends on it
- The discriminated unions for `Slide` / `BgConfig` / `FragmentSource` / `MediaItem` — type narrowing depends on the discriminator field
- The `:not()` content-layering rule — adding new full-bleed components requires updating the exclusion list
- The legacy-finale → `[spirit-animal, soundtrack]` expansion in `migrateColleague()` — removing it would orphan any legacy decks still carrying `'orb-finale'` or `'wrapped-finale'` slides
- `cleanColleagueForExport()` must include any new colleague-level fields; otherwise they vanish on export
- The three-way `paused` / `pausedByVisibility` / `previewingMedia` split in `playerStore` — collapsing them back together would re-introduce the regression where opening a mosaic photo cuts the song mid-bar, OR break the hold-to-pause-survives-tab-return invariant. Hold + visibility both halt audio; mosaic preview does not.
- `useAudioEngine` is fed `paused || pausedByVisibility` (NOT `previewingMedia`) — preserve that asymmetry.
- Hold-to-pause's nav-zone click suppression — if you remove `suppressClickRef`, releasing a hold will navigate the deck.
- `CLAUDE.md` must stay at project root (Claude Code loads it from there). Other docs go in `docs/`.
