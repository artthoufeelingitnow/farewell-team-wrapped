# Goodbye Wrapped — Project Context

## What this is

A personal goodbye gift for colleagues at **Pathlight School (Digital Academy)**. Each colleague gets their own custom Spotify-Wrapped-style slide deck — gated behind a password they receive privately.

The vibe: a heartfelt mini-memoir framed as a wrapped recap. Not a generic "thanks for everything" — each deck is custom-built per person.

Originally built as a single self-contained HTML file (still preserved as `index.original.html` for reference). Refactored to React + Vite + TypeScript so it's easier to extend.

## Stack

- **Vite 6** + **React 19** + **TypeScript 5.6** (strict mode, discriminated unions)
- **Zustand** for state (no Redux, no Context-only — small project, three discrete stores)
- **Vanilla CSS** in one global stylesheet (`src/styles/global.css`) — extracted verbatim from the original. No CSS modules, no Tailwind. Class names like `.bg-pink`, `.slide-eyebrow`, `.podium-step` are stable contracts; don't rename casually.

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
- **`playerStore`** — transient runtime state: `currentColleagueId`, `slideIndex`, `audioEnabled`, `unlockedColleagueIds`, `isPreviewMode`. Not persisted.
- **`toastStore`** — single-toast notifications, used via `showToast(msg)`.

### Data model

```ts
AppData = {
  meta: { title, subtitle, farewellNote },
  colleagues: [
    {
      id, name, passwordHash,  // SHA-256 of password
      slides: Slide[]          // discriminated union, see src/types/index.ts
    }
  ]
}
```

`Slide` is a discriminated union over `type`. Each slide also carries optional song fields (`songUrl`, `songName`, `songStart`, `songDuration`, …) and admin-transient fields (`songSearchQuery` etc.) that get stripped on export.

**Slide types** (registered in `src/utils/constants.ts → SLIDE_TYPES`):
- `intro` — opener with eyebrow + title + sub
- `stat` — big number/text + label + caption
- `photo` — single polaroid-framed photo with caption
- `quote` — large italic quote + attribution
- `podium` — top 3 ranked items (visually arranged 2nd / 1st / 3rd)
- `letter` — long-form heartfelt message (scrollable)
- `mosaic` — 3×3 photo grid
- `signoff` — final card with replay/close buttons

Each slide type has its own view component in `src/components/slides/` and gets dispatched by `SlideRenderer.tsx`. Field editors live in `src/components/admin/SlideFieldsEditor.tsx`.

### Persistence + load order

