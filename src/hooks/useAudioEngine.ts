import { useEffect, useState } from 'react';
import type { Slide } from '../types';
import { audioEngine } from './audioEngine';

interface Args {
  active: boolean;
  slide: Slide | undefined;
  nextSlide: Slide | undefined;
  audioEnabled: boolean;
  paused: boolean;
}

/**
 * Drives the singleton AudioEngine from React props.
 * Plays the current slide's song when active, crossfades on slide change,
 * pauses/resumes on hold-to-pause, stops on unmount or when `active` flips off.
 *
 * Returns `autoplayBlocked` so the player can render an unmute overlay; the
 * overlay's tap calls `unblockAutoplay()` from a user-gesture context.
 */
export function useAudioEngine({ active, slide, nextSlide, audioEnabled, paused }: Args) {
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    audioEngine.onAutoplayBlocked(setAutoplayBlocked);
    return () => audioEngine.onAutoplayBlocked(null);
  }, []);

  useEffect(() => {
    if (!active) {
      audioEngine.stopAll();
      return;
    }
    if (!audioEnabled) {
      audioEngine.mute();
      return;
    }
    audioEngine.playSlide(slide, audioEnabled, nextSlide);
  }, [active, slide, nextSlide, audioEnabled]);

  // Hold-to-pause: pause/resume the current track without dropping its position.
  useEffect(() => {
    if (!active || !audioEnabled) return;
    if (paused) audioEngine.pauseCurrent();
    else audioEngine.resumeCurrent();
  }, [paused, active, audioEnabled]);

  useEffect(() => {
    return () => {
      audioEngine.stopAll();
    };
  }, []);

  return { autoplayBlocked, unblockAutoplay: () => audioEngine.unblockAutoplay() };
}
