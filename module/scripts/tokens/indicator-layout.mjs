/**
 * The anchor is the center of the indicator, as a fraction of the token size: {x: 0, y: 0} is the top-left corner
 * of the token, {x: 1, y: 1} the bottom-right corner. A fraction keeps the place right on small and large tokens.
 * @typedef {{x: number, y: number}} Anchor
 */

export const ANCHOR_PRESETS = Object.freeze({
  "top": { x: 0.5, y: -0.3 },
  "top-left": { x: 0, y: 0 },
  "top-right": { x: 1, y: 0 },
  "left": { x: -0.3, y: 0.5 },
  "right": { x: 1.3, y: 0.5 },
  "bottom": { x: 0.5, y: 1.3 },
});

export const DEFAULT_ANCHOR = ANCHOR_PRESETS["top-right"];

/** The indicator may stand up to one token size away from the token, not further. */
const ANCHOR_MIN = -1;
const ANCHOR_MAX = 2;

/** At scale 1, the indicator is half as tall as the shorter side of the token. */
const BASE_SIZE_RATIO = 0.5;

/**
 * @typedef {{width: number, height: number}} Size
 * @typedef {{x: number, y: number, width: number, height: number}} Box
 */

/**
 * Applied on save and again on each layout, so a stored value from an older version or a manual edit cannot put
 * the indicator far from its token.
 * @returns {Anchor}
 */
export function clampAnchor(anchor) {
  const clamp = (value) => (Number.isFinite(value) ? Math.min(Math.max(value, ANCHOR_MIN), ANCHOR_MAX) : 0);
  return { x: clamp(anchor?.x), y: clamp(anchor?.y) };
}

/**
 * @param {Size} token
 * @param {{x: number, y: number}} point  A point in the local coordinates of the token.
 * @returns {Anchor}
 */
export function anchorFromPoint(token, point) {
  const round = (value) => Math.round(value * 1000) / 1000;
  return clampAnchor({ x: round(point.x / token.width), y: round(point.y / token.height) });
}

/**
 * The box of the indicator in the local coordinates of the token.
 * @param {Size} token
 * @param {number} aspectRatio  Width divided by height of the indicator image.
 * @param {{anchor: Anchor, scale: number}} style
 * @returns {Box}
 */
export function layoutIndicator(token, aspectRatio, { anchor, scale }) {
  const height = Math.min(token.width, token.height) * BASE_SIZE_RATIO * scale;
  const width = height * aspectRatio;
  const { x, y } = clampAnchor(anchor);
  return { x: x * token.width - width / 2, y: y * token.height - height / 2, width, height };
}
