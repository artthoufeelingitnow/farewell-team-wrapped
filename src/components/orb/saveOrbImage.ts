/**
 * Composites the live orb canvas into a square share-card with the colleague's
 * name as a title, then triggers a PNG download.
 */
export function saveOrbImage(orbCanvas: HTMLCanvasElement, name: string): void {
  const SIZE = 1080;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = SIZE;
  exportCanvas.height = SIZE;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) return;

  // Background — a soft radial that echoes the in-app dark slide bg.
  const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 80, SIZE / 2, SIZE / 2, SIZE * 0.7);
  grad.addColorStop(0, '#241540');
  grad.addColorStop(1, '#0a0014');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Orb — drawn centered, taking ~62% of width.
  const orbSize = Math.round(SIZE * 0.62);
  const ox = (SIZE - orbSize) / 2;
  const oy = Math.round(SIZE * 0.18);
  ctx.drawImage(orbCanvas, ox, oy, orbSize, orbSize);

  // Title — Jua, big.
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '600 64px "Jua", "Helvetica Neue", sans-serif';
  ctx.fillText(`${name}'s Wrapped`, SIZE / 2, SIZE - 110);

  // Convert to PNG + trigger download.
  const dataUrl = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `wrapped-${name.toLowerCase().trim().replace(/\s+/g, '-') || 'colleague'}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
