import { MODULE_ID } from "../module-id.mjs";
import { findSpeakerTokenIds, planMarkToggle } from "./speaker-rule.mjs";

/** All reads and writes of the token flags of this module go through this file. */
const FLAG = Object.freeze({
  SPEAKER_USER_ID: "speakerUserId",
  BUBBLE_STYLE: "bubbleStyle",
});

/** @returns {boolean} Did a token update change a flag of this module? */
export function hasModuleFlagChange(change) {
  return foundry.utils.hasProperty(change, `flags.${MODULE_ID}`);
}

/** @returns {string|null} The user who marked this token as their speaking token. */
export function getSpeakerUserId(tokenDocument) {
  return tokenDocument.getFlag(MODULE_ID, FLAG.SPEAKER_USER_ID) ?? null;
}

/** @returns {string|null} The bubble style of this token only, or null for the world default. */
export function getBubbleStyleOverride(tokenDocument) {
  return tokenDocument.getFlag(MODULE_ID, FLAG.BUBBLE_STYLE) ?? null;
}

/**
 * @param {Scene} scene
 * @param {User} user
 * @returns {import("./speaker-rule.mjs").TokenFacts[]}
 */
export function describeSceneTokens(scene, user) {
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
export function toggleSpeakerMark(tokenDocument, user) {
  const scene = tokenDocument.parent;
  const plan = planMarkToggle(describeSceneTokens(scene, user), tokenDocument.id, user.id);
  const key = `flags.${MODULE_ID}.${FLAG.SPEAKER_USER_ID}`;
  const removeKey = `flags.${MODULE_ID}.-=${FLAG.SPEAKER_USER_ID}`;
  const updates = plan.map(({ tokenId, speakerUserId }) => (speakerUserId
    ? { _id: tokenId, [key]: speakerUserId }
    : { _id: tokenId, [removeKey]: null }));
  return scene.updateEmbeddedDocuments("Token", updates);
}
