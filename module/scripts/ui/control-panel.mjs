import { getApplicationClass, getFilePickerClass } from "../compat.mjs";
import { MODULE_ID, TEMPLATE_PATH } from "../module-id.mjs";
import { ACTION } from "../bridge/connection-status.mjs";

/** Actions that only buttons inside the panel use; the status line uses ACTION. */
const PANEL_ACTION = Object.freeze({
  SAVE_TOKEN: "save-token",
  OPEN_GUIDE: "open-guide",
  PICK_GM: "pick-gm",
  APPLY_PRESET: "apply-preset",
  START_PLACEMENT: "start-placement",
  SAVE_PLACEMENT: "save-placement",
  CANCEL_PLACEMENT: "cancel-placement",
  PICK_DEFAULT_BUBBLE: "pick-default-bubble",
  ADD_BUBBLE: "add-bubble",
  REMOVE_BUBBLE: "remove-bubble",
  TEST_USER: "test-user",
});

/**
 * @typedef {object} PanelCommands
 * @property {() => void} connect
 * @property {() => void} disconnect
 * @property {(token: string) => void} setToken
 * @property {(discordId: string) => void} setGm
 * @property {(userId: string, discordId: string|null) => void} linkUser
 * @property {(isOn: boolean) => void} setAutoConnect
 * @property {(presetName: string) => void} applyPreset
 * @property {() => void} startPlacement
 * @property {() => void} savePlacement
 * @property {() => void} cancelPlacement
 * @property {(bubbleId: string) => void} setDefaultBubble
 * @property {(path: string) => void} addBubble
 * @property {(bubbleId: string) => void} removeBubble
 * @property {(scale: number) => void} previewScale  While the GM drags the size slider.
 * @property {(scale: number) => void} saveScale
 * @property {(tokenId: string, bubbleId: string|null) => void} setTokenBubble  null: use the world default.
 * @property {(userId: string) => void} testUser  Show the user as speaking for a few seconds.
 */

/**
 * The GM window. It shows the view of panel-view.mjs and forwards each click as a command; it holds no rule.
 * Application V1, because v11 has no ApplicationV2.
 */
export class ControlPanel extends getApplicationClass() {
  #getView;
  #commands;
  /** The token field keeps its text across renders, so a status change does not clear what the GM typed. */
  #typedToken = "";
  #isRendering = false;
  #hasPendingRender = false;

  /** @param {{getView: () => object, commands: PanelCommands}} options */
  constructor({ getView, commands }) {
    super();
    this.#getView = getView;
    this.#commands = commands;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-panel`,
      classes: [MODULE_ID],
      template: `${TEMPLATE_PATH}/control-panel.hbs`,
      title: "TALKING_TOKENS.Panel.Title",
      width: 420,
      height: "auto",
      resizable: true,
    });
  }

  getData() {
    return { ...this.#getView(), typedToken: this.#typedToken };
  }

  /** Re-render only if open. */
  refresh() {
    if (this.rendered || this.#isRendering) this.render(false);
  }

  /**
   * v11 drops a render that starts while another render runs (Application#_render, client/apps/app.js:364), and the
   * first render waits for the template fetch. Bridge messages arrive in bursts, so a dropped render would leave the
   * panel on old facts. A render request during a render runs once more when that render ends.
   */
  async _render(force, options) {
    if (this.#isRendering) {
      this.#hasPendingRender = true;
      return;
    }
    this.#isRendering = true;
    try {
      await super._render(force, options);
    } finally {
      this.#isRendering = false;
    }
    if (!this.#hasPendingRender) return;
    this.#hasPendingRender = false;
    this.refresh();
  }

  /** Update the speaking dots in place: a full render would close a select that the GM has open. */
  showSpeaking(speakingUserIds) {
    if (!this.rendered) return;
    const speaking = new Set(speakingUserIds);
    for (const dot of this.element[0].querySelectorAll("[data-speaking-user]")) {
      dot.classList.toggle("is-speaking", speaking.has(dot.dataset.speakingUser));
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => this.#onAction(event, button.dataset));
    });
    root.querySelector("[name=token]")?.addEventListener("input", (event) => {
      this.#typedToken = event.currentTarget.value;
    });
    root.querySelectorAll("select[data-user-id]").forEach((select) => {
      select.addEventListener("change", () => this.#commands.linkUser(select.dataset.userId, select.value || null));
    });
    root.querySelector("[name=autoConnect]")?.addEventListener("change", (event) => {
      this.#commands.setAutoConnect(event.currentTarget.checked);
    });
    this.#activateSizeSlider(root);
    root.querySelector("[name=tokenBubble]")?.addEventListener("change", (event) => {
      const select = event.currentTarget;
      this.#commands.setTokenBubble(select.dataset.tokenId, select.value || null);
    });
  }

  #activateSizeSlider(root) {
    const slider = root.querySelector("[name=scale]");
    const output = root.querySelector("[name=scaleValue]");
    if (!slider) return;
    slider.addEventListener("input", () => {
      output.value = slider.value;
      this.#commands.previewScale(Number(slider.value));
    });
    slider.addEventListener("change", () => this.#commands.saveScale(Number(slider.value)));
  }

  #onAction(event, { action, discordId, url, preset, bubbleId, userId }) {
    event.preventDefault();
    switch (action) {
      case ACTION.CONNECT: return this.#commands.connect();
      case ACTION.DISCONNECT: return this.#commands.disconnect();
      case ACTION.INVITE:
      case ACTION.DOWNLOAD_BRIDGE:
      case ACTION.EXPLAIN_LOCALHOST:
      case PANEL_ACTION.OPEN_GUIDE:
        return window.open(url, "_blank", "noopener");
      case ACTION.SETUP: return this.element[0].querySelector("details.tt-setup")?.setAttribute("open", "");
      case PANEL_ACTION.SAVE_TOKEN: return this.#saveToken();
      case PANEL_ACTION.PICK_GM: return this.#commands.setGm(discordId);
      case PANEL_ACTION.APPLY_PRESET: return this.#commands.applyPreset(preset);
      case PANEL_ACTION.START_PLACEMENT: return this.#commands.startPlacement();
      case PANEL_ACTION.SAVE_PLACEMENT: return this.#commands.savePlacement();
      case PANEL_ACTION.CANCEL_PLACEMENT: return this.#commands.cancelPlacement();
      case PANEL_ACTION.PICK_DEFAULT_BUBBLE: return this.#commands.setDefaultBubble(bubbleId);
      case PANEL_ACTION.ADD_BUBBLE: return this.#browseBubble();
      case PANEL_ACTION.REMOVE_BUBBLE: return this.#commands.removeBubble(bubbleId);
      case PANEL_ACTION.TEST_USER: return this.#commands.testUser(userId);
    }
  }

  #browseBubble() {
    const FilePicker = getFilePickerClass();
    new FilePicker({ type: "image", callback: (path) => this.#commands.addBubble(path) }).render(true);
  }

  #saveToken() {
    const token = this.#typedToken.trim();
    if (!token) return;
    this.#typedToken = "";
    this.#commands.setToken(token);
  }
}
