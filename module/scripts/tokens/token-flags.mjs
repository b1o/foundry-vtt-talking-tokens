import { MODULE_ID } from "../module-id.mjs";
import { findSpeakerTokenIds, planMarkToggle } from "./speaker-rule.mjs";

/** All reads and writes of the flags of this module (on tokens, and the bubble on actors) go through this file. */
const FLAG = Object.freeze({
  SPEAKER_USER_ID: "speakerUserId",
  BUBBLE_ID: "bubbleId",
});

/** @returns {boolean} Did a token update change the speaking mark? */
export function hasSpeakerMarkChange(change) {
  return hasFlagChange(change, FLAG.SPEAKER_USER_ID);
}

/** @returns {string|null} The user who marked this token as their speaking token. */
export function getSpeakerUserId(tokenDocument) {
  return tokenDocument.getFlag(MODULE_ID, FLAG.SPEAKER_USER_ID) ?? null;
}

/**
 * A token and an actor can each have their own bubble, with the same flag. The order of use is in
 * IndicatorStyle#bubblePathFor: the token, then its actor, then the world default.
 * @param {TokenDocument|Actor} document
 * @returns {string|null} The library id of the document's own bubble, or null if it has none.
 */
export function getOwnBubbleId(document) {
  return document.getFlag(MODULE_ID, FLAG.BUBBLE_ID) ?? null;
}

/**
 * @param {TokenDocument|Actor} document
 * @param {string|null} bubbleId  null: the document uses the next bubble in the order again.
 */
export function setOwnBubbleId(document, bubbleId) {
  if (bubbleId) return document.setFlag(MODULE_ID, FLAG.BUBBLE_ID, bubbleId);
  return document.unsetFlag(MODULE_ID, FLAG.BUBBLE_ID);
}

/**
 * The actor that holds the bubble of a token: the world Actor, also for an unlinked token, so all tokens of an actor
 * share it (TokenDocument#baseActor, client/data/documents/token.js:43).
 * @returns {Actor|null}
 */
export function getBubbleActorOfToken(tokenDocument) {
  return tokenDocument.baseActor ?? null;
}

/**
 * The same actor, seen from an actor sheet: the sheet of an unlinked token shows a synthetic actor.
 * @returns {Actor|null}
 */
export function getBubbleActorOfSheet(actor) {
  return actor.isToken ? (actor.token?.baseActor ?? null) : actor;
}

/** @returns {boolean} Did a token or actor update change the document's own bubble? */
export function hasBubbleChange(change) {
  return hasFlagChange(change, FLAG.BUBBLE_ID);
}

/** A set arrives as the key, a removal as "-=key" (the update syntax of unsetFlag). */
function hasFlagChange(change, flag) {
  const flags = change.flags?.[MODULE_ID] ?? {};
  return flag in flags || `-=${flag}` in flags;
}

/**
 * @param {Scene} scene
 * @param {User} user
 * @returns {import("./speaker-rule.mjs").TokenFacts[]}
 */
function describeSceneTokens(scene, user) {
  return scene.tokens.map((tokenDocument) => ({
    id: tokenDocument.id,
    actorId: tokenDocument.actorId ?? null,
    speakerUserId: getSpeakerUserId(tokenDocument),
    isOwnedByUser: tokenDocument.actor?.testUserPermission(user, "OWNER") ?? user.isGM,
  }));
}

/**
 * @param {Scene} scene
 * @param {User} user
 * @returns {string[]} The ids of the tokens in the scene that show this user's voice.
 */
export function findSceneSpeakerTokenIds(scene, user) {
  return findSpeakerTokenIds(describeSceneTokens(scene, user), { id: user.id, characterId: user.character?.id ?? null });
}

/**
 * @param {Scene|null} scene
 * @param {User} user
 * @returns {string[]} The names of the tokens in the scene that show this user's voice.
 */
export function findSceneSpeakerTokenNames(scene, user) {
  if (!scene) return [];
  return findSceneSpeakerTokenIds(scene, user).map((id) => scene.tokens.get(id)?.name ?? id);
}

/**
 * Mark the token as the user's speaking token in its scene, or remove the mark if it is there already.
 * The scene is read right before the write, so a change by another user in the meantime is kept.
 * @param {TokenDocument} tokenDocument
 * @param {User} user
 */
export async function toggleSpeakerMark(tokenDocument, user) {
  const scene = tokenDocument.parent;
  const changes = planMarkToggle(describeSceneTokens(scene, user), tokenDocument.id, user.id);
  const key = `flags.${MODULE_ID}.${FLAG.SPEAKER_USER_ID}`;
  const removeKey = `flags.${MODULE_ID}.-=${FLAG.SPEAKER_USER_ID}`;
  const updates = changes.map(({ tokenId, speakerUserId }) => (speakerUserId
    ? { _id: tokenId, [key]: speakerUserId }
    : { _id: tokenId, [removeKey]: null }));
  await scene.updateEmbeddedDocuments("Token", updates);
}
