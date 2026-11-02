/**
 * A spectrum of glowing bars, after Musializer (https://github.com/tsoding/musializer):
 * log-spaced bands, each eased towards its level, with a slower "smear" trailing behind.
 * The analysis and drawing follow its fft_analyze and fft_render.
 * Musializer is MIT licensed, Copyright 2023 Alexey Kutepov and Musializer Contributors.
 */

/** Each band starts this much higher than the last, so low notes get as much room as high ones. */
const BAND_STEP = 1.1;
/** Quieter than this is drawn as nothing. */
const FLOOR_DB = -70;
/** The loudest band fills the height, but only once it is this far above the floor: silence stays flat. */
const MIN_RANGE_DB = 50;
/** How fast a bar follows its level, and its smear follows the bar, per second. */
const SMOOTHNESS = 8;
const SMEARNESS = 3;

export interface BarsState {
  /** First FFT bin of each band; one more entry closes the last band. */
  readonly edges: readonly number[];
  readonly level: Float32Array;
  /** 0 to 1 per band: the bar, and the smear that trails it. */
  readonly smooth: Float32Array;
  readonly smear: Float32Array;
}

export function createBarsState(binCount: number, step = BAND_STEP): BarsState {
  const edges: number[] = [];
  for (let bin = 1; bin < binCount; bin = Math.ceil(bin * step))
    edges.push(bin);
  edges.push(binCount);
  const count = edges.length - 1;
  return {
    edges,
    level: new Float32Array(count),
    smooth: new Float32Array(count),
    smear: new Float32Array(count),
  };
}

/** Moves the bars towards a new spectrum (decibels per FFT bin, -Infinity for silence). */
export function stepBars(
  state: BarsState,
  spectrum: Float32Array,
  dt: number
): void {
  const { edges, level, smooth, smear } = state;
  let loudest = MIN_RANGE_DB;
  for (let i = 0; i < level.length; i++) {
    let peak = -Infinity;
    for (let bin = edges[i]; bin < edges[i + 1]; bin++)
      peak = Math.max(peak, spectrum[bin]);
    level[i] = Math.max(0, peak - FLOOR_DB);
    loudest = Math.max(loudest, level[i]);
  }
  // Past one whole step the easing would overshoot.
  const follow = Math.min(1, SMOOTHNESS * dt);
  const trail = Math.min(1, SMEARNESS * dt);
  for (let i = 0; i < level.length; i++) {
    smooth[i] += (level[i] / loudest - smooth[i]) * follow;
    smear[i] += (smooth[i] - smear[i]) * trail;
  }
}

/** Where the bars sit in a drawing area, as fractions of its size. */
export interface BarsFrame {
  left: number;
  right: number;
  /** Top of the tallest possible bar, and the line the bars stand on. */
  top: number;
  bottom: number;
  /** Radius of the dot on a full-height bar, in bar widths. */
  glow: number;
}

export function drawBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: BarsState,
  frame: BarsFrame
): void {
  const { smooth, smear } = state;
  const count = smooth.length;
  const cell = ((frame.right - frame.left) * width) / count;
  const floor = frame.bottom * height;
  const reach = (frame.bottom - frame.top) * height;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#151515";
  ctx.fillRect(0, 0, width, height);
  // Light adds up where glows overlap.
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const level = smooth[i];
    const size = Math.sqrt(level);
    const x = frame.left * width + (i + 0.5) * cell;
    const y = floor - reach * level;
    const tail = floor - reach * smear[i];
    const hue = (i / count) * 360;
    const colour = `hsl(${hue} 100% 62.5%)`;

    ctx.fillStyle = colour;
    const thickness = (cell / 3) * size;
    ctx.fillRect(x - thickness / 2, y, thickness, floor - y);

    // The smear: a soft streak from where the bar was to where it is.
    const streak = cell * 3 * size;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x - streak / 2, Math.min(y, tail), streak, Math.abs(tail - y));
    ctx.globalAlpha = 1;

    const radius = cell * frame.glow * size;
    if (radius < 0.5) continue;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, colour);
    glow.addColorStop(0.14, colour);
    glow.addColorStop(0.4, `hsl(${hue} 100% 62.5% / 0.2)`);
    glow.addColorStop(1, `hsl(${hue} 100% 62.5% / 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }
}
