import { create } from 'zustand';

interface PlayerState {
  currentColleagueId: string | null;
  slideIndex: number;
  isPreviewMode: boolean;
  audioEnabled: boolean;
  /** True while the user is actively pausing the deck (hold-to-pause).
   *  Halts auto-advance AND pauses audio playback. */
  paused: boolean;
  /** True while a mosaic photo is expanded in the lightbox. Halts auto-advance
   *  but lets audio keep playing — the song is the emotional underscore for
   *  the memory the user is lingering on. Distinct from `paused` on purpose. */
  previewingMedia: boolean;
  /** True while the tab/app is in the background (`document.hidden`). Halts
   *  auto-advance AND pauses audio — same behavior as user-driven `paused`,
   *  but tracked separately so resuming on tab return doesn't override an
   *  in-flight hold-to-pause. */
  pausedByVisibility: boolean;
  /** Intrinsic length of the current meme slide's video, in ms. Set by
   *  `MemeSlideView` once `loadedmetadata` fires; reset to null on its unmount.
   *  Player's auto-advance uses this (when non-null) to match the slide
   *  duration to the meme's length, so the progress bar tracks the video. */
  memeVideoDurationMs: number | null;
  unlockedColleagueIds: Set<string>;

  openPlayer: (colleagueId: string, opts?: { preview?: boolean }) => void;
  closePlayer: () => void;
  nextSlide: (totalSlides: number) => void;
  prevSlide: () => void;
  setSlideIndex: (i: number) => void;
  toggleAudio: () => void;
  setPaused: (p: boolean) => void;
  setPreviewingMedia: (p: boolean) => void;
  setPausedByVisibility: (p: boolean) => void;
  setMemeVideoDurationMs: (ms: number | null) => void;
  markUnlocked: (colleagueId: string) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentColleagueId: null,
  slideIndex: 0,
  isPreviewMode: false,
  audioEnabled: true,
  paused: false,
  previewingMedia: false,
  pausedByVisibility: false,
  memeVideoDurationMs: null,
  unlockedColleagueIds: new Set(),

  openPlayer: (colleagueId, opts) =>
    set({
      currentColleagueId: colleagueId,
      slideIndex: 0,
      isPreviewMode: !!opts?.preview,
      paused: false,
      previewingMedia: false,
      memeVideoDurationMs: null,
    }),

  closePlayer: () =>
    set({
      currentColleagueId: null,
      slideIndex: 0,
      isPreviewMode: false,
      paused: false,
      previewingMedia: false,
      memeVideoDurationMs: null,
    }),

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

  setPreviewingMedia: (previewingMedia) => set({ previewingMedia }),

  setPausedByVisibility: (pausedByVisibility) => set({ pausedByVisibility }),

  setMemeVideoDurationMs: (memeVideoDurationMs) => set({ memeVideoDurationMs }),

  markUnlocked: (colleagueId) =>
    set((s) => ({ unlockedColleagueIds: new Set([...s.unlockedColleagueIds, colleagueId]) })),
}));
