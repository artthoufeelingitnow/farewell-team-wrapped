import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { showToast } from '../../store/toastStore';

interface Props {
  onClose: () => void;
}

export function MetaEditor({ onClose }: Props) {
  const meta = useAppStore((s) => s.data.meta);
  const setMeta = useAppStore((s) => s.setMeta);

  const [title, setTitle] = useState(meta.title);
  const [subtitle, setSubtitle] = useState(meta.subtitle);

  const save = () => {
    setMeta({ title, subtitle });
    showToast('Saved');
    onClose();
  };

  return (
    <div className="pw-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pw-modal" style={{ maxWidth: '460px', textAlign: 'left' }}>
        <h3 style={{ textAlign: 'center' }}>Site details</h3>
        <p style={{ textAlign: 'center' }}>These show on the landing page.</p>
        <label className="field-label">Title</label>
        <input
          className="field-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: '12px' }}
        />
        <label className="field-label">Subtitle</label>
        <textarea
          className="field-textarea"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
        />
        <div className="pw-actions" style={{ marginTop: '18px' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
