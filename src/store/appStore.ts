import { create } from 'zustand';
import type { AppData, AppDataIndex, Colleague, Slide } from '../types';
import { migrateAppData } from '../utils';
import {
  clearAll,
  deleteColleagueRecord,
  loadAll,
  migrateFromLocalStorage,
  saveAll,
  saveColleague,
  saveMeta,
} from '../utils/storage';
import { showToast } from './toastStore';

const EMPTY_DATA: AppData = {
  meta: { title: 'For You', subtitle: '', farewellNote: '' },
  colleagues: [],
};

/** Background-fired writes share this handler so a quota / IDB error always
 *  surfaces the same toast. We don't await mutations from React handlers —
 *  the in-memory store is the source-of-truth during the session. */
function reportPersistError(err: unknown): void {
  console.error('IndexedDB persist failed', err);
  showToast('Could not save (storage error)');
}

const persistColleague = (c: Colleague) => saveColleague(c).catch(reportPersistError);
const persistMeta = (data: AppData) =>
  saveMeta(
    data.meta,
    data.colleagues.map((c) => c.id),
  ).catch(reportPersistError);

interface AppState {
  data: AppData;
  isExportedFile: boolean;
  /** True once the initial IndexedDB read (or its failure) has resolved.
   *  Useful for an admin-route gate that wants to avoid showing an empty
   *  flash before hydration. */
  isHydrated: boolean;

  // mutations — each persists automatically (fire-and-forget)
  setMeta: (meta: Partial<AppData['meta']>) => void;
  addColleague: (colleague: Colleague) => void;
  deleteColleague: (id: string) => void;
  updateColleague: (id: string, patch: Partial<Colleague>) => void;
  addSlide: (colleagueId: string, slide: Slide) => void;
  updateSlide: (colleagueId: string, index: number, patch: Partial<Slide>) => void;
  deleteSlide: (colleagueId: string, index: number) => void;
  moveSlide: (colleagueId: string, index: number, dir: 'up' | 'down') => void;
  resetAll: () => void;

  /** Replace the dataset's meta + colleague-shells from `data/index.json`.
   *  Slides start empty for each colleague; they get filled in on demand by
   *  `setColleagueSlides` after the password decrypts the per-colleague file. */
  loadIndex: (index: AppDataIndex) => void;
  /** Populate one colleague's slides post-decrypt. Does NOT persist —
   *  decrypted decks are kept in memory only, so a refresh re-prompts. */
  setColleagueSlides: (colleagueId: string, slides: Slide[]) => void;
  /** Re-read the admin's source-of-truth from IndexedDB. Used when entering
   *  the admin route so a viewer-flow `loadIndex()` doesn't keep its grip on
   *  the store. Sets `isExportedFile: false` since we're back on draft data. */
  reloadFromStorage: () => Promise<void>;
  /** Replace the entire admin store with imported data and persist it. Used by
   *  the admin's "Import data.json" recovery button — restores the full draft
   *  (slides + plaintext passwords) into IndexedDB from a previously-exported
   *  source-of-truth file. */
  importAdminData: (data: AppData) => void;
}

/** Read IndexedDB → set state. Dedup'd so concurrent callers share one in-flight
 *  read. We migrate from the legacy localStorage key on first run if it's still
 *  around. */
