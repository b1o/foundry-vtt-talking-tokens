import { getTokenHudRightColumn } from "../compat.mjs";
import { log, notify } from "../output.mjs";
import { getSpeakerUserId, toggleSpeakerMark } from "./token-flags.mjs";

/**
 * The microphone button in the Token HUD: "my voice shows on this token". Only owners see it.
 * @param {TokenHUD} hud
 * @param {HTMLElement|jQuery} html
 */
export function addSpeakerButton(hud, html) {
  const tokenDocument = hud.object?.document;
  const column = getTokenHudRightColumn(html);
  if (!tokenDocument?.isOwner || !column) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-icon tt-speaker-toggle";
  button.innerHTML = '<i class="fas fa-microphone" aria-hidden="true"></i>';
  showMarkState(button, getSpeakerUserId(tokenDocument) === game.user.id);
  button.addEventListener("click", () => onClick(button, tokenDocument));
  column.append(button);
}

async function onClick(button, tokenDocument) {
  try {
    await toggleSpeakerMark(tokenDocument, game.user);
    showMarkState(button, getSpeakerUserId(tokenDocument) === game.user.id);
  } catch (error) {
    notify.error("TALKING_TOKENS.Notifications.MarkFailed");
    log.error("The speaking token could not be changed.", error);
  }
}

function showMarkState(button, isMarked) {
  const label = game.i18n.localize(isMarked ? "TALKING_TOKENS.Hud.Unmark" : "TALKING_TOKENS.Hud.Mark");
  button.classList.toggle("active", isMarked);
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(isMarked));
}
