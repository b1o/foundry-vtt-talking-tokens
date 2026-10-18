/**
 * Which token shows a user's voice in a scene (PLAN.md 5.4):
 *   1. the token that the user marked with the microphone toggle,
 *   2. else the tokens of the user's assigned character,
 *   3. else none.
 *
 * @typedef {object} TokenFacts
 * @property {string} id
 * @property {string|null} actorId
 * @property {string|null} speakerUserId  The user who marked this token, if any.
 * @property {boolean} isOwnedByUser      Does the user in question own this token?
 *
 * @typedef {object} SpeakerUser
 * @property {string} id
 * @property {string|null} characterId
 */

/**
 * @param {TokenFacts[]} tokens  The tokens of one scene, with isOwnedByUser for this user.
 * @param {SpeakerUser} user
 * @returns {string[]} The ids of the tokens that show this user's voice.
 */
export function findSpeakerTokenIds(tokens, user) {
  // A mark on a token that the user no longer owns does not count; the GM may have taken the token away.
  const marked = tokens.filter((token) => token.speakerUserId === user.id && token.isOwnedByUser);
  if (marked.length > 0) return marked.map((token) => token.id);
  if (!user.characterId) return [];
  return tokens.filter((token) => token.actorId === user.characterId).map((token) => token.id);
}

/**
 * @typedef {{tokenId: string, speakerUserId: string|null}} MarkChange  null removes the mark.
 */

/**
 * The flag changes that toggle the mark of a user on one token (the HUD microphone).
 * @param {TokenFacts[]} tokens  The tokens of the scene, as they are right before the write.
 * @param {string} tokenId
 * @param {string} userId
 * @returns {MarkChange[]}
 */
export function planMarkToggle(tokens, tokenId, userId) {
  if (isMarkedBy(tokens, tokenId, userId)) return [{ tokenId, speakerUserId: null }];
  return planMark(tokens, tokenId, userId);
}

/**
 * The flag changes that make one token the user's speaking token (the hotkey). A user has at most one marked token
 * per scene, so marking a new token removes the mark from the old one. A token that is already marked stays as it is.
 * @param {TokenFacts[]} tokens  The tokens of the scene, as they are right before the write.
 * @param {string} tokenId
 * @param {string} userId
 * @returns {MarkChange[]}
 */
export function planMark(tokens, tokenId, userId) {
  if (isMarkedBy(tokens, tokenId, userId)) return [];
  // Only owned tokens: the user cannot update another token, and findSpeakerTokenIds ignores such a mark anyway.
  const oldMarks = tokens.filter((token) => token.speakerUserId === userId && token.id !== tokenId
    && token.isOwnedByUser);
  return [...oldMarks.map((token) => ({ tokenId: token.id, speakerUserId: null })), { tokenId, speakerUserId: userId }];
}

function isMarkedBy(tokens, tokenId, userId) {
  return tokens.find((token) => token.id === tokenId)?.speakerUserId === userId;
}
