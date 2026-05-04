import { create } from 'zustand';
import type { AppData, Colleague, Slide } from '../types';
import { STORAGE_KEY } from '../utils/constants';
import { migrateAppData } from '../utils';
import { showToast } from './toastStore';

const EMPTY_DATA: AppData = {
  meta: { title: 'For You', subtitle: '', farewellNote: '' },
  colleagues: [],
};

function loadFromStorage(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return migrateAppData(parsed);
    }
  } catch {
    // fall through
  }
  return EMPTY_DATA;
}

function persist(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    showToast('Could not save (storage full?)');
  }
}

interface AppState {
  data: AppData;
  isExportedFile: boolean;

  // mutations — each persists automatically
  setMeta: (meta: Partial<AppData['meta']>) => void;
  addColleague: (colleague: Colleague) => void;
  deleteColleague: (id: string) => void;
  updateColleague: (id: string, patch: Partial<Colleague>) => void;
  addSlide: (colleagueId: string, slide: Slide) => void;
  updateSlide: (colleagueId: string, index: number, patch: Partial<Slide>) => void;
  deleteSlide: (colleagueId: string, index: number) => void;
  moveSlide: (colleagueId: string, index: number, dir: 'up' | 'down') => void;
  resetAll: () => void;

  /** Replace the entire dataset (used when /data.json is fetched on a deployed site). */
  loadFromExport: (data: AppData) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  data: loadFromStorage(),
  isExportedFile: false,

  setMeta: (meta) => {
    const next = { ...get().data, meta: { ...get().data.meta, ...meta } };
    set({ data: next });
    persist(next);
  },

  addColleague: (colleague) => {
    const next = { ...get().data, colleagues: [...get().data.colleagues, colleague] };
    set({ data: next });
    persist(next);
  },

  deleteColleague: (id) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.filter((c) => c.id !== id),
    };
    set({ data: next });
    persist(next);
  },

  updateColleague: (id, patch) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    };
    set({ data: next });
    persist(next);
  },

  addSlide: (colleagueId, slide) => {
    const next = {
      ...get().data,
      colleagues: get().data.colleagues.map((c) =>
        c.id === colleagueId ? { ...c, slides: [...(c.slides || []), slide] } : c,
      ),
    };
    set({ data: next });
    persist(next);
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
    persist(next);
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
    persist(next);
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
    persist(next);
  },

  resetAll: () => {
    set({ data: EMPTY_DATA });
    persist(EMPTY_DATA);
  },

  loadFromExport: (data) => {
    set({ data: migrateAppData(data), isExportedFile: true });
    // Don't persist exported data to localStorage — viewers shouldn't accumulate state.
  },
}));
