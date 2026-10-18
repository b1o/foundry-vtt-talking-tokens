import { log, notify } from "../output.mjs";
import { getSpeakerUserId, toggleSpeakerMark } from "./token-flags.mjs";

/**
 * The current user toggles their speaking mark on a token: the action of the HUD microphone and of the key.
 * @param {TokenDocument} tokenDocument
 * @returns {Promise<boolean|null>} Is the token now the user's speaking token? null if the change failed; the user
 *   saw an error then.
 */
export async function toggleOwnSpeakerMark(tokenDocument) {
  try {
    await toggleSpeakerMark(tokenDocument, game.user);
  } catch (error) {
    notify.error("TALKING_TOKENS.Notifications.MarkFailed");
    log.error("The speaking token could not be changed.", error);
    return null;
  }
  return isOwnSpeakerMark(tokenDocument);
}

/** @returns {boolean} Did the current user mark this token? */
export function isOwnSpeakerMark(tokenDocument) {
  return getSpeakerUserId(tokenDocument) === game.user.id;
}
