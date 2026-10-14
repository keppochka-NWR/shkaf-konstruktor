/** Bosch HBF113BR0B, official spec sheet p.3. Axes here are W/H/D, mm.
 * 548 is insertion depth, not total depth with fascia/handle.
 * Base niche differs from the tall-unit niche; do not mix installation cases. */
export const OVEN_SOURCE = 'https://media3.bosch-home.com/Documents/specsheet/en-GB/HBF113BR0B.pdf';
export const OVEN = {
  width: 594, height: 595, insertionDepth: 548,
  metalFasciaDepth: 20, handleProjectionMax: 50, frontBelowSupport: 8,
  baseNiche: { widthMin: 560, widthMax: 568, heightMin: 600, heightMax: 604, depthMin: 550 },
  tallNiche: { widthMin: 560, widthMax: 568, heightMin: 575, heightMax: 597, depthMin: 550 },
} as const;
// Conservative closed envelope includes the maximum handle projection in the drawing.
export const OVEN_TOTAL_DEPTH = OVEN.insertionDepth + OVEN.metalFasciaDepth + OVEN.handleProjectionMax;
export const OVEN_BASE_NICHE: [number, number, number] = [OVEN.baseNiche.widthMin, OVEN.baseNiche.heightMin, OVEN.baseNiche.depthMin];
