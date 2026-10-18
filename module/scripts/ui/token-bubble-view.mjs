import { FALLBACK_BUBBLE_ID } from "../tokens/bubble-library.mjs";

/**
 * The data for templates/token-bubble.hbs: one tile for "the bubble for all tokens", then one tile per library
 * bubble. Text keys are resolved in the template.
 * @param {import("../tokens/bubble-library.mjs").Bubble[]} library
 * @param {string|null} tokenBubbleId  The token's own bubble, or null.
 * @param {string} defaultBubbleId
 */
export function buildTokenBubbleView(library, tokenBubbleId, defaultBubbleId) {
  const find = (id) => library.find((bubble) => bubble.id === id);
  // A token whose image was removed from the library uses the default, so the default tile shows as chosen.
  const ownBubble = find(tokenBubbleId) ?? null;
  const defaultBubble = find(defaultBubbleId) ?? find(FALLBACK_BUBBLE_ID);
  return {
    defaultTile: { path: defaultBubble.path, isSelected: !ownBubble },
    bubbles: library.map((bubble) => ({
      id: bubble.id,
      path: bubble.path,
      ...(bubble.isShipped ? { labelKey: bubble.name } : { label: bubble.name }),
      isSelected: bubble.id === ownBubble?.id,
    })),
  };
}
