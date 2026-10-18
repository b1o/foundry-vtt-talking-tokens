/**
 * The data for templates/bubble-choice.hbs: one tile for "no own bubble" (it shows the bubble that is used then),
 * then one tile per library bubble. Text keys are resolved in the template.
 * @param {import("../tokens/bubble-library.mjs").Bubble[]} library
 * @param {string|null} ownBubbleId  The bubble that the token or actor chose, or null.
 * @param {import("../tokens/bubble-library.mjs").Bubble} inheritedBubble  The bubble without the own choice.
 * @param {string} inheritedLabelKey  The caption of the first tile.
 */
export function buildBubbleChoiceView(library, ownBubbleId, inheritedBubble, inheritedLabelKey) {
  // An own bubble whose image was removed from the library is not used, so the first tile shows as chosen.
  const ownBubble = library.find((bubble) => bubble.id === ownBubbleId) ?? null;
  return {
    inheritedTile: { path: inheritedBubble.path, labelKey: inheritedLabelKey, isSelected: !ownBubble },
    bubbles: library.map((bubble) => ({
      id: bubble.id,
      path: bubble.path,
      ...(bubble.isShipped ? { labelKey: bubble.name } : { label: bubble.name }),
      isSelected: bubble.id === ownBubble?.id,
    })),
  };
}
