import { create } from 'zustand';

interface PlayerState {
  currentColleagueId: string | null;
  slideIndex: number;
  isPreviewMode: boolean;
  audioEnabled: boolean;
  paused: boolean;
  unlockedColleagueIds: Set<string>;

  openPlayer: (colleagueId: string, opts?: { preview?: boolean }) => void;
  closePlayer: () => void;
  nextSlide: (totalSlides: number) => void;
  prevSlide: () => void;
  setSlideIndex: (i: number) => void;
  toggleAudio: () => void;
  setPaused: (p: boolean) => void;
  markUnlocked: (colleagueId: string) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentColleagueId: null,
  slideIndex: 0,
  isPreviewMode: false,
  audioEnabled: true,
  paused: false,
  unlockedColleagueIds: new Set(),

  openPlayer: (colleagueId, opts) =>
    set({
      currentColleagueId: colleagueId,
      slideIndex: 0,
      isPreviewMode: !!opts?.preview,
      paused: false,
    }),

  closePlayer: () =>
    set({ currentColleagueId: null, slideIndex: 0, isPreviewMode: false, paused: false }),

  nextSlide: (totalSlides) => {
    const { slideIndex } = get();
    if (slideIndex < totalSlides - 1) set({ slideIndex: slideIndex + 1 });
  },

  prevSlide: () => {
    const { slideIndex } = get();
    if (slideIndex > 0) set({ slideIndex: slideIndex - 1 });
  },

  setSlideIndex: (i) => set({ slideIndex: i }),

  toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),

  setPaused: (paused) => set({ paused }),

  markUnlocked: (colleagueId) =>
    set((s) => ({ unlockedColleagueIds: new Set([...s.unlockedColleagueIds, colleagueId]) })),
}));
