import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { showToast } from '../../store/toastStore';
import { galleryUrl, makeGalleryToken } from '../../utils/links';
import { findSpiritAnimalSlide } from '../../utils/gallery';

interface Props {
  onClose: () => void;
}

/**
 * Settings for the polaroid wall: its heading, and the token that doubles as
 * its link and its encryption key.
 *
 * Who's ON the wall isn't set here — that's a per-person toggle in each
 * colleague's editor, so the decision sits next to the cat you're deciding
 * about. This panel just shows the resulting roster so you can sanity-check it
 * before sending the link.
 */
export function GalleryEditor({ onClose }: Props) {
  const gallery = useAppStore((s) => s.data.gallery);
  const colleagues = useAppStore((s) => s.data.colleagues);
  const setGallery = useAppStore((s) => s.setGallery);

  const [title, setTitle] = useState(gallery?.title ?? '');
  const [note, setNote] = useState(gallery?.note ?? '');

  const token = gallery?.token ?? '';
  const featured = colleagues.filter((c) => c.inGallery);
  const missingCard = featured.filter((c) => !findSpiritAnimalSlide(c));

  const save = () => {
    setGallery({ title, note });
    showToast('Saved');
    onClose();
  };

  const generateToken = () => {
    if (
      token &&
      !confirm(
        'Generate a new link?\n\nThe current link stops working the moment you re-run `npm run encrypt-data` — anyone you already sent it to will need the new one.',
      )
    ) {
      return;
    }
    setGallery({ token: makeGalleryToken() });
    showToast(token ? 'New link generated — old one dies on next export' : 'Link generated');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(galleryUrl(token));
      showToast('Wall link copied');
    } catch {
      showToast('Could not copy — select it manually');
    }
  };

  return (
    <div className="pw-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pw-modal" style={{ maxWidth: '520px', textAlign: 'left' }}>
        <h3 style={{ textAlign: 'center' }}>The polaroid wall</h3>
        <p style={{ textAlign: 'center' }}>
          One link, shared with everyone. No password — the link is the key.
        </p>

        <label className="field-label">Heading</label>
        <input
          className="field-input"
          value={title}
          placeholder="the cat wall"
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: '12px' }}
        />

        <label className="field-label">Note under the heading (optional)</label>
        <textarea
          className="field-textarea"
          value={note}
          placeholder="tap a polaroid"
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="deck-link-row" style={{ marginTop: '16px' }}>
          <label className="field-label">Wall link</label>
          {token ? (
            <>
              <code className="deck-link">{galleryUrl(token)}</code>
              <div className="deck-link-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => void copyLink()}>
                  🔗 Copy link
                </button>
                <button className="btn btn-sm btn-ghost" onClick={generateToken}>
                  ♻ New link
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="field-hint">
                No link yet. Generating one also creates the key the wall is encrypted with.
              </p>
              <button className="btn btn-sm btn-primary" onClick={generateToken}>
                Generate wall link
              </button>
            </>
          )}
        </div>

        <div className="wall-roster">
          <label className="field-label">On the wall ({featured.length})</label>
          {featured.length === 0 ? (
            <p className="field-hint">
              Nobody yet. Open someone and switch on “Featured on the polaroid wall”.
            </p>
          ) : (
            <ul>
              {featured.map((c) => (
                <li key={c.id}>
                  <span>{c.name || '(unnamed)'}</span>
                  <span className="meta">
                    {c.galleryOnly ? 'wall only' : 'has a deck'}
                    {findSpiritAnimalSlide(c) ? '' : ' · ⚠️ no spirit-animal slide'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {missingCard.length > 0 && (
            <p className="field-hint field-hint-warn">
              {missingCard.length} featured {missingCard.length === 1 ? 'person has' : 'people have'}{' '}
              no spirit-animal slide, so {missingCard.length === 1 ? 'they' : 'they'} won't appear on
              the wall. Add one to their slides.
            </p>
          )}
        </div>

        <div className="pw-actions" style={{ marginTop: '18px' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
