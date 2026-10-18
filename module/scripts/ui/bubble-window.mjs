import { getApplicationClass } from "../compat.mjs";
import { MODULE_ID, TEMPLATE_PATH } from "../module-id.mjs";
import { log, notify } from "../output.mjs";
import { getOwnBubbleId, setOwnBubbleId } from "../tokens/token-flags.mjs";
import { buildBubbleChoiceView } from "./bubble-choice-view.mjs";

/**
 * @typedef {object} BubbleOwner  A token or an actor that can have its own bubble.
 * @property {TokenDocument|Actor} document
 * @property {string} titleKey           Formatted with {name}.
 * @property {string} hintKey
 * @property {string} inheritedLabelKey  The caption of the "no own bubble" tile.
 * @property {() => import("../tokens/bubble-library.mjs").Bubble} getInheritedBubble
 */

/**
 * The own bubble of one token or one actor, opened from a sheet header. A click saves at once, so the GM sees the
 * choice on the canvas while the window is open. Application V1, because v11 has no ApplicationV2.
 */
class BubbleWindow extends getApplicationClass() {
  #owner;
  #getLibrary;
  #onClose;

  /**
   * @param {{owner: BubbleOwner, getLibrary: () => import("../tokens/bubble-library.mjs").Bubble[],
   *   onClose: () => void}} options
   */
  constructor({ owner, getLibrary, onClose }) {
    super({ id: `${MODULE_ID}-bubble-${owner.document.uuid.replaceAll(".", "-")}` });
    this.#owner = owner;
    this.#getLibrary = getLibrary;
    this.#onClose = onClose;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [MODULE_ID, "tt-bubble-window"],
      template: `${TEMPLATE_PATH}/bubble-choice.hbs`,
      width: 400,
      height: "auto",
    });
  }

  get title() {
    return game.i18n.format(this.#owner.titleKey, { name: this.#owner.document.name });
  }

  getData() {
    const { document, hintKey, inheritedLabelKey, getInheritedBubble } = this.#owner;
    return {
      hintKey,
      ...buildBubbleChoiceView(this.#getLibrary(), getOwnBubbleId(document), getInheritedBubble(), inheritedLabelKey),
    };
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

  /** The update hook of the token or actor renders the window again with the saved choice. */
  async #choose(bubbleId) {
    try {
      await setOwnBubbleId(this.#owner.document, bubbleId);
    } catch (error) {
      notify.error("TALKING_TOKENS.Notifications.BubbleFailed");
      log.error("The bubble could not be changed.", error);
    }
  }
}

/** The open bubble windows, at most one per token or actor, so a change can reach the window that shows it. */
export class BubbleWindows {
  #style;
  /** @type {Map<string, BubbleWindow>} Document uuid → window. */
  #windows = new Map();

  /** @param {{style: import("../tokens/indicator-style.mjs").IndicatorStyle}} options */
  constructor({ style }) {
    this.#style = style;
  }

  /** @param {TokenDocument} tokenDocument */
  openForToken(tokenDocument) {
    this.#open({
      document: tokenDocument,
      titleKey: "TALKING_TOKENS.BubbleWindow.TokenTitle",
      hintKey: "TALKING_TOKENS.BubbleWindow.TokenHint",
      inheritedLabelKey: "TALKING_TOKENS.BubbleWindow.SameAsActor",
      getInheritedBubble: () => this.#style.inheritedBubbleOfToken(tokenDocument),
    });
  }

  /** @param {Actor} actor  The world Actor, not the synthetic actor of an unlinked token. */
  openForActor(actor) {
    this.#open({
      document: actor,
      titleKey: "TALKING_TOKENS.BubbleWindow.ActorTitle",
      hintKey: "TALKING_TOKENS.BubbleWindow.ActorHint",
      inheritedLabelKey: "TALKING_TOKENS.BubbleWindow.AllTokens",
      getInheritedBubble: () => this.#style.inheritedBubbleOfActor(),
    });
  }

  /**
   * After any change that can change what a window shows: the own bubble of a token or an actor (an actor's bubble
   * is the first tile of its tokens' windows), the library, or the default.
   */
  refreshAll() {
    for (const window of this.#windows.values()) window.refresh();
  }

  /** The token or actor is gone, so its window has nothing to show. */
  closeFor(document) {
    this.#windows.get(document.uuid)?.close();
  }

  /** @param {BubbleOwner} owner */
  #open(owner) {
    const { uuid } = owner.document;
    if (!this.#windows.has(uuid)) {
      this.#windows.set(uuid, new BubbleWindow({
        owner,
        getLibrary: () => this.#style.library,
        onClose: () => this.#windows.delete(uuid),
      }));
    }
    this.#windows.get(uuid).render(true);
  }
}
