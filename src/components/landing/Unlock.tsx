import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import type { DeckPayload, LavaBg, Slide } from '../../types';
import { decryptJson, WrongPasswordError, type EncryptedBlob } from '../../utils/crypto';
import { preloadColleagueAssets } from '../../utils/preload';
import { isValidDeckId } from '../../utils/links';
import { SlideBackground } from '../slides/SlideBackground';

const UNLOCK_LAVA_BG: LavaBg = {
  kind: 'lava',
  baseColor: '#000000',
  blobs: [
    { color: '#610020' },
    { color: '#00423E' },
    { color: '#4D3200' },
  ],
  speed: 'fast',
  blur: 85,
  textColor: 'light',
};

/** Sequence to type on the unlock screen to jump to admin. Buffer is per-
 *  keystroke; idle for >ADMIN_BUFFER_RESET_MS resets it. Visitors won't trip
 *  it incidentally — five specific keys in a row is a deliberate act. */
const ADMIN_SECRET = 'admin';
const ADMIN_BUFFER_RESET_MS = 1500;

/** One message for every "you can't get in" case — wrong password, unknown id,
 *  unpublished deck. Distinct errors would let someone probe the id space to
 *  learn how many decks exist and which ids are real. */
const GENERIC_FAILURE = "That password isn't right. Try again?";

/** Legacy blobs encrypted a bare `Slide[]`; current ones encrypt a DeckPayload
 *  so the name can travel inside the ciphertext instead of the public index. */
function readPayload(payload: DeckPayload | Slide[]): DeckPayload {
  return Array.isArray(payload) ? { name: '', slides: payload } : payload;
}

interface Props {
  /** Deck id from the private `#/d/<id>` link, or null on a bare URL. */
  deckId: string | null;
}

