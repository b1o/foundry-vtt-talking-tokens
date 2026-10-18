import { getBubbleActorOfSheet } from "../tokens/token-flags.mjs";

/*
 * The "Bubble" button in the header of the Token Config sheet and of the actor sheet. GM only, like the other bubble
 * settings. v11 and v12 sheets are Application V1, and core calls get<Class>HeaderButtons (client/apps/app.js:605);
 * v13 sheets are ApplicationV2, and core calls getHeaderControls<Class>.
 */

const LABEL = "TALKING_TOKENS.BubbleWindow.Button";
const ICON = "fas fa-comment-dots";
const CSS_CLASS = "talking-tokens-bubble";

/**
 * Token Config, Application V1. A prototype token has no flag API in v11, and its bubble is the actor's bubble.
 * @param {(tokenDocument: TokenDocument) => void} open
 */
export function addTokenHeaderButton(sheet, buttons, open) {
  if (!game.user.isGM || sheet.isPrototype) return;
  buttons.unshift({ label: LABEL, class: CSS_CLASS, icon: ICON, onclick: () => open(sheet.token) });
}

/**
 * Token Config, ApplicationV2 (v13). The prototype token has its own sheet class there, so this sees placed tokens only.
 * @param {(tokenDocument: TokenDocument) => void} open
 */
export function addTokenHeaderControl(sheet, controls, open) {
  if (!game.user.isGM) return;
  controls.push({ action: "talkingTokensBubble", label: LABEL, icon: ICON, onClick: () => open(sheet.document) });
}

/**
 * Actor sheet, Application V1. The sheet of an unlinked token opens the bubble of the world Actor.
 * @param {(actor: Actor) => void} open
 */
export function addActorHeaderButton(sheet, buttons, open) {
  const actor = game.user.isGM ? getBubbleActorOfSheet(sheet.actor) : null;
  if (!actor) return;
  buttons.unshift({ label: LABEL, class: CSS_CLASS, icon: ICON, onclick: () => open(actor) });
}

/**
 * Actor sheet, ApplicationV2 (v13).
 * @param {(actor: Actor) => void} open
 */
export function addActorHeaderControl(sheet, controls, open) {
  const actor = game.user.isGM ? getBubbleActorOfSheet(sheet.actor) : null;
  if (!actor) return;
  controls.push({ action: "talkingTokensBubble", label: LABEL, icon: ICON, onClick: () => open(actor) });
}