let hydratePromise: Promise<void> | null = null;
async function runHydrate(setState: (patch: Partial<AppState>) => void): Promise<void> {
  try {
    let loaded = await loadAll();
    if (!loaded) loaded = await migrateFromLocalStorage();
    if (loaded) {
      const migrated = migrateAppData(loaded);
      setState({ data: migrated, isExportedFile: false, isHydrated: true });
    } else {
      setState({ data: EMPTY_DATA, isExportedFile: false, isHydrated: true });
    }
  } catch (err) {
    console.error('IndexedDB hydrate failed', err);
    showToast('Could not load saved data');
    setState({ isHydrated: true });
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  data: EMPTY_DATA,
  isExportedFile: false,
  isHydrated: false,

  setMeta: (meta) => {
    const next = { ...get().data, meta: { ...get().data.meta, ...meta } };
    set({ data: next });
    void persistMeta(next);
  },

  addColleague: (colleague) => {
    const next = { ...get().data, colleagues: [...get().data.colleagues, colleague] };
    set({ data: next });
    void persistColleague(colleague);
    void persistMeta(next);
  },

  deleteColleague: (id) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.filter((c) => c.id !== id),
    };
    set({ data: next });
    void deleteColleagueRecord(id).catch(reportPersistError);
    void persistMeta(next);
  },

  updateColleague: (id, patch) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    };
    set({ data: next });
    const updated = next.colleagues.find((c) => c.id === id);
    if (updated) void persistColleague(updated);
  },

  addSlide: (colleagueId, slide) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.map((c) =>
        c.id === colleagueId ? { ...c, slides: [...(c.slides || []), slide] } : c,
      ),
    };
    set({ data: next });
    const updated = next.colleagues.find((c) => c.id === colleagueId);
    if (updated) void persistColleague(updated);
  },

  updateSlide: (colleagueId, index, patch) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.map((c) => {
        if (c.id !== colleagueId) return c;
        const slides = c.slides.map((s, i) => (i === index ? ({ ...s, ...patch } as Slide) : s));
        return { ...c, slides };
      }),
    };
    set({ data: next });
    const updated = next.colleagues.find((c) => c.id === colleagueId);
    if (updated) void persistColleague(updated);
  },

  deleteSlide: (colleagueId, index) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.map((c) => {
        if (c.id !== colleagueId) return c;
        return { ...c, slides: c.slides.filter((_, i) => i !== index) };
      }),
    };
    set({ data: next });
    const updated = next.colleagues.find((c) => c.id === colleagueId);
    if (updated) void persistColleague(updated);
  },

  moveSlide: (colleagueId, index, dir) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.map((c) => {
        if (c.id !== colleagueId) return c;
        const slides = [...c.slides];
        const swap = dir === 'up' ? index - 1 : index + 1;
        if (swap < 0 || swap >= slides.length) return c;
        [slides[index], slides[swap]] = [slides[swap], slides[index]];
        return { ...c, slides };
      }),
    };
    set({ data: next });
    const updated = next.colleagues.find((c) => c.id === colleagueId);
    if (updated) void persistColleague(updated);
  },

  resetAll: () => {
    set({ data: EMPTY_DATA });
    void clearAll().catch(reportPersistError);
  },

  loadIndex: (index) => {
    // Build colleague shells (no slides yet — those arrive post-decrypt). Run
    // them through migrateAppData so category/hidden defaults stay consistent.
    const migrated = migrateAppData({
      meta: index.meta,
      colleagues: index.colleagues.map((c) => ({
        id: c.id,
        name: c.name,
        slides: [],
        category: c.category,
        hidden: c.hidden,
      })),
    });
    set({ data: migrated, isExportedFile: true });
    // Don't persist — viewers shouldn't accumulate state.
  },

  setColleagueSlides: (colleagueId, slides) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.map((c) =>
        c.id === colleagueId ? { ...c, slides } : c,
      ),
    };
    set({ data: next });
    // Intentionally not persisted — decrypted slides stay in memory only.
  },

  reloadFromStorage: () => {
    // Re-run hydrate so the admin sees the freshest IndexedDB state. Dedup the
    // in-flight read so a rapid route flip doesn't fire concurrent transactions.
    hydratePromise = runHydrate(set);
    return hydratePromise;
  },

  importAdminData: (incoming) => {
    const migrated = migrateAppData(incoming);
    set({ data: migrated, isExportedFile: false });
    void saveAll(migrated).catch(reportPersistError);
  },
}));

// Kick off the initial IndexedDB read at module load so the data lands as soon
// as possible — usually before the first React render finishes, and certainly
// before the user can interact. The viewer-route fetch in `useDataJsonLoader`
// can race ahead and overwrite via `loadIndex()`; that's intended (the index
// wins for viewers).
hydratePromise = runHydrate(useAppStore.setState);
