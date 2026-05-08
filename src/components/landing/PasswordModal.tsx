import { useEffect, useRef, useState } from 'react';
import type { Colleague, Slide } from '../../types';
import { useAppStore } from '../../store/appStore';
import { decryptJson, WrongPasswordError, type EncryptedBlob } from '../../utils/crypto';
import { migrateAppData } from '../../utils';

interface Props {
  colleague: Colleague;
  onUnlock: () => void;
  onCancel: () => void;
}

/** Run a fetched colleague payload through the slide-field migration. We
 *  reuse `migrateAppData` (which expects a full AppData) by wrapping the
 *  slides on a synthetic colleague — only that colleague's `slides` come
 *  back migrated, which is what we need. */
function migrateSlides(slides: unknown): Slide[] {
  const wrapped = migrateAppData({
    meta: { title: '', subtitle: '', farewellNote: '' },
    colleagues: [
      {
        id: '_',
        name: '',
        slides: Array.isArray(slides) ? (slides as Slide[]) : [],
      },
    ],
  });
  return wrapped.colleagues[0]?.slides ?? [];
}

export function PasswordModal({ colleague, onUnlock, onCancel }: Props) {
  const setColleagueSlides = useAppStore((s) => s.setColleagueSlides);
  const isExportedFile = useAppStore((s) => s.isExportedFile);

  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const fail = (msg: string) => {
    setError(msg);
    setValue('');
    setShake(true);
    setTimeout(() => setShake(false), 400);
    inputRef.current?.focus();
  };

  const submit = async () => {
    if (!value || busy) return;
    setError('');
    setBusy(true);
    try {
      // Admin-side preview path: the deck is already in memory, no fetch
      // needed. Compare entered password against the stored plaintext.
      if (!isExportedFile) {
        if (value === colleague.password && colleague.slides.length > 0) {
          onUnlock();
          return;
        }
        fail("That password isn't right. Try again?");
        return;
      }

      // Viewer path: fetch the encrypted deck and try to decrypt with the
      // entered password. AES-GCM throws on auth-tag mismatch, which we
      // surface as the wrong-password case.
      const url = `${import.meta.env.BASE_URL}data/colleagues/${colleague.id}.json.enc`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        fail(`Could not load your deck (HTTP ${res.status}).`);
        return;
      }
      const blob = (await res.json()) as EncryptedBlob;
      const slides = await decryptJson<Slide[]>(blob, value);
      setColleagueSlides(colleague.id, migrateSlides(slides));
      onUnlock();
    } catch (e) {
      if (e instanceof WrongPasswordError) {
        fail("That password isn't right. Try again?");
      } else {
        console.error(e);
        fail('Something went wrong loading your deck.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pw-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div
        className="pw-modal"
        style={shake ? { animation: 'shake 0.3s ease' } : undefined}
      >
        <h3>Hi, {colleague.name} 👋</h3>
        <p>Enter the password I sent you.</p>
        <input
          ref={inputRef}
          type="password"
          className="pw-input"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="••••••"
          autoComplete="off"
        />
        <div className="pw-error">{error}</div>
        <div className="pw-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}
