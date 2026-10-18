import { getApplicationClass } from "../compat.mjs";

/**
 * The base of the module's windows: a window that renders again when its data changes. It is the one place that
 * uses Application V1 (v11 has no ApplicationV2), so a later move touches one file.
 */
export class LiveWindow extends getApplicationClass() {
  #isRendering = false;
  #hasPendingRender = false;

  /** Re-render only if open. */
  refresh() {
    if (this.rendered || this.#isRendering) this.render(false);
  }

  /**
   * v11 drops a render that starts while another render runs (Application#_render, client/apps/app.js:364), and the
   * first render waits for the template fetch. Changes arrive in bursts (bridge messages, one click that updates a
   * document and its windows), so a dropped render would leave the window on old data. A render request during a
   * render runs once more when that render ends.
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
}
