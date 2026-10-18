import { getTokenHudRightColumn } from "../compat.mjs";
import { isOwnSpeakerMark, toggleOwnSpeakerMark } from "./speaker-mark-action.mjs";

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
  showMarkState(button, isOwnSpeakerMark(tokenDocument));
  button.addEventListener("click", async () => {
    const isMarked = await toggleOwnSpeakerMark(tokenDocument);
    if (isMarked !== null) showMarkState(button, isMarked);
  });
  column.append(button);
}

function showMarkState(button, isMarked) {
  const label = game.i18n.localize(isMarked ? "TALKING_TOKENS.Hud.Unmark" : "TALKING_TOKENS.Hud.Mark");
  button.classList.toggle("active", isMarked);
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(isMarked));
}
