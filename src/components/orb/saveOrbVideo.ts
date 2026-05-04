/**
 * Records a short clip of the live orb canvas via MediaRecorder + captureStream
 * and triggers a webm download. Resolves once the file has been handed off to
 * the browser; rejects if the browser can't encode webm (Safari sometimes can't).
 *
 * The orb keeps rotating at its normal pace during the capture, so a 6s clip
 * shows roughly one full Y rotation.
 */
export async function saveOrbVideo(
  orbCanvas: HTMLCanvasElement,
  name: string,
  options: { durationMs?: number; onProgress?: (remainingMs: number) => void } = {},
): Promise<void> {
  const durationMs = options.durationMs ?? 6000;

  // Pick the best webm codec the browser will encode. VP9 is smallest/cleanest
  // when supported; VP8 is the broadly-compatible fallback.
  const mimeType = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));

  if (!mimeType) {
    throw new Error('Video recording is not supported in this browser.');
  }

  const stream = orbCanvas.captureStream(60);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  // Drive the optional progress callback once per 100ms tick so the UI can
  // show a live countdown without polling the recorder itself.
  const startedAt = performance.now();
  let progressTimer: number | undefined;
  if (options.onProgress) {
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, durationMs - elapsed);
      options.onProgress!(remaining);
      if (remaining > 0) progressTimer = window.setTimeout(tick, 100);
    };
    tick();
  }

  await new Promise((r) => window.setTimeout(r, durationMs));
  recorder.stop();
  if (progressTimer) window.clearTimeout(progressTimer);

  const blob = await stopped;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `wrapped-${name.toLowerCase().trim().replace(/\s+/g, '-') || 'colleague'}.webm`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoke so the download has time to start.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
