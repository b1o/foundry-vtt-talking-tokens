import { getCustomBubbles, getDefaultBubbleId, getIndicatorAnchor, getIndicatorScale } from "../settings.mjs";
import { buildLibrary, resolveBubblePath } from "./bubble-library.mjs";
import { getTokenBubbleId } from "./token-flags.mjs";

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

  /** @returns {string} The image of the token's own bubble, else of the world default. */
  bubblePathFor(tokenDocument) {
    return resolveBubblePath(this.library, getTokenBubbleId(tokenDocument), getDefaultBubbleId());
  }

  previewScale(scale) {
    this.#previewScale = scale;
  }

  endPreview() {
    this.#previewScale = null;
  }
}
