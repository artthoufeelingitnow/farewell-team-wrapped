import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type {
  GalleryCardPayload,
  GalleryEntry,
  GalleryIndexPayload,
  MediaItem,
  SpiritAnimalSlide,
} from '../../types';
import { decryptJson, deriveGalleryDigest, WrongPasswordError, type EncryptedBlob } from '../../utils/crypto';
import { buildGalleryEntries, buildWallPeople, polaroidTilt } from '../../utils/gallery';
import { isValidGalleryToken } from '../../utils/links';
import { GalleryLightbox } from './GalleryLightbox';

/**
 * The polaroid wall — one link, shared with a group.
 *
 * Unlike a deck there's no password box: the token in `#/w/<token>` IS the key,
 * so arriving with a good link means the page just opens. That's a deliberate
 * softening of the project's usual posture, and it's why the token is 134 bits
 * of CSPRNG rather than anything human-typed — a guessable link would be the
 * whole security model failing at once.
 *
 * The wall loads in two stages. The index blob carries names and cover images
 * only; a person's full card is fetched and decrypted the moment their
 * polaroid is tapped, then cached for the session. Bundling every card into
 * the index instead made the first paint a 107 MB download.
 *
 * Two data paths:
 *   - a local admin draft exists: build the wall live from it, so you can see
 *     the wall while you're still filling it in, without exporting anything
 *   - otherwise: fetch + decrypt the published blob
 *
 * The discriminator is "does this browser hold a draft with anyone pinned to
 * the wall", NOT `isExportedFile`. Two reasons. Vite serves the committed
 * data/ tree off the project root in dev, so `isExportedFile` is true on the
 * admin machine too and would have disabled preview exactly where it's needed.
 * And a visitor's store never holds colleagues at all — decrypted decks aren't
 * persisted — so "has a draft" is only ever true on your own machine.
 *
 * Consequence worth knowing: on the machine where you author, the wall link
 * always shows your draft, never the published blob. To check what everyone
 * else actually sees, open the link in a private window.
 */

/** How many polaroids hang from one string, by available width. Chunking in JS
 *  rather than letting flex wrap is what makes the sagging string possible —
 *  a row has to know its own membership to draw a curve behind it. */
function perRowFor(width: number): number {
  if (width < 460) return 2;
  if (width < 680) return 3;
  if (width < 940) return 4;
  return 5;
}

/** How far the middle of a string dips below its ends, in px. */
const SAG_PX = 22;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; payload: GalleryIndexPayload }
  | { kind: 'error' };

/** What the lightbox is showing: a card we have, or one still in flight. */
type OpenCard =
  | { index: number; state: 'loading' }
  | { index: number; state: 'ready'; slide: SpiritAnimalSlide }
  | { index: number; state: 'error' };

interface Props {
  token: string;
}