On boot:
1. `appStore` initializes synchronously from **localStorage** (key `goodbye_wrapped_data_v1`). In dev with no exported data, this is the source of truth.
2. `useDataJsonLoader` async-fetches `${BASE_URL}data.json`. If it returns 200 with valid JSON, calls `loadFromExport()` which **replaces** the store data (and skips persistence — viewers shouldn't accumulate state).

So in production, `data.json` always wins over a viewer's stale localStorage.

### Audio engine

Singleton class in `src/hooks/audioEngine.ts`. React glue in `src/hooks/useAudioEngine.ts`.

- **Source:** iTunes Search API (`https://itunes.apple.com/search`) via `useItunesSearch` hook — no auth, ~20 req/min, returns 30s preview URLs.
- **Why not Spotify:** Spotify killed `previewUrl` for new apps in late 2024. The remaining Spotify paths (iframe embed / Web Playback SDK) all sacrifice the wrapped aesthetic or require viewers to have Premium.
- **Playback:** two `Audio` elements (current, next) for crossfading between slides.
- **Fade:** 600ms (`FADE_MS`), 20-step volume ramp.
- **Per-slide config:** `songStart` (0–25s into the 30s preview) and `songDuration` (3000–30000ms, drives both audio length and slide duration).
- **Admin preview audio** is separate — `previewSong()` / `stopPreviewAudio()` exposed from the same module, single track at a time.

The autoplay-block "Tap to play with sound" overlay was **removed** — autoplay generally works because the password unlock click counts as a user gesture. If a viewer's browser blocks it silently, they can hit the 🔇 mute button to recover.

## Conventions

### Fonts
- **Display:** Jua (Google Fonts) — Michael's signature font, single weight 400
- **Body:** Nunito — paired with Jua for readability
- Defined as CSS vars: `--font-display`, `--font-body`
- **Jua applies to:** landing title, name bubbles, password modal greeting, slide titles/eyebrows/big numbers, quote bodies, podium ranks, letter greeting + signoff
- **Nunito applies to:** letter bodies, all admin UI, small text

### Color palette (slide gradients)
```
bg-pink   FF6B9D → C9184A
bg-orange FF8C42 → D32F2F
bg-teal   4ECDC4 → 1A535C
bg-purple B57EDC → 5E2A8C
bg-yellow FFC75F → F39C12  (uses dark text)
bg-green  06D6A0 → 115E47
bg-blue   4FC3F7 → 1E3A8A
bg-dark   1a1a1a → 000
bg-cream  FFF8E7 → F5DEB3  (uses dark text)
```

### Code style
- Strict TypeScript. Prefer narrowing via the `Slide` discriminated union over type assertions.
- Keep components focused — slide views are small and pure; field editors handle their own form state where stateful (e.g. `ClampedNumberInput` in `SongPicker.tsx`).
- React StrictMode is on in dev (`src/main.tsx`). Effects run twice — be idempotent.
- `uid()` returns 8-char base36 IDs.

## Deploy story

Hosted on **GitHub Pages** at `https://artthoufeelingitnow.github.io/farewell-team-wrapped/`.

The repo is **public**, so committing real content directly would expose letter text + photos. Workaround: data ships as an **encrypted blob**.

### How content gets to production

1. Edit content in admin (`npm run dev`), click "Export final file" → downloads `data.json`
2. Move it to repo root: `mv ~/Downloads/data.json .`
3. `npm run encrypt-data` → produces `data.json.enc` (AES-256, PBKDF2 600k iterations). Prompts for the passphrase.
4. Commit + push `data.json.enc`. **`data.json` itself is gitignored** so plaintext can't leak.
5. The GitHub Actions workflow (`.github/workflows/deploy.yml`) decrypts `data.json.enc` → `dist/data.json` using the `DATA_PASSPHRASE` repo secret, then deploys to Pages.

The passphrase lives in **GitHub repo secrets** under `DATA_PASSPHRASE`. **Losing it means losing the data permanently** — there's no recovery. Keep a copy in your password manager.

To update content: redo steps 1–4. Re-running `encrypt-data` overwrites `data.json.enc`.

To verify locally: `npm run decrypt-data` reverses the operation (overwrites local `data.json`).

### Vite base path

Production builds use `base: '/farewell-team-wrapped/'` (matches the GH Pages subpath). Dev stays at `/`. See `vite.config.ts`. Asset URLs and the data.json fetch use `import.meta.env.BASE_URL` so they resolve correctly.

## Gotchas

### 1. localStorage scope
Editing on laptop ≠ editing on phone. They have separate localStorage. **Pick one device for admin work**, or export frequently as a manual backup.

### 2. Photo size
Each photo is base64-embedded into `data.json`. `compressImage()` shrinks to 900px max @ 0.85 JPEG quality (single photos) or 700px (mosaic photos). A colleague with 9 mosaic photos + 3 single photos can easily push their slice past 5MB. Watch the size; if data.json gets unwieldy, drop `maxDim` in `src/utils/index.ts` or be more selective with photos.

### 3. iTunes preview URLs are fixed
The 30s clip Apple returns always starts at the same point in the song (usually the chorus). `songStart` only skips forward inside that 30s window — it can't reach into other parts of the original track.

### 4. Songs need internet at view time
Song URLs reference Apple's CDN, not embedded audio. Colleagues must be online when they view their wrapped. Acceptable tradeoff (each song = ~150 chars vs. ~500KB embedded).

### 5. Password security caveat
Passwords are SHA-256 hashed before storage, but this is static HTML — a determined techie could view source, see the hashes, and brute-force or just bypass the check entirely. **Goal is casual privacy, not real security.** Don't put anything in a deck that would be a problem if leaked.

### 6. Transient admin state in the data
Admin-only fields leak into `slide` objects: `showSongPicker`, `songSearchQuery`, `songSearchResults`, `songSearching`. These get persisted to localStorage. `cleanColleagueForExport()` in `src/utils/index.ts` strips them before export. **If you add new transient fields, add them to `TRANSIENT_FIELDS` there** or exports will bloat with stale state. (After the React refactor most of these moved to component-local `useState`, but a few still live on the slide for compatibility — verify before shipping new ones.)

### 7. Encrypt + decrypt iterations must match
`-iter 600000` is hardcoded in both npm scripts (`encrypt-data`, `decrypt-data`) and the workflow's openssl command. If you change one, change all three or decryption silently fails on deploy.

### 8. Don't commit data.json (plaintext)
It's in `.gitignore`. If you ever stage it manually, the deploy workflow doesn't care, but the repo browser exposes everything. Stick to `data.json.enc`.

### 9. Vite base path mismatches
If you ever rename the GH Pages repo or switch to a custom domain, update `base` in `vite.config.ts`. Asset URLs will 404 silently otherwise.

### 10. StrictMode double-render
React 19 + StrictMode in dev runs effects twice on mount. The audio engine's URL-match guard makes it idempotent; if you write a new effect that mutates module-level state, make sure double-firing is OK.

## Common tasks

| Task | Where to look |
|---|---|
| Add a new slide type | `src/types/index.ts` (add to union) → `SLIDE_TYPES` in `constants.ts` → `makeDefaultSlide()` in `utils/index.ts` → new view component in `slides/` → `SlideRenderer.tsx` → fields case in `SlideFieldsEditor.tsx` |
| Add a new admin field | `SlideFieldsEditor.tsx` — find the slide's case, add a `<Field />` |
| Tweak slide timing | `DEFAULT_SLIDE_DURATION` in `src/utils/constants.ts` (per-slide `songDuration` overrides) |
| Tweak crossfade | `FADE_MS` in `src/utils/constants.ts` |
| Change slide gradient | `bg-*` CSS classes near top of `src/styles/global.css` |
| Modify export | `handleExport()` in `src/components/admin/Admin.tsx` |
| Touch the password flow | `src/components/landing/PasswordModal.tsx` + `sha256()` in `src/utils/index.ts` |
| Change deploy / data flow | `.github/workflows/deploy.yml` + `useDataJsonLoader.ts` |

## Local dev

```sh
npm run dev          # localhost:5173
npm run build        # production bundle into dist/
npm run preview      # serve dist/ locally
npm run typecheck    # tsc -b --noEmit
```

## Don't break

- The password gate (no plaintext passwords ever — only SHA-256 hashes)
- The encrypted-blob deploy invariant (`data.json` gitignored, only `data.json.enc` committed)
- Auto-save on every edit (don't introduce a manual "save" requirement)
- The single global CSS file — visual consistency depends on it. Don't sprinkle styles into components.
- The discriminated union for slides — type narrowing depends on `slide.type` being the discriminator
