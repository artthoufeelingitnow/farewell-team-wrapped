import type { Slide } from '../types';
import { FADE_MS } from '../utils/constants';

interface AudioElWithUrl extends HTMLAudioElement {
  __songUrl?: string;
}

class AudioEngine {
  private current: AudioElWithUrl | null = null;
  private next: AudioElWithUrl | null = null;
  private fadeTimers: ReturnType<typeof setInterval>[] = [];

  private clearFades(): void {
    this.fadeTimers.forEach((t) => clearInterval(t));
    this.fadeTimers = [];
  }

  private fade(el: AudioElWithUrl | null, fromVol: number, toVol: number, ms: number, onDone?: () => void): void {
    if (!el) {
      onDone?.();
      return;
    }
    const steps = 20;
    const stepMs = ms / steps;
    const stepDelta = (toVol - fromVol) / steps;
    let i = 0;
    el.volume = Math.max(0, Math.min(1, fromVol));
    const timer = setInterval(() => {
      i++;
      el.volume = Math.max(0, Math.min(1, fromVol + stepDelta * i));
      if (i >= steps) {
        clearInterval(timer);
        this.fadeTimers = this.fadeTimers.filter((t) => t !== timer);
        onDone?.();
      }
    }, stepMs);
    this.fadeTimers.push(timer);
  }

  private makeAudioEl(url: string, startSec: number): AudioElWithUrl {
    const el = new Audio() as AudioElWithUrl;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.volume = 0;
    el.src = url;
    el.addEventListener('loadedmetadata', () => {
      try {
        if (startSec > 0) el.currentTime = Math.min(startSec, (el.duration || 30) - 1);
      } catch {
        // ignore
      }
    });
    return el;
  }

  stopAll(): void {
    this.clearFades();
    if (this.current) {
      try {
        this.current.pause();
      } catch {
        // ignore
      }
      this.current.src = '';
      this.current = null;
    }
    if (this.next) {
      try {
        this.next.pause();
      } catch {
        // ignore
      }
      this.next.src = '';
      this.next = null;
    }
  }

  /** Play (or crossfade to) the song attached to this slide. Returns silently if disabled. */
  playSlide(slide: Slide | undefined, enabled: boolean, nextSlide?: Slide): void {
    if (!enabled) return;
    if (!slide || !slide.songUrl) {
      if (this.current) {
        const oldEl = this.current;
        this.fade(oldEl, oldEl.volume, 0, FADE_MS, () => {
          try {
            oldEl.pause();
          } catch {
            // ignore
          }
        });
        this.current = null;
      }
      return;
    }

    // Same URL already playing — leave it
    if (this.current && this.current.__songUrl === slide.songUrl) return;

    let newEl: AudioElWithUrl;
    if (this.next && this.next.__songUrl === slide.songUrl) {
      newEl = this.next;
      this.next = null;
    } else {
      newEl = this.makeAudioEl(slide.songUrl, slide.songStart || 0);
    }
    newEl.__songUrl = slide.songUrl;

    void newEl.play().catch(() => {
      // Autoplay may be blocked silently; nothing to do.
    });

    this.fade(newEl, 0, 1, FADE_MS);

    if (this.current && this.current !== newEl) {
      const oldEl = this.current;
      this.fade(oldEl, oldEl.volume, 0, FADE_MS, () => {
        try {
          oldEl.pause();
        } catch {
          // ignore
        }
        oldEl.src = '';
      });
    }
    this.current = newEl;

    this.preload(nextSlide);
  }

  private preload(nextSlide: Slide | undefined): void {
    if (!nextSlide?.songUrl) return;
    if (this.current && this.current.__songUrl === nextSlide.songUrl) return;
    if (this.next) {
      try {
        this.next.pause();
      } catch {
        // ignore
      }
      this.next.src = '';
    }
    this.next = this.makeAudioEl(nextSlide.songUrl, nextSlide.songStart || 0);
    this.next.__songUrl = nextSlide.songUrl;
  }

  /** Disable: fade current track out quickly. */
  mute(): void {
    if (!this.current) return;
    const el = this.current;
    this.fade(el, el.volume, 0, 200, () => {
      try {
        el.pause();
      } catch {
        // ignore
      }
    });
  }
}

export const audioEngine = new AudioEngine();

// ---------- preview audio (admin) — single track at a time ----------
let previewEl: HTMLAudioElement | null = null;
let previewKey: string | null = null;
let previewListener: (() => void) | null = null;

export function previewSong(
  url: string,
  startSec: number,
  key: string,
  onEnd?: () => void,
): boolean {
  // Toggle off if same key
  if (previewEl && previewKey === key) {
    stopPreviewAudio();
    return false;
  }
  stopPreviewAudio();
  previewEl = new Audio(url);
  previewEl.crossOrigin = 'anonymous';
  previewEl.volume = 0.8;
  previewEl.addEventListener('loadedmetadata', () => {
    try {
      if (startSec > 0 && previewEl) previewEl.currentTime = startSec;
    } catch {
      // ignore
    }
  });
  previewListener = () => {
    stopPreviewAudio();
    onEnd?.();
  };
  previewEl.addEventListener('ended', previewListener);
  previewEl.play().catch(() => {});
  previewKey = key;
  return true;
}

export function seekPreviewAudio(sec: number): void {
  if (!previewEl) return;
  try {
    previewEl.currentTime = Math.max(0, sec);
  } catch {
    // ignore — metadata may not be loaded yet
  }
}

export function stopPreviewAudio(): void {
  if (previewEl) {
    if (previewListener) previewEl.removeEventListener('ended', previewListener);
    try {
      previewEl.pause();
    } catch {
      // ignore
    }
    previewEl.src = '';
    previewEl = null;
  }
  previewKey = null;
  previewListener = null;
}

export function getPreviewKey(): string | null {
  return previewKey;
}
