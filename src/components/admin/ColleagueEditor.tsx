import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import type { Colleague, Slide, SlideType } from '../../types';
import { sha256, makeDefaultSlide, readFileAsDataURL, compressImage } from '../../utils';
import { showToast } from '../../store/toastStore';
import { SlideEditor } from './SlideEditor';
import { AddSlideMenu } from './AddSlideMenu';

interface Props {
  colleague: Colleague;
}

export function ColleagueEditor({ colleague }: Props) {
  const updateColleague = useAppStore((s) => s.updateColleague);
  const deleteColleague = useAppStore((s) => s.deleteColleague);
  const updateSlide = useAppStore((s) => s.updateSlide);
  const addSlide = useAppStore((s) => s.addSlide);
  const deleteSlide = useAppStore((s) => s.deleteSlide);
  const moveSlide = useAppStore((s) => s.moveSlide);

  const openPlayer = usePlayerStore((s) => s.openPlayer);

  const [pendingPassword, setPendingPassword] = useState('');
  const [showAddSlide, setShowAddSlide] = useState(false);

  const slides = colleague.slides ?? [];

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

  const save = async () => {
    const patch: Partial<Colleague> = {};
    if (pendingPassword) {
      patch.passwordHash = await sha256(pendingPassword);
      setPendingPassword('');
      showToast(`Password set for ${colleague.name || 'colleague'}`);
    }
    if (Object.keys(patch).length > 0) {
      updateColleague(colleague.id, patch);
    }
  };

  const handleAddSlide = (type: SlideType) => {
    addSlide(colleague.id, makeDefaultSlide(type, colleague.name));
    setShowAddSlide(false);
    // The useEffect above handles scrolling once React has rendered the new slide.
  };

  const handleAnimalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    // GIFs go through unchanged — running them through compressImage()'s
    // canvas → JPEG pipeline strips the animation. Other image types get
    // compressed to 700px JPEG to keep the export blob small.
    const src = file.type === 'image/gif' ? dataUrl : await compressImage(dataUrl, 700);
    // Reset crop position to center whenever media changes — old offsets
    // don't generalize to a new image's aspect.
    updateColleague(colleague.id, {
      spiritAnimalMedia: { kind: 'image', src },
      spiritAnimalPosition: undefined,
    });
    e.target.value = '';
  };

  const handleAnimalVideoUrl = () => {
    const url = prompt(
      'Paste video/GIF URL (e.g. https://artthoufeelingitnow.github.io/farewell-team-wrapped/videos/cat.mp4):',
    );
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    updateColleague(colleague.id, {
      spiritAnimalMedia: { kind: 'video', src: trimmed },
      spiritAnimalPosition: undefined,
    });
  };

  // ---- Drag-to-reposition state for the spirit-animal preview ----
  // The preview frame is 120 px square. We map 1 px of drag to ~1% of
  // object-position change — accurate for ~2:1 overflow images, fine-feeling
  // for closer-to-square ones, slightly slow for very wide ones. Clamped to
  // [0, 100] so the image edges can align with the frame edges but not pass them.
  const ANIMAL_FRAME_PX = 120;
  const animalPos = colleague.spiritAnimalPosition ?? { x: 50, y: 50 };
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 50, posY: 50 });

  const handleAnimalPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!colleague.spiritAnimalMedia) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: animalPos.x,
      posY: animalPos.y,
    };
    setDragging(true);
  };

  const handleAnimalPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.max(0, Math.min(100, dragStartRef.current.posX - (dx / ANIMAL_FRAME_PX) * 100));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.posY - (dy / ANIMAL_FRAME_PX) * 100));
    updateColleague(colleague.id, { spiritAnimalPosition: { x: newX, y: newY } });
  };

  const handleAnimalPointerUp = () => setDragging(false);

  const resetAnimalPosition = () =>
    updateColleague(colleague.id, { spiritAnimalPosition: undefined });

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
            <label className="field-label">
              Password {colleague.passwordHash ? '(set ✓)' : ''}
            </label>
            <input
              type="text"
              className="field-input"
              value={pendingPassword}
              placeholder={colleague.passwordHash ? 'Leave blank to keep' : 'Set a password'}
              onChange={(e) => setPendingPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="spirit-animal-panel">
          <div className="spirit-animal-header">
            <span>🎁 Spirit animal</span>
            <span className="spirit-animal-hint">Drives the wrapped finale slide.</span>
          </div>
          <div className="spirit-animal-grid">
            <div className="spirit-animal-image">
              {colleague.spiritAnimalMedia ? (
                colleague.spiritAnimalMedia.kind === 'video' ? (
                  <video
                    src={colleague.spiritAnimalMedia.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    draggable={false}
                    onPointerDown={handleAnimalPointerDown}
                    onPointerMove={handleAnimalPointerMove}
                    onPointerUp={handleAnimalPointerUp}
                    onPointerCancel={handleAnimalPointerUp}
                    style={{
                      objectPosition: `${animalPos.x}% ${animalPos.y}%`,
                      cursor: dragging ? 'grabbing' : 'grab',
                      touchAction: 'none',
                    }}
                  />
                ) : (
                  <img
                    src={colleague.spiritAnimalMedia.src}
                    alt=""
                    draggable={false}
                    onPointerDown={handleAnimalPointerDown}
                    onPointerMove={handleAnimalPointerMove}
                    onPointerUp={handleAnimalPointerUp}
                    onPointerCancel={handleAnimalPointerUp}
                    style={{
                      objectPosition: `${animalPos.x}% ${animalPos.y}%`,
                      cursor: dragging ? 'grabbing' : 'grab',
                      touchAction: 'none',
                    }}
                  />
                )
              ) : (
                <div className="spirit-animal-image-empty">No media</div>
              )}
              {colleague.spiritAnimalMedia && (
                <div
                  className="spirit-animal-drag-hint"
                  style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 6, textAlign: 'center' }}
                >
                  Drag to reposition
                  {colleague.spiritAnimalPosition && (
                    <button
                      type="button"
                      onClick={resetAnimalPosition}
                      style={{
                        marginLeft: 8,
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        fontSize: 10,
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      ↺ center
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, width: '100%' }}>
                <label className="photo-upload" style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAnimalUpload}
                    style={{ display: 'none' }}
                  />
                  📷 Image / GIF
                </label>
                <button
                  type="button"
                  className="photo-upload"
                  style={{ flex: 1, fontFamily: 'inherit', fontSize: 12, padding: '8px 10px' }}
                  onClick={handleAnimalVideoUrl}
                >
                  🎥 Video URL
                </button>
              </div>
              {colleague.spiritAnimalMedia && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={{ marginTop: 6, fontSize: 11 }}
                  onClick={() =>
                    updateColleague(colleague.id, {
                      spiritAnimalMedia: undefined,
                      spiritAnimalPosition: undefined,
                    })
                  }
                >
                  Remove
                </button>
              )}
            </div>
            <div className="spirit-animal-fields">
              <div>
                <label className="field-label">Animal name</label>
                <input
                  type="text"
                  className="field-input"
                  value={colleague.spiritAnimalName ?? ''}
                  placeholder="The Otter"
                  onChange={(e) => updateColleague(colleague.id, { spiritAnimalName: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Tagline</label>
                <input
                  type="text"
                  className="field-input"
                  value={colleague.spiritAnimalTagline ?? ''}
                  placeholder="playful, loyal, snack enthusiast"
                  onChange={(e) => updateColleague(colleague.id, { spiritAnimalTagline: e.target.value })}
                />
              </div>
            </div>
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
        <div className="right">
          <button className="btn btn-sm btn-primary" onClick={() => void save()}>
            Save changes
          </button>
        </div>
      </div>
    </>
  );
}
