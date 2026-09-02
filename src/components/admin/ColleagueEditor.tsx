import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import type { Colleague, ColleagueCategory, GallerySide, Slide, SlideType } from '../../types';
import { makeDefaultSlide } from '../../utils';
import { findSpiritAnimalSlide } from '../../utils/gallery';
import { deckUrl } from '../../utils/links';
import { showToast } from '../../store/toastStore';
import { SlideEditor } from './SlideEditor';
import { AddSlideMenu } from './AddSlideMenu';

interface Props {
  colleague: Colleague;
}

/** Clipboard write with a toast either way. `navigator.clipboard` needs a
 *  secure context — fine on localhost and https, so admin always has it. */
async function copy(text: string, okMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMessage);
  } catch {
    showToast('Could not copy — select it manually');
  }
}

export function ColleagueEditor({ colleague }: Props) {
  const updateColleague = useAppStore((s) => s.updateColleague);
  const deleteColleague = useAppStore((s) => s.deleteColleague);
  const updateSlide = useAppStore((s) => s.updateSlide);
  const addSlide = useAppStore((s) => s.addSlide);
  const deleteSlide = useAppStore((s) => s.deleteSlide);
  const moveSlide = useAppStore((s) => s.moveSlide);

  const openPlayer = usePlayerStore((s) => s.openPlayer);

  const [showAddSlide, setShowAddSlide] = useState(false);

  const slides = colleague.slides ?? [];
  const isWallOnly = !!colleague.galleryOnly;
  // The wall reads this slide and nothing else, so flag its absence right where
  // the wall toggle lives rather than letting it fail silently at export.
  const hasSpiritSlide = !!findSpiritAnimalSlide(colleague);

  // Scroll the AddSlideMenu into view as soon as it opens (clicking + Add slide).
  useEffect(() => {
    if (!showAddSlide) return;
    const t = setTimeout(() => {
      document
        .querySelector('.add-slide-menu')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
    return () => clearTimeout(t);
  }, [showAddSlide]);

  // When a slide is added (length grows for the same colleague), scroll the new
  // last .slide-item into view. Skips on colleague switch (length change is unrelated).
  const prevSlideCountRef = useRef(slides.length);
  const prevColleagueIdRef = useRef(colleague.id);
  useEffect(() => {
    const isSameColleague = colleague.id === prevColleagueIdRef.current;
    if (isSameColleague && slides.length > prevSlideCountRef.current) {
      const t = setTimeout(() => {
        const items = document.querySelectorAll('.slide-item');
        const last = items[items.length - 1] as HTMLElement | undefined;
        last?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 30);
      prevSlideCountRef.current = slides.length;
      prevColleagueIdRef.current = colleague.id;
      return () => clearTimeout(t);
    }
    prevSlideCountRef.current = slides.length;
    prevColleagueIdRef.current = colleague.id;
  }, [slides.length, colleague.id]);

  const handleAddSlide = (type: SlideType) => {
    addSlide(colleague.id, makeDefaultSlide(type, colleague.name));
    setShowAddSlide(false);
    // The useEffect above handles scrolling once React has rendered the new slide.
  };

  const handleDelete = () => {
    if (confirm(`Delete ${colleague.name || 'this colleague'}?`)) {
      deleteColleague(colleague.id);
    }
  };

  return (
    <>
      <div className="editor-header">
        <div className="col-fields">
          <div>
            <label className="field-label">Name</label>
            <input
              type="text"
              className="field-input"
              value={colleague.name}
              placeholder="e.g. BB, Bob, Bobby"
              onChange={(e) => updateColleague(colleague.id, { name: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select
              className="field-select"
              value={isWallOnly ? 'wall' : 'deck'}
              onChange={(e) =>
                updateColleague(colleague.id, { galleryOnly: e.target.value === 'wall' })
              }
            >
              <option value="deck">Full wrapped deck</option>
              <option value="wall">Wall only — no deck</option>
            </select>
          </div>
          {!isWallOnly && (
            <>
              <div>
                <label className="field-label">
                  Password {colleague.password ? '(set ✓)' : '(needed for encryption)'}
                </label>
                <input
                  type="text"
                  className="field-input"
                  value={colleague.password ?? ''}
                  placeholder="Plaintext — used as the AES-GCM key"
                  onChange={(e) => updateColleague(colleague.id, { password: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Category</label>
                <select
                  className="field-select"
                  value={colleague.category ?? 'trainer'}
                  onChange={(e) =>
                    updateColleague(colleague.id, {
                      category: e.target.value as ColleagueCategory,
                    })
                  }
                >
                  <option value="trainer">Trainer</option>
                  <option value="yfa">YFA</option>
                </select>
              </div>
              <div>
                <label className="field-label">Link status</label>
                <select
                  className="field-select"
                  value={colleague.hidden ? 'hidden' : 'visible'}
                  onChange={(e) =>
                    updateColleague(colleague.id, {
                      hidden: e.target.value === 'hidden',
                    })
                  }
                >
                  <option value="visible">Live — deck gets published</option>
                  <option value="hidden">Paused — no blob, link 404s</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="field-label">Polaroid wall</label>
            <select
              className="field-select"
              value={colleague.inGallery ? 'on' : 'off'}
              onChange={(e) => updateColleague(colleague.id, { inGallery: e.target.value === 'on' })}
            >
              <option value="off">Not on the wall</option>
              <option value="on">Featured on the wall</option>
            </select>
          </div>
          {colleague.inGallery && (
            <div>
              <label className="field-label">Polaroid shows</label>
              <select
                className="field-select"
                value={colleague.galleryCover ?? 'left'}
                onChange={(e) =>
                  updateColleague(colleague.id, { galleryCover: e.target.value as GallerySide })
                }
              >
                <option value="left">Left image</option>
                <option value="right">Right image</option>
              </select>
            </div>
          )}
        </div>

        {colleague.inGallery && !hasSpiritSlide && (
          <p className="field-hint field-hint-warn">
            ⚠️ Featured on the wall, but there's no spirit-animal slide to show — add one below or
            they'll be skipped at export.
          </p>
        )}

        {/* The only way into this deck. There's no public roster, so this link
            plus the password above is what you send — nothing else works.
            Wall-only people have no deck, so no link either — theirs is the
            one shared wall link under "Polaroid wall". */}
        <div className="deck-link-row" hidden={isWallOnly}>
          <label className="field-label">Private link</label>
          <code className="deck-link">{deckUrl(colleague.id)}</code>
          <div className="deck-link-actions">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => void copy(deckUrl(colleague.id), 'Link copied')}
            >
              🔗 Copy link
            </button>
            <button
              className="btn btn-sm btn-ghost"
              disabled={!colleague.password}
              title={
                colleague.password
                  ? 'Copy a ready-to-send message with the link and password'
                  : 'Set a password first'
              }
              onClick={() =>
                void copy(
                  `Hey ${colleague.name || 'you'} — made you something 💌\n${deckUrl(colleague.id)}\nPassword: ${colleague.password}`,
                  'Message copied',
                )
              }
            >
              💬 Copy message
            </button>
          </div>
        </div>
      </div>

      <div className="slides-section">
        <div className="slides-section-header">
          <h3>Slides ({slides.length})</h3>
        </div>
        {slides.map((s, i) => (
          <SlideEditor
            key={i}
            slide={s}
            colleague={colleague}
            index={i}
            isFirst={i === 0}
            isLast={i === slides.length - 1}
            onPatch={(patch: Partial<Slide>) => updateSlide(colleague.id, i, patch)}
            onMove={(dir) => moveSlide(colleague.id, i, dir)}
            onDelete={() => deleteSlide(colleague.id, i)}
          />
        ))}

        {showAddSlide && <AddSlideMenu onPick={handleAddSlide} />}
      </div>

      {/* Sticky-at-bottom action bar — Preview + Add slide stay reachable
          while editing the latest slide; settles at its natural position once
          the user scrolls all the way down to the editor-actions row. */}
      <div className="slide-actions-bar">
        <button
          className="btn btn-sm btn-ghost"
          disabled={slides.length === 0}
          onClick={() => openPlayer(colleague.id, { preview: true })}
        >
          Preview
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => setShowAddSlide((s) => !s)}
        >
          + Add slide
        </button>
      </div>

      <div className="editor-actions">
        <div className="left">
          <button className="btn btn-sm btn-danger" onClick={handleDelete}>
            Delete colleague
          </button>
        </div>
      </div>
    </>
  );
}
