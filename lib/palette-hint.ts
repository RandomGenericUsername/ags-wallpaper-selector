// ---------------------------------------------------------------------------
// PURE dominant-colour hint (REQ-005 §8.4).
//
// This is a HINT, not a palette producer: five swatches rendered from the
// focused wallpaper so the control bar can show its colour character. It is
// never written to disk, never used as a theme and never a second producer —
// `tpr` remains the only palette producer.
//
// Deterministic bucketing (5 bits per channel), alpha-aware, distance-filtered
// so five near-identical buckets do not produce five identical dots.
//
// PURE: no GTK, no I/O, Node-testable.
// ---------------------------------------------------------------------------

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface QuantizeOptions {
  /** Number of swatches; clamped to 1..16. */
  count?: number;
  /** Skip pixels below this alpha (0..255). */
  alphaMin?: number;
  /** Minimum RGB distance between picked buckets. */
  minDistance?: number;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(color: Rgb): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => clampByte(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function distance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Quantize RGBA bytes to at most `count` representative colours, most common
 * first. Empty/short input returns `[]` (the caller renders no dots).
 *
 * The input is a flat RGBA array (4 bytes per pixel). A sampled downscale is
 * expected; the caller owns the decode.
 */
export function quantizePalette(
  rgba: ArrayLike<number>,
  options: QuantizeOptions = {},
): string[] {
  const count = Math.max(
    1,
    Math.min(16, Math.trunc(options.count ?? 5)),
  );
  const alphaMin = Math.max(0, Math.min(255, options.alphaMin ?? 128));
  const minDistance = Math.max(0, options.minDistance ?? 34);

  interface Bucket {
    r: number;
    g: number;
    b: number;
    n: number;
  }
  const buckets = new Map<number, Bucket>();

  const pixels = Math.floor(rgba.length / 4);
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * 4;
    const alpha = rgba[offset + 3];
    if (alpha < alphaMin) continue;
    const r = rgba[offset];
    const g = rgba[offset + 1];
    const b = rgba[offset + 2];
    if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") {
      continue;
    }
    // 5 bits per channel: 32 buckets, enough to keep a gradient's family
    // separate without exploding to one bucket per pixel.
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, { r, g, b, n: 1 });
    } else {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    }
  }

  const ranked = [...buckets.values()]
    .map((bucket) => ({
      r: bucket.r / bucket.n,
      g: bucket.g / bucket.n,
      b: bucket.b / bucket.n,
      n: bucket.n,
    }))
    .sort((a, b) => {
      if (b.n !== a.n) return b.n - a.n;
      const ar = `${clampByte(a.r)}:${clampByte(a.g)}:${clampByte(a.b)}`;
      const br = `${clampByte(b.r)}:${clampByte(b.g)}:${clampByte(b.b)}`;
      return ar.localeCompare(br);
    });

  const picked: Rgb[] = [];
  for (const candidate of ranked) {
    if (picked.length >= count) break;
    if (picked.some((existing) => distance(existing, candidate) < minDistance)) {
      continue;
    }
    picked.push({ r: candidate.r, g: candidate.g, b: candidate.b });
  }
  return picked.map(toHex);
}