export function Unlock({ deckId }: Props) {
  const isExportedFile = useAppStore((s) => s.isExportedFile);
  const loadDeck = useAppStore((s) => s.loadDeck);
  const openPlayer = usePlayerStore((s) => s.openPlayer);
  const markUnlocked = usePlayerStore((s) => s.markUnlocked);
  const unlockedIds = usePlayerStore((s) => s.unlockedColleagueIds);

  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  /** Non-null once decrypted — drives the "Hi, <name>" beat before the deck. */
  const [greetName, setGreetName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-validate here rather than trusting the prop: this component is the only
  // thing that puts an id into a fetch URL, so the check belongs next to it.
  const safeId = deckId !== null && isValidDeckId(deckId) ? deckId : null;
  const validId = safeId !== null;
  // Already unlocked this session (they closed the player and came back)? The
  // deck is still in memory, so offer a replay instead of the password box.
  const unlockedColleague = useAppStore((s) =>
    safeId !== null && unlockedIds.has(safeId)
      ? s.data.colleagues.find((c) => c.id === safeId)
      : undefined,
  );
  const canReplay = !!unlockedColleague && unlockedColleague.slides.length > 0;

  useEffect(() => {
    if (!validId || canReplay) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [validId, canReplay]);

  // Hidden admin entry: type "admin". Buffer accumulates matching characters in
  // order; any mismatch resets it, and idle >1.5s resets it too. Skips when an
  // input is focused so it doesn't fire while someone types their password.
  const adminBufferRef = useRef('');
  const adminIdleTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const resetBuffer = () => {
      adminBufferRef.current = '';
      if (adminIdleTimerRef.current !== null) {
        window.clearTimeout(adminIdleTimerRef.current);
        adminIdleTimerRef.current = null;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key.length !== 1) return;
      const expectedChar = ADMIN_SECRET[adminBufferRef.current.length];
      if (e.key.toLowerCase() === expectedChar) {
        adminBufferRef.current += expectedChar;
        if (adminBufferRef.current === ADMIN_SECRET) {
          resetBuffer();
          window.location.hash = '#admin';
          return;
        }
        if (adminIdleTimerRef.current !== null) window.clearTimeout(adminIdleTimerRef.current);
        adminIdleTimerRef.current = window.setTimeout(resetBuffer, ADMIN_BUFFER_RESET_MS);
      } else {
        // Wrong char — but if it's the FIRST char of the secret, start fresh
        // from this keystroke (so "aadmin" still works after the false start).
        adminBufferRef.current = e.key.toLowerCase() === ADMIN_SECRET[0] ? ADMIN_SECRET[0] : '';
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      resetBuffer();
    };
  }, []);

  const fail = () => {
    setError(GENERIC_FAILURE);
    setValue('');
    setShake(true);
    setTimeout(() => setShake(false), 400);
    inputRef.current?.focus();
  };

  /** Shared tail for both unlock paths: mark, preload, greet. */
  const enter = (id: string, name: string) => {
    markUnlocked(id);
    const latest = useAppStore.getState().data.colleagues.find((c) => c.id === id);
    if (latest) preloadColleagueAssets(latest);
    setGreetName(name);
  };

  const submit = async () => {
    if (safeId === null || !value || busy) return;
    setError('');
    setBusy(true);
    try {
      // Admin / dev path: no published data tree to fetch from, so the deck is
      // already in memory from IndexedDB. Compare the stored plaintext.
      if (!isExportedFile) {
        const local = useAppStore.getState().data.colleagues.find((c) => c.id === safeId);
        if (local && value === local.password && local.slides.length > 0) {
          enter(local.id, local.name);
        } else {
          fail();
        }
        return;
      }

      // Viewer path: fetch this colleague's encrypted deck and try to decrypt
      // with the entered password. AES-GCM throws on auth-tag mismatch, which
      // IS the authentication check — there's no hash to compare against.
      const url = `${import.meta.env.BASE_URL}data/colleagues/${safeId}.json.enc`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        // Almost always a 404 from a mistyped/unpublished link. Reported as the
        // generic failure so ids stay unprobeable; logged for your debugging.
        console.warn(`Deck fetch failed: HTTP ${res.status}`);
        fail();
        return;
      }
      const blob = (await res.json()) as EncryptedBlob;
      const payload = readPayload(await decryptJson<DeckPayload | Slide[]>(blob, value));
      loadDeck({
        id: safeId,
        name: payload.name || 'you',
        category: payload.category,
        slides: payload.slides ?? [],
      });
      enter(safeId, payload.name || 'you');
    } catch (e) {
      if (e instanceof WrongPasswordError) {
        fail();
      } else {
        console.error(e);
        setError('Something went wrong loading your deck.');
      }
    } finally {
      setBusy(false);
    }
  };

  // The tap that dismisses the greeting doubles as the user gesture that
  // unblocks audio autoplay — that's why the player opens from here, not
  // straight after decrypt.
  const handleGreetDismiss = () => {
    if (safeId === null) return;
    openPlayer(safeId);
    setGreetName(null);
  };

  return (
    <>
      <div className="landing">
        <SlideBackground config={UNLOCK_LAVA_BG} />

        {/* Hidden while the greeting is up: decrypting flips this card to its
            "Welcome back" state, and a ghost of it showing through the overlay
            spoils the beat. The lava background carries the moment alone. */}
        <div className="unlock-card" hidden={greetName !== null}>
          {!validId ? (
            <>
              <h3>You'll need your own link 🔑</h3>
              <p>
                This page only opens with the personal link I sent you — check
                that message and tap the link in it.
              </p>
            </>
          ) : canReplay ? (
            <>
              <h3>Welcome back, {unlockedColleague?.name} 👋</h3>
              <p>Your wrapped is still here.</p>
              <div className="pw-actions">
                <button className="btn btn-primary" onClick={() => openPlayer(safeId)}>
                  Play again
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>This one's for you 💌</h3>
              <p>Enter the password I sent you.</p>
              <input
                ref={inputRef}
                type="password"
                className="pw-input"
                style={shake ? { animation: 'shake 0.3s ease' } : undefined}
                value={value}
                disabled={busy}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
                placeholder="••••••"
                autoComplete="off"
              />
              <div className="pw-error">{error}</div>
              <div className="pw-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => void submit()}
                  disabled={busy || !value}
                >
                  {busy ? 'Unlocking…' : 'Unlock'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="landing-footer">by yours truly, ME</div>
      </div>

      {greetName && (
        <div id="volume-hint-overlay" onClick={handleGreetDismiss}>
          <div className="volume-hint-inner">
            <div className="volume-hint-icon">🔊</div>
            <div className="volume-hint-text">Hi, {greetName} 👋</div>
            <div className="volume-hint-sub">
              Turn your volume up, then tap anywhere to start.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
