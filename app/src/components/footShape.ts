/**
 * The foot silhouette the pressure map draws into.
 *
 * The path is drawn as a RIGHT foot — hallux at low x, so medial is on the left. A
 * left foot is the same path mirrored across the viewBox, which is also exactly how
 * the insole data arrives (the converter mirrors LEFT recordings so both sides come
 * out medial-first). The drawing flips; the data never does.
 */

export type Foot = 'left' | 'right';

export const VIEW_W = 140;
export const VIEW_H = 304;

export const OUTLINE =
  'M70 12 C100 12 118 40 116 78 C114 110 104 128 100 150 C96 172 100 190 102 208 C105 240 92 292 68 292 C44 292 31 240 34 208 C36 190 40 172 36 150 C32 128 22 110 20 78 C18 40 40 12 70 12 Z';

/**
 * The sensor grid's footprint inside the silhouette, in viewBox units.
 *
 * The insole is a rectangle of cells; the foot is not. The rectangle is laid over the
 * outline's bounding box and clipped to the outline, which is the same thing the
 * physical insole does — the corner cells sit under no foot and read near zero.
 */
export const GRID_BOX = { x: 18, y: 10, width: 101, height: 283 };

/** Mirror an x coordinate for a left foot. Left/right differ only by this. */
export function flipX(x: number, foot: Foot): number {
  return foot === 'left' ? VIEW_W - x : x;
}

/** Which anatomical side of the drawing each edge is on, once mirroring is applied. */
export function sideLabels(foot: Foot): { left: string; right: string } {
  return foot === 'left' ? { left: 'lateral', right: 'medial' } : { left: 'medial', right: 'lateral' };
}
