import { MODULE_ID } from "../module-id.mjs";
import { findSpeakerTokenIds, planMark, planMarkToggle } from "./speaker-rule.mjs";

/** All reads and writes of the token flags of this module go through this file. */
const FLAG = Object.freeze({
  SPEAKER_USER_ID: "speakerUserId",
  BUBBLE_ID: "bubbleId",
});

/** @returns {boolean} Did a token update change a flag of this module? */
export function hasModuleFlagChange(change) {
  return foundry.utils.hasProperty(change, `flags.${MODULE_ID}`);
}

/** @returns {string|null} The user who marked this token as their speaking token. */
export function getSpeakerUserId(tokenDocument) {
  return tokenDocument.getFlag(MODULE_ID, FLAG.SPEAKER_USER_ID) ?? null;
}

/** @returns {string|null} The library id of this token's own bubble, or null for the world default. */
export function getTokenBubbleId(tokenDocument) {
  return tokenDocument.getFlag(MODULE_ID, FLAG.BUBBLE_ID) ?? null;
}

/** @param {string|null} bubbleId  null: the token uses the world default again. */
export function setTokenBubbleId(tokenDocument, bubbleId) {
  if (bubbleId) return tokenDocument.setFlag(MODULE_ID, FLAG.BUBBLE_ID, bubbleId);
  return tokenDocument.unsetFlag(MODULE_ID, FLAG.BUBBLE_ID);
}

/** @returns {boolean} Did a token update change the token's own bubble? */
export function hasTokenBubbleChange(change) {
  const flags = change.flags?.[MODULE_ID] ?? {};
  return FLAG.BUBBLE_ID in flags || `-=${FLAG.BUBBLE_ID}` in flags;
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
 * @param {TokenDocument} tokenDocument
 * @param {User} user
 */
export function toggleSpeakerMark(tokenDocument, user) {
  return applyMarkPlan(tokenDocument, user, planMarkToggle);
}

/**
 * Make the token the user's speaking token in its scene. A marked token stays marked.
 * @param {TokenDocument} tokenDocument
 * @param {User} user
 */
export function markSpeakerToken(tokenDocument, user) {
  return applyMarkPlan(tokenDocument, user, planMark);
}

/** The scene is read right before the write, so a change by another user in the meantime is kept. */
async function applyMarkPlan(tokenDocument, user, plan) {
  const scene = tokenDocument.parent;
  const changes = plan(describeSceneTokens(scene, user), tokenDocument.id, user.id);
  if (changes.length === 0) return;
  const key = `flags.${MODULE_ID}.${FLAG.SPEAKER_USER_ID}`;
  const removeKey = `flags.${MODULE_ID}.-=${FLAG.SPEAKER_USER_ID}`;
  const updates = changes.map(({ tokenId, speakerUserId }) => (speakerUserId
    ? { _id: tokenId, [key]: speakerUserId }
    : { _id: tokenId, [removeKey]: null }));
  await scene.updateEmbeddedDocuments("Token", updates);
}
