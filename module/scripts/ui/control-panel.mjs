import { getFilePickerClass } from "../compat.mjs";
import { LiveWindow } from "./live-window.mjs";
import { MODULE_ID, TEMPLATE_PATH } from "../module-id.mjs";
import { SESSION_ACTION } from "../bridge/connection-status.mjs";

/** Actions of the buttons inside the panel; the button next to the status uses SESSION_ACTION. */
const PANEL_ACTION = Object.freeze({
  SAVE_TOKEN: "save-token",
  /** A web page (guide, bridge download, bot invite, help); the desktop app opens it in the default browser. */
  OPEN_LINK: "open-link",
  PICK_GM: "pick-gm",
  APPLY_PRESET: "apply-preset",
  START_PLACEMENT: "start-placement",
  SAVE_PLACEMENT: "save-placement",
  CANCEL_PLACEMENT: "cancel-placement",
  PICK_DEFAULT_BUBBLE: "pick-default-bubble",
  ADD_BUBBLE: "add-bubble",
  REMOVE_BUBBLE: "remove-bubble",
  TEST_USER: "test-user",
  COPY_DIAGNOSTICS: "copy-diagnostics",
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
 * @property {(userId: string) => void} testUser  Show the user as speaking for a few seconds.
 * @property {() => void} copyDiagnostics
 */

/** The GM window. It shows the view of panel-view.mjs and forwards each click as a command; it holds no rule. */
export class ControlPanel extends LiveWindow {
  #getView;
  #commands;
  /** The token field keeps its text across renders, so a status change does not clear what the GM typed. */
  #typedToken = "";
  /**
   * The collapsible sections that the GM opened or closed while the panel is open; a render would reset them.
   * Setup also opens by itself while a setup step is needed.
   */
  #isSectionOpen = { setup: false, bubbles: false, token: false, gm: false };

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
    const view = this.#getView();
    return {
      ...view,
      typedToken: this.#typedToken,
      isSetupOpen: view.setup.isNeeded || this.#isSectionOpen.setup,
      isBubblesOpen: this.#isSectionOpen.bubbles,
      isTokenOpen: this.#isSectionOpen.token,
      isGmOpen: this.#isSectionOpen.gm,
    };
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
    // A click on the summary, not the "toggle" event: the browser also fires "toggle" for an element that a render
    // creates open, and that is not the GM's choice. The click runs before the element changes, so store the reverse.
    root.querySelectorAll("details[data-section]").forEach((details) => {
      details.querySelector("summary").addEventListener("click", () => {
        this.#isSectionOpen[details.dataset.section] = !details.open;
      });
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
      case SESSION_ACTION.CONNECT: return this.#commands.connect();
      case SESSION_ACTION.DISCONNECT: return this.#commands.disconnect();
      case PANEL_ACTION.OPEN_LINK: return window.open(url, "_blank", "noopener");
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
      case PANEL_ACTION.COPY_DIAGNOSTICS: return this.#commands.copyDiagnostics();
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
