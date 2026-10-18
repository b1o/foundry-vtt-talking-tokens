/*
 * Core APIs that moved between Foundry versions. The baseline is v11.
 * Each getter tries the new namespaced location first, because from v13 a deprecated global logs a warning when
 * it is read.
 */

/** v13 moved Application V1 to foundry.appv1.api and deprecated it. */
export function getApplicationClass() {
  return foundry.appv1?.api?.Application ?? Application;
}

/**
 * The right column of the Token HUD. This depends on core markup (templates/hud/token-hud.html in v11), so it is
 * the only place that knows the selector. v11 render hooks pass jQuery; ApplicationV2 hooks (v13) pass an element.
 * @param {HTMLElement|jQuery} html
 * @returns {HTMLElement|null}
 */
export function getTokenHudRightColumn(html) {
  const root = html instanceof HTMLElement ? html : html[0];
  return root.querySelector(".col.right");
}

/** v13 moved loadTexture to foundry.canvas. */
export function loadTextureCompat(path) {
  const load = foundry.canvas?.loadTexture ?? loadTexture;
  return load(path);
}
