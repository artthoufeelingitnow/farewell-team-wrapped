import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import type { Colleague, Slide, SlideType } from '../../types';
import { sha256, makeDefaultSlide } from '../../utils';
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

  const handleDelete = () => {
    if (confirm(`Delete ${colleague.name || 'this colleague'}?`)) {
      deleteColleague(colleague.id);
    }
  };

  return (
    <>
      <div className="editor-sticky-header">
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

        <div className="slides-section-header">
          <h3>Slides ({slides.length})</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-sm btn-ghost"
              disabled={slides.length === 0}
              onClick={() => openPlayer(colleague.id, { preview: true })}
            >
              Preview
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setShowAddSlide((s) => !s)}
            >
              + Add slide
            </button>
          </div>
        </div>
      </div>

      <div className="slides-section">
        {slides.map((s, i) => (
          <SlideEditor
            key={i}
            slide={s}
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