export function GalleryWall({ token }: Props) {
  const colleagues = useAppStore((s) => s.data.colleagues);
  const localGallery = useAppStore((s) => s.data.gallery);
  const isHydrated = useAppStore((s) => s.isHydrated);

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [open, setOpen] = useState<OpenCard | null>(null);
  /** Cards already decrypted this session — tapping the same polaroid twice
   *  shouldn't re-download a 25 MB GIF. */
  const cardCache = useRef(new Map<number, SpiritAnimalSlide>());

  // Draft path — read the wall straight out of the admin draft. Deliberately
  // ignores the token: locally there's nothing to decrypt, and demanding the
  // real token would make previewing a chore while you're still building.
  const draftPayload = useMemo<GalleryIndexPayload | null>(() => {
    const entries = buildGalleryEntries(colleagues);
    if (entries.length === 0) return null;
    return { title: localGallery?.title, note: localGallery?.note, entries };
  }, [colleagues, localGallery]);

  /** Draft cards are already in memory — no fetch, no decrypt. */
  const draftCards = useMemo<SpiritAnimalSlide[] | null>(
    () => (draftPayload ? buildWallPeople(colleagues).map((p) => p.slide) : null),
    [draftPayload, colleagues],
  );

  useEffect(() => {
    // Wait for the IndexedDB read before deciding there's no draft, or the
    // published blob gets fetched on the admin's own machine for a moment.
    if (!isHydrated) return;
    if (draftPayload) {
      setState({ kind: 'ready', payload: draftPayload });
      return;
    }
    if (!isValidGalleryToken(token)) {
      setState({ kind: 'error' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const digest = await deriveGalleryDigest(token);
        const res = await fetch(
          `${import.meta.env.BASE_URL}data/gallery/${digest}/index.json.enc`,
          { cache: 'no-store' },
        );
        // A missing blob is a 404 in production but a 200 of index.html under
        // Vite's dev SPA fallback, so the JSON parse below is the real guard.
        if (!res.ok) {
          // Old link, rotated token, or nothing published yet. Logged for your
          // debugging; the visitor just sees "this link isn't working".
          console.warn(`Wall fetch failed: HTTP ${res.status}`);
          if (!cancelled) setState({ kind: 'error' });
          return;
        }
        const blob = (await res.json()) as EncryptedBlob;
        const payload = await decryptJson<GalleryIndexPayload>(blob, token);
        if (!cancelled) setState({ kind: 'ready', payload });
      } catch (err) {
        // A WrongPasswordError here means the filename hashed fine but the key
        // didn't open it — i.e. a truncated or edited token.
        if (!(err instanceof WrongPasswordError)) console.error(err);
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, draftPayload, isHydrated]);

  /** Tap → show the card. Draft and cached cards open instantly; anything else
   *  opens the lightbox in a loading state and fills in when the blob lands, so
   *  a slow 25 MB card still gives immediate feedback that the tap registered. */
  async function openCard(index: number) {
    if (draftCards) {
      const slide = draftCards[index];
      if (slide) setOpen({ index, state: 'ready', slide });
      return;
    }
    const cached = cardCache.current.get(index);
    if (cached) {
      setOpen({ index, state: 'ready', slide: cached });
      return;
    }
    setOpen({ index, state: 'loading' });
    try {
      const digest = await deriveGalleryDigest(token);
      const res = await fetch(
        `${import.meta.env.BASE_URL}data/gallery/${digest}/${index}.json.enc`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = (await res.json()) as EncryptedBlob;
      const card = await decryptJson<GalleryCardPayload>(blob, token);
      cardCache.current.set(index, card.slide);
      // Ignore a card that lands after the user already closed or moved on.
      setOpen((cur) => (cur?.index === index ? { index, state: 'ready', slide: card.slide } : cur));
    } catch (err) {
      console.warn('Card fetch failed:', err);
      setOpen((cur) => (cur?.index === index ? { index, state: 'error' } : cur));
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="wall wall-centered">
        <div className="wall-developing">
          <div className="wall-developing-frame" />
          <p>developing…</p>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="wall wall-centered">
        <div className="wall-message">
          <h3>This link isn't working</h3>
          <p>Check you copied the whole thing — they're long on purpose.</p>
        </div>
      </div>
    );
  }

  const { payload } = state;
  const entries = payload.entries ?? [];

  return (
    <div className="wall">
      <WallHeader title={payload.title} note={payload.note} />

      {entries.length === 0 ? (
        <div className="wall-message">
          <h3>Nothing on the wall yet</h3>
          <p>Pin someone up in admin and they'll show here.</p>
        </div>
      ) : (
        <WallRows entries={entries} onOpen={openCard} />
      )}

      <div className="wall-footer">every one of you, as a cat</div>

      {open && entries[open.index] && (
        <GalleryLightbox
          name={entries[open.index].name}
          slide={open.state === 'ready' ? open.slide : null}
          failed={open.state === 'error'}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** The branch across the top, with the title hanging off it. */
function WallHeader({ title, note }: { title?: string; note?: string }) {
  return (
    <div className="wall-header">
      <div className="wall-branch" aria-hidden="true">
        <svg viewBox="0 0 600 24" preserveAspectRatio="none">
          <path
            d="M4,14 C90,7 130,17 210,11 C300,5 350,16 430,10 C500,5 550,13 596,9"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="wall-hang" aria-hidden="true">
        <span />
        <span />
      </div>
      <h1 className="wall-title">{title?.trim() || 'the cat wall'}</h1>
      {note?.trim() && <p className="wall-note">{note}</p>}
    </div>
  );
}

function WallRows({
  entries,
  onOpen,
}: {
  entries: GalleryEntry[];
  onOpen: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(() =>
    perRowFor(typeof window === 'undefined' ? 900 : window.innerWidth),
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setPerRow(perRowFor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Chunk into rows, keeping each entry's original index so the lightbox can
  // find it again.
  const rows: { entry: GalleryEntry; index: number }[][] = [];
  for (let i = 0; i < entries.length; i += perRow) {
    rows.push(entries.slice(i, i + perRow).map((entry, j) => ({ entry, index: i + j })));
  }

  return (
    <div className="wall-rows" ref={containerRef}>
      {rows.map((row, r) => (
        <WallRow key={r} items={row} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** One string of photos.
 *
 *  Each photo hangs at the height the string actually sags to at its own
 *  position. That offset is *measured* rather than computed from the item's
 *  index: flexbox centres a short row and sizes the gaps from `clamp()`, so an
 *  index fraction is only right when a row happens to be full and full-width.
 *  Everywhere else it left the clothespins floating off the twine, which is
 *  precisely the detail that stops the whole thing reading as a real object.
 *
 *  Written straight to the DOM rather than through state — this runs on every
 *  resize, and a re-render per frame to move a photo a few pixels isn't worth
 *  it. */
function WallRow({
  items,
  onOpen,
}: {
  items: { entry: GalleryEntry; index: number }[];
  onOpen: (index: number) => void;
}) {
  const itemsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = itemsRef.current;
    if (!el) return;
    const apply = () => {
      const width = el.clientWidth;
      if (!width) return;
      for (const child of Array.from(el.children) as HTMLElement[]) {
        // offsetLeft/offsetWidth are pre-transform layout values, which is
        // what we want — the drop is the transform we're about to set.
        const t = (child.offsetLeft + child.offsetWidth / 2) / width;
        child.style.setProperty('--drop', `${(SAG_PX * 4 * t * (1 - t)).toFixed(2)}px`);
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  return (
    <div className="wall-row">
      <Twine />
      <div className="wall-row-items" ref={itemsRef}>
        {items.map(({ entry, index }) => (
          <Polaroid key={index} entry={entry} index={index} onOpen={() => onOpen(index)} />
        ))}
      </div>
    </div>
  );
}

/** The string itself. `preserveAspectRatio="none"` lets one curve stretch to
 *  any row width; `non-scaling-stroke` keeps the twine from stretching with
 *  it and going thin. */
function Twine() {
  return (
    <svg className="wall-twine" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={`M0,5 Q500,${5 + SAG_PX * 2} 1000,5`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Polaroid({
  entry,
  index,
  onOpen,
}: {
  entry: GalleryEntry;
  index: number;
  onOpen: () => void;
}) {
  const media = entry.cover;
  const pos = entry.coverPosition ?? { x: 50, y: 50 };
  const tilt = polaroidTilt(entry.name, index);

  return (
    <button
      type="button"
      className="polaroid"
      // --drop is set by WallRow once it can measure where this photo landed.
      style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
      onClick={onOpen}
      aria-label={`Open ${entry.name}'s card`}
    >
      <span className="polaroid-pin" aria-hidden="true" />
      <span className="polaroid-photo">
        {media ? (
          <CoverMedia media={media} objectPosition={`${pos.x}% ${pos.y}%`} />
        ) : (
          <span className="polaroid-empty" aria-hidden="true">
            ★
          </span>
        )}
      </span>
      <span className="polaroid-label">{entry.name}</span>
    </button>
  );
}

function CoverMedia({ media, objectPosition }: { media: MediaItem; objectPosition: string }) {
  if (media.kind === 'video') {
    return (
      <video
        className="polaroid-img"
        src={media.src}
        autoPlay
        muted
        loop
        playsInline
        style={{ objectPosition }}
      />
    );
  }
  return <img className="polaroid-img" src={media.src} alt="" style={{ objectPosition }} />;
}
