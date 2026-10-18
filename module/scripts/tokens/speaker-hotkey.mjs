import { MODULE_ID } from "../module-id.mjs";
import { log, notify } from "../output.mjs";
import { markSpeakerToken } from "./token-flags.mjs";

/**
 * A key that makes the hovered token the user's speaking token, for example for a player with several characters.
 * It sets the mark; it never removes it. Only owners can mark a token, as with the HUD microphone.
 * Call in the init hook: v11 accepts keybindings only before the bindings load.
 */
export function registerSpeakerHotkey() {
  game.keybindings.register(MODULE_ID, "markHoveredToken", {
    name: "TALKING_TOKENS.Hotkey.Name",
    hint: "TALKING_TOKENS.Hotkey.Hint",
    editable: [{ key: "KeyM" }],
    onDown: markHoveredToken,
  });
}

/** @returns {boolean} True if the key did its job, so core does not pass it to other bindings. */
function markHoveredToken() {
  const tokenDocument = canvas.tokens?.hover?.document;
  if (!tokenDocument?.isOwner) return false;
  markSpeakerToken(tokenDocument, game.user).then(
    () => notify.info("TALKING_TOKENS.Hotkey.Marked", { token: tokenDocument.name }),
    (error) => {
      notify.error("TALKING_TOKENS.Notifications.MarkFailed");
      log.error("The speaking token could not be changed.", error);
    },
  );
  return true;
}
