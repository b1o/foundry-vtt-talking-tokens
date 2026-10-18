/*
 * The "Bubble" button in the header of the Token Config sheet. GM only, like the other bubble settings, and only for a
 * token on a scene: a prototype token has no flag API in v11.
 */

const LABEL = "TALKING_TOKENS.TokenBubble.Button";
const ICON = "fas fa-comment-dots";

/**
 * v11 and v12: TokenConfig is Application V1, and core calls getTokenConfigHeaderButtons (client/apps/app.js:605).
 * @param {TokenConfig} sheet
 * @param {object[]} buttons
 * @param {(tokenDocument: TokenDocument) => void} open
 */
export function addBubbleHeaderButton(sheet, buttons, open) {
  if (!game.user.isGM || sheet.isPrototype) return;
  buttons.unshift({ label: LABEL, class: "talking-tokens-bubble", icon: ICON, onclick: () => open(sheet.token) });
}

/**
 * v13: TokenConfig is ApplicationV2, and core calls getHeaderControlsTokenConfig. The prototype token has its own
 * sheet class there, so this hook sees only placed tokens.
 * @param {object} sheet
 * @param {object[]} controls
 * @param {(tokenDocument: TokenDocument) => void} open
 */
export function addBubbleHeaderControl(sheet, controls, open) {
  if (!game.user.isGM) return;
  controls.push({ action: "talkingTokensBubble", label: LABEL, icon: ICON, onClick: () => open(sheet.document) });
}
