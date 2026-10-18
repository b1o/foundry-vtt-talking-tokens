import { MODULE_ID } from "../module-id.mjs";
import { notify } from "../output.mjs";
import { toggleOwnSpeakerMark } from "./speaker-mark-action.mjs";

/**
 * A key that toggles the user's speaking mark on the hovered token, as the HUD microphone does. A second press removes
 * the mark, so the GM gets back to "no token shows my voice" without the HUD. Only owners can mark a token.
 * Call in the init hook: v11 accepts keybindings only before the bindings load.
 */
export function registerSpeakerHotkey() {
  game.keybindings.register(MODULE_ID, "toggleHoveredToken", {
    name: "TALKING_TOKENS.Hotkey.Name",
    hint: "TALKING_TOKENS.Hotkey.Hint",
    editable: [{ key: "KeyM" }],
    onDown: toggleHoveredToken,
  });
}

/** @returns {boolean} True if the key did its job, so core does not pass it to other bindings. */
function toggleHoveredToken() {
  const tokenDocument = canvas.tokens?.hover?.document;
  if (!tokenDocument?.isOwner) return false;
  // The HUD shows the new state on its button; the key has no button, so a notification says it.
  toggleOwnSpeakerMark(tokenDocument).then((isMarked) => {
    if (isMarked === null) return;
    notify.info(isMarked ? "TALKING_TOKENS.Hotkey.Marked" : "TALKING_TOKENS.Hotkey.Unmarked", { token: tokenDocument.name });
  });
  return true;
}
