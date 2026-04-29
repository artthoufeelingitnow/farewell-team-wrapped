import { useEffect } from 'react';
import type { Slide } from '../types';
import { audioEngine } from './audioEngine';

interface Args {
  active: boolean;
  slide: Slide | undefined;
  nextSlide: Slide | undefined;
  audioEnabled: boolean;
}

/**
 * Drives the singleton AudioEngine from React props.
 * Plays the current slide's song when active, crossfades on slide change,
 * stops on unmount or when `active` becomes false.
 */
export function useAudioEngine({ active, slide, nextSlide, audioEnabled }: Args) {
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

  useEffect(() => {
    return () => {
      audioEngine.stopAll();
    };
  }, []);
}
