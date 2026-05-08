import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { uid, cleanColleagueForExport } from '../../utils';
import { showToast } from '../../store/toastStore';
import { useHashRoute } from '../../hooks/useHashRoute';
import { ColleagueList } from './ColleagueList';
import { ColleagueEditor } from './ColleagueEditor';
import { MetaEditor } from './MetaEditor';

export function Admin() {
  const data = useAppStore((s) => s.data);
  const colleagues = data.colleagues;
  const addColleague = useAppStore((s) => s.addColleague);
  const resetAll = useAppStore((s) => s.resetAll);
  const [, navigate] = useHashRoute();

  const [selectedId, setSelectedId] = useState<string | null>(colleagues[0]?.id ?? null);
  const [metaOpen, setMetaOpen] = useState(false);

  const selected = colleagues.find((c) => c.id === selectedId) ?? null;

  const handleAddColleague = () => {
    const newCol = { id: uid(), name: '', slides: [] };
    addColleague(newCol);
    setSelectedId(newCol.id);
  };

  const handleReset = () => {
    if (confirm('Delete everything? This cannot be undone.')) {
      resetAll();
      setSelectedId(null);
    }
  };

  const handleExport = () => {
    const missingPw = colleagues.filter((c) => c.slides.length > 0 && !c.password);
    if (missingPw.length > 0) {
      const names = missingPw.map((c) => c.name || c.id).join(', ');
      if (!confirm(
        `${missingPw.length} colleague(s) have no password and won't be encrypted: ${names}.\n\nExport anyway?`,
      )) {
        return;
      }
    }
    const cleanData = {
      meta: data.meta,
      colleagues: colleagues.map(cleanColleagueForExport),
    };
    const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported data.json — run `npm run encrypt-data` next');
  };

  return (
    <>
      <div className="admin">
        <div className="admin-inner">
          <div className="admin-header">
            <h2>Goodbye Wrapped — admin</h2>
            <div className="tools">
              <button className="btn btn-sm btn-ghost" onClick={() => setMetaOpen(true)}>
                Site title & footer
              </button>
              <button className="btn btn-sm btn-ghost" onClick={handleExport}>
                Export final file
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => navigate('landing')}>
                View landing
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleReset}>
                Reset all
              </button>
            </div>
          </div>

          <div className="admin-grid">
            <ColleagueList
              colleagues={colleagues}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={handleAddColleague}
            />

            <div className="editor">
              {selected ? (
                <ColleagueEditor colleague={selected} />
              ) : (
                <div className="editor-empty">
                  <h3>No colleague selected</h3>
                  <p>Pick someone from the list, or add a new one.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {metaOpen && <MetaEditor onClose={() => setMetaOpen(false)} />}
    </>
  );
}
