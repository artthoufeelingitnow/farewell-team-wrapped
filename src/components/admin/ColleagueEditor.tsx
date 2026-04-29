import { useState } from 'react';
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
  };

  const handleDelete = () => {
    if (confirm(`Delete ${colleague.name || 'this colleague'}?`)) {
      deleteColleague(colleague.id);
    }
  };

  return (
    <>
      <div className="col-fields">
        <div>
          <label className="field-label">Name</label>
          <input
            type="text"
            className="field-input"
            value={colleague.name}
            placeholder="e.g. LS, Marcus, Sarah"
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

      <div className="slides-section">
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
