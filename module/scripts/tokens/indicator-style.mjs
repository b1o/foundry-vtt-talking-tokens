import { getCustomBubbles, getDefaultBubbleId, getIndicatorAnchor, getIndicatorScale } from "../settings.mjs";
import { buildLibrary, resolveBubble } from "./bubble-library.mjs";
import { getBubbleActorOfToken, getOwnBubbleId } from "./token-flags.mjs";

/**
 * The look of the bubbles as the canvas draws them: the saved settings, plus a size that the GM previews with the
 * slider before the save. The indicators and the placement preview read the style only here.
 */
export class IndicatorStyle {
  #previewScale = null;

  /** @returns {{anchor: import("./indicator-layout.mjs").Anchor, scale: number}} */
  get layout() {
    return { anchor: getIndicatorAnchor(), scale: this.#previewScale ?? getIndicatorScale() };
  }

  /** @returns {import("./bubble-library.mjs").Bubble[]} */
  get library() {
    return buildLibrary(getCustomBubbles());
  }

  /** @returns {string} The image of the token's own bubble, else of its actor's bubble, else of the world default. */
  bubblePathFor(tokenDocument) {
    return resolveBubble(this.library, [getOwnBubbleId(tokenDocument), ...this.#actorCandidates(tokenDocument)]).path;
  }

  /** @returns {import("./bubble-library.mjs").Bubble} The bubble that the token shows without its own choice. */
  inheritedBubbleOfToken(tokenDocument) {
    return resolveBubble(this.library, this.#actorCandidates(tokenDocument));
  }

  /** @returns {import("./bubble-library.mjs").Bubble} The bubble that an actor's tokens show without its choice. */
  inheritedBubbleOfActor() {
    return resolveBubble(this.library, [getDefaultBubbleId()]);
  }

  #actorCandidates(tokenDocument) {
    const actor = getBubbleActorOfToken(tokenDocument);
    return [actor && getOwnBubbleId(actor), getDefaultBubbleId()];
  }

  previewScale(scale) {
    this.#previewScale = scale;
  }

  endPreview() {
    this.#previewScale = null;
  }
}
