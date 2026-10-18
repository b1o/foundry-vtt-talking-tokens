import { getApplicationClass } from "../compat.mjs";
import { MODULE_ID, TEMPLATE_PATH } from "../module-id.mjs";
import { log, notify } from "../output.mjs";
import { getTokenBubbleId, setTokenBubbleId } from "../tokens/token-flags.mjs";
import { buildTokenBubbleView } from "./token-bubble-view.mjs";

/**
 * The bubble of one token, opened from the header of its Token Config. A click saves at once, so the GM sees the
 * choice on the token while the window is open. Application V1, because v11 has no ApplicationV2.
 */
class TokenBubbleWindow extends getApplicationClass() {
  #tokenDocument;
  #getLibrary;
  #getDefaultBubbleId;
  #onClose;

  /**
   * @param {{tokenDocument: TokenDocument, getLibrary: () => import("../tokens/bubble-library.mjs").Bubble[],
   *   getDefaultBubbleId: () => string, onClose: () => void}} options
   */
  constructor({ tokenDocument, getLibrary, getDefaultBubbleId, onClose }) {
    super({ id: `${MODULE_ID}-bubble-${tokenDocument.id}` });
    this.#tokenDocument = tokenDocument;
    this.#getLibrary = getLibrary;
    this.#getDefaultBubbleId = getDefaultBubbleId;
    this.#onClose = onClose;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [MODULE_ID, "tt-token-bubble-window"],
      template: `${TEMPLATE_PATH}/token-bubble.hbs`,
      width: 400,
      height: "auto",
    });
  }

  get title() {
    return game.i18n.format("TALKING_TOKENS.TokenBubble.Title", { token: this.#tokenDocument.name });
  }

  getData() {
    return buildTokenBubbleView(this.#getLibrary(), getTokenBubbleId(this.#tokenDocument), this.#getDefaultBubbleId());
  }

  /** Re-render only if open. */
  refresh() {
    if (this.rendered) this.render(false);
  }

  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelectorAll("[data-bubble-id]").forEach((button) => {
      button.addEventListener("click", () => this.#choose(button.dataset.bubbleId || null));
    });
  }

  async close(options) {
    await super.close(options);
    this.#onClose();
  }

  /** The updateToken hook renders the window again with the saved choice. */
  async #choose(bubbleId) {
    try {
      await setTokenBubbleId(this.#tokenDocument, bubbleId);
    } catch (error) {
      notify.error("TALKING_TOKENS.Notifications.BubbleFailed");
      log.error("The bubble of the token could not be changed.", error);
    }
  }
}

/** The open bubble windows, at most one per token, so a change can reach the window that shows it. */
export class TokenBubbleWindows {
  #getLibrary;
  #getDefaultBubbleId;
  /** @type {Map<string, TokenBubbleWindow>} TokenDocument uuid → window. */
  #windows = new Map();

  /** @param {{getLibrary: () => import("../tokens/bubble-library.mjs").Bubble[], getDefaultBubbleId: () => string}} options */
  constructor({ getLibrary, getDefaultBubbleId }) {
    this.#getLibrary = getLibrary;
    this.#getDefaultBubbleId = getDefaultBubbleId;
  }

  /** @param {TokenDocument} tokenDocument */
  open(tokenDocument) {
    const { uuid } = tokenDocument;
    if (!this.#windows.has(uuid)) {
      this.#windows.set(uuid, new TokenBubbleWindow({
        tokenDocument,
        getLibrary: this.#getLibrary,
        getDefaultBubbleId: this.#getDefaultBubbleId,
        onClose: () => this.#windows.delete(uuid),
      }));
    }
    this.#windows.get(uuid).render(true);
  }

  /** After a change of the token's bubble. */
  refreshToken(tokenDocument) {
    this.#windows.get(tokenDocument.uuid)?.refresh();
  }

  /** After a change of the library or the default bubble. */
  refreshAll() {
    for (const window of this.#windows.values()) window.refresh();
  }

  /** The token is gone, so its window has nothing to show. */
  closeToken(tokenDocument) {
    this.#windows.get(tokenDocument.uuid)?.close();
  }
}
