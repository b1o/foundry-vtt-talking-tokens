import { MODULE_ID } from "../module-id.mjs";

/** The bubbles that ship in assets/bubbles, plus a custom image. */
export const BUBBLE_STYLE = Object.freeze({
  CLASSIC: "classic",
  DOTS: "dots",
  THOUGHT: "thought",
  SHOUT: "shout",
  WHISPER: "whisper",
  CUSTOM: "custom",
});

const SHIPPED_STYLES = Object.values(BUBBLE_STYLE).filter((style) => style !== BUBBLE_STYLE.CUSTOM);

export const isBubbleStyle = (value) => Object.values(BUBBLE_STYLE).includes(value);

export function shippedBubblePath(style) {
  return `modules/${MODULE_ID}/assets/bubbles/${style}.svg`;
}

export const SHIPPED_BUBBLE_PATHS = SHIPPED_STYLES.map(shippedBubblePath);

/**
 * @param {string|null} tokenStyle  The style of one token, or null for the world style.
 * @param {string} worldStyle
 * @param {string|null} customImagePath  The world custom image.
 * @returns {string} The image path for the token. A custom style without an image falls back to the classic bubble.
 */
export function resolveBubblePath(tokenStyle, worldStyle, customImagePath) {
  const style = isBubbleStyle(tokenStyle) ? tokenStyle : worldStyle;
  if (style === BUBBLE_STYLE.CUSTOM) return customImagePath || shippedBubblePath(BUBBLE_STYLE.CLASSIC);
  return shippedBubblePath(isBubbleStyle(style) ? style : BUBBLE_STYLE.CLASSIC);
}
